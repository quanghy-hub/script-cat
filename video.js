// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      2.0.0
// @description  Swipe seek trên đúng video, an toàn với YouTube mobile
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
  const STORE = 'VF_FINAL_V2';
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
    fsBottomOffset: 16,
    minSwipeDistance: 30,  // Khoảng cách tối thiểu để kích hoạt swipe
    verticalTolerance: 50  // Dung sai vuốt dọc trước khi hủy
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
      background:rgba(0,0,0,.75);
      color:#fff;
      padding:10px 16px;
      border-radius:8px;
      z-index:2147483647;
      pointer-events:none;
      white-space:nowrap;
      opacity:0;
      transition:opacity .18s ease, transform .18s ease;
      font-weight:600;
      box-shadow:0 2px 8px rgba(0,0,0,.3);
    }
    .vf-notice.show{
      opacity:1;
      transform:translate(-50%,-50%) scale(1);
    }

    .vf-overlay{
      position:absolute;
      top:0;left:0;right:0;bottom:0;
      z-index:999999;
      touch-action:none;
      pointer-events:auto;
    }
  `);

  /* ================= VIDEO DETECTION ================= */
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

  function getVideoAtPoint(x, y) {
    const videos = [...document.querySelectorAll('video')];
    for (const v of videos) {
      if (!v.offsetWidth || !v.offsetHeight) continue;
      const rect = v.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && 
          y >= rect.top && y <= rect.bottom) {
        return v;
      }
    }
    return null;
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
      (deltaSec >= 0 ? '▶▶ +' : '◀◀ -') + Math.abs(deltaSec) + 's';
    noticeEl.style.left = cx + 'px';
    noticeEl.style.top  = cy + 'px';

    noticeEl.classList.add('show');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => noticeEl.classList.remove('show'), 800);
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
      const gain = boostMap.get(v);
      if (gain) gain.gain.value = cfg.boostLevel;
    }
  }, true);

  /* ================= TOUCH SWIPE - YOUTUBE SAFE ================= */
  const touchState = {
    active: false,
    video: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    currentTime: 0,
    lastUpdate: 0,
    cancelled: false
  };

  function isYouTubeMobile() {
    return window.location.hostname.includes('youtube.com') && 
           /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function handleTouchStart(e) {
    // Reset state
    touchState.active = false;
    touchState.cancelled = false;
    touchState.video = null;

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const video = getVideoAtPoint(touch.clientX, touch.clientY);
    
    if (!video || video.duration === 0) return;

    // Trên YouTube mobile, chỉ kích hoạt nếu chạm ở giữa video
    if (isYouTubeMobile()) {
      const rect = video.getBoundingClientRect();
      const relY = touch.clientY - rect.top;
      const relX = touch.clientX - rect.left;
      
      // Tránh vùng controls (20% dưới cùng) và edges (15% hai bên)
      if (relY > rect.height * 0.8 || 
          relX < rect.width * 0.15 || 
          relX > rect.width * 0.85) {
        return;
      }
    }

    touchState.video = video;
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.startTime = video.currentTime;
    touchState.currentTime = video.currentTime;
    touchState.lastUpdate = performance.now();
    touchState.active = true;
  }

  function handleTouchMove(e) {
    if (!touchState.active || !touchState.video || touchState.cancelled) return;
    if (e.touches.length !== 1) {
      touchState.cancelled = true;
      return;
    }

    const touch = e.touches[0];
    const dx = touch.clientX - touchState.startX;
    const dy = touch.clientY - touchState.startY;

    // Hủy nếu vuốt dọc quá nhiều
    if (Math.abs(dy) > cfg.verticalTolerance) {
      touchState.cancelled = true;
      return;
    }

    // Chỉ kích hoạt sau khi vuốt đủ xa
    if (Math.abs(dx) < cfg.minSwipeDistance) return;

    // Ngăn scroll khi đã xác định là horizontal swipe
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
    }

    const sens = touchState.video.duration <= cfg.shortThreshold
      ? cfg.swipeShort : cfg.swipeLong;
    const delta = Math.round(dx * sens);

    showSeekNotice(touchState.video, delta);

    if (cfg.realtimePreview) {
      const now = performance.now();
      if (now - touchState.lastUpdate > cfg.throttle) {
        touchState.lastUpdate = now;
        const newTime = clamp(
          touchState.startTime + delta, 
          0, 
          touchState.video.duration
        );
        touchState.video.currentTime = newTime;
        touchState.currentTime = newTime;
      }
    }
  }

  function handleTouchEnd(e) {
    if (!touchState.active || !touchState.video) return;

    if (!touchState.cancelled && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchState.startX;
      const dy = touch.clientY - touchState.startY;

      // Chỉ apply seek nếu đủ khoảng cách và không bị hủy
      if (Math.abs(dx) >= cfg.minSwipeDistance && 
          Math.abs(dy) <= cfg.verticalTolerance) {
        
        const sens = touchState.video.duration <= cfg.shortThreshold
          ? cfg.swipeShort : cfg.swipeLong;
        const delta = Math.round(dx * sens);
        
        if (!cfg.realtimePreview) {
          const newTime = clamp(
            touchState.startTime + delta,
            0,
            touchState.video.duration
          );
          touchState.video.currentTime = newTime;
        }
        
        showSeekNotice(touchState.video, delta);
      }
    }

    // Reset
    touchState.active = false;
    touchState.video = null;
    touchState.cancelled = false;
  }

  // Sử dụng passive:false cho touchmove để có thể preventDefault
  document.addEventListener('touchstart', handleTouchStart, { 
    capture: true, 
    passive: true 
  });
  
  document.addEventListener('touchmove', handleTouchMove, { 
    capture: true, 
    passive: false  // Cần false để preventDefault
  });
  
  document.addEventListener('touchend', handleTouchEnd, { 
    capture: true, 
    passive: true 
  });

  document.addEventListener('touchcancel', handleTouchEnd, { 
    capture: true, 
    passive: true 
  });

  console.log('🎬 Video Swipe Controls loaded - YouTube Mobile Safe');

})();
