// ==UserScript==
// @name         Per‑site Font Size Slider (Mobile Chromium) + ScriptCat Menu
// @namespace    qh.fontsize.per.site
// @version      1.2.0
// @description  Nút Aa mở bảng cài đặt để tăng/giảm cỡ chữ THEO TỪNG WEBSITE. Có thêm mục Menu của ScriptCat (GM_registerMenuCommand). 3 chế độ áp dụng: Chỉ phóng CHỮ (text-size-adjust), Đổi cỡ chữ gốc (root font-size), Phóng CẢ TRANG (zoom). Lưu per-host.
// @author       you
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @inject-into  page
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(function () {
  'use strict';

  // --------------- Utils ---------------
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
  const HOST = location.host; // per-host
  const KEY = (k) => `qfs:${HOST}:${k}`;
  const DEFAULT_CFG = { scale: 1.00, mode: 'text', x: 12, y: 14 };

  // Prefer GM_* (persist across iframes/origins under one script). Fallback to localStorage.
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  function loadCfg() {
    try {
      if (hasGM) {
        const v = GM_getValue(KEY('cfg'));
        if (!v) return { ...DEFAULT_CFG };
        const obj = JSON.parse(v);
        return normalize(obj);
      } else {
        const raw = localStorage.getItem(KEY('cfg'));
        if (!raw) return { ...DEFAULT_CFG };
        return normalize(JSON.parse(raw));
      }
    } catch { return { ...DEFAULT_CFG }; }
  }
  function saveCfg(cfg) {
    try {
      const s = JSON.stringify(cfg);
      if (hasGM) GM_setValue(KEY('cfg'), s); else localStorage.setItem(KEY('cfg'), s);
    } catch {}
  }
  function normalize(obj) {
    const scale = clamp(Number(obj.scale) || 1, 0.5, 2.8);
    const mode = ['text','root','zoom'].includes(obj.mode) ? obj.mode : 'text';
    const x = Number.isFinite(obj.x) ? obj.x : 12;
    const y = Number.isFinite(obj.y) ? obj.y : 14;
    return { scale, mode, x, y };
  }

  // --------------- CSS Apply ---------------
  const STYLE_ID = 'qfs-style';
  function ensureStyleEl() {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.documentElement.appendChild(el);
    }
    return el;
  }

  function applyScale(cfg) {
    const s = clamp(cfg.scale, 0.5, 2.8);
    const pct = Math.round(s * 100);
    const el = ensureStyleEl();

    document.documentElement.classList.remove('qfs-zoom');

    if (cfg.mode === 'text') {
      // Tốt cho site mobile; không phá layout px cố định
      el.textContent = `html{ -webkit-text-size-adjust:${pct}% !important; text-size-adjust:${pct}% !important; }`;
    } else if (cfg.mode === 'root') {
      // Đổi cỡ chữ gốc: hiệu lực với rem/em. Một số site dùng px sẽ ít đổi.
      el.textContent = `html{ font-size:${pct}% !important; }
      body, input, textarea, button, select { font-size: inherit !important; }`;
    } else {
      // Phóng cả trang (ưu tiên zoom, fallback transform cho nơi không hỗ trợ)
      const f = s.toFixed(3);
      document.documentElement.classList.add('qfs-zoom');
      el.textContent = `html.qfs-zoom{ zoom:${f} !important; }
@supports not (zoom:1){
  html.qfs-zoom{ transform: scale(${f}) !important; transform-origin: 0 0 !important; }
  body{ width: calc(100% / ${f}) !important; }
}`;
    }
  }

  // Re-apply if hostile CSS tries to remove style (SPA nav, etc.)
  const mo = new MutationObserver(() => {
    if (!document.getElementById(STYLE_ID)) {
      applyScale(cfg);
    }
  });

  // --------------- UI ---------------
  let cfg = loadCfg();

  function createUI() {
    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.userSelect = 'none';
    host.style.pointerEvents = 'none';
    host.style.left = `${cfg.x}px`;
    host.style.bottom = `${cfg.y}px`;

    const shadow = host.attachShadow({ mode: 'open' });
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <style>
        :host, * { box-sizing: border-box; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; }
        .btn { pointer-events:auto; display:inline-flex; align-items:center; justify-content:center; width:44px; height:44px; border-radius:12px; border:1px solid rgba(120,120,120,.35); background:rgba(28,28,28,.85); color:#fff; backdrop-filter: blur(6px); box-shadow: 0 4px 16px rgba(0,0,0,.28); cursor:pointer; }
        .btn:active { transform: scale(.98); }
        .panel { pointer-events:auto; position:absolute; bottom:50px; left:0; width:min(92vw,340px); padding:12px; border-radius:14px; background:rgba(20,20,20,.98); color:#eaeaea; border:1px solid rgba(120,120,120,.32); box-shadow: 0 10px 30px rgba(0,0,0,.45); display:none; }
        .panel.show { display:block; }
        .title { font-weight:700; font-size:14px; margin-bottom:6px; }
        .row { display:flex; align-items:center; gap:8px; margin:10px 0 4px; }
        .pct { min-width:52px; text-align:right; font-variant-numeric: tabular-nums; }
        input[type=range]{ width:100%; }
        .seg { display:flex; gap:8px; margin-top:8px; }
        .seg label { flex:1; display:flex; align-items:center; gap:6px; padding:8px; border-radius:10px; border:1px solid rgba(130,130,130,.35); cursor:pointer; background: rgba(255,255,255,.03); }
        .seg input{ accent-color:#3b82f6; }
        .actions { display:flex; justify-content:space-between; gap:8px; margin-top:10px; }
        button.secondary { background:#111; color:#ddd; border:1px solid rgba(130,130,130,.35); padding:8px 10px; border-radius:10px; cursor:pointer; }
        button.primary { background:#3b82f6; color:#fff; border:none; padding:8px 12px; border-radius:10px; cursor:pointer; }
        .drag-hint{ position:absolute; top:-22px; left:0; font-size:11px; opacity:.7; }
      </style>
      <button class="btn" title="Cỡ chữ theo trang (giữ để kéo)">Aa</button>
      <div class="panel" role="dialog" aria-label="Cỡ chữ theo trang">
        <div class="title">Cỡ chữ trang này</div>
        <div class="row">
          <input class="range" type="range" min="50" max="280" step="5">
          <div class="pct">100%</div>
        </div>
        <div class="seg" role="radiogroup" aria-label="Chế độ áp dụng">
          <label><input type="radio" name="mode" value="text"> <span>Chỉ phóng chữ</span></label>
          <label><input type="radio" name="mode" value="root"> <span>Đổi cỡ chữ gốc</span></label>
          <label><input type="radio" name="mode" value="zoom"> <span>Phóng cả trang</span></label>
        </div>
        <div class="actions">
          <button class="secondary js-reset">Đặt lại</button>
          <button class="primary js-close">Đóng</button>
        </div>
      </div>
    `;
    shadow.appendChild(wrap);

    const btn = shadow.querySelector('.btn');
    const panel = shadow.querySelector('.panel');
    const range = shadow.querySelector('.range');
    const pct = shadow.querySelector('.pct');
    const radios = shadow.querySelectorAll('input[name="mode"]');
    const closeBtn = shadow.querySelector('.js-close');
    const resetBtn = shadow.querySelector('.js-reset');

    // Init
    range.value = String(Math.round(cfg.scale * 100));
    pct.textContent = `${Math.round(cfg.scale * 100)}%`;
    radios.forEach(r => r.checked = (r.value === cfg.mode));

    // Toggle
    btn.addEventListener('click', () => panel.classList.toggle('show'), { passive: true });
    closeBtn.addEventListener('click', () => panel.classList.remove('show'));

    // Drag (long-press then move)
    let pressT = 0, dragging = false, startX=0, startY=0, startL=0, startB=0;
    const LONG = 280; // ms
    btn.addEventListener('touchstart', (e) => { pressT = Date.now(); startDrag(e.touches[0]); }, { passive: true });
    btn.addEventListener('mousedown', (e) => { pressT = Date.now(); startDrag(e); });
    function startDrag(p){ dragging=false; startX=p.clientX; startY=p.clientY; const r = host.getBoundingClientRect(); startL = r.left; startB = window.innerHeight - r.bottom; }
    function maybeStart(e){ if (!dragging && Date.now()-pressT>LONG){ dragging=true; panel.classList.remove('show'); }}
    function moveTo(p){ if (!dragging) return; const dx=p.clientX-startX, dy=p.clientY-startY; const nx = clamp(startL+dx, 6, window.innerWidth-50); const ny = clamp(startB-dy, 6, window.innerHeight-50); host.style.left = nx+"px"; host.style.bottom = ny+"px"; cfg.x = nx; cfg.y = ny; saveCfg(cfg); }
    window.addEventListener('mousemove', (e)=>{ maybeStart(e); moveTo(e); });
    window.addEventListener('touchmove', (e)=>{ const t=e.touches[0]; maybeStart(t); moveTo(t); }, { passive: true });
    window.addEventListener('mouseup', ()=>{ dragging=false; });
    window.addEventListener('touchend', ()=>{ dragging=false; });

    // Change handlers
    range.addEventListener('input', () => {
      cfg.scale = clamp(Number(range.value)/100, 0.5, 2.8);
      pct.textContent = `${Math.round(cfg.scale*100)}%`;
      saveCfg(cfg); applyScale(cfg);
    });
    radios.forEach(r => r.addEventListener('change', () => {
      if (!r.checked) return; cfg.mode = r.value; saveCfg(cfg); applyScale(cfg);
    }));
    resetBtn.addEventListener('click', () => {
      cfg = { ...DEFAULT_CFG }; saveCfg(cfg);
      range.value = '100'; pct.textContent='100%';
      radios.forEach(r => r.checked = (r.value==='text'));
      host.style.left = cfg.x+'px'; host.style.bottom = cfg.y+'px';
      applyScale(cfg);
    });

    return host;
  }

  function mount() {
    applyScale(cfg);
    const ui = createUI();
    document.documentElement.appendChild(ui);
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // ScriptCat menu entries
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Font size: mở bảng', () => {
        const p = document.querySelector('#qfs-open-panel-button-in-page');
        // Fallback: toggle via dispatching click to our btn in shadow (not directly reachable)
        alert('Mẹo: Bấm nút Aa ở góc để mở panel. (Giữ để kéo)');
      });
      GM_registerMenuCommand('Font size: +10%', () => { cfg.scale = clamp(cfg.scale+0.10, 0.5, 2.8); saveCfg(cfg); applyScale(cfg); });
      GM_registerMenuCommand('Font size: -10%', () => { cfg.scale = clamp(cfg.scale-0.10, 0.5, 2.8); saveCfg(cfg); applyScale(cfg); });
      GM_registerMenuCommand('Font size: đặt lại', () => { cfg={...DEFAULT_CFG}; saveCfg(cfg); applyScale(cfg); });
    }
  }

  if (document.readyState === 'loading') {
    // document-start: apply asap to giảm giật
    applyScale(cfg);
    addEventListener('DOMContentLoaded', mount, { once:true });
  } else {
    mount();
  }
})();
