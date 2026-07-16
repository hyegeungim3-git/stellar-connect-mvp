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
  /* 현재 시각 HH:MM (로컬) — 기록 시간 기본값 */
  function nowHM() {
    var d = new Date();
    return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  }

  /* ---------- 주기 복용 약물의 오늘 복약 상태 (리마인더·시간대 버튼의 근거) ----------
     '주기 복용' = 복용 시간이 지정되고 기간이 활성인 약물.
     등록된 복용 시간을 아침/점심/저녁/자기 전 시간대로 매핑하고('취침'→자기 전),
     기록 여부는 오늘 자 medication 기록의 medKey(약명@시간대)로 시간대별 판정한다. */
  var MED_SLOTS = ['아침', '점심', '저녁', '자기 전'];
  function slotOf(part) {
    if (/아침/.test(part)) return '아침';
    if (/점심/.test(part)) return '점심';
    if (/저녁/.test(part)) return '저녁';
    if (/자기 전|취침|밤/.test(part)) return '자기 전';
    return null;   // 표준 시간대에 안 맞는 자유 입력 → 별도 버튼으로 표시
  }
  function medActive(m, day) {
    if (m.startDate && day < m.startDate) return false;
    if (m.endDate && day > m.endDate) return false;
    return true;
  }
  /* 약물별 시간대 그리드 — [{ med, slots:[{label, text, registered, key, done}] }] */
  function medSlotGrid(child) {
    var day = todayStr();
    var meds = (child.medications || []).filter(function (m) {
      return m.name && (m.time || '').trim() && medActive(m, day);
    });
    var recs = Store.recordsOf(child.id).filter(function (r) {
      return r.type === 'medication' && r.date === day;
    });
    function doneOf(key) {
      var d = null;
      recs.forEach(function (r) { if (r.medKey === key) d = r; });
      return d;
    }
    return meds.map(function (m) {
      var parts = (m.time || '').split('·').map(function (s) { return s.trim(); }).filter(Boolean);
      var reg = {}, customs = [];
      parts.forEach(function (p) {
        var s = slotOf(p);
        if (s) reg[s] = p; else customs.push(p);
      });
      var slots = MED_SLOTS.map(function (s) {
        var key = m.name + '@' + s;
        return { label: s, text: reg[s] || null, registered: !!reg[s], key: key, done: doneOf(key) };
      });
      customs.forEach(function (c) {
        slots.push({ label: c, text: c, registered: true, custom: true,
          key: m.name + '@' + c, done: doneOf(m.name + '@' + c) });
      });
      return { med: m, slots: slots };
    });
  }
  /* 등록된 시간대만 평탄화 — 홈 배너·카운트용 [{ med, slot, key, done }] */
  function medStatusToday(child) {
    var out = [];
    medSlotGrid(child).forEach(function (g) {
      g.slots.forEach(function (s) {
        if (s.registered) out.push({ med: g.med, slot: s.label, key: s.key, done: s.done });
      });
    });
    return out;
  }
  V._medStatusToday = medStatusToday;
  /* 시간대 탭 = 복약 기록 즉시 생성 (시간·복약 정보·medKey 포함) */
  function quickMedRecord(child, m, slot) {
    var dose = V._medDose ? V._medDose(m) : (m.dose || '');
    var rec = {
      id: Store.uid('rec'), childId: child.id, type: 'medication',
      date: todayStr(), time: nowHM(),
      title: m.name + ' 복용 (' + slot.label + ')', medKey: slot.key,
      content: '[복약 정보]\n· ' + (m.kind ? '[' + m.kind + '] ' : '') + m.name +
        (dose ? ' ' + dose : '') + (slot.text ? ' · ' + slot.text : '') +
        (m.dosing ? ' · ' + m.dosing : ''),
      tags: ['복약'], mood: 3, photo: null, createdAt: Store.nowISO()
    };
    Store.saveRecord(rec);
    return rec;
  }

  /* ---------- 오늘의 복약 패널 — 복용 관리 화면에서 사용 ----------
     등록·수정과 매일의 복용 체크를 한 메뉴에 모음(2026-07-10 사용자 요청, 기록 화면에서 이동).
     아코디언(약이 많아도 컴팩트) + 시간대 버튼 기록·취소 + 일괄 완료. 체크하면 기록 타임라인에도 남는다. */
  function medTodayPanel(child) {
    var medGrid = medSlotGrid(child);
    var flat = medStatusToday(child);
    var doneN = flat.filter(function (x) { return x.done; }).length;
    var pendingN = flat.length - doneN;
    /* 접힘 상태: 수동 토글(S.medAcc) 우선, 없으면 자동(미기록 있으면 펼침) */
    var accOpen = (S.medAcc === undefined || S.medAcc === null) ? pendingN > 0 : S.medAcc;
    if (!medGrid.length) return '';
    return '<div class="card mb-2" id="med-today"><div class="card-head med-acc-head" id="med-acc-head" ' +
        'role="button" aria-expanded="' + accOpen + '" title="탭하면 펼치거나 접어요">' +
        '<span style="color:var(--brand-grow)">' + icon('pill', 18) + '</span><h3>오늘의 복약</h3>' +
        '<span class="badge ' + (pendingN === 0 ? 'ok' : 'warn') + '">' +
          doneN + '/' + flat.length + ' 기록됨</span>' +
        (pendingN > 0
          ? '<button class="btn btn-primary btn-sm" id="med-all" style="margin-left:auto">' +
              icon('check', 14) + '모두 완료</button>'
          : '<span style="margin-left:auto"></span>') +
        '<span class="acc-chev' + (accOpen ? ' open' : '') + '">' + icon('chevD', 17) + '</span></div>' +
      '<div class="card-body" id="med-acc-body" style="padding-top:8px;padding-bottom:12px"' +
        (accOpen ? '' : ' hidden') + '>' +
        medGrid.map(function (g, gi) {
          var m = g.med;
          return '<div class="med-log-row">' +
            (V._medKindBadge ? V._medKindBadge(m.kind) : '') +
            '<div class="txt"><b>' + esc(m.name) + '</b> ' +
              esc(V._medDose ? V._medDose(m) : (m.dose || '')) + '</div>' +
            '<div class="slot-btns">' +
              g.slots.map(function (s, si) {
                if (!s.registered) {
                  return '<button class="slot-chip off" disabled title="등록된 복용 시간이 아니에요">' +
                    esc(s.label) + '</button>';
                }
                if (s.done) {
                  return '<button class="slot-chip done" data-mslotcancel="' + gi + ':' + si +
                    '" title="탭하면 기록을 취소해요">✓ ' + esc(s.label) +
                    (s.done.time ? ' <span class="sc-time">' + esc(s.done.time) + '</span>' : '') + '</button>';
                }
                return '<button class="slot-chip todo" data-mslotlog="' + gi + ':' + si +
                  '" title="' + esc(s.text || s.label) + ' 복용 기록">' + esc(s.label) + '</button>';
              }).join('') +
            '</div>' +
            '</div>';
        }).join('') +
        '<p class="faint" style="font-size:.78rem;margin-top:8px">등록한 복용 시간의 버튼만 켜져요. ' +
          '탭하면 기록되고, 다시 탭하면 취소할 수 있어요. 체크한 내용은 기록 타임라인에 복약 기록으로 함께 남아요. ' +
          '실서비스에서는 복용 시간에 맞춰 앱 푸시 알림이 발송됩니다.</p>' +
      '</div></div>';
  }
  function wireMedToday(child) {
    var medG = medSlotGrid(child);
    var accHead = UI.el('med-acc-head');
    if (accHead) accHead.onclick = function (e) {
      if (e.target.closest('#med-all')) return;   // 일괄 버튼은 토글 제외
      var body = UI.el('med-acc-body');
      var chev = accHead.querySelector('.acc-chev');
      var open = body.hidden;                      // 토글 후 상태
      body.hidden = !open;
      chev.classList.toggle('open', open);
      accHead.setAttribute('aria-expanded', open);
      S.medAcc = open;                             // 수동 토글은 자동 규칙보다 우선
    };
    var allBtn = UI.el('med-all');
    if (allBtn) allBtn.onclick = function (e) {
      e.stopPropagation();
      var n = 0;
      medG.forEach(function (g) {
        g.slots.forEach(function (s) {
          if (s.registered && !s.done) { quickMedRecord(child, g.med, s); n++; }
        });
      });
      if (n) {
        S.medAcc = undefined;                    // 모두 완료 → 자동 규칙으로 접힘
        toast('복약 ' + n + '건을 모두 기록했어요', 'ok');
        App.refresh();
      }
    };
    function slotAt(ref) {
      var p = ref.split(':');
      var g = medG[parseInt(p[0], 10)];
      return g ? { med: g.med, slot: g.slots[parseInt(p[1], 10)] } : null;
    }
    document.querySelectorAll('[data-mslotlog]').forEach(function (b) {
      b.onclick = function () {
        var x = slotAt(b.dataset.mslotlog);
        if (!x || !x.slot || x.slot.done) return;
        quickMedRecord(child, x.med, x.slot);
        toast(x.med.name + ' ' + x.slot.label + ' 복용을 기록했어요', 'ok');
        App.refresh();
      };
    });
    document.querySelectorAll('[data-mslotcancel]').forEach(function (b) {
      b.onclick = function () {
        var x = slotAt(b.dataset.mslotcancel);
        if (!x || !x.slot || !x.slot.done) return;
        Modal.confirm({
          title: '복약 기록 취소',
          message: x.med.name + ' (' + x.slot.label + ') 복용 기록을 지울까요?',
          okLabel: '기록 취소', danger: true
        }).then(function (ok) {
          if (!ok) return;
          Store.deleteRecord(x.slot.done.id);
          toast('복약 기록을 취소했어요', 'ok');
          App.refresh();
        });
      };
    });
  }
  V._medTodayPanel = medTodayPanel;
  V._wireMedToday = wireMedToday;

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
    medication: [
      '아침 약 복용', '저녁 약 복용', '취침 전 약 복용', '약 복용 후 컨디션'
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
    rec = rec || { childId: childId, type: (opts.type || 'behavior'), date: todayStr(), time: nowHM(),
                   title: '', content: '', tags: [], mood: 3, photo: null };
    if (isNew) { rec.id = Store.uid('rec'); rec.createdAt = Store.nowISO(); }
    var photoData = rec.photo || null;
    var mood = rec.mood || 3;

    // 영상 클립 상태 (OS 피커로 첨부한 영상 blob 관리)
    var CL = { blob: null, url: null, duration: 0, isNew: false, removed: false };

    var typeButtons = Object.keys(RT).map(function (k) {
      var meta = RT[k];
      return '<button type="button" class="type-btn' + (rec.type === k ? ' on' : '') + '" data-rectype="' + k + '">' +
        '<span class="type-ico" style="color:' + meta.color + '">' + icon(meta.icon, 16) + '</span>' +
        esc(meta.label.replace(/ 기록$/, '')) + '</button>';
    }).join('');

    Modal.open({
      title: isNew ? '기록하기' : '기록 수정', icon: 'note', wide: true,
      body:
        '<div class="field"><label>기록 유형</label>' +
          '<input type="hidden" name="type" value="' + esc(rec.type) + '">' +
          '<div class="type-pick" id="rec-type-pick">' + typeButtons + '</div>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label>날짜</label>' +
            '<input class="input" name="date" type="date" value="' + esc(rec.date) + '"></div>' +
          '<div class="field"><label>시간 <span class="faint">복약·컨디션 연결</span></label>' +
            '<input class="input" name="time" type="time" value="' + esc(rec.time || '') + '"></div>' +
        '</div>' +
        '<div class="field"><label>' + icon('camera', 14) +
          ' 미디어 <span class="faint">사진·영상을 카메라나 앨범에서 담을 수 있어요</span></label>' +
          '<div class="media-row">' +
            '<div class="media-tile" id="rec-photo"></div>' +
            '<div class="media-tile" id="clip-tile"></div>' +
          '</div>' +
          '<input type="file" id="rec-photo-input" accept="image/*" hidden>' +
          '<input type="file" id="cl-file" accept="video/*" hidden></div>' +
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
              icon('pill', 15) + '등록한 약물 불러오기</button>' +
            '<span class="faint" style="font-size:.78rem">불러올 약물을 골라 기록 내용에 넣어요</span>' +
          '</div>' +
          '<div id="rec-med-picker" class="med-picker" hidden></div></div>' +
        '<div class="field"><label>태그 <span class="faint">(쉼표로 구분)</span></label>' +
          '<input class="input" name="tags" value="' + esc((rec.tags || []).join(', ')) +
          '" placeholder="예) 사회성, 의사소통"></div>' +
        '<div class="field"><label>컨디션</label>' +
          '<div id="mood-pick" style="display:flex;gap:6px">' +
            [1, 2, 3, 4, 5].map(function (i) {
              return '<button type="button" class="btn btn-ghost" data-mood="' + i + '" ' +
                'style="font-size:1.3rem;padding:6px 12px">' +
                ['😣', '😕', '😐', '🙂', '😊'][i - 1] + '</button>';
            }).join('') +
          '</div></div>',
      onMount: function (root) {
        /* --- 음성 입력 (STT) — 제목·내용 --- */
        var titleEl = root.querySelector('[name="title"]');
        var contentEl = root.querySelector('[name="content"]');
        var vTitle = root.querySelector('[data-voice-id="rec-title"]');
        var vContent = root.querySelector('[data-voice-id="rec-content"]');
        if (vTitle && titleEl) UI.attachVoiceInput(vTitle, titleEl);
        if (vContent && contentEl) UI.attachVoiceInput(vContent, contentEl);

        /* --- 프로필 약물 불러오기 — 리스트에서 골라 기록 내용에 삽입 --- */
        var pullBtn = root.querySelector('#rec-pull-meds');
        var picker = root.querySelector('#rec-med-picker');
        function medLine(m) {
          var p = V._medPeriod ? V._medPeriod(m) : (m.period || '');
          var dose = V._medDose ? V._medDose(m) : (m.dose || '');
          return '· ' + (m.kind ? '[' + m.kind + '] ' : '') + m.name + (dose ? ' ' + dose : '') +
            (m.time ? ' · ' + m.time : '') + (p ? ' · ' + p : '') +
            (m.dosing ? ' · ' + m.dosing : '') +
            (m.note ? ' (' + m.note + ')' : '');
        }
        if (pullBtn) pullBtn.onclick = function () {
          var ch = Store.getChild(childId);
          var meds = (ch && ch.medications) || [];
          if (!meds.length) { toast('복용 관리에 등록된 약물이 없어요', 'err'); return; }
          if (!picker.hidden) { picker.hidden = true; return; }   // 토글로 닫기
          picker.innerHTML =
            '<div class="mp-list">' + meds.map(function (m, i) {
              return '<label class="checkline"><input type="checkbox" class="mp-cb" data-i="' + i +
                '" checked><span>' + (V._medKindBadge ? V._medKindBadge(m.kind) : '') +
                '<b>' + esc(m.name) + '</b> ' + esc(V._medDose ? V._medDose(m) : (m.dose || '')) +
                (m.time ? ' · ' + esc(m.time) : '') + '</span></label>';
            }).join('') + '</div>' +
            '<div class="row gap-sm" style="margin-top:8px">' +
              '<button type="button" class="btn btn-primary btn-sm" id="mp-insert">' +
                icon('check', 14) + '선택한 약물 넣기</button>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="mp-cancel">닫기</button>' +
            '</div>';
          picker.hidden = false;
          picker.querySelector('#mp-cancel').onclick = function () { picker.hidden = true; };
          picker.querySelector('#mp-insert').onclick = function () {
            var chosen = [].filter.call(picker.querySelectorAll('.mp-cb'), function (cb) { return cb.checked; })
              .map(function (cb) { return meds[parseInt(cb.dataset.i, 10)]; });
            if (!chosen.length) { toast('넣을 약물을 골라 주세요', 'err'); return; }
            var block = '[복약 정보]\n' + chosen.map(medLine).join('\n');
            var cur = (contentEl.value || '').trim();
            contentEl.value = cur ? (cur + '\n\n' + block) : block;
            picker.hidden = true;
            contentEl.focus();
            toast(chosen.length + '개 약물을 불러왔어요', 'ok');
          };
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
        // 기록 유형 — 버튼 선택(hidden input 값 갱신 + 제목 추천 재계산)
        root.querySelectorAll('[data-rectype]').forEach(function (b) {
          b.onclick = function () {
            typeSel.value = b.dataset.rectype;
            root.querySelectorAll('[data-rectype]').forEach(function (x) { x.classList.toggle('on', x === b); });
            paintTitleQuick();
          };
        });

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

        /* --- 사진 (미디어 타일) --- */
        var photoTile = root.querySelector('#rec-photo');
        var photoInput = root.querySelector('#rec-photo-input');
        function paintPhotoTile() {
          if (photoData) {
            photoTile.classList.remove('empty-tile');
            photoTile.innerHTML = '<img src="' + photoData + '" alt="">' +
              '<button type="button" class="media-tile-remove" id="rec-photo-remove" ' +
              'aria-label="사진 지우기">' + icon('x', 13) + '</button>';
            photoTile.querySelector('#rec-photo-remove').onclick = function (e) {
              e.stopPropagation(); photoData = null; paintPhotoTile();
            };
          } else {
            photoTile.classList.add('empty-tile');
            photoTile.innerHTML = icon('image', 20) + '<span>사진</span>';
          }
          photoTile.onclick = function (e) {
            if (e.target.closest('#rec-photo-remove')) return;
            photoInput.click();
          };
        }
        photoInput.addEventListener('change', function (e) {
          var file = e.target.files[0]; if (!file) return;
          UI.fileToDataURL(file, 800, function (url) {
            if (!url) { toast('이미지를 불러오지 못했어요', 'err'); return; }
            photoData = url;
            paintPhotoTile();
          });
        });
        paintPhotoTile();

        /* --- 영상 (미디어 타일) — 사진과 동일하게 OS 기본 촬영/앨범 피커로 첨부 --- */
        var clipTile = root.querySelector('#clip-tile');
        var clipFileInput = root.querySelector('#cl-file');
        function paintClipTile() {
          if (CL.url) {
            clipTile.classList.remove('empty-tile');
            clipTile.innerHTML =
              '<video src="' + CL.url + '" muted playsinline preload="metadata"></video>' +
              '<span class="media-tile-badge">' + icon('video', 11) +
                (CL.duration ? ' ' + fmtClip(CL.duration) : '') + '</span>' +
              '<button type="button" class="media-tile-remove" id="clip-remove" ' +
              'aria-label="영상 지우기">' + icon('x', 13) + '</button>';
            clipTile.querySelector('#clip-remove').onclick = function (e) {
              e.stopPropagation();
              if (CL.url) { try { URL.revokeObjectURL(CL.url); } catch (er) {} CL.url = null; }
              CL.blob = null; CL.isNew = false; CL.removed = true;
              paintClipTile();
            };
            clipTile.onclick = function (e) {
              if (e.target.closest('#clip-remove')) return;
              clipFileInput.click();
            };
          } else {
            clipTile.classList.add('empty-tile');
            clipTile.innerHTML = icon('video', 20) + '<span>영상</span>';
            clipTile.onclick = function () { clipFileInput.click(); };
          }
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
            paintClipTile();
          };
          tmp.src = CL.url;
          paintClipTile();
        }
        clipFileInput.addEventListener('change', function (e) {
          if (e.target.files[0]) onClipFile(e.target.files[0]);
        });
        function cleanupClip() {
          if (CL.url) { try { URL.revokeObjectURL(CL.url); } catch (e) {} }
        }

        // 기존 클립 불러오기 (수정 시)
        if (!isNew && rec.hasClip && rec.clipKey && VideoDB.available()) {
          clipTile.classList.add('empty-tile');
          clipTile.innerHTML = '<span class="faint" style="font-size:.62rem">불러오는 중…</span>';
          VideoDB.get(rec.clipKey).then(function (blob) {
            if (blob) {
              CL.blob = blob; CL.isNew = false; CL.duration = rec.clipDuration || 0;
              CL.url = URL.createObjectURL(blob);
            }
            paintClipTile();
          }).catch(function () { paintClipTile(); });
        } else {
          paintClipTile();
          if (opts.autoClip) clipFileInput.click();
        }

        // 모달이 닫힐 때 미리보기 URL 정리
        var host = UI.el('modal-host');
        var xb = host.querySelector('[data-mclose]');
        var bd = host.querySelector('[data-mbackdrop]');
        if (xb) { var ox = xb.onclick; xb.onclick = function () { cleanupClip(); if (ox) ox(); }; }
        if (bd) {
          var ob = bd.onclick;
          bd.onclick = function (e) { if (e.target === e.currentTarget) cleanupClip(); if (ob) ob(e); };
        }
        CL._cleanup = cleanupClip;
      },
      buttons: [
        { label: '취소', value: 'cancelx', variant: 'ghost' },
        { label: isNew ? '기록하기' : '저장', value: 'ok', variant: 'primary' }
      ],
      onButton: function (v, root) {
        if (v === 'cancelx') { if (CL._cleanup) CL._cleanup(); return; }
        if (v !== 'ok') return;
        var f = readForm(root);
        if (!f.title) { toast('제목을 입력해 주세요', 'err'); return 'keep'; }
        rec.type = f.type; rec.date = f.date || todayStr(); rec.time = f.time || '';
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
              toast('영상 저장은 실패했지만 기록은 잘 남겨 뒀어요', 'err');
            });
          }
        } else {
          Store.saveRecord(rec);
        }
        if (CL._cleanup) CL._cleanup();
        toast(isNew ? '기록을 남겼어요' : '수정했어요', 'ok');
        App.refresh();
      }
    });
  }

  /* ---------- 기록 카드/검색 공용 헬퍼 (기록 메뉴·홈 공용) ---------- */
  function recMatch(r, q) {
    var hay = ((r.title || '') + ' ' + (r.content || '') + ' ' +
      ((r.tags || []).join(' '))).toLowerCase();
    return hay.indexOf(q) >= 0;
  }
  /* 기록 카드 1개 — 타임라인/게시판/홈 피드 공용 */
  function recCardHTML(r) {
    var meta = RT[r.type] || RT.behavior;
    return '<div class="tl-item t-' + r.type + '">' +
      '<div class="card rec-card" data-rec="' + r.id + '">' +
        '<div class="rec-main">' +
          '<div class="rec-top">' +
            '<span class="badge" style="background:' + meta.color + '22;color:' + meta.color + '">' +
              esc(meta.label) + '</span>' +
            (r.hasClip ? '<span class="badge brand">' + icon('video', 11) + ' 영상</span>' : '') +
            UI.moodStars(r.mood) +
            '<span class="rec-date">' + UI.fmtDate(r.date) +
              (r.time ? ' ' + esc(r.time) : '') + '</span>' +
          '</div>' +
          '<div class="rec-title">' + esc(r.title) + '</div>' +
          (r.content ? '<div class="rec-content">' + esc(r.content) + '</div>' : '') +
          (r.hasClip ? '<div class="rec-clip-inline">' +
            '<video class="clip-thumb" data-clipthumb="' + r.id + '" muted playsinline ' +
            'preload="metadata"></video>' +
            '<span class="clip-play">' + icon('video', 20) + '</span></div>' : '') +
          (r.photo ? '<img src="' + r.photo + '" style="margin-top:8px;max-height:150px;' +
            'border-radius:8px">' : '') +
          (r.tags && r.tags.length ? '<div style="margin-top:7px">' + r.tags.map(function (t) {
            return '<span class="tag">#' + esc(t) + '</span>';
          }).join('') + '</div>' : '') +
        '</div>' +
      '</div></div>';
  }
  V._recCardHTML = recCardHTML;
  /* 클립 썸네일 지연 로드 + 카드 클릭(상세) 배선 — 지정 스코프 안에서만 */
  function wireRecCards(scope) {
    scope = scope || document;
    scope.querySelectorAll('[data-clipthumb]').forEach(function (v) {
      if (!VideoDB.available()) return;
      VideoDB.get(v.dataset.clipthumb).then(function (blob) {
        if (!blob) return;
        v.src = URL.createObjectURL(blob);
        v.onloadedmetadata = function () {
          try { v.currentTime = Math.min(0.15, (v.duration || 0.3) / 2); } catch (e) {}
        };
      }).catch(function () {});
    });
    scope.querySelectorAll('[data-rec]').forEach(function (c) {
      c.onclick = function () {
        var r = Store.getRecord(c.dataset.rec);
        if (r) openRecordDetail(r);
      };
    });
  }
  V._wireRecCards = wireRecCards;
  /* 기록 상세 모달 */
  function openRecordDetail(r) {
    var meta = RT[r.type] || RT.behavior;
    Modal.open({
      title: '기록 상세', icon: meta.icon, wide: true,
      body: '<div class="row mb-2"><span class="badge" style="background:' + meta.color +
        '22;color:' + meta.color + '">' + esc(meta.label) + '</span>' +
        UI.moodStars(r.mood) +
        '<span class="rec-date" style="margin-left:auto">' + UI.fmtDate(r.date) +
          (r.time ? ' ' + esc(r.time) : '') + '</span></div>' +
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
        if (v === 'edit') { recordModal(r.childId, r); return 'keep'; }
        if (v === 'del') {
          Modal.confirm({ title: '기록 삭제', message: '이 기록을 삭제할까요?',
            okLabel: '삭제', danger: true }).then(function (ok) {
            if (!ok) return;
            if (r.hasClip && r.clipKey && VideoDB.available()) {
              VideoDB.del(r.clipKey).catch(function () {});
            }
            Store.deleteRecord(r.id);
            toast('삭제했어요', 'ok'); App.refresh();
          });
          return 'keep';
        }
      }
    });
  }
  V._openRecordDetail = openRecordDetail;
  V._recordModal = recordModal;
  /* 활성 필터(검색·유형·기간·컨디션)가 하나라도 있는지 — 초기화 버튼·카운트 표기용 */
  function recAnyFilter() {
    return !!(S.recSearch && S.recSearch.trim()) || S.recFilter !== 'all' ||
      S.recPeriod !== 'all' || S.recMood !== 'all';
  }
  V._recAnyFilter = recAnyFilter;
  function recYmdOffset(days) {
    var d = new Date(); d.setDate(d.getDate() - days);
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function recInPeriod(ds) {
    var p = S.recPeriod;
    if (!p || p === 'all') return true;
    if (p === 'custom') {
      if (S.recFrom && ds < S.recFrom) return false;
      if (S.recTo && ds > S.recTo) return false;
      return true;
    }
    if (p === 'today') return ds === recYmdOffset(0);
    var days = { '7d': 7, '30d': 30, '3m': 90 }[p];
    return days == null ? true : ds >= recYmdOffset(days);
  }
  function recInMood(m) {
    m = m || 3;
    var v = S.recMood;
    if (!v || v === 'all') return true;
    if (v === 'good') return m >= 4;
    if (v === 'ok') return m === 3;
    if (v === 'low') return m <= 2;
    return true;
  }
  /* 검색 결과 영역(카운트 + 타임라인/빈 상태) — 부분 갱신을 위해 분리 */
  function recResultsHTML(all, list) {
    if (!all.length) {
      return '<div class="card empty"><div class="emoji">🗒️</div>' +
        '<h3>아직 기록이 없어요</h3>' +
        '<p>행동·치료·변화의 순간을 짧은 영상이나 글로 남겨 보세요.</p>' +
        '<button class="btn btn-primary" id="empty-add">첫 기록 남기기</button></div>';
    }
    var countLine = '<div class="rec-count faint">' +
      (recAnyFilter() ? list.length + '건 / 전체 ' + all.length + '건'
                      : '전체 ' + all.length + '건') + '</div>';
    if (!list.length) {
      return countLine + '<div class="card empty"><div class="emoji">🔍</div>' +
        '<h3>조건에 맞는 기록이 없어요</h3>' +
        '<p>검색어·필터·기간을 바꾸거나 초기화해 보세요.</p></div>';
    }
    return countLine + '<div class="timeline">' + list.map(recCardHTML).join('') + '</div>';
  }
  /* 현재 S 상태로 기록 목록 필터링 + 정렬 */
  function recFiltered(child) {
    var all = Store.recordsOf(child.id);
    var q = (S.recSearch || '').trim().toLowerCase();
    var list = all.filter(function (r) {
      if (S.recFilter !== 'all' && r.type !== S.recFilter) return false;
      if (q && !recMatch(r, q)) return false;
      if (!recInPeriod(r.date)) return false;
      if (!recInMood(r.mood)) return false;
      return true;
    });
    list.sort(function (a, b) {
      var c = a.date < b.date ? -1 : (a.date > b.date ? 1
        : ((a.createdAt || '') < (b.createdAt || '') ? -1 : 1));
      return S.recSort === 'old' ? c : -c;
    });
    return { all: all, list: list, q: q };
  }

  V.records = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var f = recFiltered(child);

      var seg = '<div class="seg no-print">' +
        [['all', '전체'], ['behavior', '행동'], ['treatment', '치료'],
         ['medication', '복용'], ['change', '변화'], ['assessment', '검사']]
          .map(function (o) {
            return '<button class="' + (S.recFilter === o[0] ? 'on' : '') +
              '" data-f="' + o[0] + '">' + o[1] + '</button>';
          }).join('') + '</div>';

      /* 검색 + 필터 툴바 (게시판 형태) — 기록이 있을 때만 노출 */
      function opts(cur, arr) {
        return arr.map(function (o) {
          return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('');
      }
      var toolbar = f.all.length
        ? '<div class="rec-toolbar no-print">' +
            '<div class="rec-search">' + icon('search', 16) +
              '<input class="rec-search-input" id="rec-search" type="search" ' +
                'placeholder="제목·내용·태그 검색" value="' + esc(S.recSearch || '') + '">' +
              '<button class="btn-icon rec-search-clear" id="rec-search-clear" ' +
                'aria-label="검색 지우기"' + (S.recSearch ? '' : ' hidden') + '>' +
                icon('x', 15) + '</button>' +
            '</div>' +
            '<div class="rec-filterbar">' + seg +
              '<select class="select sm" id="rec-period" aria-label="기간">' +
                opts(S.recPeriod, [['all', '전체 기간'], ['today', '오늘'], ['7d', '최근 7일'],
                  ['30d', '최근 30일'], ['3m', '최근 3개월'], ['custom', '직접 지정']]) + '</select>' +
              '<select class="select sm" id="rec-mood" aria-label="컨디션">' +
                opts(S.recMood, [['all', '컨디션 전체'], ['good', '😊 좋음'], ['ok', '😐 보통'],
                  ['low', '😣 힘듦']]) + '</select>' +
              '<select class="select sm" id="rec-sort" aria-label="정렬">' +
                opts(S.recSort, [['new', '최신순'], ['old', '오래된순']]) + '</select>' +
              (recAnyFilter()
                ? '<button class="btn btn-ghost btn-sm" id="rec-reset">' + icon('x', 14) + '초기화</button>'
                : '') +
            '</div>' +
            (S.recPeriod === 'custom'
              ? '<div class="rec-daterange">' +
                  '<input type="date" class="input" id="rec-from" value="' + esc(S.recFrom || '') + '">' +
                  '<span class="faint">~</span>' +
                  '<input type="date" class="input" id="rec-to" value="' + esc(S.recTo || '') + '">' +
                '</div>'
              : '') +
          '</div>'
        : '';

      /* 오늘의 복약 패널은 복용 관리 메뉴로 이동됨 (2026-07-10 사용자 요청)
         — 기록에서 복약을 찾던 동선을 위해 미기록이 있으면 복용 관리로 잇는 한 줄 안내를 남긴다 */
      var medPend = medStatusToday(child).filter(function (x) { return !x.done; }).length;
      var medBridge = medPend
        ? '<div class="card card-pad mb-2" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
            '<span style="color:var(--brand-grow);flex:none">' + icon('pill', 16) + '</span>' +
            '<span class="muted" style="font-size:.88rem;flex:1;min-width:160px">오늘의 복약 ' +
              medPend + '건이 아직 체크 전이에요.</span>' +
            '<a class="btn btn-soft btn-sm" href="#/meds/' + child.id + '">' +
              icon('check', 14) + '복용 관리에서 체크</a></div>'
        : '';
      return childContextBar(child, 'records') +
        pageHead('기록', child.name + ' 기록',
          '행동·치료·변화의 순간을 짧은 영상(릴스)이나 글로 남깁니다.',
          '<button class="btn btn-ghost btn-sm" id="btn-reels">' + icon('video', 15) + '영상으로 기록</button>' +
          '<button class="btn btn-primary btn-sm" id="btn-add-rec">' + icon('plus', 15) + '기록하기</button>') +
        medBridge + toolbar +
        '<div id="rec-results">' + recResultsHTML(f.all, f.list) + '</div>';
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
      // 검색 — 입력 포커스 유지 위해 결과 영역(#rec-results)만 부분 갱신
      var searchIn = UI.el('rec-search');
      var resultsBox = UI.el('rec-results');
      var clrBtn = UI.el('rec-search-clear');
      function refreshResults() {
        if (!resultsBox) return;
        var f = recFiltered(child);
        resultsBox.innerHTML = recResultsHTML(f.all, f.list);
        wireRecCards(resultsBox);
      }
      if (searchIn) {
        searchIn.oninput = function () {
          S.recSearch = searchIn.value;
          if (clrBtn) clrBtn.hidden = !searchIn.value;
          refreshResults();
        };
      }
      if (clrBtn) clrBtn.onclick = function () {
        S.recSearch = '';
        if (searchIn) { searchIn.value = ''; searchIn.focus(); }
        clrBtn.hidden = true;
        refreshResults();
      };
      // 기간·컨디션·정렬 드롭다운 (전체 재렌더 — 값은 S에서 복원)
      var perEl = UI.el('rec-period');
      if (perEl) perEl.onchange = function () { S.recPeriod = perEl.value; App.refresh(); };
      var moodEl = UI.el('rec-mood');
      if (moodEl) moodEl.onchange = function () { S.recMood = moodEl.value; App.refresh(); };
      var sortEl = UI.el('rec-sort');
      if (sortEl) sortEl.onchange = function () { S.recSort = sortEl.value; App.refresh(); };
      // 직접 지정 기간
      var fromEl = UI.el('rec-from');
      if (fromEl) fromEl.onchange = function () { S.recFrom = fromEl.value; App.refresh(); };
      var toEl = UI.el('rec-to');
      if (toEl) toEl.onchange = function () { S.recTo = toEl.value; App.refresh(); };
      // 필터 초기화
      var resetBtn = UI.el('rec-reset');
      if (resetBtn) resetBtn.onclick = function () {
        S.recSearch = ''; S.recFilter = 'all'; S.recPeriod = 'all';
        S.recFrom = ''; S.recTo = ''; S.recMood = 'all'; S.recSort = 'new';
        App.refresh();
      };
      wireRecCards(document);
    }
  };

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
  /* 공유 기간 — 기간이 지나면 자동으로 닫혀요(민감정보 최소 노출) */
  var CYCLE_LABEL = { day: '1일', week: '1주일', month: '1개월', year: '1년' };
  /* 정보 공개 레벨 (6/10 회의: 정보별 공개 범위 옵션) */
  var SCOPE_META = {
    emergency: { t: '응급 카드',  cls: 'danger',
      d: '한 줄 소개 + 비상연락·알레르기·응급 대응 + 의사소통 방법만 — 민감 정보 최소화' },
    summary:   { t: '요약 정보',  cls: '',
      d: '설명서 전체 + 응급 정보 — 학교·치료실 등 일상 돌봄에 적합' },
    full:      { t: '전체 정보',  cls: 'info',
      d: '요약 정보 + 복약 정보 포함 — 병원·의료진에게 적합' }
  };

  /* 대상별 공유 편집기 — 이름·아이콘·색·소개 문구와, 무엇을 어떤 순서로 보여줄지 직접 고른다.
     audId가 없으면 새 대상 만들기, 있으면 그 대상(기본 4종 포함) 수정 — 기본값도 자유롭게 고쳐 쓸 수 있다. */
  function openAudienceEditor(child, audId) {
    var ownerId = child.ownerId;
    var AUD = V._audienceMap(ownerId);
    var editing = audId ? AUD[audId] : null;
    var isBuiltin = !!(editing && editing.builtin);
    var selected = editing ? editing.blocks.slice() : [];
    // 아이콘·색상은 사용자가 고르지 않고 자동 배정 — 이미 쓰인 것 제외 우선, 없으면 순환
    var used = Object.keys(AUD).map(function (k) { return AUD[k]; });
    var n = used.length;
    var iconVal = editing ? editing.icon
      : (V._AUD_ICONS.filter(function (i) { return used.every(function (a) { return a.icon !== i; }); })[0]
         || V._AUD_ICONS[n % V._AUD_ICONS.length]);
    var colorVal = editing ? editing.color
      : (V._AUD_COLORS.filter(function (c) { return used.every(function (a) { return a.color !== c; }); })[0]
         || V._AUD_COLORS[n % V._AUD_COLORS.length]);

    function blockLabel(k) {
      var f = V._BLOCK_CATALOG.filter(function (b) { return b.key === k; })[0];
      return f ? f.label : k;
    }
    function selectedHTML() {
      if (!selected.length) {
        return '<p class="faint" style="font-size:.85rem;padding:6px 2px">' +
          '아직 고른 항목이 없어요. 아래 목록에서 눌러 추가해 주세요.</p>';
      }
      return selected.map(function (k, i) {
        return '<div class="aud-blockrow">' +
          '<span style="flex:1">' + esc(blockLabel(k)) + '</span>' +
          '<button type="button" class="btn-icon" data-bup="' + i + '" aria-label="위로 이동"' +
            (i === 0 ? ' disabled' : '') + '><span style="display:inline-flex;transform:rotate(180deg)">' +
            icon('chevD', 14) + '</span></button>' +
          '<button type="button" class="btn-icon" data-bdown="' + i + '" aria-label="아래로 이동"' +
            (i === selected.length - 1 ? ' disabled' : '') + '>' + icon('chevD', 14) + '</button>' +
          '<button type="button" class="btn-icon" data-bremove="' + i + '" aria-label="빼기">' +
            icon('x', 14) + '</button></div>';
      }).join('');
    }
    function availableHTML() {
      var avail = V._BLOCK_CATALOG.filter(function (b) { return selected.indexOf(b.key) < 0; });
      if (!avail.length) return '<p class="faint" style="font-size:.83rem">모든 항목을 다 골랐어요.</p>';
      return avail.map(function (b) {
        return '<button type="button" class="chip sm" data-badd="' + b.key + '">' +
          icon('plus', 12) + esc(b.label) + '</button>';
      }).join('');
    }

    Modal.open({
      title: editing ? (editing.label + ' 편집') : '새 대상 만들기', icon: 'share', wide: true,
      body:
        '<p class="muted mb-2" style="font-size:.88rem">받는 분에게 딱 맞는 설명서를 만들어요. ' +
          '이름과 보여줄 내용을 정해 주세요.</p>' +
        '<div class="field"><label>대상 이름</label>' +
          '<input class="input" name="label" value="' + esc(editing ? editing.label : '') +
          '" placeholder="예) 언어치료실용"></div>' +
        '<div class="field"><label>소개 문구 <span class="faint">받는 분에게 보이는 안내 문구(선택)</span></label>' +
          '<textarea class="textarea" name="intro" placeholder="예) 언어치료 선생님이 처음 만났을 때 알아두면 좋은 내용입니다.">' +
          esc(editing ? editing.intro : '') + '</textarea></div>' +
        '<div class="field"><label>포함할 내용 <span class="faint">누른 순서대로 보여드려요</span></label>' +
          '<div id="aud-selected"></div></div>' +
        '<div class="field"><label>추가하기</label><div id="aud-available" class="row wrap gap-sm"></div></div>' +
        '<p class="faint" style="font-size:.78rem">알레르기·응급 정보는 안전을 위해 항상 맨 위에 표시돼요.</p>',
      buttons: (isBuiltin
        ? [{ label: '기본값으로 되돌리기', value: 'reset', variant: 'ghost' }]
        : editing ? [{ label: '삭제', value: 'delete', variant: 'danger' }] : []
      ).concat([
        { label: '취소', value: 'cancel', variant: 'ghost' },
        { label: '저장', value: 'ok', variant: 'primary' }
      ]),
      onMount: function (root) {
        var selBody = root.querySelector('#aud-selected');
        var availBody = root.querySelector('#aud-available');
        function rerender() {
          selBody.innerHTML = selectedHTML();
          availBody.innerHTML = availableHTML();
          selBody.querySelectorAll('[data-bup]').forEach(function (b) {
            b.onclick = function () {
              var i = parseInt(b.dataset.bup, 10);
              var t = selected[i - 1]; selected[i - 1] = selected[i]; selected[i] = t;
              rerender();
            };
          });
          selBody.querySelectorAll('[data-bdown]').forEach(function (b) {
            b.onclick = function () {
              var i = parseInt(b.dataset.bdown, 10);
              var t = selected[i + 1]; selected[i + 1] = selected[i]; selected[i] = t;
              rerender();
            };
          });
          selBody.querySelectorAll('[data-bremove]').forEach(function (b) {
            b.onclick = function () { selected.splice(parseInt(b.dataset.bremove, 10), 1); rerender(); };
          });
          availBody.querySelectorAll('[data-badd]').forEach(function (b) {
            b.onclick = function () { selected.push(b.dataset.badd); rerender(); };
          });
        }
        rerender();
      },
      onButton: function (v, root) {
        if (v === 'cancel') return;
        if (v === 'reset') {
          Store.deleteAudienceTemplate(audId, ownerId);
          toast('기본값으로 되돌렸어요', 'ok');
          App.refresh();
          return;
        }
        if (v === 'delete') {
          Store.deleteAudienceTemplate(audId, ownerId);
          if (S.shareAudience === audId) S.shareAudience = null;
          toast('대상을 삭제했어요', 'ok');
          App.refresh();
          return;
        }
        if (v === 'ok') {
          var f = readForm(root);
          var label = (f.label || '').trim();
          if (!label) { toast('대상 이름을 입력해 주세요', 'err'); return 'keep'; }
          if (!selected.length) { toast('보여줄 내용을 하나 이상 골라 주세요', 'err'); return 'keep'; }
          var saved = Store.saveAudienceTemplate({
            id: audId || null, ownerId: ownerId, label: label, intro: (f.intro || '').trim(),
            icon: iconVal, color: colorVal, blocks: selected.slice()
          });
          S.shareAudience = saved.id;
          toast(editing ? '대상을 저장했어요' : '새 대상을 만들었어요', 'ok');
          App.refresh();
        }
      }
    });
  }

  /* 공유 링크 전체 기록(히스토리) — 지금까지 만든 모든 링크(사용 중·중단·기간 만료)를 한 모달에 모아 본다.
     만료된 링크는 [다시 열기]로 재활성화 가능. */
  function openShareHistory(child) {
    var AUD = V._audienceMap(child.ownerId);
    var all = Store.sharesOf(child.id).slice().sort(function (a, b) {
      return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
    });
    var rows = all.map(function (s) {
      var revoked = s.revoked;
      var expired = !revoked && Store.isShareExpired(s);
      var am = (s.audience && AUD[s.audience]) || null;
      var label = am ? am.label : (SCOPE_META[s.scope] || SCOPE_META.summary).t;
      var statusBadge = revoked ? '<span class="badge danger">중단됨</span>'
        : expired ? '<span class="badge danger">기간 만료</span>'
        : '<span class="badge ok">사용 중</span>';
      var period = UI.fmtDate(s.createdAt) + ' ~ ' + (s.expiresAt ? UI.fmtDate(s.expiresAt) : '계속');
      return '<div class="hist-row">' +
        '<div class="hist-main">' +
          '<div class="hist-top">' + statusBadge +
            '<b>' + esc(s.viewerName || '받는 분') + '</b>' +
            '<span class="badge">' + esc(s.viewerRole) + '</span>' +
            '<span class="badge brand">' + esc(label) + '</span>' +
          '</div>' +
          '<div class="faint" style="font-size:.78rem;margin-top:3px">' + period +
            ' · ' + icon('eye', 12) + ' ' + (s.views || 0) + '번 봤어요</div>' +
        '</div>' +
        (expired
          ? '<button class="btn btn-soft btn-sm" data-histrenew="' + s.id + '">' +
            icon('check', 14) + '다시 열기</button>'
          : '') +
      '</div>';
    }).join('');
    Modal.open({
      title: '공유 링크 전체 기록', icon: 'clock', wide: true,
      body: '<p class="muted mb-2" style="font-size:.88rem">지금까지 만든 모든 공유 링크예요. ' +
        '사용 중·중단·기간 만료를 한눈에 볼 수 있고, 만료된 링크는 다시 열 수 있어요.</p>' +
        '<div class="hist-list">' + rows + '</div>',
      buttons: [{ label: '닫기', value: 'ok', variant: 'primary' }],
      onMount: function (root) {
        root.querySelectorAll('[data-histrenew]').forEach(function (b) {
          b.onclick = function () {
            Store.renewShare(b.dataset.histrenew);
            Modal.close();
            toast('공유를 다시 열었어요', 'ok');
            App.refresh();
          };
        });
      }
    });
  }

  V.share = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var AUD = V._audienceMap(child.ownerId);
      var manual = Store.getManual(child.id) || Store.saveManual(Store.emptyManual(child.id));
      if (!S.shareAudience || !AUD[S.shareAudience]) S.shareAudience = Object.keys(AUD)[0] || 'school';
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

      // 활성(중단·만료 아님) 링크만 목록에 노출 — 지난 링크는 '전체 기록'(히스토리)에서
      var activeShares = shares.filter(function (s) {
        return !s.revoked && !Store.isShareExpired(s);
      });
      var list = activeShares.length
        ? activeShares.map(function (s) {
            var revoked = s.revoked;
            var expired = !revoked && Store.isShareExpired(s);
            var inactive = revoked || expired;
            var am = (s.audience && AUD[s.audience]) || null;
            var label = am ? am.label : (SCOPE_META[s.scope] || SCOPE_META.summary).t;
            var dleft = (!inactive && s.expiresAt)
              ? Math.max(0, Math.ceil((new Date(s.expiresAt).getTime() - Date.now()) / 864e5)) : null;
            return '<div class="card card-pad mb-2" data-share-card="' + s.id + '"' + (inactive ? ' style="opacity:.55"' : '') + '>' +
              '<div class="row between wrap" style="margin-bottom:8px">' +
                '<div><b>' + esc(s.viewerName || '받는 분') + '</b> ' +
                  '<span class="badge">' + esc(s.viewerRole) + '</span> ' +
                  '<span class="badge brand">' + esc(label) + '</span>' +
                  (s.safeNumber ? ' <span class="badge ok">안심번호</span>' : '') +
                  (revoked ? ' <span class="badge danger">중단됨</span>'
                    : expired ? ' <span class="badge danger">기간 만료</span>'
                    : s.renewCycle ? ' <span class="badge">' + CYCLE_LABEL[s.renewCycle] +
                        ' 동안 열람' + (dleft != null ? ' · D-' + dleft : '') + '</span>' : '') +
                '</div>' +
                '<span class="faint" style="font-size:.8rem">' + icon('eye', 13) + ' ' +
                  (s.views || 0) + '번 봤어요</span>' +
              '</div>' +
              '<div class="row wrap" style="gap:10px">' +
                '<div class="code-box" style="flex:1;min-width:200px">' +
                  '<span>' + esc(shareURL(s.token)) + '</span>' +
                  (inactive ? '' :
                    '<button class="btn btn-soft btn-sm" data-copy="' + esc(shareURL(s.token)) + '">' +
                      icon('copy', 14) + '복사</button>') + '</div>' +
                '<div style="text-align:center"><div class="faint" style="font-size:.74rem">인증번호</div>' +
                  '<div style="font-weight:800;letter-spacing:.15em;color:var(--primary-dark)">' +
                  esc(s.accessCode) + '</div></div>' +
                (expired ?
                  '<button class="btn btn-primary btn-sm" data-renew="' + s.id + '">' +
                    icon('check', 14) + CYCLE_LABEL[s.renewCycle] + ' 더 열어두기</button>' : '') +
              '</div>' +
              '<div class="row between mt-1 wrap" style="gap:8px">' +
                '<span class="faint" style="font-size:.78rem">공유 기간 ' + UI.fmtDate(s.createdAt) +
                  ' ~ ' + (s.expiresAt ? UI.fmtDate(s.expiresAt) : '계속') + '</span>' +
                '<div class="row gap-sm wrap">' +
                  (inactive ? '' :
                    '<button class="btn btn-ghost btn-sm" data-qr="' + esc(s.token) +
                      '" data-qr-code="' + esc(s.accessCode) + '" data-qr-name="' + esc(child.name) + '">' +
                      icon('grid', 14) + 'QR·키링 카드</button>') +
                  (inactive ? '' :
                    '<button class="btn btn-ghost btn-sm" data-web-share="1" data-token="' + esc(s.token) +
                      '" data-code="' + esc(s.accessCode) + '" data-name="' + esc(child.name) + '">' +
                      icon('share', 14) + '공유하기</button>') +
                  (revoked ? ''
                    : '<button class="btn btn-danger btn-sm" data-revoke="' + s.id + '">공유 중단</button>') +
                '</div>' +
              '</div></div>';
          }).join('')
        : (shares.length
            ? '<div class="card empty"><div class="emoji">🔗</div>' +
              '<h3>지금 사용 중인 공유 링크가 없어요</h3>' +
              '<p>위에서 새 공유 링크를 만들어 보세요. 중단·만료된 지난 링크는 오른쪽 ‘전체 기록’에서 볼 수 있어요.</p></div>'
            : '<div class="card empty"><div class="emoji">🔗</div>' +
              '<h3>아직 만든 공유가 없어요</h3>' +
              '<p>인증 링크를 만들어 학교·병원·치료실에 안전하게 전달하세요.</p></div>');

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
            '설명서를 본 분이 노트를 남기면 여기에 모여요.</p>') +
        '</div></div>';

      // 대상 선택 카드 — 기본 4종 + 직접 만든 대상. 각 카드에서 바로 편집할 수 있고, 새 대상도 추가할 수 있다.
      // (편집 버튼을 카드 안에 중첩해야 해서 카드 자체는 button이 아닌 div로 구성)
      var audPicker = Object.keys(AUD).map(function (k) {
        var a = AUD[k];
        return '<div class="aud-card' + (k === aud ? ' on' : '') + '" data-aud="' + k + '" role="button" tabindex="0">' +
          '<button type="button" class="aud-edit-btn" data-audedit="' + k + '" ' +
            'aria-label="' + esc(a.label) + ' 편집" title="이 대상 편집">' + icon('edit', 14) + '</button>' +
          '<span class="aud-ico" style="background:' + a.color + '">' + icon(a.icon, 20) + '</span>' +
          '<span><b>' + esc(a.label) + '</b><p>' + esc(a.intro) + '</p></span></div>';
      }).join('');

      var preview = '<div class="print-area">' +
        V._summarySheet(child, manual, { audience: aud, printBtn: true }) + '</div>';

      var hub =
        '<div class="card card-pad mb-3">' +
          '<div class="page-head-row mb-2"><div>' +
            '<div class="eyebrow" style="color:var(--primary)">대상별 설명서</div>' +
            '<h2 style="font-size:1.2rem">누구에게 보여줄 설명서인가요?</h2></div>' +
            '<button class="btn btn-ghost btn-sm" id="aud-new">' + icon('plus', 15) +
              '새 대상 만들기</button></div>' +
          '<p class="muted mb-2" style="font-size:.9rem">대상에 맞는 내용만 골라 한 장으로 정리됩니다. ' +
            '새 선생님·치료사를 만나도 다시 설명할 필요 없이 링크 하나로 전달하세요.</p>' +
          '<div class="aud-grid">' + audPicker + '</div>' +
          '<div class="row gap-sm mt-2" style="flex-wrap:wrap">' +
            '<button class="btn btn-primary" id="btn-share-aud">' + icon('share', 16) +
              '이 설명서로 공유 링크·QR 만들기</button>' +
          '</div>' +
        '</div>' +
        preview;

      var listSection = '<div class="page-head-row mb-2 mt-3"><h2 style="font-size:1.15rem">공유 링크</h2>' +
        (shares.length
          ? '<button class="btn btn-ghost btn-sm" id="share-history">' + icon('clock', 15) +
            '전체 기록 ' + shares.length + '</button>'
          : '') + '</div>' +
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
      var AUD = V._audienceMap(child.ownerId);

      // 공유 링크 전체 기록(히스토리) 열기
      var histBtn = UI.el('share-history');
      if (histBtn) histBtn.onclick = function () { openShareHistory(child); };

      // 대상 선택 → 미리보기 갱신 (편집 버튼 클릭은 선택으로 번지지 않게 stopPropagation)
      document.querySelectorAll('[data-aud]').forEach(function (b) {
        b.onclick = function () { S.shareAudience = b.dataset.aud; App.refresh(); };
      });
      document.querySelectorAll('[data-audedit]').forEach(function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          openAudienceEditor(child, b.dataset.audedit);
        };
      });
      var audNew = UI.el('aud-new');
      if (audNew) audNew.onclick = function () { openAudienceEditor(child, null); };
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
            '<div class="field"><label>공유 기간 <span class="faint">기간이 끝나면 저절로 잠가 아이의 정보를 지켜요</span></label>' +
              '<select class="select" name="renewCycle">' +
              [['month', '1개월'], ['day', '1일'], ['week', '1주일'], ['year', '1년'], ['', '계속 유지']].map(function (o) {
                return '<option value="' + o[0] + '"' + (o[0] === 'month' ? ' selected' : '') + '>' +
                  o[1] + '</option>';
              }).join('') + '</select></div>' +
            '<label class="checkline"><input type="checkbox" name="safeNumber" checked>' +
              '<span>비상연락처를 <b>안심번호(050)</b>로 표시 ' +
              '<span class="faint" style="font-size:.8rem">— 실제 번호는 보호자만</span></span></label>' +
            '<div class="pill-info" style="margin-top:10px">' + icon('info', 16) +
              '<div>만들면 4자리 인증번호가 함께 만들어져요. 링크와 인증번호를 같이 전해 주세요.</div></div>',
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '공유 만들기', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var f = readForm(root);
            var s = Store.createShare({
              childId: child.id, audience: audience, safeNumber: f.safeNumber,
              viewerName: f.viewerName, viewerRole: f.viewerRole, renewCycle: f.renewCycle
            });
            Modal.close();
            var qrSvg = QR.svg(shareURL(s.token), { cell: 4, margin: 3, width: 180 });
            Modal.open({
              title: '공유 링크가 만들어졌어요', icon: 'check',
              body: '<p class="muted mb-2">' + esc(a.label) +
                ' 설명서 링크와 인증번호를 함께 전달하세요.</p>' +
                '<div style="text-align:center;margin-bottom:12px">' +
                  '<div style="display:inline-block;padding:10px;border:1px solid var(--border);' +
                  'border-radius:14px;background:#fff">' + (qrSvg || '') + '</div></div>' +
                '<div class="code-box mb-2"><span>' + esc(shareURL(s.token)) + '</span></div>' +
                '<div class="callout center mb-2"><div class="faint" style="font-size:.8rem">인증번호</div>' +
                '<div class="access-code">' + esc(s.accessCode) + '</div></div>' +
                (s.renewCycle ? '<p class="faint" style="font-size:.8rem;text-align:center">' +
                  CYCLE_LABEL[s.renewCycle] + ' 동안 열람할 수 있어요. 기간이 끝나면 저절로 잠가 아이의 정보를 소중히 지켜 드려요.</p>' : ''),
              buttons: [
                { label: '공유하기', value: 'share', variant: 'soft' },
                { label: '링크 복사', value: 'copy', variant: 'soft' },
                { label: '확인', value: 'ok', variant: 'primary' }
              ],
              onButton: function (vv) {
                if (vv === 'share') {
                  var url = shareURL(s.token);
                  UI.webShare({
                    title: 'Stellar Connect — ' + child.name + ' 설명서',
                    text: child.name + ' 설명서를 공유합니다. (Stellar Connect) — 인증번호: ' + s.accessCode,
                    url: url
                  }).then(function (ok) {
                    if (!ok) {
                      UI.copyText(url + ' (인증번호: ' + s.accessCode + ')')
                        .then(function () { toast('공유가 지원되지 않아 링크를 복사했어요', 'ok'); });
                    }
                  });
                  return 'keep';
                }
                if (vv === 'copy') {
                  UI.copyText(shareURL(s.token) + ' (인증번호: ' + s.accessCode + ')')
                    .then(function () { toast('링크와 인증번호를 복사했어요', 'ok'); });
                  return 'keep';
                }
                S.focusShareId = s.id;   // 목록에서 새로 만든 공유로 스크롤·강조
                App.refresh();
              }
            });
            // 같은 modal-host에 발급 모달을 새로 띄웠으므로 'keep' — 바깥 close()가 지우지 않게
            return 'keep';
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
            '<div class="field"><label>받는 분 이름 / 소속</label>' +
              '<input class="input" name="viewerName" placeholder="예) 햇살초 1학년 담임"></div>' +
            '<div class="field"><label>받는 분 유형</label>' +
              '<select class="select" name="viewerRole">' +
              ['학교', '병원', '치료기관', '가족·친척', '기타'].map(function (o) {
                return '<option>' + o + '</option>';
              }).join('') + '</select></div>' +
            '<div class="field"><label>정보 공개 레벨 <span class="faint">받는 분에게 보여줄 범위</span></label>' +
              '<div class="scope-pick">' + scopeOpts + '</div></div>' +
            '<label class="checkline"><input type="checkbox" name="safeNumber" checked>' +
              '<span>비상연락처를 <b>안심번호(050)</b>로 표시 ' +
              '<span class="faint" style="font-size:.8rem">— 실제 번호는 보호자만 볼 수 있어요</span></span></label>' +
            '<div class="pill-info" style="margin-top:10px">' + icon('info', 16) +
              '<div>만들면 4자리 인증번호가 함께 만들어져요. 링크와 인증번호를 같이 전해 주세요. ' +
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
            { label: '공유 만들기', value: 'ok', variant: 'primary' }
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
              title: '공유 링크가 만들어졌어요', icon: 'check',
              body: '<p class="muted mb-2">아래 링크와 인증번호를 받는 분에게 같이 전해 주세요.</p>' +
                '<div class="code-box mb-2"><span>' + esc(shareURL(s.token)) + '</span></div>' +
                '<div class="callout center mb-2"><div class="faint" style="font-size:.8rem">인증번호</div>' +
                '<div class="access-code">' + esc(s.accessCode) + '</div></div>',
              buttons: [
                { label: '공유하기', value: 'share', variant: 'soft' },
                { label: '링크 복사', value: 'copy', variant: 'soft' },
                { label: '확인', value: 'ok', variant: 'primary' }
              ],
              onButton: function (vv) {
                if (vv === 'share') {
                  var url = shareURL(s.token);
                  UI.webShare({
                    title: 'Stellar Connect — ' + child.name + ' 설명서',
                    text: child.name + ' 설명서를 공유합니다. (Stellar Connect) — 인증번호: ' + s.accessCode,
                    url: url
                  }).then(function (ok) {
                    if (!ok) {
                      UI.copyText(url + ' (인증번호: ' + s.accessCode + ')')
                        .then(function () { toast('공유가 지원되지 않아 링크를 복사했어요', 'ok'); });
                    }
                  });
                  return 'keep';
                }
                if (vv === 'copy') {
                  UI.copyText(shareURL(s.token) + ' (인증번호: ' + s.accessCode + ')')
                    .then(function () { toast('링크와 인증번호를 복사했어요', 'ok'); });
                  return 'keep';
                }
                S.focusShareId = s.id;   // 목록에서 새로 만든 공유로 스크롤·강조
                App.refresh();
              }
            });
            // 같은 modal-host에 발급 모달을 새로 띄웠으므로 'keep' — 바깥 close()가 지우지 않게
            return 'keep';
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
      document.querySelectorAll('[data-web-share]').forEach(function (b) {
        b.onclick = function () {
          var url = shareURL(b.dataset.token);
          var name = b.dataset.name || '아이';
          var text = name + ' 설명서를 공유합니다. (Stellar Connect) — 인증번호: ' + b.dataset.code;
          UI.webShare({ title: 'Stellar Connect — ' + name + ' 설명서', text: text, url: url })
            .then(function (ok) {
              if (!ok) {
                UI.copyText(url + ' (인증번호: ' + b.dataset.code + ')')
                  .then(function () { toast('링크와 인증번호를 복사했어요', 'ok'); });
              }
            });
        };
      });
      document.querySelectorAll('[data-revoke]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '공유 중단', danger: true,
            message: '이 링크의 접근을 차단할까요? 받는 분은 더 이상 설명서를 볼 수 없어요.',
            okLabel: '공유 중단' }).then(function (ok) {
            if (ok) { Store.revokeShare(b.dataset.revoke); toast('공유를 중단했어요', 'ok'); App.refresh(); }
          });
        };
      });
      document.querySelectorAll('[data-renew]').forEach(function (b) {
        b.onclick = function () {
          Store.renewShare(b.dataset.renew);
          toast('공유를 다시 열었어요', 'ok');
          App.refresh();
        };
      });
      // 방문 노트 삭제 (보호자 권한)
      document.querySelectorAll('[data-vndel]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '노트 삭제', message: '이 방문 노트를 삭제할까요?',
            okLabel: '삭제', danger: true }).then(function (ok) {
            if (ok) { Store.deleteVisitNote(b.dataset.vndel); toast('삭제했어요', 'ok'); App.refresh(); }
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
          /* 열람 기간 — 공유에 설정한 기간을 QR 모달에서도 그대로 보여준다.
             보안은 인증번호 + 열람 기간 + 즉시 중단 3종으로 충분 (이미지 회전 기능은 제거, 2026-07-16) */
          var qShare = Store.getShareByToken(token);
          var qValidity = (qShare && qShare.expiresAt)
            ? '<b>' + UI.fmtDate(qShare.expiresAt) + '</b>까지 열람 가능 ' +
              '<span class="badge ok">D-' +
              Math.max(0, Math.ceil((new Date(qShare.expiresAt).getTime() - Date.now()) / 864e5)) +
              '</span>'
            : '기간 제한 없이 열람 가능';
          Modal.open({
            title: 'QR 코드 · 키링 카드', icon: 'grid',
            body:
              '<div style="text-align:center">' +
                '<div id="qr-box" style="display:inline-block;padding:10px;border:1px solid var(--border);' +
                  'border-radius:14px;background:#fff"></div>' +
                '<div class="mt-1"><span class="faint" style="font-size:.8rem">인증번호</span> ' +
                  '<b style="letter-spacing:.15em;color:var(--primary-dark)">' + esc(code) + '</b></div>' +
                '<div class="mt-1" style="font-size:.85rem">' + icon('clock', 13) + ' ' + qValidity + '</div>' +
              '</div>' +
              '<div class="pill-info mt-2">' + icon('info', 16) +
                '<div>QR을 스캔한 사람도 <b>인증번호</b>를 알아야 열람할 수 있고, 열람 기간이 끝나면 ' +
                '저절로 잠가 아이의 정보를 지켜요. 공유 목록에서 언제든 <b>즉시 중단</b>할 수 있어요. ' +
                '인쇄해 <b>가방·키링</b>에 다는 안심 카드로도 만들 수 있어요.</div></div>',
            buttons: [
              { label: '닫기', value: 'cancel', variant: 'ghost' },
              { label: '키링 카드 인쇄', value: 'print', variant: 'primary' }
            ],
            onMount: function (root) {
              var box = root.querySelector('#qr-box');
              var svg = QR.svg(shareURL(token), { cell: 4, margin: 3, width: 196 });
              box.innerHTML = svg || '<p class="muted">링크가 너무 길어 QR을 만들 수 없어요.</p>';
            },
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

      // 새로 만든 공유가 있으면 목록에서 해당 카드로 스크롤 + 잠깐 강조 (1회성)
      if (S.focusShareId) {
        var focusId = S.focusShareId;
        S.focusShareId = null;
        setTimeout(function () {
          var card = document.querySelector('[data-share-card="' + focusId + '"]');
          if (!card) return;
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('just-created');
          setTimeout(function () { card.classList.remove('just-created'); }, 2400);
        }, 120);
      }
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
      var topBar = '<div class="app-bar"><div class="brand">' + UI.brandMark(34) +
        '<div class="wordmark"><b>내 아이 설명서</b>' +
        '<span>Stellar Connect · S:CON</span></div></div></div>';

      /* 프로토타입 정직성 — '못 찾음'(다른 기기)과 '중단·만료'를 구분해 안내한다.
         공유 데이터는 만든 기기의 브라우저(localStorage)에만 저장되므로,
         QR을 다른 기기에서 스캔하면 여기로 온다. 실서비스는 서버 조회라 문제 없음. */
      if (!share) {
        return topBar + '<div class="container narrow"><div class="card empty">' +
          '<div class="emoji">🔍</div><h3>이 기기에서 공유 정보를 찾을 수 없어요</h3>' +
          '<p>지금은 시연용 프로토타입이라 공유 데이터가 <b>공유를 만든 기기의 브라우저</b>에만 ' +
          '저장돼요.<br>공유를 만든 기기에서 열어 보시거나, 보호자에게 링크를 다시 요청해 주세요.<br>' +
          '<span class="faint">정식 서비스에서는 서버에서 조회되어 어느 기기에서나 열람할 수 있습니다.</span></p>' +
          '</div></div>';
      }
      if (share.revoked || Store.isShareExpired(share)) {
        /* 승차권 전달처럼 — 기간 만료면 언제까지였는지 명확히 알려준다 */
        var endMsg = (!share.revoked && share.expiresAt)
          ? '이 설명서는 <b>' + UI.fmtDate(share.expiresAt) + '</b>까지 열람할 수 있었어요.<br>' +
            '계속 보시려면 보호자에게 새 링크를 요청해 주세요.'
          : '보호자가 공유를 중단했어요. 보호자에게 새 링크를 요청해 주세요.';
        return topBar + '<div class="container narrow"><div class="card empty">' +
          '<div class="emoji">🔒</div><h3>지금은 열 수 없는 링크예요</h3>' +
          '<p>' + endMsg + '</p></div></div>';
      }
      var child = Store.getChild(share.childId);
      var manual = child ? Store.getManual(child.id) : null;
      if (!child || !manual) {
        return topBar + '<div class="container narrow"><div class="card empty">' +
          '<div class="emoji">🔍</div><h3>설명서를 찾을 수 없습니다</h3></div></div>';
      }
      var AUD = V._audienceMap(child.ownerId);

      /* 열람 유효기간 — 승차권 전달처럼 받는 사람에게도 기간을 명확히 보여준다 */
      var vd = null;
      if (share.expiresAt) {
        var _dl = Math.max(0, Math.ceil((new Date(share.expiresAt).getTime() - Date.now()) / 864e5));
        vd = { until: UI.fmtDate(share.expiresAt), dleft: _dl };
      }
      var validityLine = vd
        ? '<b>' + vd.until + '</b>까지 열람 가능 ' +
          '<span class="badge ' + (vd.dleft <= 3 ? 'warn' : 'ok') + '">' +
          (vd.dleft === 0 ? '오늘까지' : 'D-' + vd.dleft) + '</span>'
        : '기간 제한 없이 열람 가능';

      if (!viewerAuthed[share.token]) {
        return topBar + '<div class="container narrow" style="padding-top:44px">' +
          '<div class="card card-pad" style="max-width:380px;margin:0 auto;text-align:center">' +
          '<div style="color:var(--primary)">' + icon('lock', 36) + '</div>' +
          '<h2 style="margin:10px 0 4px">인증번호 입력</h2>' +
          '<p class="muted mb-3" style="font-size:.9rem">보호자에게 전달받은 ' +
            '4자리 인증번호를 입력해 주세요.</p>' +
          '<div class="pill-info mb-3" style="justify-content:center;font-size:.85rem;text-align:left">' +
            icon('clock', 15) + '<div>' + validityLine + '</div></div>' +
          '<form id="vauth-form">' +
            '<input class="input" id="vauth-code" inputmode="numeric" maxlength="4" ' +
              'style="text-align:center;font-size:1.6rem;letter-spacing:.4em;font-weight:800" ' +
              'placeholder="0000">' +
            '<button class="btn btn-primary btn-block btn-lg" type="submit" style="margin-top:14px">' +
              '설명서 보기</button>' +
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
          '<div><b>' + esc(share.viewerName || '받는 분') + '</b> 님에게 공유된 ' +
          '<b>' + esc(audLabel) + '</b> 설명서입니다.' +
          '<div style="margin-top:3px;font-size:.86rem">' + validityLine + '</div></div></div>' +
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
            toast('인증번호가 맞지 않아요. 다시 한번 확인해 주세요', 'err');
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
        toast('노트를 보호자에게 전해 드렸어요. 고맙습니다!', 'ok');
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
            return dynRow([{ k: 'name', ph: '이름' }, { k: 'relation', type: 'select', opts: V._REL_OPTS },
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
          dynRow([{ k: 'name', ph: '이름' }, { k: 'relation', type: 'select', opts: V._REL_OPTS },
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
            toast('탈퇴가 완료되었어요. 그동안 함께해 주셔서 감사합니다', 'ok');
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
              Store.saveContent(c); toast('저장했어요', 'ok'); App.refresh();
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
              if (ok) { Store.deletePopup(b.dataset.pdelete); toast('삭제했어요', 'ok'); App.refresh(); }
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
        Store.savePopup(p); toast('저장했어요', 'ok'); App.refresh();
      }
    });
  }

})(window);
