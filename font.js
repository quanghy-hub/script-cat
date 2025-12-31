// ==UserScript==
// @name         Text Size
// @namespace    textsize
// @version      2.1.1
// @description  Tăng/giảm cỡ CHỮ THEO TỪNG WEBSITE bằng text-size-adjust.
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
  const KEY = `qh_ts:${HOST}`;
  const MIN = 60, MAX = 200;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  let state = (() => {
    try {
      const obj = { enabled: true, pct: 100, ...JSON.parse(GM_getValue(KEY, '{}')) };
      obj.pct = clamp(obj.pct, MIN, MAX);
      return obj;
    } catch { return { enabled: true, pct: 100 }; }
  })();

  const save = () => GM_setValue(KEY, JSON.stringify(state));

  GM_addStyle(`
    html{--qh_ts:${state.enabled ? state.pct : 100}% !important;-webkit-text-size-adjust:var(--qh_ts)!important;text-size-adjust:var(--qh_ts)!important}
    .qh-aa-panel{position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:2147483647;width:min(90vw,960px);padding:12px;border-radius:12px;background:rgba(255,255,255,.98);color:#111;border:1px solid rgba(0,0,0,.12);box-shadow:0 8px 32px rgba(0,0,0,.18);font:500 14px/1.35 system-ui,sans-serif;-webkit-text-size-adjust:100%!important;text-size-adjust:100%!important;user-select:none}
    .qh-aa-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
    .qh-aa-x{width:28px;height:28px;border-radius:8px;border:1px solid rgba(0,0,0,.12);background:#fff;cursor:pointer;transition:background .15s}
    .qh-aa-x:hover{background:#f0f0f0}
    .qh-aa-row{display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap}
    .qh-aa-wrap{position:relative;flex:1 1 600px;height:44px}
    .qh-aa-range{position:absolute;left:0;right:0;top:16px;width:100%;height:28px;appearance:none;-webkit-appearance:none;background:transparent;touch-action:pan-x;cursor:pointer}
    .qh-aa-range::-webkit-slider-runnable-track{height:4px;border-radius:999px;background:linear-gradient(to right,#4c7cff 0%,#4c7cff var(--fill,0%),rgba(0,0,0,.2) var(--fill,0%),rgba(0,0,0,.2) 100%)}
    .qh-aa-range::-moz-range-track{height:4px;border-radius:999px;background:rgba(0,0,0,.2)}
    .qh-aa-range::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.25);margin-top:-8px;box-shadow:0 2px 6px rgba(0,0,0,.18);transition:transform .12s}
    .qh-aa-range::-webkit-slider-thumb:hover{transform:scale(1.15)}
    .qh-aa-range::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.25);box-shadow:0 2px 6px rgba(0,0,0,.18)}
    .qh-aa-bubble{position:absolute;top:-2px;padding:2px 6px;border-radius:8px;font-weight:700;font-size:12px;background:#111;color:#fff;pointer-events:none;white-space:nowrap;transition:left .05s}
    .qh-aa-bubble::after{content:"";position:absolute;left:50%;transform:translateX(-50%);bottom:-5px;border:5px solid transparent;border-top-color:#111}
    .qh-aa-badge{min-width:76px;text-align:right;font-weight:700}
    .qh-aa-btn{padding:6px 10px;border-radius:8px;border:1px solid rgba(0,0,0,.12);background:#fff;font:600 13px/1 system-ui,sans-serif;cursor:pointer;transition:background .15s}
    .qh-aa-btn:hover{background:#f0f0f0}
    .qh-aa-note{font-size:12px;color:#555;margin-top:6px}
    @media(prefers-color-scheme:dark){
      .qh-aa-panel{background:rgba(26,26,26,.98);color:#f1f1f1;border-color:rgba(255,255,255,.12)}
      .qh-aa-x,.qh-aa-btn{background:#151515;color:#eee;border-color:rgba(255,255,255,.12)}
      .qh-aa-x:hover,.qh-aa-btn:hover{background:#252525}
      .qh-aa-note{color:#aaa}
      .qh-aa-range::-webkit-slider-runnable-track{background:linear-gradient(to right,#9bb4ff 0%,#9bb4ff var(--fill,0%),rgba(255,255,255,.2) var(--fill,0%),rgba(255,255,255,.2) 100%)}
      .qh-aa-range::-moz-range-track{background:rgba(255,255,255,.2)}
      .qh-aa-range::-webkit-slider-thumb{background:#222;border-color:rgba(255,255,255,.25)}
      .qh-aa-range::-moz-range-thumb{background:#222;border-color:rgba(255,255,255,.25)}
      .qh-aa-bubble{background:#fff;color:#111}
      .qh-aa-bubble::after{border-top-color:#fff}
    }
  `);

  const applyPct = () => {
    const val = state.enabled ? state.pct : 100;
    const r = document.documentElement.style;
    r.setProperty('--qh_ts', `${val}%`);
    r.setProperty('text-size-adjust', `${val}%`, 'important');
    r.setProperty('-webkit-text-size-adjust', `${val}%`, 'important');
  };

  applyPct();

  let $panel, $range, $out, $bubble, resizeHandler;

  const updateVisual = () => {
    const pct01 = (state.pct - MIN) / (MAX - MIN);
    $bubble.style.left = `${pct01 * ($range.offsetWidth - 20) + 10}px`;
    $bubble.textContent = `${state.pct}%`;
    $range.style.setProperty('--fill', `${Math.round(pct01 * 100)}%`);
    $out.textContent = state.pct;
  };

  const closePanel = () => {
    $panel?.remove();
    $panel = null;
    if (resizeHandler) window.removeEventListener('resize', resizeHandler);
  };

  const setPct = (val, doSave = true) => {
    state.pct = clamp(val, MIN, MAX);
    $range.value = state.pct;
    applyPct();
    updateVisual();
    if (doSave) save();
  };

  const openPanel = () => {
    closePanel();
    $panel = document.createElement('div');
    $panel.className = 'qh-aa-panel';
    $panel.innerHTML = `
      <div class="qh-aa-top">
        <div>Cỡ chữ: ${HOST}</div>
        <button class="qh-aa-x" type="button">✕</button>
      </div>
      <div class="qh-aa-row" style="align-items:flex-start">
        <div class="qh-aa-wrap">
          <div class="qh-aa-bubble">${state.pct}%</div>
          <input class="qh-aa-range" type="range" min="${MIN}" max="${MAX}" value="${state.pct}">
        </div>
        <div class="qh-aa-badge"><span class="qh-aa-out">${state.pct}</span>%</div>
      </div>
      <div class="qh-aa-row">
        <button class="qh-aa-btn" data-d="-1">-1%</button>
        <button class="qh-aa-btn" data-d="1">+1%</button>
        <button class="qh-aa-btn" data-s="100">Reset</button>
      </div>
      <div class="qh-aa-row">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <input class="qh-aa-chk" type="checkbox" ${state.enabled ? 'checked' : ''}>
          Bật trên ${HOST}
        </label>
      </div>
      <div class="qh-aa-note">Phóng CHỮ bằng text-size-adjust. Dải 60–200%.</div>
    `;
    document.documentElement.appendChild($panel);

    $range = $panel.querySelector('.qh-aa-range');
    $out = $panel.querySelector('.qh-aa-out');
    $bubble = $panel.querySelector('.qh-aa-bubble');

    $panel.querySelector('.qh-aa-x').onclick = closePanel;
    $range.oninput = () => setPct(+$range.value, false);
    $range.onchange = () => save();

    $panel.querySelectorAll('[data-d]').forEach(b => b.onclick = () => setPct(state.pct + +b.dataset.d));
    $panel.querySelector('[data-s]').onclick = () => setPct(100);
    $panel.querySelector('.qh-aa-chk').onchange = e => { state.enabled = e.target.checked; save(); applyPct(); };

    resizeHandler = updateVisual;
    window.addEventListener('resize', resizeHandler, { passive: true });

    setTimeout(() => document.addEventListener('click', e => {
      if ($panel && !$panel.contains(e.target)) closePanel();
    }, { capture: true, once: true }), 0);

    updateVisual();
  };

  try { GM_registerMenuCommand(`Aa Cỡ chữ (${HOST})`, openPanel); } catch { }
})();
