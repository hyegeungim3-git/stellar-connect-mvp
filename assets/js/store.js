/* =====================================================================
 * store.js — 데이터 계층 (localStorage 기반)
 * Stellar Connect (S:CON) 1차 MVP — 「내 아이 사용 설명서」 외
 *
 * 1차 개발에서는 별도 백엔드 없이 브라우저 localStorage 를 저장소로 사용한다.
 * 실제 운영 단계에서는 이 계층만 REST API 호출로 교체하면 화면 로직은
 * 그대로 재사용할 수 있도록 CRUD 인터페이스를 분리해 두었다.
 * ===================================================================== */
(function (global) {
  'use strict';

  var DB_KEY = 'ichild.db.v1';
  var SESSION_KEY = 'ichild.session.v1';

  /* ---------- 공통 유틸 ---------- */
  function uid(prefix) {
    return (prefix || 'id') + '-' +
      Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  }
  function nowISO() { return new Date().toISOString(); }
  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* ---------- DB 로드 / 저장 ---------- */
  function emptyDB() {
    return {
      users: [], children: [], manuals: [], records: [],
      shares: [], contents: [], popups: [], notifications: [],
      medChecks: {},    // '아이id|YYYY-MM-DD' -> [복용 완료한 약 이름]
      dailyChecks: {},  // '아이id|YYYY-MM-DD' -> { mood, sleep, meal } (오늘의 체크인)
      plans: [],        // 성장 플랜 항목 {id, childId, stage, area, text, status, createdAt}
      visitNotes: [],   // 방문 노트 {id, shareId, childId, author, role, text, createdAt}
      placeReports: [], // 친화 장소 제보 {id, name, category, reason, createdAt}
      meta: { createdAt: nowISO(), seeded: false }
    };
  }

  function getDB() {
    try {
      var raw = localStorage.getItem(DB_KEY);
      if (!raw) return emptyDB();
      var db = JSON.parse(raw);
      // 누락 컬렉션 보정 (스키마 진화 대비)
      var base = emptyDB();
      for (var k in base) { if (!(k in db)) db[k] = base[k]; }
      return db;
    } catch (e) {
      console.error('DB 로드 실패, 초기화합니다.', e);
      return emptyDB();
    }
  }

  function setDB(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      console.error('DB 저장 실패', e);
      alert('저장 공간이 부족합니다. 사진 용량을 줄이거나 일부 기록을 삭제해 주세요.');
      return false;
    }
  }

  function resetDB() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  /* ---------- 세션 (로그인 상태) ---------- */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function setSession(userId) {
    if (userId) localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: userId, at: nowISO() }));
    else localStorage.removeItem(SESSION_KEY);
  }
  function currentUser() {
    var s = getSession();
    if (!s) return null;
    return getDB().users.filter(function (u) { return u.id === s.userId; })[0] || null;
  }

  /* ---------- 사용자 (회원/양육자/관리자) ---------- */
  function findUserByEmail(email) {
    return getDB().users.filter(function (u) {
      return u.email.toLowerCase() === String(email).toLowerCase();
    })[0] || null;
  }

  function signup(data) {
    var db = getDB();
    if (findUserByEmail(data.email)) {
      return { ok: false, error: '이미 가입된 이메일입니다.' };
    }
    var user = {
      id: uid('user'),
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      password: data.password,
      role: 'parent',
      status: 'active',
      verified: !!data.verified,         // 본인인증 여부
      provider: data.provider || 'email', // email | kakao | naver
      healthStatus: '',
      emergencyContacts: [],
      notify: { push: true, schedule: true, crisis: true },
      createdAt: nowISO()
    };
    db.users.push(user);
    setDB(db);
    return { ok: true, user: user };
  }

  function login(email, password) {
    var u = findUserByEmail(email);
    if (!u) return { ok: false, error: '가입되지 않은 이메일입니다.' };
    if (u.status === 'withdrawn') return { ok: false, error: '탈퇴한 계정입니다.' };
    if (u.password !== password) return { ok: false, error: '비밀번호가 일치하지 않습니다.' };
    setSession(u.id);
    return { ok: true, user: u };
  }

  function logout() { setSession(null); }

  function updateUser(id, patch) {
    var db = getDB();
    var u = db.users.filter(function (x) { return x.id === id; })[0];
    if (!u) return null;
    for (var k in patch) u[k] = patch[k];
    setDB(db);
    return u;
  }

  function withdraw(id) {
    return updateUser(id, { status: 'withdrawn' });
  }

  /* ---------- 아이 프로필 ---------- */
  function emptyChild(ownerId) {
    return {
      id: uid('child'), ownerId: ownerId,
      name: '', birthDate: '', gender: '', photo: null,
      // 키·몸무게·혈액형·의류 사이즈·인상착의 (미아·응급·돌봄 인수인계 대비)
      body: { height: '', weight: '', bloodType: '', sizes: '', features: '' },
      gallery: [],  // {id, photo, date} — 최신 사진 보관 (미아 대비)
      disability: { type: '자폐 스펙트럼 장애', summary: '', diagnosedAt: '', sensory: '' },
      medications: [], allergies: [],
      emergency: { protocol: '', hospital: '', doctor: '', contacts: [] },
      verifyStatus: 'none',  // none | pending | verified
      verifyDocs: [],
      // '내가 없을 때' 돌봄 인수인계 — 대체 돌봄자 + 항목별 지침 + 메모
      handover: { caretakers: [], items: {}, note: '' },
      createdAt: nowISO(), updatedAt: nowISO()
    };
  }

  function childrenOf(ownerId) {
    return getDB().children.filter(function (c) { return c.ownerId === ownerId; });
  }
  function getChild(id) {
    return getDB().children.filter(function (c) { return c.id === id; })[0] || null;
  }
  function saveChild(child) {
    var db = getDB();
    child.updatedAt = nowISO();
    var idx = -1;
    db.children.forEach(function (c, i) { if (c.id === child.id) idx = i; });
    if (idx >= 0) db.children[idx] = child;
    else db.children.push(child);
    setDB(db);
    // 설명서가 없으면 빈 설명서 생성
    if (!getManual(child.id)) {
      var m = emptyManual(child.id);
      var d2 = getDB(); d2.manuals.push(m); setDB(d2);
    }
    return child;
  }
  function deleteChild(id) {
    var db = getDB();
    /* 첨부 영상(IndexedDB)부터 정리 — records를 지우면 클립 키를 알 수 없게 된다 */
    if (global.VideoDB && global.VideoDB.available && global.VideoDB.available()) {
      db.records.forEach(function (r) {
        if (r.childId === id && r.hasClip) {
          try { global.VideoDB.del(r.id).catch(function () {}); } catch (e) {}
        }
      });
    }
    db.children = db.children.filter(function (c) { return c.id !== id; });
    db.manuals = db.manuals.filter(function (m) { return m.childId !== id; });
    db.records = db.records.filter(function (r) { return r.childId !== id; });
    db.shares = db.shares.filter(function (s) { return s.childId !== id; });
    /* 연쇄 삭제 보강(데이터정의서 P2) — 고아 데이터 방지 */
    db.visitNotes = db.visitNotes.filter(function (n) { return n.childId !== id; });
    db.plans = db.plans.filter(function (p) { return p.childId !== id; });
    ['medChecks', 'dailyChecks'].forEach(function (col) {
      Object.keys(db[col] || {}).forEach(function (k) {
        if (k.indexOf(id + '|') === 0) delete db[col][k];
      });
    });
    setDB(db);
  }
  function setChildVerify(id, status) {
    var c = getChild(id);
    if (!c) return null;
    c.verifyStatus = status;
    saveChild(c);
    return c;
  }

  /* ---------- 사용 설명서 ---------- */
  function emptyManual(childId) {
    return {
      id: uid('manual'), childId: childId,
      sections: {
        canDo: [], needHelp: [], like: [], dislike: [],
        problem: [],  // {id, situation, response, intensity}
        comm: [],
        routine: [],  // 생활 루틴 — 학습·식사·잠자기 등 일과의 흐름
        safety: []    // 안전 주의사항 — 외출·위험요소 등 (채비 돌봄지침서 '안전' 벤치마킹)
      },
      summaryNote: '',    // 한 줄 소개 (한눈에 보는 우리 아이)
      parentNote: '',     // 보호자 한마디 (보호자가 꼭 전달하고 싶은 내용 — 공통 필수항목)
      updatedAt: nowISO()
    };
  }
  function getManual(childId) {
    var m = getDB().manuals.filter(function (x) { return x.childId === childId; })[0] || null;
    // 스키마 진화 보정 — 예전 데이터에 없는 섹션은 빈 배열로
    if (m) {
      var base = emptyManual('').sections;
      for (var k in base) { if (!m.sections[k]) m.sections[k] = []; }
    }
    return m;
  }
  function saveManual(manual) {
    var db = getDB();
    manual.updatedAt = nowISO();
    var idx = -1;
    db.manuals.forEach(function (m, i) { if (m.id === manual.id) idx = i; });
    if (idx >= 0) db.manuals[idx] = manual;
    else db.manuals.push(manual);
    setDB(db);
    return manual;
  }

  /* ---------- 기록 (행동 / 치료 / 변화) ---------- */
  function recordsOf(childId) {
    return getDB().records
      .filter(function (r) { return r.childId === childId; })
      .sort(function (a, b) { return (a.date < b.date ? 1 : -1); });
  }
  function getRecord(id) {
    return getDB().records.filter(function (r) { return r.id === id; })[0] || null;
  }
  function saveRecord(rec) {
    var db = getDB();
    if (!rec.id) { rec.id = uid('rec'); rec.createdAt = nowISO(); }
    var idx = -1;
    db.records.forEach(function (r, i) { if (r.id === rec.id) idx = i; });
    if (idx >= 0) db.records[idx] = rec;
    else db.records.push(rec);
    setDB(db);
    return rec;
  }
  function deleteRecord(id) {
    var db = getDB();
    db.records = db.records.filter(function (r) { return r.id !== id; });
    setDB(db);
  }

  /* ---------- 성장 플랜 (평생설계 라이트) ---------- */
  function plansOf(childId) {
    return getDB().plans.filter(function (p) { return p.childId === childId; });
  }
  function addPlanItem(childId, stage, area, text) {
    var db = getDB();
    var it = { id: uid('plan'), childId: childId, stage: stage, area: area,
               text: text, status: 'todo', createdAt: nowISO() };
    db.plans.push(it);
    setDB(db);
    return it;
  }
  function setPlanStatus(id, status) {
    var db = getDB();
    var it = db.plans.filter(function (p) { return p.id === id; })[0];
    if (it) { it.status = status; setDB(db); }
    return it;
  }
  function deletePlanItem(id) {
    var db = getDB();
    db.plans = db.plans.filter(function (p) { return p.id !== id; });
    setDB(db);
  }

  /* ---------- 방문 노트 (공유 열람자가 남기는 한마디 — 협업 1단계) ---------- */
  function addVisitNote(opts) {
    var db = getDB();
    var n = { id: uid('vn'), shareId: opts.shareId, childId: opts.childId,
              author: opts.author || '열람자', role: opts.role || '',
              text: opts.text, createdAt: nowISO() };
    db.visitNotes.push(n);
    setDB(db);
    return n;
  }
  function visitNotesOfShare(shareId) {
    return getDB().visitNotes.filter(function (n) { return n.shareId === shareId; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function visitNotesOfChild(childId) {
    return getDB().visitNotes.filter(function (n) { return n.childId === childId; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }
  function deleteVisitNote(id) {
    var db = getDB();
    db.visitNotes = db.visitNotes.filter(function (n) { return n.id !== id; });
    setDB(db);
  }

  /* ---------- 친화 장소 제보 ---------- */
  function addPlaceReport(r) {
    var db = getDB();
    r.id = uid('pr'); r.createdAt = nowISO();
    db.placeReports.push(r);
    setDB(db);
    return r;
  }

  /* ---------- 오늘의 체크인 (기분·수면·식사 — 날짜별) ---------- */
  function dailyCheckFor(childId, date) {
    return getDB().dailyChecks[childId + '|' + date] || {};
  }
  function setDailyCheck(childId, date, field, value) {
    var db = getDB();
    var key = childId + '|' + date;
    var cur = db.dailyChecks[key] || {};
    if (cur[field] === value) delete cur[field];  // 같은 값 다시 탭 → 해제
    else cur[field] = value;
    db.dailyChecks[key] = cur;
    setDB(db);
    return cur;
  }

  /* ---------- 복약 체크 (오늘 먹였는지 — 날짜별) ---------- */
  function medChecksFor(childId, date) {
    return getDB().medChecks[childId + '|' + date] || [];
  }
  function toggleMedCheck(childId, date, medName) {
    var db = getDB();
    var key = childId + '|' + date;
    var list = db.medChecks[key] || [];
    var i = list.indexOf(medName);
    if (i >= 0) list.splice(i, 1);
    else list.push(medName);
    db.medChecks[key] = list;
    setDB(db);
    return list;
  }

  /* ---------- 공유 ---------- */
  function createShare(opts) {
    var db = getDB();
    var share = {
      id: uid('shr'),
      token: Math.random().toString(36).slice(2, 8).toUpperCase(),
      childId: opts.childId,
      scope: opts.scope || 'summary',       // (레거시) summary | full
      audience: opts.audience || null,      // school | hospital | support | care
      viewerName: opts.viewerName || '',
      viewerRole: opts.viewerRole || '기타',
      safeNumber: opts.safeNumber !== false,   // 비상연락처를 안심번호(050)로 표시 (기본 ON)
      accessCode: opts.accessCode || String(Math.floor(1000 + Math.random() * 9000)),
      createdAt: nowISO(),
      expiresAt: opts.expiresAt || null,
      revoked: false,
      views: 0
    };
    db.shares.push(share);
    setDB(db);
    return share;
  }
  function sharesOf(childId) {
    return getDB().shares.filter(function (s) { return s.childId === childId; })
      .sort(function (a, b) { return (a.createdAt < b.createdAt ? 1 : -1); });
  }
  function getShareByToken(token) {
    return getDB().shares.filter(function (s) {
      return s.token === String(token).toUpperCase();
    })[0] || null;
  }
  function revokeShare(id) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (s) { s.revoked = true; setDB(db); }
  }
  function bumpShareViews(id) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (s) { s.views = (s.views || 0) + 1; setDB(db); }
  }

  /* ---------- 백오피스: 콘텐츠 / 팝업 / 알림 ---------- */
  function listContents() { return getDB().contents; }
  function saveContent(c) {
    var db = getDB();
    if (!c.id) c.id = uid('cnt');
    var idx = -1;
    db.contents.forEach(function (x, i) { if (x.id === c.id) idx = i; });
    if (idx >= 0) db.contents[idx] = c; else db.contents.push(c);
    setDB(db);
    return c;
  }
  function listPopups() { return getDB().popups; }
  function savePopup(p) {
    var db = getDB();
    if (!p.id) { p.id = uid('pop'); p.createdAt = nowISO(); }
    var idx = -1;
    db.popups.forEach(function (x, i) { if (x.id === p.id) idx = i; });
    if (idx >= 0) db.popups[idx] = p; else db.popups.push(p);
    setDB(db);
    return p;
  }
  function deletePopup(id) {
    var db = getDB();
    db.popups = db.popups.filter(function (p) { return p.id !== id; });
    setDB(db);
  }
  function listNotifications() {
    return getDB().notifications.sort(function (a, b) {
      return (a.sentAt < b.sentAt ? 1 : -1);
    });
  }
  function sendNotification(n) {
    var db = getDB();
    n.id = uid('noti');
    n.sentAt = nowISO();
    db.notifications.push(n);
    setDB(db);
    return n;
  }

  /* ---------- 통계 (백오피스) ---------- */
  function stats() {
    var db = getDB();
    var parents = db.users.filter(function (u) { return u.role === 'parent'; });
    var manualsFilled = db.manuals.filter(function (m) {
      var s = m.sections;
      return s.canDo.length + s.needHelp.length + s.like.length +
        s.dislike.length + s.problem.length + s.comm.length > 0;
    });
    return {
      users: parents.length,
      activeUsers: parents.filter(function (u) { return u.status === 'active'; }).length,
      children: db.children.length,
      verifiedChildren: db.children.filter(function (c) { return c.verifyStatus === 'verified'; }).length,
      pendingChildren: db.children.filter(function (c) { return c.verifyStatus === 'pending'; }).length,
      manuals: manualsFilled.length,
      records: db.records.length,
      shares: db.shares.length
    };
  }

  /* ---------- 외부 노출 ---------- */
  global.Store = {
    // 유틸
    uid: uid, nowISO: nowISO, clone: clone,
    // DB
    getDB: getDB, setDB: setDB, resetDB: resetDB,
    // 세션 / 인증
    getSession: getSession, currentUser: currentUser,
    signup: signup, login: login, logout: logout,
    updateUser: updateUser, withdraw: withdraw, findUserByEmail: findUserByEmail,
    // 아이
    emptyChild: emptyChild, childrenOf: childrenOf, getChild: getChild,
    saveChild: saveChild, deleteChild: deleteChild, setChildVerify: setChildVerify,
    // 설명서
    emptyManual: emptyManual, getManual: getManual, saveManual: saveManual,
    // 기록
    recordsOf: recordsOf, getRecord: getRecord, saveRecord: saveRecord, deleteRecord: deleteRecord,
    // 복약 체크 / 오늘의 체크인
    medChecksFor: medChecksFor, toggleMedCheck: toggleMedCheck,
    dailyCheckFor: dailyCheckFor, setDailyCheck: setDailyCheck,
    // 성장 플랜
    plansOf: plansOf, addPlanItem: addPlanItem,
    setPlanStatus: setPlanStatus, deletePlanItem: deletePlanItem,
    // 방문 노트 / 장소 제보
    addVisitNote: addVisitNote, visitNotesOfShare: visitNotesOfShare,
    visitNotesOfChild: visitNotesOfChild, deleteVisitNote: deleteVisitNote,
    addPlaceReport: addPlaceReport,
    // 공유
    createShare: createShare, sharesOf: sharesOf, getShareByToken: getShareByToken,
    revokeShare: revokeShare, bumpShareViews: bumpShareViews,
    // 백오피스
    listContents: listContents, saveContent: saveContent,
    listPopups: listPopups, savePopup: savePopup, deletePopup: deletePopup,
    listNotifications: listNotifications, sendNotification: sendNotification,
    stats: stats
  };
})(window);
