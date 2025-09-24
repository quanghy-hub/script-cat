// ==UserScript==
// @name         Aa Text
// @namespace    qh.textsize.per_site
// @version      1.8.0
// @description  Tăng/giảm cỡ chữ THEO TỪNG WEBSITE bằng text-size-adjust. Dải 50–300%. Chỉ hiện cài đặt qua GM_registerMenuCommand.
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const HOST = location.host.replace(/^www\./, '');
  const KEY  = `qh_ts:${HOST}`;
  const MIN = 50, MAX = 300, STEP = 1;
  const DEFAULT = { enabled: true, pct: 100 }; // 100% = mặc định
  let state = read();

  function read() {
    try {
      const obj = Object.assign({}, DEFAULT, JSON.parse(GM_getValue(KEY, '{}')));
      // Tương thích bản cũ: adjPct 0..+100 -> pct 100..200
      if (typeof obj.adjPct === 'number' && !('pct' in obj)) {
        obj.pct = clamp(100 + obj.adjPct, MIN, MAX);
      }
      obj.pct = clamp(obj.pct, MIN, MAX);
      return obj;
    } catch { return { ...DEFAULT }; }
  }
  function save() { GM_setValue(KEY, JSON.stringify(state)); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

  // CSS và panel không bị phóng theo text-size-adjust
  GM_addStyle(`
    html{ --qh_ts_value:${state.enabled ? state.pct : 100}% !important; }
    html{ -webkit-text-size-adjust: var(--qh_ts_value) !important; text-size-adjust: var(--qh_ts_value) !important; }

    .qh-aa-panel{
      position: fixed; inset: auto 12px 12px auto; z-index: 2147483647;
      width: 460px; padding: 12px; border-radius: 12px;
      background: rgba(255,255,255,.98); color:#111; border:1px solid rgba(0,0,0,.12);
      box-shadow: 0 8px 32px rgba(0,0,0,.18); font: 500 14px/1.35 system-ui,sans-serif;
      -webkit-text-size-adjust: 100% !important; text-size-adjust: 100% !important;
      user-select: none;
    }
    .qh-aa-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
    .qh-aa-x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; cursor:pointer; }
    .qh-aa-row{ display:flex; align-items:center; gap:10px; margin-top:8px; }
    .qh-aa-btn2{ padding:6px 10px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; font:600 13px/1 system-ui,sans-serif; cursor:pointer; }

    /* Thanh trượt dài, cố định kích cỡ theo px */
    .qh-aa-wrap{ position:relative; width: 380px; height: 40px; }
    .qh-aa-range{
      position:absolute; left:0; right:0; top:14px; width:380px; height:28px;
      appearance:none; -webkit-appearance:none; background:transparent;
      touch-action: pan-x; /* mượt trên di động */
    }
    /* Track */
    .qh-aa-range::-webkit-slider-runnable-track{
      height:4px; background: linear-gradient(to right, #4c7cff 0%, #4c7cff var(--fill,0%), rgba(0,0,0,.2) var(--fill,0%), rgba(0,0,0,.2) 100%);
      border-radius:999px;
    }
    .qh-aa-range::-moz-range-track{
      height:4px; background: rgba(0,0,0,.2); border-radius:999px;
    }
    /* Thumb */
    .qh-aa-range::-webkit-slider-thumb{
      -webkit-appearance:none; appearance:none; width:20px; height:20px; border-radius:50%;
      background:#fff; border:1px solid rgba(0,0,0,.25); margin-top:-8px; box-shadow:0 1px 2px rgba(0,0,0,.15);
    }
    .qh-aa-range::-moz-range-thumb{
      width:20px; height:20px; border-radius:50%; background:#fff; border:1px solid rgba(0,0,0,.25);
      box-shadow:0 1px 2px rgba(0,0,0,.15);
    }

    /* Bong bóng % trên thanh trượt */
    .qh-aa-bubble{
      position:absolute; top:-2px; transform:translateX(-50%);
      padding:2px 6px; border-radius:8px; font-weight:700; font-size:12px; background:#111; color:#fff;
      pointer-events:none;
    }
    .qh-aa-bubble::after{
      content:""; position:absolute; left:50%; transform:translateX(-50%);
      bottom:-5px; border:5px solid transparent; border-top-color:#111;
    }

    .qh-aa-badge{ min-width:72px; text-align:right; font-weight:700; }

    .qh-aa-note{ font-size:12px; color:#555; margin-top:6px; }
    @media (prefers-color-scheme: dark){
      .qh-aa-panel{ background: rgba(26,26,26,.98); color:#f1f1f1; border-color: rgba(255,255,255,.12); }
      .qh-aa-x,.qh-aa-btn2{ background:#151515; color:#eee; border-color: rgba(255,255,255,.12); }
      .qh-aa-note{ color:#aaa; }
      .qh-aa-range::-webkit-slider-runnable-track{ background: linear-gradient(to right, #9bb4ff 0%, #9bb4ff var(--fill,0%), rgba(255,255,255,.2) var(--fill,0%), rgba(255,255,255,.2) 100%); }
      .qh-aa-range::-moz-range-track{ background: rgba(255,255,255,.2); }
      .qh-aa-range::-webkit-slider-thumb{ background:#222; border-color: rgba(255,255,255,.25); }
      .qh-aa-range::-moz-range-thumb{ background:#222; border-color: rgba(255,255,255,.25); }
    }
  `);

  function applyPct(pct) {
    const root = document.documentElement;
    root.style.setProperty('--qh_ts_value', (state.enabled ? pct : 100) + '%');
    root.style.setProperty('text-size-adjust', (state.enabled ? pct : 100) + '%', 'important');
    root.style.setProperty('-webkit-text-size-adjust', (state.enabled ? pct : 100) + '%', 'important');
  }

  // Khởi tạo
  applyPct(state.pct);

  // Panel
  let $panel, $range, $out, $enable, $bubble, rafId = 0, pendingValue = state.pct, dragging = false;

  function openPanel() {
    closePanel();
    $panel = document.createElement('div');
    $panel.className = 'qh-aa-panel';
    $panel.innerHTML = `
      <div class="qh-aa-top">
        <div class="title">Cỡ chữ: ${HOST}</div>
        <button class="qh-aa-x" type="button" aria-label="Đóng">✕</button>
      </div>

      <div class="qh-aa-row" style="align-items:flex-start;">
        <div class="qh-aa-wrap">
          <div class="qh-aa-bubble" id="qh-aa-bubble">${state.pct}%</div>
          <input class="qh-aa-range" type="range" min="${MIN}" max="${MAX}" step="${STEP}" value="${state.pct}" />
        </div>
        <div class="qh-aa-badge"><span id="qh-aa-out">${state.pct}</span>%</div>
      </div>

      <div class="qh-aa-row">
        <button class="qh-aa-btn2" data-delta="-1">-1%</button>
        <button class="qh-aa-btn2" data-delta="+1">+1%</button>
        <button class="qh-aa-btn2" data-set="100">Reset 100%</button>
      </div>

      <div class="qh-aa-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
          <input id="qh-aa-enable" type="checkbox" ${state.enabled ? 'checked' : ''} />
          Bật trên ${HOST}
        </label>
      </div>
      <div class="qh-aa-note">Phóng CHỮ bằng <code>text-size-adjust</code>. Dải 50–300%, bước 1%.</div>
    `;
    document.documentElement.appendChild($panel);

    $panel.querySelector('.qh-aa-x').onclick = closePanel;
    $range  = $panel.querySelector('.qh-aa-range');
    $out    = $panel.querySelector('#qh-aa-out');
    $enable = $panel.querySelector('#qh-aa-enable');
    $bubble = $panel.querySelector('#qh-aa-bubble');

    const updateBubble = () => {
      if (!$range || !$bubble) return;
      const val = parseInt($range.value,10);
      const min = parseInt($range.min,10);
      const max = parseInt($range.max,10);
      const pct = (val - min) / (max - min);
      const rect = $range.getBoundingClientRect();
      const thumb = 20; // px
      const x = pct * (rect.width - thumb) + thumb/2;
      $bubble.style.left = x + 'px';
      $bubble.textContent = val + '%';
      // tô màu phần đã kéo cho webkit
      const fill = Math.round(pct * 100);
      $range.style.setProperty('--fill', fill + '%');
    };
    const updateOut = (val) => { $out.textContent = String(val); };

    const applyRaf = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        applyPct(pendingValue);
        updateBubble();
        updateOut(pendingValue);
      });
    };

    const commitSave = () => {
      state.pct = clamp(pendingValue, MIN, MAX);
      save();
    };

    // Sự kiện trượt mượt: cập nhật bằng rAF, không ghi storage liên tục
    $range.addEventListener('input', () => {
      pendingValue = clamp(parseInt($range.value||String(DEFAULT.pct),10), MIN, MAX);
      applyRaf();
    }, { passive:true });

    $range.addEventListener('pointerdown', () => { dragging = true; }, { passive:true });
    const endDrag = () => { if (dragging) { dragging = false; commitSave(); } };
    $range.addEventListener('pointerup', endDrag, { passive:true });
    $range.addEventListener('pointercancel', endDrag, { passive:true });
    $range.addEventListener('change', () => { // hỗ trợ bàn phím
      pendingValue = clamp(parseInt($range.value,10), MIN, MAX);
      applyRaf();
      commitSave();
    });

    window.addEventListener('resize', updateBubble, { passive:true });

    $panel.querySelectorAll('.qh-aa-btn2[data-delta]').forEach(b=>{
      b.onclick = ()=> {
        const d = b.getAttribute('data-delta') === '+1' ? 1 : -1;
        pendingValue = clamp((parseInt($range.value,10) + d), MIN, MAX);
        $range.value = String(pendingValue);
        applyRaf();
        commitSave();
      };
    });
    $panel.querySelector('.qh-aa-btn2[data-set="100"]').onclick = ()=> {
      pendingValue = 100; $range.value = '100'; applyRaf(); commitSave();
    };
    $enable.onchange = ()=> { state.enabled = !!$enable.checked; save(); applyPct(pendingValue); updateBubble(); };

    // click ngoài để đóng
    setTimeout(()=> {
      const onDocClick = (e)=>{
        if (!$panel) return;
        if (!$panel.contains(e.target)) closePanel();
      };
      document.addEventListener('click', onDocClick, { capture:true, once:true });
    },0);

    // Khởi tạo vị trí bong bóng + fill
    updateBubble();
  }

  function closePanel() {
    if ($panel && $panel.isConnected) $panel.remove();
    $panel = $range = $out = $enable = $bubble = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  // Menu ScriptCat
  function registerMenu() {
    try {
      GM_registerMenuCommand(`Aa • Mở cài đặt (${HOST})`, openPanel);
      GM_registerMenuCommand(`Aa • +1%`, () => { state.pct = clamp(state.pct + 1, MIN, MAX); save(); applyPct(state.pct); });
      GM_registerMenuCommand(`Aa • -1%`, () => { state.pct = clamp(state.pct - 1, MIN, MAX); save(); applyPct(state.pct); });
      GM_registerMenuCommand(`Aa • Reset 100%`, () => { state.pct = 100; save(); applyPct(state.pct); });
      GM_registerMenuCommand(state.enabled ? `Aa • Tắt trên ${HOST}` : `Aa • Bật trên ${HOST}`, () => {
        state.enabled = !state.enabled; save(); applyPct(state.pct);
      });
    } catch {}
  }

  registerMenu();
})();
