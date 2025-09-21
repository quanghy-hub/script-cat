// ==UserScript==
// @name         Gestures (Mobile-safe, tunable timings)
// @namespace    https://github.com/yourname/vm-unified-gestures-open-tab
// @version      1.3.0
// @description  Long-press mở link; right-click mở tab; double right-click đóng; double tap đóng tab. Cài đặt thời gian trong menu. Chống long-press mở 2 tab.
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
    addEventListener('contextmenu', eat, true);
  }
})();

/* ===== Unified Gestures ===== */
(() => {
  'use strict';
  const G = window.__GESTURES_GUARD__;

  const STORE_KEY = 'vmug_cfg_min_v130';
  const DEFAULTS = {
    lpress: { enabled: true,  mode: 'bg', longMs: 500, tapTol: 24 }, // px
    rclick: { enabled: true,  mode: 'bg' },
    dblMs: 250,         // double-tap 1 ngón (90–120 Hz: ~230–260)
    mtWindowMs: 100,    // cửa sổ “đồng thời” đa ngón
    mtGuardMs: 450      // khóa đóng sau khi nghi đa ngón
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

  // ===== Quick Menu: bật/tắt và chỉnh thời gian =====
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

  GM_registerMenuCommand?.(`🕒 Double-tap (ms): ${CFG.dblMs}`, () => {
    const v = Number(prompt('Khoảng double-tap 1 ngón (ms):', String(CFG.dblMs)));
    if (Number.isFinite(v) && v >= 160 && v <= 400) { CFG.dblMs = v; saveCfg(); alert('Saved.'); }
  });

  GM_registerMenuCommand?.(`🖐️ Multi-touch window (ms): ${CFG.mtWindowMs}`, () => {
    const v = Number(prompt('Cửa sổ “đồng thời” đa ngón (ms):', String(CFG.mtWindowMs)));
    if (Number.isFinite(v) && v >= 60 && v <= 200) { CFG.mtWindowMs = v; saveCfg(); alert('Saved.'); }
  });

  GM_registerMenuCommand?.(`🔒 Multi-touch guard (ms): ${CFG.mtGuardMs}`, () => {
    const v = Number(prompt('Khóa sau khi nghi đa ngón (ms):', String(CFG.mtGuardMs)));
    if (Number.isFinite(v) && v >= 300 && v <= 800) { CFG.mtGuardMs = v; saveCfg(); alert('Saved.'); }
  });

  GM_registerMenuCommand?.(`🎯 Tap tolerance (px): ${CFG.lpress.tapTol}`, () => {
    const v = Number(prompt('Dung sai vị trí (px):', String(CFG.lpress.tapTol)));
    if (Number.isFinite(v) && v >= 8 && v <= 48) { CFG.lpress.tapTol = v; saveCfg(); alert('Saved.'); }
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

  // ===== State để chống “2 tab” do long-press → contextmenu =====
  let blockNextContextmenuUntil = 0;
  let lastPointerType = 'mouse';
  let lpFiredAt = 0; // mốc mở tab bằng long-press

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
      // khóa mọi contextmenu sau đó để không mở lần 2
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
      ev.preventDefault?.(); ev.stopImmediatePropagation?.(); ev.stopPropagation?.();
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
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
  }, true);

  /* ===== Double RIGHT click → CLOSE TAB ===== */
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

  /* ===== Right-click (contextmenu) → OPEN NEW TAB =====
     Chỉ mở khi nguồn là chuột. Nếu là touch (long-press) hoặc vừa long-press xong → KHÔNG mở. */
  addEventListener('contextmenu', (ev) => {
    if (!CFG.rclick.enabled) return;

    const now = Date.now();
    // 1) Nếu vừa long-press mở tab trong 800 ms → chặn tuyệt đối
    if (now - lpFiredAt <= 800) {
      ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
      return;
    }
    // 2) Guard chung
    if (now <= blockNextContextmenuUntil) {
      ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
      return;
    }
    // 3) Chỉ xử lý nếu nguồn là chuột
    if (lastPointerType !== 'mouse') {
      ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
      return;
    }
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return; // cho menu mặc định nếu không phải link
    ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
    openByMode(a.href, CFG.rclick.mode);
    blockNextContextmenuUntil = now + 600;
  }, true);

  /* ===== Double TAP (touch) → CLOSE TAB, guard đa-ngón ===== */
  let lastTouchT = 0, lastTX = 0, lastTY = 0;
  let mtLastFirstT = 0, mtLastFirstX = 0, mtLastFirstY = 0;
  let multiTouchGuardUntil = 0;

  addEventListener('touchstart', (ev) => {
    if (inEditable(ev.target)) return;

    const now = Date.now();
    const t = ev.touches?.[0]; if (!t) return;

    if (now <= multiTouchGuardUntil) return;

    if (ev.touches.length >= 2) {
      multiTouchGuardUntil = now + CFG.mtGuardMs;
      return;
    }

    if ((now - mtLastFirstT) <= CFG.mtWindowMs) {
      const d = Math.hypot(t.clientX - mtLastFirstX, t.clientY - mtLastFirstY);
      if (d > CFG.lpress.tapTol) {
        multiTouchGuardUntil = now + CFG.mtGuardMs;
        return;
      }
    }

    mtLastFirstT = now; mtLastFirstX = t.clientX; mtLastFirstY = t.clientY;

    const closeTimeOk = (now - lastTouchT) <= CFG.dblMs;
    const closeSpace = Math.hypot(t.clientX - lastTX, t.clientY - lastTY) <= CFG.lpress.tapTol;

    if (closeTimeOk && closeSpace && now > multiTouchGuardUntil) {
      ev.preventDefault(); ev.stopPropagation();
      lastTouchT = 0;
      closeTabSafe();
      return;
    }

    lastTouchT = now; lastTX = t.clientX; lastTY = t.clientY;
  }, { capture:true, passive:false });

})();
