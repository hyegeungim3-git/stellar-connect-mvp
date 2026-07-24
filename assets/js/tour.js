/* =====================================================================
 * tour.js — 셀프 온보딩
 *   ① Guide   : 단계별 안내 실행 엔진 (둘러보기·메뉴별 튜토리얼 공용)
 *   ② Tour    : 전체 흐름 둘러보기 (첫 방문 자동 + 메뉴에서 재실행)
 * 라우트를 직접 이동하며 설명하고, 대상 요소엔 펄스 링을 띄운다.
 * 메뉴별 상세 안내는 tutorial.js(Tutorial)가 이 Guide를 그대로 쓴다.
 * ===================================================================== */
(function (global) {
  'use strict';
  if (!global.UI) return;
  var icon = UI.icon, esc = UI.esc;
  var SEEN_KEY = 'scon_tour_seen';

  /* =====================================================================
   * ① Guide — 단계 실행 엔진 (공용)
   *   run(steps, opts)
   *     steps: [{ hash?, focus?, t, b, last?, alt?:{label,act} }]
   *     opts : { label:'둘러보기', onDone?:fn, onExit?:fn }
   * ===================================================================== */
  var Guide = (function () {
    var list = [], idx = 0, opt = {};

    function clearPulse() {
      [].forEach.call(document.querySelectorAll('.tour-pulse'), function (e) {
        e.classList.remove('tour-pulse');
      });
    }
    function teardown(finished) {
      clearPulse();
      var host = document.getElementById('tour-host');
      if (host) host.remove();
      document.removeEventListener('keydown', onKey);
      if (finished && opt.onDone) opt.onDone();
      else if (!finished && opt.onExit) opt.onExit();
      list = []; idx = 0; opt = {};
    }
    function onKey(e) {
      if (e.key === 'Escape') teardown(false);
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    }
    function paint() {
      var st = list[idx];
      if (!st) return;
      var moved = st.hash && location.hash !== st.hash;
      if (moved && global.App) App.navigate(st.hash);
      setTimeout(function () {
        clearPulse();
        if (st.focus) {
          var el = document.querySelector(st.focus);
          if (el) {
            el.classList.add('tour-pulse');
            try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
          }
          /* 요소를 못 찾아도 안내는 계속 — 화면 구성이 바뀌어도 끊기지 않게 */
        }
        render(st);
      }, moved ? 300 : 0);
    }
    function render(st) {
      var host = document.getElementById('tour-host');
      if (!host) {
        host = document.createElement('div');
        host.id = 'tour-host';
        document.body.appendChild(host);
      }
      var pct = Math.round(((idx + 1) / list.length) * 100);
      host.innerHTML =
        '<div class="tour-tip" role="dialog" aria-modal="false" aria-label="' +
            esc(opt.label || '안내') + '">' +
          '<div class="tour-step">' + esc(opt.label || '안내') + ' ' +
            (idx + 1) + ' / ' + list.length + '</div>' +
          '<button class="tour-x" aria-label="안내 닫기">' + icon('x', 16) + '</button>' +
          '<div class="tour-prog"><div class="tour-prog-fill" style="width:' + pct + '%"></div></div>' +
          '<h3>' + esc(st.t) + '</h3>' +
          '<p>' + esc(st.b) + '</p>' +
          (st.alt ? '<button class="btn btn-soft btn-sm tour-alt" data-tour="alt">' +
            esc(st.alt.label) + '</button>' : '') +
          '<div class="tour-nav">' +
            (idx > 0 ? '<button class="btn btn-ghost btn-sm" data-tour="prev">이전</button>'
              : (st.last ? '<span></span>'
                : '<button class="btn btn-ghost btn-sm" data-tour="skip">건너뛰기</button>')) +
            '<button class="btn btn-primary btn-sm" data-tour="next">' +
              (st.last ? '시작하기' : '다음') + '</button>' +
          '</div>' +
        '</div>';
      host.querySelector('.tour-x').onclick = function () { teardown(false); };
      var pv = host.querySelector('[data-tour="prev"]'); if (pv) pv.onclick = prev;
      var sk = host.querySelector('[data-tour="skip"]'); if (sk) sk.onclick = function () { teardown(false); };
      var al = host.querySelector('[data-tour="alt"]');
      if (al && st.alt) al.onclick = function () { var f = st.alt.act; teardown(true); if (f) f(); };
      host.querySelector('[data-tour="next"]').onclick = next;
    }
    function next() { if (idx >= list.length - 1) { teardown(true); return; } idx++; paint(); }
    function prev() { if (idx <= 0) return; idx--; paint(); }

    function run(steps, o) {
      if (!steps || !steps.length) return;
      teardown(false);           // 진행 중인 안내가 있으면 정리하고 새로 시작
      list = steps; opt = o || {}; idx = 0;
      document.addEventListener('keydown', onKey);
      paint();
    }
    return { run: run, close: function () { teardown(false); } };
  })();
  global.Guide = Guide;

  /* =====================================================================
   * ② Tour — 전체 흐름 둘러보기 (현재 메뉴 구성 기준)
   * ===================================================================== */
  function childId() {
    if (global.App && App.lastChildId) return App.lastChildId;
    var u = Store.currentUser();
    if (u) { var k = Store.childrenOf(u.id); if (k[0]) return k[0].id; }
    return null;
  }

  function steps() {
    var c = childId();
    var to = function (p) { return c ? p + c : '#/dashboard'; };
    return [
      { hash: '#/dashboard',
        t: '내 아이 설명서에 오신 걸 환영해요',
        b: '우리 아이를 한 장으로 정리해서, 학교·병원·돌봄기관 어디에든 빠르게 이해시키는 서비스예요. 핵심 흐름만 1분 안에 함께 볼까요?' },
      { hash: '#/dashboard', focus: '.home-sec',
        t: '홈 — 오늘 할 일이 모여요',
        b: '아이 소개와 설명서 진행도, 오늘 먹일 약, 빠른 기록이 한 화면에 있어요. 매일 여기서 시작하시면 됩니다.' },
      { hash: to('#/manual/'), focus: '.manual-tabs',
        t: '설명서 — 이 앱의 심장',
        b: '할 수 있어요·도움이 필요해요·의사소통처럼 영역을 나눠 담아요. 빠른 입력 칩을 탭하면 문장이 바로 들어가서 타이핑이 거의 필요 없어요.' },
      { hash: to('#/manual/'), focus: '#btn-preview',
        t: '한 장으로 미리보기',
        b: '지금까지 쓴 내용이 실제로 어떻게 보이는지 바로 확인해요. 비상연락·응급 정보는 항상 맨 위에 놓입니다.' },
      { hash: to('#/records/'), focus: '#btn-add-rec',
        t: '기록 — 오늘의 순간 남기기',
        b: '행동·치료·변화 같은 일상을 사진이나 영상과 함께 남겨요. 제목은 마이크로 말하면 자동으로 입력돼요.' },
      { hash: to('#/meds/'), focus: '#btn-med-add',
        t: '복용 관리 — 약을 한곳에서',
        b: '처방약·영양제를 구분해 등록하고 시간대별로 체크해요. 체크한 내용은 기록에도 남아 컨디션 변화와 나란히 볼 수 있어요.' },
      { hash: to('#/share/'), focus: '[data-aud]',
        t: '받는 사람에 맞게 자동 정리',
        b: '학교용·병원용·활동지원사용·돌봄기관용을 고르면 같은 내용이 대상에 맞게 다시 정리돼요. 매번 새로 쓰지 않아도 됩니다.' },
      { hash: to('#/share/'), focus: '[data-qr]',
        t: '안전하게 전해요',
        b: '링크에는 4자리 인증번호가 붙고, 전화번호는 안심번호로 가려요. QR을 출력해 가방·키링에 달면 위급할 때 큰 힘이 됩니다.' },
      { hash: '#/dashboard', last: true,
        t: '이제 직접 해보세요',
        b: '한 줄만 적어 봐도 금방 감이 와요. 화면마다 더 자세한 설명이 필요하면 아래 ‘메뉴별 튜토리얼’을 열어 보세요. (계정 메뉴에서 언제든 다시 볼 수 있어요)',
        alt: { label: '메뉴별 튜토리얼 열기', act: function () {
          if (global.Tutorial) global.Tutorial.openCenter();
        } } }
    ];
  }

  function start() {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) {}
    Guide.run(steps(), { label: '둘러보기' });
  }
  function maybeAuto() {
    var seen; try { seen = localStorage.getItem(SEEN_KEY); } catch (e) { seen = '1'; }
    if (!seen && childId()) setTimeout(start, 800);
  }

  global.Tour = { start: start, maybeAuto: maybeAuto };
})(window);
