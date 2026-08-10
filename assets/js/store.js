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
      verifyLogs: [],   // 보호자 인증 심사 이력 {id,userId,userName,action(view|approve|reject),reason,reviewer,at}
      alimtalks: [],    // 알림톡 발송 이력 {id,userId,name,phone,template,title,body,at,result}
      medChecks: {},    // '아이id|YYYY-MM-DD' -> [복용 완료한 약 이름]
      dailyChecks: {},  // '아이id|YYYY-MM-DD' -> { mood, sleep, meal } (오늘의 체크인)
      plans: [],        // 성장 플랜 항목 {id, childId, stage, area, text, status, createdAt}
      visitNotes: [],   // 방문 노트 {id, shareId, childId, author, role, text, createdAt}
      placeReports: [], // 친화 장소 제보 {id, name, category, reason, createdAt}
      /* 대상별 공유 커스텀 — 기본 4종(학교/병원/활동지원사/돌봄기관) 재정의 또는 신규 대상 추가.
         {id, ownerId, label, icon, color, intro, blocks[]} — id가 기본 4종 키와 같으면 그 대상을 덮어씀 */
      audienceTemplates: [],
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

  /* 저장 실패(용량 초과 등)는 false로 알린다 — 호출부는 반드시 반환값을 확인해
     '저장했어요'가 잘못 뜨지 않게 한다. 안내는 브라우저 alert 대신 앱 토스트로. */
  function setDB(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      console.error('DB 저장 실패', e);
      if (global.UI && UI.toast) {
        UI.toast('저장 공간이 부족해요. 사진 용량을 줄이거나 지난 기록을 정리해 주세요', 'err');
      }
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

  /* 계정 상태 — 보호자 인증 심사를 거쳐야 로그인이 열린다(2026-08-05 가입 절차 확정)
     nodoc(서류 미제출) → pending(심사 대기) → active(승인) / rejected(반려) / withdrawn(탈퇴) */
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
      status: data.status || 'nodoc',    // 서류 등록 전까지는 로그인 불가
      verified: !!data.verified,         // 본인인증(Nice) 완료 여부
      di: data.di || '',                 // 본인확인 중복가입확인정보 — 중복 가입 차단용
      provider: data.provider || 'email', // email | kakao | naver
      consents: data.consents || null,   // 동의 이력 {terms, privacy, sensitive, identity, age14, alimtalk, marketing, at}
      submittedAt: null,                 // 서류 접수 일시
      reviewedAt: null,                  // 심사 완료 일시
      rejectReason: '',                  // 반려 사유 (rejected일 때)
      healthStatus: '',
      emergencyContacts: [],
      notify: { push: true, schedule: true, crisis: true },
      createdAt: nowISO()
    };
    db.users.push(user);
    if (!setDB(db)) return { ok: false, error: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' };
    return { ok: true, user: user };
  }

  /* 보호자 인증 서류 제출 — 아이 최소 정보(이름·생년월일·장애유형)와 함께 접수.
     서류 원본은 보관하지 않는다(개인정보 설계 원칙) — 종류·파일명만 기록한다. */
  function submitGuardianDocs(userId, opts) {
    var db = getDB();
    var u = db.users.filter(function (x) { return x.id === userId; })[0];
    if (!u) return { ok: false, error: '계정을 찾을 수 없어요.' };
    /* 반려 후 재제출이면 기존 아이를 갱신한다 — 새로 넣으면 아이가 중복 생성된다 */
    var child = db.children.filter(function (c) {
      return c.ownerId === userId && (c.verifyStatus === 'pending' || c.verifyStatus === 'rejected');
    })[0];
    if (!child) { child = emptyChild(userId); db.children.push(child); }
    child.name = opts.childName;
    child.birthDate = opts.childBirth;
    child.disability.type = opts.disabilityType || '자폐 스펙트럼 장애';
    child.verifyStatus = 'pending';
    child.verifyDocs = [opts.docType + (opts.fileName ? ' (' + opts.fileName + ')' : '')];
    child.verifySubmittedAt = nowISO();
    child.verifyTries = (child.verifyTries || 0) + 1;   // 재제출 횟수 — 심사 큐에서 배지로 표시
    /* 서류 사진은 심사 동안만 보관한다 — 승인·반려로 처리되는 순간 파기(reviewGuardian).
       원본을 남기지 않는다는 개인정보 설계 원칙을 화면과 데이터 양쪽에서 지킨다. */
    child.verifyDocImage = opts.docImage || '';
    u.status = 'pending';
    u.submittedAt = nowISO();
    u.rejectReason = '';
    if (!setDB(db)) return { ok: false, error: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' };
    sendAlimtalk(userId, 'submitted');
    /* 설명서는 승인 후 화면 진입 시 자동 생성된다 */
    return { ok: true, user: u, child: child };
  }

  /* 관리자 심사 — 승인하면 계정이 열리고 아이가 인증 완료로, 반려하면 사유와 함께 되돌린다.
     처리와 동시에 서류 사진을 파기하고, 누가 언제 처리했는지 이력을 남긴다. */
  function reviewGuardian(userId, approved, reason, reviewer) {
    var db = getDB();
    var u = db.users.filter(function (x) { return x.id === userId; })[0];
    if (!u) return null;
    var at = nowISO();
    u.status = approved ? 'active' : 'rejected';
    u.reviewedAt = at;
    u.reviewedBy = reviewer || '관리자';
    u.rejectReason = approved ? '' : (reason || '');
    db.children.forEach(function (c) {
      if (c.ownerId !== userId) return;
      if (c.verifyStatus === 'pending') c.verifyStatus = approved ? 'verified' : 'rejected';
      c.verifyDocImage = '';        // 서류 사진 파기
      c.verifyDocPurgedAt = at;
    });
    db.verifyLogs = db.verifyLogs || [];
    db.verifyLogs.push({
      id: uid('vlog'), userId: userId, userName: u.name,
      action: approved ? 'approve' : 'reject', reason: approved ? '' : (reason || ''),
      reviewer: reviewer || '관리자', at: at
    });
    setDB(db);
    sendAlimtalk(userId, approved ? 'approve' : 'reject', approved ? '' : (reason || ''));
    return u;
  }
  /* 운영자 권한 — 심사자(reviewer)는 가입 심사만, 관리자(admin)는 전체.
     서류는 민감정보라 열람 인원을 최소로 두기 위한 구분이다. */
  function setUserRole(userId, role) {
    var db = getDB();
    var u = db.users.filter(function (x) { return x.id === userId; })[0];
    if (!u) return null;
    if (['parent', 'reviewer', 'admin'].indexOf(role) < 0) return null;
    u.role = role;
    setDB(db);
    return u;
  }
  /* 알림톡 발송 — 실서비스는 카카오 알림톡 API. 프로토타입은 발송 이력만 남긴다.
     승인·반려를 알림톡으로 알린다고 사용자에게 약속했으므로 확인할 수 있어야 한다. */
  var ALIMTALK = {
    submitted: { title: '서류 접수 안내',
      body: '보호자 확인 서류를 접수했어요. 영업일 1~2일 안에 확인해 알려 드릴게요.' },
    approve: { title: '가입 승인 안내',
      body: '보호자 확인이 끝났어요. 이제 로그인하고 「내 아이 설명서」를 시작하실 수 있어요.' },
    reject: { title: '서류 재제출 안내',
      body: '보내주신 서류를 확인하지 못했어요. 앱에서 다시 제출해 주시면 빠르게 확인해 드릴게요.' }
  };
  function sendAlimtalk(userId, template, extra) {
    var db = getDB();
    var u = db.users.filter(function (x) { return x.id === userId; })[0];
    if (!u) return null;
    var t = ALIMTALK[template] || { title: '안내', body: '' };
    var log = {
      id: uid('atk'), userId: userId, name: u.name, phone: u.phone || '',
      template: template, title: t.title,
      body: t.body + (extra ? ' (' + extra + ')' : ''),
      at: nowISO(),
      /* 수신 동의를 하지 않았으면 발송하지 않는다 — 동의 이력이 곧 발송 근거 */
      result: (u.consents && u.consents.alimtalk === false) ? 'skipped' : 'sent'
    };
    db.alimtalks = db.alimtalks || [];
    db.alimtalks.push(log);
    setDB(db);
    return log;
  }
  function listAlimtalks() {
    return (getDB().alimtalks || []).slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }

  /* 서류 열람 기록 — 민감정보라 누가 언제 봤는지 남긴다 */
  function logDocView(userId, reviewer) {
    var db = getDB();
    var u = db.users.filter(function (x) { return x.id === userId; })[0];
    db.verifyLogs = db.verifyLogs || [];
    db.verifyLogs.push({
      id: uid('vlog'), userId: userId, userName: u ? u.name : '',
      action: 'view', reason: '', reviewer: reviewer || '관리자', at: nowISO()
    });
    setDB(db);
  }
  function verifyLogsOf(userId) {
    return (getDB().verifyLogs || []).filter(function (l) { return l.userId === userId; })
      .sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }

  function login(email, password) {
    var u = findUserByEmail(email);
    if (!u) return { ok: false, error: '이메일 또는 비밀번호가 일치하지 않아요.' };
    /* 비밀번호를 먼저 확인한다 — 틀린 상태에서 계정 상태를 알려주면
       남의 이메일로 가입 여부를 확인할 수 있게 된다(계정 존재 노출 방지) */
    if (u.password !== password) return { ok: false, error: '이메일 또는 비밀번호가 일치하지 않아요.' };
    if (u.status === 'withdrawn') return { ok: false, error: '탈퇴한 계정입니다.' };
    /* 심사 상태는 화면에서 모달로 안내한다 (code로 분기) */
    if (u.status === 'nodoc') return { ok: false, code: 'nodoc', user: u };
    if (u.status === 'pending') return { ok: false, code: 'pending', user: u };
    if (u.status === 'rejected') return { ok: false, code: 'rejected', user: u };
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
  /* 저장에 실패하면 null — 호출부가 성공 토스트·화면 이동을 하지 않도록 */
  function saveChild(child) {
    var db = getDB();
    child.updatedAt = nowISO();
    var idx = -1;
    db.children.forEach(function (c, i) { if (c.id === child.id) idx = i; });
    if (idx >= 0) db.children[idx] = child;
    else db.children.push(child);
    if (!setDB(db)) return null;
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
    /* 설명서는 텍스트뿐이라 용량 초과 위험이 낮고, 화면 진입 시 자동 생성 경로
       (getManual() || saveManual(emptyManual()))가 있어 null을 반환하면 렌더가 깨진다.
       저장 실패 안내는 setDB의 토스트로 충분. */
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
    if (!setDB(db)) return null;   // 사진·영상이 큰 기록에서 용량 초과가 나기 쉽다
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
  function addPlanItem(childId, stage, area, text, term) {
    var db = getDB();
    /* term: 'short'(단기) | 'long'(장기) | ''(미지정) — 양육자 자문 0721 요청 */
    var it = { id: uid('plan'), childId: childId, stage: stage, area: area,
               text: text, term: term || '', status: 'todo', createdAt: nowISO() };
    db.plans.push(it);
    setDB(db);
    return it;
  }
  function setPlanTerm(id, term) {
    var db = getDB();
    var it = db.plans.filter(function (p) { return p.id === id; })[0];
    if (it) { it.term = term || ''; setDB(db); }
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
  /* 공유 주기 — 기간이 지나면 자동으로 닫혀 민감정보 노출을 최소화 (개인정보 동의 정책 L2 원칙) */
  var SHARE_CYCLE_DAYS = { day: 1, week: 7, month: 30, year: 365 };
  function shareCycleDays(cycle) { return SHARE_CYCLE_DAYS[cycle] || null; }
  function createShare(opts) {
    var db = getDB();
    var days = shareCycleDays(opts.renewCycle);
    /* 인증번호는 기본 ON. 끄면(requireCode:false) 링크만으로 바로 열람 —
       급할 때 곁의 분이 바로 볼 수 있게 하되, 링크가 곧 열쇠가 되므로 선택은 보호자가 한다. */
    var needCode = opts.requireCode !== false;
    var share = {
      id: uid('shr'),
      token: Math.random().toString(36).slice(2, 8).toUpperCase(),
      childId: opts.childId,
      scope: opts.scope || 'summary',       // (레거시) summary | full
      audience: opts.audience || null,      // school | hospital | support | care
      viewerName: opts.viewerName || '',
      viewerRole: opts.viewerRole || '기타',
      safeNumber: opts.safeNumber !== false,   // 비상연락처를 안심번호(050)로 표시 (기본 ON)
      requireCode: needCode,                   // 인증번호 입력 후 열람 여부 (기본 ON)
      accessCode: needCode
        ? (opts.accessCode || String(Math.floor(1000 + Math.random() * 9000)))
        : '',
      createdAt: nowISO(),
      renewCycle: opts.renewCycle || null,   // week | month | year | null(계속 유지)
      expiresAt: days ? new Date(Date.now() + days * 864e5).toISOString() : (opts.expiresAt || null),
      revoked: false,
      revokedReason: null,     // 'owner'(보호자 중단) | 'authfail'(인증번호 5회 실패)
      failCount: 0,            // 연속 인증번호 실패 횟수
      views: 0
    };
    db.shares.push(share);
    setDB(db);
    return share;
  }
  /* 열람 가능 기간을 오늘부터 같은 주기만큼 다시 연장 */
  function renewShare(id) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (!s) return null;
    var days = shareCycleDays(s.renewCycle);
    if (!days) return s;
    s.expiresAt = new Date(Date.now() + days * 864e5).toISOString();
    setDB(db);
    return s;
  }
  function isShareExpired(s) {
    return !!(s && s.expiresAt && new Date(s.expiresAt).getTime() < Date.now());
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
  function revokeShare(id, reason) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (s) { s.revoked = true; s.revokedReason = reason || 'owner'; setDB(db); }
  }
  function bumpShareViews(id) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (s) { s.views = (s.views || 0) + 1; setDB(db); }
  }
  /* 인증번호가 필요한 공유인지 — 레거시(requireCode 없는) 공유는 인증번호가 있으면 필요로 본다 */
  function shareNeedsCode(s) {
    if (!s) return false;
    if (s.requireCode === false) return false;
    return !!s.accessCode;
  }
  /* 인증번호 오입력 — 5회 연속 실패하면 링크를 자동으로 잠근다(무단 열람 방어) */
  var SHARE_FAIL_LIMIT = 5;
  function failShareAuth(id) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (!s) return { count: 0, left: SHARE_FAIL_LIMIT, locked: false };
    s.failCount = (s.failCount || 0) + 1;
    var locked = s.failCount >= SHARE_FAIL_LIMIT;
    if (locked && !s.revoked) { s.revoked = true; s.revokedReason = 'authfail'; }
    setDB(db);
    return { count: s.failCount, left: Math.max(0, SHARE_FAIL_LIMIT - s.failCount), locked: locked };
  }
  /* 인증 성공 시 실패 카운터 초기화 (연속 실패만 잠금 대상) */
  function resetShareFail(id) {
    var db = getDB();
    var s = db.shares.filter(function (x) { return x.id === id; })[0];
    if (s && s.failCount) { s.failCount = 0; setDB(db); }
  }

  /* ---------- 대상별 공유 커스텀 ---------- */
  function listAudienceTemplates(ownerId) {
    return getDB().audienceTemplates.filter(function (t) { return t.ownerId === ownerId; });
  }
  function saveAudienceTemplate(t) {
    var db = getDB();
    if (!t.id) t.id = uid('aud');
    var idx = -1;
    db.audienceTemplates.forEach(function (x, i) {
      if (x.id === t.id && x.ownerId === t.ownerId) idx = i;
    });
    if (idx >= 0) db.audienceTemplates[idx] = t; else db.audienceTemplates.push(t);
    setDB(db);
    return t;
  }
  function deleteAudienceTemplate(id, ownerId) {
    var db = getDB();
    db.audienceTemplates = db.audienceTemplates.filter(function (x) {
      return !(x.id === id && x.ownerId === ownerId);
    });
    setDB(db);
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
    /* 가입 심사 지표 — 대기 건수만으로는 SLA(영업일 1~2일)를 지킬 수 없어
       접수 후 경과와 평균 처리 시간을 함께 낸다 */
    var byStatus = function (s) {
      return parents.filter(function (u) { return u.status === s; }).length;
    };
    var pend = parents.filter(function (u) { return u.status === 'pending'; });
    var DAY = 864e5;
    var overdue = pend.filter(function (u) {
      return u.submittedAt && (Date.now() - new Date(u.submittedAt).getTime()) > DAY;
    }).length;
    var done = parents.filter(function (u) { return u.submittedAt && u.reviewedAt; });
    var avgH = done.length
      ? Math.round(done.reduce(function (a, u) {
          return a + (new Date(u.reviewedAt).getTime() - new Date(u.submittedAt).getTime());
        }, 0) / done.length / 36e5 * 10) / 10
      : null;
    return {
      users: parents.length,
      activeUsers: byStatus('active'),
      pendingUsers: pend.length,          // 가입 심사 대기
      overdueUsers: overdue,              // 접수 24시간 초과
      rejectedUsers: byStatus('rejected'),
      nodocUsers: byStatus('nodoc'),      // 서류 미제출로 중단된 가입
      avgReviewHours: avgH,               // 평균 심사 소요(시간)
      children: db.children.length,
      verifiedChildren: db.children.filter(function (c) { return c.verifyStatus === 'verified'; }).length,
      pendingChildren: db.children.filter(function (c) { return c.verifyStatus === 'pending'; }).length,
      manuals: manualsFilled.length,
      records: db.records.length,
      shares: db.shares.length,
      lockedShares: db.shares.filter(function (s) { return s.revokedReason === 'authfail'; }).length
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
    submitGuardianDocs: submitGuardianDocs, reviewGuardian: reviewGuardian,
    logDocView: logDocView, verifyLogsOf: verifyLogsOf,
    sendAlimtalk: sendAlimtalk, listAlimtalks: listAlimtalks, setUserRole: setUserRole,
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
    plansOf: plansOf, addPlanItem: addPlanItem, setPlanTerm: setPlanTerm,
    setPlanStatus: setPlanStatus, deletePlanItem: deletePlanItem,
    // 장소 제보
    addPlaceReport: addPlaceReport,
    // 공유
    createShare: createShare, sharesOf: sharesOf, getShareByToken: getShareByToken,
    revokeShare: revokeShare, bumpShareViews: bumpShareViews,
    renewShare: renewShare, isShareExpired: isShareExpired, shareCycleDays: shareCycleDays,
    shareNeedsCode: shareNeedsCode, failShareAuth: failShareAuth, resetShareFail: resetShareFail,
    SHARE_FAIL_LIMIT: SHARE_FAIL_LIMIT,
    listAudienceTemplates: listAudienceTemplates, saveAudienceTemplate: saveAudienceTemplate,
    deleteAudienceTemplate: deleteAudienceTemplate,
    // 백오피스
    listContents: listContents, saveContent: saveContent,
    listPopups: listPopups, savePopup: savePopup, deletePopup: deletePopup,
    listNotifications: listNotifications, sendNotification: sendNotification,
    stats: stats
  };
})(window);
