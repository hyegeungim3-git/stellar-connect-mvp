/* =====================================================================
 * seed.js — 데모 데이터 주입
 * 빈 데이터베이스이거나 시드 버전이 갱신되면 최신 데모 데이터로 (재)구성한다.
 * SEED_VERSION 을 올리면 모든 사용자 브라우저가 다음 접속 시 자동 반영된다.
 * ===================================================================== */
(function (global) {
  'use strict';

  var SEED_VERSION = 16;   // 데모 데이터 변경 시 이 숫자를 올린다 (v16: 텐텐 아침·저녁 2회 — 복수 시간대 예시)

  function item(text) { return { id: Store.uid('it'), text: text }; }
  function prob(situation, response, intensity) {
    return { id: Store.uid('pb'), situation: situation, response: response,
             intensity: intensity || '중간' };
  }

  function seedIfEmpty() {
    var db = Store.getDB();
    if (db.meta.seeded && db.meta.seedVersion === SEED_VERSION) return;

    /* 빈 DB이거나 데모 시드가 갱신됨 → 최신 데모 데이터로 (재)구성.
       세션(localStorage 별도 키)은 유지 — 데모 계정 ID가 고정이므로 로그인 상태 보존. */
    var createdAt = (db.meta && db.meta.createdAt) || Store.nowISO();
    db.users = []; db.children = []; db.manuals = []; db.records = [];
    db.shares = []; db.contents = []; db.popups = [];
    db.notifications = [];
    // 신규 컬렉션도 함께 리셋 — 고정 id 시드(plan-1, vn-demo)가 중복 푸시되는 것 방지
    db.plans = []; db.visitNotes = []; db.placeReports = [];
    db.medChecks = {}; db.dailyChecks = {};
    if ('observations' in db) delete db.observations;  // v6: 영상 관찰 기능 제거에 따른 정리
    db.meta = { createdAt: createdAt, seeded: false };

    /* ---------- 사용자 ---------- */
    var admin = {
      id: 'user-admin', name: '운영관리자', email: 'admin@ichild.kr',
      phone: '02-000-0000', password: 'admin123', role: 'admin', status: 'active',
      verified: true, provider: 'email', healthStatus: '',
      emergencyContacts: [], notify: { push: true, schedule: true, crisis: true },
      createdAt: '2026-04-20T09:00:00.000Z'
    };
    var parent1 = {
      id: 'user-parent1', name: '김민서', email: 'parent@example.com',
      phone: '010-1234-5678', password: '1234', role: 'parent', status: 'active',
      verified: true, provider: 'email',
      healthStatus: '특이사항 없음. 정기 건강검진 결과 양호.',
      emergencyContacts: [
        { name: '김도현', relation: '배우자', phone: '010-2222-3333' },
        { name: '이정숙', relation: '외조모', phone: '010-4444-5555' }
      ],
      notify: { push: true, schedule: true, crisis: true },
      createdAt: '2026-04-22T02:00:00.000Z'
    };
    var parent2 = {
      id: 'user-parent2', name: '박지영', email: 'jypark@example.com',
      phone: '010-9876-5432', password: '1234', role: 'parent', status: 'active',
      verified: true, provider: 'kakao',
      healthStatus: '', emergencyContacts: [],
      notify: { push: true, schedule: false, crisis: true },
      createdAt: '2026-05-02T05:00:00.000Z'
    };
    db.users.push(admin, parent1, parent2);

    /* ---------- 아이 프로필 ---------- */
    var child1 = {
      id: 'child-junho', ownerId: parent1.id,
      name: '이준호', birthDate: '2019-03-12', gender: '남',
      photo: 'assets/img/child-junho.jpg',
      body: { height: '122', weight: '24', bloodType: 'A형', sizes: '상의 130 · 신발 190',
              features: '왼쪽 눈썹 옆 작은 흉터, 외출 시 파란색 기차 가방을 꼭 메고 다녀요' },
      gallery: [
        { id: 'gal-junho-1', photo: 'assets/img/child-junho.jpg', date: '2026-06-01T09:00:00.000Z' }
      ],
      disability: {
        type: '자폐 스펙트럼 장애',
        summary: '사회적 의사소통과 상호작용에 어려움이 있으며, 반복적 행동 패턴과 감각 예민함(특히 청각)이 두드러집니다. 익숙한 일과와 환경에서 가장 안정적입니다.',
        diagnosedAt: '2022-06',
        sensory: '청각 과민(큰 소리·예고 없는 소음에 강하게 반응) / 촉각 예민(끈적한 질감 회피) / 시각 — 밝은 형광등 불편'
      },
      medications: [
        /* 자폐 아동의 실제 복약 구성 예 — 핵심 처방약 + 동반 증상(변비·알레르기·편식) 관리약.
           마그밀·지르텍·텐텐은 식약처 e약은요(일반의약품 개요)에서 ⓘ로 실데이터가 조회된다.
           리스페리돈은 전문의약품이라 e약은요에 없음 → 약학정보원 폴백 상태의 예시. */
        { kind: '일반약', name: '마그밀', dose: '1', doseUnit: '정', time: '저녁 식후',
          startDate: '2026-04-01', endDate: '', dosing: '변비가 있는 날 저녁 식후 1정, 물과 충분히',
          note: '변비가 이어질 때만 먹여요.' },
        { kind: '처방약', name: '리스페리돈', dose: '0.5', doseUnit: 'mg', time: '자기 전',
          startDate: '2026-02-10', endDate: '', dosing: '자기 전 1회 — 소아정신과 처방(과민성·도전적 행동 완화)',
          note: '용량 변경은 꼭 주치의와 상의해요.' },
        { kind: '일반약', name: '지르텍', dose: '10', doseUnit: 'mg', time: '자기 전',
          startDate: '2026-05-20', endDate: '', dosing: '알레르기 증상(콧물·두드러기)이 있을 때 자기 전 1회',
          note: '졸릴 수 있어 저녁에 먹여요.' },
        { kind: '영양제', name: '텐텐', dose: '1', doseUnit: '정', time: '아침 식후 · 저녁 식후',
          startDate: '2026-01-15', endDate: '', dosing: '아침·저녁 식후 1정씩, 잘 씹어서',
          note: '편식이 있어 영양 보충 중이에요.' }
      ],
      allergies: [
        { name: '땅콩', reaction: '두드러기·호흡곤란', severity: '중증' },
        { name: '우유', reaction: '복통·발진', severity: '경증' }
      ],
      emergency: {
        protocol: '발작·심한 자해 행동 시: ① 주변 위험물 제거 후 안전 확보 ② 억지로 제지하지 말 것 ③ 5분 이상 지속 시 119 신고 ④ 보호자에게 즉시 연락',
        hospital: '서울○○병원 소아청소년정신과',
        doctor: '정○○ 교수 (02-000-1234)',
        contacts: [
          { name: '김민서', relation: '모', phone: '010-1234-5678' },
          { name: '김도현', relation: '부', phone: '010-2222-3333' }
        ]
      },
      verifyStatus: 'verified', verifyDocs: ['복지카드 사본', '진단서'],
      handover: {
        caretakers: [
          { name: '박수진', relation: '이모', phone: '010-7777-1234' },
          { name: '김도현', relation: '부', phone: '010-2222-3333' }
        ],
        items: {
          commute: '노란 셔틀 8:10 아파트 정문 승차, 하원 4시 같은 자리',
          meal: '밥은 작게 떠 주세요. 반찬은 섞이지 않게 따로따로. 간식은 4시 한 번',
          meds: '리스페리돈 — 냉장고 옆 흰 약통, 자기 전 1알. 지르텍은 콧물·두드러기 있는 날만',
          schedule: '화·목 4시 스텔라 감각통합센터 (김◯◯ 선생님 010-5555-0000)',
          sleep: '9시 소등, 자장가는 늘 같은 곡, 기차 인형 꼭 안고 자요'
        },
        note: '무서워하거나 불안해하면 기차 이야기를 꺼내 주세요. 금방 마음을 엽니다. 우리 준호를 부탁드려요.'
      },
      createdAt: '2026-04-22T02:30:00.000Z', updatedAt: '2026-05-18T08:00:00.000Z'
    };
    var child2 = {
      id: 'child-seoyeon', ownerId: parent2.id,
      name: '박서연', birthDate: '2021-09-01', gender: '여',
      photo: 'assets/img/child-seoyeon.jpg',
      body: { height: '96', weight: '15', bloodType: 'O형', sizes: '상의 110 · 신발 160',
              features: '토끼 인형을 항상 안고 다녀요' },
      gallery: [
        { id: 'gal-seoyeon-1', photo: 'assets/img/child-seoyeon.jpg', date: '2026-05-20T09:00:00.000Z' }
      ],
      disability: {
        type: '자폐 스펙트럼 장애',
        summary: '언어 발달 지연이 있어 단어 위주로 의사 표현을 합니다. 또래에게 관심은 있으나 다가가는 방법을 어려워합니다.',
        diagnosedAt: '2025-03',
        sensory: '청각 — 보통 / 촉각 — 특정 옷 라벨·솔기 불편 / 전정감각 추구(빙글빙글 도는 활동 선호)'
      },
      medications: [],
      allergies: [{ name: '계란', reaction: '발진', severity: '경증' }],
      emergency: {
        protocol: '낯선 환경에서 심하게 울 때: 익숙한 인형(토끼)을 건네고 조용한 곳으로 이동',
        hospital: '○○대학교병원 재활의학과',
        doctor: '미정',
        contacts: [{ name: '박지영', relation: '모', phone: '010-9876-5432' }]
      },
      verifyStatus: 'pending', verifyDocs: ['복지카드 사본'],
      createdAt: '2026-05-02T05:20:00.000Z', updatedAt: '2026-05-15T01:00:00.000Z'
    };
    db.children.push(child1, child2);

    /* ---------- 설명서 ---------- */
    var manual1 = {
      id: 'manual-junho', childId: child1.id,
      sections: {
        canDo: [
          item('혼자 옷을 입고 벗을 수 있어요 (단추는 도움 필요).'),
          item('좋아하는 그림책을 스스로 골라 읽어요.'),
          item('숫자를 100까지 셀 수 있어요.'),
          item('정해진 자리에서 식사를 끝까지 해요.'),
          item('간단한 심부름(물건 가져다 주기)을 할 수 있어요.')
        ],
        needHelp: [
          item('새로운 장소에 적응할 때 — 미리 사진으로 보여주면 도움이 돼요.'),
          item('갑작스러운 일정 변경 — 그림카드로 차근차근 설명이 필요해요.'),
          item('낯선 사람과의 대화 — 처음엔 보호자가 함께 있어야 해요.'),
          item('신발 끈 묶기 — 아직 어려워해요.'),
          item('단체 활동 참여 — 한 번에 한 가지 지시로 도와주세요.')
        ],
        like: [
          item('기차와 지하철 (노선도 보는 것을 정말 좋아해요)'),
          item('파란색 — 옷·물건은 파란색을 고르면 좋아해요'),
          item('퍼즐 맞추기, 잔잔한 음악'),
          item('김밥, 흰 쌀밥')
        ],
        dislike: [
          item('크고 갑작스러운 소리 (청소기·확성기·박수 소리)'),
          item('예고 없는 신체 접촉 — 안기 전에 꼭 물어봐 주세요'),
          item('끈적하거나 미끌거리는 음식 질감'),
          item('밝게 깜빡이는 형광등')
        ],
        problem: [
          prob('큰 소음에 노출되어 귀를 막고 소리를 지를 때',
               '조용한 공간으로 함께 이동하고, 노이즈캔슬링 헤드폰을 착용시켜 주세요. 진정될 때까지 말을 줄이고 기다려 주세요.', '높음'),
          prob('일과가 갑자기 바뀌어 불안해할 때',
               '바뀐 일정을 그림카드·시각 스케줄로 보여주며 미리 예고해 주세요. "다음은 ○○이야"라고 짧게 알려 주세요.', '중간'),
          prob('손을 흔드는 자기자극 행동을 할 때',
               '위험한 행동이 아니므로 억지로 제지하지 마세요. 스스로 진정하는 과정이며, 안전만 확보해 주세요.', '낮음'),
          prob('원하는 것을 얻지 못해 바닥에 누울 때',
               '관심을 과하게 주지 말고, 차분히 선택지 2가지를 제시해 주세요. ("앉아서 기다리기" / "다른 놀이 하기")', '중간')
        ],
        comm: [
          item('짧고 명확한 문장을 사용해 주세요. ("이제 손 씻자" O / "손이 더러우니까 가서 씻고 와야지" X)'),
          item('지시는 한 번에 하나씩 — 끝나면 다음 지시를 주세요.'),
          item('그림카드(PECS)를 함께 사용하면 이해가 훨씬 빨라요.'),
          item('"안 돼" 대신 "이렇게 하자"처럼 해야 할 행동을 알려 주세요.'),
          item('시각적 타이머를 보여주면 전환(활동 바꾸기)이 수월해요.')
        ],
        routine: [
          item('아침 7시 기상 — 일어나면 좋아하는 기차 사진 한 장 보여 주세요. 기분 좋게 시작합니다.'),
          item('등원 전 8시 — 옷은 본인이 직접 고르게 해 주세요(선택지 2벌 제시).'),
          item('하원 후 4시 — 30분 자유 놀이 → 간식 → 학습 순서가 가장 잘 됩니다.'),
          item('저녁 7시 식사 — TV·태블릿은 끄고 가족과 함께 앉아 먹어요.'),
          item('저녁 8시 목욕 — 따뜻한 물 좋아해요. 라벤더 향은 피해 주세요(불편해함).'),
          item('잠자리 8:30 — 책 한 권 읽고 9시에 소등. 자장가는 같은 곡으로(예측 가능).')
        ],
        safety: [
          item('찻길·주차장에서는 꼭 손을 잡아 주세요. 차 소리에 놀라 갑자기 뛸 수 있어요.'),
          item('문이 열려 있으면 밖으로 나갈 수 있어요. 현관·비상구는 꼭 닫아 주세요.'),
          item('물을 무서워하지 않아요 — 욕조·수영장 근처에서는 항상 곁에 있어 주세요.')
        ]
      },
      summaryNote: '준호는 예측 가능한 환경에서 가장 빛나는 아이예요.',
      parentNote: '느려도 괜찮으니 끝까지 기다려 주세요. 준호는 시간을 주면 분명히 해냅니다. 우리 아이를 따뜻하게 봐주셔서 감사합니다.',
      updatedAt: '2026-05-18T08:00:00.000Z'
    };
    var manual2 = {
      id: 'manual-seoyeon', childId: child2.id,
      sections: {
        canDo: [
          item('좋아하는 단어로 원하는 것을 표현해요 ("물", "더").'),
          item('익숙한 율동 노래를 따라 해요.')
        ],
        needHelp: [
          item('또래에게 다가가는 방법 — 어른이 다리를 놓아주면 좋아요.'),
          item('식사 시간에 새로운 음식 시도하기.')
        ],
        like: [item('빙글빙글 도는 놀이기구'), item('토끼 인형 (애착 인형이에요)')],
        dislike: [item('옷의 라벨·솔기 — 닿으면 불편해해요')],
        problem: [
          prob('낯선 환경에서 심하게 울 때', '애착 인형(토끼)을 건네고 조용한 곳으로 이동해 안아 주세요.')
        ],
        comm: [
          item('단어 + 손짓을 함께 사용하면 더 잘 통해요.'),
          item('충분히 기다려 주면 스스로 말을 시작해요.')
        ],
        routine: [
          item('아침 8시 기상 — 토끼 인형과 함께 천천히 깨워 주세요.'),
          item('낮잠 1시 — 30분~1시간 정도 푹 자야 오후가 편안해요.'),
          item('저녁 7시 식사 — 새로운 음식은 한 입씩, 권하기보다 같이 먹는 모습 보여 주세요.')
        ]
      },
      summaryNote: '서연이는 천천히, 그러나 분명하게 자라고 있어요. 재촉하지 않고 기다려 주세요.',
      parentNote: '낯선 곳에서는 토끼 인형이 큰 힘이 돼요. 서연이의 작은 표현도 알아봐 주시면 정말 감사하겠습니다.',
      updatedAt: '2026-05-15T01:00:00.000Z'
    };
    db.manuals.push(manual1, manual2);

    /* ---------- 기록 (행동 / 치료 / 변화) ---------- */
    db.records.push(
      { id: 'rec-1', childId: child1.id, type: 'change', date: '2026-05-17', time: '15:20',
        title: '처음으로 친구에게 먼저 인사했어요', mood: 5,
        content: '놀이치료실에서 또래에게 먼저 "안녕"이라고 말함. 작은 목소리였지만 스스로 시도한 첫 사례.',
        tags: ['사회성', '의사소통'], photo: 'assets/img/child-junho.jpg',
        createdAt: '2026-05-17T08:00:00.000Z' },
      { id: 'rec-8', childId: child1.id, type: 'medication', date: '2026-05-16', time: '21:30',
        title: '리스페리돈 복용 (자기 전)', mood: 4,
        content: '[복약 정보]\n· [처방약] 리스페리돈 0.5mg · 자기 전 · 소아정신과 처방(과민성·도전적 행동 완화)\n\n복용 후 저녁 짜증이 눈에 띄게 줄었어요. 잠들기도 수월했고 아침 기상도 순조로웠어요.',
        tags: ['행동', '복약'], photo: null, createdAt: '2026-05-16T12:30:00.000Z' },
      { id: 'rec-2', childId: child1.id, type: 'treatment', date: '2026-05-14', time: '10:00',
        title: '언어치료 24회기', mood: 4,
        content: '주 2회 언어치료 진행. 2어절 문장 따라 말하기 안정적. 다음 목표는 요구하기 표현 확장.',
        tags: ['언어치료'], photo: null, createdAt: '2026-05-14T07:00:00.000Z' },
      { id: 'rec-3', childId: child1.id, type: 'behavior', date: '2026-05-12',
        title: '마트에서 소음으로 힘들어함', mood: 2,
        content: '오후 마트 방문 중 안내방송 소리에 귀를 막고 주저앉음. 헤드폰 착용 후 5분 만에 진정. 다음엔 한산한 시간대 방문 예정.',
        tags: ['감각', '청각과민'], photo: null, createdAt: '2026-05-12T10:00:00.000Z' },
      { id: 'rec-4', childId: child1.id, type: 'behavior', date: '2026-05-08',
        title: '아침 등원 루틴 안정적', mood: 4,
        content: '그림 스케줄 도입 3주차. 아침 준비 과정에서 떼쓰기 없이 순서대로 진행함.',
        tags: ['루틴', '일상'], photo: null, createdAt: '2026-05-08T23:00:00.000Z' },
      { id: 'rec-5', childId: child1.id, type: 'treatment', date: '2026-04-30',
        title: '감각통합치료 평가', mood: 3,
        content: '청각 방어 반응 여전. 전정·고유수용 활동에는 잘 참여. 가정 연계 활동 안내받음.',
        tags: ['감각통합'], photo: null, createdAt: '2026-04-30T06:00:00.000Z' },
      { id: 'rec-6', childId: child2.id, type: 'change', date: '2026-05-10',
        title: '새 단어 "더" 사용 시작', mood: 5,
        content: '간식을 더 먹고 싶을 때 "더"라고 표현. 요구하기 의사소통의 첫 확장.',
        tags: ['언어', '의사소통'], photo: null, createdAt: '2026-05-10T05:00:00.000Z' },
      { id: 'rec-7', childId: child1.id, type: 'assessment', date: '2026-04-21',
        title: '언어평가(PRES) 결과', mood: 3,
        content: '수용언어 36개월 / 표현언어 30개월 수준. 6개월 전 대비 각 4개월 향상. 결과지는 사진으로 보관 — 새 치료실·학교에 다시 제출할 필요 없이 이 기록을 공유하면 됩니다.',
        tags: ['검사', '언어평가'], photo: null, createdAt: '2026-04-21T05:00:00.000Z' }
    );

    /* ---------- 공유 ---------- */
    db.shares.push({
      id: 'shr-demo', token: 'JUNHO7', childId: child1.id, scope: 'summary',
      viewerName: '햇살초등학교 1학년 담임', viewerRole: '학교',
      accessCode: '0312', safeNumber: true,
      createdAt: '2026-05-18T09:00:00.000Z',
      expiresAt: null, revoked: false, views: 3
    });

    /* ---------- 방문 노트 (열람자가 남긴 한마디) ---------- */
    db.visitNotes.push({
      id: 'vn-demo', shareId: 'shr-demo', childId: child1.id,
      author: '햇살초 1학년 담임', role: '교사',
      text: '설명서 잘 읽었습니다. 오늘 음악 시간에 소리가 커지자 스스로 귀를 막고 제게 와서 도움을 청했어요. 설명서 덕분에 바로 조용한 교실로 안내할 수 있었습니다.',
      createdAt: '2026-05-20T06:30:00.000Z'
    });

    /* ---------- 성장 플랜 (학령기 예시) ---------- */
    db.plans.push(
      { id: 'plan-1', childId: child1.id, stage: 'school', area: 'edu',
        text: '개별화교육계획(IEP) 협의에 참여하기', status: 'done',
        createdAt: '2026-05-01T00:00:00.000Z' },
      { id: 'plan-2', childId: child1.id, stage: 'school', area: 'daily',
        text: '등하교 준비 루틴 스스로 하기', status: 'doing',
        createdAt: '2026-05-01T00:00:00.000Z' },
      { id: 'plan-3', childId: child1.id, stage: 'school', area: 'social',
        text: '좋아하는 취미 활동 1가지 정하기 (수영 후보)', status: 'todo',
        createdAt: '2026-05-01T00:00:00.000Z' }
    );

    /* ---------- 백오피스: 콘텐츠 ---------- */
    db.contents.push(
      { id: 'cnt-about', key: 'about', title: '서비스 소개',
        body: '「내 아이 설명서」(Stellar Connect, S:CON)는 발달장애 아이를 누구나 이해할 수 있도록 돕는 서비스입니다. 좋아하는 것·의사소통 방법·감각 특성·도전적 행동과 지원 방법을 체계적으로 정리하고, 학교용·병원용·활동지원사용·돌봄기관용 설명서로 만들어 공유합니다. 기록을 쌓는 것이 아니라, 부모를 대신해 우리 아이를 설명해 주는 것을 목표로 합니다.' },
      { id: 'cnt-terms', key: 'terms', title: '이용약관',
        body: '제1조(목적) 본 약관은 Stellar Connect(S:CON) 서비스 이용에 관한 사항을 규정합니다.' },
      { id: 'cnt-privacy', key: 'privacy', title: '개인정보처리방침',
        body: '본 서비스는 아동 및 보호자의 민감정보를 다루며, 수집 최소화·목적 외 사용 금지 원칙을 준수합니다.' },
      { id: 'cnt-faq', key: 'faq', title: '자주 묻는 질문',
        body: 'Q. 설명서는 어떻게 공유하나요?\nA. 설명서 보기 화면에서 공유 링크와 4자리 인증번호를 발급할 수 있습니다.' }
    );

    /* ---------- 백오피스: 팝업 ---------- */
    db.popups.push({
      id: 'pop-1', title: '「내 아이 설명서」 오픈 안내',
      body: '「내 아이 설명서」 서비스가 열렸습니다. 우리 아이를 이해하는 항목을 채우고, 학교·병원용 설명서로 공유해 보세요.',
      active: true, createdAt: '2026-05-20T00:00:00.000Z'
    });

    /* ---------- 알림 로그 ---------- */
    db.notifications.push(
      { id: 'noti-1', target: '전체 양육자', channel: 'push',
        title: '설명서 업데이트 알림', body: '한 달 이상 업데이트되지 않은 설명서가 있어요. 아이의 변화를 기록해 보세요.',
        sentAt: '2026-05-19T01:00:00.000Z' }
    );

    db.meta.seeded = true;
    db.meta.seedVersion = SEED_VERSION;
    db.meta.seededAt = Store.nowISO();
    Store.setDB(db);
    console.log('[seed] 데모 데이터가 준비되었습니다. (v' + SEED_VERSION + ')');
  }

  global.Seed = { seedIfEmpty: seedIfEmpty };
})(window);
