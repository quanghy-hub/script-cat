// ==UserScript==
// @name         Video Fixed — FINAL (YT Mobile Safe)
// @namespace    https://your.namespace
// @version      1.6.11
// @description  Swipe seek + keyboard seek, fixed target video, YouTube mobile-safe, pointer events, unified notice, fullscreen safe, audio boost
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

  /* ================= CONFIG ================= */
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
    boostLevel: 1,
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
      position:absolute;
      right:14px;
      width:32px;height:32px;
      background:transparent;
      color:#fff;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:22px;
      z-index:2147483647;
      cursor:pointer;
      user-select:none;
      opacity:0;
      transition:opacity .25s ease
    }
    .vf-fs-btn.show{opacity:1}

    .vf-notice{
      position:absolute;
      transform:translate(-50%,-50%) scale(.98);
      background:rgba(0,0,0,.6);
      color:#fff;
      padding:8px 14px;
      border-radius:6px;
      z-index:2147483647;
      pointer-events:none;
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
  function currentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function getVideo() {
    const fs = currentFullscreenElement();
    if (fs) {
      if (fs.tagName === 'VIDEO') return fs;
      const v = fs.querySelector('video');
      if (v) return v;
    }
    return [...document.querySelectorAll('video')]
      .find(v => v.offsetWidth && v.offsetHeight) || null;
  }

  function videoFromPoint(x, y) {
    try {
      if (document.elementsFromPoint) {
        const els = document.elementsFromPoint(x, y);
        for (const el of els) {
          if (el.tagName === 'VIDEO') return el;
          const v = el.closest && el.closest('video');
          if (v) return v;
        }
      } else {
        let el = document.elementFromPoint(x, y);
        while (el) {
          if (el.tagName === 'VIDEO') return el;
          el = el.parentElement;
        }
      }
    } catch {}
    return getVideo();
  }

  /* ================= SEEK NOTICE ================= */
  let noticeEl, hideTimer;

  function showSeekNotice(video, deltaSec) {
    if (!video) return;

    const fs = currentFullscreenElement();
    const inFS = fs && (fs === video || fs.contains(video));
    let container = inFS ? fs : document.body;

    if (!noticeEl || !container.contains(noticeEl)) {
      noticeEl && noticeEl.remove();
      noticeEl = document.createElement('div');
      noticeEl.className = 'vf-notice';
      noticeEl.style.fontSize = cfg.noticeFontSize + 'px';
      container.appendChild(noticeEl);
    }

    const vr = video.getBoundingClientRect();
    let cx, cy;

    if (inFS) {
      const fr = fs.getBoundingClientRect();
      cx = vr.left - fr.left + vr.width / 2;
      cy = vr.top  - fr.top  + vr.height / 2;
      noticeEl.style.position = 'absolute';
    } else {
      cx = vr.left + vr.width / 2;
      cy = vr.top  + vr.height / 2;
      noticeEl.style.position = 'fixed';
    }

    noticeEl.textContent =
      (deltaSec >= 0 ? '>> ' : '<< ') + Math.abs(deltaSec) + 's';
    noticeEl.style.left = cx + 'px';
    noticeEl.style.top  = cy + 'px';

    noticeEl.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => noticeEl.classList.remove('show'), 700);
  }

  /* ================= FULLSCREEN BUTTON ================= */
  function addFS(video) {
    if (!video || video.dataset.vfFs) return;
    const box = video.parentElement;
    if (!box) return;

    if (getComputedStyle(box).position === 'static')
      box.style.position = 'relative';

    const b = document.createElement('div');
    b.className = 'vf-fs-btn';
    b.textContent = '⛶';
    b.style.bottom = cfg.fsBottomOffset + 'px';

    let hideT;
    const show = () => {
      b.classList.add('show');
      clearTimeout(hideT);
      if (cfg.fsAutoHide)
        hideT = setTimeout(() => b.classList.remove('show'), cfg.fsHideMs);
    };

    b.onclick = async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (!currentFullscreenElement())
          await (video.requestFullscreen?.() || box.requestFullscreen());
        else
          await document.exitFullscreen();
      } catch {}
    };

    box.addEventListener('touchstart', show, { passive: true });
    box.addEventListener('mousemove', show);

    box.appendChild(b);
    video.dataset.vfFs = '1';
  }

  const scanFS = () => document.querySelectorAll('video').forEach(addFS);
  scanFS();
  new MutationObserver(scanFS)
    .observe(document.body, { childList: true, subtree: true });

  /* ================= AUDIO BOOST ================= */
  let actx;
  const boostMap = new WeakMap();
  const ctx = () => actx || (actx = new (window.AudioContext || window.webkitAudioContext)());

  function boost(video) {
    if (!cfg.boost || boostMap.has(video)) return;
    try {
      const c = ctx();
      c.resume?.();
      const src = c.createMediaElementSource(video);
      const g = c.createGain();
      g.gain.value = clamp(cfg.boostLevel, 1, cfg.maxBoost);
      src.connect(g).connect(c.destination);
      boostMap.set(video, g);
    } catch {}
  }

  /* ================= KEYBOARD ================= */
  document.addEventListener('keydown', e => {
    if (!cfg.hotkeys) return;
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;

    const v = getVideo();
    if (!v) return;

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
      boost(v);
      boostMap.get(v).gain.value = cfg.boostLevel;
    }
  }, true);

  /* ================= POINTER SWIPE (MOBILE SAFE) ================= */
  let sx=0, sy=0, st=0, last=0, activeVideo=null;

  function pDown(e) {
    if (e.pointerType !== 'touch') return;
    activeVideo = videoFromPoint(e.clientX, e.clientY);
    if (!activeVideo) return;
    sx = e.clientX;
    sy = e.clientY;
    st = activeVideo.currentTime;
    activeVideo.focus?.();
  }

  function pMove(e) {
    if (!activeVideo || e.pointerType !== 'touch') return;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;

    e.preventDefault();

    const sens = activeVideo.duration <= cfg.shortThreshold
      ? cfg.swipeShort : cfg.swipeLong;
    const delta = Math.round(dx * sens);

    showSeekNotice(activeVideo, delta);

    if (cfg.realtimePreview) {
      const now = performance.now();
      if (now - last > cfg.throttle) {
        last = now;
        activeVideo.currentTime =
          clamp(st + delta, 0, activeVideo.duration || 1e9);
      }
    }
  }

  function pUp(e) {
    if (!activeVideo) return;
    if (!cfg.realtimePreview) {
      const dx = e.clientX - sx;
      const sens = activeVideo.duration <= cfg.shortThreshold
        ? cfg.swipeShort : cfg.swipeLong;
      const delta = Math.round(dx * sens);
      activeVideo.currentTime =
        clamp(st + delta, 0, activeVideo.duration || 1e9);
      showSeekNotice(activeVideo, delta);
    }
    activeVideo = null;
  }

  document.addEventListener('pointerdown', pDown, { capture:true, passive:true });
  document.addEventListener('pointermove', pMove, { capture:true, passive:false });
  document.addEventListener('pointerup',   pUp,   { capture:true, passive:true });

})();
