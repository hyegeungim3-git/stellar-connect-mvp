/* =====================================================================
 * views.js — 화면(라우트) 렌더링
 * 각 뷰는 { layout, render(params) -> HTML, mount(params, root) } 구조.
 * ===================================================================== */
(function (global) {
  'use strict';
  var esc = UI.esc, nl2br = UI.nl2br, icon = UI.icon, Modal = UI.Modal, toast = UI.toast;

  /* 화면 전환 사이 유지되는 임시 UI 상태 */
  var S = { manualTab: 'canDo', recFilter: 'all', recSearch: '', homeChild: null,
    recPeriod: 'all', recFrom: '', recTo: '', recMood: 'all', recSort: 'new',
    adminTab: 'stats', verifyFilter: 'pending', memQuery: '', memFilter: 'all', memPage: 1, focusAdd: null,
    /* 회원가입 5단계 — 동의 → 본인인증 → 회원정보 → 서류 등록 → 접수 완료 */
    suStep: 1, suData: null };

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
    /* 복용 기록 — 복약 사실·시간을 남겨 약효/컨디션 변화와 함께 보도록 (2차 리뷰 요청) */
    medication: { label: '복용 기록', color: 'var(--brand-grow)', icon: 'pill' },
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
    /* 아이 컨텍스트 칩 바는 좌측 메뉴로 통합됨 — 좌측 메뉴와 중복돼 헷갈린다는 사용자 의견 반영.
       (프로필·대상별 공유가 사이드바·더보기에 추가됨) 호출부 호환을 위해 빈 문자열 반환 */
    return '';
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
              { i: 'check',  t: '최소 입력',     d: '빠른 입력 칩만 탭해도 채워지는 빠른 작성 — 바쁜 일상에서도 부담 없이' },
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
                    ['home', '홈', 1], ['book', '설명서', 0], ['note', '기록', 0],
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
          /* 이메일이 곧 아이디라 잊으면 들어올 방법이 없다 — 로그인 화면에서 바로 이어 준다 */
          '<p class="center muted" style="margin-top:16px;font-size:.88rem">' +
            '<a href="#/find-id" style="color:var(--text-muted)">아이디 찾기</a>' +
            '<span class="faint" style="margin:0 8px">·</span>' +
            '<a href="#/reset-pw" style="color:var(--text-muted)">비밀번호 재설정</a></p>' +
          '<p class="center muted" style="margin-top:10px;font-size:.9rem">계정이 없으신가요? ' +
            '<a href="#/signup" style="color:var(--primary);font-weight:700">회원가입</a></p>' +
        '</div>' +
      '</div>';
    },
    mount: function () {
      UI.el('login-form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        var r = Store.login(f.email, f.password);
        /* 심사 상태는 토스트가 아니라 모달로 — 왜 못 들어가는지, 다음에 뭘 하면 되는지 알려야 한다 */
        if (!r.ok && r.code) { openReviewStatus(r.code, r.user); return; }
        /* 남은 횟수를 알려 준다 — 조용히 잠기면 왜 막혔는지 알 수 없다 */
        if (!r.ok) {
          toast(r.error + (r.left != null && r.left <= 2 ? ' (' + r.left + '번 남음)' : ''), 'err');
          return;
        }
        toast(r.user.name + '님, 환영합니다', 'ok');
        /* 운영자는 양육자 화면을 쓰지 않는다 — 바로 관리자 메뉴로 */
        var staff = r.user.role === 'admin' || r.user.role === 'reviewer';
        App.navigate(staff ? '#/admin' : '#/dashboard');
      });
    }
  };

  /* 승인 전 로그인 시도 — 상태별 안내 모달 (비밀번호 확인을 통과한 뒤에만 열린다) */
  function openReviewStatus(code, user) {
    /* 비밀번호를 연속으로 틀려 잠긴 계정 — 스스로 푸는 길(재설정)을 먼저 준다 */
    if (code === 'locked') {
      Modal.open({
        title: '로그인이 잠겼어요', icon: 'lock',
        body: '<p class="muted mb-2">비밀번호를 ' + Store.LOGIN_FAIL_LIMIT +
            '번 연속으로 잘못 입력해 계정을 잠갔어요.</p>' +
          '<div class="pill-info">' + icon('info', 16) +
          '<div>비밀번호를 재설정하면 잠금도 함께 풀립니다. ' +
          '휴대전화 번호가 바뀌어 인증이 어렵다면 고객센터로 문의해 주세요.</div></div>',
        buttons: [
          { label: '닫기', value: 'cancel', variant: 'ghost' },
          { label: '비밀번호 재설정', value: 'go', variant: 'primary' }
        ],
        onButton: function (v) { if (v === 'go') App.navigate('#/reset-pw'); }
      });
      return;
    }
    if (code === 'nodoc') {
      Modal.open({
        title: '아직 서류 등록이 남아 있어요', icon: 'clock',
        body: '<p class="muted mb-2">마지막 단계만 마치면 바로 이용하실 수 있어요.</p>' +
          '<div class="pill-info">' + icon('info', 16) +
          '<div>보호자 확인을 위한 서류를 등록해 주시면 관리자가 확인해 드려요.</div></div>',
        buttons: [
          { label: '닫기', value: 'cancel', variant: 'ghost' },
          { label: '서류 등록하러 가기', value: 'go', variant: 'primary' }
        ],
        onButton: function (v) {
          if (v !== 'go') return;
          S.suData = { consents: user.consents, ident: { name: user.name, phone: user.phone },
            account: { email: user.email }, resubmit: true };
          suGo(4);
        }
      });
      return;
    }
    if (code === 'rejected') {
      Modal.open({
        title: '서류를 다시 확인해 주세요', icon: 'alert',
        body: '<p class="muted mb-2">보내주신 서류를 확인하지 못했어요.</p>' +
          '<div class="callout mb-2"><div class="muted" style="font-size:.8rem">사유</div>' +
          '<b>' + esc(user.rejectReason || '서류를 판독하기 어려웠어요') + '</b></div>' +
          '<div class="pill-info">' + icon('bell', 16) +
          '<div>다시 제출해 주시면 빠르게 확인해 드릴게요. 결과는 <b>카카오 알림톡</b>으로 알려 드려요.</div></div>',
        buttons: [
          { label: '닫기', value: 'cancel', variant: 'ghost' },
          { label: '서류 다시 제출', value: 'go', variant: 'primary' }
        ],
        onButton: function (v) {
          if (v !== 'go') return;
          S.suData = { consents: user.consents, ident: { name: user.name, phone: user.phone },
            account: { email: user.email }, resubmit: true };
          suGo(4);
        }
      });
      return;
    }
    /* pending — 접수일과 예상 완료를 함께 보여 준다(없으면 문의가 몰린다) */
    Modal.open({
      title: '관리자 확인을 기다리고 있어요', icon: 'clock',
      body: '<p class="muted mb-2">제출해 주신 서류를 확인하고 있어요.</p>' +
        /* 라벨은 muted — faint(2.98:1)는 흰 배경에서 대비 기준에 못 미친다 */
        '<div class="callout mb-2">' +
          '<div class="row between wrap" style="gap:8px"><span class="muted">접수일</span>' +
            '<b>' + UI.fmtDate(user.submittedAt || user.createdAt) + '</b></div>' +
          '<div class="row between wrap" style="gap:8px;margin-top:4px"><span class="muted">확인 예정</span>' +
            '<b>영업일 1~2일 안</b></div></div>' +
        '<div class="pill-info">' + icon('bell', 16) +
        '<div>확인이 끝나면 <b>카카오 알림톡</b>으로 알려 드릴게요. 승인되면 바로 로그인하실 수 있어요.</div></div>',
      buttons: [
        { label: '확인', value: 'ok', variant: 'primary' },
        { label: '서류 다시 제출', value: 'go', variant: 'soft' }
      ],
      onButton: function (v) {
        if (v !== 'go') return;
        S.suData = { consents: user.consents, ident: { name: user.name, phone: user.phone },
          account: { email: user.email }, resubmit: true };
        suGo(4);
      }
    });
  }

  /* =====================================================================
   * 회원가입 — 5단계 (2026-08-05 확정 절차)
   *   ① 약관·동의 → ② 본인인증(Nice) → ③ 회원정보 → ④ 서류 등록 → ⑤ 접수 완료
   * 보호자 인증 서류를 관리자가 승인해야 로그인이 열린다.
   * ===================================================================== */
  var SU_STEPS = ['약관 동의', '본인인증', '회원정보', '서류 등록', '접수 완료'];
  var SU_DOCS = ['복지카드', '장애인증명서', '특수교육대상자 증명서'];
  var SU_DISABILITY = ['자폐 스펙트럼 장애', '지적장애', '발달지연', '뇌병변장애', '기타 발달장애'];

  /* 가입 임시 저장 — 새로고침·탭 복원으로도 입력이 날아가지 않게 sessionStorage에 둔다.
     탭을 닫으면 사라지고, 비밀번호는 저장하지 않는다. */
  var SU_KEY = 'scon_signupDraft';
  function suData() {
    if (!S.suData) {
      try {
        var raw = sessionStorage.getItem(SU_KEY);
        S.suData = raw ? JSON.parse(raw) : null;
      } catch (e) { S.suData = null; }
      if (!S.suData) S.suData = { consents: null, ident: null, account: null };
    }
    return S.suData;
  }
  function suSave() {
    var d = S.suData; if (!d) return;
    var keep = JSON.parse(JSON.stringify(d));
    if (keep.account) delete keep.account.password;   // 비밀번호는 임시 저장에서 제외
    try { sessionStorage.setItem(SU_KEY, JSON.stringify(keep)); }
    catch (e) {
      /* 용량 초과 — 가장 큰 서류 미리보기부터 덜어 낸다 */
      delete keep.docPreview;
      try { sessionStorage.setItem(SU_KEY, JSON.stringify(keep)); } catch (e2) {}
    }
  }
  function suClear() {
    S.suData = null; S.suStep = 1;
    try { sessionStorage.removeItem(SU_KEY); } catch (e) {}
  }
  /* 단계를 URL에 둔다 — 브라우저 뒤로가기가 '이전 단계'로 동작해야 한다.
     한 해시에 5단계를 담으면 뒤로가기 한 번에 입력이 전부 사라진다. */
  function suGo(n, replace) {
    S.suStep = n;
    suSave();
    App[replace ? 'replace' : 'navigate']('#/signup/' + n);
  }
  /* 새로고침·URL 직접 입력으로 앞 단계 데이터 없이 들어오면 되돌린다 */
  function suGuard(step) {
    var d = suData();
    /* 접수를 마쳤으면 앞 단계로 되돌아갈 수 없다 — 뒤로가기로 계정이 다시 만들어지면 안 된다 */
    if (d.account && d.account.submittedAt) return 5;
    if (step >= 2 && !d.consents) return 1;
    if (step >= 3 && !d.ident) return 1;
    if (step >= 4 && !d.account) return 1;
    /* 비밀번호는 임시 저장하지 않으므로, 새로고침 뒤에는 3단계에서 다시 받아야 한다.
       (재제출 경로는 계정이 이미 있어 비밀번호가 필요 없다) */
    if (step >= 4 && !d.resubmit && !d.account.password) return 3;
    if (step >= 5) return 1;     // 접수 전에는 완료 화면에 들어갈 수 없다
    return step;
  }
  function suShell(body) {
    var step = S.suStep;
    var bar = '<div class="su-steps">' + SU_STEPS.map(function (t, i) {
      var n = i + 1;
      return '<span class="su-step' + (n === step ? ' on' : n < step ? ' done' : '') + '">' +
        '<b>' + (n < step ? '✓' : n) + '</b>' + esc(t) + '</span>';
    }).join('') + '</div>';
    return '<div class="app-bar"><div class="brand" onclick="App.navigate(\'#/\')">' + UI.brandMark(34) +
      '<div class="wordmark"><b>Stellar Connect</b><span>S:CON · ASTROGEN</span></div></div></div>' +
      '<div class="container narrow" style="padding-top:32px">' +
        '<div class="card card-pad su-card" style="max-width:520px;margin:0 auto">' + bar + body + '</div>' +
        '<p class="center muted" style="margin:18px 0 40px;font-size:.9rem">이미 계정이 있으신가요? ' +
          '<a href="#/login" style="color:var(--primary);font-weight:700">로그인</a></p>' +
      '</div>';
  }
  /* 동의 항목 — 민감정보·본인확인은 개인정보보호법상 별도 동의 대상이라 한 줄씩 분리한다 */
  var SU_CONSENTS = [
    { k: 'terms',     req: true,  t: '서비스 이용약관' },
    { k: 'privacy',   req: true,  t: '개인정보 수집·이용 동의',
      d: '가입·본인확인·서비스 제공에 필요한 정보를 모아요. 탈퇴하면 30일 뒤 지워요.' },
    { k: 'sensitive', req: true,  t: '아이의 특성·건강 정보 처리 동의 (민감정보)',
      d: '장애 특성·복약 같은 정보는 따로 동의를 받아요. 이 동의가 있어야 설명서를 만들 수 있어요.' },
    { k: 'identity',  req: true,  t: '본인확인 서비스 이용 동의',
      d: '휴대폰 본인인증을 위해 본인확인기관에 정보를 전달해요.' },
    { k: 'age14',     req: true,  t: '만 14세 이상입니다' },
    { k: 'alimtalk',  req: false, t: '알림톡 수신 동의',
      d: '심사 결과·복약 알림 같은 소식을 카카오 알림톡으로 보내 드려요.' },
    { k: 'marketing', req: false, t: '서비스 소식·이벤트 수신' }
  ];

  var signup = {
    layout: 'public',
    render: function (p) {
      var d = suData();
      /* 단계는 URL이 정본 — 뒤로가기·새로고침·직접 입력 모두 여기로 들어온다 */
      var want = Math.max(1, Math.min(5, parseInt((p && p.step) || S.suStep, 10) || 1));
      var ok = suGuard(want);
      if (ok !== want) {
        S.suStep = ok;
        setTimeout(function () {
          if (ok === 1) toast('처음부터 다시 진행해 주세요');
          else if (ok === 3) toast('안전을 위해 비밀번호는 다시 입력해 주세요');
          suGo(ok, true);
        }, 0);
        return suShell('<p class="muted" style="padding:20px 0;text-align:center">불러오는 중…</p>');
      }
      S.suStep = want;
      if (S.suStep === 1) {
        return suShell(
          '<h1 class="mb-1">약관에 동의해 주세요</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">필요한 것만 최소로 모으고, 어디에 쓰는지 먼저 알려 드릴게요.</p>' +
          '<label class="checkline su-all"><input type="checkbox" id="su-all">' +
            '<span><b>전체 동의</b> <span class="faint" style="font-size:.82rem">— 선택 항목까지 모두</span></span></label>' +
          '<div class="divider"></div>' +
          SU_CONSENTS.map(function (c, i) {
            /* 필수 묶음이 끝나는 지점에 '선택 항목' 캡션 — 필수/선택 구분은 법적으로도 분명해야 한다 */
            var cap = (!c.req && SU_CONSENTS[i - 1] && SU_CONSENTS[i - 1].req)
              ? '<div class="su-optcap">선택 항목</div>' : '';
            return cap +
              '<label class="checkline su-c"><input type="checkbox" data-consent="' + c.k + '"' +
              (c.req ? ' data-req="1"' : '') + '>' +
              /* &nbsp; — 필수 표시(*)가 혼자 다음 줄로 떨어지지 않게 앞 단어에 붙인다 */
              '<span>' + esc(c.t) + (c.req ? '&nbsp;<span class="req">*</span>' : '') +
              (c.d ? '<span class="faint" style="display:block;font-size:.8rem;margin-top:3px">' +
                esc(c.d) + '</span>' : '') + '</span></label>';
          }).join('') +
          '<button class="btn btn-primary btn-block btn-lg su-next" id="su-next1">다음</button>');
      }
      if (S.suStep === 2) {
        var ok = !!d.ident;
        return suShell(
          '<h1 class="mb-1">본인인증</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">보호자 본인 확인을 위해 휴대폰 인증이 필요해요.</p>' +
          (ok
            ? '<div class="callout mb-2"><div class="row gap-sm" style="align-items:center">' +
                '<span class="badge ok dot">인증 완료</span>' +
                '<b>' + esc(d.ident.name) + '</b>' +
                '<span class="faint">' + esc(d.ident.phoneMask) + '</span></div></div>'
            : '<button class="btn btn-soft btn-block btn-lg mb-2" id="su-nice">' +
              icon('shield', 17) + '휴대폰으로 본인인증하기</button>') +
          '<div class="pill-info">' + icon('info', 16) +
            '<div>정식 서비스에서는 <b>NICE 본인확인</b> 창이 열려요. 지금은 시연용이라 ' +
            '입력하신 값으로 인증을 마친 것처럼 보여 드립니다.</div></div>' +
          '<div class="row gap-sm mt-2">' +
            '<button class="btn btn-ghost btn-lg" id="su-prev">이전</button>' +
            '<button class="btn btn-primary btn-lg" id="su-next2" style="flex:1"' +
              (ok ? '' : ' disabled') + '>다음</button></div>');
      }
      if (S.suStep === 3) {
        var id = d.ident || { name: '', phone: '' };
        return suShell(
          '<h1 class="mb-1">계정 만들기</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">이메일이 아이디가 돼요.</p>' +
          '<form id="su-form3">' +
            '<div class="field-row">' +
              '<div class="field"><label>이름</label>' +
                '<input class="input" value="' + esc(id.name) + '" disabled ' +
                'style="background:var(--surface-2)"></div>' +
              '<div class="field"><label>휴대전화</label>' +
                '<input class="input" value="' + esc(id.phone) + '" disabled ' +
                'style="background:var(--surface-2)"></div>' +
            '</div>' +
            '<p class="faint mb-2" style="font-size:.78rem">본인인증으로 확인된 정보예요.</p>' +
            /* label-for·autocomplete — 스크린리더 연결과 비밀번호 관리자 자동 채움.
               뒤로 왔을 때 값이 비어 있으면 다시 적어야 하므로 입력값을 되살린다
               (비밀번호는 보안상 되살리지 않는다) */
            '<div class="field"><label for="su-email">이메일 (아이디) <span class="req">*</span></label>' +
              '<input class="input" id="su-email" name="email" type="email" ' +
              'autocomplete="username" inputmode="email" placeholder="you@example.com" value="' +
              esc((d.account || {}).email || '') + '"></div>' +
            '<div class="field"><label for="su-pw">비밀번호 <span class="req">*</span> ' +
              '<span class="faint">8자 이상, 영문·숫자를 함께</span></label>' +
              '<input class="input" id="su-pw" name="password" type="password" ' +
              'autocomplete="new-password"></div>' +
            '<div class="field"><label for="su-pw2">비밀번호 확인 <span class="req">*</span></label>' +
              '<input class="input" id="su-pw2" name="password2" type="password" ' +
              'autocomplete="new-password">' +
              '<p class="su-pwmsg" id="su-pwmsg" aria-live="polite"></p></div>' +
            '<div class="row gap-sm mt-2">' +
              '<button type="button" class="btn btn-ghost btn-lg" id="su-prev">이전</button>' +
              '<button type="submit" class="btn btn-primary btn-lg" style="flex:1">다음</button></div>' +
          '</form>');
      }
      if (S.suStep === 4) {
        return suShell(
          '<h1 class="mb-1">아이 정보와 서류 등록</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">발달장애 아동 보호자를 위한 서비스라, ' +
            '보호자 확인을 위한 서류를 한 번 받고 있어요. 여기서 받은 정보는 아이 프로필의 시작점이 돼요.</p>' +
          '<form id="su-form4">' +
            /* 별명을 권하면 서류와 이름이 달라져 '이름이 서로 달라요'로 반려된다 —
               여기서는 서류상 이름을 받고, 부르는 이름은 나중에 바꾸게 안내한다 */
            '<div class="field"><label for="su-cname">아이 이름 <span class="req">*</span></label>' +
              '<input class="input" id="su-cname" name="childName" placeholder="예) 이준호" ' +
              'value="' + esc(d.childName || '') + '"></div>' +
            '<p class="faint mb-2" style="font-size:.78rem">' +
              '서류와 대조해야 해서 <b>서류에 적힌 이름 그대로</b> 적어 주세요. ' +
              '앱에서 부르는 이름은 등록 후 별명으로 바꿀 수 있어요.</p>' +
            '<div class="field-row">' +
              '<div class="field"><label for="su-cbirth">생년월일 <span class="req">*</span></label>' +
                '<input class="input" id="su-cbirth" name="childBirth" type="date" min="1900-01-01" max="' +
                UI.todayISO() + '" value="' + esc(d.childBirth || '') + '"></div>' +
              '<div class="field"><label for="su-dis">장애 유형 <span class="req">*</span></label>' +
                '<select class="select" id="su-dis" name="disabilityType">' +
                SU_DISABILITY.map(function (t) {
                  return '<option' + (d.disabilityType === t ? ' selected' : '') + '>' + esc(t) + '</option>';
                }).join('') +
                '</select></div>' +
            '</div>' +
            '<div class="field"><label for="su-doctype">제출 서류 <span class="req">*</span></label>' +
              '<select class="select" id="su-doctype" name="docType">' +
              SU_DOCS.map(function (t) {
                return '<option' + (d.docType === t ? ' selected' : '') + '>' + esc(t) + '</option>';
              }).join('') +
              '</select></div>' +
            /* '접수한 서류 종류가 맞지 않아요'도 반려 사유다 — 고른 종류와 사진을 맞추게 한다 */
            '<p class="faint mb-2" style="font-size:.78rem">' +
              '위에서 고른 종류와 <b>같은 서류</b>를 찍어 주세요. 셋 중 하나만 있으면 돼요.</p>' +
            /* 촬영 안내는 찍기 '전'에 있어야 한다 — 반려 사유 5종(흐림·가림·유효기간·
               이름 불일치·서류 종류)을 그대로 뒤집어 체크리스트로 만든다.
               미리보기는 제출 전에 스스로 알아차리게 하는 두 번째 관문. */
            '<div class="field"><label for="su-doc">서류 사진 <span class="req">*</span></label>' +
              '<div class="su-tips mb-2">' +
                '<div class="su-tips-h">' + icon('camera', 15) + '이렇게 찍으면 한 번에 확인돼요</div>' +
                '<ul>' +
                  '<li>서류 <b>네 귀퉁이가 모두</b> 나오게 — 잘리거나 손가락에 가리지 않게</li>' +
                  '<li>밝은 곳에서 <b>그림자 없이</b>, 글자에 초점을 맞춰서</li>' +
                  '<li><b>아이 이름과 유효기간</b>이 읽히는지 확인해 주세요</li>' +
                  '<li>원본이 없으면 <b>복사본·화면 캡처</b>도 괜찮아요</li>' +
                '</ul></div>' +
              '<div id="su-docprev" class="su-docprev' + (d.docPreview ? '' : ' hide') + '">' +
                (d.docPreview ? '<img src="' + d.docPreview + '" alt="첨부한 서류 사진 미리보기">' +
                  '<p>이 상태로 접수돼요. <b>아이 이름과 유효기간</b> 글자가 읽히나요? ' +
                  '흐리면 지금 다시 찍는 편이 훨씬 빨라요.</p>' : '') + '</div>' +
              '<label class="btn btn-soft btn-block su-docbtn" style="cursor:pointer">' + icon('camera', 16) +
                '<span id="su-docname" class="su-docfile">' + esc(d.docFile || '사진 선택') + '</span>' +
                '<input type="file" id="su-doc" accept="image/*" hidden></label></div>' +
            '<div class="pill-info mb-2">' + icon('lock', 16) +
              '<div><b>주민등록번호 뒷자리는 가리고</b> 촬영해 주세요. 서류 사진은 확인이 끝나면 ' +
              '<b>바로 파기</b>하고, 확인했다는 기록만 남겨요.</div></div>' +
            '<div class="row gap-sm">' +
              '<button type="button" class="btn btn-ghost btn-lg" id="su-prev">이전</button>' +
              '<button type="submit" class="btn btn-primary btn-lg" style="flex:1">제출하고 심사 요청</button></div>' +
          '</form>');
      }
      /* ⑤ 접수 완료 */
      var acc = d.account || {};
      return suShell(
        '<div style="text-align:center;padding:6px 0 2px">' +
          '<div style="color:var(--primary)">' + icon('check', 40) + '</div>' +
          '<h1 style="margin:10px 0 6px">서류를 접수했어요</h1>' +
          '<p class="muted" style="font-size:.94rem">관리자가 확인한 뒤에 서비스를 시작하실 수 있어요.</p>' +
        '</div>' +
        '<div class="callout mb-2"><div class="row between wrap" style="gap:8px">' +
          '<span class="faint">접수일</span><b>' + UI.fmtDate(acc.submittedAt || Store.nowISO()) + '</b></div>' +
          '<div class="row between wrap" style="gap:8px;margin-top:4px">' +
          '<span class="faint">확인 예정</span><b>영업일 1~2일 안</b></div></div>' +
        '<div class="pill-info mb-2">' + icon('bell', 16) +
          '<div>확인이 끝나면 <b>카카오 알림톡</b>으로 알려 드릴게요. ' +
          '승인되면 바로 로그인하실 수 있어요.</div></div>' +
        '<button class="btn btn-primary btn-block btn-lg" id="su-done">로그인 화면으로</button>');
    },

    mount: function () {
      var d = suData();
      var prev = UI.el('su-prev');
      /* 화면 안 [이전]도 히스토리를 되감아, 브라우저 뒤로가기와 동작이 어긋나지 않게 */
      if (prev) prev.onclick = function () { history.back(); };

      /* ① 동의 */
      var all = UI.el('su-all');
      if (all) {
        var boxes = [].slice.call(document.querySelectorAll('[data-consent]'));
        function syncAll() {
          all.checked = boxes.every(function (b) { return b.checked; });
        }
        all.onclick = function () {
          boxes.forEach(function (b) { b.checked = all.checked; });
        };
        boxes.forEach(function (b) { b.addEventListener('change', syncAll); });
        UI.el('su-next1').onclick = function () {
          var miss = boxes.filter(function (b) { return b.dataset.req && !b.checked; });
          if (miss.length) {
            toast('필수 항목에 동의해 주세요', 'err');
            miss[0].focus();
            return;
          }
          var c = { at: Store.nowISO() };
          boxes.forEach(function (b) { c[b.dataset.consent] = b.checked; });
          d.consents = c;
          suGo(2);
        };
      }

      /* ② 본인인증 — 시연용 시뮬레이션 (실서비스는 NICE 본인확인 창) */
      var nice = UI.el('su-nice');
      if (nice) nice.onclick = function () {
        Modal.open({
          title: 'NICE 본인확인 (시연)', icon: 'shield',
          body: '<p class="muted mb-2" style="font-size:.9rem">정식 서비스에서는 본인확인 창이 열려요. ' +
            '시연에서는 아래 정보로 인증을 마친 것으로 처리합니다.</p>' +
            '<div class="field"><label for="nice-name">이름</label>' +
              '<input class="input" id="nice-name" name="name" autocomplete="name" placeholder="홍길동"></div>' +
            '<div class="field-row">' +
              '<div class="field"><label for="nice-birth">생년월일</label>' +
                '<input class="input" id="nice-birth" name="birth" type="date" max="' + UI.todayISO() + '"></div>' +
              '<div class="field"><label for="nice-phone">휴대전화</label>' +
                '<input class="input" id="nice-phone" name="phone" type="tel" inputmode="numeric" ' +
                'autocomplete="tel" placeholder="010-0000-0000"></div></div>',
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '인증 완료', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var f = readForm(root);
            if (!f.name || !f.phone) { toast('이름과 휴대전화를 입력해 주세요', 'err'); return 'keep'; }
            var tail = f.phone.replace(/\D/g, '').slice(-4);
            d.ident = { name: f.name, birth: f.birth, phone: f.phone,
              phoneMask: '···-····-' + tail,
              di: 'DI-' + Store.uid('x').slice(-10) };
            App.refresh();
          }
        });
      };
      var n2 = UI.el('su-next2');
      if (n2) n2.onclick = function () { suGo(3); };

      /* ③ 회원정보 — 비밀번호 조건·일치를 입력 중에 바로 알려 준다(제출해야 아는 건 늦다) */
      var f3 = UI.el('su-form3');
      if (f3) {
        var pw = f3.querySelector('[name=password]'), pw2 = f3.querySelector('[name=password2]');
        var msg = UI.el('su-pwmsg');
        function pwCheck() {
          var v = pw.value, v2 = pw2.value;
          if (!v && !v2) { msg.textContent = ''; msg.className = 'su-pwmsg'; return; }
          if (v.length < 8 || !/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) {
            msg.textContent = '8자 이상, 영문과 숫자를 함께 넣어 주세요';
            msg.className = 'su-pwmsg warn'; return;
          }
          if (!v2) { msg.textContent = '한 번 더 입력해 주세요'; msg.className = 'su-pwmsg'; return; }
          var same = v === v2;
          msg.textContent = same ? '비밀번호가 일치해요' : '비밀번호가 서로 달라요';
          msg.className = 'su-pwmsg ' + (same ? 'ok' : 'warn');
        }
        pw.addEventListener('input', pwCheck);
        pw2.addEventListener('input', pwCheck);
      }
      if (f3) f3.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        function bad(sel, msg) {
          toast(msg, 'err');
          var el = e.target.querySelector(sel); if (el) el.focus();
        }
        if (!f.email || f.email.indexOf('@') < 0) { bad('[name=email]', '이메일을 확인해 주세요'); return; }
        if (Store.findUserByEmail(f.email)) { bad('[name=email]', '이미 가입된 이메일이에요'); return; }
        if ((f.password || '').length < 8) { bad('[name=password]', '비밀번호는 8자 이상으로 정해 주세요'); return; }
        if (!/[a-zA-Z]/.test(f.password) || !/[0-9]/.test(f.password)) {
          bad('[name=password]', '영문과 숫자를 함께 넣어 주세요'); return;
        }
        if (f.password !== f.password2) { bad('[name=password2]', '비밀번호가 서로 달라요'); return; }
        d.account = { email: f.email, password: f.password };
        suGo(4);
      });

      /* ④ 서류 등록 — 계정 생성 + 서류 접수를 한 번에 */
      var docInput = UI.el('su-doc');
      if (docInput) docInput.addEventListener('change', function () {
        var file = this.files[0];
        UI.el('su-docname').textContent = file ? file.name : '사진 선택';
        d.docFile = file ? file.name : '';
        var box = UI.el('su-docprev');
        if (!box) return;
        if (!file) { box.className = 'su-docprev hide'; box.innerHTML = ''; return; }
        UI.fileToDataURL(file, 900, function (url) {
          if (!url) { box.className = 'su-docprev hide'; return; }
          d.docPreview = url;   // 뒤로 왔다가 돌아와도 첨부가 남아 있게
          suSave();
          box.className = 'su-docprev';
          box.innerHTML = '<img src="' + url + '" alt="첨부한 서류 사진 미리보기">' +
            '<p>글자가 또렷하게 보이는지 확인해 주세요. 흐리면 다시 찍어 주세요.</p>';
        });
      });
      /* 4단계 입력은 이동할 때마다 담아 둔다 — 뒤로 갔다 와도 다시 적지 않게 */
      var f4form = UI.el('su-form4');
      if (f4form) f4form.addEventListener('input', function () {
        var v = readForm(f4form);
        d.childName = v.childName; d.childBirth = v.childBirth;
        d.disabilityType = v.disabilityType; d.docType = v.docType;
        suSave();
      });
      var f4 = UI.el('su-form4');
      if (f4) f4.addEventListener('submit', function (e) {
        e.preventDefault();
        var f = readForm(e.target);
        function bad(sel, msg) {
          toast(msg, 'err');
          var el = e.target.querySelector(sel);
          if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        }
        if (!f.childName) { bad('[name=childName]', '아이 이름 또는 별명을 적어 주세요'); return; }
        if (!f.childBirth) { bad('[name=childBirth]', '생년월일을 입력해 주세요'); return; }
        if (f.childBirth > UI.todayISO()) { bad('[name=childBirth]', '생년월일은 오늘까지만 고를 수 있어요'); return; }
        if (!d.docFile) { toast('서류 사진을 첨부해 주세요', 'err'); return; }
        var id = d.ident || {}, acc = d.account || {};
        /* 반려·미제출 계정의 재제출이면 이미 계정이 있다 — 가입을 다시 하지 않는다 */
        var owner = Store.findUserByEmail(acc.email);
        if (!owner) {
          var r = Store.signup({
            name: id.name, email: acc.email, password: acc.password, phone: id.phone,
            verified: true, di: id.di, consents: d.consents, status: 'nodoc'
          });
          if (!r.ok) { toast(r.error, 'err'); return; }
          owner = r.user;
        }
        var sub = Store.submitGuardianDocs(owner.id, {
          childName: f.childName, childBirth: f.childBirth,
          disabilityType: f.disabilityType, docType: f.docType, fileName: d.docFile,
          docImage: d.docPreview || ''   // 심사 동안만 보관 → 처리 시 파기
        });
        if (!sub.ok) { toast(sub.error, 'err'); return; }
        d.account.submittedAt = sub.user.submittedAt;
        suGo(5, true);   // 접수 후에는 뒤로가서 재제출되지 않게 replace
      });

      /* ⑤ 접수 완료 */
      var done = UI.el('su-done');
      if (done) done.onclick = function () {
        suClear();
        App.navigate('#/login');
      };
    }
  };

  /* =====================================================================
   * 대시보드
   * ===================================================================== */
  /* 홈에 표시할 아이 선택 — 저장된 선택이 유효하면 그것, 아니면 첫 아이 */
  function homeChildOf(kids) {
    if (!kids.length) return null;
    if (S.homeChild) {
      var found = kids.filter(function (k) { return k.id === S.homeChild; })[0];
      if (found) return found;
    }
    return kids[0];
  }

  var dashboard = {
    layout: 'app',
    render: function () {
      var u = Store.currentUser();
      var kids = Store.childrenOf(u.id);

      var html = pageHead('홈', u.name + '님, 안녕하세요 👋',
        '오늘 우리 아이의 하루를 함께 살펴보세요.');

      if (!kids.length) {
        html += '<div class="card empty"><div class="emoji">🧒</div>' +
          '<h3>아직 등록된 아이가 없어요</h3>' +
          '<p>아이를 등록하면 「내 아이 설명서」를 작성할 수 있어요.</p>' +
          '<button class="btn btn-primary" onclick="App.navigate(\'#/child/new\')">첫 아이 등록하기</button></div>';
        return html;
      }

      var child = homeChildOf(kids);

      // 아이 전환 칩 (2명 이상일 때만)
      if (kids.length > 1) {
        html += '<div class="home-switch">' + kids.map(function (c) {
          return '<button class="home-switch-chip' + (c.id === child.id ? ' on' : '') +
            '" data-homechild="' + c.id + '">' +
            '<span class="avatar">' + (c.photo ? '<img src="' + c.photo + '" alt="">'
              : esc(UI.initials(c.name))) + '</span>' + esc(c.name) + '</button>';
        }).join('') +
          '<button class="home-switch-chip add" onclick="App.navigate(\'#/child/new\')">' +
            icon('plus', 15) + '아이 추가</button></div>';
      }

      /* 1) 간단 프로필 — 이름·나이·진단·한 줄 소개 + 설명서 진행 + 핵심 동선 */
      /* 1) 간단 프로필 — 증명사진형 작은 사진 + 요즘 반짝인 순간 + (공간 남으면) 갤러리 사진들
         진단명·설명서 진행률은 노출하지 않음(양육자 배려) */
      var m = Store.getManual(child.id);
      var age = UI.calcAge(child.birthDate);
      var noteText = m && m.summaryNote ? m.summaryNote : '';
      var homeGallery = (child.gallery || []).slice().sort(function (a, b) {
        return (a.date || '') < (b.date || '') ? 1 : -1;
      }).slice(0, 6);
      // 반짝인 순간 — 변화 기록 우선, 없으면 컨디션 좋았던 기록
      var allRecs = Store.recordsOf(child.id);
      function byDateDesc(a, b) { return (a.date || '') < (b.date || '') ? 1 : -1; }
      var moment = allRecs.filter(function (r) { return r.type === 'change'; }).sort(byDateDesc)[0]
        || allRecs.filter(function (r) { return (r.mood || 3) >= 4; }).sort(byDateDesc)[0] || null;
      function agoText(ds) {
        var d = Math.floor((Date.now() - new Date(ds + 'T00:00:00').getTime()) / 864e5);
        return d <= 0 ? '오늘' : d === 1 ? '어제' : d + '일 전';
      }
      var momentBlock = moment
        ? '<a class="hp-moment" href="#/records/' + child.id + '">' +
            '<span class="hp-moment-ico">' + icon('sparkle', 16) + '</span>' +
            '<span class="hp-moment-body">' +
              '<span class="hp-moment-lab">요즘 ' + esc(child.name) + '의 반짝인 순간</span>' +
              '<span class="hp-moment-txt">“' + esc(moment.title) + '”' +
                '<span class="hp-moment-ago"> · ' + agoText(moment.date) + '</span></span>' +
            '</span>' +
            '<span class="hp-moment-arr">' + icon('chevR', 16) + '</span>' +
          '</a>'
        : '<div class="hp-moment hp-moment--empty">' +
            '<span class="hp-moment-ico">' + icon('sparkle', 16) + '</span>' +
            '<span class="hp-moment-body">' +
              '<span class="hp-moment-lab">요즘 ' + esc(child.name) + '의 반짝인 순간</span>' +
              '<span class="hp-moment-txt">이번 주 순간은 아직이에요. 사진 한 장이면 충분해요.</span>' +
            '</span>' +
          '</div>';
      var galleryBlock = homeGallery.length
        ? '<div class="hp-gallery-strip">' +
            homeGallery.slice(0, 4).map(function (g) {
              return '<a class="hp-photo" href="#/gallery/' + child.id + '">' +
                '<img src="' + g.photo + '" alt=""></a>';
            }).join('') +
            '<a class="hp-photo hp-photo-more" href="#/gallery/' + child.id + '">' +
              icon('grid', 16) + '<span>전체</span></a>' +
          '</div>'
        : '';
      var profile = '<div class="card home-profile">' +
        '<div class="hp-head">' +
          '<div class="avatar lg">' + (child.photo
            ? '<img src="' + child.photo + '" alt="">' : esc(UI.initials(child.name))) + '</div>' +
          '<div class="hp-meta">' +
            '<div class="hp-name">' + esc(child.name) + '</div>' +
            '<div class="hp-sub">' + (age != null ? '만 ' + age + '세' : '') + '</div>' +
          '</div>' +
          '<a class="hp-edit" href="#/child/' + child.id + '" aria-label="아이 프로필" title="아이 프로필">' +
            icon('user', 16) + '</a>' +
        '</div>' +
        (noteText ? '<p class="hp-intro">“' + esc(noteText) + '”</p>' : '') +
        momentBlock + galleryBlock +
        '<div class="hp-actions">' +
          '<a class="btn btn-primary btn-sm" href="#/manual/' + child.id + '">' +
            icon('edit', 15) + '설명서</a>' +
          '<a class="btn btn-soft btn-sm" href="#/share/' + child.id + '">' +
            icon('share', 15) + '대상별 공유</a>' +
        '</div>' +
      '</div>';

      /* 2) 복용 관리 — 복용 관리 화면의 '오늘의 복약' 패널을 그대로 재사용 */
      var medPanel = global.Views._medTodayPanel ? global.Views._medTodayPanel(child) : '';
      var medSection = '<section class="home-sec">' +
        '<div class="home-sec-head"><h2>복용 관리</h2>' +
          '<a class="hp-link" href="#/meds/' + child.id + '">전체 보기 ›</a></div>' +
        (medPanel ||
          '<div class="card card-pad"><p class="muted" style="font-size:.9rem;margin-bottom:10px">' +
          '등록된 복약 일정이 없어요. 복용 관리에서 약을 추가하면 오늘의 복약을 여기서 바로 체크할 수 있어요.</p>' +
          '<a class="btn btn-soft btn-sm" href="#/meds/' + child.id + '">' +
            icon('pill', 15) + '복용 관리로 가기</a></div>') +
      '</section>';

      /* 3) 기록 — Setlog식 빠른 기록 타일 + 최근 기록 피드 */
      var QUICK = [
        { k: 'behavior', label: '행동' }, { k: 'treatment', label: '치료' },
        { k: 'change', label: '변화' }, { k: 'assessment', label: '검사' }
      ];
      var quickTiles = '<div class="quick-log">' +
        QUICK.map(function (o) {
          var meta = RT[o.k];
          return '<button class="quick-tile" data-qrec="' + o.k + '">' +
            '<span class="qt-ico" style="background:' + meta.color + '22;color:' + meta.color + '">' +
              icon(meta.icon, 22) + '</span><span class="qt-label">' + o.label + '</span></button>';
        }).join('') +
        '<button class="quick-tile" data-qreels="1">' +
          '<span class="qt-ico" style="background:var(--brand-connect-soft);color:var(--brand-connect)">' +
            icon('video', 22) + '</span><span class="qt-label">영상</span></button>' +
      '</div>';

      var recs = Store.recordsOf(child.id).sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (a.createdAt || '') < (b.createdAt || '') ? 1 : -1;
      }).slice(0, 4);
      var feed = recs.length
        ? '<div class="timeline">' + recs.map(function (r) {
            return global.Views._recCardHTML ? global.Views._recCardHTML(r) : '';
          }).join('') + '</div>'
        : '<div class="card card-pad"><p class="muted center" style="padding:8px 0">' +
          '아직 기록이 없어요. 위 버튼으로 오늘 첫 순간을 남겨 보세요.</p></div>';

      /* 타일 5종만으로는 '기록하러 가는 버튼'으로 읽히지 않는다는 의견(아스트로젠 2).
         「+ 기록하기」를 기록 화면과 같은 모양으로 두고, 타일은 유형을 미리 고르는
         지름길로 성격을 밝힌다 — 빠른 기록의 이점은 유지하면서 진입점을 분명히 한다. */
      var recSection = '<section class="home-sec">' +
        '<div class="home-sec-head"><h2>기록</h2>' +
          '<a class="hp-link" href="#/records/' + child.id + '">전체 보기 ›</a></div>' +
        '<button class="btn btn-primary btn-block mb-2" id="home-add-rec">' +
          icon('plus', 16) + '기록하기</button>' +
        '<p class="quicklog-cap">유형을 고르면 바로 시작해요</p>' +
        quickTiles + feed +
      '</section>';

      html += profile + '<div class="home-grid">' + medSection + recSection + '</div>';
      return html;
    },
    mount: function () {
      var u = Store.currentUser();
      var kids = u ? Store.childrenOf(u.id) : [];
      var child = homeChildOf(kids);
      if (!child) return;

      document.querySelectorAll('[data-homechild]').forEach(function (b) {
        b.onclick = function () { S.homeChild = b.dataset.homechild; App.refresh(); };
      });
      var addRec = UI.el('home-add-rec');
      if (addRec) addRec.onclick = function () {
        if (global.Views._recordModal) global.Views._recordModal(child.id, null, {});
        else App.navigate('#/records/' + child.id);
      };
      document.querySelectorAll('[data-qrec]').forEach(function (b) {
        b.onclick = function () {
          if (global.Views._recordModal) global.Views._recordModal(child.id, null, { type: b.dataset.qrec });
          else App.navigate('#/records/' + child.id);
        };
      });
      var reels = document.querySelector('[data-qreels]');
      if (reels) reels.onclick = function () {
        if (global.Views._recordModal) global.Views._recordModal(child.id, null, { autoClip: true });
        else App.navigate('#/records/' + child.id);
      };
      // 복용 관리 패널·기록 피드 카드 배선 (해당 화면의 헬퍼 재사용)
      if (global.Views._wireMedToday) global.Views._wireMedToday(child);
      if (global.Views._wireRecCards) global.Views._wireRecCards(document);
    }
  };

  /* ---------- 아이디 찾기 / 비밀번호 재설정 ----------
     이메일이 곧 아이디라 잊으면 들어올 방법이 없었다. 가입 때 본인인증으로 확보한
     이름·휴대전화를 열쇠로 쓰고, 재설정은 알림톡 인증번호로 확인한다. */
  function recoverShell(title, sub, inner) {
    return '' +
      '<div class="app-bar"><div class="brand" onclick="App.navigate(\'#/\')">' + UI.brandMark(34) +
        '<div class="wordmark"><b>Stellar Connect</b><span>S:CON · ASTROGEN</span></div></div></div>' +
      '<div class="container narrow" style="padding-top:48px">' +
        '<div class="card card-pad" style="max-width:460px;margin:0 auto">' +
          '<h1 class="mb-1">' + title + '</h1>' +
          '<p class="muted mb-3" style="font-size:.92rem">' + sub + '</p>' +
          inner +
          '<p class="center muted" style="margin-top:20px;font-size:.9rem">' +
            '<a href="#/login" style="color:var(--primary);font-weight:700">로그인으로 돌아가기</a></p>' +
        '</div></div>';
  }

  var findId = {
    layout: 'public',
    render: function () {
      var r = S.findIdResult;
      if (r) {
        return recoverShell('아이디 찾기',
          r.length ? '가입하신 이메일이에요. 앞 두 글자만 보여 드려요.' : '',
          (r.length
            ? r.map(function (a) {
                return '<div class="card card-pad mb-2"><b style="font-size:1.05rem">' +
                  esc(a.masked) + '</b>' +
                  '<div class="muted" style="font-size:.85rem;margin-top:4px">' +
                  UI.fmtDate(a.createdAt) + ' 가입' +
                  (a.provider && a.provider !== 'email'
                    ? ' · ' + esc(a.provider) + ' 간편가입' : '') + '</div></div>';
              }).join('') +
              '<p class="muted" style="font-size:.85rem">비밀번호가 기억나지 않으면 ' +
              '<a href="#/reset-pw" style="color:var(--primary);font-weight:700">비밀번호 재설정</a>을 이용해 주세요.</p>'
            : '<div class="empty"><div class="emoji">🔍</div>' +
              '<p>입력하신 정보로 가입된 계정을 찾지 못했어요.</p>' +
              '<p class="muted" style="font-size:.88rem">이름과 휴대전화가 가입 때와 같은지 확인해 주세요. ' +
              '휴대전화 번호가 바뀌었다면 고객센터로 문의해 주세요.</p></div>') +
          '<button class="btn btn-soft btn-block mt-2" id="fi-again">다시 찾기</button>');
      }
      return recoverShell('아이디 찾기', '가입할 때 본인인증에 쓴 이름과 휴대전화를 입력해 주세요.',
        '<form id="fi-form">' +
          '<div class="field"><label for="fi-name">이름</label>' +
            '<input class="input" id="fi-name" name="name" autocomplete="name" required></div>' +
          '<div class="field"><label for="fi-phone">휴대전화</label>' +
            '<input class="input" id="fi-phone" name="phone" type="tel" inputmode="numeric" ' +
            'autocomplete="tel" placeholder="010-0000-0000" required></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">아이디 찾기</button>' +
        '</form>' +
        '<p class="faint mt-2" style="font-size:.8rem">' +
        '정식 서비스에서는 휴대폰 본인인증(NICE)으로 확인합니다.</p>');
    },
    mount: function () {
      var again = UI.el('fi-again');
      if (again) again.onclick = function () { S.findIdResult = null; App.refresh(); };
      var f = UI.el('fi-form');
      if (!f) return;
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = readForm(e.target);
        if (!v.name || !v.phone) { toast('이름과 휴대전화를 입력해 주세요', 'err'); return; }
        S.findIdResult = Store.findAccounts(v.name, v.phone);
        App.refresh();
      });
    }
  };

  var resetPw = {
    layout: 'public',
    render: function () {
      var st = S.pwStep || 1;
      if (st === 3) {
        return recoverShell('비밀번호 재설정', '새 비밀번호를 정해 주세요.',
          '<form id="pw-form3">' +
            '<div class="field"><label for="pw-new">새 비밀번호</label>' +
              '<input class="input" id="pw-new" name="password" type="password" ' +
              'autocomplete="new-password" placeholder="8자 이상, 영문과 숫자 포함"></div>' +
            '<div class="field"><label for="pw-new2">새 비밀번호 확인</label>' +
              '<input class="input" id="pw-new2" name="password2" type="password" ' +
              'autocomplete="new-password"></div>' +
            '<p id="pw-msg" class="muted" style="font-size:.82rem;margin:-4px 0 12px" aria-live="polite"></p>' +
            '<button class="btn btn-primary btn-block btn-lg" type="submit">비밀번호 바꾸기</button>' +
          '</form>');
      }
      if (st === 2) {
        return recoverShell('비밀번호 재설정',
          '알림톡으로 보낸 6자리 인증번호를 입력해 주세요.',
          '<form id="pw-form2">' +
            '<div class="field"><label for="pw-code">인증번호</label>' +
              '<input class="input" id="pw-code" name="code" inputmode="numeric" ' +
              'maxlength="6" placeholder="6자리"></div>' +
            '<button class="btn btn-primary btn-block btn-lg" type="submit">확인</button>' +
          '</form>' +
          (S.pwDemoCode
            ? '<div class="pill-info mt-2">' + icon('info', 16) +
              '<div>시연용 인증번호: <b>' + esc(S.pwDemoCode) + '</b><br>' +
              '정식 서비스에서는 알림톡으로만 전달됩니다.</div></div>'
            : '') +
          '<button class="btn btn-ghost btn-block mt-2" id="pw-back">이메일 다시 입력</button>');
      }
      return recoverShell('비밀번호 재설정',
        '가입하신 이메일로 인증번호를 보내 드릴게요.',
        '<form id="pw-form1">' +
          '<div class="field"><label for="pw-email">이메일</label>' +
            '<input class="input" id="pw-email" name="email" type="email" ' +
            'autocomplete="username" required></div>' +
          '<button class="btn btn-primary btn-block btn-lg" type="submit">인증번호 받기</button>' +
        '</form>' +
        '<p class="muted mt-2" style="font-size:.85rem">아이디가 기억나지 않으면 ' +
        '<a href="#/find-id" style="color:var(--primary);font-weight:700">아이디 찾기</a>를 먼저 해 주세요.</p>');
    },
    mount: function () {
      var f1 = UI.el('pw-form1');
      if (f1) f1.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = readForm(e.target);
        if (!v.email) { toast('이메일을 입력해 주세요', 'err'); return; }
        var r = Store.requestPasswordReset(v.email);
        /* 가입 여부를 알려 주지 않는다 — 없는 이메일에도 같은 안내를 보여 준다 */
        S.pwStep = 2; S.pwDemoCode = r.demoCode || '';
        toast('인증번호를 보냈어요. 알림톡을 확인해 주세요', 'ok');
        App.refresh();
      });
      var f2 = UI.el('pw-form2');
      if (f2) f2.addEventListener('submit', function (e) {
        e.preventDefault();
        var v = readForm(e.target);
        var r = Store.verifyResetCode(v.code);
        if (!r.ok) { toast(r.error, 'err'); return; }
        S.pwStep = 3; App.refresh();
      });
      var back = UI.el('pw-back');
      if (back) back.onclick = function () { S.pwStep = 1; S.pwDemoCode = ''; App.refresh(); };

      var f3 = UI.el('pw-form3');
      if (f3) {
        var p1 = UI.el('pw-new'), p2 = UI.el('pw-new2'), msg = UI.el('pw-msg');
        function check() {
          var a = p1.value, b = p2.value;
          if (!a) { msg.textContent = ''; return; }
          if (!(a.length >= 8 && /[A-Za-z]/.test(a) && /\d/.test(a))) {
            msg.textContent = '8자 이상, 영문과 숫자를 함께 넣어 주세요.';
            msg.className = 'su-pwmsg warn'; return;
          }
          if (b && a !== b) { msg.textContent = '두 비밀번호가 서로 달라요.'; msg.className = 'su-pwmsg warn'; return; }
          msg.textContent = b ? '사용할 수 있어요.' : '조건을 만족해요. 한 번 더 입력해 주세요.';
          msg.className = 'su-pwmsg ok';
        }
        p1.addEventListener('input', check); p2.addEventListener('input', check);
        f3.addEventListener('submit', function (e) {
          e.preventDefault();
          var a = p1.value, b = p2.value;
          if (!(a.length >= 8 && /[A-Za-z]/.test(a) && /\d/.test(a))) {
            toast('8자 이상, 영문과 숫자를 함께 넣어 주세요', 'err'); p1.focus(); return;
          }
          if (a !== b) { toast('두 비밀번호가 서로 달라요', 'err'); p2.focus(); return; }
          var r = Store.completePasswordReset(a);
          if (!r.ok) { toast(r.error, 'err'); return; }
          S.pwStep = 1; S.pwDemoCode = '';
          toast('비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요', 'ok');
          App.navigate('#/login');
        });
      }
    }
  };


  global.Views = {
    _S: S, _MSEC: MSEC, _MTABS: MTABS, _RT: RT, _REL_OPTS: REL_OPTS,
    _readForm: readForm, _readRows: readRows, _ownedChild: ownedChild,
    _notFound: notFound, _manualCount: manualCount,
    _childContextBar: childContextBar, _pageHead: pageHead,
    home: home, login: login, signup: signup, dashboard: dashboard,
    findId: findId, resetPw: resetPw,
    /* 가입 화면에 새로 들어올 때마다 1단계부터. 이전 사용자의 입력이 남아 있으면
       다음 방문자가 4단계로 들어가 버리므로 데이터까지 지운다.
       단 로그인 모달의 '서류 다시 제출'처럼 단계를 지정해 보낸 경우(suResume)만 유지한다 */
    _resetSignup: function (step) {
      if (step) return;   // URL에 단계가 있으면 유지 — 유효성은 suGuard가 판단한다
      suClear();
    },
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
