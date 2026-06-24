/* =====================================================================
 * views2.js — 아이 프로필 / 설명서 편집 / 한 장 요약
 * ===================================================================== */
(function (global) {
  'use strict';
  var V = global.Views;
  var esc = UI.esc, nl2br = UI.nl2br, icon = UI.icon, Modal = UI.Modal, toast = UI.toast;
  var S = V._S, MSEC = V._MSEC, MTABS = V._MTABS;
  var readForm = V._readForm, readRows = V._readRows, ownedChild = V._ownedChild;
  var notFound = V._notFound, manualCount = V._manualCount;
  var childContextBar = V._childContextBar, pageHead = V._pageHead;

  /* ---------- 동적 입력 행 ---------- */
  function dynRow(fields, vals) {
    vals = vals || {};
    var inner = fields.map(function (f) {
      var flex = 'flex:' + (f.flex || 1);
      if (f.type === 'select') {
        return '<select class="select" data-f="' + f.k + '" style="' + flex + '">' +
          f.opts.map(function (o) {
            return '<option' + (vals[f.k] === o ? ' selected' : '') + '>' + esc(o) + '</option>';
          }).join('') + '</select>';
      }
      return '<input class="input" data-f="' + f.k + '" placeholder="' + esc(f.ph || '') +
        '" value="' + esc(vals[f.k] || '') + '" style="' + flex + '">';
    }).join('');
    return '<div class="dyn-row" style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start">' +
      inner + '<button type="button" class="btn-icon dyn-del" style="flex:none">' +
      icon('x', 16) + '</button></div>';
  }

  /* ---------- 빠른 입력 프리셋 (6/10 회의 반영 — 직접 쓰지 않아도 탭 한 번으로) ---------- */
  var QUICK = {
    canDo: [
      '혼자 신발을 신어요', '혼자 손을 씻어요', '수저로 혼자 식사해요',
      '화장실 가고 싶다고 표현해요', '간단한 심부름을 해요', '이름을 부르면 쳐다봐요'
    ],
    needHelp: [
      '새로운 장소에 적응할 때', '옷의 단추·지퍼 잠그기', '양치 마무리하기',
      '횡단보도를 건널 때', '차례를 기다릴 때', '감정이 격해졌을 때 진정하기'
    ],
    like: [
      '기차·자동차 장난감', '퍼즐 맞추기', '물놀이', '그네·트램펄린',
      '잔잔한 음악', '그림 그리기', '좋아하는 영상 보기'
    ],
    dislike: [
      '크고 갑작스러운 소리', '갑작스러운 신체 접촉', '낯선 음식의 식감',
      '밝거나 깜빡이는 조명', '사람이 많고 복잡한 곳', '일정이 갑자기 바뀌는 것'
    ],
    comm: [
      '짧고 명확한 문장으로 말해 주세요', '그림 카드(AAC)로 소통해요',
      '손짓·몸짓을 함께 보여 주세요', '두 가지 중에서 고르게 해 주세요',
      '시각적 일정표가 도움이 돼요', '대답할 시간을 충분히 기다려 주세요'
    ],
    routine: [
      '아침 7시에 일어나 세수하고 옷을 입어요', '등교 전 좋아하는 음악을 들어요',
      '하교 후 간식을 먹고 30분 쉬어요', '주 2회 치료실 수업이 있어요',
      '저녁 8시 목욕 후 책을 한 권 읽어요', '밤 9시 30분에 잠자리에 들어요'
    ],
    safety: [
      '찻길·주차장에서는 꼭 손을 잡아 주세요', '잠깐이라도 혼자 두지 말아 주세요',
      '문이 열려 있으면 밖으로 나갈 수 있어요', '물가(욕조·수영장)에서는 항상 곁에 있어 주세요',
      '뜨거운 것(온수·냄비)에 손을 뻗을 수 있어요', '작은 물건을 입에 넣을 수 있어요'
    ]
  };
  /* 문제 행동 — 자주 있는 상황 / 추천 대응 (구조화 입력) */
  var PROBLEM_SITS = [
    '큰 소리·시끄러운 환경에 노출될 때', '일정이 갑자기 바뀔 때',
    '낯선 장소·새로운 환경에 갈 때', '원하는 것을 말로 표현하지 못할 때',
    '차례를 기다려야 할 때', '빛·소리·촉감 등 감각 자극이 과할 때',
    '하던 활동을 중단해야 할 때'
  ];
  var PROBLEM_RES = [
    '조용한 공간으로 이동해 진정될 때까지 기다려 주세요',
    '좋아하는 물건(또는 장난감)을 건네 주세요',
    '꼭 안아 주거나 손을 잡아 깊은 압박을 해 주세요',
    '말을 줄이고 곁에서 조용히 기다려 주세요',
    '짧은 문장으로 다음 일정을 미리 알려 주세요',
    '다른 활동으로 부드럽게 주의를 돌려 주세요'
  ];
  function quickChips(manual, key) {
    var pool = QUICK[key] || [];
    var existing = manual.sections[key].map(function (x) { return (x.text || '').trim(); });
    var rest = pool.filter(function (t) { return existing.indexOf(t) === -1; });
    if (!rest.length) return '';
    return '<div class="quick-wrap"><div class="quick-cap">' + icon('sparkle', 13) +
      '탭 한 번으로 추가 — 우리 아이에 해당하는 항목을 골라 보세요</div>' +
      '<div class="quick-chips">' + rest.map(function (t) {
        return '<button type="button" class="chip quick" data-qadd="' + key +
          '" data-qtext="' + esc(t) + '"><b>+</b>' + esc(t) + '</button>';
      }).join('') + '</div></div>';
  }

  /* ---------- '내가 없을 때' 돌봄 인수인계 항목 (채비 '내가 없으면?' 벤치마킹) ---------- */
  var HANDOVER_FIELDS = [
    { k: 'commute',    label: '등·하원 방법',        ph: '예) 노란 셔틀 8:10 승차, 하원은 4시 집 앞' },
    { k: 'meal',       label: '식사·간식 준비',      ph: '예) 밥은 작게 떠 주세요. 간식은 4시에 한 번' },
    { k: 'meds',       label: '약 보관 위치·복용법',  ph: '예) 냉장고 위 흰 통 — 저녁 8시 반 1포' },
    { k: 'schedule',   label: '치료실·학교 일정',     ph: '예) 화·목 4시 ○○센터 (김 선생님 010-…)' },
    { k: 'sleep',      label: '잠자리 루틴',         ph: '예) 9시 소등, 같은 자장가, 무릎담요 필수' },
    { k: 'homeSafety', label: '집 안 주의사항',      ph: '예) 현관 도어락 이중 잠금, 베란다 잠금 확인' }
  ];
  function handoverFilled(h) {
    if (!h) return 0;
    var n = (h.caretakers || []).filter(function (c) { return c.name; }).length;
    HANDOVER_FIELDS.forEach(function (f) { if ((h.items || {})[f.k]) n++; });
    if (h.note) n++;
    return n;
  }

  /* =====================================================================
   * 아이 프로필 (보기)
   * ===================================================================== */
  V.childProfile = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.id);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var d = child.disability;
      var age = UI.calcAge(child.birthDate);
      var gallery = (child.gallery || []).slice().sort(function (a, b) {
        return a.date < b.date ? 1 : -1;
      });

      function kvCard(title, ico, rows) {
        return '<div class="card"><div class="card-head"><span style="color:var(--primary)">' +
          icon(ico, 18) + '</span><h3>' + esc(title) + '</h3></div>' +
          '<div class="card-body">' + rows + '</div></div>';
      }
      var photoBig = child.photo
        ? '<img src="' + child.photo + '" alt="' + esc(child.name) + ' 사진">'
        : esc(UI.initials(child.name));

      var body = child.body || {};
      var basic =
        '<div style="display:flex;gap:15px;align-items:center;margin-bottom:15px;' +
          'padding-bottom:15px;border-bottom:1px solid var(--border)">' +
          '<div class="avatar xl">' + photoBig + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:800;font-size:1.1rem">' + esc(child.name) + '</div>' +
            '<div class="muted" style="font-size:.86rem;margin-top:2px">' +
              (age != null ? '만 ' + age + '세' : '나이 미등록') +
              (child.gender ? ' · ' + esc(child.gender) : '') + '</div>' +
          '</div>' +
        '</div>' +
        '<dl class="kv">' +
        '<dt>이름</dt><dd>' + esc(child.name) + '</dd>' +
        '<dt>생년월일</dt><dd>' + esc(child.birthDate || '-') +
          (age != null ? ' (만 ' + age + '세)' : '') + '</dd>' +
        '<dt>성별</dt><dd>' + esc(child.gender || '-') + '</dd>' +
        '<dt>키 · 몸무게</dt><dd>' +
          (body.height ? esc(body.height) + 'cm' : '-') +
          (body.weight ? ' · ' + esc(body.weight) + 'kg' : '') + '</dd>' +
        '<dt>혈액형</dt><dd>' + esc(body.bloodType || '-') + '</dd>' +
        '<dt>의류·신발</dt><dd>' + esc(body.sizes || '-') + '</dd>' +
        '<dt>인상착의</dt><dd>' + esc(body.features || '-') + '</dd>' +
        '</dl>';
      var disab = '<dl class="kv">' +
        '<dt>장애 유형</dt><dd>' + esc(d.type || '-') + '</dd>' +
        '<dt>진단 시기</dt><dd>' + esc(d.diagnosedAt || '-') + '</dd>' +
        '</dl>' +
        (d.summary ? '<div class="divider"></div><b style="font-size:.85rem">특성 요약</b>' +
          '<p class="muted" style="font-size:.9rem;margin-top:4px">' + nl2br(d.summary) + '</p>' : '') +
        (d.sensory ? '<div class="divider"></div><b style="font-size:.85rem">감각 특성</b>' +
          '<p class="muted" style="font-size:.9rem;margin-top:4px">' + nl2br(d.sensory) + '</p>' : '');

      var meds = child.medications.length
        ? child.medications.map(function (m) {
            return '<div class="item-row"><span class="bullet" style="background:var(--c-comm)">약</span>' +
              '<div class="txt"><b>' + esc(m.name) + '</b> ' + esc(m.dose || '') +
              (m.time ? ' · ' + esc(m.time) : '') +
              (m.note ? '<div class="resp">' + esc(m.note) + '</div>' : '') + '</div></div>';
          }).join('')
        : '<p class="muted" style="font-size:.9rem">등록된 약물이 없습니다.</p>';

      var allg = child.allergies.length
        ? child.allergies.map(function (a) {
            var sevCls = a.severity === '중증' ? 'danger' : a.severity === '중등도' ? 'warn' : '';
            return '<div class="item-row"><span class="bullet" style="background:var(--danger)">!</span>' +
              '<div class="txt"><b>' + esc(a.name) + '</b> ' +
              '<span class="badge ' + sevCls + '">' + esc(a.severity || '경증') + '</span>' +
              (a.reaction ? '<div class="resp">' + esc(a.reaction) + '</div>' : '') + '</div></div>';
          }).join('')
        : '<p class="muted" style="font-size:.9rem">등록된 알레르기가 없습니다.</p>';

      var emg = '<dl class="kv">' +
        '<dt>대응 절차</dt><dd>' + nl2br(child.emergency.protocol || '-') + '</dd>' +
        '<dt>주치 병원</dt><dd>' + esc(child.emergency.hospital || '-') + '</dd>' +
        '<dt>담당 의료진</dt><dd>' + esc(child.emergency.doctor || '-') + '</dd>' +
        '</dl>' +
        (child.emergency.contacts.length
          ? '<div class="divider"></div>' + child.emergency.contacts.map(function (c) {
              return '<div class="row" style="font-size:.9rem;padding:3px 0">' + icon('phone', 15) +
                '<b>' + esc(c.name) + '</b><span class="muted">' + esc(c.relation || '') + '</span>' +
                '<span style="margin-left:auto">' + esc(c.phone) + '</span></div>';
            }).join('')
          : '');

      var vmeta = child.verifyStatus === 'verified'
        ? { cls: 'ok', t: '인증 완료', d: '관리자 확인을 마친 아이 정보입니다.' }
        : child.verifyStatus === 'pending'
          ? { cls: 'warn', t: '인증 검토 중', d: '제출하신 서류를 관리자가 확인하고 있습니다.' }
          : { cls: '', t: '미인증', d: '서류를 제출하면 관리자 인증을 받을 수 있어요.' };

      var verifyCard = child.verifyStatus === 'verified' ? '' :
        '<div class="card card-pad mb-2" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
          '<span style="color:var(--primary);flex:none">' + icon('shield', 18) + '</span>' +
          '<span class="muted" style="font-size:.89rem;flex:1;min-width:150px">' + esc(vmeta.d) + '</span>' +
          (child.verifyStatus === 'none'
            ? '<button class="btn btn-soft btn-sm" id="btn-verify">인증 요청</button>' : '') +
        '</div>';

      return childContextBar(child, 'profile') +
        '<div class="page-head"><div class="eyebrow">아이 프로필</div></div>' +
        '<div class="card card-pad mb-2 profile-hero">' +
          '<div class="profile-photo">' +
            '<div class="avatar xl">' + photoBig + '</div>' +
            '<button class="photo-edit-btn" id="btn-photo" title="사진 변경">' +
              icon('camera', 15) + '</button>' +
            '<input type="file" id="photo-quick" accept="image/*" hidden>' +
          '</div>' +
          '<div class="meta">' +
            '<h1>' + esc(child.name) + '</h1>' +
            '<div class="row wrap gap-sm" style="margin-top:7px">' +
              (age != null ? '<span class="badge">만 ' + age + '세</span>' : '') +
              (child.gender ? '<span class="badge">' + esc(child.gender) + '</span>' : '') +
              '<span class="badge brand">' + esc(d.type || '자폐 스펙트럼 장애') + '</span>' +
              '<span class="badge ' + vmeta.cls + ' dot">' + esc(vmeta.t) + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="actions">' +
            '<button class="btn btn-ghost btn-sm" id="btn-edit">' + icon('edit', 15) + '정보 수정</button>' +
            '<button class="btn btn-primary btn-sm" id="btn-manual">' + icon('book', 15) + '설명서 작성</button>' +
          '</div>' +
        '</div>' +
        verifyCard +
        '<div class="grid grid-2" style="align-items:start">' +
          kvCard('기본 정보', 'user', basic) +
          kvCard('장애 특성', 'help', disab) +
          kvCard('약물 정보', 'pill', meds) +
          kvCard('알레르기', 'alert', allg) +
        '</div>' +
        '<div class="mt-2">' + kvCard('응급 대응 정보', 'shield', emg) + '</div>' +
        '<div class="card mt-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('camera', 18) + '</span><h3>안심 갤러리 — 최신 사진</h3>' +
          '<label class="btn btn-soft btn-sm" style="cursor:pointer">' + icon('plus', 14) +
            '사진 추가<input type="file" id="gal-input" accept="image/*" hidden></label></div>' +
          '<div class="card-body">' +
          '<p class="muted" style="font-size:.87rem;margin-bottom:13px">' +
            '아이는 자라는데 등록 사진은 그대로인 경우가 많아요. 외출·여행 전 최신 사진을 남겨 두면 ' +
            '<b>미아 등 위급 상황에서 가장 빠른 단서</b>가 됩니다.</p>' +
          (gallery.length
            ? '<div class="safe-gallery">' + gallery.map(function (g, i) {
                return '<div class="ph">' +
                  '<img src="' + g.photo + '" alt="' + esc(child.name) + ' 사진">' +
                  (i === 0 ? '<span class="latest">최신</span>' : '') +
                  '<span class="date">' + UI.fmtDate(g.date) + '</span>' +
                  '<button class="del" data-gdel="' + g.id + '" aria-label="사진 삭제">' +
                    icon('x', 13) + '</button>' +
                '</div>';
              }).join('') + '</div>'
            : '<p class="faint" style="font-size:.88rem;padding:6px 0">아직 사진이 없어요. ' +
              '오늘 사진 한 장으로 시작해 보세요.</p>') +
          '</div></div>' +
        (function () {
          var h = child.handover || { caretakers: [], items: {}, note: '' };
          var filled = handoverFilled(h);
          var ct = (h.caretakers || []).filter(function (c) { return c.name; });
          var preview = ct.length
            ? '<div class="row wrap gap-sm" style="margin-top:9px">' + ct.map(function (c) {
                return '<span class="badge brand">' + icon('user', 11) + ' ' + esc(c.name) +
                  (c.relation ? ' (' + esc(c.relation) + ')' : '') + '</span>';
              }).join('') + '</div>'
            : '';
          return '<div class="card mt-2"><div class="card-head">' +
            '<span style="color:var(--brand-understand)">' + icon('hand', 18) + '</span>' +
            '<h3>내가 없을 때 — 돌봄 인수인계</h3>' +
            '<span class="badge ' + (filled >= 4 ? 'ok' : '') + '">' + filled + '개 항목</span>' +
            '<button class="btn btn-soft btn-sm" id="btn-handover" style="margin-left:8px">' +
              icon('edit', 14) + (filled ? '수정' : '작성') + '</button></div>' +
            '<div class="card-body">' +
            '<p class="muted" style="font-size:.88rem">' +
              '주 양육자가 갑자기 자리를 비울 때(입원·출장 등) 대신 돌볼 사람이 봐야 할 핵심을 ' +
              '미리 적어 두세요. <b>한 장 요약의 \'전체 정보\' 공개 레벨</b>에 함께 담깁니다.</p>' +
            preview +
            '</div></div>';
        })() +
        '<div class="card card-pad mt-2" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px">' +
          '<button class="btn btn-ghost btn-sm" id="btn-del">' + icon('trash', 15) + '아이 정보 삭제</button>' +
          '<button class="btn btn-soft btn-sm" id="btn-summary">' + icon('print', 15) + '한 장 요약 보기</button>' +
        '</div>';
    },
    mount: function (p) {
      var child = ownedChild(p.id);
      UI.el('btn-edit').onclick = function () { App.navigate('#/child/' + p.id + '/edit'); };
      UI.el('btn-manual').onclick = function () { App.navigate('#/manual/' + p.id); };
      UI.el('btn-summary').onclick = function () { App.navigate('#/summary/' + p.id); };

      // 프로필 사진 바로 변경
      var bp = UI.el('btn-photo'), pq = UI.el('photo-quick');
      if (bp && pq) {
        bp.onclick = function () { pq.click(); };
        pq.addEventListener('change', function (e) {
          var f = e.target.files[0]; if (!f) return;
          UI.fileToDataURL(f, 640, function (url) {
            if (!url) { toast('이미지를 불러오지 못했어요', 'err'); return; }
            var c = Store.getChild(p.id);
            if (!c) return;
            c.photo = url;
            Store.saveChild(c);
            toast('아이 사진이 변경되었습니다', 'ok');
            App.refresh();
          });
        });
      }
      // 안심 갤러리 — 사진 추가 / 삭제
      var gi = UI.el('gal-input');
      if (gi) gi.addEventListener('change', function (e) {
        var f = e.target.files[0]; if (!f) return;
        var c = Store.getChild(p.id); if (!c) return;
        c.gallery = c.gallery || [];
        if (c.gallery.length >= 8) {
          toast('사진은 최대 8장까지 보관돼요. 오래된 사진을 삭제해 주세요.', 'err');
          return;
        }
        UI.fileToDataURL(f, 640, function (url) {
          if (!url) { toast('이미지를 불러오지 못했어요', 'err'); return; }
          c.gallery.push({ id: Store.uid('gal'), photo: url, date: Store.nowISO() });
          Store.saveChild(c);
          toast('최신 사진이 추가되었습니다', 'ok');
          App.refresh();
        });
      });
      document.querySelectorAll('[data-gdel]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '사진 삭제', message: '이 사진을 삭제할까요?',
            okLabel: '삭제', danger: true }).then(function (ok) {
            if (!ok) return;
            var c = Store.getChild(p.id); if (!c) return;
            c.gallery = (c.gallery || []).filter(function (g) { return g.id !== b.dataset.gdel; });
            Store.saveChild(c);
            toast('삭제되었습니다', 'ok');
            App.refresh();
          });
        };
      });

      // '내가 없을 때' 인수인계 작성/수정 모달
      var bh = UI.el('btn-handover');
      if (bh) bh.onclick = function () {
        var c = Store.getChild(p.id); if (!c) return;
        var h = c.handover || { caretakers: [], items: {}, note: '' };
        var ct1 = (h.caretakers || [])[0] || {}, ct2 = (h.caretakers || [])[1] || {};
        function ctRow(idx, v) {
          return '<div class="field-row">' +
            '<div class="field"><label>' + (idx + 1) + '순위 돌봄자</label>' +
              '<input class="input" data-hct="name' + idx + '" value="' + esc(v.name || '') +
              '" placeholder="이름"></div>' +
            '<div class="field"><label>관계</label>' +
              '<input class="input" data-hct="rel' + idx + '" value="' + esc(v.relation || '') +
              '" placeholder="예) 이모"></div>' +
            '<div class="field"><label>연락처</label>' +
              '<input class="input" data-hct="phone' + idx + '" value="' + esc(v.phone || '') +
              '" placeholder="010-…"></div></div>';
        }
        Modal.open({
          title: '내가 없을 때 — 돌봄 인수인계', icon: 'hand', wide: true,
          body:
            '<p class="muted mb-2" style="font-size:.88rem">모든 칸을 채울 필요 없어요. ' +
            '아는 것부터 한 줄씩 — 그 한 줄이 위기 상황의 큰 힘이 됩니다.</p>' +
            ctRow(0, ct1) + ctRow(1, ct2) +
            HANDOVER_FIELDS.map(function (f) {
              return '<div class="field"><label>' + esc(f.label) + '</label>' +
                '<input class="input" data-hitem="' + f.k + '" value="' +
                esc((h.items || {})[f.k] || '') + '" placeholder="' + esc(f.ph) + '"></div>';
            }).join('') +
            '<div class="field"><label>그 밖에 전하고 싶은 말</label>' +
              '<textarea class="textarea" id="h-note" ' +
              'placeholder="예) 무서워할 땐 기차 이야기를 꺼내 주세요. 우리 아이를 부탁합니다.">' +
              esc(h.note || '') + '</textarea></div>',
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '저장', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var cts = [];
            [0, 1].forEach(function (i) {
              var nm = root.querySelector('[data-hct="name' + i + '"]').value.trim();
              if (!nm) return;
              cts.push({ name: nm,
                relation: root.querySelector('[data-hct="rel' + i + '"]').value.trim(),
                phone: root.querySelector('[data-hct="phone' + i + '"]').value.trim() });
            });
            var items = {};
            HANDOVER_FIELDS.forEach(function (f) {
              var val = root.querySelector('[data-hitem="' + f.k + '"]').value.trim();
              if (val) items[f.k] = val;
            });
            c.handover = { caretakers: cts, items: items,
                           note: UI.el('h-note').value.trim() };
            Store.saveChild(c);
            toast('인수인계 노트가 저장되었습니다', 'ok');
            App.refresh();
          }
        });
      };

      var bv = UI.el('btn-verify');
      if (bv) bv.onclick = function () {
        Modal.open({
          title: '아이 정보 인증 요청', icon: 'shield',
          body: '<p class="muted mb-2" style="font-size:.9rem">복지카드 사본, 진단서 등 아이 정보를 ' +
            '확인할 수 있는 서류를 첨부해 주세요. 관리자 확인 후 인증이 완료됩니다.</p>' +
            '<div class="field"><label>제출 서류</label>' +
            '<input class="input" id="vf-docs" placeholder="예) 복지카드 사본, 진단서"></div>' +
            '<div class="pill-info">' + icon('info', 16) +
            '<div>1차 개발 기준: 양육자 본인이 아이 정보를 등록하고 서류 업로드 후 ' +
            '관리자가 인증하는 방식으로 진행됩니다.</div></div>',
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '인증 요청', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v) {
            if (v !== 'ok') return;
            var docs = UI.el('vf-docs').value.trim();
            child.verifyDocs = docs ? docs.split(',').map(function (x) { return x.trim(); }) : ['제출 서류'];
            child.verifyStatus = 'pending';
            Store.saveChild(child);
            toast('인증 요청이 접수되었습니다', 'ok');
            App.refresh();
          }
        });
      };
      UI.el('btn-del').onclick = function () {
        Modal.confirm({
          title: '아이 정보 삭제', danger: true,
          message: child.name + ' 아이의 프로필·설명서·기록이 모두 삭제됩니다.\n계속하시겠어요?',
          okLabel: '삭제'
        }).then(function (ok) {
          if (!ok) return;
          Store.deleteChild(p.id);
          toast('삭제되었습니다', 'ok');
          App.navigate('#/dashboard');
        });
      };
    }
  };

  /* =====================================================================
   * 아이 등록 / 수정
   * ===================================================================== */
  var DTYPE_LIST = [
    '자폐 스펙트럼 장애', '지적장애', '발달지연',
    '주의력결핍 과잉행동장애(ADHD)', '의사소통장애', '중복장애'
  ];
  var SENSORY_LIST = [
    '청각에 민감해요 (큰 소리)', '촉각에 민감해요 (접촉·질감)',
    '시각에 민감해요 (밝은 빛)', '미각·후각에 예민해요 (편식)',
    '감각 추구 행동이 있어요 (회전·점프 등)', '통증에 둔감한 편이에요'
  ];
  /* d.sensory 문자열 ↔ 칩 선택 직렬화: "칩, 칩\n메모" (예전 자유 입력은 메모로 처리) */
  function parseSensory(str) {
    var lines = String(str || '').split('\n');
    var first = (lines[0] || '').split(', ').filter(Boolean);
    var picked = first.filter(function (t) { return SENSORY_LIST.indexOf(t) >= 0; });
    if (first.length && picked.length === first.length) {
      return { picked: picked, memo: lines.slice(1).join('\n').trim() };
    }
    return { picked: [], memo: String(str || '').trim() };
  }
  function joinSensory(picked, memo) {
    var head = picked.join(', ');
    if (head && memo) return head + '\n' + memo;
    return head || memo || '';
  }

  V.childEdit = {
    layout: 'app',
    render: function (p) {
      var isNew = !p.id;
      var child;
      if (isNew) child = Store.emptyChild(Store.currentUser().id);
      else { child = ownedChild(p.id); if (!child) return notFound('아이 정보를 찾을 수 없어요'); }

      var d = child.disability;
      var medRows = child.medications.length
        ? child.medications.map(function (m) {
            return dynRow([
              { k: 'name', ph: '약 이름', flex: 1.2 }, { k: 'dose', ph: '용량' },
              { k: 'time', ph: '복용 시간' }, { k: 'note', ph: '메모', flex: 1.4 }
            ], m);
          }).join('')
        : '';
      var allgRows = child.allergies.length
        ? child.allergies.map(function (a) {
            return dynRow([
              { k: 'name', ph: '알레르기 항목', flex: 1.2 },
              { k: 'reaction', ph: '증상/반응', flex: 1.6 },
              { k: 'severity', type: 'select', opts: ['경증', '중등도', '중증'] }
            ], a);
          }).join('')
        : '';
      var ctRows = child.emergency.contacts.length
        ? child.emergency.contacts.map(function (c) {
            return dynRow([
              { k: 'name', ph: '이름' }, { k: 'relation', ph: '관계' },
              { k: 'phone', ph: '연락처', flex: 1.4 }
            ], c);
          }).join('')
        : '';

      return pageHead(isNew ? '아이 등록' : '아이 정보 수정',
          isNew ? '아이를 등록해 주세요' : child.name + ' 정보 수정',
          '입력한 정보는 설명서와 한 장 요약에 함께 활용됩니다.') +
        '<form id="child-form">' +
        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('user', 18) + '</span><h3>기본 정보</h3></div><div class="card-body">' +
          '<div class="row mb-2" style="gap:14px">' +
            '<div class="avatar xl" id="photo-prev">' + (child.photo
              ? '<img src="' + child.photo + '" alt="">' : esc(UI.initials(child.name) || '+')) + '</div>' +
            '<div><label class="btn btn-ghost btn-sm" style="cursor:pointer">' +
              icon('camera', 15) + '사진 선택<input type="file" id="photo-input" accept="image/*" hidden></label>' +
            '<p class="faint" style="font-size:.78rem;margin-top:6px">정사각형 이미지를 권장합니다.</p></div>' +
          '</div>' +
          '<div class="field"><label>이름 <span class="req">*</span></label>' +
            '<input class="input" name="name" required value="' + esc(child.name) + '"></div>' +
          '<div class="field-row">' +
            '<div class="field"><label>생년월일</label>' +
              '<input class="input" name="birthDate" type="date" value="' + esc(child.birthDate) + '"></div>' +
            '<div class="field"><label>성별</label><select class="select" name="gender">' +
              ['', '남', '여'].map(function (g) {
                return '<option' + (child.gender === g ? ' selected' : '') + '>' + g + '</option>';
              }).join('') + '</select></div>' +
          '</div>' +
          '<div class="field-row">' +
            '<div class="field"><label>키 (cm)</label>' +
              '<input class="input" name="bheight" type="number" inputmode="numeric" ' +
              'value="' + esc((child.body || {}).height || '') + '" placeholder="예) 120"></div>' +
            '<div class="field"><label>몸무게 (kg)</label>' +
              '<input class="input" name="bweight" type="number" inputmode="numeric" ' +
              'value="' + esc((child.body || {}).weight || '') + '" placeholder="예) 24"></div>' +
          '</div>' +
          '<div class="field-row">' +
            '<div class="field"><label>혈액형</label>' +
              '<select class="select" name="bblood">' +
              ['', 'A형', 'B형', 'O형', 'AB형', '모름'].map(function (b) {
                return '<option' + ((child.body || {}).bloodType === b ? ' selected' : '') + '>' +
                  b + '</option>';
              }).join('') + '</select></div>' +
            '<div class="field"><label>의류·신발 사이즈 <span class="faint">돌봄 인수인계 시 유용</span></label>' +
              '<input class="input" name="bsizes" value="' + esc((child.body || {}).sizes || '') + '" ' +
              'placeholder="예) 상의 130 · 신발 190"></div>' +
          '</div>' +
          '<div class="field"><label>인상착의·특징 <span class="faint">미아 등 위급 상황에서 아이를 찾는 단서가 돼요</span></label>' +
            '<input class="input" name="bfeatures" value="' + esc((child.body || {}).features || '') + '" ' +
            'placeholder="예) 왼쪽 눈썹 옆 흉터, 파란 기차 가방을 메고 다녀요"></div>' +
        '</div></div>' +

        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('help', 18) + '</span><h3>장애 특성</h3></div><div class="card-body">' +
          '<div class="field-row">' +
            '<div class="field"><label>장애 유형 <span class="faint">목록에서 고르거나 직접 입력</span></label>' +
              '<input class="input" name="dtype" list="dtype-list" value="' + esc(d.type) + '" ' +
                'placeholder="선택 또는 입력">' +
              '<datalist id="dtype-list">' + DTYPE_LIST.map(function (t) {
                return '<option value="' + esc(t) + '">';
              }).join('') + '</datalist></div>' +
            '<div class="field"><label>진단 시기</label>' +
              '<input class="input" name="ddate" type="month" value="' + esc(d.diagnosedAt) + '"></div>' +
          '</div>' +
          '<div class="field"><label>특성 요약</label>' +
            '<textarea class="textarea" name="dsummary" placeholder="아이의 전반적인 특성을 적어 주세요.">' +
            esc(d.summary) + '</textarea></div>' +
          '<div class="field"><label>감각 특성 <span class="faint">해당하는 항목을 모두 선택하세요</span></label>' +
            '<div class="chip-group" id="sensory-chips">' + (function () {
              var ps = parseSensory(d.sensory);
              return SENSORY_LIST.map(function (t) {
                return '<button type="button" class="chip pick' +
                  (ps.picked.indexOf(t) >= 0 ? ' on' : '') + '" data-sens="' + esc(t) + '">' +
                  esc(t) + '</button>';
              }).join('');
            })() + '</div>' +
            '<input class="input" name="dsensoryMemo" style="margin-top:9px" ' +
              'placeholder="그 밖의 감각 반응이 있다면 적어 주세요 (선택)" value="' +
              esc(parseSensory(d.sensory).memo) + '"></div>' +
        '</div></div>' +

        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('pill', 18) + '</span><h3>약물 정보</h3></div><div class="card-body">' +
          '<div id="med-rows">' + medRows + '</div>' +
          '<button type="button" class="btn btn-soft btn-sm" id="add-med">' +
            icon('plus', 15) + '약물 추가</button>' +
        '</div></div>' +

        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('alert', 18) + '</span><h3>알레르기</h3></div><div class="card-body">' +
          '<div id="allg-rows">' + allgRows + '</div>' +
          '<button type="button" class="btn btn-soft btn-sm" id="add-allg">' +
            icon('plus', 15) + '알레르기 추가</button>' +
        '</div></div>' +

        '<div class="card mb-2"><div class="card-head"><span style="color:var(--primary)">' +
          icon('shield', 18) + '</span><h3>응급 대응 정보</h3></div><div class="card-body">' +
          '<div class="field"><label>응급 상황 대응 절차</label>' +
            '<textarea class="textarea" name="eprotocol" placeholder="발작·자해 등 응급 상황 시 대처 방법">' +
            esc(child.emergency.protocol) + '</textarea></div>' +
          '<div class="field-row">' +
            '<div class="field"><label>주치 병원</label>' +
              '<input class="input" name="ehospital" value="' + esc(child.emergency.hospital) + '"></div>' +
            '<div class="field"><label>담당 의료진</label>' +
              '<input class="input" name="edoctor" value="' + esc(child.emergency.doctor) + '"></div>' +
          '</div>' +
          '<label class="field-label">비상 연락망</label>' +
          '<div id="ct-rows">' + ctRows + '</div>' +
          '<button type="button" class="btn btn-soft btn-sm" id="add-ct">' +
            icon('plus', 15) + '연락처 추가</button>' +
        '</div></div>' +

        '<div class="row" style="justify-content:flex-end;gap:10px;margin-top:18px">' +
          '<button type="button" class="btn btn-ghost" id="btn-cancel">취소</button>' +
          '<button type="submit" class="btn btn-primary btn-lg">' + icon('check', 17) +
            (isNew ? '아이 등록' : '저장') + '</button>' +
        '</div>' +
        '</form>';
    },
    mount: function (p) {
      var isNew = !p.id;
      var base = isNew ? Store.emptyChild(Store.currentUser().id) : ownedChild(p.id);
      if (!base) return;
      var photoData = base.photo || null;

      UI.el('photo-input').addEventListener('change', function (e) {
        var file = e.target.files[0]; if (!file) return;
        UI.fileToDataURL(file, 600, function (url) {
          if (!url) { toast('이미지를 불러오지 못했어요', 'err'); return; }
          photoData = url;
          UI.el('photo-prev').innerHTML = '<img src="' + url + '" alt="">';
        });
      });

      function bindAdd(btnId, rowsId, fields) {
        UI.el(btnId).onclick = function () {
          UI.el(rowsId).insertAdjacentHTML('beforeend', dynRow(fields, {}));
        };
      }
      bindAdd('add-med', 'med-rows', [
        { k: 'name', ph: '약 이름', flex: 1.2 }, { k: 'dose', ph: '용량' },
        { k: 'time', ph: '복용 시간' }, { k: 'note', ph: '메모', flex: 1.4 }
      ]);
      bindAdd('add-allg', 'allg-rows', [
        { k: 'name', ph: '알레르기 항목', flex: 1.2 },
        { k: 'reaction', ph: '증상/반응', flex: 1.6 },
        { k: 'severity', type: 'select', opts: ['경증', '중등도', '중증'] }
      ]);
      bindAdd('add-ct', 'ct-rows', [
        { k: 'name', ph: '이름' }, { k: 'relation', ph: '관계' },
        { k: 'phone', ph: '연락처', flex: 1.4 }
      ]);
      document.getElementById('child-form').addEventListener('click', function (e) {
        var del = e.target.closest('.dyn-del');
        if (del) del.closest('.dyn-row').remove();
        // 감각 특성 칩 토글
        var sens = e.target.closest('[data-sens]');
        if (sens) sens.classList.toggle('on');
      });

      UI.el('btn-cancel').onclick = function () {
        App.navigate(isNew ? '#/dashboard' : '#/child/' + p.id);
      };

      UI.el('child-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        if (!f.name) { toast('이름을 입력해 주세요.', 'err'); return; }
        base.name = f.name;
        base.birthDate = f.birthDate;
        base.gender = f.gender;
        base.photo = photoData;
        base.body = { height: f.bheight, weight: f.bweight,
                      bloodType: f.bblood, sizes: f.bsizes, features: f.bfeatures };
        var picked = [].map.call(
          document.querySelectorAll('#sensory-chips .chip.on'),
          function (c) { return c.dataset.sens; });
        base.disability = {
          type: f.dtype || '자폐 스펙트럼 장애', diagnosedAt: f.ddate,
          summary: f.dsummary, sensory: joinSensory(picked, f.dsensoryMemo)
        };
        base.medications = readRows(UI.el('med-rows'), ['name', 'dose', 'time', 'note']);
        base.allergies = readRows(UI.el('allg-rows'), ['name', 'reaction', 'severity']);
        base.emergency = {
          protocol: f.eprotocol, hospital: f.ehospital, doctor: f.edoctor,
          contacts: readRows(UI.el('ct-rows'), ['name', 'relation', 'phone'])
        };
        Store.saveChild(base);
        toast(isNew ? '아이가 등록되었습니다' : '저장되었습니다', 'ok');
        App.navigate(isNew ? '#/manual/' + base.id : '#/child/' + base.id);
      });
    }
  };

  /* =====================================================================
   * 설명서 편집
   * ===================================================================== */
  function tabMeta(tab) {
    if (tab.id === 'likeDislike') {
      return { label: tab.label, icon: tab.icon, color: tab.color };
    }
    var m = MSEC[tab.id];
    return { label: m.label, icon: m.icon, color: m.color };
  }
  function tabCount(manual, tabId) {
    var s = manual.sections;
    if (tabId === 'likeDislike') return s.like.length + s.dislike.length;
    return s[tabId].length;
  }

  function listSection(manual, key) {
    var meta = MSEC[key];
    var items = manual.sections[key];
    var rows = items.length
      ? items.map(function (it) {
          return '<div class="item-row">' +
            '<span class="bullet" style="background:' + meta.color + '">' + icon('check', 12) + '</span>' +
            '<div class="txt">' + esc(it.text) + '</div>' +
            '<div class="item-actions">' +
              '<button class="btn-icon" data-edit="' + key + ':' + it.id + '">' + icon('edit', 15) + '</button>' +
              '<button class="btn-icon" data-del="' + key + ':' + it.id + '">' + icon('trash', 15) + '</button>' +
            '</div></div>';
        }).join('')
      : '<p class="muted" style="font-size:.9rem;padding:8px 0">아직 작성한 내용이 없어요. 아래에 추가해 보세요.</p>';
    return '<div class="card card-pad" style="margin-bottom:14px">' +
      '<div class="sec-head mb-2">' +
        '<span class="sec-ico" style="background:' + meta.bg + ';color:' + meta.color + '">' +
          icon(meta.icon, 22) + '</span>' +
        '<div><h2>' + esc(meta.label) + '</h2><p>' + esc(meta.desc) + '</p></div></div>' +
      rows +
      quickChips(manual, key) +
      '<div class="add-item">' +
        '<input class="input" data-add="' + key + '" placeholder="' + esc(meta.ph) + '">' +
        '<button class="btn btn-icon voice-btn" data-voice-for="' + key + '" ' +
        'aria-label="음성 입력">' + icon('mic', 17) + '</button>' +
        '<button class="btn btn-soft" data-addbtn="' + key + '">' + icon('plus', 15) + '추가</button>' +
      '</div></div>';
  }

  function intensityBadge(level) {
    if (!level) return '';
    var cls = level === '높음' ? 'danger' : level === '낮음' ? 'ok' : 'warn';
    return ' <span class="badge ' + cls + '">강도 ' + esc(level) + '</span>';
  }
  function problemSection(manual) {
    var meta = MSEC.problem;
    var items = manual.sections.problem;
    var rows = items.length
      ? items.map(function (it) {
          return '<div class="card card-pad" style="margin-bottom:10px;background:var(--surface-2)">' +
            '<div class="row between" style="align-items:flex-start">' +
              '<div style="flex:1">' +
                '<div style="font-weight:700;font-size:.95rem">' +
                  '<span style="color:' + meta.color + '">상황</span> · ' + esc(it.situation) +
                  intensityBadge(it.intensity) + '</div>' +
                '<div class="muted" style="font-size:.9rem;margin-top:5px">' +
                  '<b style="color:var(--primary-dark)">이렇게 대응해요</b> · ' + esc(it.response) + '</div>' +
              '</div>' +
              '<div class="row gap-sm">' +
                '<button class="btn-icon" data-pedit="' + it.id + '">' + icon('edit', 15) + '</button>' +
                '<button class="btn-icon" data-pdel="' + it.id + '">' + icon('trash', 15) + '</button>' +
              '</div></div></div>';
        }).join('')
      : '<p class="muted" style="font-size:.9rem;padding:8px 0">' +
        '특정 상황에서 아이가 보이는 행동과, 그때의 대처 방법을 적어 보세요.</p>';
    return '<div class="card card-pad" style="margin-bottom:14px">' +
      '<div class="sec-head mb-2">' +
        '<span class="sec-ico" style="background:' + meta.bg + ';color:' + meta.color + '">' +
          icon(meta.icon, 22) + '</span>' +
        '<div><h2>' + esc(meta.label) + '</h2><p>' + esc(meta.desc) + '</p></div></div>' +
      rows +
      '<button class="btn btn-soft" id="add-problem" style="margin-top:8px">' +
        icon('plus', 15) + '상황별 대응 추가</button></div>';
  }

  function panelHTML(manual, tabId) {
    if (tabId === 'likeDislike') return listSection(manual, 'like') + listSection(manual, 'dislike');
    if (tabId === 'problem') return problemSection(manual);
    return listSection(manual, tabId);
  }

  V.manual = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var manual = Store.getManual(child.id) || Store.saveManual(Store.emptyManual(child.id));
      var total = manualCount(manual);

      var tabs = MTABS.map(function (t) {
        var m = tabMeta(t);
        var n = tabCount(manual, t.id);
        return '<button class="manual-tab' + (S.manualTab === t.id ? ' active' : '') +
          '" data-tab="' + t.id + '">' +
          '<span class="dot" style="background:' + m.color + '"></span>' +
          esc(m.label) + '<span class="num">' + n + '</span></button>';
      }).join('');

      return childContextBar(child, 'manual') +
        pageHead('설명서', child.name + ' 설명서',
          '우리 아이를 처음 만나는 사람도 이해할 수 있도록 적어 주세요.',
          '<button class="btn btn-soft btn-sm" id="btn-toggle-preview">' +
            icon('eye', 15) + '미리보기</button>') +

        '<div class="manual-layout' + (S.manualPreview ? ' show-preview' : '') + '">' +
        '<div class="manual-edit">' +

        '<div class="card card-pad mb-2">' +
          '<label class="field-label">' + icon('sparkle', 15) + ' 우리 아이 한 줄 소개</label>' +
          '<input class="input" id="summary-note" maxlength="100" ' +
            'placeholder="예) 준호는 예측 가능한 환경에서 가장 빛나는 아이예요." ' +
            'value="' + esc(manual.summaryNote) + '">' +
          '<div class="row between mt-1" style="gap:10px;flex-wrap:wrap">' +
            '<span class="faint" style="font-size:.8rem">짧을수록 한눈에 들어와요 — ' +
              '대시보드·한 장 요약·공유 화면 맨 위에 표시됩니다.</span>' +
            '<span class="row gap-sm" style="align-items:center">' +
              '<span class="char-count" id="note-count"></span>' +
              '<button class="btn btn-soft btn-sm" id="save-note">' + icon('check', 14) +
                '소개글 저장</button></span>' +
          '</div></div>' +

        '<div class="card card-pad mb-2">' +
          '<label class="field-label">' + icon('heart', 15) + ' 보호자 한마디</label>' +
          '<textarea class="textarea" id="parent-note" rows="2" ' +
            'placeholder="우리 아이를 만나는 분께 꼭 전하고 싶은 말을 적어 주세요.">' +
            esc(manual.parentNote || '') + '</textarea>' +
          '<div class="row between mt-1" style="gap:10px;flex-wrap:wrap">' +
            '<span class="faint" style="font-size:.8rem">설명서 맨 끝에 ‘보호자 한마디’로 담깁니다 — 모든 기관용 공통 항목.</span>' +
            '<button class="btn btn-soft btn-sm" id="save-parent-note">' + icon('check', 14) +
              '한마디 저장</button>' +
          '</div></div>' +

        '<div class="card card-pad mb-2" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
          '<div style="flex:1;min-width:160px">' +
            '<b>작성 현황</b> <span class="muted" style="font-size:.88rem">총 ' + total + '개 항목</span>' +
            '<div style="height:8px;background:var(--surface-2);border-radius:99px;margin-top:7px;overflow:hidden">' +
              '<div style="height:100%;width:' + Math.min(100, total * 5) +
              '%;background:var(--primary);border-radius:99px"></div></div>' +
          '</div>' +
          '<span class="badge ' + (total >= 10 ? 'ok' : '') + '">' +
            (total >= 20 ? '풍성하게 작성됐어요' : total >= 10 ? '잘 작성되고 있어요' : '조금 더 적어 볼까요') +
          '</span>' +
        '</div>' +

        '<div class="manual-tabs">' + tabs + '</div>' +
        '<div id="manual-panel">' + panelHTML(manual, S.manualTab) + '</div>' +
        '</div>' +
        '<aside class="manual-preview-pane">' +
          '<div class="mp-head"><span>' + icon('eye', 15) + ' 미리보기</span>' +
            '<a class="btn btn-ghost btn-sm" href="#/summary/' + child.id + '">' +
              icon('print', 14) + '한 장 요약</a></div>' +
          '<div class="mp-scroll">' + V._summarySheet(child, manual, { scope: 'full' }) + '</div>' +
        '</aside>' +
        '</div>';
    },
    mount: function (p) {
      var child = ownedChild(p.childId); if (!child) return;
      var manual = Store.getManual(child.id);

      var togBtn = UI.el('btn-toggle-preview');
      if (togBtn) togBtn.onclick = function () {
        S.manualPreview = !S.manualPreview;
        var lay = document.querySelector('.manual-layout');
        if (lay) lay.classList.toggle('show-preview', S.manualPreview);
        togBtn.classList.toggle('active', S.manualPreview);
      };

      // 한 줄 소개 — 글자수 카운터 + 저장 (한글 IME는 maxlength를 우회하므로 직접 제한)
      var NOTE_LIMIT = 100;
      var noteInp = UI.el('summary-note'), noteCnt = UI.el('note-count');
      function capNote() {
        if (noteInp.value.length > NOTE_LIMIT) noteInp.value = noteInp.value.slice(0, NOTE_LIMIT);
      }
      function syncNoteCount() {
        var n = noteInp.value.length;
        noteCnt.textContent = n + '/' + NOTE_LIMIT;
        noteCnt.className = 'char-count' + (n >= NOTE_LIMIT - 10 ? ' warn' : '');
      }
      syncNoteCount();
      noteInp.addEventListener('input', syncNoteCount);
      // 조합(한글) 완료·포커스 아웃 시 한도 보정 — 조합 중 자르면 입력이 깨져서 이 시점에만
      noteInp.addEventListener('compositionend', function () { capNote(); syncNoteCount(); });
      noteInp.addEventListener('blur', function () { capNote(); syncNoteCount(); });
      UI.el('save-note').onclick = function () {
        capNote();
        manual.summaryNote = noteInp.value.trim();
        Store.saveManual(manual);
        toast('소개글이 저장되었습니다', 'ok');
      };

      // 보호자 한마디 저장
      var pn = UI.el('save-parent-note');
      if (pn) pn.onclick = function () {
        manual.parentNote = UI.el('parent-note').value.trim();
        Store.saveManual(manual);
        toast('보호자 한마디가 저장되었습니다', 'ok');
      };

      // 탭 전환
      document.querySelectorAll('[data-tab]').forEach(function (b) {
        b.onclick = function () { S.manualTab = b.dataset.tab; App.refresh(); };
      });

      // 단순 목록 추가 (refocus=false 면 입력창 포커스 안 함 — 칩 연속 탭용)
      function addItem(key, text, refocus) {
        if (!text) return;
        manual.sections[key].push({ id: Store.uid('it'), text: text });
        Store.saveManual(manual);
        S.focusAdd = refocus === false ? null : key;
        App.refresh();
      }
      document.querySelectorAll('[data-addbtn]').forEach(function (b) {
        b.onclick = function () {
          var key = b.dataset.addbtn;
          var inp = document.querySelector('[data-add="' + key + '"]');
          addItem(key, inp.value.trim());
        };
      });
      // 빠른 입력 칩 — 탭 한 번으로 항목 추가 (6/10 회의: 입력 부담 최소화)
      document.querySelectorAll('[data-qadd]').forEach(function (b) {
        b.onclick = function () {
          addItem(b.dataset.qadd, b.dataset.qtext, false);
          toast('추가되었습니다 — 내용은 언제든 수정할 수 있어요', 'ok');
        };
      });
      // 음성 입력 버튼을 각 add-item 인풋에 연결
      document.querySelectorAll('[data-voice-for]').forEach(function (b) {
        var inp = document.querySelector('[data-add="' + b.dataset.voiceFor + '"]');
        if (inp) UI.attachVoiceInput(b, inp);
      });
      document.querySelectorAll('[data-add]').forEach(function (inp) {
        inp.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); addItem(inp.dataset.add, inp.value.trim()); }
        });
      });

      // 항목 수정 / 삭제
      document.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = function () {
          var parts = b.dataset.edit.split(':'), key = parts[0], id = parts[1];
          var it = manual.sections[key].filter(function (x) { return x.id === id; })[0];
          if (!it) return;
          Modal.open({
            title: '내용 수정', icon: 'edit',
            body: '<div class="field"><label>' + esc(MSEC[key].label) + '</label>' +
              '<textarea class="textarea" id="ed-text">' + esc(it.text) + '</textarea></div>',
            buttons: [
              { label: '취소', value: 'cancel', variant: 'ghost' },
              { label: '저장', value: 'ok', variant: 'primary' }
            ],
            onButton: function (v) {
              if (v !== 'ok') return;
              var t = UI.el('ed-text').value.trim();
              if (!t) { toast('내용을 입력해 주세요', 'err'); return 'keep'; }
              it.text = t; Store.saveManual(manual); toast('수정되었습니다', 'ok'); App.refresh();
            }
          });
        };
      });
      document.querySelectorAll('[data-del]').forEach(function (b) {
        b.onclick = function () {
          var parts = b.dataset.del.split(':'), key = parts[0], id = parts[1];
          Modal.confirm({ title: '항목 삭제', message: '이 항목을 삭제할까요?', okLabel: '삭제', danger: true })
            .then(function (ok) {
              if (!ok) return;
              manual.sections[key] = manual.sections[key].filter(function (x) { return x.id !== id; });
              Store.saveManual(manual); toast('삭제되었습니다', 'ok'); App.refresh();
            });
        };
      });

      // 문제 행동 대응 추가/수정 — 드롭다운·강도·추천 칩 구조화 입력 (6/10 회의 반영)
      function problemModal(existing) {
        var CUSTOM = '__custom__';
        var curSit = existing ? existing.situation : '';
        var isPreset = PROBLEM_SITS.indexOf(curSit) >= 0;
        var curInt = (existing && existing.intensity) || '중간';

        var sitOpts = PROBLEM_SITS.map(function (s) {
          return '<option value="' + esc(s) + '"' + (curSit === s ? ' selected' : '') + '>' +
            esc(s) + '</option>';
        }).join('') +
          '<option value="' + CUSTOM + '"' + (!isPreset && curSit ? ' selected' : '') +
          '>직접 입력할게요…</option>';

        Modal.open({
          title: existing ? '상황별 대응 수정' : '상황별 대응 추가', icon: 'shield',
          body:
            '<div class="field"><label>어떤 상황인가요? <span class="faint">목록에서 고르면 돼요</span></label>' +
              '<select class="select" id="pb-sit-sel">' +
                (curSit ? '' : '<option value="" selected disabled>상황을 선택해 주세요</option>') +
                sitOpts + '</select></div>' +
            '<div class="field" id="pb-sit-custom-wrap" style="display:' +
              (!isPreset && curSit ? 'block' : 'none') + '">' +
              '<div style="display:flex;gap:6px;align-items:center">' +
                '<input class="input" id="pb-sit" style="flex:1" ' +
                  'placeholder="예) 큰 소음에 노출되어 귀를 막을 때" value="' +
                  esc(!isPreset ? curSit : '') + '">' +
                '<button type="button" class="btn btn-icon voice-btn" data-voice-id="pb-sit" ' +
                'aria-label="음성 입력">' + icon('mic', 17) + '</button>' +
              '</div></div>' +
            '<div class="field"><label>행동의 강도</label>' +
              '<div class="seg" id="pb-int">' +
                ['낮음', '중간', '높음'].map(function (l) {
                  return '<button type="button" data-int="' + l + '"' +
                    (curInt === l ? ' class="on"' : '') + '>' + l + '</button>';
                }).join('') + '</div></div>' +
            '<div class="field"><label>이렇게 대응해요</label>' +
            '<div style="display:flex;gap:6px;align-items:flex-start">' +
              '<textarea class="textarea" id="pb-res" style="flex:1" placeholder="예) 조용한 공간으로 이동해 진정될 때까지 기다려 주세요">' +
              esc(existing ? existing.response : '') + '</textarea>' +
              '<button type="button" class="btn btn-icon voice-btn" data-voice-id="pb-res" ' +
              'aria-label="음성 입력">' + icon('mic', 17) + '</button>' +
            '</div>' +
            '<div class="quick-wrap" style="margin-top:9px"><div class="quick-cap">' +
              icon('sparkle', 13) + '추천 대응 — 탭하면 입력돼요</div>' +
              '<div class="quick-chips">' + PROBLEM_RES.map(function (r) {
                return '<button type="button" class="chip quick" data-res="' + esc(r) +
                  '"><b>+</b>' + esc(r) + '</button>';
              }).join('') + '</div></div></div>',
          onMount: function (root) {
            root.querySelectorAll('[data-voice-id]').forEach(function (b) {
              var t = root.querySelector('#' + b.dataset.voiceId);
              if (t) UI.attachVoiceInput(b, t);
            });
            // 상황: '직접 입력' 선택 시에만 입력칸 표시
            var sel = root.querySelector('#pb-sit-sel');
            sel.addEventListener('change', function () {
              root.querySelector('#pb-sit-custom-wrap').style.display =
                sel.value === CUSTOM ? 'block' : 'none';
              if (sel.value === CUSTOM) root.querySelector('#pb-sit').focus();
            });
            // 강도 세그먼트
            root.querySelectorAll('#pb-int button').forEach(function (b) {
              b.onclick = function () {
                root.querySelectorAll('#pb-int button').forEach(function (x) {
                  x.classList.remove('on');
                });
                b.classList.add('on');
              };
            });
            // 추천 대응 칩 → 대응란에 채우기 (이미 내용이 있으면 줄바꿈으로 덧붙임)
            var res = root.querySelector('#pb-res');
            root.querySelectorAll('[data-res]').forEach(function (b) {
              b.onclick = function () {
                var t = b.dataset.res;
                res.value = res.value.trim() ? res.value.trim() + '\n' + t : t;
                res.focus();
              };
            });
          },
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '저장', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var selV = root.querySelector('#pb-sit-sel').value;
            var sit = selV === CUSTOM ? UI.el('pb-sit').value.trim() : (selV || '').trim();
            var res = UI.el('pb-res').value.trim();
            var intBtn = root.querySelector('#pb-int button.on');
            var intensity = intBtn ? intBtn.dataset.int : '중간';
            if (!sit || !res) { toast('상황과 대응 방법을 모두 입력해 주세요', 'err'); return 'keep'; }
            if (existing) {
              existing.situation = sit; existing.response = res; existing.intensity = intensity;
            } else {
              manual.sections.problem.push({
                id: Store.uid('pb'), situation: sit, response: res, intensity: intensity
              });
            }
            Store.saveManual(manual); toast('저장되었습니다', 'ok'); App.refresh();
          }
        });
      }
      var addP = UI.el('add-problem');
      if (addP) addP.onclick = function () { problemModal(null); };
      document.querySelectorAll('[data-pedit]').forEach(function (b) {
        b.onclick = function () {
          var it = manual.sections.problem.filter(function (x) { return x.id === b.dataset.pedit; })[0];
          if (it) problemModal(it);
        };
      });
      document.querySelectorAll('[data-pdel]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '삭제', message: '이 대응 항목을 삭제할까요?', okLabel: '삭제', danger: true })
            .then(function (ok) {
              if (!ok) return;
              manual.sections.problem = manual.sections.problem.filter(function (x) {
                return x.id !== b.dataset.pdel;
              });
              Store.saveManual(manual); toast('삭제되었습니다', 'ok'); App.refresh();
            });
        };
      });

      // 추가 후 입력창 포커스
      if (S.focusAdd) {
        var fi = document.querySelector('[data-add="' + S.focusAdd + '"]');
        if (fi) fi.focus();
        S.focusAdd = null;
      }
    }
  };

  /* =====================================================================
   * 한 장 요약 (서포트북) — 보기 + 출력 + 공유
   * ===================================================================== */
  function summaryBlock(label, color, items, isProblem) {
    if (!items.length) return '';
    var body;
    if (isProblem) {
      body = '<ul>' + items.map(function (it) {
        return '<li class="prob-li"><b>' + esc(it.situation) + '</b>' +
          (it.intensity ? ' <span class="faint" style="font-size:.82em">(강도 ' +
            esc(it.intensity) + ')</span>' : '') +
          '<br>→ ' + nl2br(it.response) + '</li>';
      }).join('') + '</ul>';
    } else {
      body = '<ul>' + items.map(function (it) {
        return '<li>' + esc(it.text || it) + '</li>';
      }).join('') + '</ul>';
    }
    return '<div class="summary-block">' +
      '<div class="blk-title"><span class="dot" style="background:' + color + '"></span>' +
      esc(label) + '</div>' + body + '</div>';
  }

  /* 안심번호 — 공유 토큰 기반 가상 050 번호 (실서비스: 통신사 안심번호 연동) */
  function safePhone(token, i) {
    var s = String(token || '') + ':' + i, h = 0;
    for (var k = 0; k < s.length; k++) h = (h * 31 + s.charCodeAt(k)) >>> 0;
    var a = 1000 + (h % 9000);
    var b = 1000 + (Math.floor(h / 9000) % 9000);
    return '0508-' + a + '-' + b;
  }

  /* 응급 정보 우선 블록 — 비상연락·인상착의·알레르기·응급대응을 맨 위에 (6/10 회의 반영)
     opts.safe=true 면 연락처를 안심번호(050)로 표시 (opts.token 필요) */
  function emergencyBlock(child, opts) {
    opts = opts || {};
    var e = child.emergency || {};
    var body = child.body || {};
    var items = '';
    (e.contacts || []).forEach(function (c, ci) {
      var phone = opts.safe ? safePhone(opts.token, ci) : c.phone;
      var telHref = String(phone || '').replace(/[^0-9+]/g, '');
      items += '<li><span class="em-k">비상 연락</span><b>' + esc(c.name) + '</b>' +
        (c.relation ? ' (' + esc(c.relation) + ')' : '') + ' · ' +
        (telHref ? '<a class="tel" href="tel:' + esc(telHref) + '">' + esc(phone) + '</a>'
                 : esc(phone)) +
        (opts.safe ? ' <span class="badge ok" style="font-size:.66rem;vertical-align:1px">안심번호</span>' : '') +
        '</li>';
    });
    if (body.height || body.weight || body.features || body.sizes) {
      var phys = [];
      if (body.height) phys.push('키 ' + esc(body.height) + 'cm');
      if (body.weight) phys.push(esc(body.weight) + 'kg');
      if (body.sizes) phys.push(esc(body.sizes));
      items += '<li><span class="em-k">인상착의</span>' + phys.join(' · ') +
        (body.features ? (phys.length ? ' — ' : '') + esc(body.features) : '') + '</li>';
    }
    if (body.bloodType && body.bloodType !== '모름') {
      items += '<li><span class="em-k">혈액형</span>' + esc(body.bloodType) + '</li>';
    }
    (child.allergies || []).forEach(function (a) {
      items += '<li><span class="em-k">알레르기</span><b>' + esc(a.name) + '</b> (' +
        esc(a.severity || '경증') + ')' +
        (a.reaction ? ' — ' + esc(a.reaction) : '') + '</li>';
    });
    if (e.protocol) items += '<li><span class="em-k">응급 대응</span>' + nl2br(e.protocol) + '</li>';
    if (e.hospital) {
      items += '<li><span class="em-k">주치 병원</span>' + esc(e.hospital) +
        (e.doctor ? ' · ' + esc(e.doctor) : '') + '</li>';
    }
    if (!items) return '';
    return '<div class="summary-emergency"><div class="em-title">' + icon('shield', 17) +
      '응급 시 가장 먼저 확인하세요</div><ul>' + items + '</ul>' +
      (opts.safe
        ? '<div class="em-safenote">' + icon('lock', 12) +
          ' 연락처는 보호자 보호를 위해 안심번호(050)로 표시됩니다.</div>'
        : '') +
      '</div>';
  }

  /* opts.scope: 'emergency'(응급 카드) | 'summary'(요약) | 'full'(전체 — 복약 포함) */
  /* ---------- 대상별 「내 아이 설명서」 (메일 최우선 차별화) ----------
     같은 데이터를 대상에 맞는 섹션만 골라 한 장으로 — 반복 설명 부담 해소 */
  /* 대상별 우선순위·순서는 양육자 자문회의 확정안(기관별 구성항목 표)을 따른다.
     intro = 기관별 '핵심 질문'(자문안) + 목적. */
  var AUDIENCES = {
    school: { label: '학교용', short: '학교', icon: 'school', color: 'var(--brand-connect)',
      purpose: '학교 적응 및 학습 지원',
      intro: '“선생님이 우리 아이를 가장 빨리 이해하려면?” — 학교 적응·학습 지원을 위한 안내입니다.',
      blocks: ['comm', 'sensory', 'likeDislike', 'problem', 'canDo', 'needHelp', 'health'] },
    hospital: { label: '병원용', short: '병원', icon: 'hospital', color: 'var(--brand-grow)',
      purpose: '진료 및 건강관리 지원',
      intro: '“의사가 진료 전에 무엇을 알면 좋을까?” — 진료·건강관리 지원을 위한 안내입니다.',
      blocks: ['diagnosis', 'meds', 'history', 'problem', 'comm', 'parentNote'] },
    support: { label: '활동지원사용', short: '활동지원', icon: 'user', color: 'var(--brand-understand)',
      purpose: '일상생활 지원',
      intro: '“활동지원사가 처음 만났을 때 무엇을 알아야 할까?” — 일상생활 지원을 위한 안내입니다.',
      blocks: ['comm', 'problem', 'routine', 'safety', 'sensory', 'needHelp', 'handover'] },
    care: { label: '돌봄기관용', short: '돌봄기관', icon: 'users', color: 'var(--primary)',
      purpose: '프로그램 참여 지원',
      intro: '“복지관·주간보호센터 담당자가 시행착오 없이 지원하려면?” — 프로그램 참여 지원을 위한 안내입니다.',
      blocks: ['likeDislike', 'comm', 'sensory', 'problem', 'canDo', 'health', 'parentNote'] }
  };
  V._AUDIENCES = AUDIENCES;

  function medsBlock(child) {
    if (!child.medications || !child.medications.length) return '';
    var med = '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--c-comm)"></span>복용 약물</div><ul>';
    child.medications.forEach(function (m) {
      med += '<li>' + esc(m.name) + ' ' + esc(m.dose || '') +
        (m.time ? ' · ' + esc(m.time) : '') + (m.note ? ' — ' + esc(m.note) : '') + '</li>';
    });
    return med + '</ul></div>';
  }
  /* 진단 정보 — 진단명·진단시기·특성 요약 */
  function diagnosisBlock(child) {
    var d = child.disability || {};
    if (!d.type && !d.diagnosedAt && !d.summary) return '';
    var li = '';
    if (d.type) li += '<li><b>진단명</b> · ' + esc(d.type) + '</li>';
    if (d.diagnosedAt) li += '<li><b>진단 시기</b> · ' + esc(d.diagnosedAt) + '</li>';
    if (d.summary) li += '<li><b>특성 요약</b> · ' + nl2br(d.summary) + '</li>';
    return '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--brand-trust)"></span>진단 정보</div><ul>' + li + '</ul></div>';
  }
  /* 감각 특성 — 청각·시각·촉각 등 (프로필의 감각 특성 데이터) */
  function sensoryBlock(child) {
    var sv = (child.disability || {}).sensory;
    if (!sv) return '';
    return '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--brand-understand)"></span>감각 특성</div>' +
      '<ul><li>' + nl2br(sv) + '</li></ul></div>';
  }
  /* 건강 정보 — 주치 병원 + 복용 약물 요약 (알레르기·응급은 상단 안전 블록에 포함) */
  function healthBlock(child) {
    var e = child.emergency || {};
    var li = '';
    if (e.hospital) li += '<li><b>주치 병원</b> · ' + esc(e.hospital) +
      (e.doctor ? ' · ' + esc(e.doctor) : '') + '</li>';
    (child.medications || []).forEach(function (m) {
      li += '<li><b>복약</b> · ' + esc(m.name) + ' ' + esc(m.dose || '') +
        (m.time ? ' · ' + esc(m.time) : '') + '</li>';
    });
    if (!li) return '';
    return '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--brand-grow)"></span>건강 정보</div><ul>' + li + '</ul></div>';
  }
  /* 병력 및 치료 이력 — 치료·검사 기록에서 자동 집계 */
  function historyBlock(child) {
    var recs = (Store.recordsOf(child.id) || []).filter(function (r) {
      return r.type === 'treatment' || r.type === 'assessment';
    }).slice(0, 6);
    if (!recs.length) return '';
    var li = recs.map(function (r) {
      return '<li>' + UI.fmtDate(r.date) + ' · ' + esc(r.title) + '</li>';
    }).join('');
    return '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--c-comm)"></span>병력 및 치료 이력</div><ul>' + li + '</ul></div>';
  }
  /* 보호자 한마디 — 보호자가 꼭 전달하고 싶은 내용 */
  function parentNoteBlock(manual) {
    if (!manual.parentNote) return '';
    return '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--accent)"></span>보호자 한마디</div>' +
      '<ul><li>' + nl2br(manual.parentNote) + '</li></ul></div>';
  }
  function handoverBlock(child) {
    if (!handoverFilled(child.handover)) return '';
    var h = child.handover;
    var ho = '<div class="summary-block"><div class="blk-title">' +
      '<span class="dot" style="background:var(--brand-understand)"></span>' +
      '돌봄 인수인계 (내가 없을 때)</div><ul>';
    (h.caretakers || []).forEach(function (c) {
      if (!c.name) return;
      ho += '<li><b>대신 돌봐줄 사람</b> · ' + esc(c.name) +
        (c.relation ? ' (' + esc(c.relation) + ')' : '') +
        (c.phone ? ' · ' + esc(c.phone) : '') + '</li>';
    });
    HANDOVER_FIELDS.forEach(function (f) {
      var val = (h.items || {})[f.k];
      if (val) ho += '<li><b>' + esc(f.label) + '</b> · ' + esc(val) + '</li>';
    });
    if (h.note) ho += '<li><b>전하는 말</b> · ' + esc(h.note) + '</li>';
    return ho + '</ul></div>';
  }
  function likeDislikeBlock(s) {
    if (!s.like.length && !s.dislike.length) return '';
    return '<div class="summary-cols">' +
      '<div>' + (summaryBlock('좋아해요', 'var(--c-like)', s.like) ||
        '<div class="summary-block"><div class="blk-title"><span class="dot" style="background:var(--c-like)"></span>좋아해요</div><p class="faint" style="font-size:.85rem">-</p></div>') + '</div>' +
      '<div>' + (summaryBlock('싫어해요', 'var(--c-dislike)', s.dislike) ||
        '<div class="summary-block"><div class="blk-title"><span class="dot" style="background:var(--c-dislike)"></span>싫어해요</div><p class="faint" style="font-size:.85rem">-</p></div>') + '</div>' +
    '</div>';
  }
  function renderBlock(key, child, manual) {
    var s = manual.sections;
    switch (key) {
      case 'canDo':       return summaryBlock('할 수 있어요', 'var(--c-cando)', s.canDo);
      case 'needHelp':    return summaryBlock('도움이 필요해요', 'var(--c-help)', s.needHelp);
      case 'likeDislike': return likeDislikeBlock(s);
      case 'problem':     return summaryBlock('도전적 행동 및 대응 방법', 'var(--c-problem)', s.problem, true);
      case 'safety':      return summaryBlock('안전 주의사항', 'var(--c-safety)', s.safety || []);
      case 'comm':        return summaryBlock('의사소통 방법', 'var(--c-comm)', s.comm);
      case 'routine':     return summaryBlock('생활 루틴', 'var(--c-routine)', s.routine || []);
      case 'meds':        return medsBlock(child);
      case 'handover':    return handoverBlock(child);
      case 'diagnosis':   return diagnosisBlock(child);
      case 'sensory':     return sensoryBlock(child);
      case 'health':      return healthBlock(child);
      case 'history':     return historyBlock(child);
      case 'parentNote':  return parentNoteBlock(manual);
      default:            return '';
    }
  }

  /* opts: { audience } 대상별 / 또는 { scope:'emergency'|'summary'|'full' } 레거시
     공통: { safe, token } 안심번호 */
  V._summarySheet = function (child, manual, opts) {
    opts = opts || {};
    var scope = opts.scope || 'summary';
    var aud = opts.audience ? AUDIENCES[opts.audience] : null;
    var age = UI.calcAge(child.birthDate);
    var s = manual.sections;
    var sheet = '<div class="summary-sheet">' +
      '<div class="sheet-top"' + (aud ? ' style="--aud:' + aud.color + '"' : '') + '>' +
        '<div class="avatar lg">' + (child.photo
          ? '<img src="' + child.photo + '" alt="">' : esc(UI.initials(child.name))) + '</div>' +
        '<div><h2>' + esc(child.name) + ' 설명서</h2>' +
        '<div class="sub">' + (age != null ? '만 ' + age + '세 · ' : '') +
          esc(child.gender || '') + ' · ' + esc(child.disability.type || '') + '</div></div>' +
        '<div class="brand-tag">' + (aud ? esc(aud.label) : 'ASTROGEN') + '</div>' +
      '</div><div class="sheet-body">';

    if (aud) {
      sheet += '<div class="aud-intro">' + icon(aud.icon, 15) + ' <b>' + esc(aud.label) +
        ' 설명서</b> · ' + esc(aud.intro) + '</div>';
    }
    if (manual.summaryNote) {
      sheet += '<div class="summary-note">' + icon('sparkle', 15) + ' ' + esc(manual.summaryNote) + '</div>';
    }
    // 응급 정보는 항상 맨 위 (6/10 회의: 비상연락망 상단 배치)
    sheet += emergencyBlock(child, { safe: !!opts.safe, token: opts.token });

    if (aud) {
      aud.blocks.forEach(function (k) { sheet += renderBlock(k, child, manual); });
    } else if (scope === 'emergency') {
      sheet += renderBlock('safety', child, manual);
      sheet += renderBlock('comm', child, manual);
    } else {
      // 전체 미리보기 — 자문안 권장 순서(이해 중심)
      ['diagnosis', 'sensory', 'comm', 'likeDislike', 'problem', 'canDo', 'needHelp', 'safety', 'routine'].forEach(function (k) {
        sheet += renderBlock(k, child, manual);
      });
      if (scope === 'full') {
        sheet += renderBlock('meds', child, manual);
        sheet += renderBlock('history', child, manual);
        sheet += renderBlock('handover', child, manual);
        sheet += renderBlock('parentNote', child, manual);
      }
    }

    sheet += '</div><div class="sheet-foot">' +
      '<span>발급일 ' + UI.fmtDate(Store.nowISO()) + ' · 최종 수정 ' + UI.fmtDate(manual.updatedAt) + '</span>' +
      '<span>본 문서는 보호자의 동의 하에 공유됩니다 · 내 아이 설명서 (S:CON) by ASTROGEN</span>' +
    '</div></div>';
    return sheet;
  };

  V.summary = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var manual = Store.getManual(child.id) || Store.saveManual(Store.emptyManual(child.id));
      if (manualCount(manual) === 0) {
        return childContextBar(child, 'summary') +
          '<div class="card empty"><div class="emoji">📝</div>' +
          '<h3>아직 설명서 내용이 없어요</h3>' +
          '<p>설명서를 먼저 작성하면 한 장 요약을 만들 수 있어요.</p>' +
          '<button class="btn btn-primary" onclick="App.navigate(\'#/manual/' + child.id + '\')">' +
          '설명서 작성하러 가기</button></div>';
      }
      return childContextBar(child, 'summary') +
        pageHead('한 장 요약', child.name + ' 한 장 요약',
          '학교·병원·치료실에 우리 아이를 한 장으로 소개해요.',
          '<button class="btn btn-ghost btn-sm no-print" id="btn-edit-m">' +
            icon('edit', 15) + '설명서 수정</button>' +
          '<button class="btn btn-ghost btn-sm no-print" id="btn-print">' +
            icon('print', 15) + 'PDF 저장</button>' +
          '<button class="btn btn-primary btn-sm no-print" id="btn-share">' +
            icon('share', 15) + '공유하기</button>') +
        '<div class="pill-info no-print mb-2">' + icon('info', 16) +
          '<div>‘PDF 저장’을 누르면 인쇄 창이 열립니다. 대상을 <b>‘PDF로 저장’</b>으로 선택하면 ' +
          'A4 한 장으로 깔끔하게 저장돼요.</div></div>' +
        '<div class="print-area">' + V._summarySheet(child, manual, { scope: 'full' }) + '</div>';
    },
    mount: function (p) {
      var child = ownedChild(p.childId); if (!child) return;
      var pe = UI.el('btn-edit-m');
      if (pe) pe.onclick = function () { App.navigate('#/manual/' + child.id); };
      var pp = UI.el('btn-print');
      if (pp) pp.onclick = function () { window.print(); };
      var ps = UI.el('btn-share');
      if (ps) ps.onclick = function () { App.navigate('#/share/' + child.id); };
    }
  };

})(window);
