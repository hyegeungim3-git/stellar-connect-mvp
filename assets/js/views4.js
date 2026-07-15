/* =====================================================================
 * views4.js — 성장 플랜(평생설계 라이트) / 친화 장소 디렉터리
 *
 * 성장 플랜: 채비넷 '평생설계서(8대 영역·생애주기)' 프레임을 벤치마킹하되,
 *   진단→학습→작성의 무거운 절차 대신 칩 원탭으로 시작하는 경량판.
 *   콘텐츠는 예시 가이드 — 전문가 자문(대구대 등) 후 확정 예정.
 * 친화 장소: 지도 API·POI 수집의 현실 부담을 피해 큐레이션 디렉터리로.
 *   길찾기는 카카오/네이버 지도 '바로가기 링크'(API 키 불필요)로 위임.
 * ===================================================================== */
(function (global) {
  'use strict';
  var V = global.Views;
  var esc = UI.esc, icon = UI.icon, Modal = UI.Modal, toast = UI.toast;
  var S = V._S;
  var readForm = V._readForm, ownedChild = V._ownedChild, notFound = V._notFound;
  var childContextBar = V._childContextBar, pageHead = V._pageHead;

  /* =====================================================================
   * 성장 플랜 — 생애주기 4단계 × 영역별 추천 목표 (예시 가이드)
   * ===================================================================== */
  var PLAN_AREAS = {
    daily:  { label: '일상 자립',     color: 'var(--c-cando)' },
    edu:    { label: '교육·학습',     color: 'var(--c-help)' },
    health: { label: '건강·치료',     color: 'var(--c-comm)' },
    social: { label: '사회성·여가',   color: 'var(--c-like)' },
    legal:  { label: '재정·법적 준비', color: 'var(--c-dislike)' }
  };
  var PLAN_STAGES = [
    { id: 'infant', label: '영유아기', sub: '0~6세' },
    { id: 'school', label: '학령기', sub: '7~12세' },
    { id: 'teen',   label: '청소년기', sub: '13~18세' },
    { id: 'adult',  label: '성인 준비기', sub: '19세~' }
  ];
  var PLAN_RECO = {
    infant: [
      { area: 'daily',  text: '스스로 먹기·옷 입기 연습 시작하기' },
      { area: 'daily',  text: '화장실 가리기 단계적으로 연습하기' },
      { area: 'edu',    text: '장애 등록·복지카드 신청 알아보기' },
      { area: 'edu',    text: '통합어린이집·조기교실 알아보고 대기 걸기' },
      { area: 'health', text: '발달검사 주기 정하기 (6개월~1년)' },
      { area: 'health', text: '언어·감각통합 등 치료 시작하기' },
      { area: 'social', text: '또래와 함께 노는 경험 만들기' },
      { area: 'legal',  text: '양육수당·발달재활 바우처 신청하기' }
    ],
    school: [
      { area: 'daily',  text: '등하교 준비 루틴 스스로 하기' },
      { area: 'daily',  text: '용돈·돈 개념 익히기' },
      { area: 'edu',    text: '특수학급/일반학급 배치 상담·결정하기' },
      { area: 'edu',    text: '개별화교육계획(IEP) 협의에 참여하기' },
      { area: 'edu',    text: '방과후·돌봄 서비스 연계하기' },
      { area: 'health', text: '복약·치료 일정을 주간 루틴으로 정착시키기' },
      { area: 'social', text: '좋아하는 취미 활동 1가지 정하기' },
      { area: 'legal',  text: '장애인 신탁·보험 정보 수집 시작하기' }
    ],
    teen: [
      { area: 'daily',  text: '대중교통 이용 연습하기 (동행 → 부분 자립)' },
      { area: 'daily',  text: '스마트폰·용돈 사용 규칙 함께 정하기' },
      { area: 'edu',    text: '진로 탐색 — 직업 체험·전공과 알아보기' },
      { area: 'edu',    text: '전환교육(학교→사회) 계획 세우기' },
      { area: 'health', text: '사춘기 변화 대응 방법 준비하기' },
      { area: 'health', text: '스스로 복약하는 연습 시작하기' },
      { area: 'social', text: '자조모임·동아리 등 또래 활동 참여하기' },
      { area: 'legal',  text: '성년후견·신탁 제도 상담 받아 보기' }
    ],
    adult: [
      { area: 'daily',  text: '주거 형태 탐색 — 지원주택·그룹홈 등' },
      { area: 'edu',    text: '직업훈련·보호작업장·지원고용 연계하기' },
      { area: 'health', text: '소아과 → 성인 진료과 전환 준비하기' },
      { area: 'social', text: '주간활동서비스·평생교육 프로그램 이용하기' },
      { area: 'legal',  text: '장애인연금 등 소득 보장 신청하기' },
      { area: 'legal',  text: '성년후견 개시 여부 검토하기' },
      { area: 'legal',  text: '부모 사후 대비 — 신탁·유언 정리하기' }
    ]
  };
  var PLAN_STATUS = [
    { id: 'todo',  label: '준비' },
    { id: 'doing', label: '진행 중' },
    { id: 'done',  label: '완료' }
  ];
  function stageByAge(age) {
    if (age == null) return 'infant';
    if (age < 7) return 'infant';
    if (age < 13) return 'school';
    if (age < 19) return 'teen';
    return 'adult';
  }

  V.plan = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      var age = UI.calcAge(child.birthDate);
      if (!S.planStage) S.planStage = stageByAge(age);
      var stage = S.planStage;
      var items = Store.plansOf(child.id).filter(function (x) { return x.stage === stage; });
      var done = items.filter(function (x) { return x.status === 'done'; }).length;

      var tabs = PLAN_STAGES.map(function (st) {
        var n = Store.plansOf(child.id).filter(function (x) { return x.stage === st.id; }).length;
        return '<button class="manual-tab' + (stage === st.id ? ' active' : '') +
          '" data-stage="' + st.id + '">' + esc(st.label) +
          ' <span class="faint" style="font-size:.72rem">' + st.sub + '</span>' +
          (n ? '<span class="num">' + n + '</span>' : '') + '</button>';
      }).join('');

      var list = items.length
        ? items.map(function (it) {
            var a = PLAN_AREAS[it.area] || PLAN_AREAS.daily;
            var segBtns = PLAN_STATUS.map(function (s2) {
              return '<button type="button" data-pstat="' + it.id + ':' + s2.id + '"' +
                (it.status === s2.id ? ' class="on"' : '') + '>' + s2.label + '</button>';
            }).join('');
            return '<div class="item-row' + (it.status === 'done' ? ' plan-done' : '') + '">' +
              '<span class="bullet" style="background:' + a.color + '">' + icon('check', 12) + '</span>' +
              '<div class="txt"><span class="badge" style="font-size:.68rem">' + esc(a.label) +
                '</span><div style="margin-top:3px">' + esc(it.text) + '</div></div>' +
              '<div class="row gap-sm" style="flex:none;align-items:center">' +
                '<span class="seg" style="padding:3px">' + segBtns + '</span>' +
                '<button class="btn-icon" data-pdel2="' + it.id + '">' + icon('trash', 14) + '</button>' +
              '</div></div>';
          }).join('')
        : '<p class="muted" style="font-size:.9rem;padding:10px 0">이 시기의 플랜이 아직 없어요. ' +
          '아래 추천 목표를 탭해 시작해 보세요.</p>';

      var existing = items.map(function (x) { return x.text; });
      var reco = (PLAN_RECO[stage] || []).filter(function (r) {
        return existing.indexOf(r.text) === -1;
      });
      var recoChips = reco.length
        ? '<div class="quick-wrap"><div class="quick-cap">' + icon('sparkle', 13) +
          '이 시기에 많이 준비하는 것들 — 탭하면 내 플랜에 담겨요</div>' +
          '<div class="quick-chips">' + reco.map(function (r) {
            var a = PLAN_AREAS[r.area];
            return '<button type="button" class="chip quick" data-padd="' + r.area +
              '" data-ptext="' + esc(r.text) + '">' +
              '<b style="color:' + a.color + '">+</b>' + esc(r.text) + '</button>';
          }).join('') + '</div></div>'
        : '';

      var areaOpts = Object.keys(PLAN_AREAS).map(function (k) {
        return '<option value="' + k + '">' + PLAN_AREAS[k].label + '</option>';
      }).join('');

      return childContextBar(child, 'plan') +
        pageHead('미래 준비', child.name + '의 미래 준비',
          '아동기 → 청소년기 → 성인기 → 노년기. 지금 시기에 준비할 것을 한눈에 — 생애주기 자립 플랜.') +
        '<div class="pill-info mb-2">' + icon('info', 16) +
          '<div>대부분의 서비스가 아동기 치료·교육에 머물지만, 양육자가 가장 걱정하는 건 ' +
          '<b>성인기 이후의 삶</b>입니다. 아래 추천 목표는 <b>예시 가이드</b>로, 전문가 자문을 거친 ' +
          '시기별 가이드는 정식 버전에서 제공됩니다.</div></div>' +
        '<div class="manual-tabs">' + tabs + '</div>' +
        '<div class="card card-pad mb-2">' +
          '<div class="row between wrap mb-2">' +
            '<b>' + esc((PLAN_STAGES.filter(function (s2) { return s2.id === stage; })[0] || {}).label || '') +
            ' 플랜</b>' +
            '<span class="badge ' + (items.length && done === items.length ? 'ok' : '') + '">' +
              done + '/' + items.length + ' 완료</span></div>' +
          list +
          recoChips +
          '<div class="add-item add-item-select">' +
            '<select class="select plan-area-select" id="plan-area">' + areaOpts + '</select>' +
            '<input class="input" id="plan-text" placeholder="직접 입력 — 예) 수영 배우기">' +
            '<button class="btn btn-soft" id="plan-add">' + icon('plus', 15) + '추가</button>' +
          '</div></div>';
    },
    mount: function (p) {
      var child = ownedChild(p.childId); if (!child) return;
      document.querySelectorAll('[data-stage]').forEach(function (b) {
        b.onclick = function () { S.planStage = b.dataset.stage; App.refresh(); };
      });
      document.querySelectorAll('[data-padd]').forEach(function (b) {
        b.onclick = function () {
          Store.addPlanItem(child.id, S.planStage, b.dataset.padd, b.dataset.ptext);
          toast('플랜에 담았어요', 'ok');
          App.refresh();
        };
      });
      UI.el('plan-add').onclick = function () {
        var t = UI.el('plan-text').value.trim();
        if (!t) { toast('내용을 입력해 주세요', 'err'); return; }
        Store.addPlanItem(child.id, S.planStage, UI.el('plan-area').value, t);
        App.refresh();
      };
      UI.el('plan-text').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); UI.el('plan-add').click(); }
      });
      document.querySelectorAll('[data-pstat]').forEach(function (b) {
        b.onclick = function () {
          var parts = b.dataset.pstat.split(':');
          Store.setPlanStatus(parts[0], parts[1]);
          App.refresh();
        };
      });
      document.querySelectorAll('[data-pdel2]').forEach(function (b) {
        b.onclick = function () {
          Modal.confirm({ title: '플랜 삭제', message: '이 항목을 삭제할까요?',
            okLabel: '삭제', danger: true }).then(function (ok) {
            if (ok) { Store.deletePlanItem(b.dataset.pdel2); App.refresh(); }
          });
        };
      });
    }
  };

  /* =====================================================================
   * 갤러리 — 기록 사진·영상 클립·안심 갤러리 모아보기
   * ===================================================================== */
  var GAL_FILTERS = [
    { id: 'all', label: '전체' }, { id: 'photo', label: '사진' },
    { id: 'video', label: '영상' }, { id: 'safe', label: '안심 갤러리' }
  ];
  function galleryItems(child) {
    var items = [];
    (child.gallery || []).forEach(function (g) {
      items.push({ kind: 'safe', type: 'photo', src: g.photo,
                   date: g.date, label: '안심 갤러리' });
    });
    Store.recordsOf(child.id).forEach(function (r) {
      if (r.photo) items.push({ kind: 'record', type: 'photo', src: r.photo,
                                date: r.date, label: r.title, recId: r.id });
      if (r.clipKey) items.push({ kind: 'record', type: 'video', clipKey: r.clipKey,
                                  date: r.date, label: r.title, recId: r.id });
    });
    items.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return items;
  }

  V.gallery = {
    layout: 'app',
    render: function (p) {
      var child = ownedChild(p.childId);
      if (!child) return notFound('아이 정보를 찾을 수 없어요');
      if (!S.galFilter) S.galFilter = 'all';
      var all = galleryItems(child);
      var items = all.filter(function (it) {
        if (S.galFilter === 'all') return true;
        if (S.galFilter === 'safe') return it.kind === 'safe';
        return it.type === S.galFilter;
      });

      var chips = GAL_FILTERS.map(function (f) {
        var n = all.filter(function (it) {
          if (f.id === 'all') return true;
          if (f.id === 'safe') return it.kind === 'safe';
          return it.type === f.id;
        }).length;
        return '<button class="chip' + (S.galFilter === f.id ? ' on' : '') +
          '" data-gfilter="' + f.id + '">' + f.label + ' ' + n + '</button>';
      }).join('');

      var grid = items.length
        ? '<div class="gal-grid">' + items.map(function (it, i) {
            var media = it.type === 'video'
              ? '<video data-galclip="' + esc(it.clipKey) + '" muted playsinline preload="metadata"></video>' +
                '<span class="gal-play">' + icon('eye', 18) + '</span>'
              : '<img src="' + it.src + '" alt="" loading="lazy">';
            return '<button class="gal-tile" data-gv="' + i + '">' + media +
              (it.kind === 'safe'
                ? '<span class="gal-badge safe">안심</span>'
                : '<span class="gal-badge">기록</span>') +
              (it.type === 'video' ? '<span class="gal-badge vid">영상</span>' : '') +
              '<span class="gal-date">' + UI.fmtDate(it.date) + '</span>' +
            '</button>';
          }).join('') + '</div>'
        : '<div class="card empty"><div class="emoji">🖼️</div>' +
          '<h3>아직 모인 사진·영상이 없어요</h3>' +
          '<p>기록에 사진·짧은 영상을 첨부하거나, 프로필의 안심 갤러리에 ' +
          '최신 사진을 올리면 여기에 자동으로 모입니다.</p>' +
          '<div class="row gap-sm" style="justify-content:center">' +
            '<button class="btn btn-primary btn-sm" onclick="App.navigate(\'#/records/' +
              child.id + '\')">기록 남기기</button>' +
            '<button class="btn btn-ghost btn-sm" onclick="App.navigate(\'#/child/' +
              child.id + '\')">안심 갤러리</button></div></div>';

      return childContextBar(child, 'gallery') +
        pageHead('갤러리', child.name + '의 갤러리',
          '기록에 담긴 사진·영상과 안심 갤러리를 한곳에서 봅니다.') +
        '<div class="pill-info mb-2">' + icon('info', 16) +
          '<div>기록 작성 시 첨부한 <b>사진·짧은 영상(릴스)</b>과 프로필의 <b>안심 갤러리</b>가 ' +
          '자동으로 모입니다. 사진을 누르면 크게 보고, 원본 기록으로 이동할 수 있어요.</div></div>' +
        '<div class="row wrap gap-sm mb-2">' + chips + '</div>' +
        grid;
    },
    mount: function (p) {
      var child = ownedChild(p.childId); if (!child) return;
      var all = galleryItems(child);
      var items = all.filter(function (it) {
        if (S.galFilter === 'all') return true;
        if (S.galFilter === 'safe') return it.kind === 'safe';
        return it.type === S.galFilter;
      });

      document.querySelectorAll('[data-gfilter]').forEach(function (b) {
        b.onclick = function () { S.galFilter = b.dataset.gfilter; App.refresh(); };
      });

      // 영상 클립 썸네일 로드 (IndexedDB)
      document.querySelectorAll('[data-galclip]').forEach(function (v) {
        if (!VideoDB.available()) return;
        VideoDB.get(v.dataset.galclip).then(function (blob) {
          if (blob) v.src = URL.createObjectURL(blob);
        }).catch(function () {});
      });

      // 라이트박스
      document.querySelectorAll('[data-gv]').forEach(function (b) {
        b.onclick = function () {
          var it = items[parseInt(b.dataset.gv, 10)];
          if (!it) return;
          var body;
          if (it.type === 'video') {
            var loaded = b.querySelector('video') && b.querySelector('video').src;
            body = '<video class="gal-light" controls autoplay playsinline ' +
              (loaded ? 'src="' + loaded + '"' : '') + '></video>';
          } else {
            body = '<img class="gal-light" src="' + it.src + '" alt="">';
          }
          Modal.open({
            title: (it.label || '사진') + ' · ' + UI.fmtDate(it.date),
            icon: 'camera', wide: true,
            body: '<div style="text-align:center">' + body + '</div>',
            buttons: (it.recId
              ? [{ label: '원본 기록 보기', value: 'rec', variant: 'soft' }]
              : [{ label: '안심 갤러리 관리', value: 'safe', variant: 'soft' }]
            ).concat([{ label: '닫기', value: 'cancel', variant: 'primary' }]),
            onButton: function (v) {
              if (v === 'rec') App.navigate('#/records/' + child.id);
              else if (v === 'safe') App.navigate('#/child/' + child.id);
            }
          });
        };
      });
    }
  };

  /* =====================================================================
   * 친화 장소 디렉터리 — 큐레이션 + 외부 지도 바로가기
   * ===================================================================== */
  var PLACE_CATS = ['전체', '병원·의원', '치과', '치료·센터', '카페·식당', '미용·생활', '놀이·여가'];
  /* 데모 예시 데이터 — 정식 버전에서는 제휴·검증을 거친 실제 장소가 등록됩니다 */
  var PLACES = [
    { name: '하늘아동발달의원', cat: '병원·의원', area: '대구 수성구',
      points: ['조용한 대기 공간', '예약제 — 대기 짧음', '보호자 동반 진료'],
      desc: '발달장애 아동 진료 경험이 많은 소아청소년과. 진료 전 아이 특성 메모를 전달할 수 있어요.' },
    { name: '미소나무 어린이치과', cat: '치과', area: '대구 중구',
      points: ['행동 유도 진료', '첫 방문 적응 프로그램', '소리 줄인 진료실'],
      desc: '치료 전 기구를 만져보는 적응 시간을 따로 줍니다. 감각이 예민한 아이도 천천히.' },
    { name: '스텔라 감각통합센터', cat: '치료·센터', area: '대구 수성구',
      points: ['감각통합·언어 병행', '부모 상담 정기 제공'],
      desc: '주 단위 가정 연계 활동지를 제공해 가정에서도 이어서 할 수 있어요.' },
    { name: '느린나무 카페', cat: '카페·식당', area: '대구 중구',
      points: ['조용한 별실 보유', '발달장애 가족 환영', '키즈 메뉴'],
      desc: '별실을 예약하면 아이가 편안하게 머물 수 있어요. 주말 오전이 한산합니다.' },
    { name: '한가족 김밥·국수', cat: '카페·식당', area: '대구 달서구',
      points: ['음식 빠른 제공', '가족석·구석 자리', '주인장 이해도 높음'],
      desc: '주문 즉시 나오는 메뉴가 많아 기다림이 힘든 아이와 가기 좋아요.' },
    { name: '살핌 헤어', cat: '미용·생활', area: '대구 수성구',
      points: ['감각 민감 아동 커트 경험', '예약제 단독 이용 가능'],
      desc: '소리 작은 가위 위주로, 아이 페이스에 맞춰 쉬어 가며 잘라 줍니다.' },
    { name: '모두의 실내놀이터', cat: '놀이·여가', area: '대구 북구',
      points: ['무장애 놀이시설', '조용한 시간대 운영(평일 오전)', '보호자 휴게 공간'],
      desc: '평일 오전 "차분한 놀이 시간"에는 음악과 조명을 낮춰 운영합니다.' },
    { name: '함께 수영교실', cat: '놀이·여가', area: '대구 달서구',
      points: ['발달장애 아동 1:1 강습', '소그룹(3인 이하)'],
      desc: '물을 무서워하지 않는 아이들의 안전 교육을 겸한 수영 강습.' }
  ];

  function mapLinks(name, area) {
    var q = encodeURIComponent(area.split(' ')[0] + ' ' + name);
    return '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" ' +
      'href="https://map.kakao.com/link/search/' + q + '">' + icon('external', 13) + '카카오맵</a>' +
      '<a class="btn btn-ghost btn-sm" target="_blank" rel="noopener" ' +
      'href="https://map.naver.com/p/search/' + q + '">' + icon('external', 13) + '네이버지도</a>';
  }

  V.places = {
    layout: 'app',
    render: function () {
      if (!S.placeCat) S.placeCat = '전체';
      var list = PLACES.filter(function (pl) {
        return S.placeCat === '전체' || pl.cat === S.placeCat;
      });
      var catChips = PLACE_CATS.map(function (c) {
        return '<button class="chip' + (S.placeCat === c ? ' on' : '') +
          '" data-pcat="' + esc(c) + '">' + esc(c) + '</button>';
      }).join('');

      var cards = list.map(function (pl) {
        return '<div class="card card-pad place-card">' +
          '<div class="row between wrap" style="margin-bottom:6px">' +
            '<b style="font-size:1.02rem">' + esc(pl.name) + '</b>' +
            '<span class="row gap-sm"><span class="badge brand">' + esc(pl.cat) + '</span>' +
            '<span class="badge">' + esc(pl.area) + '</span></span></div>' +
          '<div class="place-points">' + pl.points.map(function (pt) {
            return '<span class="tag">' + icon('check', 11) + ' ' + esc(pt) + '</span>';
          }).join('') + '</div>' +
          '<p class="muted" style="font-size:.88rem;margin:8px 0 12px">' + esc(pl.desc) + '</p>' +
          '<div class="row gap-sm wrap">' + mapLinks(pl.name, pl.area) + '</div>' +
        '</div>';
      }).join('');

      return pageHead('친화 장소', '발달장애 친화 장소',
          '"여기는 우리 아이와 가도 괜찮아요" — 가족들이 검증한 장소를 모았습니다.',
          '<button class="btn btn-primary btn-sm" id="btn-report-place">' +
            icon('plus', 15) + '장소 제보</button>') +
        '<div class="pill-info mb-2">' + icon('info', 16) +
          '<div>아래 목록은 <b>데모용 예시</b>입니다. 정식 버전에서는 제휴·가족 추천으로 검증된 ' +
          '장소가 등록되며, 길찾기는 카카오맵·네이버지도로 바로 연결됩니다.</div></div>' +
        '<div class="row wrap gap-sm mb-2">' + catChips + '</div>' +
        '<div class="grid grid-2" style="align-items:start">' + (cards ||
          '<p class="muted">이 분류의 장소가 아직 없어요.</p>') + '</div>';
    },
    mount: function () {
      document.querySelectorAll('[data-pcat]').forEach(function (b) {
        b.onclick = function () { S.placeCat = b.dataset.pcat; App.refresh(); };
      });
      UI.el('btn-report-place').onclick = function () {
        Modal.open({
          title: '친화 장소 제보', icon: 'plus',
          body:
            '<p class="muted mb-2" style="font-size:.9rem">우리 아이와 편하게 다녀온 곳이 있다면 ' +
            '알려 주세요. 검토 후 다른 가족들에게도 소개됩니다.</p>' +
            '<div class="field"><label>장소 이름</label>' +
              '<input class="input" name="name" placeholder="예) ○○ 카페 (지점명까지)"></div>' +
            '<div class="field"><label>분류</label><select class="select" name="category">' +
              PLACE_CATS.slice(1).map(function (c) { return '<option>' + c + '</option>'; }).join('') +
              '</select></div>' +
            '<div class="field"><label>추천 이유</label>' +
              '<textarea class="textarea" name="reason" ' +
              'placeholder="예) 별실이 있어서 조용하게 식사할 수 있었어요"></textarea></div>',
          buttons: [
            { label: '취소', value: 'cancel', variant: 'ghost' },
            { label: '제보하기', value: 'ok', variant: 'primary' }
          ],
          onButton: function (v, root) {
            if (v !== 'ok') return;
            var f = readForm(root);
            if (!f.name) { toast('장소 이름을 입력해 주세요', 'err'); return 'keep'; }
            Store.addPlaceReport({ name: f.name, category: f.category, reason: f.reason });
            toast('제보 감사합니다! 검토 후 등록할게요', 'ok');
          }
        });
      };
    }
  };

})(window);
