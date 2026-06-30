/* =====================================================================
 * tour.js — 셀프 온보딩 둘러보기 가이드
 * 시연자 없이 양육자가 혼자 핵심 흐름을 따라가도록 화면별 안내 카드 + 하이라이트.
 * 라우트를 직접 이동하며 설명하고, 대상 요소엔 펄스 링을 띄운다.
 * ===================================================================== */
(function (global) {
  'use strict';
  if (!global.UI) return;
  var icon = UI.icon, esc = UI.esc;
  var SEEN_KEY = 'scon_tour_seen';

  function childId() {
    if (global.App && App.lastChildId) return App.lastChildId;
    var u = Store.currentUser();
    if (u) { var k = Store.childrenOf(u.id); if (k[0]) return k[0].id; }
    return null;
  }

  function steps() {
    var c = childId();
    var m = c ? '#/manual/' + c : '#/dashboard';
    var s = c ? '#/share/' + c : '#/dashboard';
    return [
      { hash: '#/dashboard', t: '내 아이 설명서에 오신 걸 환영해요',
        b: '우리 아이를 한 장으로 정리해, 누구에게든 5분 만에 이해시키는 서비스예요. 핵심만 1분 안에 같이 둘러볼까요?' },
      { hash: m, t: '① 한 장으로 미리보기', focus: '#btn-preview',
        b: '설명서 화면의 ‘미리보기’ 버튼을 누르면 완성된 한 장을 바로 볼 수 있어요. 비상연락·응급 정보는 항상 맨 위에 나옵니다.' },
      { hash: m, t: '② 적는 건 탭 한 번', focus: '.manual-tabs',
        b: '카테고리에서 추천 칩을 탭하면 끝 — 타이핑을 최소화했어요. ‘한 줄 소개’와 ‘보호자 한마디’에는 부모님 목소리가 그대로 담깁니다.' },
      { hash: s, t: '③ 받는 사람에 맞게 자동 변신', focus: '[data-aud]',
        b: '학교용·병원용·활동지원사용·돌봄기관용을 고르면, 같은 내용이 대상에 맞게 다르게 정리돼요. 매번 다시 쓸 필요가 없어요.' },
      { hash: s, t: '④ 안전하게 공유 · 내가 없을 때도', focus: '[data-qr]',
        b: '링크·4자리 인증번호·QR로 공유하고, 전화번호는 안심번호로 가려요. QR을 출력해 가방·키링에 달면 위급할 때 큰 힘이 됩니다.' },
      { hash: '#/dashboard', t: '이제 직접 해보세요', last: true,
        b: '우리 아이를 한 명 등록하고 한 줄만 적어보면 금방 감이 와요. 천천히 둘러보셔도 좋습니다. (상단 메뉴 → ‘둘러보기 가이드’로 언제든 다시 볼 수 있어요)' }
    ];
  }

  var idx = 0, list = [];

  function clearPulse() {
    [].forEach.call(document.querySelectorAll('.tour-pulse'), function (e) { e.classList.remove('tour-pulse'); });
  }
  function teardown() {
    clearPulse();
    var host = document.getElementById('tour-host');
    if (host) host.remove();
    document.removeEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (e.key === 'Escape') teardown();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  }

  function paint() {
    var st = list[idx];
    var moved = location.hash !== st.hash;
    if (moved && global.App) App.navigate(st.hash);
    setTimeout(function () {
      clearPulse();
      if (st.focus) {
        var el = document.querySelector(st.focus);
        if (el) {
          el.classList.add('tour-pulse');
          try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
        }
      }
      render(st);
    }, moved ? 280 : 0);
  }

  function render(st) {
    var host = document.getElementById('tour-host');
    if (!host) { host = document.createElement('div'); host.id = 'tour-host'; document.body.appendChild(host); }
    host.innerHTML =
      '<div class="tour-tip" role="dialog" aria-modal="false" aria-label="둘러보기 가이드">' +
        '<div class="tour-step">둘러보기 ' + (idx + 1) + ' / ' + list.length + '</div>' +
        '<button class="tour-x" aria-label="가이드 닫기">' + icon('x', 16) + '</button>' +
        '<h3>' + esc(st.t) + '</h3>' +
        '<p>' + esc(st.b) + '</p>' +
        '<div class="tour-nav">' +
          (idx > 0 ? '<button class="btn btn-ghost btn-sm" data-tour="prev">이전</button>' : '<span></span>') +
          '<button class="btn btn-primary btn-sm" data-tour="next">' +
            (st.last ? '시작하기' : '다음') + '</button>' +
        '</div>' +
      '</div>';
    host.querySelector('.tour-x').onclick = teardown;
    var pv = host.querySelector('[data-tour="prev"]'); if (pv) pv.onclick = prev;
    host.querySelector('[data-tour="next"]').onclick = next;
  }

  function next() { if (idx >= list.length - 1) { teardown(); return; } idx++; paint(); }
  function prev() { if (idx <= 0) return; idx--; paint(); }

  function start() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    list = steps(); idx = 0;
    document.addEventListener('keydown', onKey);
    paint();
  }
  function maybeAuto() {
    var seen; try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { seen = '1'; }
    if (!seen && childId()) setTimeout(start, 800);
  }

  global.Tour = { start: start, maybeAuto: maybeAuto };
})(window);
