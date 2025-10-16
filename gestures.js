// ==UserScript==
// @name         Gestures — triple tap & double RC to close
// @namespace    https://github.com/yourname/vm-unified-gestures-open-tab
// @version      1.6.3
// @description  Long-press mở link; right-click mở tab; DOUBLE right-click đóng tab; TRIPLE tap (touch) đóng tab.
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
        ev.preventDefault(); ev.stopPropagation();
      }
    };
    addEventListener('click', eat, true);
    addEventListener('auxclick', eat, true);
    addEventListener('contextmenu', eat, true);
  }
})();

/* ===== Unified Gestures ===== */
(() => {
  'use strict';
  const G = window.__GESTURES_GUARD__;

  const STORE_KEY = 'vmug_cfg_v162';
  const DEFAULTS = {
    lpress: { enabled: true,  mode: 'bg', longMs: 500, tapTol: 24 }, // px
    rclick: { enabled: true,  mode: 'bg' },
    dblRightMs: 260,   // double right-click window
    triTapMs: 330      // triple tap window (first → third)
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
  const saveCfg = () => { try { GM_setValue(STORE_KEY, JSON.stringify(CFG)); } catch {} };
  let CFG = loadCfg();

  // ===== Menu =====
  GM_registerMenuCommand?.(`⚙️ Long-press: ${CFG.lpress.enabled ? 'On' : 'Off'} • ${CFG.lpress.mode.toUpperCase()}`, () => {
    const on = confirm('Bật long-press mở link? OK=On, Cancel=Off');
    CFG.lpress.enabled = on;
    if (on) {
      const mode = prompt('Mode BG/FG?', CFG.lpress.mode || 'bg');
      CFG.lpress.mode = (mode || 'bg').toLowerCase().startsWith('f') ? 'fg' : 'bg';
      const ms = Number(prompt('Thời gian giữ (ms ≥ 300):', String(CFG.lpress.longMs)));
      if (Number.isFinite(ms) && ms >= 300) CFG.lpress.longMs = ms;
    }
    saveCfg(); alert('Saved.');
  });

  GM_registerMenuCommand?.(`🖱️ Double right-click (ms): ${CFG.dblRightMs}`, () => {
    const v = Number(prompt('Khoảng thời gian double right-click (ms):', String(CFG.dblRightMs)));
    if (Number.isFinite(v) && v >= 160 && v <= 600) { CFG.dblRightMs = v; saveCfg(); alert('Saved.'); }
  });

  GM_registerMenuCommand?.(`👆 Triple tap (ms): ${CFG.triTapMs}`, () => {
    const v = Number(prompt('Khoảng thời gian triple tap (ms):', String(CFG.triTapMs)));
    if (Number.isFinite(v) && v >= 150 && v <= 1200) { CFG.triTapMs = v; saveCfg(); alert('Saved.'); }
  });

  GM_registerMenuCommand?.(`🎯 Tap tolerance (px): ${CFG.lpress.tapTol}`, () => {
    const v = Number(prompt('Dung sai vị trí (px):', String(CFG.lpress.tapTol)));
    if (Number.isFinite(v) && v >= 8 && v <= 64) { CFG.lpress.tapTol = v; saveCfg(); alert('Saved.'); }
  });

  // ===== Helpers =====
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

  // ===== State =====
  let blockNextContextmenuUntil = 0;
  let lastPointerType = 'mouse';
  let lpFiredAt = 0;

  addEventListener('pointerdown', (ev) => { lastPointerType = ev.pointerType || 'mouse'; }, true);

  /* ===== Long-press mở LINK – mouse left + touch ===== */
  let lpDownX=0, lpDownY=0, lpAnchor=null, lpMoved=false, lpTimer=null, lpFired=false;

  addEventListener('pointerdown', (ev) => {
    if (!CFG.lpress.enabled) return;
    if (inEditable(ev.target) || hasSelection()) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;

    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;

    lpDownX = ev.clientX; lpDownY = ev.clientY;
    lpAnchor = a; lpMoved = false; lpFired = false;

    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      if (!lpAnchor || lpMoved) return;
      lpFired = true;
      lpFiredAt = Date.now();
      openByMode(lpAnchor.href, CFG.lpress.mode);
      G.suppress(2000);
      blockNextContextmenuUntil = Date.now() + 2000;
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
      ev.preventDefault?.(); ev.stopPropagation?.();
      G.suppress(1200);
      blockNextContextmenuUntil = Date.now() + 1200;
    }
    lpAnchor=null; lpFired=false;
  }
  addEventListener('pointerup', endLP, {capture:true, passive:false});
  addEventListener('pointercancel', endLP, {capture:true, passive:false});

  /* ===== Chặn mousedown phải điều hướng tab hiện tại ===== */
  addEventListener('mousedown', (ev) => {
    if (ev.button !== 2) return;
    if (!CFG.rclick.enabled) return;
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;
    ev.preventDefault(); ev.stopPropagation();
  }, true);

  /* ===== DOUBLE RIGHT click → CLOSE TAB ===== */
  let lastRTime = 0, lastRX = 0, lastRY = 0;
  addEventListener('mousedown', (ev) => {
    if (ev.button !== 2) return;
    if (inEditable(ev.target)) return;

    const now = Date.now();
    const closeTime = (now - lastRTime) <= CFG.dblRightMs;
    const closeSpace = Math.hypot(ev.clientX - lastRX, ev.clientY - lastRY) <= CFG.lpress.tapTol;

    if (closeTime && closeSpace) {
      ev.preventDefault(); ev.stopPropagation();
      blockNextContextmenuUntil = now + 600;
      lastRTime = 0;
      closeTabSafe();
      return;
    }
    lastRTime = now; lastRX = ev.clientX; lastRY = ev.clientY;
  }, true);

  /* ===== Right-click (contextmenu) → OPEN NEW TAB ===== */
  addEventListener('contextmenu', (ev) => {
    if (!CFG.rclick.enabled) return;

    const now = Date.now();
    if (now - lpFiredAt <= 800) { ev.preventDefault(); ev.stopPropagation(); return; }
    if (now <= blockNextContextmenuUntil) { ev.preventDefault(); ev.stopPropagation(); return; }
    if (lastPointerType !== 'mouse') { ev.preventDefault(); ev.stopPropagation(); return; }

    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return; // để menu mặc định nếu không phải link
    ev.preventDefault(); ev.stopPropagation();
    openByMode(a.href, CFG.rclick.mode);
    blockNextContextmenuUntil = now + 600;
  }, true);

  /* ===== TRIPLE TAP (touch) → CLOSE TAB =====
     Bỏ toàn bộ multi-touch window/guard. Chỉ cần 3 lần chạm trong triTapMs,
     cùng một vùng (dung sai = tapTol). */
  let taps = []; // [{t,x,y}]
  addEventListener('touchstart', (ev) => {
    if (inEditable(ev.target)) return;
    if (ev.touches.length > 1) return; // bỏ qua đa ngón theo yêu cầu đơn giản hoá

    const now = Date.now();
    const t0 = ev.touches?.[0]; if (!t0) return;

    // loại tap cũ ngoài cửa sổ triTapMs tính từ TAP ĐẦU
    if (taps.length) {
      const firstT = taps[0].t;
      if ((now - firstT) > CFG.triTapMs) taps = [];
    }

    // reset nếu lệch vị trí so với tap đầu quá tapTol
    if (taps.length) {
      const d0 = Math.hypot(t0.clientX - taps[0].x, t0.clientY - taps[0].y);
      if (d0 > CFG.lpress.tapTol) taps = [];
    }

    taps.push({ t: now, x: t0.clientX, y: t0.clientY });

    if (taps.length >= 3) {
      ev.preventDefault(); ev.stopPropagation();
      taps = [];
      closeTabSafe();
    }
  }, { capture:true, passive:false });

})();
