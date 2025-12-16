// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      1.6.1
// @description  FINAL: Swipe seek + keyboard seek with ONE unified notice, YouTube fullscreen-safe (no clipping), smooth fade, smart fullscreen icon, audio boost. Polished & stable. (touch targets fixed)
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/* jshint esversion: 8 */
(function () {
  'use strict';

  /* ================= FINAL CONFIG ================= */
  const STORE = 'VF_FINAL_V1';
  const DEF = {
    swipeLong: 0.5,
    swipeShort: 0.2,
    shortThreshold: 300,
    forwardStep: 5,
    realtimePreview: true,
    throttle: 80,
    noticeFontSize: 16,
    hotkeys: true,
    boost: true,
    boostLevel: 1.0,
    maxBoost: 5,
    fsAutoHide: true,
    fsHideMs: 5000,
    fsBottomOffset: 16
  };

  const cfg = {};
  Object.keys(DEF).forEach(k => cfg[k] = GM_getValue(`${STORE}:${k}`, DEF[k]));
  const save = (k, v) => { cfg[k] = v; GM_setValue(`${STORE}:${k}`, v); };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ================= STYLE ================= */
  GM_addStyle(`
    .vf-fs-btn{
      position:absolute;right:14px;
      width:32px;height:32px;
      background:transparent;color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-size:22px;line-height:1;
      z-index:2147483647;cursor:pointer;user-select:none;
      opacity:0;transition:opacity .25s ease
    }
    .vf-fs-btn.show{opacity:1}

    .vf-notice{
      position:absolute;
      transform:translate(-50%,-50%) scale(.98);
      background:rgba(0,0,0,.6);color:#fff;
      padding:8px 14px;border-radius:6px;
      z-index:2147483647;pointer-events:none;
      white-space:nowrap;
      opacity:0;
      transition:opacity .18s ease, transform .18s ease
    }
    .vf-notice.show{
      opacity:1;
      transform:translate(-50%,-50%) scale(1);
    }
  `);

  /* ================= VIDEO FIND ================= */
  const getVideo = () => {
    const fs = document.fullscreenElement;
    if (fs) {
      if (fs.tagName === 'VIDEO') return fs;
      const v = fs.querySelector('video'); if (v) return v;
    }
    const vs = [...document.querySelectorAll('video')];
    return vs.find(v => v.offsetWidth && v.offsetHeight) || null;
  };

  // New helper: find video element at a (x,y) point (viewport coordinates).
  function videoFromPoint(x, y) {
    try {
      let el = document.elementFromPoint(x, y);
      // climb up to nearest <video> ancestor
      let iter = el;
      while (iter) {
        if (iter.tagName === 'VIDEO') return iter;
        iter = iter.parentElement;
      }
      // If none, try to find the topmost video whose bounding rect contains point (fallback)
      const vids = Array.from(document.querySelectorAll('video'));
      for (const v of vids) {
        const r = v.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          return v;
        }
      }
    } catch (e) { /* ignore */ }
    // final fallback to visible video
    return getVideo();
  }

  /* ================= UNIFIED SEEK NOTICE (FINAL) ================= */
  let noticeEl = null;
  let hideTimer = null;

  function showSeekNotice(video, deltaSec) {
    if (!video) return;

    const fsEl = document.fullscreenElement;
    const inFullscreen = fsEl && (fsEl === video || fsEl.contains(video));

    let container;
    if (inFullscreen) {
      container = fsEl;
      if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    } else {
      container = document.body;
    }

    if (!noticeEl || !container.contains(noticeEl)) {
      noticeEl && noticeEl.remove();
      noticeEl = document.createElement('div');
      noticeEl.className = 'vf-notice';
      noticeEl.style.fontSize = cfg.noticeFontSize + 'px';
      container.appendChild(noticeEl);
    }

    const rect = video.getBoundingClientRect();
    let cx, cy;
    if (inFullscreen) {
      const fr = fsEl.getBoundingClientRect();
      cx = rect.left - fr.left + rect.width / 2;
      cy = rect.top  - fr.top  + rect.height / 2;
      noticeEl.style.position = 'absolute';
    } else {
      cx = rect.left + rect.width / 2;
      cy = rect.top  + rect.height / 2;
      noticeEl.style.position = 'fixed';
    }

    // Clamp inside video bounds (polish)
    const pad = 12;
    cx = clamp(cx, rect.left + pad, rect.right - pad);
    cy = clamp(cy, rect.top + pad, rect.bottom - pad);

    noticeEl.textContent = (deltaSec >= 0 ? '>> ' : '<< ') + Math.abs(deltaSec) + 's';
    noticeEl.style.left = cx + 'px';
    noticeEl.style.top  = cy + 'px';

    noticeEl.classList.add('show');

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      noticeEl.classList.remove('show');
    }, 700);
  }

  /* ================= FULLSCREEN ICON ================= */
  function addFS(video) {
    if (!video || video.dataset.vfFs) return;
    const box = video.parentElement;
    if (!box) return;
    if (getComputedStyle(box).position === 'static') box.style.position = 'relative';

    const b = document.createElement('div');
    b.className = 'vf-fs-btn';
    b.textContent = '⛶';

    const place = () => b.style.bottom = cfg.fsBottomOffset + 'px';
    place();

    let hideT;
    const show = () => {
      b.classList.add('show');
      clearTimeout(hideT);
      if (cfg.fsAutoHide) hideT = setTimeout(() => b.classList.remove('show'), cfg.fsHideMs);
    };

    b.onclick = async (e) => {
      e.stopPropagation(); e.preventDefault();
      try {
        if (!document.fullscreenElement)
          await (video.requestFullscreen ? video.requestFullscreen() : box.requestFullscreen());
        else await document.exitFullscreen();
      } catch {}
    };

    box.addEventListener('touchstart', show, { passive: true });
    box.addEventListener('mousemove', show);

    box.appendChild(b);
    video.dataset.vfFs = '1';
  }

  const scanFS = () => document.querySelectorAll('video').forEach(addFS);
  scanFS();
  new MutationObserver(scanFS).observe(document.body, { childList: true, subtree: true });

  /* ================= AUDIO BOOST ================= */
  let actx; const boostMap = new WeakMap();
  const ctx = () => actx || (actx = new (window.AudioContext || window.webkitAudioContext)());
  function boost(video) {
    if (!cfg.boost || boostMap.has(video)) return;
    try {
      const c = ctx();
      const s = c.createMediaElementSource(video);
      const g = c.createGain();
      g.gain.value = clamp(cfg.boostLevel, 1, cfg.maxBoost);
      s.connect(g).connect(c.destination);
      boostMap.set(video, g);
    } catch {}
  }

  /* ================= KEYBOARD ================= */
  document.addEventListener('keydown', e => {
    if (!cfg.hotkeys) return;
    const v = getVideo(); if (!v) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if (e.key === 'ArrowRight') {
      v.currentTime += cfg.forwardStep;
      showSeekNotice(v, cfg.forwardStep);
    }
    if (e.key === 'ArrowLeft') {
      v.currentTime -= cfg.forwardStep;
      showSeekNotice(v, -cfg.forwardStep);
    }
    if (e.key.toLowerCase() === 'b') {
      cfg.boostLevel = cfg.boostLevel >= cfg.maxBoost ? 1 : cfg.boostLevel + 1;
      save('boostLevel', cfg.boostLevel);
      boost(v); boostMap.get(v).gain.value = cfg.boostLevel;
    }
  }, true);

  /* ================= TOUCH SWIPE (fixed to target video) ================= */
  let sx, sy, st, last = 0;
  document.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    // find video under touch point
    const v = videoFromPoint(t.clientX, t.clientY);
    if (!v) return;

    sx = t.clientX;
    sy = t.clientY;
    st = v.currentTime;

    // named handlers so we can remove them reliably
    function move(ev) {
      if (ev.touches.length === 0) return;
      const tx = ev.touches[0].clientX;
      const ty = ev.touches[0].clientY;
      const dx = tx - sx;
      const dy = ty - sy;

      // if vertical dominant, allow scroll (do nothing)
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;

      // horizontal swipe - prevent page scroll
      ev.preventDefault();

      const sens = v.duration <= cfg.shortThreshold ? cfg.swipeShort : cfg.swipeLong;
      const delta = Math.round(dx * sens);

      showSeekNotice(v, delta);

      if (cfg.realtimePreview) {
        const now = performance.now();
        if (now - last > cfg.throttle) {
          last = now;
          v.currentTime = clamp(st + delta, 0, v.duration || 1e9);
        }
      }
    }

    function end(ev) {
      // final apply if not realtime or to ensure final pos
      if (!cfg.realtimePreview && ev.changedTouches && ev.changedTouches[0]) {
        const tx = ev.changedTouches[0].clientX;
        const sens = v.duration <= cfg.shortThreshold ? cfg.swipeShort : cfg.swipeLong;
        const delta = Math.round((tx - sx) * sens);
        v.currentTime = clamp(st + delta, 0, v.duration || 1e9);
        showSeekNotice(v, delta);
      }
      document.removeEventListener('touchmove', move, { passive: false });
      document.removeEventListener('touchend', end, { once: true });
    }

    // attach listeners
    document.addEventListener('touchmove', move, { passive: false });
    document.addEventListener('touchend', end, { once: true });
  }, { passive: true });

})();
