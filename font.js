// ==UserScript==
// @name         Aa Text
// @namespace    qh.textsize.per_site
// @version      1.6.0
// @description  Tăng/giảm cỡ chữ THEO TỪNG WEBSITE bằng text-size-adjust. Thang 50–300% (100% = mặc định). Menu ScriptCat, không icon nổi.
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

  // --- load + migrate (from adjPct -> scalePct) ---
  let state = read();
  function read() {
    try {
      const raw = JSON.parse(GM_getValue(KEY, '{}')) || {};
      // migrate if old schema
      if (typeof raw.adjPct === 'number' && typeof raw.scalePct !== 'number') {
        raw.scalePct = clamp(100 + raw.adjPct, 50, 300);
        delete raw.adjPct;
      }
      return Object.assign({}, DEFAULT, raw);
    } catch { return { ...DEFAULT }; }
  }
  function save() { GM_setValue(KEY, JSON.stringify(state)); }
  function clamp(x,a,b){ return Math.max(a, Math.min(b, x)); }

  // --- base CSS (text only) ---
  GM_addStyle(`
    html{ --qh_ts_value:${clamp(state.scalePct,50,300)}% !important; }
    html{ -webkit-text-size-adjust: var(--qh_ts_value) !important; text-size-adjust: var(--qh_ts_value) !important; }
    .qh-aa-panel{
      position: fixed; inset: auto 12px 12px auto; z-index: 2147483647;
      min-width: 260px; padding: 10px 12px; border-radius: 12px;
      background: rgba(255,255,255,.98); color:#111; border:1px solid rgba(0,0,0,.12);
      box-shadow: 0 8px 32px rgba(0,0,0,.18); font: 500 14px/1.35 system-ui,sans-serif;
    }
    .qh-aa-row{ display:flex; align-items:center; gap:8px; margin-top:8px; }
    .qh-aa-range{ flex:1; }
    .qh-aa-badge{ min-width:64px; text-align:right; font-weight:700; }
    .qh-aa-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .qh-aa-x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; }
    .qh-aa-btn2{ padding:6px 10px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; font:600 13px/1 system-ui,sans-serif; }
    .qh-aa-note{ font-size:12px; color:#555; margin-top:6px; }
    @media (prefers-color-scheme: dark){
      .qh-aa-panel{ background: rgba(26,26,26,.98); color:#f1f1f1; border-color: rgba(255,255,255,.12); }
      .qh-aa-x,.qh-aa-btn2{ background:#151515; color:#eee; border-color: rgba(255,255,255,.12); }
      .qh-aa-note{ color:#aaa; }
    }
  `);

  function apply() {
    const pct = state.enabled ? clamp(state.scalePct, 50, 300) : 100;
    const root = document.documentElement;
    root.style.setProperty('--qh_ts_value', pct + '%');
    root.style.setProperty('text-size-adjust', pct + '%', 'important');
    root.style.setProperty('-webkit-text-size-adjust', pct + '%', 'important');
  }

  // --- panel (open via ScriptCat menu only) ---
  let $panel, $range, $out, $enable;
  function openPanel() {
    closePanel();
    $panel = document.createElement('div');
    $panel.className = 'qh-aa-panel';
    const cur = clamp(state.scalePct, 50, 300);
    $panel.innerHTML = `
      <div class="qh-aa-top">
        <div class="title">Cỡ chữ: ${HOST}</div>
        <button class="qh-aa-x" type="button" aria-label="Đóng">✕</button>
      </div>
      <div class="qh-aa-row">
        <input class="qh-aa-range" type="range" min="50" max="300" step="1" value="${cur}" />
        <div class="qh-aa-badge"><span id="qh-aa-out">${cur}</span>%</div>
      </div>
      <div class="qh-aa-row">
        <button class="qh-aa-btn2" data-delta="-1">-1%</button>
        <button class="qh-aa-btn2" data-delta="+1">+1%</button>
        <button class="qh-aa-btn2" data-set="100">Reset 100%</button>
      </div>
      <div class="qh-aa-row">
        <label style="display:flex;align-items:center;gap:8px;">
          <input id="qh-aa-enable" type="checkbox" ${state.enabled ? 'checked' : ''} />
          Bật trên ${HOST}
        </label>
      </div>
      <div class="qh-aa-note">Thang 50–300%. 100% = kích thước mặc định của trang.</div>
    `;
    document.documentElement.appendChild($panel);

    $panel.querySelector('.qh-aa-x').onclick = closePanel;
    $range  = $panel.querySelector('.qh-aa-range');
    $out    = $panel.querySelector('#qh-aa-out');
    $enable = $panel.querySelector('#qh-aa-enable');

    $range.addEventListener('input', () => {
      state.scalePct = clamp(parseInt($range.value||'100',10), 50, 300);
      $out.textContent = state.scalePct;
      save(); apply();
    });
    $panel.querySelectorAll('.qh-aa-btn2[data-delta]').forEach(b=>{
      b.onclick = ()=> {
        const d = b.getAttribute('data-delta') === '+1' ? 1 : -1;
        state.scalePct = clamp(state.scalePct + d, 50, 300);
        $range.value = state.scalePct; $out.textContent = state.scalePct;
        save(); apply();
      };
    });
    $panel.querySelector('.qh-aa-btn2[data-set="100"]').onclick = ()=> {
      state.scalePct = 100; $range.value = 100; $out.textContent = 100; save(); apply();
    };

    $enable.onchange = ()=> { state.enabled = !!$enable.checked; save(); apply(); };

    // click outside to close
    setTimeout(()=> {
      const onDocClick = (e)=>{
        if (!$panel) return;
        if (!$panel.contains(e.target)) closePanel();
      };
      document.addEventListener('click', onDocClick, { capture:true, once:true });
    },0);
  }
  function closePanel() {
    if ($panel && $panel.isConnected) $panel.remove();
    $panel = $range = $out = $enable = null;
  }

  // --- ScriptCat menu only ---
  function registerMenu() {
    try {
      GM_registerMenuCommand(`Aa • Mở cài đặt (${HOST})`, openPanel);
      GM_registerMenuCommand(`Aa • +1%`, () => { state.scalePct = clamp(state.scalePct + 1, 50, 300); save(); apply(); });
      GM_registerMenuCommand(`Aa • -1%`, () => { state.scalePct = clamp(state.scalePct - 1, 50, 300); save(); apply(); });
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
