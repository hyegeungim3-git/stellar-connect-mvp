/* =====================================================================
 * drugapi.js — 식품의약품안전처 e약은요(의약품개요정보) 공공데이터 API
 * https://www.data.go.kr/data/15075057/openapi.do (DrbEasyDrugInfoService)
 *
 * 인증키는 저장소에 커밋하지 않는다(보안 원칙) — localStorage에만 보관.
 *  - 키 저장: 약물 관리 > e약은요 버튼 → 키 설정 모달 (1회 입력)
 *  - 데모 초기화(resetDB)와 무관한 별도 키라 초기화해도 유지된다
 * 게이트웨이가 CORS(*)를 허용해 브라우저에서 직접 호출한다(백엔드 불필요).
 * ===================================================================== */
(function (global) {
  'use strict';

  var BASE = 'https://apis.data.go.kr/1471000/DrbEasyDrugInfoService/getDrbEasyDrugList';
  var KEY_LS = 'scon_drugApiKey';
  var cache = {};   // 세션 내 검색어 캐시 (동일 약 반복 조회 시 재요청 방지)

  function getKey() {
    try { return (localStorage.getItem(KEY_LS) || '').trim(); }
    catch (e) { return ''; }
  }
  function setKey(k) {
    try { localStorage.setItem(KEY_LS, (k || '').trim()); } catch (e) {}
  }
  function hasKey() { return !!getKey(); }

  /* 제품명으로 개요정보 검색 — 성공 시 items 배열, 실패 시 Error(code)
     code: 'KEY'(키 없음/미승인/오류) · 'NET'(네트워크) · 'HTTP'(기타 서버 오류) */
  function search(name) {
    var q = (name || '').trim();
    if (!q) return Promise.reject(new Error('EMPTY'));
    if (cache[q]) return Promise.resolve(cache[q]);
    if (!hasKey()) return Promise.reject(new Error('KEY'));

    var url = BASE + '?serviceKey=' + encodeURIComponent(getKey()) +
      '&itemName=' + encodeURIComponent(q) + '&type=json&numOfRows=10&pageNo=1';

    return fetch(url).catch(function () {
      throw new Error('NET');            /* 네트워크 단절만 NET — 상태코드 오류와 구분 */
    }).then(function (res) {
      if (res.status === 401 || res.status === 403) throw new Error('KEY');
      if (!res.ok) throw new Error('HTTP');
      return res.json().catch(function () { throw new Error('HTTP'); });
    }).then(function (j) {
      /* 응답이 {header,body} 또는 {response:{header,body}} 두 형태 모두 대응 */
      var r = j && j.response ? j.response : j;
      var header = (r && r.header) || {};
      if (header.resultCode && header.resultCode !== '00') {
        if (/KEY|REGISTERED|UNSIGNED/i.test(header.resultMsg || '')) throw new Error('KEY');
        throw new Error('HTTP');
      }
      var body = (r && r.body) || {};
      var items = body.items || [];
      if (!Array.isArray(items)) items = items.item ? [].concat(items.item) : [items];
      items = items.filter(function (it) { return it && it.itemName; });
      cache[q] = items;
      return items;
    });
  }

  global.DrugAPI = { hasKey: hasKey, getKey: getKey, setKey: setKey, search: search };
})(window);
