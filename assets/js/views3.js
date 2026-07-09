/* =====================================================================
 * views3.js — 기록 / 데이터 분석 / 공유 / 공유 열람 / 양육자 / 백오피스
 * ===================================================================== */
(function (global) {
  'use strict';
  var V = global.Views;
  var esc = UI.esc, nl2br = UI.nl2br, icon = UI.icon, Modal = UI.Modal, toast = UI.toast;
  var S = V._S, RT = V._RT;
  var readForm = V._readForm, readRows = V._readRows, ownedChild = V._ownedChild;
  var notFound = V._notFound, manualCount = V._manualCount;
  var childContextBar = V._childContextBar, pageHead = V._pageHead;

  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function dynRow(fields, vals) {
    vals = vals || {};
    var inner = fields.map(function (f) {
      return '<input class="input" data-f="' + f.k + '" placeholder="' + esc(f.ph || '') +
        '" value="' + esc(vals[f.k] || '') + '" style="flex:' + (f.flex || 1) + '">';
    }).join('');
    return '<div class="dyn-row" style="display:flex;gap:8px;margin-bottom:8px">' + inner +
      '<button type="button" class="btn-icon dyn-del" style="flex:none">' + icon('x', 16) + '</button></div>';
  }
  function shareURL(token) {
    return location.origin + location.pathname + '#/v/' + token;
  }

  /* =====================================================================
   * 기록 (행동 / 치료 / 변화)
   * ===================================================================== */
  /* 기록용 짧은 영상(릴스) — 촬영 중 카메라 스트림 정리 */
  var _clipStream = null;
  V._clipCleanup = function () {
    if (_clipStream) {
      try { _clipStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      _clipStream = null;
    }
  };
  function fmtClip(s) {
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }
  var CLIP_MAX = 30; // 릴스 — 최대 30초

  /* 기록 제목 추천 — 유형별 (6/10 회의: 일상 기록은 짧게 짧게) */
  var REC_TITLE_QUICK = {
    behavior: [
      '마트에서 차분하게 기다렸어요', '큰 소리에 귀를 막고 주저앉았어요',
      '순서 기다리기를 연습했어요', '새로운 음식을 한 입 먹어봤어요'
    ],
    treatment: [
      '언어치료 수업', '감각통합 치료', '놀이치료 수업', '병원 정기 진료'
    ],
    change: [
      '처음으로 혼자 해냈어요', '새로운 단어를 말했어요',
      '눈맞춤이 길어졌어요', '낯선 곳에서도 편안해 보였어요'
    ],
    assessment: [
      '언어평가 결과', '발달검사(K-CDI) 결과',
      '지능검사(K-WISC) 결과', '감각프로파일 검사 결과'
    ]
  };

  function recordModal(childId, rec, opts) {
    opts = opts || {};
    var isNew = !rec;
    rec = rec || { childId: childId, type: 'behavior', date: todayStr(),
                   title: '', content: '', tags: [], mood: 3, photo: null };
    if (isNew) { rec.id = Store.uid('rec'); rec.createdAt = Store.nowISO(); }
    var photoData = rec.photo || null;
    var mood = rec.mood || 3;

    // 영상 클립(릴스) 컨트롤러 상태
    var CL = {
      state: 'empty',    // empty | loading | capturing | review
      blob: null, url: null, duration: 0,
      isNew: false, removed: false,
      stream: null, recorder: null, chunks: [], recording: false,
      recT0: 0, recTimer: null
    };

    var typeOpts = Object.keys(RT).map(function (k) {
      return '<option value="' + k + '"' + (rec.type === k ? ' selected' : '') + '>' +
        esc(RT[k].label) + '</option>';
    }).join('');

    Modal.open({
      title: isNew ? '기록 추가' : '기록 수정', icon: 'note', wide: true,
      body:
        '<div class="field-row">' +
          '<div class="field"><label>기록 유형</label>' +
            '<select class="select" name="type">' + typeOpts + '</select></div>' +
          '<div class="field"><label>날짜</label>' +
            '<input class="input" name="date" type="date" value="' + esc(rec.date) + '"></div>' +
        '</div>' +
        '<div class="field"><label>' + icon('camera', 14) +
          ' 짧은 영상 (릴스) <span class="faint">최대 30초 · 세로 영상 권장</span></label>' +
          '<div id="clip-sec" class="clip-sec"></div></div>' +
        '<div class="field"><label>제목 <span class="req">*</span></label>' +
          '<div style="display:flex;gap:6px;align-items:center">' +
            '<input class="input" name="title" style="flex:1" value="' + esc(rec.title) + '" ' +
            'placeholder="예) 처음으로 친구에게 먼저 인사했어요">' +
            '<button type="button" class="btn btn-icon voice-btn" data-voice-id="rec-title" ' +
            'aria-label="음성 입력">' + icon('mic', 17) + '</button>' +
          '</div>' +
          '<div class="quick-chips" id="rec-title-quick" style="margin-top:8px"></div></div>' +
        '<div class="field"><label>내용 ' +
          '<span class="faint">' + icon('mic', 12) + ' 마이크로 말하면 자동으로 입력돼요</span></label>' +
          '<div style="display:flex;gap:6px;align-items:flex-start">' +
            '<textarea class="textarea" name="content" style="flex:1" ' +
            'placeholder="상황과 아이의 반응을 적어 주세요. (마이크 버튼으로 음성 입력 가능)">' +
            esc(rec.content) + '</textarea>' +
            '<button type="button" class="btn btn-icon voice-btn" data-voice-id="rec-content" ' +
            'aria-label="음성 입력">' + icon('mic', 17) + '</button>' +
          '</div>' +
          '<div class="row gap-sm" style="margin-top:8px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-soft btn-sm" id="rec-pull-meds">' +
              icon('pill', 15) + '프로필 약물 불러오기</button>' +
            '<span class="faint" style="font-size:.78rem">프로필에 등록한 약물을 기록 내용에 넣어요</span>' +
          '</div></div>' +
        '<div class="field"><label>태그 <span class="faint">(쉼표로 구분)</span></label>' +
          '<input class="input" name="tags" value="' + esc((rec.tags || []).join(', ')) +
          '" placeholder="예) 사회성, 의사소통"></div>' +
        '<div class="field"><label>그날의 컨디션</label>' +
          '<div id="mood-pick" style="display:flex;gap:6px">' +
            [1, 2, 3, 4, 5].map(function (i) {
              return '<button type="button" class="btn btn-ghost" data-mood="' + i + '" ' +
                'style="font-size:1.3rem;padding:6px 12px">' +
                ['😣', '😕', '😐', '🙂', '😊'][i - 1] + '</button>';
            }).join('') +
          '</div></div>' +
        '<div class="field"><label>사진 <span class="faint">(선택)</span></label>' +
          '<div class="row" style="gap:12px">' +
            '<div id="rec-photo" style="width:84px;height:84px;border-radius:10px;overflow:hidden;' +
              'background:var(--surface-2);display:grid;place-items:center;flex:none">' +
              (photoData ? '<img src="' + photoData + '" style="width:100%;height:100%;object-fit:cover">'
                : '<span class="faint">' + icon('camera', 22) + '</span>') + '</div>' +
            '<label class="btn btn-ghost btn-sm" style="cursor:pointer">사진 선택' +
              '<input type="file" id="rec-photo-input" accept="image/*" hidden></label>' +
          '</div></div>',
      onMount: function (root) {
        /* --- 음성 입력 (STT) — 제목·내용 --- */
        var titleEl = root.querySelector('[name="title"]');
        var contentEl = root.querySelector('[name="content"]');
        var vTitle = root.querySelector('[data-voice-id="rec-title"]');
        var vContent = root.querySelector('[data-voice-id="rec-content"]');
        if (vTitle && titleEl) UI.attachVoiceInput(vTitle, titleEl);
        if (vContent && contentEl) UI.attachVoiceInput(vContent, contentEl);

        /* --- 프로필 약물 불러오기 — 등록된 약물을 기록 내용에 삽입 --- */
        var pullBtn = root.querySelector('#rec-pull-meds');
        if (pullBtn) pullBtn.onclick = function () {
          var ch = Store.getChild(childId);
          var meds = (ch && ch.medications) || [];
          if (!meds.length) { toast('프로필에 등록된 약물이 없어요', 'err'); return; }
          var lines = meds.map(function (m) {
            var p = V._medPeriod ? V._medPeriod(m) : (m.period || '');
            return '· ' + m.name + (m.dose ? ' ' + m.dose : '') +
              (m.time ? ' · ' + m.time : '') + (p ? ' · ' + p : '') +
              (m.note ? ' (' + m.note + ')' : '');
          });
          var block = '[복약 정보]\n' + lines.join('\n');
          var cur = (contentEl.value || '').trim();
          contentEl.value = cur ? (cur + '\n\n' + block) : block;
          contentEl.focus();
          toast('약물 정보를 불러왔어요', 'ok');
        };

        /* --- 제목 추천 칩 — 유형에 맞춰 갱신, 탭하면 입력 --- */
        var typeSel = root.querySelector('[name="type"]');
        var titleQuick = root.querySelector('#rec-title-quick');
        function paintTitleQuick() {
          var pool = REC_TITLE_QUICK[typeSel.value] || [];
          titleQuick.innerHTML = pool.map(function (t) {
            return '<button type="button" class="chip quick" data-tq="' + esc(t) +
              '"><b>+</b>' + esc(t) + '</button>';
          }).join('');
          titleQuick.querySelectorAll('[data-tq]').forEach(function (b) {
            b.onclick = function () { titleEl.value = b.dataset.tq; titleEl.focus(); };
          });
        }
        paintTitleQuick();
        typeSel.addEventListener('change', paintTitleQuick);

        /* --- 컨디션 --- */
        function paintMood() {
          root.querySelectorAll('[data-mood]').forEach(function (b) {
            var on = parseInt(b.dataset.mood, 10) <= mood;
            b.style.opacity = on ? '1' : '.35';
            b.style.background = parseInt(b.dataset.mood, 10) === mood ? 'var(--primary-soft)' : '';
          });
        }
        root.querySelectorAll('[data-mood]').forEach(function (b) {
          b.onclick = function () { mood = parseInt(b.dataset.mood, 10); paintMood(); };
        });
        paintMood();

        /* --- 사진 --- */
        root.querySelector('#rec-photo-input').addEventListener('change', function (e) {
          var file = e.target.files[0]; if (!file) return;
          UI.fileToDataURL(file, 800, function (url) {
            if (!url) { toast('이미지를 불러오지 못했어요', 'err'); return; }
            photoData = url;
            root.querySelector('#rec-photo').innerHTML =
              '<img src="' + url + '" style="width:100%;height:100%;object-fit:cover">';
          });
        });

        /* --- 영상 클립 (릴스) --- */
        var sec = root.querySelector('#clip-sec');
        function stopStream() {
          if (CL.stream) { try { CL.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
          CL.stream = null; _clipStream = null;
        }
        function cleanupClip() {
          if (CL.recording) { CL.recording = false; }
          if (CL.recTimer) clearInterval(CL.recTimer);
          stopStream();
          if (CL.url) { try { URL.revokeObjectURL(CL.url); } catch (e) {} }
        }

        function renderClip() {
          if (CL.state === 'loading') {
            sec.innerHTML = '<p class="faint" style="font-size:.84rem;padding:8px 0">' +
              '기존 영상을 불러오는 중…</p>';
            return;
          }
          if (CL.state === 'empty') {
            sec.innerHTML =
              '<div class="clip-empty">' +
                '<button type="button" class="btn btn-primary btn-sm" id="cl-rec">' +
                  icon('camera', 15) + '짧은 영상 촬영</button>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="cl-up">' +
                  icon('download', 15) + '영상 선택</button>' +
                '<input type="file" id="cl-file" accept="video/*" hidden>' +
              '</div>';
            sec.querySelector('#cl-rec').onclick = function () { CL.state = 'capturing'; renderClip(); };
            sec.querySelector('#cl-up').onclick = function () { sec.querySelector('#cl-file').click(); };
            sec.querySelector('#cl-file').onchange = function (e) {
              if (e.target.files[0]) onClipFile(e.target.files[0]);
            };
            return;
          }
          if (CL.state === 'capturing') {
            sec.innerHTML =
              '<div class="reels-cap">' +
                '<div class="reels-frame">' +
                  '<video id="cl-cam" class="reels-video" autoplay muted playsinline></video>' +
                  '<div class="reels-timer" id="cl-timer">0:00 / 0:' + CLIP_MAX + '</div>' +
                '</div>' +
                '<div class="reels-progress"><div id="cl-bar"></div></div>' +
                '<div class="reels-ctrl"><button type="button" class="rec-btn" id="cl-toggle" ' +
                  'aria-label="녹화"></button></div>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="cl-cancel">취소</button>' +
              '</div>';
            sec.querySelector('#cl-toggle').onclick = function () {
              CL.recording ? stopRec() : startRec();
            };
            sec.querySelector('#cl-cancel').onclick = function () {
              cleanupClip(); CL.state = 'empty'; renderClip();
            };
            initCam();
            return;
          }
          // review
          sec.innerHTML =
            '<div class="reels-review">' +
              '<div class="reels-frame">' +
                '<video id="cl-rev" class="reels-video" controls playsinline></video></div>' +
              '<div class="row gap-sm" style="justify-content:center;margin-top:8px;flex-wrap:wrap">' +
                '<span class="badge ok dot">영상 클립 ' + fmtClip(CL.duration) + '</span>' +
                '<button type="button" class="btn btn-ghost btn-sm" id="cl-redo">다시</button>' +
                '<button type="button" class="btn btn-danger btn-sm" id="cl-rm">제거</button>' +
              '</div>' +
            '</div>';
          sec.querySelector('#cl-rev').src = CL.url;
          sec.querySelector('#cl-redo').onclick = function () {
            if (CL.url) { try { URL.revokeObjectURL(CL.url); } catch (e) {} CL.url = null; }
            CL.blob = null; CL.isNew = false; CL.state = 'empty'; renderClip();
          };
          sec.querySelector('#cl-rm').onclick = function () {
            if (CL.url) { try { URL.revokeObjectURL(CL.url); } catch (e) {} CL.url = null; }
            CL.blob = null; CL.isNew = false; CL.removed = true;
            CL.state = 'empty'; renderClip();
          };
        }

        function initCam() {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camFail(); return; }
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 720 }, height: { ideal: 1280 } },
            audio: true
          }).catch(function () {
            return navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          }).then(function (s) {
            CL.stream = s; _clipStream = s;
            var cam = sec.querySelector('#cl-cam');
            if (!cam) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
            cam.srcObject = s;
          }).catch(camFail);
        }
        function camFail() {
          toast('카메라를 사용할 수 없어요. 영상 선택을 이용해 주세요', 'err');
          CL.state = 'empty'; renderClip();
        }
        function startRec() {
          if (!CL.stream) return;
          CL.chunks = [];
          var ropts = {};
          ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].some(function (m) {
            if (global.MediaRecorder && MediaRecorder.isTypeSupported(m)) { ropts.mimeType = m; return true; }
            return false;
          });
          try { CL.recorder = new MediaRecorder(CL.stream, ropts); }
          catch (e) {
            try { CL.recorder = new MediaRecorder(CL.stream); }
            catch (e2) { toast('이 브라우저는 녹화를 지원하지 않아요', 'err'); return; }
          }
          CL.recorder.ondataavailable = function (e) { if (e.data.size) CL.chunks.push(e.data); };
          CL.recorder.onstop = function () {
            var blob = new Blob(CL.chunks, { type: CL.chunks[0] ? CL.chunks[0].type : 'video/webm' });
            stopStream();
            CL.blob = blob; CL.isNew = true; CL.removed = false;
            CL.url = URL.createObjectURL(blob);
            CL.state = 'review'; renderClip();
          };
          CL.recorder.start();
          CL.recording = true; CL.recT0 = Date.now();
          var tog = sec.querySelector('#cl-toggle');
          if (tog) tog.classList.add('recording');
          CL.recTimer = setInterval(function () {
            var s = (Date.now() - CL.recT0) / 1000;
            var tm = sec.querySelector('#cl-timer'), bar = sec.querySelector('#cl-bar');
            if (tm) tm.textContent = fmtClip(s) + ' / 0:' + CLIP_MAX;
            if (bar) bar.style.width = Math.min(100, s / CLIP_MAX * 100) + '%';
            if (s >= CLIP_MAX) stopRec();
          }, 150);
        }
        function stopRec() {
          if (!CL.recording) return;
          CL.recording = false;
          CL.duration = (Date.now() - CL.recT0) / 1000;
          clearInterval(CL.recTimer);
          try { CL.recorder.stop(); } catch (e) {}
        }
        function onClipFile(file) {
          if (!file.type || file.type.indexOf('video') !== 0) {
            toast('영상 파일만 첨부할 수 있어요', 'err'); return;
          }
          if (CL.url) { try { URL.revokeObjectURL(CL.url); } catch (e) {} }
          CL.blob = file; CL.isNew = true; CL.removed = false;
          CL.url = URL.createObjectURL(file);
          CL.duration = 0;
          var tmp = document.createElement('video');
          tmp.preload = 'metadata';
          tmp.onloadedmetadata = function () {
            CL.duration = isFinite(tmp.duration) ? tmp.duration : 0;
            if (CL.duration > CLIP_MAX + 5) {
              toast('기록용 영상은 짧은 클립을 권장해요 (' + CLIP_MAX + '초 이내)', 'err');
            }
            var b = sec.querySelector('.badge.ok');
            if (b) b.textContent = '영상 클립 ' + fmtClip(CL.duration);
          };
          tmp.src = CL.url;
          CL.state = 'review'; renderClip();
        }

        // 기존 클립 불러오기 (수정 시)
        if (!isNew && rec.hasClip && rec.clipKey && VideoDB.available()) {
          CL.state = 'loading'; renderClip();
          VideoDB.get(rec.clipKey).then(function (blob) {
            if (blob) {
              CL.blob = blob; CL.isNew = false; CL.duration = rec.clipDuration || 0;
              CL.url = URL.createObjectURL(blob); CL.state = 'review';
            } else { CL.state = 'empty'; }
            renderClip();
          }).catch(function () { CL.state = 'empty'; renderClip(); });
        } else {
          renderClip();
          if (opts.autoClip) { CL.state = 'capturing'; renderClip(); }
        }

        // 모달이 닫힐 때 카메라 정리
        var host = UI.el('modal-host');
        var xb = host.querySelector('[data-mclose]');
        var bd = host.querySelector('[data-mbackdrop]');
        if (xb) { var ox = xb.onclick; xb.onclick = function () { cleanupClip(); if (ox) ox(); }; }
        if (bd) {
          var ob = bd.onclick;
          bd.onclick = function (e) { if (e.target === e.currentTarget) cleanupClip(); if (ob) ob(e); };
        }
        // onButton 에서 쓰도록 컨트롤러 노출
        CL._cleanup = cleanupClip;
        CL._stopRec = stopRec;
      },
      buttons: [
        { label: '취소', value: 'cancelx', variant: 'ghost' },
        { label: isNew ? '기록 추가' : '저장', value: 'ok', variant: 'primary' }
      ],
      onButton: function (v, root) {
        if (v === 'cancelx') { if (CL._cleanup) CL._cleanup(); return; }
        if (v !== 'ok') return;
        if (CL.recording) { toast('녹화를 먼저 정지해 주세요', 'err'); return 'keep'; }
        var f = readForm(root);
        if (!f.title) { toast('제목을 입력해 주세요', 'err'); return 'keep'; }
        rec.type = f.type; rec.date = f.date || todayStr();
        rec.title = f.title; rec.content = f.content;
        rec.tags = f.tags ? f.tags.split(',').map(function (t) { return t.trim(); })
          .filter(Boolean) : [];
        rec.mood = mood; rec.photo = photoData;

        // 영상 클립 처리
        if (CL.removed && !CL.blob) {
          rec.hasClip = false; rec.clipKey = null;
          rec.clipMime = ''; rec.clipDuration = 0; rec.clipSize = 0;
          if (VideoDB.available()) VideoDB.del(rec.id).catch(function () {});
          Store.saveRecord(rec);
        } else if (CL.blob && CL.isNew) {
          rec.hasClip = true; rec.clipKey = rec.id;
          rec.clipMime = CL.blob.type; rec.clipDuration = CL.duration || 0;
          rec.clipSize = CL.blob.size;
          Store.saveRecord(rec);
          if (VideoDB.available()) {
            VideoDB.put(rec.id, CL.blob).catch(function () {
              var r2 = Store.getRecord(rec.id);
              if (r2) { r2.hasClip = false; r2.clipKey = null; Store.saveRecord(r2); }
              toast('영상 저장에 실패했지만 기록은 보관되었습니다', 'err');
            });
          }
        } else {
          Store.saveRecord(rec);
        }
        if (CL._cleanup) CL._cleanup();
        toast(isNew ? '기록이 추가되었습니다' : '수정되었습니다', 'ok');
        App.refresh();
      }
    });
  }

  V.records = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var all = Store.recordsOf(child.id);
      var list = S.recFilter === 'all' ? all
        : all.filter(function (r) { return r.type === S.recFilter; });

      var seg = '<div class="seg no-print">' +
        [['all', '전체'], ['behavior', '행동'], ['treatment', '치료'],
         ['change', '변화'], ['assessment', '검사']]
          .map(function (o) {
            return '<button class="' + (S.recFilter === o[0] ? 'on' : '') +
              '" data-f="' + o[0] + '">' + o[1] + '</button>';
          }).join('') + '</div>';

      var body;
      if (!list.length) {
        body = '<div class="card empty"><div class="emoji">🗒️</div>' +
          '<h3>아직 기록이 없어요</h3>' +
          '<p>행동·치료·변화의 순간을 짧은 영상이나 글로 남겨 보세요.</p>' +
          '<button class="btn btn-primary" id="empty-add">첫 기록 남기기</button></div>';
      } else {
        body = '<div class="timeline">' + list.map(function (r) {
          var meta = RT[r.type];
          return '<div class="tl-item t-' + r.type + '">' +
            '<div class="card rec-card" data-rec="' + r.id + '">' +
              '<div class="rec-main">' +
                '<div class="rec-top">' +
                  '<span class="badge" style="background:' + meta.color + '22;color:' + meta.color + '">' +
                    esc(meta.label) + '</span>' +
                  (r.hasClip ? '<span class="badge brand">' + icon('camera', 11) + ' 영상</span>' : '') +
                  UI.moodStars(r.mood) +
                  '<span class="rec-date">' + UI.fmtDate(r.date) + '</span>' +
                '</div>' +
                '<div class="rec-title">' + esc(r.title) + '</div>' +
                (r.content ? '<div class="rec-content">' + esc(r.content) + '</div>' : '') +
                (r.photo ? '<img src="' + r.photo + '" style="margin-top:8px;max-height:150px;' +
                  'border-radius:8px">' : '') +
                (r.tags && r.tags.length ? '<div style="margin-top:7px">' + r.tags.map(function (t) {
                  return '<span class="tag">#' + esc(t) + '</span>';
                }).join('') + '</div>' : '') +
              '</div>' +
              (r.hasClip ? '<div class="clip-thumb-wrap">' +
                '<video class="clip-thumb" data-clipthumb="' + r.id + '" muted playsinline ' +
                'preload="metadata"></video>' +
                '<span class="clip-play">' + icon('camera', 15) + '</span></div>' : '') +
            '</div></div>';
        }).join('') + '</div>';
      }

      return childContextBar(child, 'records') +
        pageHead('기록', child.name + ' 기록',
          '행동·치료·변화의 순간을 짧은 영상(릴스)이나 글로 남깁니다.',
          '<button class="btn btn-ghost btn-sm" id="btn-reels">' + icon('camera', 15) + '영상으로 기록</button>' +
          '<button class="btn btn-primary btn-sm" id="btn-add-rec">' + icon('plus', 15) + '기록 추가</button>') +
        '<div class="mb-2">' + seg + '</div>' + body;
    },
    mount: function (p) {
      var child = ownedChild(p.childId); if (!child) return;
      var ba = UI.el('btn-add-rec');
      if (ba) ba.onclick = function () { recordModal(child.id, null); };
      var br = UI.el('btn-reels');
      if (br) br.onclick = function () { recordModal(child.id, null, { autoClip: true }); };
      var ea = UI.el('empty-add');
      if (ea) ea.onclick = function () { recordModal(child.id, null); };
      document.querySelectorAll('[data-f]').forEach(function (b) {
        if (!b.closest('.seg')) return;
        b.onclick = function () { S.recFilter = b.dataset.f; App.refresh(); };
      });
      // 클립 썸네일 지연 로드
      document.querySelectorAll('[data-clipthumb]').forEach(function (v) {
        if (!VideoDB.available()) return;
        VideoDB.get(v.dataset.clipthumb).then(function (blob) {
          if (!blob) return;
          v.src = URL.createObjectURL(blob);
          v.onloadedmetadata = function () {
            try { v.currentTime = Math.min(0.15, (v.duration || 0.3) / 2); } catch (e) {}
          };
        }).catch(function () {});
      });
      document.querySelectorAll('[data-rec]').forEach(function (c) {
        c.onclick = function () {
          var r = Store.getRecord(c.dataset.rec);
          if (!r) return;
          var meta = RT[r.type];
          Modal.open({
            title: '기록 상세', icon: meta.icon, wide: true,
            body: '<div class="row mb-2"><span class="badge" style="background:' + meta.color +
              '22;color:' + meta.color + '">' + esc(meta.label) + '</span>' +
              UI.moodStars(r.mood) +
              '<span class="rec-date" style="margin-left:auto">' + UI.fmtDate(r.date) + '</span></div>' +
              '<h3 class="mb-1">' + esc(r.title) + '</h3>' +
              (r.content ? '<p class="muted" style="line-height:1.6">' + nl2br(r.content) + '</p>' : '') +
              (r.hasClip ? '<div id="rec-clip-host" class="mt-2"><p class="faint" ' +
                'style="font-size:.84rem">영상을 불러오는 중…</p></div>' : '') +
              (r.photo ? '<img src="' + r.photo + '" style="margin-top:10px;border-radius:10px">' : '') +
              (r.tags && r.tags.length ? '<div style="margin-top:10px">' + r.tags.map(function (t) {
                return '<span class="tag">#' + esc(t) + '</span>';
              }).join('') + '</div>' : ''),
            onMount: function (droot) {
              if (r.hasClip && r.clipKey && VideoDB.available()) {
                var host = droot.querySelector('#rec-clip-host');
                VideoDB.get(r.clipKey).then(function (blob) {
                  if (!host) return;
                  if (blob) {
                    host.innerHTML = '<div class="rec-clip-player"><div class="reels-frame">' +
                      '<video class="reels-video" controls playsinline src="' +
                      URL.createObjectURL(blob) + '"></video></div></div>';
                  } else {
                    host.innerHTML = '<p class="faint" style="font-size:.84rem">' +
                      '저장된 영상을 찾을 수 없습니다.</p>';
                  }
                }).catch(function () {
                  if (host) host.innerHTML = '<p class="faint" style="font-size:.84rem">' +
                    '영상을 불러오지 못했습니다.</p>';
                });
              }
            },
            buttons: [
              { label: '삭제', value: 'del', variant: 'danger' },
              { label: '수정', value: 'edit', variant: 'primary' }
            ],
            onButton: function (v) {
              // '수정'·'삭제'는 같은 modal-host에 새 모달(편집/확인)을 띄우므로
              // 'keep'을 반환해 상세 모달의 자동 close()가 새 모달을 지우지 않게 한다.
              if (v === 'edit') { recordModal(child.id, r); return 'keep'; }
              if (v === 'del') {
                Modal.confirm({ title: '기록 삭제', message: '이 기록을 삭제할까요?',
                  okLabel: '삭제', danger: true }).then(function (ok) {
                  if (!ok) return;
                  if (r.hasClip && r.clipKey && VideoDB.available()) {
                    VideoDB.del(r.clipKey).catch(function () {});
                  }
                  Store.deleteRecord(r.id);
                  toast('삭제되었습니다', 'ok'); App.refresh();
                });
                return 'keep';
              }
            }
          });
        };
      });
    }
  };

  /* (구 V.records 정의 제거됨 — 위의 영상 클립(릴스) 지원 버전으로 통합) */

  /* =====================================================================
   * 데이터 분석
   * ===================================================================== */
  V.analysis = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var recs = Store.recordsOf(child.id);
      var manual = Store.getManual(child.id);

      var html = childContextBar(child, 'analysis') +
        pageHead('데이터 분석', child.name + ' 데이터 분석',
          '행동·치료·변화 기록을 시각화하고 위기 신호를 살펴드립니다.');

      /* --- 위기 / 점검 알림 --- */
      var alerts = [];
      var now = Date.now();
      var recent30 = recs.filter(function (r) {
        return (now - new Date(r.date).getTime()) < 30 * 864e5;
      });
      var lowMood = recent30.filter(function (r) {
        return r.type === 'behavior' && r.mood <= 2;
      });
      if (lowMood.length >= 2) {
        alerts.push({ lv: 'warn', t: '컨디션 저하 신호',
          d: '최근 30일간 컨디션이 낮은 행동 기록이 ' + lowMood.length +
             '건 있습니다. 환경 변화나 스트레스 요인을 함께 살펴보세요.' });
      }
      if (manual && manualCount(manual)) {
        var days = Math.floor((now - new Date(manual.updatedAt).getTime()) / 864e5);
        if (days >= 60) {
          alerts.push({ lv: 'info', t: '설명서 업데이트 권장',
            d: '설명서가 ' + days + '일 동안 수정되지 않았어요. 아이의 변화를 반영해 보세요.' });
        }
      }
      if (!recent30.length) {
        alerts.push({ lv: 'info', t: '최근 기록 없음',
          d: '최근 30일간 새로운 기록이 없습니다. 작은 변화도 기록으로 남겨 보세요.' });
      }
      if (!alerts.length) {
        alerts.push({ lv: 'ok', t: '특이 신호 없음',
          d: '현재 주의가 필요한 신호는 발견되지 않았어요. 꾸준히 기록해 주세요.' });
      }
      html += '<div class="card mb-2"><div class="card-head">' +
        '<span style="color:var(--primary)">' + icon('alert', 18) + '</span>' +
        '<h3>위기사항 · 점검 알림</h3></div><div class="card-body">' +
        alerts.map(function (a) {
          var cls = a.lv === 'warn' ? 'pill-warn' : a.lv === 'ok' ? '' : '';
          var box = a.lv === 'warn' ? 'pill-info pill-warn' : 'pill-info';
          return '<div class="' + box + '" style="margin-bottom:8px">' +
            icon(a.lv === 'ok' ? 'check' : 'info', 16) +
            '<div><b>' + esc(a.t) + '</b><br>' + esc(a.d) + '</div></div>';
        }).join('') + '</div></div>';

      if (!recs.length) {
        html += '<div class="card empty"><div class="emoji">📊</div>' +
          '<h3>분석할 기록이 없어요</h3><p>기록을 남기면 그래프로 정리해 드려요.</p>' +
          '<button class="btn btn-primary" onclick="App.navigate(\'#/records/' + child.id + '\')">' +
          '기록하러 가기</button></div>';
        return html;
      }

      /* --- 월별 기록 수 --- */
      var months = [];
      var d = new Date();
      for (var i = 5; i >= 0; i--) {
        var dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
        var key = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2);
        months.push({ key: key, label: (dt.getMonth() + 1) + '월',
          value: recs.filter(function (r) { return (r.date || '').slice(0, 7) === key; }).length });
      }
      /* --- 유형별 분포 --- */
      var dist = Object.keys(RT).map(function (k) {
        return { label: RT[k].label, color: RT[k].color,
          value: recs.filter(function (r) { return r.type === k; }).length };
      });
      /* --- 기분 추이 --- */
      var moodPts = recs.slice().sort(function (a, b) {
        return a.date < b.date ? -1 : 1;
      }).slice(-10).map(function (r) {
        var dd = new Date(r.date);
        return { label: (dd.getMonth() + 1) + '/' + dd.getDate(), value: r.mood };
      });
      /* --- 태그 --- */
      var tagMap = {};
      recs.forEach(function (r) {
        (r.tags || []).forEach(function (t) { tagMap[t] = (tagMap[t] || 0) + 1; });
      });
      var tags = Object.keys(tagMap).map(function (k) { return { t: k, n: tagMap[k] }; })
        .sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
      var avgMood = (recs.reduce(function (s, r) { return s + (r.mood || 3); }, 0) / recs.length);

      html += '<div class="grid grid-4 mb-2">' +
        [['총 기록', recs.length + '건', 'note'],
         ['평균 컨디션', avgMood.toFixed(1) + ' / 5', 'smile'],
         ['최근 30일', recent30.length + '건', 'calendar'],
         ['변화 기록', recs.filter(function (r) { return r.type === 'change'; }).length + '건', 'sparkle']]
        .map(function (s) {
          return '<div class="stat"><div class="ico">' + icon(s[2], 20) + '</div>' +
            '<div class="label">' + s[0] + '</div><div class="value">' + s[1] + '</div></div>';
        }).join('') + '</div>';

      html += '<div class="grid grid-2" style="align-items:start">' +
        '<div class="card"><div class="card-head"><h3>월별 기록 수</h3></div>' +
          '<div class="card-body">' + UI.barChart(months) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>유형별 분포</h3></div>' +
          '<div class="card-body" style="padding-top:28px">' + UI.distBar(dist) + '</div></div>' +
        '<div class="card"><div class="card-head"><h3>컨디션 추이</h3></div>' +
          '<div class="card-body">' + UI.lineChart(moodPts, { min: 1, max: 5 }) +
          '<p class="faint center" style="font-size:.78rem;margin-top:6px">최근 기록 기준 1~5점</p></div></div>' +
        '<div class="card"><div class="card-head"><h3>자주 등장하는 키워드</h3></div>' +
          '<div class="card-body">' +
          (tags.length ? tags.map(function (t) {
            return '<div class="row" style="padding:6px 0;border-bottom:1px solid var(--border)">' +
              '<span class="tag">#' + esc(t.t) + '</span>' +
              '<div style="flex:1;height:8px;background:var(--surface-2);border-radius:99px;overflow:hidden">' +
                '<div style="height:100%;width:' + (t.n / tags[0].n * 100) +
                '%;background:var(--primary)"></div></div>' +
              '<b style="font-size:.85rem">' + t.n + '</b></div>';
          }).join('') : '<p class="muted">태그가 아직 없어요.</p>') +
          '</div></div>' +
      '</div>';
      return html;
    },
    mount: function () {}
  };

  /* =====================================================================
   * 공유 관리
   * ===================================================================== */
  /* 정보 공개 레벨 (6/10 회의: 정보별 공개 범위 옵션) */
  var SCOPE_META = {
    emergency: { t: '응급 카드',  cls: 'danger',
      d: '한 줄 소개 + 비상연락·알레르기·응급 대응 + 의사소통 방법만 — 민감 정보 최소화' },
    summary:   { t: '요약 정보',  cls: '',
      d: '설명서 전체 + 응급 정보 — 학교·치료실 등 일상 돌봄에 적합' },
    full:      { t: '전체 정보',  cls: 'info',
      d: '요약 정보 + 복약 정보 포함 — 병원·의료진에게 적합' }
  };

  V.share = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var AUD = V._AUDIENCES;
      var manual = Store.getManual(child.id) || Store.saveManual(Store.emptyManual(child.id));
      if (!S.shareAudience) S.shareAudience = 'school';
      var aud = S.shareAudience;
      var shares = Store.sharesOf(child.id);

      if (manualCount(manual) === 0) {
        return childContextBar(child, 'share') +
          '<div class="card empty"><div class="emoji">📝</div>' +
          '<h3>설명서를 먼저 채워 주세요</h3>' +
          '<p>대상별 설명서는 작성한 내용을 바탕으로 자동으로 만들어집니다.</p>' +
          '<button class="btn btn-primary" onclick="App.navigate(\'#/manual/' + child.id + '\')">' +
          '설명서 작성하러 가기</button></div>';
      }

      var list = shares.length
        ? shares.map(function (s) {
            var revoked = s.revoked;
            var am = (s.audience && AUD[s.audience]) || null;
            var label = am ? am.label : (SCOPE_META[s.scope] || SCOPE_META.summary).t;
            return '<div class="card card-pad mb-2"' + (revoked ? ' style="opacity:.55"' : '') + '>' +
              '<div class="row between wrap" style="margin-bottom:8px">' +
                '<div><b>' + esc(s.viewerName || '이름 없는 열람자') + '</b> ' +
                  '<span class="badge">' + esc(s.viewerRole) + '</span> ' +
                  '<span class="badge brand">' + esc(label) + '</span>' +
                  (s.safeNumber ? ' <span class="badge ok">안심번호</span>' : '') +
                  (revoked ? ' <span class="badge danger">중단됨</span>' : '') +
                '</div>' +
                '<span class="faint" style="font-size:.8rem">' + icon('eye', 13) + ' ' +
                  (s.views || 0) + '회 열람</span>' +
              '</div>' +
              '<div class="row wrap" style="gap:10px">' +
                '<div class="code-box" style="flex:1;min-width:200px">' +
                  '<span>' + esc(shareURL(s.token)) + '</span>' +
                  '<button class="btn btn-soft btn-sm" data-copy="' + esc(shareURL(s.token)) + '">' +
                    icon('copy', 14) + '복사</button></div>' +
                '<div style="text-align:center"><div class="faint" style="font-size:.74rem">인증번호</div>' +
                  '<div style="font-weight:800;letter-spacing:.15em;color:var(--primary-dark)">' +
                  esc(s.accessCode) + '</div></div>' +
                (revoked ? '' :
                  '<button class="btn btn-ghost btn-sm" data-qr="' + esc(s.token) +
                    '" data-qr-code="' + esc(s.accessCode) + '" data-qr-name="' + esc(child.name) + '">' +
                    icon('grid', 14) + 'QR·키링 카드</button>') +
              '</div>' +
              (revoked ? ''
                : '<div class="sns-row" style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--border);' +
                  'display:flex;flex-wrap:wrap;gap:6px;align-items:center">' +
                  '<span class="faint" style="font-size:.78rem;margin-right:4px">공유하기</span>' +
                  '<button class="btn btn-soft btn-sm sns-btn" data-web-share="1" ' +
                    'data-token="' + esc(s.token) + '" data-code="' + esc(s.accessCode) + '" ' +
                    'data-name="' + esc(child.name) + '">' + icon('share', 13) + '모든 앱</button>' +
                  '<button class="btn btn-ghost btn-sm sns-btn" data-sns="twitter" ' +
                    'data-token="' + esc(s.token) + '" data-code="' + esc(s.accessCode) + '" ' +
                    'data-name="' + esc(child.name) + '" aria-label="X(트위터) 공유"><b>X</b></button>' +
                  '<button class="btn btn-ghost btn-sm sns-btn" data-sns="facebook" ' +
                    'data-token="' + esc(s.token) + '" data-code="' + esc(s.accessCode) + '" ' +
                    'data-name="' + esc(child.name) + '" aria-label="페이스북 공유"><b>f</b> Facebook</button>' +
                  '<button class="btn btn-ghost btn-sm sns-btn" data-sns="line" ' +
                    'data-token="' + esc(s.token) + '" data-code="' + esc(s.accessCode) + '" ' +
                    'data-name="' + esc(child.name) + '" aria-label="라인 공유"><b>LINE</b></button>' +
                  '<button class="btn btn-ghost btn-sm sns-btn" data-sns="email" ' +
                    'data-token="' + esc(s.token) + '" data-code="' + esc(s.accessCode) + '" ' +
                    'data-name="' + esc(child.name) + '">' + icon('mail', 13) + '이메일</button>' +
                  '<button class="btn btn-ghost btn-sm sns-btn" data-sns="sms" ' +
                    'data-token="' + esc(s.token) + '" data-code="' + esc(s.accessCode) + '" ' +
                    'data-name="' + esc(child.name) + '">' + icon('message', 13) + 'SMS</button>' +
                '</div>') +
              '<div class="row between mt-1">' +
                '<span class="faint" style="font-size:.78rem">' + UI.fmtDate(s.createdAt) + ' 생성</span>' +
                (revoked ? ''
                  : '<button class="btn btn-danger btn-sm" data-revoke="' + s.id + '">공유 중단</button>') +
              '</div></div>';
          }).join('')
        : '<div class="card empty"><div class="emoji">🔗</div>' +
          '<h3>아직 만든 공유가 없어요</h3>' +
          '<p>인증 링크를 만들어 학교·병원·치료실에 안전하게 전달하세요.</p></div>';

      // 방문 노트 — 열람자들이 남긴 기록 (협업 1단계: 읽기 공유 → 한마디 참여)
      var notes = Store.visitNotesOfChild(child.id);
      var noteSec = '<div class="card mt-2"><div class="card-head">' +
        '<span style="color:var(--brand-grow)">' + icon('message', 18) + '</span>' +
        '<h3>방문 노트</h3><span class="badge">' + notes.length + '개</span></div>' +
        '<div class="card-body">' +
        '<p class="muted mb-2" style="font-size:.88rem">공유 링크로 설명서를 본 선생님·치료사가 ' +
        '남긴 한마디입니다. 치료사·교사가 직접 기록에 참여하는 팀 기능은 2차 개발에서 확장됩니다.</p>' +
        (notes.length
          ? notes.map(function (n) {
              return '<div class="item-row">' +
                '<span class="bullet" style="background:var(--brand-grow)">' + icon('message', 12) + '</span>' +
                '<div class="txt"><b>' + esc(n.author) + '</b>' +
                (n.role ? ' <span class="badge">' + esc(n.role) + '</span>' : '') +
                ' <span class="faint" style="font-size:.78rem">' + UI.fmtDateTime(n.createdAt) + '</span>' +
                '<div style="margin-top:3px">' + nl2br(n.text) + '</div></div>' +
                '<div class="item-actions"><button class="btn-icon" data-vndel="' + n.id + '">' +
                  icon('trash', 15) + '</button></div></div>';
            }).join('')
          : '<p class="faint" style="font-size:.88rem">아직 받은 노트가 없어요. 공유 링크를 받은 ' +
            '열람자가 노트를 남기면 여기에 모입니다.</p>') +
        '</div></div>';

      // 대상 선택 카드
      var audPicker = Object.keys(AUD).map(function (k) {
        var a = AUD[k];
        return '<button type="button" class="aud-card' + (k === aud ? ' on' : '') + '" data-aud="' + k + '">' +
          '<span class="aud-ico" style="background:' + a.color + '">' + icon(a.icon, 20) + '</span>' +
          '<span><b>' + esc(a.label) + '</b><p>' + esc(a.intro) + '</p></span></button>';
      }).join('');

      var preview = '<div class="print-area">' +
        V._summarySheet(child, manual, { audience: aud }) + '</div>';

      var hub =
        '<div class="card card-pad mb-3">' +
          '<div class="page-head-row mb-2"><div>' +
            '<div class="eyebrow" style="color:var(--primary)">대상별 설명서</div>' +
            '<h2 style="font-size:1.2rem">누구에게 보여줄 설명서인가요?</h2></div></div>' +
          '<p class="muted mb-2" style="font-size:.9rem">대상에 맞는 내용만 골라 한 장으로 정리됩니다. ' +
            '새 선생님·치료사를 만나도 다시 설명할 필요 없이 링크 하나로 전달하세요.</p>' +
          '<div class="aud-grid">' + audPicker + '</div>' +
          '<div class="row gap-sm mt-2" style="flex-wrap:wrap">' +
            '<button class="btn btn-primary" id="btn-share-aud">' + icon('share', 16) +
              '이 설명서로 공유 링크·QR 만들기</button>' +
            '<button class="btn btn-ghost no-print" id="btn-print-aud">' + icon('print', 16) +
              'PDF로 저장</button>' +
          '</div>' +
        '</div>' +
        preview;

      var listSection = '<div class="page-head-row mb-2 mt-3"><h2 style="font-size:1.15rem">공유한 링크</h2></div>' +
        '<div class="pill-info mb-2">' + icon('lock', 16) +
          '<div>공유 링크는 <b>4자리 인증번호</b>를 입력해야 열람할 수 있고, 비상연락처는 ' +
          '<b>안심번호(050)</b>로 표시됩니다. 필요 없어지면 ‘공유 중단’으로 차단하세요.</div></div>' +
        list;

      return childContextBar(child, 'share') +
        pageHead('대상별 설명서', child.name + ' 설명서 공유',
          '대상에 맞는 「내 아이 설명서」를 만들어 학교·병원·치료실에 바로 전달하세요.') +
        hub + listSection + noteSec;
    },
    mount: function (p) {
      var child = ownedChild(p.childId); if (!child) return;
      var AUD = V._AUDIENCES;

      // 대상 선택 → 미리보기 갱신
      document.querySelectorAll('[data-aud]').forEach(function (b) {
        b.onclick = function () { S.shareAudience = b.dataset.aud; App.refresh(); };
      });
      var bp = UI.el('btn-print-aud');
      if (bp) bp.onclick = function () { window.print(); };
      var bs = UI.el('btn-share-aud');
      if (bs) bs.onclick = function () {
        var audience = S.shareAudience || 'school';
        var a = AUD[audience] || AUD.school;
        Modal.open({
          title: a.label + ' 설명서 공유', icon: 'share',
          body:
            '<p class="muted mb-2" style="font-size:.9rem"><b>' + esc(a.label) +
              ' 설명서</b>로 공유 링크를 만듭니다. 받는 분 정보를 적어 주세요.</p>' +
            '<div class="field"><label>받는 분 이름 / 소속</label>' +
              '<input class="input" name="viewerName" placeholder="예) 햇살초 1학년 담임"></div>' +
            '<div class="field"><label>받는 분 유형</label>' +
              '<select class="select" name="viewerRole">' +
              ['학교', '병원', '치료기관', '활동지원사', '가족·친척', '기타'].map(function (o) {
                return '<option>' + o + '</option>';
              }).join('') + '</select></div>' +
            '<label class="checkline"><input type="checkbox" name="safeNumber" checked>' +
              '<span>비상연락처를 <b>안심번호(050)</b>로 표시 ' +
              '<span class="faint" style="font-size:.8rem">— 실제 번호는 보호자만</span></span></label>' +
            '<div class="pill-info" style="margin-top:10px">' + icon('info', 16) +
              '<div>생성 시 4자리 인증번호가 자동 발급됩니다. 링크와 인증번호를 함께 전달하세요.</div></div>',
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '공유 생성', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var f = readForm(root);
            var s = Store.createShare({
              childId: child.id, audience: audience, safeNumber: f.safeNumber,
              viewerName: f.viewerName, viewerRole: f.viewerRole
            });
            Modal.close();
            var qrSvg = QR.svg(shareURL(s.token), { cell: 4, margin: 3, width: 180 });
            Modal.open({
              title: '공유가 생성되었습니다', icon: 'check',
              body: '<p class="muted mb-2">' + esc(a.label) +
                ' 설명서 링크와 인증번호를 함께 전달하세요.</p>' +
                '<div style="text-align:center;margin-bottom:12px">' +
                  '<div style="display:inline-block;padding:10px;border:1px solid var(--border);' +
                  'border-radius:14px;background:#fff">' + (qrSvg || '') + '</div></div>' +
                '<div class="code-box mb-2"><span>' + esc(shareURL(s.token)) + '</span></div>' +
                '<div class="callout center mb-2"><div class="faint" style="font-size:.8rem">인증번호</div>' +
                '<div class="access-code">' + esc(s.accessCode) + '</div></div>',
              buttons: [
                { label: '링크 복사', value: 'copy', variant: 'soft' },
                { label: '확인', value: 'ok', variant: 'primary' }
              ],
              onButton: function (vv) {
                if (vv === 'copy') {
                  UI.copyText(shareURL(s.token) + ' (인증번호: ' + s.accessCode + ')')
                    .then(function () { toast('링크와 인증번호를 복사했어요', 'ok'); });
                  return 'keep';
                }
                App.refresh();
              }
            });
          }
        });
      };

      var _oldNewShare = UI.el('btn-new-share');
      if (_oldNewShare) _oldNewShare.onclick = function () {
        var scopeOpts = ['emergency', 'summary', 'full'].map(function (k) {
          var m = SCOPE_META[k];
          return '<label class="scope-opt' + (k === 'summary' ? ' on' : '') + '">' +
            '<input type="radio" name="scope" value="' + k + '"' +
              (k === 'summary' ? ' checked' : '') + '>' +
            '<span class="s-body"><span class="s-title">' + m.t +
              (k === 'summary' ? ' <span class="badge brand">기본</span>' : '') + '</span>' +
            '<span class="s-desc">' + m.d + '</span></span></label>';
        }).join('');
        Modal.open({
          title: '새 공유 만들기', icon: 'share',
          body:
            '<div class="field"><label>열람자 이름 / 소속</label>' +
              '<input class="input" name="viewerName" placeholder="예) 햇살초 1학년 담임"></div>' +
            '<div class="field"><label>열람자 유형</label>' +
              '<select class="select" name="viewerRole">' +
              ['학교', '병원', '치료기관', '가족·친척', '기타'].map(function (o) {
                return '<option>' + o + '</option>';
              }).join('') + '</select></div>' +
            '<div class="field"><label>정보 공개 레벨 <span class="faint">열람자에게 보여줄 범위</span></label>' +
              '<div class="scope-pick">' + scopeOpts + '</div></div>' +
            '<label class="checkline"><input type="checkbox" name="safeNumber" checked>' +
              '<span>비상연락처를 <b>안심번호(050)</b>로 표시 ' +
              '<span class="faint" style="font-size:.8rem">— 실제 번호는 보호자만 볼 수 있어요</span></span></label>' +
            '<div class="pill-info" style="margin-top:10px">' + icon('info', 16) +
              '<div>생성 시 4자리 인증번호가 자동 발급됩니다. 링크와 인증번호를 함께 전달하세요. ' +
              '안심번호는 정식 서비스에서 통신사 050 연동으로 제공됩니다.</div></div>',
          onMount: function (root) {
            root.querySelectorAll('.scope-opt input').forEach(function (r) {
              r.addEventListener('change', function () {
                root.querySelectorAll('.scope-opt').forEach(function (o) {
                  o.classList.toggle('on', o.querySelector('input').checked);
                });
              });
            });
          },
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '공유 생성', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var f = readForm(root);
            var s = Store.createShare({
              childId: child.id, scope: f.scope, safeNumber: f.safeNumber,
              viewerName: f.viewerName, viewerRole: f.viewerRole
            });
            Modal.close();
            Modal.open({
              title: '공유가 생성되었습니다', icon: 'check',
              body: '<p class="muted mb-2">아래 링크와 인증번호를 열람자에게 함께 전달하세요.</p>' +
                '<div class="code-box mb-2"><span>' + esc(shareURL(s.token)) + '</span></div>' +
                '<div class="callout center mb-2"><div class="faint" style="font-size:.8rem">인증번호</div>' +
                '<div class="access-code">' + esc(s.accessCode) + '</div></div>',
              buttons: [
                { label: '링크 복사', value: 'copy', variant: 'soft' },
                { label: '확인', value: 'ok', variant: 'primary' }
              ],
              onButton: function (vv) {
                if (vv === 'copy') {
                  UI.copyText(shareURL(s.token) + ' (인증번호: ' + s.accessCode + ')')
                    .then(function () { toast('링크와 인증번호를 복사했어요', 'ok'); });
                  return 'keep';
                }
                App.refresh();
              }
            });
          }
        });
      };
      document.querySelectorAll('[data-copy]').forEach(function (b) {
        b.onclick = function () {
          UI.copyText(b.dataset.copy).then(function (ok) {
            toast(ok ? '링크를 복사했어요' : '복사에 실패했어요', ok ? 'ok' : 'err');
          });
        };
      });
      document.querySelectorAll('[data-revoke]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '공유 중단', danger: true,
            message: '이 링크의 접근을 차단할까요? 열람자는 더 이상 설명서를 볼 수 없습니다.',
            okLabel: '공유 중단' }).then(function (ok) {
            if (ok) { Store.revokeShare(b.dataset.revoke); toast('공유가 중단되었습니다', 'ok'); App.refresh(); }
          });
        };
      });
      // 방문 노트 삭제 (보호자 권한)
      document.querySelectorAll('[data-vndel]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '노트 삭제', message: '이 방문 노트를 삭제할까요?',
            okLabel: '삭제', danger: true }).then(function (ok) {
            if (ok) { Store.deleteVisitNote(b.dataset.vndel); toast('삭제되었습니다', 'ok'); App.refresh(); }
          });
        };
      });

      // QR 코드 + 키링 카드 인쇄 (6/10 회의: 가방·키링에 다는 QR 응급 카드)
      function keyringCardHTML(name, token, code) {
        var qrSvg = QR.svg(shareURL(token), { cell: 4, margin: 2, width: 132 });
        var c = Store.getChild(child.id) || child;
        var contact = (c.emergency && c.emergency.contacts && c.emergency.contacts[0]) || null;
        return '<div class="keyring-card">' +
          '<div class="kc-qr">' + (qrSvg || '<span class="faint">QR 생성 불가</span>') + '</div>' +
          '<div class="kc-body">' +
            '<div class="kc-brand">STELLAR CONNECT 안심 카드</div>' +
            '<div class="kc-name">' + esc(name) + '</div>' +
            '<div class="kc-guide">QR을 스캔하고 인증번호 <b>' + esc(code) + '</b>를 입력하면 ' +
              '아이의 응급 정보를 볼 수 있어요.</div>' +
            (contact ? '<div class="kc-contact">' +
              '보호자 ' + esc(contact.name) + ' · ' + esc(contact.phone) + '</div>' : '') +
          '</div></div>';
      }
      document.querySelectorAll('[data-qr]').forEach(function (b) {
        b.onclick = function () {
          var token = b.dataset.qr, code = b.dataset.qrCode, name = b.dataset.qrName;
          var qrSvg = QR.svg(shareURL(token), { cell: 4, margin: 3, width: 196 });
          Modal.open({
            title: 'QR 코드 · 키링 카드', icon: 'grid',
            body:
              '<div style="text-align:center">' +
                '<div style="display:inline-block;padding:10px;border:1px solid var(--border);' +
                  'border-radius:14px;background:#fff">' +
                  (qrSvg || '<p class="muted">링크가 너무 길어 QR을 만들 수 없어요.</p>') + '</div>' +
                '<div class="mt-1"><span class="faint" style="font-size:.8rem">인증번호</span> ' +
                  '<b style="letter-spacing:.15em;color:var(--primary-dark)">' + esc(code) + '</b></div>' +
              '</div>' +
              '<div class="pill-info mt-2">' + icon('info', 16) +
                '<div>인쇄해서 <b>아이 가방·키링</b>에 달아 두세요. 위급 상황에서 주변 어른이 ' +
                'QR을 스캔하면 비상연락처와 응급 정보를 바로 확인할 수 있습니다. ' +
                '공개 수준은 공유 설정(응급 카드 권장)을 따릅니다.</div></div>',
            buttons: [
              { label: '닫기', value: 'cancel', variant: 'ghost' },
              { label: '키링 카드 인쇄', value: 'print', variant: 'primary' }
            ],
            onButton: function (v) {
              if (v !== 'print') return;
              var holder = document.createElement('div');
              holder.className = 'print-area keyring-print';
              holder.innerHTML = keyringCardHTML(name, token, code);
              document.body.appendChild(holder);
              window.print();
              document.body.removeChild(holder);
            }
          });
        };
      });

      // SNS 공유 버튼 (Web Share API + 트위터/페북/라인/이메일/SMS 폴백)
      document.querySelectorAll('.sns-btn').forEach(function (b) {
        b.onclick = function () {
          var url = shareURL(b.dataset.token);
          var code = b.dataset.code;
          var name = b.dataset.name || '아이';
          var text = name + ' 설명서를 공유합니다. (Stellar Connect) — 인증번호: ' + code;
          if (b.dataset.webShare) {
            UI.webShare({ title: 'Stellar Connect — ' + name + ' 설명서',
              text: text, url: url }).then(function (ok) {
              if (!ok) {
                UI.copyText(url + ' (인증번호: ' + code + ')').then(function () {
                  toast('링크와 인증번호를 복사했어요', 'ok');
                });
              }
            });
            return;
          }
          var u = UI.snsShareUrl(b.dataset.sns, url, text);
          if (!u) return;
          if (b.dataset.sns === 'email' || b.dataset.sns === 'sms') {
            location.href = u;
          } else {
            window.open(u, '_blank', 'noopener,noreferrer');
          }
        };
      });
    }
  };

  /* =====================================================================
   * 공유 열람 (외부 공개 — 로그인 불필요)
   * ===================================================================== */
  var viewerAuthed = {};  // token -> true (세션 내 인증 통과)

  V.viewer = {
    layout: 'public',
    render: function (p) {
      var share = Store.getShareByToken(p.token);
      var AUD = V._AUDIENCES;
      var topBar = '<div class="app-bar"><div class="brand">' + UI.brandMark(34) +
        '<div class="wordmark"><b>내 아이 설명서</b>' +
        '<span>Stellar Connect · S:CON</span></div></div></div>';

      if (!share || share.revoked) {
        return topBar + '<div class="container narrow"><div class="card empty">' +
          '<div class="emoji">🔒</div><h3>열람할 수 없는 링크입니다</h3>' +
          '<p>링크가 만료되었거나 공유가 중단되었습니다. 보호자에게 문의해 주세요.</p></div></div>';
      }
      var child = Store.getChild(share.childId);
      var manual = child ? Store.getManual(child.id) : null;
      if (!child || !manual) {
        return topBar + '<div class="container narrow"><div class="card empty">' +
          '<div class="emoji">🔍</div><h3>설명서를 찾을 수 없습니다</h3></div></div>';
      }

      if (!viewerAuthed[share.token]) {
        return topBar + '<div class="container narrow" style="padding-top:44px">' +
          '<div class="card card-pad" style="max-width:380px;margin:0 auto;text-align:center">' +
          '<div style="color:var(--primary)">' + icon('lock', 36) + '</div>' +
          '<h2 style="margin:10px 0 4px">인증번호 입력</h2>' +
          '<p class="muted mb-3" style="font-size:.9rem">보호자에게 전달받은 ' +
            '4자리 인증번호를 입력해 주세요.</p>' +
          '<form id="vauth-form">' +
            '<input class="input" id="vauth-code" inputmode="numeric" maxlength="4" ' +
              'style="text-align:center;font-size:1.6rem;letter-spacing:.4em;font-weight:800" ' +
              'placeholder="0000">' +
            '<button class="btn btn-primary btn-block btn-lg" type="submit" style="margin-top:14px">' +
              '설명서 열람</button>' +
          '</form></div></div>';
      }

      // 인증 통과 → 설명서 노출
      var myNotes = Store.visitNotesOfShare(share.id);
      var notesList = myNotes.length
        ? myNotes.map(function (n) {
            return '<div class="item-row"><span class="bullet" style="background:var(--brand-grow)">' +
              icon('message', 12) + '</span>' +
              '<div class="txt"><b>' + esc(n.author) + '</b>' +
              (n.role ? ' <span class="badge">' + esc(n.role) + '</span>' : '') +
              ' <span class="faint" style="font-size:.78rem">' + UI.fmtDateTime(n.createdAt) + '</span>' +
              '<div style="margin-top:3px">' + nl2br(n.text) + '</div></div></div>';
          }).join('')
        : '';
      var audLabel = (share.audience && AUD[share.audience]) ? AUD[share.audience].label
        : (SCOPE_META[share.scope] || SCOPE_META.summary).t;
      return topBar + '<div class="container">' +
        '<div class="pill-info mb-2">' + icon('eye', 16) +
          '<div><b>' + esc(share.viewerName || '열람자') + '</b> 님에게 공유된 ' +
          '<b>' + esc(audLabel) + '</b> 설명서입니다.</div></div>' +
        '<div class="print-area">' + V._summarySheet(child, manual,
          { audience: share.audience, scope: share.scope, safe: !!share.safeNumber, token: share.token }) + '</div>' +
        '<div class="row no-print" style="justify-content:center;margin-top:18px">' +
          '<button class="btn btn-ghost" onclick="window.print()">' + icon('print', 16) +
            'PDF로 저장 / 인쇄</button></div>' +

        /* 방문 노트 — 열람자가 보호자에게 남기는 한마디 (협업 1단계) */
        '<div class="card mt-2 no-print"><div class="card-head">' +
          '<span style="color:var(--brand-grow)">' + icon('message', 18) + '</span>' +
          '<h3>방문 노트 남기기</h3></div><div class="card-body">' +
          '<p class="muted mb-2" style="font-size:.88rem">설명서를 확인하셨다면, 오늘 아이의 모습이나 ' +
          '전하고 싶은 말을 보호자에게 남겨 주세요. 이름과 함께 보호자 화면에 전달됩니다.</p>' +
          notesList +
          '<div class="field-row" style="margin-top:10px">' +
            '<div class="field"><label>이름</label>' +
              '<input class="input" id="vn-author" value="' + esc(share.viewerName || '') +
              '" placeholder="예) 김◯◯ 선생님"></div>' +
            '<div class="field"><label>역할</label><select class="select" id="vn-role">' +
              ['치료사', '교사', '의료진', '가족·친척', '활동지원사', '기타'].map(function (r) {
                return '<option' + (share.viewerRole === r ? ' selected' : '') + '>' + r + '</option>';
              }).join('') + '</select></div>' +
          '</div>' +
          '<div class="field"><label>내용</label>' +
            '<textarea class="textarea" id="vn-text" ' +
            'placeholder="예) 오늘 수업에서 차례 기다리기를 잘했어요. 가정에서도 칭찬해 주세요!"></textarea></div>' +
          '<div class="row" style="justify-content:flex-end">' +
            '<button class="btn btn-primary btn-sm" id="vn-save">' + icon('check', 14) +
              '노트 남기기</button></div>' +
        '</div></div>' +

        '<p class="center faint" style="margin-top:20px;font-size:.8rem">' +
          '본 설명서는 보호자의 동의 하에 공유되었으며, 열람자는 정보를 외부에 공유할 수 없습니다.</p>' +
        '</div>';
    },
    mount: function (p) {
      var form = UI.el('vauth-form');
      if (form) {
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var share = Store.getShareByToken(p.token);
          var code = UI.el('vauth-code').value.trim();
          if (share && code === String(share.accessCode)) {
            viewerAuthed[share.token] = true;
            Store.bumpShareViews(share.id);
            App.refresh();
          } else {
            toast('인증번호가 올바르지 않습니다', 'err');
          }
        });
      }
      // 방문 노트 저장
      var vnSave = UI.el('vn-save');
      if (vnSave) vnSave.onclick = function () {
        var share = Store.getShareByToken(p.token);
        if (!share) return;
        var author = UI.el('vn-author').value.trim();
        var text = UI.el('vn-text').value.trim();
        if (!author || !text) { toast('이름과 내용을 입력해 주세요', 'err'); return; }
        Store.addVisitNote({ shareId: share.id, childId: share.childId,
          author: author, role: UI.el('vn-role').value, text: text });
        toast('노트가 보호자에게 전달되었습니다. 감사합니다!', 'ok');
        App.refresh();
      };
    }
  };

  /* =====================================================================
   * 양육자 정보
   * ===================================================================== */
  V.caregiver = {
    layout: 'app',
    render: function () {
      var u = Store.currentUser();
      var ctRows = u.emergencyContacts.length
        ? u.emergencyContacts.map(function (c) {
            return dynRow([{ k: 'name', ph: '이름' }, { k: 'relation', ph: '관계' },
              { k: 'phone', ph: '연락처', flex: 1.4 }], c);
          }).join('')
        : '';
      var providerLabel = { email: '이메일', kakao: '카카오', naver: '네이버' }[u.provider] || '이메일';

      return pageHead('양육자 정보', u.name + '님의 정보',
        '보호자 정보와 알림 설정을 관리합니다.') +
        '<form id="cg-form">' +
        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('user', 18) + '</span><h3>기본 정보</h3></div><div class="card-body">' +
          '<div class="field-row">' +
            '<div class="field"><label>이름</label>' +
              '<input class="input" name="name" value="' + esc(u.name) + '"></div>' +
            '<div class="field"><label>휴대전화</label>' +
              '<input class="input" name="phone" value="' + esc(u.phone) + '"></div>' +
          '</div>' +
          '<div class="field"><label>이메일</label>' +
            '<input class="input" value="' + esc(u.email) + '" disabled ' +
            'style="background:var(--surface-2)"></div>' +
          '<div class="row gap-sm">' +
            '<span class="badge">' + esc(providerLabel) + ' 가입</span>' +
            (u.verified ? '<span class="badge ok dot">본인인증 완료</span>'
              : '<span class="badge warn dot">본인인증 미완료</span>') +
          '</div>' +
          '<div class="field mt-2"><label>건강 상태 메모</label>' +
            '<textarea class="textarea" name="healthStatus" ' +
            'placeholder="보호자 건강 관련 특이사항이 있다면 적어 주세요.">' +
            esc(u.healthStatus) + '</textarea></div>' +
        '</div></div>' +

        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('phone', 18) + '</span><h3>비상 연락망</h3></div><div class="card-body">' +
          '<p class="muted mb-2" style="font-size:.88rem">보호자 부재 등 위기 상황에 대비한 연락처입니다.</p>' +
          '<div id="cg-ct">' + ctRows + '</div>' +
          '<button type="button" class="btn btn-soft btn-sm" id="cg-add-ct">' +
            icon('plus', 15) + '연락처 추가</button>' +
        '</div></div>' +

        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('bell', 18) + '</span><h3>알림 설정</h3></div><div class="card-body">' +
          '<label class="checkline"><input type="checkbox" name="nPush"' +
            (u.notify.push ? ' checked' : '') + '><span>앱 푸시 알림 받기</span></label>' +
          '<label class="checkline"><input type="checkbox" name="nSchedule"' +
            (u.notify.schedule ? ' checked' : '') + '><span>일정·복약 알림 받기</span></label>' +
          '<label class="checkline"><input type="checkbox" name="nCrisis"' +
            (u.notify.crisis ? ' checked' : '') + '><span>위기 상황 알림 받기</span></label>' +
          '<p class="faint" style="font-size:.78rem;margin-top:6px">' +
            '1차 개발에서는 앱 푸시 알림 중심으로 제공됩니다. ' +
            '카카오 알림톡·문자 연동은 2차 개발 예정입니다.</p>' +
        '</div></div>' +

        '<div class="row" style="justify-content:flex-end;gap:10px">' +
          '<button type="submit" class="btn btn-primary btn-lg">' + icon('check', 17) + '저장</button>' +
        '</div>' +
        '</form>' +
        '<div class="card card-pad mt-2" style="border-color:#f0d7d4">' +
          '<h3 class="mb-1" style="color:var(--danger)">회원 탈퇴</h3>' +
          '<p class="muted mb-2" style="font-size:.88rem">' +
            '탈퇴 시 등록한 아이 정보와 설명서를 더 이상 이용할 수 없습니다.</p>' +
          '<button class="btn btn-danger btn-sm" id="btn-withdraw">회원 탈퇴</button>' +
        '</div>';
    },
    mount: function () {
      var u = Store.currentUser();
      UI.el('cg-add-ct').onclick = function () {
        UI.el('cg-ct').insertAdjacentHTML('beforeend',
          dynRow([{ k: 'name', ph: '이름' }, { k: 'relation', ph: '관계' },
            { k: 'phone', ph: '연락처', flex: 1.4 }], {}));
      };
      UI.el('cg-form').addEventListener('click', function (e) {
        var del = e.target.closest('.dyn-del');
        if (del) del.closest('.dyn-row').remove();
      });
      UI.el('cg-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        Store.updateUser(u.id, {
          name: f.name || u.name, phone: f.phone, healthStatus: f.healthStatus,
          emergencyContacts: readRows(UI.el('cg-ct'), ['name', 'relation', 'phone']),
          notify: { push: f.nPush, schedule: f.nSchedule, crisis: f.nCrisis }
        });
        toast('저장되었습니다', 'ok');
        App.refresh();
      });
      UI.el('btn-withdraw').onclick = function () {
        Modal.confirm({ title: '회원 탈퇴', danger: true,
          message: '정말 탈퇴하시겠어요?\n이 작업은 되돌릴 수 없습니다.', okLabel: '탈퇴하기' })
          .then(function (ok) {
            if (!ok) return;
            Store.withdraw(u.id); Store.logout();
            toast('탈퇴 처리되었습니다', 'ok');
            App.navigate('#/');
          });
      };
    }
  };

  /* =====================================================================
   * 백오피스 (관리자)
   * ===================================================================== */
  V.admin = {
    layout: 'app',
    render: function () {
      var u = Store.currentUser();
      if (!u || u.role !== 'admin') return notFound('관리자만 접근할 수 있어요');
      var db = Store.getDB();
      var tabs = [
        ['stats', '운영 현황'], ['members', '회원 관리'], ['verify', '아이 인증'],
        ['contents', '콘텐츠'], ['popups', '팝업·배너'], ['noti', '알림 발송']
      ];
      var tabBar = '<div class="manual-tabs">' + tabs.map(function (t) {
        return '<button class="manual-tab' + (S.adminTab === t[0] ? ' active' : '') +
          '" data-atab="' + t[0] + '">' + esc(t[1]) + '</button>';
      }).join('') + '</div>';

      return pageHead('백오피스', '운영 관리자', '회원·인증·콘텐츠·알림을 관리합니다.') +
        tabBar + '<div id="admin-panel">' + adminPanel(S.adminTab, db) + '</div>';
    },
    mount: function () {
      document.querySelectorAll('[data-atab]').forEach(function (b) {
        b.onclick = function () { S.adminTab = b.dataset.atab; App.refresh(); };
      });
      adminWire(S.adminTab);
    }
  };

  function adminPanel(tab, db) {
    if (tab === 'stats') {
      var st = Store.stats();
      var cards = [
        ['전체 회원', st.users + '명', 'users'], ['활성 회원', st.activeUsers + '명', 'user'],
        ['등록 아이', st.children + '명', 'smile'], ['인증 완료', st.verifiedChildren + '명', 'shield'],
        ['작성된 설명서', st.manuals + '건', 'book'], ['전체 기록', st.records + '건', 'note'],
        ['공유 링크', st.shares + '개', 'share'], ['인증 대기', st.pendingChildren + '건', 'clock']
      ];
      var byMonth = [];
      var d = new Date();
      for (var i = 5; i >= 0; i--) {
        var dt = new Date(d.getFullYear(), d.getMonth() - i, 1);
        var key = dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2);
        byMonth.push({ label: (dt.getMonth() + 1) + '월',
          value: db.children.filter(function (c) {
            return (c.createdAt || '').slice(0, 7) === key;
          }).length });
      }
      return '<div class="grid grid-4 mb-2">' + cards.map(function (c) {
        return '<div class="stat"><div class="ico">' + icon(c[2], 20) + '</div>' +
          '<div class="label">' + c[0] + '</div><div class="value">' + c[1] + '</div></div>';
      }).join('') + '</div>' +
      '<div class="card"><div class="card-head"><h3>월별 아이 등록 추이</h3></div>' +
        '<div class="card-body">' + UI.barChart(byMonth) + '</div></div>';
    }

    if (tab === 'members') {
      var rows = db.users.filter(function (x) { return x.role === 'parent'; }).map(function (m) {
        var kids = db.children.filter(function (c) { return c.ownerId === m.id; }).length;
        return '<tr><td><b>' + esc(m.name) + '</b></td><td>' + esc(m.email) + '</td>' +
          '<td>' + esc(m.phone || '-') + '</td><td>' + kids + '명</td>' +
          '<td>' + (m.status === 'active'
            ? '<span class="badge ok dot">활성</span>'
            : '<span class="badge danger dot">탈퇴</span>') + '</td>' +
          '<td>' + UI.fmtDate(m.createdAt) + '</td>' +
          '<td class="actions">' + (m.status === 'active'
            ? '<button class="btn btn-danger btn-sm" data-mem-toggle="' + m.id + '">정지</button>'
            : '<button class="btn btn-soft btn-sm" data-mem-toggle="' + m.id + '">복구</button>') +
          '</td></tr>';
      }).join('');
      return '<div class="card"><div class="card-head"><h3>회원 목록</h3>' +
        '<span class="badge">권한: 양육자</span></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>이름</th><th>이메일</th><th>연락처</th><th>아이</th><th>상태</th><th>가입일</th><th></th>' +
        '</tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="muted">회원이 없습니다.</td></tr>') +
        '</tbody></table></div></div>' +
        '<p class="faint mt-2" style="font-size:.82rem">' +
        '1차 오픈은 관리자·일반회원 중심으로 구성하며, 병원·치료기관 담당자 권한 그룹은 ' +
        '2차 확장을 고려한 구조로 설계되어 있습니다.</p>';
    }

    if (tab === 'verify') {
      var crows = db.children.map(function (c) {
        var owner = db.users.filter(function (u) { return u.id === c.ownerId; })[0];
        var sb = c.verifyStatus === 'verified' ? '<span class="badge ok dot">인증 완료</span>'
          : c.verifyStatus === 'pending' ? '<span class="badge warn dot">검토 중</span>'
          : '<span class="badge dot">미인증</span>';
        var act = c.verifyStatus === 'pending'
          ? '<button class="btn btn-soft btn-sm" data-vapprove="' + c.id + '">승인</button> ' +
            '<button class="btn btn-danger btn-sm" data-vreject="' + c.id + '">반려</button>'
          : c.verifyStatus === 'verified'
            ? '<button class="btn btn-ghost btn-sm" data-vreject="' + c.id + '">인증 해제</button>'
            : '<span class="faint" style="font-size:.8rem">요청 대기</span>';
        return '<tr><td><b>' + esc(c.name) + '</b></td>' +
          '<td>' + esc(owner ? owner.name : '-') + '</td>' +
          '<td>' + esc((c.verifyDocs || []).join(', ') || '-') + '</td>' +
          '<td>' + sb + '</td><td class="actions">' + act + '</td></tr>';
      }).join('');
      return '<div class="card"><div class="card-head"><h3>아이 정보 인증</h3>' +
        '<span class="badge warn">대기 ' + Store.stats().pendingChildren + '건</span></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>아이</th><th>양육자</th><th>제출 서류</th><th>상태</th><th>처리</th>' +
        '</tr></thead><tbody>' + (crows || '<tr><td colspan="5" class="muted">대상이 없습니다.</td></tr>') +
        '</tbody></table></div></div>';
    }

    if (tab === 'contents') {
      return '<div class="card"><div class="card-head"><h3>정적 콘텐츠 관리</h3></div>' +
        '<div class="card-body">' + Store.listContents().map(function (c) {
          return '<div class="row between" style="padding:11px 0;border-bottom:1px solid var(--border)">' +
            '<div><b>' + esc(c.title) + '</b> <span class="tag">' + esc(c.key) + '</span>' +
            '<div class="muted" style="font-size:.84rem;margin-top:2px">' +
            esc(c.body.slice(0, 60)) + (c.body.length > 60 ? '…' : '') + '</div></div>' +
            '<button class="btn btn-ghost btn-sm" data-cedit="' + c.id + '">편집</button></div>';
        }).join('') + '</div></div>';
    }

    if (tab === 'popups') {
      var prows = Store.listPopups().map(function (p) {
        return '<div class="card card-pad mb-2">' +
          '<div class="row between wrap"><div><b>' + esc(p.title) + '</b> ' +
          (p.active ? '<span class="badge ok dot">노출 중</span>'
            : '<span class="badge dot">숨김</span>') + '</div>' +
          '<div class="row gap-sm">' +
            '<button class="btn btn-ghost btn-sm" data-ptoggle="' + p.id + '">' +
              (p.active ? '숨기기' : '노출') + '</button>' +
            '<button class="btn btn-ghost btn-sm" data-pedit="' + p.id + '">편집</button>' +
            '<button class="btn btn-danger btn-sm" data-pdelete="' + p.id + '">삭제</button>' +
          '</div></div>' +
          '<p class="muted" style="font-size:.88rem;margin-top:6px">' + esc(p.body) + '</p></div>';
      }).join('');
      return '<div class="page-head-row mb-2"><h3>팝업 · 배너</h3>' +
        '<button class="btn btn-primary btn-sm" id="add-popup">' + icon('plus', 15) + '팝업 추가</button>' +
        '</div>' + (prows || '<div class="card empty"><p>등록된 팝업이 없습니다.</p></div>');
    }

    if (tab === 'noti') {
      var log = Store.listNotifications().map(function (n) {
        return '<tr><td>' + esc(n.title) + '</td><td>' + esc(n.target) + '</td>' +
          '<td><span class="badge">' + esc(n.channel) + '</span></td>' +
          '<td>' + UI.fmtDateTime(n.sentAt) + '</td></tr>';
      }).join('');
      return '<div class="card mb-2"><div class="card-head"><h3>알림 발송</h3></div>' +
        '<div class="card-body"><form id="noti-form">' +
        '<div class="field-row">' +
          '<div class="field"><label>발송 대상</label>' +
            '<select class="select" name="target">' +
            '<option>전체 양육자</option><option>인증 완료 회원</option>' +
            '<option>최근 미접속 회원</option></select></div>' +
          '<div class="field"><label>채널</label>' +
            '<select class="select" name="channel"><option value="push">앱 푸시</option>' +
            '<option value="email">이메일</option></select></div>' +
        '</div>' +
        '<div class="field"><label>제목</label><input class="input" name="title" required></div>' +
        '<div class="field"><label>내용</label><textarea class="textarea" name="body" required></textarea></div>' +
        '<button class="btn btn-primary" type="submit">' + icon('bell', 15) + '발송</button>' +
        '<p class="faint" style="font-size:.78rem;margin-top:8px">' +
          '1차 개발 기준 앱 푸시 알림 중심. 카카오 알림톡·문자 연동은 2차 개발 예정입니다.</p>' +
        '</form></div></div>' +
        '<div class="card"><div class="card-head"><h3>발송 이력</h3></div>' +
        '<div class="table-wrap"><table class="tbl"><thead><tr>' +
        '<th>제목</th><th>대상</th><th>채널</th><th>발송 시각</th></tr></thead><tbody>' +
        (log || '<tr><td colspan="4" class="muted">발송 이력이 없습니다.</td></tr>') +
        '</tbody></table></div></div>';
    }
    return '';
  }

  function adminWire(tab) {
    if (tab === 'members') {
      document.querySelectorAll('[data-mem-toggle]').forEach(function (b) {
        b.onclick = function () {
          var m = Store.getDB().users.filter(function (x) { return x.id === b.dataset.memToggle; })[0];
          Store.updateUser(m.id, { status: m.status === 'active' ? 'withdrawn' : 'active' });
          toast('회원 상태가 변경되었습니다', 'ok'); App.refresh();
        };
      });
    }
    if (tab === 'verify') {
      document.querySelectorAll('[data-vapprove]').forEach(function (b) {
        b.onclick = function () {
          Store.setChildVerify(b.dataset.vapprove, 'verified');
          toast('인증을 승인했습니다', 'ok'); App.refresh();
        };
      });
      document.querySelectorAll('[data-vreject]').forEach(function (b) {
        b.onclick = function () {
          Store.setChildVerify(b.dataset.vreject, 'none');
          toast('인증이 해제/반려되었습니다', 'ok'); App.refresh();
        };
      });
    }
    if (tab === 'contents') {
      document.querySelectorAll('[data-cedit]').forEach(function (b) {
        b.onclick = function () {
          var c = Store.listContents().filter(function (x) { return x.id === b.dataset.cedit; })[0];
          Modal.open({
            title: '콘텐츠 편집: ' + c.title, icon: 'edit', wide: true,
            body: '<div class="field"><label>제목</label>' +
              '<input class="input" id="c-title" value="' + esc(c.title) + '"></div>' +
              '<div class="field"><label>내용</label>' +
              '<textarea class="textarea" id="c-body" style="min-height:160px">' +
              esc(c.body) + '</textarea></div>',
            buttons: [{ label: '취소', value: 'cancel', variant: 'ghost' },
              { label: '저장', value: 'ok', variant: 'primary' }],
            onButton: function (v) {
              if (v !== 'ok') return;
              c.title = UI.el('c-title').value.trim();
              c.body = UI.el('c-body').value.trim();
              Store.saveContent(c); toast('저장되었습니다', 'ok'); App.refresh();
            }
          });
        };
      });
    }
    if (tab === 'popups') {
      var ap = UI.el('add-popup');
      if (ap) ap.onclick = function () { popupModal(null); };
      document.querySelectorAll('[data-pedit]').forEach(function (b) {
        b.onclick = function () {
          var p = Store.listPopups().filter(function (x) { return x.id === b.dataset.pedit; })[0];
          popupModal(p);
        };
      });
      document.querySelectorAll('[data-ptoggle]').forEach(function (b) {
        b.onclick = function () {
          var p = Store.listPopups().filter(function (x) { return x.id === b.dataset.ptoggle; })[0];
          p.active = !p.active; Store.savePopup(p); App.refresh();
        };
      });
      document.querySelectorAll('[data-pdelete]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '팝업 삭제', message: '이 팝업을 삭제할까요?', okLabel: '삭제', danger: true })
            .then(function (ok) {
              if (ok) { Store.deletePopup(b.dataset.pdelete); toast('삭제되었습니다', 'ok'); App.refresh(); }
            });
        };
      });
    }
    if (tab === 'noti') {
      var nf = UI.el('noti-form');
      if (nf) nf.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        if (!f.title || !f.body) { toast('제목과 내용을 입력해 주세요', 'err'); return; }
        Store.sendNotification({ target: f.target, channel: f.channel, title: f.title, body: f.body });
        toast('알림이 발송되었습니다', 'ok'); App.refresh();
      });
    }
  }

  function popupModal(p) {
    var isNew = !p;
    p = p || { title: '', body: '', active: true };
    Modal.open({
      title: isNew ? '팝업 추가' : '팝업 편집', icon: 'bell',
      body: '<div class="field"><label>제목</label>' +
        '<input class="input" id="p-title" value="' + esc(p.title) + '"></div>' +
        '<div class="field"><label>내용</label>' +
        '<textarea class="textarea" id="p-body">' + esc(p.body) + '</textarea></div>' +
        '<label class="checkline"><input type="checkbox" id="p-active"' +
        (p.active ? ' checked' : '') + '><span>지금 노출하기</span></label>',
      buttons: [{ label: '취소', value: 'cancel', variant: 'ghost' },
        { label: '저장', value: 'ok', variant: 'primary' }],
      onButton: function (v) {
        if (v !== 'ok') return;
        p.title = UI.el('p-title').value.trim();
        p.body = UI.el('p-body').value.trim();
        p.active = UI.el('p-active').checked;
        if (!p.title) { toast('제목을 입력해 주세요', 'err'); return 'keep'; }
        Store.savePopup(p); toast('저장되었습니다', 'ok'); App.refresh();
      }
    });
  }

})(window);
