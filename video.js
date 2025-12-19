// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      2.6.0
// @description  Swipe seek optimized for Chrome mobile
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

/* jshint esversion: 8 */
(function () {
  'use strict';

  /* ================= UTILITIES ================= */
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ================= CONFIG ================= */
  const STORE = 'VF_FINAL_V2';
  const DEF = {
    // Swipe seek
    swipeLong: 0.3,
    swipeShort: 0.15,
    shortThreshold: 200,
    minSwipeDistance: 30,
    verticalTolerance: 80,
    diagonalThreshold: 1.5,
    realtimePreview: true,
    throttle: 10,
    // Keyboard
    forwardStep: 5,
    hotkeys: true,
    // Audio boost
    boost: true,
    boostLevel: 1,
    maxBoost: 5,
    // Notice
    noticeFontSize: 14
  };

  const cfg = {};
  Object.keys(DEF).forEach(k => cfg[k] = GM_getValue(`${STORE}:${k}`, DEF[k]));
  const save = (k, v) => { cfg[k] = v; GM_setValue(`${STORE}:${k}`, v); };

  /* ================= STYLES ================= */
  GM_addStyle(`
    .vf-notice {
      position: absolute;
      top: 12px;
      right: 12px;
      transform: scale(.95);
      background: rgba(0,0,0,.65);
      color: #fff;
      padding: 6px 12px;
      border-radius: 6px;
      z-index: 2147483647;
      pointer-events: none;
      white-space: nowrap;
      opacity: 0;
      transition: opacity .2s cubic-bezier(0.4, 0, 0.2, 1),
                  transform .2s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight: 500;
      font-size: 13px;
      letter-spacing: 0.3px;
      box-shadow: 0 2px 6px rgba(0,0,0,.25);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .vf-notice.show {
      opacity: 1;
      transform: scale(1);
    }
  `);

  /* ================= VIDEO DETECTION ================= */
  const getFullscreenEl = () =>
    document.fullscreenElement || document.webkitFullscreenElement || null;

  function getVideo() {
    const fs = getFullscreenEl();
    if (fs) {
      if (fs.tagName === 'VIDEO') return fs;
      const v = fs.querySelector('video');
      if (v) return v;
    }
    return [...document.querySelectorAll('video')]
      .find(v => v.offsetWidth && v.offsetHeight) || null;
  }

  function getVideoAtPoint(x, y) {
    for (const v of document.querySelectorAll('video')) {
      if (!v.offsetWidth || !v.offsetHeight) continue;
      const r = v.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return v;
    }
    return null;
  }

  /* ================= SEEK NOTICE ================= */
  let noticeEl, hideTimer;

  function showSeekNotice(video, delta) {
    if (!video) return;

    const fs = getFullscreenEl();
    const inFS = fs && (fs === video || fs.contains(video));
    const container = inFS ? fs : (video.parentElement || document.body);

    if (!noticeEl || !container.contains(noticeEl)) {
      noticeEl?.remove();
      noticeEl = document.createElement('div');
      noticeEl.className = 'vf-notice';
      noticeEl.style.fontSize = cfg.noticeFontSize + 'px';

      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      container.appendChild(noticeEl);
    }

    const icon = delta >= 0 ? '▶' : '◀';
    noticeEl.textContent = `${icon} ${delta >= 0 ? '+' : ''}${delta}s`;
    noticeEl.classList.add('show');

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => noticeEl.classList.remove('show'), 700);
  }

  /* ================= AUDIO BOOST ================= */
  let audioCtx;
  const boostMap = new WeakMap();

  function getAudioCtx() {
    return audioCtx || (audioCtx = new (window.AudioContext || window.webkitAudioContext)());
  }

  function applyBoost(video) {
    if (!cfg.boost || boostMap.has(video)) return;
    try {
      const ctx = getAudioCtx();
      ctx.resume?.();
      const src = ctx.createMediaElementSource(video);
      const gain = ctx.createGain();
      gain.gain.value = clamp(cfg.boostLevel, 1, cfg.maxBoost);
      src.connect(gain).connect(ctx.destination);
      boostMap.set(video, gain);
    } catch { }
  }

  /* ================= KEYBOARD CONTROLS ================= */
  document.addEventListener('keydown', e => {
    if (!cfg.hotkeys) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const v = getVideo();
    if (!v) return;

    if (e.key === 'ArrowRight') {
      v.currentTime += cfg.forwardStep;
      showSeekNotice(v, cfg.forwardStep);
    } else if (e.key === 'ArrowLeft') {
      v.currentTime -= cfg.forwardStep;
      showSeekNotice(v, -cfg.forwardStep);
    } else if (e.key.toLowerCase() === 'b') {
      cfg.boostLevel = cfg.boostLevel >= cfg.maxBoost ? 1 : cfg.boostLevel + 1;
      save('boostLevel', cfg.boostLevel);
      applyBoost(v);
      const gain = boostMap.get(v);
      if (gain) gain.gain.value = cfg.boostLevel;
    }
  }, true);

  /* ================= TOUCH SWIPE SEEK ================= */
  const touch = {
    active: false,
    video: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastUpdate: 0,
    cancelled: false
  };

  function onTouchStart(e) {
    touch.active = false;
    touch.cancelled = false;
    touch.video = null;

    if (e.touches.length !== 1) return;

    const t = e.touches[0];
    const video = getVideoAtPoint(t.clientX, t.clientY);
    if (!video || !video.duration) return;

    touch.video = video;
    touch.startX = t.clientX;
    touch.startY = t.clientY;
    touch.startTime = video.currentTime;
    touch.lastUpdate = performance.now();
    touch.active = true;
  }

  function onTouchMove(e) {
    if (!touch.active || !touch.video || touch.cancelled) return;
    if (e.touches.length !== 1) {
      touch.cancelled = true;
      return;
    }

    const t = e.touches[0];
    const dx = t.clientX - touch.startX;
    const dy = t.clientY - touch.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Chờ di chuyển đủ xa
    if (absDx < 5 && absDy < 5) return;

    // Hủy nếu vuốt dọc quá nhiều
    if (absDy > cfg.verticalTolerance) {
      touch.cancelled = true;
      return;
    }

    // Hủy nếu góc vuốt quá chéo
    if (absDx > 0 && (absDx / (absDy + 1)) < cfg.diagonalThreshold) {
      touch.cancelled = true;
      return;
    }

    // Chưa đủ khoảng cách tối thiểu
    if (absDx < cfg.minSwipeDistance) return;

    // Ngăn scroll khi đã xác định là vuốt ngang
    if (absDx > absDy) e.preventDefault();

    // Tính delta từ điểm bắt đầu thực tế (trừ ngưỡng)
    const effectiveDx = dx > 0 ? dx - cfg.minSwipeDistance : dx + cfg.minSwipeDistance;
    const sens = touch.video.duration <= cfg.shortThreshold ? cfg.swipeShort : cfg.swipeLong;
    const delta = Math.round(effectiveDx * sens);

    showSeekNotice(touch.video, delta);

    // Realtime preview với throttle
    if (cfg.realtimePreview) {
      const now = performance.now();
      if (now - touch.lastUpdate > cfg.throttle) {
        touch.lastUpdate = now;
        touch.video.currentTime = clamp(touch.startTime + delta, 0, touch.video.duration);
      }
    }
  }

  function onTouchEnd(e) {
    if (!touch.active || !touch.video) return;

    if (!touch.cancelled && e.changedTouches.length === 1) {
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.startX;
      const dy = t.clientY - touch.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      const isHorizontal = absDx > absDy && (absDx / (absDy + 1)) >= cfg.diagonalThreshold;
      const isValidDistance = absDx >= cfg.minSwipeDistance;
      const isValidVertical = absDy <= cfg.verticalTolerance;

      if (isHorizontal && isValidDistance && isValidVertical) {
        const effectiveDx = dx > 0 ? dx - cfg.minSwipeDistance : dx + cfg.minSwipeDistance;
        const sens = touch.video.duration <= cfg.shortThreshold ? cfg.swipeShort : cfg.swipeLong;
        const delta = Math.round(effectiveDx * sens);

        if (!cfg.realtimePreview) {
          touch.video.currentTime = clamp(touch.startTime + delta, 0, touch.video.duration);
        }
        showSeekNotice(touch.video, delta);
      }
    }

    touch.active = false;
    touch.video = null;
    touch.cancelled = false;
  }

  document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
  document.addEventListener('touchmove', onTouchMove, { capture: true, passive: false });
  document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true });

  console.log('🎬 Video Controls: Swipe to Seek');
})();
