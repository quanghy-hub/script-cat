// ==UserScript==
// @name         Gestures
// @namespace    https://github.com/yourname/vm-unified-gestures-open-tab
// @version      1.1.0
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/gestures.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/gestures.js
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        window.close
// @license      MIT
// ==/UserScript==

/* ===== GLOBAL GUARD ===== */
(() => {
  'use strict';
  const G = (window.__GESTURES_GUARD__ ||= {
    killUntil: 0,
    suppress(ms = 800) { this.killUntil = Date.now() + ms; }
  });
  if (!window.__GESTURES_GUARD_LISTENERS__) {
    window.__GESTURES_GUARD_LISTENERS__ = true;
    const eat = (ev) => {
      if (Date.now() <= G.killUntil) {
        ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
      }
    };
    addEventListener('click', eat, true);
    addEventListener('auxclick', eat, true);
    addEventListener('contextmenu', eat, true); // chặn menu/phát sinh mở tab phụ sau long-press
  }
})();

/* ===== Unified Gestures ===== */
(() => {
  'use strict';
  const G = window.__GESTURES_GUARD__;

  const STORE_KEY = 'vmug_cfg_min_v116';
  const DEFAULTS = {
    lpress: { enabled: true,  mode: 'bg', longMs: 500, tapTol: 24 }, // long-press chỉ áp dụng chuột trái + touch
    rclick: { enabled: true,  mode: 'bg' },                           // right-click mở tab mới
    dblMs: 280
  };

  const deepClone = (o) => JSON.parse(JSON.stringify(o));
  const loadCfg = () => {
    try {
      const raw = GM_getValue(STORE_KEY, '');
      if (!raw) return deepClone(DEFAULTS);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Object.assign(deepClone(DEFAULTS), parsed);
    } catch { return deepClone(DEFAULTS); }
  };
  const saveCfg = () => { try { GM_setValue(STORE_KEY, CFG); } catch {} };
  let CFG = loadCfg();

  // dùng chung để chặn mở menu phải sau thao tác đặc biệt
  let blockNextContextmenuUntil = 0;

  // Menu nhanh
  GM_registerMenuCommand?.(`⚙️ Long-press: ${CFG.lpress.enabled ? 'On' : 'Off'} • ${CFG.lpress.mode.toUpperCase()}`, () => {
    const on = confirm('Bật long-press mở link? OK=On, Cancel=Off');
    CFG.lpress.enabled = on;
    if (on) {
      const mode = prompt('Mode BG/FG?', CFG.lpress.mode).toLowerCase().startsWith('f') ? 'fg' : 'bg';
      CFG.lpress.mode = mode;
      const ms = Number(prompt('Thời gian giữ (ms ≥ 300):', String(CFG.lpress.longMs)));
      if (Number.isFinite(ms) && ms >= 300) CFG.lpress.longMs = ms;
    }
    saveCfg(); alert('Saved.');
  });
  GM_registerMenuCommand?.(`🖱️ Right-click open: ${CFG.rclick.enabled ? 'On' : 'Off'} • ${CFG.rclick.mode.toUpperCase()}`, () => {
    const on = confirm('Bật right-click mở tab mới? OK=On, Cancel=Off');
    CFG.rclick.enabled = on;
    if (on) {
      const mode = prompt('Mode BG/FG?', CFG.rclick.mode).toLowerCase().startsWith('f') ? 'fg' : 'bg';
      CFG.rclick.mode = mode;
    }
    saveCfg(); alert('Saved.');
  });

  // Helpers
  const inEditable = (el) => !!(el && el.closest && el.closest('input,textarea,select,button,[contenteditable]'));
  const hasSelection = () => {
    const s = window.getSelection && window.getSelection();
    return !!(s && s.type === 'Range' && String(s).length > 0);
  };
  const getAnchorFromEvent = (ev) => {
    const path = (ev.composedPath && ev.composedPath()) || [];
    for (const n of path) if (n?.nodeType === 1 && n.nodeName === 'A' && n.hasAttribute?.('href')) return n;
    return ev.target?.closest?.('a[href]') || null;
  };
  const validLink = (a) => {
    if (!a) return false;
    const h = (a.getAttribute('href') || '').trim().toLowerCase();
    return h && !(h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:'));
  };
  function openByMode(url, mode) {
    const active = (mode === 'fg');
    try { GM_openInTab(url, { active, insert: true, setParent: true }); }
    catch { const w = window.open(url, '_blank', 'noopener'); if (w && !active) { try { w.blur(); window.focus(); } catch {} } }
    G.suppress(900);
  }
  function closeTabSafe() {
    try { window.close(); } catch {}
    try { window.open('', '_self'); window.close(); } catch {}
    try { if (history.length > 1) history.back(); } catch {}
    G.suppress(600);
    blockNextContextmenuUntil = Date.now() + 600;
  }

  /* Long-press mở LINK – chỉ chuột trái hoặc touch */
  let lpDownX=0, lpDownY=0, lpAnchor=null, lpMoved=false, lpTimer=null, lpFired=false;

  addEventListener('pointerdown', (ev) => {
    if (!CFG.lpress.enabled) return;
    if (inEditable(ev.target) || hasSelection()) return;

    // Chỉ nhận long-press với chuột trái; vẫn nhận touch/pen
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;

    lpDownX = ev.clientX; lpDownY = ev.clientY;
    lpAnchor = a; lpMoved = false; lpFired = false;

    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      if (!lpAnchor || lpMoved) return;
      lpFired = true;
      openByMode(lpAnchor.href, CFG.lpress.mode);
      // chặn mọi contextmenu/click phát sinh cho đến khi nhả
      G.suppress(2_000);
      blockNextContextmenuUntil = Date.now() + 2_000;
    }, CFG.lpress.longMs);
  }, true);

  addEventListener('pointermove', (ev) => {
    if (!lpAnchor) return;
    const dx=Math.abs(ev.clientX-lpDownX), dy=Math.abs(ev.clientY-lpDownY);
    if (dx > CFG.lpress.tapTol || dy > CFG.lpress.tapTol) { lpMoved = true; clearTimeout(lpTimer); lpTimer=null; }
  }, true);

  function endLP(ev){
    if (lpTimer){ clearTimeout(lpTimer); lpTimer=null; }
    if (lpFired){
      // Ngăn click/auxclick/contextmenu sau khi nhả, dù giữ lâu hơn thời gian guard trước đó
      ev.preventDefault?.(); ev.stopImmediatePropagation?.(); ev.stopPropagation?.();
      G.suppress(1_200);
      blockNextContextmenuUntil = Date.now() + 1_200;
    }
    lpAnchor=null; lpFired=false;
  }
  addEventListener('pointerup', endLP, {capture:true, passive:false});
  addEventListener('pointercancel', endLP, {capture:true, passive:false});

  /* Chặn site bắt sự kiện mousedown chuột phải trên link gây điều hướng tab hiện tại */
  addEventListener('mousedown', (ev) => {
    if (ev.button !== 2) return;
    if (!CFG.rclick.enabled) return;
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;
    // Ngăn lib của trang điều hướng theo mousedown
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
  }, true);

  /* Double RIGHT click → CLOSE TAB */
  let lastRTime = 0, lastRX = 0, lastRY = 0;
  addEventListener('mousedown', (ev) => {
    if (ev.button !== 2) return;
    if (inEditable(ev.target)) return;
    const now = Date.now();
    const closeTime = (now - lastRTime) <= CFG.dblMs;
    const closeSpace = Math.hypot(ev.clientX - lastRX, ev.clientY - lastRY) <= CFG.lpress.tapTol;

    if (closeTime && closeSpace) {
      ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
      blockNextContextmenuUntil = now + 600;
      lastRTime = 0;
      closeTabSafe();
      return;
    }
    lastRTime = now; lastRX = ev.clientX; lastRY = ev.clientY;
  }, true);

  /* Right-click (contextmenu) → OPEN NEW TAB */
  addEventListener('contextmenu', (ev) => {
    if (!CFG.rclick.enabled) return;
    if (Date.now() <= blockNextContextmenuUntil) {
      ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
      return;
    }
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return; // để menu mặc định
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
    openByMode(a.href, CFG.rclick.mode);
    // chặn phát sinh thêm
    blockNextContextmenuUntil = Date.now() + 600;
  }, true);

  /* Double TAP (touch) → CLOSE TAB */
  let lastTouchT = 0, lastTX = 0, lastTY = 0;
  addEventListener('touchstart', (ev) => {
    if (inEditable(ev.target)) return;
    const t = ev.touches?.[0]; if (!t) return;
    const now = Date.now();
    const closeTime = (now - lastTouchT) <= CFG.dblMs + 70;
    const closeSpace = Math.hypot(t.clientX - lastTX, t.clientY - lastTY) <= CFG.lpress.tapTol;

    if (closeTime && closeSpace) {
      ev.preventDefault(); ev.stopPropagation();
      lastTouchT = 0;
      closeTabSafe();
      return;
    }
    lastTouchT = now; lastTX = t.clientX; lastTY = t.clientY;
  }, { capture:true, passive:false });

})();
