/* =====================================================================
 * app.js — 라우터 / 앱 셸 / 부팅
 * ===================================================================== */
(function (global) {
  'use strict';
  var icon = UI.icon, esc = UI.esc;

  /* ---------- 라우트 정의 ---------- */
  var ROUTES = [
    { segs: ['child', 'new'],            view: 'childEdit' },
    { segs: ['child', ':id', 'edit'],    view: 'childEdit' },
    { segs: ['child', ':id'],            view: 'childProfile' },
    { segs: ['manual', ':childId'],      view: 'manual' },
    { segs: ['summary', ':childId'],     view: 'summary' },
    { segs: ['records', ':childId'],     view: 'records' },
    { segs: ['meds', ':childId'],        view: 'meds' },
    { segs: ['gallery', ':childId'],     view: 'gallery' },
    { segs: ['plan', ':childId'],        view: 'plan' },
    { segs: ['share', ':childId'],       view: 'share' },
    { segs: ['v', ':token'],             view: 'viewer' },
    { segs: ['dashboard'],               view: 'dashboard' },
    { segs: ['caregiver'],               view: 'caregiver' },
    { segs: ['admin'],                   view: 'admin' },
    { segs: ['login'],                   view: 'login' },
    { segs: ['signup'],                  view: 'signup' },
    { segs: ['signup', ':step'],         view: 'signup' },   // 단계별 URL — 뒤로가기가 이전 단계로
    { segs: [],                          view: 'home' }
  ];

  function parseHash() {
    var raw = (location.hash || '').replace(/^#\/?/, '');
    var segs = raw.split('/').filter(function (s) { return s.length; });
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      if (r.segs.length !== segs.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < r.segs.length; j++) {
        if (r.segs[j].charAt(0) === ':') params[r.segs[j].slice(1)] = decodeURIComponent(segs[j]);
        else if (r.segs[j] !== segs[j]) { ok = false; break; }
      }
      if (ok) return { view: r.view, params: params };
    }
    return { view: 'home', params: {} };
  }

  /* ---------- 네비게이션 정의 ----------
     아이 컨텍스트 칩 바를 좌측 메뉴로 통합(중복 혼란 제거) — 프로필·대상별 공유가 메뉴에 포함 */
  var NAV_MAP = {
    dashboard: 'dashboard', childProfile: 'profile', childEdit: 'profile',
    manual: 'manual', summary: 'manual', share: 'share', records: 'records',
    meds: 'meds', gallery: 'gallery', plan: 'plan', caregiver: 'caregiver', admin: 'admin'
  };

  /* 아이가 있어야만 열리는 화면 — 아이 등록 화면(#/child/new)은 제외 */
  var CHILD_VIEWS = ['childProfile', 'manual', 'summary', 'records', 'meds',
    'gallery', 'plan', 'share'];
  function needsChild(r) {
    if (r.view === 'childEdit') return !!r.params.id;   // 수정은 아이 필요, 신규 등록은 아님
    return CHILD_VIEWS.indexOf(r.view) >= 0;
  }

  /* 현재 아이 — 반드시 '로그인한 보호자가 소유한 아이'만 반환한다.
     계정을 바꿔도 이전 사용자의 childId가 메뉴 링크에 남지 않도록 소유권을 검증(2026-07-31). */
  function currentChildId(r) {
    var u = Store.currentUser();
    if (!u) return null;
    function owned(id) {
      if (!id) return null;
      var c = Store.getChild(id);
      return (c && c.ownerId === u.id) ? id : null;
    }
    var byRoute = owned(r.params.childId) ||
      ((r.view === 'childProfile' || r.view === 'childEdit') ? owned(r.params.id) : null);
    if (byRoute) return byRoute;
    var remembered = owned(App.lastChildId);
    if (remembered) return remembered;
    var kids = Store.childrenOf(u.id);
    return kids[0] ? kids[0].id : null;
  }

  /* 아이 미등록(locked) — 메뉴는 그대로 보이되 잠그고, 클릭하면 등록 화면으로 보낸다.
     숨기면 서비스 범위를 알 수 없고, 등록 후 메뉴가 늘어나 화면 구조가 바뀐 것처럼 느껴진다. */
  function navItems(cur, locked) {
    var c = cur || '';
    return [
      { key: 'dashboard', label: '홈',          icon: 'home',  hash: '#/dashboard' },
      { key: 'profile',   label: '아이 프로필', icon: 'smile', hash: '#/child/' + c,   locked: locked },
      { key: 'manual',    label: '설명서',      icon: 'book',  hash: '#/manual/' + c,  locked: locked },
      { key: 'records',   label: '기록',        icon: 'note',  hash: '#/records/' + c, locked: locked },
      { key: 'meds',      label: '복용 관리',   icon: 'pill',  hash: '#/meds/' + c,    locked: locked },
      { key: 'gallery',   label: '갤러리',      icon: 'camera', hash: '#/gallery/' + c, locked: locked },
      { key: 'plan',      label: '미래 준비',   icon: 'flag',  hash: '#/plan/' + c,    locked: locked },
      { key: 'share',     label: '대상별 공유', icon: 'share', hash: '#/share/' + c,   locked: locked }
      /* 양육자 정보는 좌측/더보기 메뉴에서 제외 — 우측 계정 드롭다운에만 유지(사용자 의견) */
    ];
  }
  /* 잠금 항목은 <a>가 아닌 <button> — href가 없어야 주소창 변화·새 탭 열기가 원천 차단된다.
     disabled 대신 aria-disabled + tabindex 유지 (포커스가 빠지면 잠긴 이유를 들을 수 없다) */
  function navItemHTML(it, active) {
    if (it.locked) {
      return '<button class="nav-item locked" aria-disabled="true" data-lock="' + esc(it.label) + '">' +
        icon(it.icon, 19) + '<span>' + esc(it.label) + '</span>' + icon('lock', 13) + '</button>';
    }
    return '<a class="nav-item' + (active === it.key ? ' active' : '') + '" href="' + it.hash + '">' +
      icon(it.icon, 19) + '<span>' + esc(it.label) + '</span></a>';
  }
  /* 모바일 하단 탭 4개 고정 (나머지는 더보기) */
  var BOTTOM_KEYS = ['dashboard', 'manual', 'records', 'gallery'];

  /* ---------- 앱 셸 ---------- */
  function shell(r) {
    var u = Store.currentUser();
    var cur = currentChildId(r);
    var active = NAV_MAP[r.view] || '';
    var kids = Store.childrenOf(u.id);
    var items = navItems(cur, !kids.length);

    // 사이드바
    var sideNav = '<div class="nav-group-label">메뉴</div>' +
      items.map(function (it) { return navItemHTML(it, active); }).join('');
    if (u.role === 'admin') {
      sideNav += '<div class="nav-group-label">운영</div>' +
        '<a class="nav-item' + (active === 'admin' ? ' active' : '') + '" href="#/admin">' +
        icon('settings', 19) + '<span>백오피스</span></a>';
    }

    // 앱바 — 아이가 1명이면(대부분의 가정) 전환 드롭다운 없이 프로필 바로가기 칩
    var childSwitch = kids.length
      ? '<button class="child-switch" id="child-switch" title="' +
          (kids.length > 1 ? '아이 전환' : '아이 프로필') + '">' +
          '<span class="avatar">' + (function () {
            var cc = cur ? Store.getChild(cur) : kids[0];
            return cc && cc.photo ? '<img src="' + cc.photo + '">' : esc(UI.initials(cc ? cc.name : ''));
          })() + '</span>' +
          '<span class="nm-full">' + esc((cur ? (Store.getChild(cur) || {}).name : kids[0].name) || '아이 선택') +
          '</span>' + (kids.length > 1 ? icon('chevD', 15) : '') + '</button>'
      : '';

    var appbar = '<div class="app-bar">' +
      '<div class="brand" id="brand">' + UI.brandMark(36) +
        '<div class="wordmark"><b>내 아이 설명서</b>' +
        '<span>Stellar Connect · S:CON</span></div></div>' +
      '<div class="spacer"></div>' +
      childSwitch +
      '<button class="btn-icon app-help" id="help-btn" aria-label="이 화면 도움말" title="이 화면 도움말">' +
        icon('help', 18) + '</button>' +
      '<div class="usermenu"><button class="trigger" id="user-trigger">' +
        '<span class="avatar">' + esc(UI.initials(u.name)) + '</span>' +
        '<span class="nm-full" style="font-weight:700;font-size:.9rem">' + esc(u.name) + '</span>' +
        icon('chevD', 15) + '</button>' +
        '<div class="dropdown hide" id="user-dropdown">' +
          '<button id="menu-tour">' + icon('info', 16) + '둘러보기 가이드</button>' +
          '<button id="menu-tutorial">' + icon('book', 16) + '메뉴별 튜토리얼</button>' +
          '<button data-go="#/caregiver">' + icon('user', 16) + '양육자 정보</button>' +
          (u.role === 'admin'
            ? '<button data-go="#/admin">' + icon('settings', 16) + '백오피스</button>' : '') +
          '<div class="sep"></div>' +
          '<button id="menu-reset">' + icon('alert', 16) + '데모 데이터 초기화</button>' +
          '<button id="menu-logout">' + icon('logout', 16) + '로그아웃</button>' +
        '</div></div>' +
    '</div>';

    // 하단 탭바 (모바일)
    var bottom = '<nav class="bottom-nav">' +
      items.filter(function (it) { return BOTTOM_KEYS.indexOf(it.key) >= 0; }).map(function (it) {
        if (it.locked) {
          return '<button class="locked" aria-disabled="true" data-lock="' + esc(it.label) + '">' +
            icon(it.icon, 22) + '<span>' + esc(it.label) + '</span>' + icon('lock', 11) + '</button>';
        }
        return '<a href="' + it.hash + '" class="' + (active === it.key ? 'active' : '') + '">' +
          icon(it.icon, 22) + '<span>' + esc(it.label) + '</span></a>';
      }).join('') +
      '<button id="more-btn">' + icon('menu', 22) + '<span>더보기</span></button>' +
    '</nav>';

    return '<div class="app-shell">' + appbar +
      '<div class="app-body">' +
        '<aside class="sidebar">' + sideNav +
          '<div class="side-foot">치료를 넘어, 동반자로<br><b>ASTROGEN</b> 디지털 헬스케어</div>' +
        '</aside>' +
        '<main class="app-main">' +
          '<div class="container" id="view-root"></div>' +
          '<div class="app-foot">내 아이 설명서 · Stellar Connect (S:CON) by <b>ASTROGEN</b></div>' +
        '</main>' +
      '</div>' + bottom + '</div>';
  }

  function wireShell(r) {
    var u = Store.currentUser();
    UI.el('brand').onclick = function () { App.navigate('#/dashboard'); };

    var trigger = UI.el('user-trigger'), dd = UI.el('user-dropdown');
    trigger.onclick = function (e) { e.stopPropagation(); dd.classList.toggle('hide'); };
    document.addEventListener('click', function () { dd.classList.add('hide'); }, { once: true });
    dd.querySelectorAll('[data-go]').forEach(function (b) {
      b.onclick = function () { App.navigate(b.dataset.go); };
    });
    var mt = UI.el('menu-tour');
    if (mt) mt.onclick = function () { dd.classList.add('hide'); if (global.Tour) Tour.start(); };
    var mtu = UI.el('menu-tutorial');
    if (mtu) mtu.onclick = function () { dd.classList.add('hide'); if (global.Tutorial) Tutorial.openCenter(); };
    var hb = UI.el('help-btn');
    if (hb) hb.onclick = function () { if (global.Help) Help.open(r.view); };
    UI.el('menu-logout').onclick = function () {
      Store.logout(); App.lastChildId = null;   // 계정 전환 시 이전 아이 컨텍스트 잔류 방지
      UI.toast('로그아웃했어요', 'ok'); App.navigate('#/');
    };
    UI.el('menu-reset').onclick = function () {
      UI.Modal.confirm({ title: '데모 데이터 초기화', danger: true,
        message: '모든 데이터를 지우고 초기 데모 상태로 되돌립니다.\n계속할까요?', okLabel: '초기화' })
        .then(function (ok) {
          if (!ok) return;
          Store.resetDB(); Seed.seedIfEmpty();
          UI.toast('처음 상태로 되돌렸어요', 'ok'); App.navigate('#/');
        });
    };

    var cs = UI.el('child-switch');
    if (cs) cs.onclick = function () {
      var kids = Store.childrenOf(u.id);
      // 아이가 1명이면 선택 모달 없이 프로필로 바로 이동
      if (kids.length === 1) {
        App.lastChildId = kids[0].id;
        App.navigate('#/child/' + kids[0].id);
        return;
      }
      UI.Modal.open({
        title: '아이 선택', icon: 'users',
        body: kids.map(function (c) {
          return '<button class="card child-card" style="width:100%;margin-bottom:8px" data-pick="' +
            c.id + '"><div class="avatar lg">' + (c.photo
              ? '<img src="' + c.photo + '">' : esc(UI.initials(c.name))) + '</div>' +
            '<div class="meta"><div class="nm">' + esc(c.name) + '</div>' +
            '<div class="sub">' + esc(c.disability.type) + '</div></div>' +
            icon('chevR', 18) + '</button>';
        }).join('') +
        '<button class="btn btn-soft btn-block" data-pick="new">' + icon('plus', 16) + '새 아이 등록</button>',
        buttons: [],
        onMount: function (root) {
          root.querySelectorAll('[data-pick]').forEach(function (b) {
            b.onclick = function () {
              UI.Modal.close();
              if (b.dataset.pick === 'new') App.navigate('#/child/new');
              else { App.lastChildId = b.dataset.pick; App.navigate('#/child/' + b.dataset.pick); }
            };
          });
        }
      });
    };

    var more = UI.el('more-btn');
    if (more) more.onclick = function () { openDrawer(r); };

    // 잠금 메뉴(사이드·하단탭) — 이동 대신 무엇이 잠겼는지 알리고 등록 화면으로
    document.querySelectorAll('[data-lock]').forEach(function (b) {
      b.onclick = function () { lockedNudge(b.dataset.lock); };
    });
  }

  /* 잠금 메뉴 클릭 — 왜 등록 화면으로 왔는지 알려주고 바로 이동.
     replace로 이동해야 뒤로가기 시 잠긴 메뉴로 되돌아갔다 다시 튕기는 루프가 생기지 않는다. */
  function lockedNudge(label) {
    UI.toast('아이를 등록하면 「' + label + '」을 사용할 수 있어요');
    App.replace('#/child/new');
  }

  function openDrawer(r) {
    var u = Store.currentUser();
    var cur = currentChildId(r);
    var lock = !Store.childrenOf(u.id).length;
    var links = [
      { t: '아이 프로필', i: 'smile', h: '#/child/' + cur, lock: lock },
      { t: '복용 관리', i: 'pill', h: '#/meds/' + cur, lock: lock },
      { t: '미래 준비', i: 'flag', h: '#/plan/' + cur, lock: lock },
      { t: '대상별 공유', i: 'share', h: '#/share/' + cur, lock: lock }
      /* 양육자 정보는 계정 드롭다운에만 유지 */
    ];
    if (u.role === 'admin') links.push({ t: '백오피스', i: 'settings', h: '#/admin' });

    var bd = document.createElement('div');
    bd.className = 'drawer-backdrop';
    var dr = document.createElement('div');
    dr.className = 'drawer';
    dr.innerHTML = '<div class="row between mb-2"><b>전체 메뉴</b>' +
      '<button class="btn-icon" id="drawer-x">' + icon('x', 18) + '</button></div>' +
      links.map(function (l) {
        if (l.lock) {
          return '<button class="nav-item locked" aria-disabled="true" data-lock="' + esc(l.t) + '">' +
            icon(l.i, 19) + '<span>' + esc(l.t) + '</span>' + icon('lock', 13) + '</button>';
        }
        return '<a class="nav-item" href="' + l.h + '">' + icon(l.i, 19) +
          '<span>' + esc(l.t) + '</span></a>';
      }).join('') +
      '<div class="divider"></div>' +
      '<button class="nav-item" id="drawer-logout">' + icon('logout', 19) + '<span>로그아웃</span></button>';
    document.body.appendChild(bd);
    document.body.appendChild(dr);
    function close() { bd.remove(); dr.remove(); }
    bd.onclick = close;
    dr.querySelector('#drawer-x').onclick = close;
    dr.querySelectorAll('a').forEach(function (a) { a.onclick = close; });
    dr.querySelectorAll('[data-lock]').forEach(function (b) {
      b.onclick = function () { close(); lockedNudge(b.dataset.lock); };
    });
    dr.querySelector('#drawer-logout').onclick = function () {
      close(); Store.logout(); App.lastChildId = null; App.navigate('#/');
    };
  }

  /* ---------- 라우팅 실행 ---------- */
  function route() {
    if (Views._clipCleanup) Views._clipCleanup();
    var r = parseHash();
    var view = Views[r.view];
    var app = UI.el('app');
    var loggedIn = !!Store.currentUser();

    // 로그인 사용자가 로그인/가입 페이지 접근 시 대시보드로
    if (loggedIn && (r.view === 'login' || r.view === 'signup')) {
      location.hash = '#/dashboard'; return;
    }
    // 가입 화면에 처음 들어오면 1단계부터
    if (r.view === 'signup' && App._lastView !== 'signup' && Views._resetSignup) {
      Views._resetSignup(r.params.step);
    }
    App._lastView = r.view;
    // 앱 레이아웃은 로그인 필요
    if (view.layout === 'app' && !loggedIn) {
      location.hash = '#/login'; return;
    }
    /* 아이 종속 화면 가드 — 아이가 한 명도 없으면 URL·북마크·QR로 들어와도 홈으로.
       replace라 뒤로가기 무한 루프가 생기지 않는다. */
    if (loggedIn && needsChild(r) &&
        !Store.childrenOf(Store.currentUser().id).length) {
      UI.toast('먼저 아이를 등록해 주세요');
      App.replace('#/dashboard'); return;
    }
    // 현재 아이 기억
    var cc = currentChildId(r);
    if (cc) App.lastChildId = cc;

    var doAnim = App._animate !== false;
    App._animate = true;
    try {
      if (view.layout === 'public') {
        app.innerHTML = view.render(r.params);
        if (doAnim) { app.classList.remove('view-anim'); void app.offsetWidth; app.classList.add('view-anim'); }
        if (view.mount) view.mount(r.params, app);
      } else {
        app.innerHTML = shell(r);
        var root = UI.el('view-root');
        root.innerHTML = view.render(r.params);
        if (doAnim) root.classList.add('view-anim');
        wireShell(r);
        if (view.mount) view.mount(r.params, root);
      }
    } catch (e) {
      console.error('렌더링 오류', e);
      app.innerHTML = '<div class="container narrow"><div class="card card-pad">' +
        '<h2>화면을 표시하는 중 문제가 발생했습니다</h2>' +
        '<p class="muted">' + esc(e.message) + '</p>' +
        '<button class="btn btn-primary" onclick="location.hash=\'#/dashboard\'">대시보드로</button>' +
        '</div></div>';
    }
    window.scrollTo(0, App._scroll || 0);
    App._scroll = 0;
    var pageTitle = ({
      login: '로그인', signup: '회원가입',
      dashboard: '홈', manual: '내 아이 설명서', summary: '설명서 미리보기',
      records: '기록', meds: '복용 관리', gallery: '갤러리',
      share: '대상별 설명서·공유', plan: '미래 준비',
      viewer: '설명서 열람', caregiver: '양육자 정보', admin: '백오피스',
      childProfile: '아이 프로필', childEdit: '아이 정보'
    })[r.view];
    document.title = pageTitle
      ? pageTitle + ' · 내 아이 설명서'
      : '내 아이 설명서 · Stellar Connect (S:CON)';

    // 첫 방문 셀프 온보딩 — 대시보드에서 1회 자동 안내
    if (r.view === 'dashboard' && global.Tour) global.Tour.maybeAuto();
  }

  /* ---------- App 전역 ---------- */
  global.App = {
    _scroll: 0,
    lastChildId: null,
    navigate: function (hash) {
      if (location.hash === hash) route();
      else location.hash = hash;
    },
    /* 히스토리에 남기지 않고 이동 — 가드·잠금 메뉴처럼 '되돌아가면 안 되는' 이동에 사용 */
    replace: function (hash) {
      if (location.hash === hash) { route(); return; }
      location.replace(location.pathname + location.search + hash);
    },
    refresh: function () {
      App._scroll = window.scrollY || window.pageYOffset || 0;
      App._animate = false;
      route();
    },
    currentUser: function () { return Store.currentUser(); }
  };

  window.addEventListener('hashchange', function () { App._scroll = 0; route(); });

  /* ---------- 다른 탭에서의 변경 반영 ----------
     DB가 localStorage 단일 JSON이라, 두 탭이 각자의 옛 스냅샷을 저장하면 나중 저장이
     앞의 변경을 통째로 덮어쓴다. 다른 탭의 저장을 감지해 이 탭을 즉시 최신 상태로 맞춘다.
     (입력 중에는 작성 내용이 날아가지 않도록 새로고침을 미룬다) */
  function busyEditing() {
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true;
    var mh = document.getElementById('modal-host');
    return !!(mh && mh.children.length);
  }
  /* 미뤄 둔 최신화 반영 — 입력·모달이 끝난 어느 시점에든 안전하게 적용 */
  function flushStaleDB() {
    if (!App._staleDB || busyEditing()) return;
    App._staleDB = false;
    App.refresh();
    UI.toast('다른 탭에서 변경한 내용을 불러왔어요');
  }
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key === 'ichild.session.v1') {   // 다른 탭에서 로그인·로그아웃
      App.lastChildId = null;
      route();
      return;
    }
    if (e.key !== 'ichild.db.v1') return;
    App._staleDB = true;
    flushStaleDB();   // 입력 중이면 아래 이벤트들에서 다시 시도한다
  });
  /* 입력·모달이 끝나는 순간을 여러 경로로 잡는다 (환경에 따라 focusout이 오지 않기도 함) */
  document.addEventListener('focusout', function () { setTimeout(flushStaleDB, 120); });
  document.addEventListener('click', function () { setTimeout(flushStaleDB, 0); }, true);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) flushStaleDB();
  });

  /* ---------- 하이브리드(Capacitor) — Android 하드웨어 뒤로가기 ---------- */
  function setupHybridBackButton() {
    var cap = global.Capacitor;
    if (!cap || !cap.Plugins || !cap.Plugins.App) return;
    cap.Plugins.App.addListener('backButton', function () {
      // 1) 모달이 열려 있으면 모달부터 닫는다
      var mh = document.getElementById('modal-host');
      if (mh && mh.children.length) { UI.Modal.close(); return; }
      // 2) 홈·대시보드(루트 화면)에서는 앱 종료
      var h = global.location.hash;
      var isRoot = !h || h === '#' || h === '#/' ||
        h === '#/dashboard' || h === '#/login';
      if (isRoot) { cap.Plugins.App.exitApp(); return; }
      // 3) 그 외에는 일반 뒤로가기
      global.history.back();
    });
  }

  /* ---------- 부팅 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    Seed.seedIfEmpty();
    setupHybridBackButton();
    route();
  });
})(window);
