/* =====================================================================
 * qr.js — QR 코드 생성기 (자체 구현 · 의존성 없음)
 * 바이트 모드 · 오류정정 레벨 M · 버전 1~6 자동 선택 (데이터 ≤108바이트)
 * 사용: QR.svg('https://...', { cell: 4, margin: 4 }) -> SVG 문자열 (실패 시 null)
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- GF(256) 산술 (다항식 0x11D) ---------- */
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1; if (x & 0x100) x ^= 0x11D;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gfMul(a, b) {
    if (!a || !b) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* ---------- Reed-Solomon 오류정정 코드워드 ---------- */
  function rsGenerator(nsym) {
    var g = [1];
    for (var i = 0; i < nsym; i++) {
      var ng = new Array(g.length + 1);
      for (var k = 0; k < ng.length; k++) ng[k] = 0;
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= g[j];
        ng[j + 1] ^= gfMul(g[j], EXP[i]);
      }
      g = ng;
    }
    return g;
  }
  function rsEncode(data, nsym) {
    var gen = rsGenerator(nsym);
    var rem = data.slice().concat(new Array(nsym).fill(0));
    for (var i = 0; i < data.length; i++) {
      var coef = rem[i];
      if (coef !== 0) {
        for (var j = 1; j < gen.length; j++) {
          rem[i + j] ^= gfMul(gen[j], coef);
        }
      }
      rem[i] = 0;
    }
    return rem.slice(data.length);
  }

  /* ---------- 버전 테이블 (EC 레벨 M, v1~6) ----------
     [총 데이터 코드워드, 블록 수, 블록당 데이터 cw, 블록당 EC cw, 정렬패턴 좌표] */
  var VER = {
    1: { data: 16,  blocks: 1, perBlock: 16, ec: 10, align: [] },
    2: { data: 28,  blocks: 1, perBlock: 28, ec: 16, align: [6, 18] },
    3: { data: 44,  blocks: 1, perBlock: 44, ec: 26, align: [6, 22] },
    4: { data: 64,  blocks: 2, perBlock: 32, ec: 18, align: [6, 26] },
    5: { data: 86,  blocks: 2, perBlock: 43, ec: 24, align: [6, 30] },
    6: { data: 108, blocks: 4, perBlock: 27, ec: 16, align: [6, 34] }
  };

  /* ---------- 데이터 비트스트림 (바이트 모드) ---------- */
  function toUTF8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i);
      if (c > 0xFFFF) i++;
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xF0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function buildCodewords(bytes, ver) {
    var cap = VER[ver].data;
    var bits = [];
    function push(val, n) {
      for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }
    push(4, 4);                 // 바이트 모드
    push(bytes.length, 8);      // 글자 수 (v1~9: 8비트)
    bytes.forEach(function (b) { push(b, 8); });
    // 종료자 (최대 4비트)
    var capBits = cap * 8;
    push(0, Math.min(4, capBits - bits.length));
    while (bits.length % 8 !== 0) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
      cw.push(v);
    }
    var pads = [0xEC, 0x11], p = 0;
    while (cw.length < cap) cw.push(pads[(p++) % 2]);
    return cw;
  }

  /* ---------- 블록 분할 + EC + 인터리빙 (v1~6 M: 블록 길이 균일) ---------- */
  function finalCodewords(dataCW, ver) {
    var t = VER[ver];
    var dataBlocks = [], ecBlocks = [];
    for (var b = 0; b < t.blocks; b++) {
      var blk = dataCW.slice(b * t.perBlock, (b + 1) * t.perBlock);
      dataBlocks.push(blk);
      ecBlocks.push(rsEncode(blk, t.ec));
    }
    var out = [];
    for (var i = 0; i < t.perBlock; i++) {
      for (var j = 0; j < t.blocks; j++) out.push(dataBlocks[j][i]);
    }
    for (var k = 0; k < t.ec; k++) {
      for (var m = 0; m < t.blocks; m++) out.push(ecBlocks[m][k]);
    }
    return out;
  }

  /* ---------- 매트릭스 구성 ---------- */
  function buildMatrix(ver, codewords, mask) {
    var size = ver * 4 + 17;
    var M = [], F = [];   // M: 모듈값, F: 기능 모듈 여부
    for (var r = 0; r < size; r++) {
      M.push(new Array(size).fill(0));
      F.push(new Array(size).fill(false));
    }
    function set(r, c, v) { M[r][c] = v ? 1 : 0; F[r][c] = true; }

    // 파인더 + 분리자
    function finder(r0, c0) {
      for (var r = -1; r <= 7; r++) {
        for (var c = -1; c <= 7; c++) {
          var rr = r0 + r, cc = c0 + c;
          if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
          var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
          set(rr, cc, on);
        }
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);

    // 정렬 패턴
    var ap = VER[ver].align;
    for (var i = 0; i < ap.length; i++) {
      for (var j = 0; j < ap.length; j++) {
        var cr = ap[i], cc2 = ap[j];
        if (F[cr][cc2]) continue;  // 파인더와 겹치면 생략
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            var on = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
            set(cr + dr, cc2 + dc, on);
          }
        }
      }
    }

    // 타이밍 패턴
    for (var t = 8; t < size - 8; t++) {
      if (!F[6][t]) set(6, t, t % 2 === 0);
      if (!F[t][6]) set(t, 6, t % 2 === 0);
    }
    // 다크 모듈
    set(size - 8, 8, 1);

    // 포맷 정보 영역 예약 (배치는 아래에서)
    for (var f = 0; f <= 8; f++) {
      if (f !== 6) { if (!F[8][f]) set(8, f, 0); if (!F[f][8]) set(f, 8, 0); }
    }
    for (var g = 0; g < 8; g++) {
      if (!F[8][size - 1 - g]) set(8, size - 1 - g, 0);
      if (!F[size - 1 - g][8]) set(size - 1 - g, 8, 0);
    }

    // 데이터 배치 (지그재그) + 마스크
    var bitIdx = 0, total = codewords.length * 8;
    function nextBit() {
      if (bitIdx >= total) return 0;  // 나머지 비트는 0
      var b = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
      bitIdx++;
      return b;
    }
    function maskAt(mk, r, c) {
      switch (mk) {
        case 0: return (r + c) % 2 === 0;
        case 1: return r % 2 === 0;
        case 2: return c % 3 === 0;
        case 3: return (r + c) % 3 === 0;
        case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
        case 5: return (r * c) % 2 + (r * c) % 3 === 0;
        case 6: return ((r * c) % 2 + (r * c) % 3) % 2 === 0;
        default: return ((r + c) % 2 + (r * c) % 3) % 2 === 0;
      }
    }
    var col = size - 1, up = true;
    while (col > 0) {
      if (col === 6) col--;  // 타이밍 열 건너뜀
      for (var step = 0; step < size; step++) {
        var row = up ? size - 1 - step : step;
        for (var side = 0; side < 2; side++) {
          var c3 = col - side;
          if (F[row][c3]) continue;
          var bit = nextBit();
          if (maskAt(mask, row, c3)) bit ^= 1;
          M[row][c3] = bit;
        }
      }
      up = !up;
      col -= 2;
    }

    // 포맷 정보 (EC M = '00' + 마스크 3비트, BCH(15,5), XOR 0x5412)
    var fmt5 = (0 << 3) | mask;   // M = 00
    var rem = fmt5 << 10;
    for (var d = 14; d >= 10; d--) {
      if ((rem >> d) & 1) rem ^= 0x537 << (d - 10);  // g(x)=10100110111
    }
    var fmt = (((fmt5 << 10) | rem) ^ 0x5412) & 0x7FFF;
    function fbit(i) { return (fmt >> (14 - i)) & 1; }  // i=0이 최상위 비트
    // 좌상단 사본
    var posA = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    for (var a = 0; a < 15; a++) M[posA[a][0]][posA[a][1]] = fbit(a);
    // 두 번째 사본 (좌하단 세로 + 우상단 가로)
    for (var b2 = 0; b2 < 7; b2++) M[size - 1 - b2][8] = fbit(b2);
    for (var b3 = 7; b3 < 15; b3++) M[8][size - 15 + b3] = fbit(b3);

    return M;
  }

  /* ---------- 마스크 패널티 ---------- */
  function penalty(M) {
    var size = M.length, score = 0, r, c;
    // N1: 연속 5+ 동일 모듈
    for (var dir = 0; dir < 2; dir++) {
      for (r = 0; r < size; r++) {
        var run = 1;
        for (c = 1; c < size; c++) {
          var cur = dir ? M[c][r] : M[r][c];
          var prev = dir ? M[c - 1][r] : M[r][c - 1];
          if (cur === prev) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else run = 1;
        }
      }
    }
    // N2: 2x2 동일 블록
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = M[r][c];
        if (v === M[r][c + 1] && v === M[r + 1][c] && v === M[r + 1][c + 1]) score += 3;
      }
    }
    // N3: 1:1:3:1:1 파인더 유사 패턴 (+ 양쪽 4모듈 밝음)
    var P1 = [1,0,1,1,1,0,1,0,0,0,0], P2 = [0,0,0,0,1,0,1,1,1,0,1];
    function n3At(getter, len) {
      for (var i = 0; i <= len - 11; i++) {
        var m1 = true, m2 = true;
        for (var k = 0; k < 11; k++) {
          var val = getter(i + k);
          if (val !== P1[k]) m1 = false;
          if (val !== P2[k]) m2 = false;
          if (!m1 && !m2) break;
        }
        if (m1 || m2) score += 40;
      }
    }
    for (r = 0; r < size; r++) {
      (function (rr) { n3At(function (i) { return M[rr][i]; }, size); })(r);
      (function (cc) { n3At(function (i) { return M[i][cc]; }, size); })(r);
    }
    // N4: 어두운 모듈 비율
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) dark += M[r][c];
    var pct = dark * 100 / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  /* ---------- 공개 API ---------- */
  function make(text) {
    var bytes = toUTF8(String(text));
    var ver = null;
    for (var v = 1; v <= 6; v++) {
      if (bytes.length + 2 <= VER[v].data) { ver = v; break; }
    }
    if (!ver) return null;  // 데이터가 너무 김
    var cw = finalCodewords(buildCodewords(bytes, ver), ver);
    var best = null, bestScore = Infinity;
    for (var mk = 0; mk < 8; mk++) {
      var M = buildMatrix(ver, cw, mk);
      var s = penalty(M);
      if (s < bestScore) { bestScore = s; best = M; }
    }
    return best;
  }

  function svg(text, opts) {
    opts = opts || {};
    var M = make(text);
    if (!M) return null;
    var cell = opts.cell || 4, margin = opts.margin != null ? opts.margin : 4;
    var size = M.length, dim = (size + margin * 2) * cell;
    var path = '';
    for (var r = 0; r < size; r++) {
      for (var c = 0; c < size; c++) {
        if (M[r][c]) {
          path += 'M' + ((c + margin) * cell) + ' ' + ((r + margin) * cell) +
            'h' + cell + 'v' + cell + 'h-' + cell + 'z';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
      '" width="' + (opts.width || dim) + '" height="' + (opts.width || dim) +
      '" shape-rendering="crispEdges" role="img" aria-label="QR 코드">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/>' +
      '<path d="' + path + '" fill="#16213f"/></svg>';
  }

  global.QR = { make: make, svg: svg };
})(window);
