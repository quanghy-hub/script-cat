// ==UserScript==
// @name         Aa Text
// @namespace    qh.textsize.per_site
// @version      1.7.0
// @description  Chỉnh cỡ chữ theo từng website bằng text-size-adjust. Thang 50–300% (100% = mặc định). Panel mở từ ScriptCat. Thanh trượt dài cố định, không bị co giãn theo cỡ chữ, kéo mượt.
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
  const DEFAULT = { enabled: true, scalePct: 100 }; // 50..300

  // load + migrate
  let state = read();
  function read() {
    try {
      const raw = JSON.parse(GM_getValue(KEY, '{}')) || {};
      if (typeof raw.adjPct === 'number' && typeof raw.scalePct !== 'number') {
        raw.scalePct = clamp(100 + raw.adjPct, 50, 300);
        delete raw.adjPct;
      }
      return Object.assign({}, DEFAULT, raw);
    } catch { return { ...DEFAULT }; }
  }
  function save() { GM_setValue(KEY, JSON.stringify(state)); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

  // base CSS (áp cỡ chữ)
  GM_addStyle(`
    html{ --qh_ts_value:${clamp(state.scalePct,50,300)}% !important; }
    html{ -webkit-text-size-adjust: var(--qh_ts_value) !important; text-size-adjust: var(--qh_ts_value) !important; }
  `);

  function apply() {
    const pct = state.enabled ? clamp(state.scalePct, 50, 300) : 100;
    const root = document.documentElement;
    root.style.setProperty('--qh_ts_value', pct + '%');
    root.style.setProperty('text-size-adjust', pct + '%', 'important');
    root.style.setProperty('-webkit-text-size-adjust', pct + '%', 'important');
  }

  // panel UI (mở từ menu)
  let hostDiv, $range, $out, $enable;
  let rafId = 0, pendingValue = null;

  function openPanel() {
    closePanel();

    // Shadow DOM để cách ly khỏi text-size-adjust
    hostDiv = document.createElement('div');
    hostDiv.style.cssText = 'position:fixed;inset:auto 12px 12px auto;z-index:2147483647;';
    const shadow = hostDiv.attachShadow({ mode: 'open' });

    // style trong shadow: cố định kích thước panel + slider
    const style = document.createElement('style');
    style.textContent = `
      :host{ all: initial; }
      *{ box-sizing: border-box; -webkit-text-size-adjust:100% !important; text-size-adjust:100% !important; }
      .panel{
        width: 360px; /* cố định */
        padding: 10px 12px; border-radius: 12px;
        background: rgba(255,255,255,.98); color:#111; border:1px solid rgba(0,0,0,.12);
        box-shadow: 0 8px 32px rgba(0,0,0,.18);
        font: 500 14px/1.35 system-ui, sans-serif;
        contain: content; isolation:isolate;
      }
      .top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
      .x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; }
      .row{ display:flex; align-items:center; gap:10px; margin-top:8px; }
      .range{ flex:none; width:320px; height:28px; } /* thanh trượt dài cố định */
      .badge{ flex:none; width:54px; text-align:right; font-weight:700; }
      .btn{ padding:6px 10px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; font:600 13px/1 system-ui,sans-serif; }
      .note{ font-size:12px; color:#555; margin-top:6px; }
      @media (prefers-color-scheme: dark){
        .panel{ background: rgba(26,26,26,.98); color:#f1f1f1; border-color: rgba(255,255,255,.12); }
        .x,.btn{ background:#151515; color:#eee; border-color: rgba(255,255,255,.12); }
        .note{ color:#aaa; }
      }
    `;
    shadow.appendChild(style);

    const cur = clamp(state.scalePct, 50, 300);
    const wrap = document.createElement('div');
    wrap.className = 'panel';
    wrap.innerHTML = `
      <div class="top">
        <div class="title">Cỡ chữ: ${HOST}</div>
        <button class="x" type="button" aria-label="Đóng">✕</button>
      </div>
      <div class="row">
        <input class="range" type="range" min="50" max="300" step="1" value="${cur}" inputmode="none" />
        <div class="badge"><span id="out">${cur}</span>%</div>
      </div>
      <div class="row">
        <button class="btn" data-delta="-10">-10%</button>
        <button class="btn" data-delta="-1">-1%</button>
        <button class="btn" data-delta="+1">+1%</button>
        <button class="btn" data-delta="+10">+10%</button>
        <button class="btn" data-set="100">Reset 100%</button>
      </div>
      <div class="row">
        <label style="display:flex;align-items:center;gap:8px;">
          <input id="en" type="checkbox" ${state.enabled ? 'checked' : ''} />
          Bật trên ${HOST}
        </label>
      </div>
      <div class="note">Thang 50–300%. Thanh trượt dài cố định. Panel không bị ảnh hưởng bởi thay đổi cỡ chữ trang.</div>
    `;
    shadow.appendChild(wrap);
    document.documentElement.appendChild(hostDiv);

    // refs
    $range  = wrap.querySelector('.range');
    $out    = wrap.querySelector('#out');
    $enable = wrap.querySelector('#en');

    // đóng
    wrap.querySelector('.x').onclick = closePanel;
    setTimeout(()=>{
      const onDocClick = (e)=>{
        if (!hostDiv) return;
        if (e.composedPath && !e.composedPath().includes(hostDiv)) closePanel();
      };
      document.addEventListener('click', onDocClick, { capture:true, once:true });
    },0);

    // mượt: throttle bằng requestAnimationFrame
    const onInput = () => {
      pendingValue = clamp(parseInt($range.value||'100',10), 50, 300);
      $out.textContent = pendingValue;
      if (!rafId) rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (pendingValue != null) {
          state.scalePct = pendingValue;
          pendingValue = null;
          save(); apply();
        }
      });
    };
    $range.addEventListener('input', onInput, { passive:true });

    // nút bước nhanh
    wrap.querySelectorAll('.btn[data-delta]').forEach(b=>{
      b.onclick = ()=> {
        const delta = parseInt(b.getAttribute('data-delta'),10);
        state.scalePct = clamp(state.scalePct + delta, 50, 300);
        $range.value = state.scalePct; $out.textContent = state.scalePct;
        save(); apply();
      };
    });
    wrap.querySelector('.btn[data-set="100"]').onclick = ()=> {
      state.scalePct = 100; $range.value = 100; $out.textContent = 100; save(); apply();
    };

    // bật/tắt
    $enable.onchange = ()=> { state.enabled = !!$enable.checked; save(); apply(); };
  }

  function closePanel() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    if (hostDiv && hostDiv.isConnected) hostDiv.remove();
    hostDiv = $range = $out = $enable = null;
  }

  // menu ScriptCat
  function registerMenu() {
    try {
      GM_registerMenuCommand(`Aa • Mở cài đặt (${HOST})`, openPanel);
      GM_registerMenuCommand(`Aa • +1%`, () => { state.scalePct = clamp(state.scalePct + 1, 50, 300); save(); apply(); });
      GM_registerMenuCommand(`Aa • -1%`, () => { state.scalePct = clamp(state.scalePct - 1, 50, 300); save(); apply(); });
      GM_registerMenuCommand(`Aa • +10%`, () => { state.scalePct = clamp(state.scalePct + 10, 50, 300); save(); apply(); });
      GM_registerMenuCommand(`Aa • -10%`, () => { state.scalePct = clamp(state.scalePct - 10, 50, 300); save(); apply(); });
      GM_registerMenuCommand(`Aa • Reset 100%`, () => { state.scalePct = 100; save(); apply(); });
      GM_registerMenuCommand(state.enabled ? `Aa • Tắt trên ${HOST}` : `Aa • Bật trên ${HOST}`, () => {
        state.enabled = !state.enabled; save(); apply();
      });
    } catch {}
  }

  // init
  apply();
  registerMenu();

})();
