// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      1.6.12
// @description  FIXED: Universal swipe seek (no 4–5s limit), YouTube mobile safe, pointer events, fullscreen-safe, unified notice
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ================= CONFIG ================= */
  const STORE = 'VF_FINAL_V1';
  const DEF = {
    swipeRatio: 0.8,        // % video duration per full-width swipe
    realtimePreview: true,
    throttle: 50,
    noticeFontSize: 16,
    hotkeys: true,
    forwardStep: 5
  };

  const cfg = {};
  Object.keys(DEF).forEach(k => cfg[k] = GM_getValue(`${STORE}:${k}`, DEF[k]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ================= STYLE ================= */
  GM_addStyle(`
    .vf-notice{
      position:absolute;
      transform:translate(-50%,-50%) scale(.98);
      background:rgba(0,0,0,.65);
      color:#fff;
      padding:8px 14px;
      border-radius:6px;
      z-index:2147483647;
      pointer-events:none;
      white-space:nowrap;
      opacity:0;
      transition:.18s ease
    }
    .vf-notice.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
  `);

  /* ================= HELPERS ================= */
  const fsEl = () =>
    document.fullscreenElement || document.webkitFullscreenElement;

  const getVideo = () => {
    const fs = fsEl();
    if (fs) return fs.tagName === 'VIDEO' ? fs : fs.querySelector('video');
    return [...document.querySelectorAll('video')]
      .find(v => v.offsetWidth && v.offsetHeight);
  };

  const videoFromPoint = (x, y) => {
    if (document.elementsFromPoint) {
      for (const el of document.elementsFromPoint(x, y)) {
        if (el.tagName === 'VIDEO') return el;
        const v = el.closest?.('video');
        if (v) return v;
      }
    }
    return getVideo();
  };

  /* ================= NOTICE ================= */
  let notice, hideT;
  function showNotice(video, delta) {
    if (!video) return;
    const fs = fsEl();
    const inFS = fs && fs.contains(video);

    if (!notice || !notice.parentNode) {
      notice = document.createElement('div');
      notice.className = 'vf-notice';
      notice.style.fontSize = cfg.noticeFontSize + 'px';
      (inFS ? fs : document.body).appendChild(notice);
    }

    const r = video.getBoundingClientRect();
    notice.style.left = r.left + r.width / 2 + 'px';
    notice.style.top  = r.top  + r.height / 2 + 'px';
    notice.style.position = inFS ? 'absolute' : 'fixed';
    notice.textContent = (delta > 0 ? '>> ' : '<< ') + Math.abs(delta) + 's';

    notice.classList.add('show');
    clearTimeout(hideT);
    hideT = setTimeout(() => notice.classList.remove('show'), 700);
  }

  /* ================= POINTER SWIPE ================= */
  let sx = 0, st = 0, video = null, last = 0;

  function pDown(e) {
    if (e.pointerType !== 'touch') return;
    video = videoFromPoint(e.clientX, e.clientY);
    if (!video || !video.duration) return;
    sx = e.clientX;
    st = video.currentTime;
  }

  function pMove(e) {
    if (!video || e.pointerType !== 'touch') return;

    const dx = e.clientX - sx;
    const vw = video.getBoundingClientRect().width || window.innerWidth;

    const delta =
      Math.round((dx / vw) * video.duration * cfg.swipeRatio);

    if (Math.abs(delta) < 1) return;

    e.preventDefault();

    showNotice(video, delta);

    if (cfg.realtimePreview) {
      const now = performance.now();
      if (now - last > cfg.throttle) {
        last = now;
        video.currentTime = clamp(st + delta, 0, video.duration);
      }
    }
  }

  function pUp(e) {
    if (!video) return;
    if (!cfg.realtimePreview) {
      const dx = e.clientX - sx;
      const vw = video.getBoundingClientRect().width || window.innerWidth;
      const delta =
        Math.round((dx / vw) * video.duration * cfg.swipeRatio);
      video.currentTime = clamp(st + delta, 0, video.duration);
      showNotice(video, delta);
    }
    video = null;
  }

  document.addEventListener('pointerdown', pDown, { capture:true, passive:true });
  document.addEventListener('pointermove', pMove, { capture:true, passive:false });
  document.addEventListener('pointerup',   pUp,   { capture:true, passive:true });

})();
