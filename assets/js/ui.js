/* =====================================================================
 * ui.js — 공용 UI 유틸 (아이콘 / 포맷 / 토스트 / 모달 / 차트)
 * ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- DOM 헬퍼 ---------- */
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  /* ---------- 아이콘 (인라인 SVG, 의존성 없음) ---------- */
  var ICONS = {
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    note: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
    chart: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
    settings: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    chevR: '<path d="M9 18l6-6-6-6"/>',
    chevD: '<path d="M6 9l6 6 6-6"/>',
    chevL: '<path d="M15 18l-6-6 6-6"/>',
    back: '<line x1="19" y1="12" x2="5" y2="12"/><path d="M12 19l-7-7 7-7"/>',
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><line x1="21" y1="12" x2="9" y2="12"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    pill: '<path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.6" y2="16.6"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3"/>',
    smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.7a2 2 0 0 1-.5 2.1L7.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.7.6A2 2 0 0 1 22 16.9z"/>',
    print: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    thumb: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.3a2 2 0 0 0 2-1.7l1.4-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0v5"/><path d="M14 10V4a2 2 0 0 0-4 0v6"/><path d="M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2a8 8 0 0 1-7-4l-3-4a2 2 0 0 1 3.4-2.3L7 14"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    message: '<path d="M21 11.5a8.38 8.38 0 0 1-9 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.38 8.38 0 0 1 3 11.5 8.5 8.5 0 0 1 11.5 3a8.38 8.38 0 0 1 8.5 8.5z"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    sprout: '<path d="M7 20h10"/><path d="M10 20c0-6-3-7-3-11a4 4 0 1 1 8 0c0 4-3 5-3 11"/><path d="M9.5 9a4.5 4.5 0 0 1-5-3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    school: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
    hospital: '<path d="M12 6v4M8 8h8"/><rect x="3" y="3" width="18" height="18" rx="2"/>'
  };
  function icon(name, size) {
    var p = ICONS[name] || ICONS.info;
    var s = size || 24;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + p + '</svg>';
  }

  /* ---------- 브랜드 로고마크 — Stellar Connect
       (브랜드 가이드 이미지 그대로 사용 · 투명 배경 PNG) ---------- */
  function brandMark(size) {
    var s = size || 36;
    return '<img class="mark" src="assets/img/logo.png" alt="Stellar Connect" ' +
      'width="' + s + '" height="' + s + '" ' +
      'style="display:block;object-fit:contain"/>';
  }

  /* ---------- 포맷 ---------- */
  function fmtDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.getFullYear() + '. ' + (d.getMonth() + 1) + '. ' + d.getDate() + '.';
  }
  function fmtDateTime(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return fmtDate(iso) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function timeAgo(iso) {
    var diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    if (diff < 2592000) return Math.floor(diff / 86400) + '일 전';
    return fmtDate(iso);
  }
  function calcAge(birthDate) {
    if (!birthDate) return null;
    var b = new Date(birthDate), n = new Date();
    var age = n.getFullYear() - b.getFullYear();
    var m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) age--;
    return age;
  }
  function initials(name) {
    if (!name) return '?';
    return name.trim().slice(-2);
  }

  /* ---------- 토스트 ---------- */
  function toast(msg, type) {
    var host = el('toast-host');
    var t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    var ic = type === 'ok' ? icon('check', 17) : type === 'err' ? icon('alert', 17) : '';
    t.innerHTML = ic + '<span>' + esc(msg) + '</span>';
    host.appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s ease, transform .3s ease';
      t.style.opacity = '0'; t.style.transform = 'translateY(8px)';
      setTimeout(function () { t.remove(); }, 320);
    }, 2600);
  }

  /* ---------- 모달 ---------- */
  var Modal = {
    open: function (opts) {
      var host = el('modal-host');
      var btns = (opts.buttons || [{ label: '닫기', value: 'close', variant: 'ghost' }]);
      var btnHTML = btns.map(function (b, i) {
        return '<button class="btn btn-' + (b.variant || 'ghost') +
          '" data-mbtn="' + i + '">' +
          (b.icon ? icon(b.icon, 16) : '') + esc(b.label) + '</button>';
      }).join('');
      host.innerHTML =
        '<div class="modal-backdrop" data-mbackdrop>' +
          '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
            '<div class="modal-head">' +
              (opts.icon ? '<span style="color:var(--primary)">' + icon(opts.icon, 22) + '</span>' : '') +
              '<h3>' + esc(opts.title || '') + '</h3>' +
              '<button class="btn-icon" data-mclose>' + icon('x', 18) + '</button>' +
            '</div>' +
            '<div class="modal-body">' + (opts.body || '') + '</div>' +
            (btnHTML ? '<div class="modal-foot">' + btnHTML + '</div>' : '') +
          '</div>' +
        '</div>';
      var root = host.querySelector('.modal');
      var close = function () { host.innerHTML = ''; };
      host.querySelector('[data-mclose]').onclick = close;
      host.querySelector('[data-mbackdrop]').onclick = function (e) {
        if (e.target === e.currentTarget && !opts.lockBackdrop) close();
      };
      btns.forEach(function (b, i) {
        var node = host.querySelector('[data-mbtn="' + i + '"]');
        node.onclick = function () {
          if (b.value === 'close' || b.value === 'cancel') { close(); return; }
          var r = opts.onButton ? opts.onButton(b.value, root, close) : null;
          if (r !== 'keep') close();
        };
      });
      if (opts.onMount) opts.onMount(root);
      var firstInput = root.querySelector('input,textarea,select');
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 50);
      return { root: root, close: close };
    },
    close: function () { el('modal-host').innerHTML = ''; },
    confirm: function (opts) {
      return new Promise(function (resolve) {
        Modal.open({
          title: opts.title || '확인',
          icon: opts.danger ? 'alert' : 'help',
          body: '<p style="line-height:1.6">' + nl2br(opts.message || '') + '</p>',
          buttons: [
            { label: opts.cancelLabel || '취소', value: 'cancel', variant: 'ghost' },
            { label: opts.okLabel || '확인', value: 'ok',
              variant: opts.danger ? 'danger' : 'primary' }
          ],
          onButton: function (v) { resolve(v === 'ok'); }
        });
        // 백드롭/X로 닫아도 false 처리
        var host = el('modal-host');
        var origClose = host.querySelector('[data-mclose]').onclick;
        host.querySelector('[data-mclose]').onclick = function () { origClose(); resolve(false); };
      });
    },
    alert: function (title, message) {
      Modal.open({
        title: title, icon: 'info',
        body: '<p style="line-height:1.6">' + nl2br(message || '') + '</p>',
        buttons: [{ label: '확인', value: 'ok', variant: 'primary' }]
      });
    }
  };

  /* ---------- 차트 ---------- */
  // 막대 차트: items = [{label, value, color, alt}]
  function barChart(items, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, items.map(function (i) { return i.value; }).concat([1]));
    var cols = items.map(function (it) {
      var pct = Math.round((it.value / max) * 100);
      var style = 'height:' + pct + '%;' + (it.color ? 'background:' + it.color + ';' : '');
      return '<div class="bar-col">' +
        '<div class="bar-val">' + (opts.fmt ? opts.fmt(it.value) : it.value) + '</div>' +
        '<div class="bar-track"><div class="bar' + (it.alt ? ' alt' : '') + '" style="' + style + '"></div></div>' +
        '<div class="bar-label">' + esc(it.label) + '</div>' +
      '</div>';
    }).join('');
    return '<div class="chart-bars">' + cols + '</div>';
  }

  // 선형 차트(SVG): points = [{label, value}], valRange [min,max]
  function lineChart(points, opts) {
    opts = opts || {};
    if (!points.length) return '<p class="muted center">표시할 데이터가 없습니다.</p>';
    var W = 520, H = 160, padL = 28, padB = 26, padT = 12, padR = 12;
    var min = opts.min != null ? opts.min : 0;
    var max = opts.max != null ? opts.max : Math.max.apply(null, points.map(function (p) { return p.value; }));
    if (max === min) max = min + 1;
    var iw = W - padL - padR, ih = H - padT - padB;
    var xy = points.map(function (p, i) {
      var x = padL + (points.length === 1 ? iw / 2 : (i / (points.length - 1)) * iw);
      var y = padT + ih - ((p.value - min) / (max - min)) * ih;
      return { x: x, y: y, p: p };
    });
    var path = xy.map(function (c, i) { return (i ? 'L' : 'M') + c.x.toFixed(1) + ' ' + c.y.toFixed(1); }).join(' ');
    var area = path + ' L' + xy[xy.length - 1].x.toFixed(1) + ' ' + (padT + ih) +
               ' L' + xy[0].x.toFixed(1) + ' ' + (padT + ih) + ' Z';
    var dots = xy.map(function (c) {
      return '<circle cx="' + c.x.toFixed(1) + '" cy="' + c.y.toFixed(1) +
        '" r="3.5" fill="#2f9e8f"/>';
    }).join('');
    var labels = xy.map(function (c) {
      return '<text x="' + c.x.toFixed(1) + '" y="' + (H - 8) +
        '" font-size="9.5" fill="#6b7d79" text-anchor="middle">' + esc(c.p.label) + '</text>';
    }).join('');
    return '<svg class="line-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
      '<path d="' + area + '" fill="rgba(47,158,143,.12)"/>' +
      '<path d="' + path + '" fill="none" stroke="#2f9e8f" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots + labels + '</svg>';
  }

  // 분포 막대 (가로 누적)
  function distBar(segments) {
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    var bar = segments.map(function (s) {
      return '<div style="width:' + ((s.value / total) * 100) + '%;background:' + s.color + '"></div>';
    }).join('');
    var legend = segments.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' + esc(s.label) +
        ' <b>' + s.value + '</b></span>';
    }).join('');
    return '<div style="display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--surface-2)">' +
      bar + '</div><div class="legend" style="margin-top:10px">' + legend + '</div>';
  }

  function moodStars(n) {
    var out = '<span class="mood">';
    for (var i = 1; i <= 5; i++) {
      out += '<span class="' + (i <= n ? 'on' : '') + '">' +
        (i <= n ? '😊' : '·') + '</span>';
    }
    return out + '</span>';
  }

  /* ---------- 파일 → dataURL ---------- */
  function fileToDataURL(file, maxW, cb) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, (maxW || 900) / img.width);
        var cv = document.createElement('canvas');
        cv.width = img.width * scale; cv.height = img.height * scale;
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { cb(null); };
      img.src = e.target.result;
    };
    reader.onerror = function () { cb(null); };
    reader.readAsDataURL(file);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; })
        .catch(function () { return fallbackCopy(text); });
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = document.execCommand('copy');
      ta.remove(); return ok;
    } catch (e) { return false; }
  }

  /* ---------- 음성 입력 (Web Speech API)
       지원 브라우저(Chrome·Edge·Safari iOS): 버튼 클릭 → 한국어 받아쓰기 → 인풋에 누적
       미지원 브라우저(Firefox 등): 버튼 자동 숨김 ---------- */
  function speechSupported() {
    return !!(global.SpeechRecognition || global.webkitSpeechRecognition);
  }
  function attachVoiceInput(button, input, opts) {
    opts = opts || {};
    var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
    if (!SR || !button || !input) {
      if (button) button.style.display = 'none';
      return;
    }
    var rec = null, active = false, baseValue = '';
    function stop() {
      active = false;
      button.classList.remove('recording');
      button.setAttribute('aria-pressed', 'false');
      if (rec) { try { rec.stop(); } catch (e) {} }
    }
    button.setAttribute('type', 'button');
    button.setAttribute('aria-pressed', 'false');
    button.title = '음성 입력 (마이크 권한 필요)';
    button.addEventListener('click', function (e) {
      e.preventDefault();
      if (active) { stop(); return; }
      try { rec = new SR(); } catch (err) { return; }
      rec.lang = opts.lang || 'ko-KR';
      rec.interimResults = true;
      rec.continuous = true;
      baseValue = input.value;
      rec.onresult = function (evt) {
        var transcript = '';
        for (var i = evt.resultIndex; i < evt.results.length; i++) {
          transcript += evt.results[i][0].transcript;
        }
        var glue = baseValue && !/[\s.,!?]$/.test(baseValue) ? ' ' : '';
        input.value = baseValue + glue + transcript;
        input.dispatchEvent(new Event('input'));
      };
      rec.onend = function () {
        if (active) { active = false; button.classList.remove('recording'); }
        baseValue = input.value;
      };
      rec.onerror = function () { stop(); };
      try {
        rec.start();
        active = true;
        button.classList.add('recording');
        button.setAttribute('aria-pressed', 'true');
        input.focus();
      } catch (err) { stop(); }
    });
  }

  /* ---------- 공유 — Web Share API + SNS 폴백 ---------- */
  function webShare(opts) {
    // 하이브리드(Capacitor) 앱: 네이티브 공유 시트 우선
    try {
      var cap = global.Capacitor;
      if (cap && cap.Plugins && cap.Plugins.Share) {
        return cap.Plugins.Share.share({
          title: opts.title || '', text: opts.text || '',
          url: opts.url || '', dialogTitle: opts.title || '공유'
        }).then(function () { return true; }).catch(function () { return false; });
      }
    } catch (e) {}
    // 웹 브라우저: Web Share API
    if (!navigator.share) return Promise.resolve(false);
    return navigator.share(opts).then(function () { return true; })
      .catch(function () { return false; });
  }
  function snsShareUrl(provider, url, text) {
    var t = encodeURIComponent(text || ''), u = encodeURIComponent(url);
    var subject = encodeURIComponent('Stellar Connect — 내 아이 사용 설명서 공유');
    return ({
      twitter:  'https://twitter.com/intent/tweet?text=' + t + '&url=' + u,
      facebook: 'https://www.facebook.com/sharer/sharer.php?u=' + u,
      line:     'https://social-plugins.line.me/lineit/share?url=' + u + '&text=' + t,
      email:    'mailto:?subject=' + subject + '&body=' + encodeURIComponent((text || '') + '\n\n' + url),
      sms:      'sms:?body=' + encodeURIComponent((text || '') + ' ' + url)
    })[provider] || '';
  }

  global.UI = {
    el: el, esc: esc, nl2br: nl2br, icon: icon, brandMark: brandMark,
    fmtDate: fmtDate, fmtDateTime: fmtDateTime, timeAgo: timeAgo,
    calcAge: calcAge, initials: initials,
    toast: toast, Modal: Modal,
    barChart: barChart, lineChart: lineChart, distBar: distBar, moodStars: moodStars,
    fileToDataURL: fileToDataURL, copyText: copyText,
    speechSupported: speechSupported, attachVoiceInput: attachVoiceInput,
    webShare: webShare, snsShareUrl: snsShareUrl
  };
})(window);
