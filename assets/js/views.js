/* =====================================================================
 * views.js — 화면(라우트) 렌더링
 * 각 뷰는 { layout, render(params) -> HTML, mount(params, root) } 구조.
 * ===================================================================== */
(function (global) {
  'use strict';
  var esc = UI.esc, nl2br = UI.nl2br, icon = UI.icon, Modal = UI.Modal, toast = UI.toast;

  /* 화면 전환 사이 유지되는 임시 UI 상태 */
  var S = { manualTab: 'canDo', recFilter: 'all', adminTab: 'stats', focusAdd: null };

  /* ---------- 설명서 섹션 정의 ---------- */
  var MSEC = {
    canDo:   { label: '할 수 있어요', icon: 'thumb',   color: 'var(--c-cando)',   bg: 'var(--c-cando-bg)',
               desc: '아이가 스스로 할 수 있는 것', ph: '예) 혼자 신발을 신을 수 있어요' },
    needHelp:{ label: '도움이 필요해요', icon: 'hand',  color: 'var(--c-help)',    bg: 'var(--c-help-bg)',
               desc: '곁에서 조금 도와주면 좋은 것', ph: '예) 새로운 장소에 적응할 때 도움이 필요해요' },
    like:    { label: '좋아해요',     icon: 'heart',   color: 'var(--c-like)',    bg: 'var(--c-like-bg)',
               desc: '아이가 좋아하는 것', ph: '예) 기차, 파란색, 잔잔한 음악' },
    dislike: { label: '싫어해요',     icon: 'alert',   color: 'var(--c-dislike)', bg: 'var(--c-dislike-bg)',
               desc: '아이가 힘들어하거나 피하는 것', ph: '예) 크고 갑작스러운 소리' },
    problem: { label: '도전적 행동 및 대응', icon: 'shield', color: 'var(--c-problem)', bg: 'var(--c-problem-bg)',
               desc: '행동 유형 · 유발 요인 · 대응 방법' },
    comm:    { label: '의사소통 방법', icon: 'message', color: 'var(--c-comm)',    bg: 'var(--c-comm-bg)',
               desc: '의사소통 수준 · 표현 방법 · 감정 표현 — 아이와 더 잘 통하는 방법',
               ph: '예) 짧고 명확한 문장으로 말해 주세요' },
    routine: { label: '생활 루틴',     icon: 'clock',   color: 'var(--c-routine)', bg: 'var(--c-routine-bg)',
               desc: '하루 일과 · 자조활동 · 일정 — 평소 생활의 흐름',
               ph: '예) 저녁 8시 목욕 후 책 한 권 읽고 9시에 잠자리에 들어요' },
    safety:  { label: '안전 주의사항', icon: 'lock',    color: 'var(--c-safety)',  bg: 'var(--c-safety-bg)',
               desc: '안전을 위해 꼭 지켜야 할 것 — 외출·위험 요소 등',
               ph: '예) 찻길에서는 꼭 손을 잡아 주세요' }
  };
  var MTABS = [
    { id: 'canDo' }, { id: 'needHelp' },
    { id: 'likeDislike', label: '좋아·싫어', icon: 'heart', color: 'var(--c-like)' },
    { id: 'problem' }, { id: 'safety' }, { id: 'comm' }, { id: 'routine' }
  ];
  var RT = {
    behavior:   { label: '행동 기록', color: 'var(--c-help)',  icon: 'note' },
    treatment:  { label: '치료 기록', color: 'var(--c-comm)',  icon: 'heart' },
    /* 약물 기록 — 복약 사실·시간을 남겨 약효/컨디션 변화와 함께 보도록 (2차 리뷰 요청) */
    medication: { label: '약물 기록', color: 'var(--brand-grow)', icon: 'pill' },
    change:     { label: '변화 기록', color: 'var(--accent)',  icon: 'sparkle' },
    /* 검사·평가 — 여러 기관의 검사 결과를 한곳에 (링크아이 벤치마킹: 재공유 불필요) */
    assessment: { label: '검사·평가', color: 'var(--brand-understand)', icon: 'chart' }
  };
  /* 관계 드롭다운 공용 옵션 — 비상연락처·돌봄 인계 등 (2차 리뷰 요청) */
  var REL_OPTS = ['', '모', '부', '조모', '조부', '외조모', '외조부', '배우자',
    '형제', '자매', '이모', '고모', '삼촌', '외삼촌', '위탁모', '위탁부', '활동지원사', '기타'];

  /* ---------- 공용 헬퍼 ---------- */
  function readForm(scope) {
    var o = {};
    scope.querySelectorAll('[name]').forEach(function (f) {
      if (f.type === 'checkbox') o[f.name] = f.checked;
      else if (f.type === 'radio') { if (f.checked) o[f.name] = f.value; }
      else o[f.name] = (f.value || '').trim();
    });
    return o;
  }
  function readRows(container, fields) {
    return [].map.call(container.querySelectorAll('.dyn-row'), function (row) {
      var o = {};
      fields.forEach(function (f) {
        var inp = row.querySelector('[data-f="' + f + '"]');
        o[f] = inp ? (inp.value || '').trim() : '';
      });
      return o;
    }).filter(function (o) { return fields.some(function (f) { return o[f]; }); });
  }
  function ownedChild(id) {
    var u = Store.currentUser(); if (!u) return null;
    var c = Store.getChild(id); if (!c) return null;
    if (u.role === 'admin' || c.ownerId === u.id) return c;
    return null;
  }
  function notFound(msg) {
    return '<div class="container narrow"><div class="empty card card-pad">' +
      '<div class="emoji">🔍</div><h3>' + esc(msg || '페이지를 찾을 수 없어요') + '</h3>' +
      '<p>요청하신 정보가 없거나 접근 권한이 없습니다.</p>' +
      '<button class="btn btn-primary" onclick="App.navigate(\'#/dashboard\')">대시보드로</button>' +
      '</div></div>';
  }
  function manualCount(m) {
    var s = m.sections;
    return s.canDo.length + s.needHelp.length + s.like.length +
           s.dislike.length + s.problem.length + s.comm.length +
           (s.routine ? s.routine.length : 0) +
           (s.safety ? s.safety.length : 0);
  }
  function childContextBar(child, active) {
    var u = Store.currentUser();
    var age = UI.calcAge(child.birthDate);
    var links = [
      { k: 'profile', t: '프로필', h: '#/child/' + child.id },
      { k: 'manual', t: '설명서 작성', h: '#/manual/' + child.id },
      { k: 'records', t: '기록', h: '#/records/' + child.id },
      { k: 'gallery', t: '갤러리', h: '#/gallery/' + child.id },
      { k: 'plan', t: '미래 준비', h: '#/plan/' + child.id },
      { k: 'share', t: '대상별 공유', h: '#/share/' + child.id }
    ];
    var chips = links.map(function (l) {
      return '<a href="' + l.h + '" class="chip' + (l.k === active ? ' on' : '') + '">' + esc(l.t) + '</a>';
    }).join('');
    return '<div class="card card-pad mb-2" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap">' +
      '<div class="avatar lg">' + (child.photo
        ? '<img src="' + child.photo + '" alt="">' : esc(UI.initials(child.name))) + '</div>' +
      '<div style="flex:1;min-width:140px">' +
        '<div style="font-weight:800;font-size:1.15rem">' + esc(child.name) + '</div>' +
        '<div class="muted" style="font-size:.86rem">' +
          (age != null ? '만 ' + age + '세 · ' : '') + esc(child.gender || '') +
          (u.role === 'admin' && child.ownerId !== u.id ? ' · <span class="faint">타 회원</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="ctx-chips">' + chips + '</div>' +
    '</div>';
  }
  function pageHead(eyebrow, title, desc, rightHTML) {
    return '<div class="page-head"><div class="page-head-row"><div>' +
      (eyebrow ? '<div class="eyebrow">' + esc(eyebrow) + '</div>' : '') +
      '<h1>' + esc(title) + '</h1>' +
      (desc ? '<p>' + esc(desc) + '</p>' : '') +
      '</div>' + (rightHTML ? '<div class="row gap-sm">' + rightHTML + '</div>' : '') +
      '</div></div>';
  }

  /* =====================================================================
   * 랜딩 (홈)
   * ===================================================================== */
  var home = {
    layout: 'public',
    render: function () {
      if (Store.currentUser()) { setTimeout(function () { App.navigate('#/dashboard'); }, 0); return ''; }

      var feat = [
        { i: 'note',    t: '기록',      d: '아이의 일상을 체계적으로 기록' },
        { i: 'heart',   t: '이해',      d: '아이의 특성을 더 깊이 이해' },
        { i: 'share',   t: '공유',      d: '가족·전문가와 안전하게 공유' },
        { i: 'link',    t: '연결',      d: '병원·치료기관과 쉽게 연결' },
        { i: 'sprout',  t: '성장',      d: '아이의 작은 변화를 함께 발견' },
        { i: 'shield',  t: '안심',      d: '개인정보 보호로 더 안심하고 사용' },
        { i: 'users',   t: '커뮤니티',  d: '비슷한 경험을 가진 가족과 함께' },
        { i: 'sparkle', t: '전문 연계', d: '맞춤 정보와 전문 서비스를 연결' }
      ];
      var connections = [
        { i: 'users',    t: '가족과 연결',   d: '온 가족이 함께 보살핍니다', c: 'var(--brand-understand)' },
        { i: 'school',   t: '학교와 연결',   d: '선생님과 자연스럽게',     c: 'var(--brand-connect)' },
        { i: 'hospital', t: '병원과 연결',   d: '진료 정보를 한 번에',     c: 'var(--brand-grow)' },
        { i: 'user',     t: '전문가와 연결', d: '치료사·상담사 협업',      c: 'var(--primary)' },
        { i: 'info',     t: '정보와 연결',   d: '맞춤 콘텐츠 제공',        c: 'var(--brand-understand)' }
      ];
      /* 2차 양육자 리뷰에서 나온 목소리 — 슬픔이 아니라 희망·따뜻함으로 */
      var quotes = [
        '그래도 우리 아이는 너무 귀하고 사랑스러워요.',
        '완벽해서가 아니라, 세상에서 하나뿐인 소중한 존재예요.',
        '지금은 누구보다 든든한 짝꿍처럼 함께 살아가고 있어요.'
      ];
      /* 가치 5 — 2차 양육자 리뷰·인트로 시안 반영 (기록·이해·공유·안심·함께 성장) */
      var values = [
        { i: 'note',   c: 'var(--c-comm)',             b: 'var(--c-comm-bg)',             t: '기록',
          d: '우리 아이의 일상을 소중하게 기록해요.' },
        { i: 'heart',  c: 'var(--brand-understand)',   b: 'var(--brand-understand-soft)', t: '이해',
          d: '아이의 특성과 마음을 더 깊이 이해해요.' },
        { i: 'share',  c: 'var(--brand-connect)',      b: 'var(--brand-connect-soft)',    t: '공유',
          d: '필요한 사람과 안전하게 정보를 공유해요.' },
        { i: 'shield', c: 'var(--primary-dark)',       b: 'var(--primary-soft)',          t: '안심',
          d: '언제 어디서나 아이를 안심하고 맡겨요.' },
        { i: 'sprout', c: 'var(--brand-grow)',         b: 'var(--brand-grow-soft)',       t: '함께 성장',
          d: '지금의 기록이 아이의 내일이 됩니다.' }
      ];
      var steps = [
        { t: '회원가입 후 아이를 등록해요', d: '기본정보·장애 특성·약물·알레르기·응급 대응 정보를 입력합니다.' },
        { t: '설명서를 작성해요', d: '7개 카테고리에 우리 아이의 특성과 대처법, 생활 루틴까지 기록합니다.' },
        { t: '한 장 요약으로 공유해요', d: '인증번호로 보호되는 링크 또는 PDF로 안전하게 전달합니다.' },
        { t: '기록이 쌓여 데이터가 돼요', d: '행동·치료·변화를 꾸준히 남기면 아이의 성장이 보입니다.' }
      ];
      var spark = function (x, y, s) {
        return '<span class="hero-spark" style="left:' + x + ';top:' + y + '">' +
          icon('sparkle', s) + '</span>';
      };
      /* HOW 스텝 번호 — 브랜드 그라데이션 순환 (이해→연결→성장→연결블루) */
      var STEP_C = [
        ['#837bea', '#6c63dd'], ['#6590e2', '#4a7bd9'],
        ['#45b5a8', '#2da195'], ['#5e7fe0', '#3566cd']
      ];
      function stepGrad(i) {
        var c = STEP_C[i % STEP_C.length];
        return '--sn1:' + c[0] + ';--sn2:' + c[1];
      }
      return '<div class="landing">' +
        /* 상단 바 */
        '<div class="lp-bar">' +
          '<div class="brand" style="display:flex;align-items:center;gap:10px;cursor:pointer">' +
            UI.brandMark(34) +
            '<div class="wordmark" style="display:flex;flex-direction:column;line-height:1.15">' +
              '<b style="font-size:1.05rem">내 아이 설명서</b>' +
              '<span style="font-size:.62rem;font-weight:800;color:var(--primary);letter-spacing:.1em">' +
              'STELLAR CONNECT · S:CON</span></div>' +
          '</div>' +
          '<div class="spacer" style="flex:1"></div>' +
          '<button class="btn btn-ghost btn-sm" onclick="App.navigate(\'#/login\')">로그인</button>' +
          '<button class="btn btn-primary btn-sm" onclick="App.navigate(\'#/signup\')">시작하기</button>' +
        '</div>' +

        /* 히어로 */
        '<section class="hero">' +
          spark('8%', '24%', 16) + spark('21%', '68%', 11) + spark('86%', '58%', 20) +
          spark('72%', '20%', 13) +
          '<div class="hero-inner">' +
            '<div class="eyebrow">' + icon('heart', 14) +
            '우리 아이를 이해하는 모든 연결의 시작</div>' +
            '<h1>너는 너답게,<br>나는 <span class="em">너의 편</span></h1>' +
            '<p><b>우리 아이는 세상에서 하나뿐인 소중한 존재입니다.</b> ' +
            '좋아하는 것, 통하는 방법, 도전적 행동과 지원 방법까지 ' +
            '<b>「내 아이 설명서」</b> 한 장에 담아 — 아이를 이해하고 함께 성장해 가는 여정, ' +
            'Stellar Connect가 함께할게요.</p>' +
            '<div class="hero-pill">' + icon('heart', 15) +
            '우리 아이를 더 깊이 이해하면, 더 따뜻한 연결이 시작됩니다.</div>' +
            '<div class="cta">' +
              '<button class="btn btn-accent btn-lg" onclick="App.navigate(\'#/signup\')">' +
                icon('sparkle', 18) + '무료로 시작하기</button>' +
              '<button class="btn btn-ghost btn-lg" onclick="Views._demo()">' +
                icon('eye', 17) + '체험 계정으로 둘러보기</button>' +
            '</div>' +
            '<div class="trust">' +
              '<span>' + icon('book', 16) + '기록이 아니라, 이해하게 만드는 서비스</span>' +
              '<span>' + icon('print', 16) + '학교·병원용 대상별 설명서로 바로 출력</span>' +
              '<span>' + icon('shield', 16) + '보호자 인증·안심번호 기반 안전한 공유</span>' +
            '</div>' +
            /* 인트로 시안 일러스트 — 풀밭 위 두 아이 (따뜻한 수채화 톤) */
            '<div class="hero-illust" aria-hidden="true">' +
              '<img src="assets/img/intro-kids.jpg" alt="" loading="eager" ' +
                'width="554" height="430">' +
            '</div>' +
            '<span class="hero-spark hs-heart" style="left:56%;top:16%">' + icon('heart', 15) + '</span>' +
            '<span class="hero-spark hs-heart" style="left:88%;top:74%">' + icon('heart', 12) + '</span>' +
          '</div>' +
        '</section>' +

        /* OUR VALUE — 기록 · 이해 · 공유 · 안심 · 함께 성장 (2차 리뷰 시안) */
        '<section class="section glow-sec">' +
          '<div class="lp-section">' +
            '<div class="section-head">' +
              '<div class="eyebrow">OUR VALUE</div>' +
              '<h2>Stellar Connect는 이런 가치를 전합니다</h2>' +
              '<p>완벽한 기록을 위해서가 아니라, 아이를 향한 따뜻한 이해를 위해.</p>' +
            '</div>' +
            '<div class="gentle-grid">' + values.map(function (v) {
              return '<div class="gentle-card">' +
                '<div class="g-ico" style="background:' + v.b + ';color:' + v.c + '">' +
                  icon(v.i, 24) + '</div>' +
                '<h3>' + esc(v.t) + '</h3>' +
                '<p>' + esc(v.d) + '</p></div>';
            }).join('') + '</div>' +
          '</div>' +
        '</section>' +

        /* 함께 걸어가요 — 위로와 희망 (2차 양육자 리뷰: 기능 설명보다 공감을 먼저) */
        '<section class="section why-sec">' +
          spark('5%', '12%', 11) + spark('94%', '84%', 13) +
          '<div class="lp-section">' +
            '<div class="why-grid">' +
              '<div class="why-visual">' +
                '<div class="why-photo"><img src="assets/img/intro-hands-star.jpg" ' +
                  'alt="두 손 위에서 웃고 있는 별 일러스트" loading="lazy" ' +
                  'width="500" height="325"></div>' +
                '<p class="star-quote">“완벽해서가 아니라,<br>세상에서 하나뿐인 소중한 존재”</p>' +
              '</div>' +
              '<div class="why-content">' +
                '<div class="section-head">' +
                  '<div class="eyebrow">함께 걸어가요</div>' +
                  '<h2>완벽하지 않아도 괜찮아요.<br>우리는 함께 걸어가고 있어요.</h2>' +
                  '<p>처음엔 막막하고 힘들었던 시간도 있었죠. 그래도 우리 아이는 매일 조금씩 성장하고, ' +
                  '우리도 부모로서 함께 성장하고 있어요. Stellar Connect는 그 여정을 응원합니다.</p>' +
                '</div>' +
                '<div class="quote-stack">' + quotes.map(function (q) {
                  return '<div class="quote-card"><div class="qmark">“</div>' +
                    '<p>' + esc(q) + '</p>' +
                    '<div class="who">— 양육자 인터뷰 중에서</div></div>';
                }).join('') + '</div>' +
                '<div class="soft-pill">' + icon('lock', 15) +
                  '소중한 정보는 안전하게 보호됩니다.</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* 차별화 — 기록이 아니라 '이해하게 만드는' 서비스 */
        '<section class="section glow-sec alt">' +
          '<div class="lp-section">' +
            '<div class="section-head">' +
              '<div class="eyebrow">WHY 내 아이 설명서</div>' +
              '<h2>기록하는 앱이 아니라,<br>이해하게 만드는 서비스</h2>' +
              '<p>매일 일기를 쌓는 것이 목적이 아닙니다. 우리 아이를 처음 만나는 사람도 ' +
              '바로 이해하도록 — 그리고 그 결과물을 손에 쥐어 드립니다. ' +
              '양육자분들은 이 서비스를 <b>“부모를 대신하여 우리 아이를 이해해 주는 플랫폼”</b>이라 ' +
              '불러 주셨습니다.</p>' +
            '</div>' +
            '<div class="grid grid-4">' + [
              { i: 'heart',  t: '이해 중심',     d: '좋아함·의사소통·감각·도전적 행동과 지원 방법을 체계적으로 정리' },
              { i: 'print',  t: '대상별 결과물', d: '학교용·병원용·활동지원사용·돌봄기관용 설명서로 자동 정리' },
              { i: 'check',  t: '최소 입력',     d: '추천 버튼만 눌러도 채워지는 빠른 작성 — 바쁜 일상에서도 부담 없이' },
              { i: 'sprout', t: '미래까지',      d: '아동기부터 성인기·자립 준비까지, 생애주기로 이어지는 플랜' }
            ].map(function (f) {
              return '<div class="card feature-card"><div class="ico">' + icon(f.i, 26) + '</div>' +
                '<h3>' + esc(f.t) + '</h3><p>' + esc(f.d) + '</p></div>';
            }).join('') + '</div>' +
          '</div>' +
        '</section>' +

        /* CONNECT — 한 아이를 둘러싼 모든 연결 (폰 목업 + 별자리 경로) */
        '<section class="section connect-sec">' +
          spark('6%', '14%', 13) + spark('90%', '20%', 16) + spark('12%', '82%', 11) +
          spark('84%', '74%', 12) + spark('46%', '6%', 10) +
          '<div class="lp-section">' +
            '<div class="section-head">' +
              '<div class="eyebrow">CONNECT</div>' +
              '<h2>한 아이를 둘러싼 모든 연결</h2>' +
              '<p>가족·학교·병원·전문가·정보 — Stellar Connect가 흩어진 모든 주체를 잇습니다.</p>' +
            '</div>' +
            '<div class="connect-duo">' +
              '<div class="pm-col">' + (function () {
                var tiles = [
                  { i: 'note',   t: '기록하기',    c: 'var(--c-help)',             b: 'var(--c-help-bg)' },
                  { i: 'book',   t: '설명서', c: 'var(--primary)',            b: 'var(--primary-soft)' },
                  { i: 'print',  t: '한 장 요약',  c: 'var(--brand-understand)',   b: 'var(--brand-understand-soft)' },
                  { i: 'share',  t: '공유하기',    c: 'var(--brand-connect)',      b: 'var(--brand-connect-soft)' },
                  { i: 'sprout', t: '성장 플랜',   c: 'var(--brand-grow)',         b: 'var(--brand-grow-soft)' },
                  { i: 'shield', t: '안심 카드',   c: 'var(--danger)',             b: '#fdecea' }
                ];
                return '<div class="phone-mock" aria-hidden="true"><div class="pm-screen">' +
                  '<div class="pm-bar">' + UI.brandMark(18) + '<b>Stellar Connect</b>' +
                    '<span class="pm-bell">' + icon('bell', 14) + '</span></div>' +
                  '<div class="pm-greet">안녕하세요, 민서님 👋' +
                    '<span>오늘도 준호의 작은 변화가 큰 성장이에요</span></div>' +
                  '<div class="pm-grid">' + tiles.map(function (t) {
                    return '<div class="pm-tile"><span class="pm-ico" style="background:' +
                      t.b + ';color:' + t.c + '">' + icon(t.i, 16) + '</span>' + t.t + '</div>';
                  }).join('') + '</div>' +
                  '<div class="pm-card"><b>오늘의 기록</b>' +
                    '<span>💊 아침 약 복용 · 😊 기분 좋음</span></div>' +
                  '<div class="pm-card pm-note"><span>“밝은 표정으로 먼저 인사했어요”</span>' +
                    '<span class="pm-plus">+</span></div>' +
                  '<div class="pm-nav">' + [
                    ['grid', '홈', 1], ['book', '설명서', 0], ['note', '기록', 0],
                    ['share', '공유', 0], ['menu', '더보기', 0]
                  ].map(function (n) {
                    return '<span class="' + (n[2] ? 'on' : '') + '">' +
                      icon(n[0], 15) + n[1] + '</span>';
                  }).join('') + '</div>' +
                '</div></div>' +
                '<div class="pm-caption">실제 서비스 화면 — 체험 계정으로 직접 만져 보세요</div>';
              })() + '</div>' +
              '<div class="connect-path">' + connections.map(function (c, ci) {
                return '<div class="connect-node' + (ci % 2 ? ' flip' : '') +
                  '" style="--nc:' + c.c + '">' +
                  '<div class="node-ico">' + icon(c.i, 28) + '</div>' +
                  '<div class="node-label"><b>' + esc(c.t) + '</b>' +
                  '<span>' + esc(c.d) + '</span></div>' +
                '</div>';
              }).join('') + '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* HOW */
        '<section class="section glow-sec">' +
          '<div class="lp-section">' +
            '<div class="section-head">' +
              '<div class="eyebrow">HOW IT WORKS</div>' +
              '<h2>이렇게 사용해요</h2>' +
              '<p>네 단계면 충분합니다. 무리하지 않고, 천천히 채워가세요.</p>' +
            '</div>' +
            '<div class="grid grid-2"><div class="steps">' +
              steps.slice(0, 2).map(function (s, i) {
                return '<div class="step"><div class="num" style="' + stepGrad(i) + '">' +
                  (i + 1) + '</div>' +
                  '<div><h4>' + esc(s.t) + '</h4><p>' + esc(s.d) + '</p></div></div>';
              }).join('') + '</div><div class="steps">' +
              steps.slice(2).map(function (s, i) {
                return '<div class="step"><div class="num" style="' + stepGrad(i + 2) + '">' +
                  (i + 3) + '</div>' +
                  '<div><h4>' + esc(s.t) + '</h4><p>' + esc(s.d) + '</p></div></div>';
              }).join('') + '</div></div>' +
          '</div>' +
        '</section>' +

        /* ASTROGEN MISSION */
        '<section class="section">' +
          '<div class="lp-section">' +
            '<div class="mission">' +
              '<div class="eyebrow">ASTROGEN</div>' +
              '<h2>치료를 넘어, 동반자로</h2>' +
              '<p>아스트로젠은 자폐 스펙트럼 장애 치료 신약을 개발하는 바이오 기업입니다. ' +
              'Stellar Connect(S:CON)는 치료의 다음 장(章)에서, 아이와 가족·병원·학교·치료기관을 ' +
              '연결하며 아이를 이해하는 모든 순간을 잇는 디지털 동반자입니다.</p>' +
              '<div class="pills">' +
                '<span class="pill">Boost Beyond Boundaries</span>' +
                '<span class="pill">과학과 사람 사이의 빈틈을 채웁니다</span>' +
                '<span class="pill">선한 영향력의 확장</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* CLOSING BAND — 세상을 연결하는 시작 */
        '<section class="section">' +
          '<div class="lp-section">' +
            '<div class="closing-band">' +
              spark('8%', '22%', 14) + spark('86%', '28%', 16) + spark('14%', '76%', 11) +
              spark('72%', '78%', 13) + spark('48%', '12%', 10) +
              '<h2>지금, 우리 아이의 <span class="em">이야기</span>를<br>시작해 볼까요?</h2>' +
              '<p>한 줄이면 충분해요. 오늘의 작은 기록이, ' +
              '우리 아이를 이해하는 따뜻한 연결이 됩니다.</p>' +
              '<div class="cta">' +
                '<button class="btn btn-accent btn-lg" onclick="App.navigate(\'#/signup\')">' +
                  icon('sparkle', 18) + '무료로 시작하기</button>' +
                '<button class="btn btn-ghost btn-lg" onclick="Views._demo()">' +
                  icon('eye', 17) + '체험 계정으로 둘러보기</button>' +
              '</div>' +
              '<p class="closing-hint">체험 계정 <b>parent@example.com</b> / 비밀번호 <b>1234</b> 로 ' +
                '모든 기능을 둘러볼 수 있어요.</p>' +
              '<div class="closing-tag">Every Child · Every Connection · Every Possibility</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        /* FOOTER */
        '<footer class="lp-foot"><div class="inner">' +
          '<div class="row-top">' +
            '<div style="display:flex;gap:11px;align-items:center">' + UI.brandMark(38) +
              '<div><b style="display:block">Stellar Connect</b>' +
              '<span style="font-size:.8rem">아이를 이해하는 모든 연결의 시작</span></div></div>' +
            '<div class="fnav">' +
              '<a onclick="Views._info(\'about\')">서비스 소개</a>' +
              '<a onclick="Views._info(\'terms\')">이용약관</a>' +
              '<a onclick="Views._info(\'privacy\')">개인정보처리방침</a>' +
              '<a onclick="App.navigate(\'#/login\')">로그인</a>' +
            '</div>' +
          '</div>' +
          '<div class="copyright">' +
            '© 2026 ASTROGEN. Stellar Connect(S:CON)는 아스트로젠의 디지털 헬스케어 서비스입니다. ' +
            'Every Child, Every Connection, Every Possibility.<br>' +
            '기획: 아스트로젠 · 개발: 오큐브' +
          '</div>' +
        '</div></footer>' +
      '</div>';
    },
    mount: function () {}
  };

  /* =====================================================================
   * 로그인
   * ===================================================================== */
  var login = {
    layout: 'public',
    render: function () {
      return '' +
      '<div class="app-bar"><div class="brand" onclick="App.navigate(\'#/\')">' + UI.brandMark(34) +
        '<div class="wordmark"><b>Stellar Connect</b>' +
        '<span>S:CON · ASTROGEN</span></div></div></div>' +
      '<div class="container narrow" style="padding-top:48px">' +
        '<div class="card card-pad" style="max-width:420px;margin:0 auto">' +
          '<h1 class="mb-1">로그인</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">우리 아이의 이야기를 이어서 기록해요.</p>' +
          '<form id="login-form">' +
            '<div class="field"><label>이메일</label>' +
              '<input class="input" name="email" type="email" value="parent@example.com" required></div>' +
            '<div class="field"><label>비밀번호</label>' +
              '<input class="input" name="password" type="password" value="1234" required></div>' +
            '<button class="btn btn-primary btn-block btn-lg" type="submit">로그인</button>' +
          '</form>' +
          '<div class="divider"></div>' +
          '<div class="row gap-sm" style="justify-content:center">' +
            '<button class="btn btn-soft btn-sm" onclick="Views._demo()">양육자 체험</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="Views._demoAdmin()">관리자 체험</button>' +
          '</div>' +
          '<p class="center muted" style="margin-top:18px;font-size:.9rem">계정이 없으신가요? ' +
            '<a href="#/signup" style="color:var(--primary);font-weight:700">회원가입</a></p>' +
        '</div>' +
      '</div>';
    },
    mount: function () {
      UI.el('login-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        var r = Store.login(f.email, f.password);
        if (!r.ok) { toast(r.error, 'err'); return; }
        toast(r.user.name + '님, 환영합니다', 'ok');
        App.navigate('#/dashboard');
      });
    }
  };

  /* =====================================================================
   * 회원가입
   * ===================================================================== */
  var signup = {
    layout: 'public',
    render: function () {
      return '' +
      '<div class="app-bar"><div class="brand" onclick="App.navigate(\'#/\')">' + UI.brandMark(34) +
        '<div class="wordmark"><b>Stellar Connect</b>' +
        '<span>S:CON · ASTROGEN</span></div></div></div>' +
      '<div class="container narrow" style="padding-top:36px">' +
        '<div class="card card-pad" style="max-width:460px;margin:0 auto">' +
          '<h1 class="mb-1">회원가입</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">양육자(보호자) 계정으로 가입합니다.</p>' +
          '<form id="signup-form">' +
            '<div class="field"><label>이름 <span class="req">*</span></label>' +
              '<input class="input" name="name" required placeholder="홍길동"></div>' +
            '<div class="field"><label>이메일 <span class="req">*</span></label>' +
              '<input class="input" name="email" type="email" required placeholder="you@example.com"></div>' +
            '<div class="field-row">' +
              '<div class="field"><label>비밀번호 <span class="req">*</span></label>' +
                '<input class="input" name="password" type="password" required minlength="4"></div>' +
              '<div class="field"><label>휴대전화</label>' +
                '<input class="input" name="phone" placeholder="010-0000-0000"></div>' +
            '</div>' +
            '<div class="callout mb-2">' +
              '<label class="checkline"><input type="checkbox" name="age14" required>' +
                '<span>만 14세 이상입니다. <span class="req">*</span></span></label>' +
              '<label class="checkline"><input type="checkbox" id="su-verify">' +
                '<span>휴대폰 본인인증 <span class="faint">(데모: 체크 시 인증 완료)</span></span></label>' +
              '<label class="checkline"><input type="checkbox" name="terms" required>' +
                '<span>이용약관 및 개인정보처리방침에 동의합니다. <span class="req">*</span></span></label>' +
            '</div>' +
            '<button class="btn btn-primary btn-block btn-lg" type="submit">가입하기</button>' +
          '</form>' +
          '<p class="center muted" style="margin-top:18px;font-size:.9rem">이미 계정이 있으신가요? ' +
            '<a href="#/login" style="color:var(--primary);font-weight:700">로그인</a></p>' +
        '</div>' +
      '</div>';
    },
    mount: function () {
      UI.el('signup-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        if (!f.name || !f.email || !f.password) { toast('필수 항목을 입력해 주세요.', 'err'); return; }
        var r = Store.signup({
          name: f.name, email: f.email, password: f.password, phone: f.phone,
          verified: UI.el('su-verify').checked
        });
        if (!r.ok) { toast(r.error, 'err'); return; }
        Store.login(f.email, f.password);
        toast('가입을 환영합니다! 아이를 등록해 주세요.', 'ok');
        App.navigate('#/child/new');
      });
    }
  };

  /* =====================================================================
   * 대시보드
   * ===================================================================== */
  var dashboard = {
    layout: 'app',
    render: function () {
      var u = Store.currentUser();
      var kids = Store.childrenOf(u.id);
      var pop = Store.listPopups().filter(function (p) { return p.active; })[0];
      var primary = kids[0];

      var html = '';
      html += pageHead('홈', u.name + '님, 안녕하세요 👋',
        '우리 아이를 가장 잘 설명하는 한 부 —「내 아이 설명서」를 함께 채워가요.');

      if (pop) {
        html += '<div class="card card-pad mb-2" style="border-left:4px solid var(--accent);background:var(--accent-soft)">' +
          '<b style="color:#0d5b52">' + icon('bell', 15) + ' ' + esc(pop.title) + '</b>' +
          '<p style="color:#0d5b52;font-size:.9rem;margin-top:4px">' + esc(pop.body) + '</p></div>';
      }

      // 복약 리마인더 — 주기 복용 약물 중 오늘 기록이 없는 건 (실서비스: 복용 시간 앱 푸시)
      var missedAll = [];
      kids.forEach(function (c) {
        var st = global.Views._medStatusToday ? global.Views._medStatusToday(c) : [];
        st.forEach(function (x) { if (!x.done) missedAll.push({ child: c, med: x.med, slot: x.slot }); });
      });
      if (missedAll.length) {
        html += '<div class="card card-pad mb-2" id="med-remind" ' +
          'style="border-left:4px solid var(--c-problem);background:var(--c-problem-bg)">' +
          '<div class="row" style="gap:10px;flex-wrap:wrap;align-items:center">' +
            '<b style="color:#9a6207">' + icon('pill', 15) + ' 오늘 복약 기록 전이에요</b>' +
            '<span style="color:#9a6207;font-size:.9rem;flex:1;min-width:180px">' +
              missedAll.slice(0, 3).map(function (x) {
                return esc(x.med.name) + '(' + esc(x.slot) + ')';
              }).join(' · ') +
              (missedAll.length > 3 ? ' 외 ' + (missedAll.length - 3) + '건' : '') + '</span>' +
            '<button class="btn btn-primary btn-sm" ' +
              'onclick="App.navigate(\'#/records/' + missedAll[0].child.id + '\')">' +
              icon('check', 14) + '바로 기록</button></div>' +
          '<p class="faint" style="font-size:.78rem;margin-top:6px">기록 페이지의 ‘오늘의 복약’에서 ' +
            '탭 한 번으로 기록돼요. 실서비스에서는 복용 시간에 맞춰 앱 푸시로 알려드립니다.</p></div>';
      }

      // 대부분 가정은 아이 1명 — 등록 후에는 '추가'를 낮은 톤(ghost)으로만 노출
      html += '<div class="page-head-row mb-2"><h2>우리 아이</h2>' +
        (kids.length
          ? '<button class="btn btn-ghost btn-sm" onclick="App.navigate(\'#/child/new\')">' +
            icon('plus', 15) + '아이 추가</button>'
          : '') + '</div>';

      if (!kids.length) {
        html += '<div class="card empty"><div class="emoji">🧒</div>' +
          '<h3>아직 등록된 아이가 없어요</h3>' +
          '<p>아이를 등록하면 「내 아이 설명서」를 작성할 수 있어요.</p>' +
          '<button class="btn btn-primary" onclick="App.navigate(\'#/child/new\')">첫 아이 등록하기</button></div>';
        return html;
      }

      // 아이 1명이면 카드를 전폭으로 (3열 그리드에 1장만 두면 빈 공간이 생김)
      html += '<div class="' + (kids.length > 1 ? 'grid grid-3 ' : '') + 'mb-3">' + kids.map(function (c) {
        var m = Store.getManual(c.id);
        var cnt = m ? manualCount(m) : 0;
        var age = UI.calcAge(c.birthDate);
        var note = m && m.summaryNote
          ? '<div class="oneline">“' + esc(m.summaryNote) + '”</div>' : '';
        return '<div class="card child-card" onclick="App.navigate(\'#/child/' + c.id + '\')">' +
          '<div class="avatar lg">' + (c.photo
            ? '<img src="' + c.photo + '" alt="">' : esc(UI.initials(c.name))) + '</div>' +
          '<div class="meta"><div class="nm">' + esc(c.name) + '</div>' +
            '<div class="sub">' + (age != null ? '만 ' + age + '세 · ' : '') +
            esc(c.disability.type) + '</div>' + note +
            '<div style="margin-top:6px"><span class="badge">설명서 ' + cnt + '항목</span></div>' +
          '</div>' + icon('chevR', 18) + '</div>';
      }).join('') + '</div>';

      // 「내 아이 설명서」 진행 + 핵심 동선 (작성 → 대상별 생성 → 공유)
      if (primary) {
        var pm = Store.getManual(primary.id);
        var pcnt = pm ? manualCount(pm) : 0;
        var pct = Math.min(100, pcnt * 5);
        var statusLabel = pcnt >= 20 ? '풍성하게 채워졌어요' : pcnt >= 10 ? '잘 채워지고 있어요' : '이제 시작이에요';
        html += '<div class="card card-pad mb-3 manual-status">' +
          '<div class="row between wrap" style="gap:10px;margin-bottom:10px">' +
            '<div><div class="eyebrow" style="color:var(--primary)">내 아이 설명서</div>' +
              '<b style="font-size:1.08rem">' + esc(primary.name) + ' 설명서 · ' + pcnt + '항목</b></div>' +
            '<span class="badge ' + (pcnt >= 10 ? 'ok' : '') + '">' + statusLabel + '</span></div>' +
          '<div style="height:9px;background:var(--surface-2);border-radius:99px;overflow:hidden">' +
            '<div style="height:100%;width:' + pct + '%;background:linear-gradient(90deg,var(--brand-understand),var(--brand-connect) 60%,var(--brand-grow));border-radius:99px"></div></div>' +
          '<div class="grid grid-3 mt-2" style="gap:10px">' +
            '<button class="btn btn-primary btn-block" onclick="App.navigate(\'#/manual/' + primary.id + '\')">' +
              icon('edit', 16) + '설명서 ' + (pcnt ? '이어쓰기' : '작성하기') + '</button>' +
            '<button class="btn btn-soft btn-block" onclick="App.navigate(\'#/share/' + primary.id + '\')">' +
              icon('share', 16) + '대상별 설명서 만들기</button>' +
            '<button class="btn btn-ghost btn-block" onclick="App.navigate(\'#/plan/' + primary.id + '\')">' +
              icon('sprout', 16) + '미래 준비 보기</button>' +
          '</div></div>';
      }

      // (오늘의 체크인 카드는 2차 리뷰 요청으로 제거됨 — 복약 체크는 약물 기록으로 대체)

      // 최근 기록 — 행동·치료·변화·검사 (기록은 기본 기능)
      var allRecords = [];
      kids.forEach(function (c) { allRecords = allRecords.concat(Store.recordsOf(c.id)); });
      var recent = allRecords.sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 5);
      html += '<div class="card mb-3"><div class="card-head"><h3>최근 기록</h3>' +
        (primary ? '<a class="btn btn-soft btn-sm" href="#/records/' + primary.id + '" style="margin-left:auto">' +
          icon('plus', 14) + '기록하기</a>' : '') + '</div><div class="card-body">';
      if (!recent.length) {
        html += '<p class="muted center" style="padding:14px 0">아직 기록이 없어요. 오늘 첫 기록을 남겨 보세요.</p>';
      } else {
        html += recent.map(function (r) {
          var c = Store.getChild(r.childId);
          var meta = RT[r.type] || RT.behavior;
          return '<a class="row" href="#/records/' + r.childId + '" style="padding:9px 0;border-bottom:1px solid var(--border)">' +
            '<span style="color:' + meta.color + '">' + icon(meta.icon, 18) + '</span>' +
            '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.92rem">' +
              esc(r.title) + '</div>' +
            '<div class="faint" style="font-size:.78rem">' + esc(c ? c.name : '') +
              ' · ' + esc(meta.label) + ' · ' + UI.fmtDate(r.date) + '</div></div>' +
            UI.moodStars(r.mood) + '</a>';
        }).join('');
      }
      html += '</div></div>';

      // 이렇게 쓰여요 — 3단계
      var steps = [
        { i: 'book',  t: '아이를 이해하는 항목 채우기', d: '좋아함·의사소통·감각·도전적 행동과 지원 방법까지. 추천 버튼만 눌러도 채워져요.' },
        { i: 'print', t: '대상별 설명서로 자동 정리', d: '학교용·병원용·활동지원사용·돌봄기관용으로 필요한 내용만 한 장에 담아요.' },
        { i: 'share', t: 'QR·링크로 바로 공유', d: '새로운 선생님·치료사를 만나도 다시 설명할 필요 없이 링크 하나로 전달.' }
      ];
      html += '<div class="card"><div class="card-head"><h3>이렇게 쓰여요</h3></div>' +
        '<div class="card-body"><div class="how-steps">' +
        steps.map(function (s, i) {
          return '<div class="how-step"><span class="how-num">' + (i + 1) + '</span>' +
            '<span class="how-ico" style="color:var(--primary)">' + icon(s.i, 18) + '</span>' +
            '<div><b>' + esc(s.t) + '</b><p class="muted" style="font-size:.88rem;margin-top:2px">' +
            esc(s.d) + '</p></div></div>';
        }).join('') + '</div></div></div>';

      return html;
    },
    mount: function () {
      // 오늘의 체크인 카드 제거로 대시보드 mount에 바인딩할 항목 없음
    }
  };

  global.Views = {
    _S: S, _MSEC: MSEC, _MTABS: MTABS, _RT: RT, _REL_OPTS: REL_OPTS,
    _readForm: readForm, _readRows: readRows, _ownedChild: ownedChild,
    _notFound: notFound, _manualCount: manualCount,
    _childContextBar: childContextBar, _pageHead: pageHead,
    home: home, login: login, signup: signup, dashboard: dashboard,
    _demo: function () {
      Store.login('parent@example.com', '1234'); App.navigate('#/dashboard');
      toast('체험 계정으로 로그인했습니다', 'ok');
    },
    _demoAdmin: function () {
      Store.login('admin@ichild.kr', 'admin123'); App.navigate('#/admin');
      toast('관리자 체험 계정으로 로그인했습니다', 'ok');
    },
    _info: function (key) {
      var c = Store.listContents().filter(function (x) { return x.key === key; })[0];
      if (!c) { c = { title: '안내', body: '준비 중입니다.' }; }
      Modal.open({
        title: c.title, icon: 'info',
        body: '<p style="line-height:1.7;white-space:pre-line">' + esc(c.body) + '</p>',
        buttons: [{ label: '확인', value: 'ok', variant: 'primary' }]
      });
    }
  };
})(window);
