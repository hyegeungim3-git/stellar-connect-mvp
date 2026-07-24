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

  function currentChildId(r) {
    if (r.params.childId) return r.params.childId;
    if (r.params.id && (r.view === 'childProfile' || r.view === 'childEdit')) return r.params.id;
    if (App.lastChildId) return App.lastChildId;
    var u = Store.currentUser();
    if (u) { var kids = Store.childrenOf(u.id); if (kids[0]) return kids[0].id; }
    return null;
  }

  function navItems(cur) {
    var c = cur || '';
    return [
      { key: 'dashboard', label: '홈',          icon: 'home',  hash: '#/dashboard' },
      { key: 'profile',   label: '아이 프로필', icon: 'smile', hash: cur ? '#/child/' + c : '#/dashboard' },
      { key: 'manual',    label: '설명서',      icon: 'book',  hash: cur ? '#/manual/' + c : '#/dashboard' },
      { key: 'records',   label: '기록',        icon: 'note',  hash: cur ? '#/records/' + c : '#/dashboard' },
      { key: 'meds',      label: '복용 관리',   icon: 'pill',  hash: cur ? '#/meds/' + c : '#/dashboard' },
      { key: 'gallery',   label: '갤러리',      icon: 'camera', hash: cur ? '#/gallery/' + c : '#/dashboard' },
      { key: 'plan',      label: '미래 준비',   icon: 'flag',  hash: cur ? '#/plan/' + c : '#/dashboard' },
      { key: 'share',     label: '대상별 공유', icon: 'share', hash: cur ? '#/share/' + c : '#/dashboard' }
      /* 양육자 정보는 좌측/더보기 메뉴에서 제외 — 우측 계정 드롭다운에만 유지(사용자 의견) */
    ];
  }
  /* 모바일 하단 탭 4개 고정 (나머지는 더보기) */
  var BOTTOM_KEYS = ['dashboard', 'manual', 'records', 'gallery'];

  /* ---------- 앱 셸 ---------- */
  function shell(r) {
    var u = Store.currentUser();
    var cur = currentChildId(r);
    var active = NAV_MAP[r.view] || '';
    var items = navItems(cur);
    var kids = Store.childrenOf(u.id);

    // 사이드바
    var sideNav = '<div class="nav-group-label">메뉴</div>' +
      items.map(function (it) {
        return '<a class="nav-item' + (active === it.key ? ' active' : '') + '" href="' + it.hash + '">' +
          icon(it.icon, 19) + '<span>' + esc(it.label) + '</span></a>';
      }).join('');
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
      Store.logout(); UI.toast('로그아웃했어요', 'ok'); App.navigate('#/');
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
  }

  function openDrawer(r) {
    var u = Store.currentUser();
    var cur = currentChildId(r);
    var links = [
      { t: '아이 프로필', i: 'smile', h: cur ? '#/child/' + cur : '#/dashboard' },
      { t: '복용 관리', i: 'pill', h: cur ? '#/meds/' + cur : '#/dashboard' },
      { t: '미래 준비', i: 'flag', h: cur ? '#/plan/' + cur : '#/dashboard' },
      { t: '대상별 공유', i: 'share', h: cur ? '#/share/' + cur : '#/dashboard' }
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
    dr.querySelector('#drawer-logout').onclick = function () {
      close(); Store.logout(); App.navigate('#/');
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
    // 앱 레이아웃은 로그인 필요
    if (view.layout === 'app' && !loggedIn) {
      location.hash = '#/login'; return;
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
    refresh: function () {
      App._scroll = window.scrollY || window.pageYOffset || 0;
      App._animate = false;
      route();
    },
    currentUser: function () { return Store.currentUser(); }
  };

  window.addEventListener('hashchange', function () { App._scroll = 0; route(); });

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
