// ==UserScript==
// @name         Gestures
// @namespace    https://github.com/yourname/hold-to-search + vm-unified-gestures-open-tab
// @version      1.1.3
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @run-at       document-start
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/gestures.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/gestures.js
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        window.close
// @license      MIT
// ==/UserScript==

/* =========================
   GLOBAL GUARD: chống trùng mở tab + chặn click
   ========================= */
(() => {
  'use strict';
  const G = (window.__GESTURES_GUARD__ ||= {
    killUntil: 0,
    recentOpenAt: 0,
    recentKey: '',
    suppress(ms = 1000) { this.killUntil = Date.now() + ms; },
    canOpen(key = '') {
      const now = Date.now();
      if (now - this.recentOpenAt < 500 && (!key || key === this.recentKey)) return false;
      this.recentOpenAt = now; this.recentKey = key; return true;
    }
  });

  if (!window.__GESTURES_GUARD_LISTENERS__) {
    window.__GESTURES_GUARD_LISTENERS__ = true;
    const eat = (ev) => {
      if (Date.now() <= G.killUntil) { ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation(); }
    };
    addEventListener('click', eat, true);
    addEventListener('auxclick', eat, true);
    addEventListener('contextmenu', eat, true);
  }
})();

/* =========================
   MODULE 1: Hold-to-Search
   (Selection-first, Touch-friendly)
   ========================= */
(() => {
  'use strict';
  const G = window.__GESTURES_GUARD__;

  // ===== Config & Storage =====
  const ENGINES = {
    google: { name: 'Google', url: 'https://www.google.com/search?q=%s' },
    ddg:    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
    bing:   { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
    wiki:   { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=%s' },
    yt:     { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
  };

  function get(key, def){ try{ return GM_getValue(key, def); }catch{ return def; } }
  function set(key, val){ try{ GM_setValue(key, val); }catch{} }

  let engineKey      = get('hold_engine', 'google');
  let openBG         = get('hold_open_bg', false);
  let HOLD_MS        = get('hold_delay_ms', 500);
  let MOVE_TOLERANCE = get('hold_move_tol', 8);

  // Menu
  GM_registerMenuCommand?.(`🔎 Hold-Search • Engine: ${ENGINES[engineKey]?.name||engineKey}`, () => {
    const keys = Object.keys(ENGINES);
    const choice = prompt('Chọn engine: ' + keys.join(', '), engineKey);
    if (!choice || !ENGINES[choice]) return;
    engineKey = choice; set('hold_engine', engineKey);
    alert('Đã chọn: ' + ENGINES[engineKey].name);
  });
  GM_registerMenuCommand?.(`🔎 Hold-Search • Open in ${openBG?'BG':'FG'} tab`, () => {
    openBG = !openBG; set('hold_open_bg', openBG);
    alert('Open = ' + (openBG ? 'Background' : 'Foreground'));
  });
  GM_registerMenuCommand?.(`🔎 Hold-Search • Hold delay (ms): ${HOLD_MS}`, () => {
    const v = Number(prompt('Nhập thời gian giữ (ms):', String(HOLD_MS)));
    if (!Number.isFinite(v) || v < 200) return alert('Nhập số ≥ 200 ms');
    HOLD_MS = v; set('hold_delay_ms', HOLD_MS);
  });
  GM_registerMenuCommand?.(`🔎 Hold-Search • Move tolerance (px): ${MOVE_TOLERANCE}`, () => {
    const v = Number(prompt('Nhập ngưỡng di chuyển (px):', String(MOVE_TOLERANCE)));
    if (!Number.isFinite(v) || v < 2) return alert('Nhập số ≥ 2 px');
    MOVE_TOLERANCE = v; set('hold_move_tol', MOVE_TOLERANCE);
  });

  // ===== Utils =====
  const isEditable = el => el && (el.isContentEditable || /^(input|textarea|select|button)$/i.test(el.tagName));
  const buildSearchURL = (q) => {
    const tpl = ENGINES[engineKey]?.url || ENGINES.google.url;
    return tpl.replace('%s', encodeURIComponent(q));
  };
  const openURL = (url, key='hold-search') => {
    if (!G.canOpen(key)) return;
    try {
      if (openBG) { GM_openInTab(url, { active:false, insert:true, setParent:true }); }
      else { GM_openInTab(url, { active:true, insert:true, setParent:true }); }
    } catch {
      if (openBG) { const w=window.open(url,'_blank','noopener'); try{window.focus();}catch{} }
      else window.open(url,'_blank');
    }
    // Chặn click tổng hợp của trình duyệt sau khi mở
    G.suppress(900);
  };

  // Snapshot vùng bôi
  let lastSel = { text: '', rects: [], t: 0 };
  function captureSelectionSnapshot() {
    const sel = (document.getSelection?.() || window.getSelection?.());
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) { lastSel = { text:'', rects:[], t:0 }; return; }
    const rng = sel.getRangeAt(0);
    const rects = Array.from(rng.getClientRects?.() || []);
    const text = sel.toString().trim();
    if (text) lastSel = { text, rects, t: performance.now() };
  }
  document.addEventListener('mouseup', captureSelectionSnapshot, true);
  document.addEventListener('selectionchange', captureSelectionSnapshot, true);

  function pointInRects(x, y, rects) {
    for (const r of rects) { if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true; }
    return false;
  }

  // ===== Hold detection =====
  let holdTimer = null;
  let startX = 0, startY = 0;

  function clearHold(){ if (holdTimer){ clearTimeout(holdTimer); holdTimer = null; } }
  function triggerSearch(){
    holdTimer = null;
    let q = '';
    if (lastSel.text) q = lastSel.text;
    if (!q) {
      const sel = (document.getSelection?.() || window.getSelection?.());
      q = (sel?.toString() || '').trim();
    }
    if (!q) return;
    openURL(buildSearchURL(q), 'hold-search:'+q);
  }

  // Desktop
  function onMouseDown(e){
    if (e.button !== 0) return;
    if (isEditable(e.target)) return;
    if (!lastSel.text || lastSel.rects.length === 0) return;
    if (!pointInRects(e.clientX, e.clientY, lastSel.rects)) return;

    e.preventDefault();
    startX = e.clientX; startY = e.clientY;

    holdTimer = setTimeout(()=>{ triggerSearch(); }, HOLD_MS);

    const move = (ev)=>{
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) clearHold();
    };
    const up = ()=>{
      document.removeEventListener('mousemove', move, true);
      document.removeEventListener('mouseup', up, true);
      clearHold();
      // Sau khi nhả tay, vẫn giữ suppress để tránh click mở thêm
      // (đã đặt trong triggerSearch nếu đã mở)
    };
    document.addEventListener('mousemove', move, true);
    document.addEventListener('mouseup', up, true);
  }
  document.addEventListener('mousedown', onMouseDown, { capture: true });

  // Mobile
  function onTouchStart(e){
    if (isEditable(e.target)) return;
    if (!lastSel.text || lastSel.rects.length === 0) return;
    const t = e.touches?.[0] || e.changedTouches?.[0]; if (!t) return;
    if (!pointInRects(t.clientX, t.clientY, lastSel.rects)) return;

    e.preventDefault();
    startX = t.clientX; startY = t.clientY;

    holdTimer = setTimeout(()=>{ triggerSearch(); }, HOLD_MS);

    const move = (ev)=>{
      const p = ev.touches?.[0] || ev.changedTouches?.[0]; if (!p) return;
      const dx = p.clientX - startX, dy = p.clientY - startY;
      if (Math.abs(dx) > MOVE_TOLERANCE || Math.abs(dy) > MOVE_TOLERANCE) clearHold();
    };
    const end = ()=>{
      document.removeEventListener('touchmove', move, true);
      document.removeEventListener('touchend', end, true);
      document.removeEventListener('touchcancel', end, true);
      clearHold();
    };
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, true);
    document.addEventListener('touchcancel', end, true);
  }
  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: false });
})();

/* =========================
   MODULE 2: Unified Gestures
   (Double / Long-press / Right-click → Open Tab BG/FG or Close Tab)
   ========================= */
(() => {
  'use strict';
  const G = window.__GESTURES_GUARD__;

  const STORE_KEY = 'vmug_cfg';
  const DEFAULTS = {
    dblAct: 'open',                 // 'open' | 'close'
    dbl:    { enabled: true,  mode: 'bg' },
    lpress: { enabled: true,  mode: 'bg' }, // bật sẵn long-press
    rclick: { enabled: false, mode: 'bg' },
    dblMs:  280,
    tapTol: 24,
    longMs: 500
  };

  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  function migrateCfg(cfg) {
    const out = deepClone(DEFAULTS);
    for (const k of Object.keys(cfg || {})) {
      if (k in out && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
        Object.assign(out[k], cfg[k]);
      } else if (k in out) {
        out[k] = cfg[k];
      } else {
        if (k === 'dbl.mode') out.dbl.mode = cfg[k];
        if (k === 'lpress.mode') out.lpress.mode = cfg[k];
        if (k === 'rclick.mode') out.rclick.mode = cfg[k];
      }
    }
    return out;
  }

  function loadCfg() {
    try {
      const raw = GM_getValue(STORE_KEY, '');
      if (!raw) return deepClone(DEFAULTS);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return migrateCfg(parsed);
    } catch {
      return deepClone(DEFAULTS);
    }
  }

  function saveCfg() {
    try { GM_setValue(STORE_KEY, CFG); } catch {}
  }

  function getPath(path, obj = CFG) { return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj); }
  function setPath(path, val, obj = CFG) {
    const parts = path.split('.'); let o = obj;
    for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
    o[parts[parts.length - 1]] = val;
  }

  let CFG = loadCfg();

  // ===== Settings Panel =====
  GM_registerMenuCommand('🖱️ Gestures • Settings…', openSettingsPanel);
  GM_registerMenuCommand('🖱️ Gestures • Reset defaults', () => {
    CFG = deepClone(DEFAULTS);
    saveCfg();
    alert('Defaults restored.');
  });

  GM_addStyle(`
    .vmug-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483646;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(1px)}
    .vmug-panel{width:min(560px,92vw);max-height:90vh;overflow:auto;background:#1e1e1e;color:#eee;border:1px solid #333;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
    .vmug-title{margin:0 0 10px;font-size:18px}
    .vmug-card{border:1px solid #333;border-radius:10px;background:#121212;padding:12px;margin-bottom:10px}
    .vmug-row{display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center}
    .vmug-check{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #3a3a3a;border-radius:8px;cursor:pointer;user-select:none}
    .vmug-check.active{border-color:#60a5fa;background:#1f2937}
    .vmug-modes{display:flex;gap:8px;flex-wrap:wrap}
    .vmug-mode{padding:6px 10px;border:1px solid #3a3a3a;border-radius:8px;cursor:pointer;user-select:none}
    .vmug-mode.selected{border-color:#2563eb;background:#1e3a8a}
    .vmug-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
    .vmug-btn{border:1px solid #3a3a3a;background:#2a2a2a;color:#eee;padding:8px 12px;border-radius:10px;cursor:pointer}
    .vmug-btn.primary{background:#2563eb;border-color:#2563eb}
    .vmug-note{color:#aaa;font-size:12px;margin-top:6px}
    @media (prefers-color-scheme: light){
      .vmug-panel{background:#fff;color:#222;border-color:#ddd}
      .vmug-card{background:#fafafa;border-color:#e5e5e5}
      .vmug-check{border-color:#ddd}
      .vmug-mode{border-color:#ddd}
      .vmug-btn{background:#f3f3f3;color:#222;border-color:#ddd}
      .vmug-btn.primary{color:#fff}
    }
  `);

  function openSettingsPanel() {
    const back = document.createElement('div');
    back.className = 'vmug-backdrop';
    back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

    const panel = document.createElement('div');
    panel.className = 'vmug-panel';
    panel.innerHTML = `
      <h2 class="vmug-title">⚙️ Open / Close by gestures</h2>

      <div class="vmug-card">
        <div class="vmug-row">
          <div class="vmug-check ${CFG.dbl.enabled ? 'active' : ''}" id="vmug-dbl-on" role="checkbox" aria-checked="${CFG.dbl.enabled}">
            <span class="tick">${CFG.dbl.enabled ? '✓' : ''}</span>
            Double-tap / Double left mouse
          </div>
          <div class="vmug-modes">
            <div id="vmug-dbl-act-open"  class="vmug-mode ${CFG.dblAct==='open'  ? 'selected' : ''}">${CFG.dblAct==='open'  ? '✓ ' : ''}Open link</div>
            <div id="vmug-dbl-act-close" class="vmug-mode ${CFG.dblAct==='close' ? 'selected' : ''}">${CFG.dblAct==='close' ? '✓ ' : ''}Close tab</div>
          </div>
        </div>
        <div class="vmug-row vmug-dbl-open-opts" style="margin-top:8px; ${CFG.dblAct==='open' ? '' : 'display:none'}">
          <div style="opacity:.9">Open mode</div>
          <div class="vmug-modes">
            <div id="vmug-dbl-bg" class="vmug-mode ${CFG.dbl.mode==='bg' ? 'selected' : ''}">${CFG.dbl.mode==='bg' ? '✓ ' : ''}BG</div>
            <div id="vmug-dbl-fg" class="vmug-mode ${CFG.dbl.mode==='fg' ? 'selected' : ''}">${CFG.dbl.mode==='fg' ? '✓ ' : ''}FG</div>
          </div>
        </div>
      </div>

      <div class="vmug-card">
        <div class="vmug-row">
          <div class="vmug-check ${CFG.lpress.enabled ? 'active' : ''}" id="vmug-lp-on" role="checkbox" aria-checked="${CFG.lpress.enabled}">
            <span class="tick">${CFG.lpress.enabled ? '✓' : ''}</span>
            Long-press
          </div>
          <div class="vmug-modes">
            <div id="vmug-lp-bg" class="vmug-mode ${CFG.lpress.mode==='bg' ? 'selected' : ''}">${CFG.lpress.mode==='bg' ? '✓ ' : ''}BG</div>
            <div id="vmug-lp-fg" class="vmug-mode ${CFG.lpress.mode==='fg' ? 'selected' : ''}">${CFG.lpress.mode==='fg' ? '✓ ' : ''}FG</div>
          </div>
        </div>
      </div>

      <div class="vmug-card">
        <div class="vmug-row">
          <div class="vmug-check ${CFG.rclick.enabled ? 'active' : ''}" id="vmug-rc-on" role="checkbox" aria-checked="${CFG.rclick.enabled}">
            <span class="tick">${CFG.rclick.enabled ? '✓' : ''}</span>
            Right-click
          </div>
          <div class="vmug-modes">
            <div id="vmug-rc-bg" class="vmug-mode ${CFG.rclick.mode==='bg' ? 'selected' : ''}">${CFG.rclick.mode==='bg' ? '✓ ' : ''}BG</div>
            <div id="vmug-rc-fg" class="vmug-mode ${CFG.rclick.mode==='fg' ? 'selected' : ''}">${CFG.rclick.mode==='fg' ? '✓ ' : ''}FG</div>
          </div>
        </div>
      </div>

      <div class="vmug-actions">
        <button class="vmug-btn" id="vmug-reset">Reset</button>
        <button class="vmug-btn primary" id="vmug-save">Save</button>
        <button class="vmug-btn" id="vmug-close">Close</button>
      </div>
      <div class="vmug-note">
        Tips: GM_openInTab dùng <code>insert:true</code> mở tab kề phải. Click sau long-press sẽ bị chặn để không mở thêm.
      </div>
    `;
    back.appendChild(panel);
    document.documentElement.appendChild(back);

    const toggler = (id, key) => {
      const node = panel.querySelector(id);
      node.addEventListener('click', () => {
        const on = !node.classList.contains('active');
        CFG[key].enabled = on;
        node.classList.toggle('active', on);
        node.setAttribute('aria-checked', String(on));
        const tick = node.querySelector('.tick');
        if (tick) tick.textContent = on ? '✓' : '';
      });
    };
    toggler('#vmug-dbl-on', 'dbl');
    toggler('#vmug-lp-on',  'lpress');
    toggler('#vmug-rc-on',  'rclick');

    function makePair(pathOrKey, selA, selB, values) {
      const a = panel.querySelector(selA);
      const b = panel.querySelector(selB);
      const setSel = (val) => {
        if (pathOrKey.includes('.')) setPath(pathOrKey, val);
        else CFG[pathOrKey] = val;
        [a,b].forEach(n => { n.classList.remove('selected'); n.textContent = n.textContent.replace(/^✓\s?/, ''); });
        const node = (val === values[0]) ? a : b;
        node.classList.add('selected');
        node.textContent = '✓ ' + node.textContent.replace(/^✓\s?/, '');
      };
      a.addEventListener('click', () => { setSel(values[0]); updateOpenOpts(); });
      b.addEventListener('click', () => { setSel(values[1]); updateOpenOpts(); });
      return setSel;
    }
    makePair('dblAct',     '#vmug-dbl-act-open', '#vmug-dbl-act-close', ['open','close']);
    makePair('dbl.mode',   '#vmug-dbl-bg', '#vmug-dbl-fg', ['bg','fg']);
    makePair('lpress.mode','#vmug-lp-bg',  '#vmug-lp-fg',  ['bg','fg']);
    makePair('rclick.mode','#vmug-rc-bg',  '#vmug-rc-fg',  ['bg','fg']);

    function updateOpenOpts(){
      const row = panel.querySelector('.vmug-dbl-open-opts');
      if (row) row.style.display = (CFG.dblAct === 'open') ? '' : 'none';
    }
    updateOpenOpts();

    panel.querySelector('#vmug-close').addEventListener('click', () => back.remove());
    panel.querySelector('#vmug-reset').addEventListener('click', () => {
      CFG = deepClone(DEFAULTS);
      saveCfg();
      back.remove();
      openSettingsPanel();
    });
    panel.querySelector('#vmug-save').addEventListener('click', () => {
      saveCfg();
      back.remove();
      alert('Saved.');
    });
  }

  // ===== Helpers =====
  function getAnchorFromEvent(ev) {
    const path = (ev.composedPath && ev.composedPath()) || [];
    for (const n of path) {
      if (n && n.nodeType === 1 && n.nodeName === 'A' && n.hasAttribute && n.hasAttribute('href')) return n;
    }
    const t = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    return t || null;
  }
  function validLink(a) {
    if (!a) return false;
    const h = (a.getAttribute('href') || '').trim().toLowerCase();
    return h && !(h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:'));
  }
  function inEditable(el) { return !!(el && el.closest && el.closest('input,textarea,select,button,[contenteditable],[contenteditable="true"]')); }
  function hasSelection() { const s = window.getSelection && window.getSelection(); return !!(s && s.type === 'Range' && String(s).length > 0); }
  function openByMode(url, mode, key='vmug-open') {
    if (!G.canOpen(key+':'+url)) return;
    const active = (mode === 'fg');
    try { GM_openInTab(url, { active, insert: true, setParent: true }); }
    catch { const w = window.open(url, '_blank', 'noopener'); if (w && !active) { try { w.blur(); window.focus(); } catch {} } }
    G.suppress(900);
  }
  function closeTabSafe() {
    try { window.close(); } catch {}
    try { window.open('', '_self'); window.close(); } catch {}
    try { if (history.length > 1) history.back(); } catch {}
  }

  // ===== Gestures =====

  // Long-press → open new tab, block synthetic click on release
  let lpDownX=0, lpDownY=0, lpAnchor=null, lpMoved=false, lpTimer=null, lpFired=false;

  addEventListener('pointerdown', (ev) => {
    if (!CFG.lpress.enabled) return;
    if (inEditable(ev.target) || hasSelection()) return;
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;

    lpDownX = ev.clientX; lpDownY = ev.clientY;
    lpAnchor = a; lpMoved = false; lpFired = false;

    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      if (!lpAnchor || lpMoved) return;
      lpFired = true;
      openByMode(lpAnchor.href, getPath('lpress.mode'), 'vmug-lp');
    }, CFG.longMs);
  }, true);

  addEventListener('pointermove', (ev) => {
    if (!lpAnchor) return;
    const dx=Math.abs(ev.clientX-lpDownX), dy=Math.abs(ev.clientY-lpDownY);
    if (dx > CFG.tapTol || dy > CFG.tapTol) { lpMoved = true; clearTimeout(lpTimer); lpTimer=null; }
  }, true);

  function endLP(ev){
    if (lpTimer){ clearTimeout(lpTimer); lpTimer=null; }
    if (lpFired){ ev.preventDefault?.(); ev.stopImmediatePropagation?.(); ev.stopPropagation?.(); }
    lpAnchor=null; lpFired=false;
  }
  addEventListener('pointerup', endLP, {capture:true, passive:false});
  addEventListener('pointercancel', endLP, {capture:true, passive:false});

  // Double-tap / Double-click
  let lastTapT = 0, lastTapX = 0, lastTapY = 0, singleTimer = null, pendingUrl = null;

  addEventListener('click', (ev) => {
    if (!CFG.dbl.enabled) return;

    // Bị khóa bởi guard toàn cục → nuốt và thoát
    if (Date.now() <= G.killUntil) { ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation(); return; }

    const now = Date.now();
    const x = ev.clientX, y = ev.clientY;
    const closeTime = (now - lastTapT) <= CFG.dblMs;
    const closeSpace = Math.hypot(x - lastTapX, y - lastTapY) <= CFG.tapTol;

    // Mode: double = CLOSE TAB
    if (CFG.dblAct === 'close') {
      if (inEditable(ev.target)) return;
      if (closeTime && closeSpace) {
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
        lastTapT = 0; closeTabSafe();
        return;
      }
      lastTapT = now; lastTapX = x; lastTapY = y;
      return;
    }

    // Mode: double = OPEN LINK
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;
    if (inEditable(ev.target) || hasSelection()) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

    const url = a.href;
    if (closeTime && closeSpace) {
      if (singleTimer) { clearTimeout(singleTimer); singleTimer = null; pendingUrl = null; }
      lastTapT = 0; openByMode(url, getPath('dbl.mode'), 'vmug-dbl');
      return;
    }

    lastTapT = now; lastTapX = x; lastTapY = y; pendingUrl = url;
    if (singleTimer) clearTimeout(singleTimer);
    singleTimer = setTimeout(() => {
      if (Date.now() <= G.killUntil) { pendingUrl=null; singleTimer=null; lastTapT=0; return; }
      if (pendingUrl) window.location.assign(pendingUrl);
      pendingUrl=null; singleTimer=null; lastTapT=0;
    }, CFG.dblMs);
  }, true);

  // Right-click → mở tab mới
  addEventListener('contextmenu', (ev) => {
    if (!CFG.rclick.enabled) return;
    if (Date.now() <= G.killUntil) { ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation(); return; }
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    openByMode(a.href, getPath('rclick.mode'), 'vmug-rc');
  }, true);

})();
