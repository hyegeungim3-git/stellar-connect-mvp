/* =====================================================================
 * tutorial.js — 메뉴별 튜토리얼
 * 둘러보기(tour.js)가 "서비스 전체 흐름"을 1분에 보여준다면,
 * 튜토리얼은 "이 메뉴 하나를 어떻게 쓰는지"를 화면 위에서 차근차근 안내한다.
 * 실행 엔진은 tour.js의 Guide를 그대로 재사용 — 조작 방식이 둘 다 같다.
 * 진입: 계정 메뉴 '메뉴별 튜토리얼' · 화면 도움말(?) 하단 · 둘러보기 마지막 단계
 * ===================================================================== */
(function (global) {
  'use strict';
  if (!global.UI) return;
  var icon = UI.icon, esc = UI.esc;
  var DONE_KEY = 'scon_tutorial_done';

  /* ---------------------------------------------------------------------
   * 튜토리얼 콘텐츠 — 화면별 실제 요소(focus)를 짚어가며 설명
   * ------------------------------------------------------------------- */
  var TUTORIALS = [
    { key: 'dashboard', ic: 'home', route: '#/dashboard', label: '홈',
      title: '홈 — 오늘 하루를 한눈에',
      summary: '아이의 지금 모습과 오늘 할 일(복약·기록)이 모이는 첫 화면',
      steps: [
        { focus: '', t: '홈은 이런 곳이에요',
          b: '홈은 아이의 요즘 모습과 오늘 챙길 것들을 한 화면에 모아 둔 곳이에요. 매일 길게 쓰지 않아도, 잠깐 들러 탭 몇 번만 하면 하루가 이어져요.' },
        { focus: '.home-profile', t: '아이 한 장 요약',
          b: '사진과 이름, 나이, 한 줄 소개와 함께 ‘요즘 반짝인 순간’이 먼저 보여요. 좋았던 순간부터 눈에 들어오게 두어서, 앱을 여는 일이 숙제가 아니라 아이를 다시 보는 시간이 되도록 했어요.' },
        { focus: '#med-today', t: '오늘의 복약',
          b: '등록해 둔 약의 복용 시간에만 버튼이 켜져요. 한 번 누르면 기록되고, 이미 기록된 버튼(✓)을 다시 누르면 확인 창이 한 번 뜬 뒤 지워져요. 체크한 내용은 기록에도 함께 남아 병원에서 이야기하기 쉬워져요.' },
        { focus: '.quick-log', t: '빠른 기록 5가지',
          b: '행동·치료·변화·검사 중 하나를 누르면 그 유형으로 맞춰진 기록 창이 바로 열리고, ‘영상’을 누르면 기록 창과 함께 영상 고르기 화면이 이어서 떠요. 이렇게 모인 순간들이 나중에 설명서와 공유 한 장으로 이어져요.' },
        { focus: '.hp-actions', t: '오늘 한 가지만 해 볼까요',
          b: '아래 ‘설명서’ 버튼으로 아이를 소개하는 내용을 이어서 채우거나, ‘대상별 공유’로 학교·병원에 보여 줄 한 장을 만들 수 있어요. 오늘은 기록 한 줄만 남겨 보셔도 좋아요.' }
      ] },

    { key: 'childProfile', ic: 'smile', route: '#/child/:childId', label: '아이 프로필',
      title: '아이 프로필 — 우리 아이를 알려 주는 기본 정보',
      summary: '설명서와 대상별 공유의 바탕이 되는 기본·안심 정보',
      steps: [
        { focus: '', t: '어떤 화면인가요',
          b: '우리 아이를 처음 만나는 사람에게 알려 주고 싶은 사실들을 한곳에 모아 두는 곳이에요. 여기 적어 둔 내용이 설명서와 대상별 공유의 바탕이 되는데, 한 번에 다 채우지 않으셔도 괜찮아요.' },
        { focus: '.profile-hero', t: '한눈에 보이는 요약',
          b: '사진과 나이, 진단이 맨 위에 모여 있어 처음 보는 분도 아이를 금방 떠올릴 수 있어요. 사진 옆 카메라 버튼으로 최신 사진으로 바꾸고, [정보 수정]이나 [설명서 작성]으로 바로 이어갈 수 있어요.' },
        { focus: '.grid-2', t: '네 장의 기본 카드',
          b: '기본 정보·장애 특성·약물 정보·알레르기 네 가지로 나뉘어 있어요. 이 화면은 모아서 보는 곳이라, 채우거나 고치실 때는 위쪽 [정보 수정]을 눌러 주세요. 알레르기는 심함·보통·약함으로 표시돼요.' },
        { focus: '.grid-2 + .mt-2', t: '응급 대응 정보',
          b: '힘든 순간에 곁에 있는 어른이 무엇부터 해야 하는지, 주치 병원·담당 의료진·비상 연락처는 어디인지 한곳에 모아 두는 곳이에요. 적어 두면 부모님이 곁에 안 계신 순간에도 아이가 익숙한 방식으로 도움을 받을 수 있어요.' },
        { focus: '.safe-gallery', t: '안심 갤러리',
          b: '아이는 자라는데 등록된 사진은 예전 그대로인 경우가 많지요. 외출이나 여행 전에 최신 사진을 한 장 남겨 두면 위급한 상황에서 가장 빠른 단서가 돼요.' },
        { focus: '#btn-handover', t: '내가 없을 때',
          b: '입원이나 출장처럼 잠시 자리를 비울 때, 대신 돌봐 주실 분이 알아야 할 등하원·식사·수면 같은 핵심을 미리 적어 두는 곳이에요. 비어 있으면 [작성], 이미 적어 두셨다면 [수정] 버튼이 보여요.' }
      ] },

    { key: 'manual', ic: 'book', route: '#/manual/:childId', label: '설명서',
      title: '설명서 — 우리 아이를 한 장으로',
      summary: '처음 만나는 분도 이해할 수 있도록 아이의 이야기를 영역별로 담는 곳',
      steps: [
        { focus: '', t: '설명서란?',
          b: '학교·병원·돌봄 선생님처럼 우리 아이를 처음 만나는 분께 건네는 한 장의 소개예요. 한 번에 다 채우지 않아도 괜찮고, 적어 둔 만큼만으로도 아이를 이해하는 데 도움이 돼요.' },
        { focus: '.manual-tabs', t: '영역별로 나눠서',
          b: '설명서는 일곱 영역으로 나뉘어요. 할 수 있어요 · 도움이 필요해요 · 좋아·싫어 · 도전적 행동 및 대응 · 안전 주의사항 · 의사소통 방법 · 생활 루틴이에요. 탭에 붙은 숫자는 지금까지 적은 항목 수예요.' },
        { focus: '.quick-chips', t: '탭 한 번으로 추가',
          b: '자주 쓰이는 문장을 미리 칩으로 준비해 뒀어요. 우리 아이에게 해당하는 것을 누르기만 하면 바로 항목이 되고, 문장은 나중에 언제든 고칠 수 있어요.' },
        { focus: '.add-item', t: '직접 쓰거나 말하거나',
          b: '칩에 없는 우리 아이만의 이야기는 여기에 적어 주세요. 마이크 버튼을 누르면 말로도 입력할 수 있어서, 손이 바쁜 순간에도 짧게 남길 수 있어요.' },
        { focus: '#summary-note', t: '한 줄 소개',
          b: '아이를 가장 잘 나타내는 한 문장을 적고 [소개글 저장]을 누르면 공유 화면 맨 위에 먼저 보여요. 바로 아래 ‘보호자 한마디’에는 꼭 전하고 싶은 말을 담고 [한마디 저장]을 눌러 주세요.' },
        { focus: '#btn-preview', t: '한 장으로 보기',
          b: '지금까지 적은 내용이 실제로 어떻게 보이는지 미리보기로 확인할 수 있어요. 좋아하는 것 한 가지만 칩으로 추가한 뒤 미리보기를 열어 보면 감이 잡히실 거예요.' }
      ] },

    { key: 'records', ic: 'note', route: '#/records/:childId', label: '기록',
      title: '기록 — 아이의 순간을 남기기',
      summary: '짧은 글과 영상으로 하루를 모아 두고, 필요할 때 다시 찾아보는 곳',
      steps: [
        { focus: '', t: '기록이란?',
          b: '행동·치료·복용·변화·검사처럼 남겨 두고 싶은 순간을 게시판처럼 모아 두는 화면이에요. 여기 쌓인 기록이 나중에 설명서와 대상별 공유 한 장으로 이어져서, 매번 처음부터 설명하지 않으셔도 돼요.' },
        { focus: '#btn-add-rec', t: '기록하기',
          b: '이 버튼을 누르면 유형·날짜·제목·내용을 적는 창이 열려요. 제목과 내용은 마이크 버튼으로 말해서 넣을 수 있고, 사진·태그·컨디션은 마음이 가는 것만 골라도 충분해요.' },
        { focus: '#btn-reels', t: '영상으로 기록',
          b: '글로 옮기기 어려운 순간은 짧은 영상으로 남겨 보세요. 말투나 몸짓처럼 글로는 잘 전해지지 않는 모습이 그대로 담겨서, 선생님이나 의료진이 아이를 이해하는 데 큰 도움이 돼요.' },
        { focus: '.rec-toolbar', t: '검색·필터',
          b: '기록이 늘어나면 검색창에 제목·내용·태그를 넣거나, 유형·기간·컨디션으로 범위를 좁혀 볼 수 있어요. 진료나 상담 전에 필요한 기간만 골라 두면 이야기 나누기가 한결 수월해져요.' },
        { focus: '.rec-card', t: '카드 열어 보기',
          b: '기록 카드를 누르면 사진·영상·태그까지 전체 내용이 열리고, 거기서 바로 수정하거나 지울 수 있어요. 카드에 붙은 컨디션 칩과 유형 배지로 그날의 분위기도 함께 보여요.' },
        { focus: '#btn-add-rec', t: '오늘은 한 줄만 남겨 볼까요',
          b: '오늘 있었던 일 중 기억에 남는 순간 하나만 기록해 보세요. 한 줄이어도 괜찮고, 다 채우지 않아도 괜찮아요 — 이렇게 쌓인 조각들이 아이를 설명해 주는 이야기가 돼요.' }
      ] },

    { key: 'meds', ic: 'pill', route: '#/meds/:childId', label: '복용 관리',
      title: '복용 관리 — 오늘의 복약을 한곳에서',
      summary: '약·영양제를 정리해 두고 오늘 챙긴 복용을 가볍게 체크',
      steps: [
        { focus: '', t: '복용 관리란?',
          b: '아이가 먹고 있는 약·영양제를 한 번만 정리해 두면, 매일의 복용 체크와 병원용 설명서에 그대로 이어져요. 처음부터 다 채우지 않아도 괜찮아요. 지금 먹는 것부터 한 가지만 적어도 충분해요.' },
        { focus: '#med-today', t: '오늘의 복약',
          b: '등록해 둔 약의 시간대 버튼이 여기 모여요. 챙긴 시간대를 한 번 누르면 기록되고, 이미 기록된 버튼(✓)을 다시 누르면 확인 창이 뜬 뒤 지워져요. 체크한 내용은 기록에도 남아서 컨디션 변화와 나란히 볼 수 있어요.' },
        { focus: '#btn-med-add', t: '약물 등록',
          b: '[약물 등록]으로 약 이름·용량·복용 시간을 추가할 수 있어요. 아침·저녁처럼 하루 두 번 먹는 약도 시간대를 나눠 담을 수 있어요.' },
        { focus: '[data-mkf="all"]', t: '구분해서 보기',
          b: '처방약·영양제·일반약으로 나눠 두면 필요한 것만 골라 볼 수 있어요. 이 구분은 병원용 설명서의 ‘복용 약물’과 돌봄기관용의 ‘건강 정보’에 그대로 담겨, 다른 분께 설명할 때 훨씬 수월해져요.' },
        { focus: '.med-row .item-actions', t: '약 정보 찾기',
          b: '약 오른쪽 ⓘ를 누르면 식약처 e약은요 요약이 앱 안에서 열려요. 전문의약품은 없어서 처방약은 옆 돋보기(약학정보원)로 찾고, 연필·휴지통은 수정·삭제예요. 오늘은 약 한 가지만 등록해 보셔도 충분해요.' }
      ] },

    { key: 'gallery', ic: 'camera', route: '#/gallery/:childId', label: '갤러리',
      title: '갤러리 — 사진과 영상이 모이는 곳',
      summary: '기록에 담긴 사진·영상과 안심 갤러리가 자동으로 모이는 화면',
      steps: [
        { focus: '', t: '갤러리는 이런 곳',
          b: '기록에 첨부한 사진과 짧은 영상, 그리고 아이 프로필의 안심 갤러리 사진이 이곳에 자동으로 모여요. 따로 정리하지 않아도 최근 순으로 쌓이니 편하게 둘러보셔도 괜찮아요.' },
        { focus: '.pill-info', t: '어디서 모이나요',
          b: '사진은 기록을 남길 때 첨부하거나 아이 프로필의 안심 갤러리에 올리면 이 화면으로 들어와요. 갤러리에서 따로 업로드할 필요가 없으니, 기록을 남기는 김에 한 장씩만 더해 두셔도 충분해요.' },
        { focus: '[data-gfilter="all"]', t: '필터로 골라 보기',
          b: '전체·사진·영상·안심 갤러리로 나눠 볼 수 있고, 칩 옆 숫자가 각각 몇 장인지 알려 줘요. 찾는 장면이 있을 때 범위를 좁혀 보세요.' },
        { focus: '.gal-grid', t: '어느 기록에서 왔는지',
          b: '타일마다 행동·치료·복약·변화·검사 배지와 날짜가 함께 붙어, 이 사진이 어떤 기록에서 온 장면인지 한눈에 보여요. 사진만 따로 떠다니지 않고 그날의 맥락과 이어져 있어요.' },
        { focus: '[data-gfilter="safe"]', t: '안심 갤러리',
          b: '아이의 요즘 모습을 담은 사진을 따로 모아 두는 칸이에요. 혹시 아이와 떨어지게 되는 상황에 바로 보여 드릴 수 있도록, 계절이 바뀔 때쯤 한 장씩 새로 올려 두시면 든든해요.' },
        { focus: '[data-gv="0"]', t: '눌러서 크게 보기',
          b: '사진을 누르면 크게 볼 수 있고, ‘원본 기록 보기’를 누르면 그날 어떤 일이 있었는지 바로 이어서 확인할 수 있어요. 마음에 남는 한 장부터 눌러 보세요.' }
      ] },

    { key: 'plan', ic: 'flag', route: '#/plan/:childId', label: '미래 준비',
      title: '미래 준비 — 지금 시기에 준비할 것',
      summary: '생애주기 4단계로 나눠, 지금 챙기면 좋을 것을 담아 두는 곳',
      steps: [
        { focus: '', t: '미래 준비란?',
          b: '오늘의 기록과 달리, 조금 더 먼 앞날을 위해 준비할 것들을 모아 두는 화면이에요. 지금 다 정하지 않아도 괜찮고, 마음이 갈 때 한 줄씩 담아 두시면 돼요.' },
        { focus: '.manual-tabs', t: '생애주기 4단계',
          b: '영유아기·학령기·청소년기·성인 준비기 탭으로 시기를 옮겨 볼 수 있어요. 처음에는 아이 나이에 맞는 시기가 열리고, 다음 시기를 미리 눌러 보며 마음의 준비를 하실 수도 있어요.' },
        { focus: '.quick-wrap', t: '추천 목표 담기',
          b: '이 시기에 많이 준비하는 것들을 칩으로 제안해 드려요. 탭 한 번이면 내 플랜에 담기니 무엇부터 적을지 고민하지 않으셔도 돼요. 지금 목록은 예시이고, 전문가 자문을 거친 안내는 정식 버전에서 제공돼요.' },
        { focus: '[data-pterm]', t: '단기·장기 구분',
          b: '항목 옆 배지를 탭하면 단기 → 장기 → ‘기간 지정’(구분 없음) 순서로 돌아가요. 올해 안에 해볼 일과 천천히 준비할 일을 나눠 두면, 지금 무엇을 볼지가 훨씬 가벼워져요.' },
        { focus: '.add-item-select', t: '직접 추가하기',
          b: '제안에 없는 우리 아이만의 준비도 영역과 기간을 골라 직접 적을 수 있어요. ‘수영 배우기’처럼 소소한 것부터 적어 두어도 좋아요.' },
        { focus: '.seg', t: '준비·진행 중·완료 표시하기',
          b: '담아 둔 항목의 준비·진행 중·완료를 눌러 지금 상태를 표시해 보세요. 시기가 지나 다시 열었을 때, 우리가 함께 지나온 길이 그대로 남아 있어요.' }
      ] },

    { key: 'share', ic: 'share', route: '#/share/:childId', label: '대상별 공유',
      title: '대상별 공유 — 아이를 한 장으로 이해시키기',
      summary: '대상에 맞는 설명서 한 장을 기간이 정해진 안전한 링크로 전달',
      steps: [
        { focus: '', t: '이 화면은요',
          b: '작성해 둔 설명서를 받는 분에 맞게 한 장으로 정리해서 전달하는 곳이에요. 학교·병원·치료실마다 필요한 내용이 다르니, 매번 처음부터 설명하지 않으셔도 돼요.' },
        { focus: '.aud-grid', t: '받는 분 고르기',
          b: '학교·병원·활동지원·돌봄 카드 중에서 이번에 전할 곳을 골라 주세요. 카드 안 연필 버튼으로 이름·소개와 보여줄 내용을 바꿀 수 있고, 오른쪽 위 [새 대상 만들기]로 ‘언어치료실용’ 같은 대상을 더할 수도 있어요.' },
        { focus: '.print-area', t: '미리보기',
          b: '아래에 상대가 보게 될 한 장이 미리 나타나요. 이 미리보기에는 비상연락처가 실제 번호로 보이지만, 공유 링크로 열면 안심번호(050)로 가려져 전달돼요.' },
        { focus: '#btn-share-aud', t: '공유 만들기',
          b: '이 버튼을 누르면 받는 분 이름과 공유 기간(1일부터 계속 유지까지)을 정해 링크와 QR을 만들어요. 기간이 끝나면 저절로 잠기니 한 번 열어 둔 정보가 계속 떠도는 걸 걱정하지 않으셔도 돼요.' },
        { focus: '.pill-info', t: '안전 장치',
          b: '링크만으로는 열리지 않고 4자리 인증번호를 함께 알아야 볼 수 있어요. 비상연락처는 안심번호(050)로 가려서 보이는데, 이 프로토타입에서는 가상 번호로 보여 드리는 시뮬레이션이에요.' },
        { focus: '[data-qr]', t: '전달하고 관리하기',
          b: '지금 사용 중인 공유는 아래 목록에 모여요(중단·만료된 공유는 ‘전체 기록’에 보관돼요). ‘QR·키링 카드’를 인쇄하면 인증번호가 카드에 함께 찍혀, 급할 때 곁의 분이 QR을 스캔해 확인할 수 있어요.' }
      ] },

    { key: 'caregiver', ic: 'user', route: '#/caregiver', label: '양육자 정보',
      title: '양육자 정보 — 보호자인 나를 준비하기',
      summary: '보호자 본인 정보·비상 연락망·알림 설정을 챙기는 곳',
      steps: [
        { focus: '', t: '양육자 정보란?',
          b: '우리 아이가 아니라 양육자인 ‘나’의 정보를 두는 곳이에요. 내가 잠시 자리를 비우는 순간에도 아이를 돌보는 손길이 이어지도록 미리 준비해 두는 화면이에요.' },
        { focus: '#cg-form .card', t: '내 기본 정보',
          b: '이름과 휴대전화, 그리고 보호자 본인의 건강 상태 메모를 남길 수 있어요. 아이를 돌보는 사람의 컨디션도 함께 살펴야 하기에 마련한 자리이니, 지금은 비워 두셔도 괜찮아요.' },
        { focus: '#cg-ct', t: '비상 연락망',
          b: '내게 연락이 닿지 않을 때 대신 연락할 분을 이름·관계·연락처로 적어 둡니다. [연락처 추가]로 여러 분을 등록해 두면 급한 순간에 다른 사람이 헤매지 않아요.' },
        { focus: '#cg-form .checkline', t: '알림 설정',
          b: '앱 푸시, 일정·복약, 위기 상황 알림을 각각 켜고 끌 수 있어요. 지금 단계에서는 앱 안 알림 중심으로 동작하고, 카카오 알림톡·문자 연동은 다음 단계에서 준비하고 있어요.' },
        { focus: '#cg-form button[type="submit"]', t: '직접 해 볼까요',
          b: '비상 연락처 한 분만 추가하고 [저장]을 눌러 보세요. 나머지 칸은 생각날 때 천천히 채워도 충분해요.' }
      ] }
  ];

  /* ---------- 진행 상태 (localStorage) ---------- */
  function doneList() {
    try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]') || []; }
    catch (e) { return []; }
  }
  function markDone(key) {
    var d = doneList();
    if (d.indexOf(key) < 0) { d.push(key); try { localStorage.setItem(DONE_KEY, JSON.stringify(d)); } catch (e) {} }
  }

  /* ---------- 라우트 ---------- */
  function childId() {
    if (global.App && App.lastChildId) return App.lastChildId;
    var u = Store.currentUser();
    if (u) { var k = Store.childrenOf(u.id); if (k[0]) return k[0].id; }
    return null;
  }
  function hashOf(t) {
    if (t.route.indexOf(':childId') < 0) return t.route;
    var c = childId();
    return c ? t.route.replace(':childId', c) : null;
  }
  var ALIAS = { childEdit: 'childProfile', profile: 'childProfile' };
  function byKey(k) {
    k = ALIAS[k] || k;
    for (var i = 0; i < TUTORIALS.length; i++) if (TUTORIALS[i].key === k) return TUTORIALS[i];
    return null;
  }

  /* ---------- 실행 ---------- */
  function start(key) {
    var t = byKey(key);
    if (!t || !global.Guide) return;
    var h = hashOf(t);
    if (!h) { UI.toast('아이를 먼저 등록해 주세요', 'warn'); return; }
    var last = t.steps.length - 1;
    var steps = t.steps.map(function (s, i) {
      var st = { hash: h, focus: s.focus, t: s.t, b: s.b };
      if (i === last) {
        st.last = true;
        st.alt = { label: '다른 메뉴 튜토리얼 보기', act: function () { openCenter(); } };
      }
      return st;
    });
    UI.Modal.close();
    Guide.run(steps, { label: t.label + ' 튜토리얼', onDone: function () { markDone(t.key); } });
  }

  /* ---------- 튜토리얼 센터 (메뉴 목록) ---------- */
  function rowHTML(t, done) {
    return '<button class="tut-row' + (done ? ' done' : '') + '" data-tut="' + t.key + '">' +
      '<span class="tut-ic">' + icon(t.ic, 18) + '</span>' +
      '<span class="tut-tx"><b>' + esc(t.title) + '</b>' +
        '<span>' + esc(t.summary) + '</span></span>' +
      '<span class="tut-st">' + (done
        ? icon('check', 17) + '<span class="tut-st-tx">봤어요</span>'
        : '<span class="tut-st-tx">' + t.steps.length + '단계</span>' + icon('chevR', 16)) +
      '</span></button>';
  }

  function openCenter() {
    var done = doneList();
    var isDone = function (t) { return done.indexOf(t.key) >= 0; };
    var n = TUTORIALS.filter(isDone).length, total = TUTORIALS.length;
    var pct = Math.round((n / total) * 100);

    var body =
      '<p class="help-intro">메뉴 하나를 골라 보세요. 그 화면으로 이동해서 어떤 기능이 어디에 있는지 차례대로 짚어 드려요. 중간에 언제든 닫아도 괜찮아요.</p>' +
      '<div class="tut-prog-wrap"><div class="tut-prog"><div class="tut-prog-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="tut-prog-tx">' + n + ' / ' + total + ' 메뉴</span></div>' +
      '<div class="tut-group">메뉴</div>' +
      TUTORIALS.map(function (t) { return rowHTML(t, isDone(t)); }).join('');

    UI.Modal.open({
      title: '메뉴별 튜토리얼', icon: 'book', wide: true, body: body,
      buttons: [
        { label: '전체 둘러보기', value: 'tour', variant: 'ghost', icon: 'info' },
        { label: '닫기', value: 'close', variant: 'primary' }
      ],
      onButton: function (v) {
        if (v === 'tour' && global.Tour) setTimeout(function () { global.Tour.start(); }, 60);
      },
      onMount: function (root) {
        root.querySelectorAll('[data-tut]').forEach(function (b) {
          b.onclick = function () { start(b.dataset.tut); };
        });
      }
    });
  }

  global.Tutorial = {
    openCenter: openCenter,
    start: start,
    has: function (k) { return !!byKey(k); }
  };
})(window);
