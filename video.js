// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      2.4.0
// @description  Swipe seek & Tap play/pause optimized for Chrome mobile
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
    swipeLong: 0.3,
    swipeShort: 0.15,
    shortThreshold: 200,
    forwardStep: 5,
    realtimePreview: true,
    throttle: 15,          // Đã chỉnh mượt (60fps)
    noticeFontSize: 14,
    hotkeys: true,
    boost: true,
    boostLevel: 1,
    maxBoost: 5,
    fsAutoHide: true,
    fsHideMs: 5000,
    fsBottomOffset: 16,
    minSwipeDistance: 30,  // Khoảng cách tối thiểu để tính là vuốt
    verticalTolerance: 80, // Dung sai dọc khi vuốt ngang
    diagonalThreshold: 1.5, // Tỷ lệ dx/dy tối thiểu
    tapThreshold: 10       // Khoảng cách di chuyển tối đa để tính là chạm (Tap)
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
      top:12px;
      right:12px;
      transform:translateX(0) scale(.95);
      background:rgba(0,0,0,.65);
      color:#fff;
      padding:6px 12px;
      border-radius:6px;
      z-index:2147483647;
      pointer-events:none;
      white-space:nowrap;
      opacity:0;
      transition:opacity .2s cubic-bezier(0.4, 0, 0.2, 1), 
                  transform .2s cubic-bezier(0.4, 0, 0.2, 1);
      font-weight:500;
      font-size:13px;
      letter-spacing:0.3px;
      box-shadow:0 2px 6px rgba(0,0,0,.25);
      backdrop-filter:blur(4px);
      -webkit-backdrop-filter:blur(4px);
    }
    .vf-notice.show{
      opacity:1;
      transform:translateX(0) scale(1);
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

  /* ================= SEEK NOTICE (UPDATED) ================= */
  let noticeEl, hideTimer;

  // Cập nhật hàm này để hỗ trợ custom text/icon cho Play/Pause
  function showSeekNotice(video, value, customIcon = null) {
    if (!video) return;

    const fs = currentFullscreenElement();
    const inFS = fs && (fs === video || fs.contains(video));
    let container = inFS ? fs : (video.parentElement || document.body);

    if (!noticeEl || !container.contains(noticeEl)) {
      noticeEl && noticeEl.remove();
      noticeEl = document.createElement('div');
      noticeEl.className = 'vf-notice';
      noticeEl.style.fontSize = cfg.noticeFontSize + 'px';
      
      if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
      
      container.appendChild(noticeEl);
    }

    let text = '';
    if (customIcon) {
        // Trường hợp Play/Pause
        text = `${customIcon} ${value}`;
    } else {
        // Trường hợp Seek (tua)
        const icon = value >= 0 ? '▶' : '◀';
        text = `${icon} ${value >= 0 ? '+' : ''}${value}s`;
    }

    noticeEl.textContent = text;
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
      const gain = boostMap.get(v);
      if (gain) gain.gain.value = cfg.boostLevel;
    }
  }, true);

  /* ================= TOUCH SWIPE & TAP - FULL VIDEO AREA ================= */
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

  function handleTouchStart(e) {
    touchState.active = false;
    touchState.cancelled = false;
    touchState.video = null;

    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const video = getVideoAtPoint(touch.clientX, touch.clientY);
    
    if (!video || video.duration === 0) return;

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
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Chưa di chuyển đủ xa để tính là vuốt, nhưng có thể là tap (đợi touchend)
    if (absDx < 5 && absDy < 5) return;

    // Hủy nếu vuốt dọc quá nhiều (để cho phép scroll trang)
    if (absDy > cfg.verticalTolerance) {
      touchState.cancelled = true;
      return;
    }

    // Hủy nếu góc vuốt quá chéo
    if (absDx > 0 && (absDx / (absDy + 1)) < cfg.diagonalThreshold) {
      touchState.cancelled = true;
      return;
    }

    // Chỉ kích hoạt seek sau khi vuốt đủ xa
    if (absDx < cfg.minSwipeDistance) return;

    // Ngăn scroll khi đã xác định là horizontal swipe
    if (absDx > absDy) {
      e.preventDefault();
    }

    // [UPDATED] Tính effectiveDx bằng cách trừ đi ngưỡng bắt đầu
    // Giúp seek bắt đầu từ 0s thay vì nhảy cóc
    const effectiveDx = dx > 0 ? dx - cfg.minSwipeDistance : dx + cfg.minSwipeDistance;

    const sens = touchState.video.duration <= cfg.shortThreshold
      ? cfg.swipeShort : cfg.swipeLong;
    const delta = Math.round(effectiveDx * sens);

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
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // --- LOGIC TAP (MỚI) ---
      // Nếu di chuyển rất ít (dưới 10px), coi như là chạm (Tap)
      if (absDx < cfg.tapThreshold && absDy < cfg.tapThreshold) {
        if (touchState.video.paused) {
            touchState.video.play().catch(()=>{}); // Catch lỗi autoplay policy nếu có
            showSeekNotice(touchState.video, 'Play', '▶');
        } else {
            touchState.video.pause();
            showSeekNotice(touchState.video, 'Pause', '⏸');
        }
        // Không e.preventDefault() ở đây để tránh chặn các hành vi click khác (như hiện controls gốc)
        // Nếu bạn muốn chặn controls gốc của web hiện lên thì bỏ comment dòng dưới:
        // e.preventDefault(); 
      }
      
      // --- LOGIC SWIPE (CŨ) ---
      else {
          const isHorizontal = absDx > absDy && 
                              (absDx / (absDy + 1)) >= cfg.diagonalThreshold;
          const isValidDistance = absDx >= cfg.minSwipeDistance;
          const isValidVertical = absDy <= cfg.verticalTolerance;

          if (isHorizontal && isValidDistance && isValidVertical) {
            // [UPDATED] Áp dụng effectiveDx cho logic kết thúc
            const effectiveDx = dx > 0 ? dx - cfg.minSwipeDistance : dx + cfg.minSwipeDistance;

            const sens = touchState.video.duration <= cfg.shortThreshold
              ? cfg.swipeShort : cfg.swipeLong;
            const delta = Math.round(effectiveDx * sens);
            
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
    }

    touchState.active = false;
    touchState.video = null;
    touchState.cancelled = false;
  }

  document.addEventListener('touchstart', handleTouchStart, { 
    capture: true, 
    passive: true 
  });
  
  document.addEventListener('touchmove', handleTouchMove, { 
    capture: true, 
    passive: false
  });
  
  document.addEventListener('touchend', handleTouchEnd, { 
    capture: true, 
    passive: true 
  });

  document.addEventListener('touchcancel', handleTouchEnd, { 
    capture: true, 
    passive: true 
  });

  console.log('🎬 Video Controls: Swipe to Seek + Tap to Toggle');

})();
