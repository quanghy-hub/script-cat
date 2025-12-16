// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      1.7.2
// @description  Universal swipe seek (no 4–5s limit). Robust: pointer + touch fallback, element-from-point stack, handles transforms/scale, ignores live streams. YouTube mobile-safe.
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  /* ================= CONFIG (persistent) ================= */
  const STORE = 'VF_FINAL_V1';
  const DEF = {
    swipeRatio: 0.9,        // fraction of video duration for a full-width swipe
    realtimePreview: true,
    throttleMs: 40,         // pointer move throttle
    noticeFontSize: 16,
    minDeltaSec: 1,         // minimum shown/committed seconds (prevents jitter)
    ignoreLive: true,       // don't try to seek live streams / unknown duration
    debug: false
  };
  const cfg = {};
  Object.keys(DEF).forEach(k => cfg[k] = (typeof GM_getValue === 'function') ? GM_getValue(`${STORE}:${k}`, DEF[k]) : DEF[k]);
  const save = (k, v) => { cfg[k] = v; if (typeof GM_setValue === 'function') GM_setValue(`${STORE}:${k}`, v); };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const log = (...s) => { if (cfg.debug) console.log('[VF]', ...s); };

  /* ================= STYLE ================= */
  GM_addStyle && GM_addStyle(`
    .vf-notice{
      position:fixed;
      transform:translate(-50%,-50%) scale(.98);
      background:rgba(0,0,0,.65);
      color:#fff;padding:8px 12px;border-radius:6px;
      z-index:2147483647;pointer-events:none;white-space:nowrap;
      opacity:0;transition:opacity .18s ease, transform .18s ease;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
    }
    .vf-notice.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
  `);

  /* ================= UTIL: fullscreen poly ================= */
  const currentFullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

  /* ================= UTIL: find video at point robustly ================= */
  function getVideoVisible() {
    try {
      const fs = currentFullscreenElement();
      if (fs) {
        if (fs.tagName === 'VIDEO') return fs;
        const v = fs.querySelector && fs.querySelector('video');
        if (v) return v;
      }
    } catch (e) { /* ignore */ }

    const vids = Array.from(document.querySelectorAll('video'));
    return vids.find(v => v.offsetWidth > 0 && v.offsetHeight > 0) || null;
  }

  function videoFromPoint(x, y) {
    try {
      if (document.elementsFromPoint) {
        const els = document.elementsFromPoint(x, y);
        // prefer direct <video> element in stack or closest ancestor video
        for (const el of els) {
          if (!el) continue;
          if (el.tagName === 'VIDEO') return el;
          try {
            if (el.closest) {
              const v = el.closest('video');
              if (v) return v;
            }
          } catch (e) {}
        }
      } else if (document.elementFromPoint) {
        let el = document.elementFromPoint(x, y);
        while (el) {
          if (el.tagName === 'VIDEO') return el;
          el = el.parentElement;
        }
      }
    } catch (e) { /* ignore */ }
    return getVideoVisible();
  }

  /* ================= NOTICE UI ================= */
  let noticeEl = null, noticeTimer = null;
  function ensureNoticeContainer(video) {
    const fs = currentFullscreenElement();
    const container = fs && (fs === video || fs.contains(video)) ? fs : document.body;
    if (!noticeEl || !container.contains(noticeEl)) {
      noticeEl && noticeEl.remove();
      noticeEl = document.createElement('div');
      noticeEl.className = 'vf-notice';
      noticeEl.style.fontSize = cfg.noticeFontSize + 'px';
      container.appendChild(noticeEl);
    }
    return noticeEl;
  }
  function showNotice(video, deltaSec) {
    if (!video) return;
    const el = ensureNoticeContainer(video);
    const r = video.getBoundingClientRect();
    // position center of video, but clamp into viewport
    const left = clamp(r.left + r.width/2, 12, window.innerWidth - 12);
    const top  = clamp(r.top  + r.height/2, 12, window.innerHeight - 12);
    el.style.left = left + 'px';
    el.style.top  = top  + 'px';
    el.style.position = (currentFullscreenElement() && currentFullscreenElement().contains(video)) ? 'absolute' : 'fixed';
    const secs = Math.round(deltaSec);
    el.textContent = (secs >= 0 ? '>> ' : '<< ') + Math.abs(secs) + 's';
    el.classList.add('show');
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => el.classList.remove('show'), 700);
  }

  /* ================= SEEK MATH (robust) =================
     We compute deltaSeconds from fraction of video bounding width:
       frac = dx_pixels / videoBoundingWidth
       delta = frac * video.duration * swipeRatio
     This makes seek independent of pixel scale/zoom and works for small players.
  ===================================================== */
  function computeDeltaSeconds(video, dx) {
    if (!video || !isFinite(video.duration) || video.duration <= 0) return 0;
    const rect = video.getBoundingClientRect();
    const vw = rect.width || window.innerWidth;
    if (vw === 0) return 0;
    const frac = dx / vw; // positive right swipe
    const raw = frac * video.duration * cfg.swipeRatio;
    // ensure at least minDeltaSec when movement significant in pixels
    const minDelta = cfg.minDeltaSec;
    const delta = Math.abs(raw) < minDelta ? (raw < 0 ? -minDelta : minDelta) : raw;
    return Math.round(delta);
  }

  /* ================= POINTER / TOUCH HANDLERS ================= */
  let active = {
    video: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastApplyMs: 0
  };

  function onPointerDown(e) {
    // only handle touch pointers to avoid breaking mouse interactions (configurable)
    if (e.pointerType && e.pointerType !== 'touch') return;
    const v = videoFromPoint(e.clientX, e.clientY);
    if (!v) return;
    // ignore live / indefinite duration videos if configured
    if (cfg.ignoreLive && (!isFinite(v.duration) || v.duration <= 0)) {
      log('ignoring live/unknown duration video');
      return;
    }
    active.video = v;
    active.startX = e.clientX;
    active.startY = e.clientY;
    active.startTime = v.currentTime || 0;
    active.lastApplyMs = 0;
    try { e.target && e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (ex) {}
    // resume audio context if any (some browsers require gesture)
    if (window.AudioContext && window.audioContext && window.audioContext.state === 'suspended') {
      try { window.audioContext.resume(); } catch(e) {}
    }
    log('pointerdown on video', v, 'start', active.startTime);
  }

  function onPointerMove(e) {
    if (!active.video) return;
    // only touch
    if (e.pointerType && e.pointerType !== 'touch') return;

    const dx = e.clientX - active.startX;
    const dy = e.clientY - active.startY;
    // allow vertical scroll if vertical dominant
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;

    // prevent default to stop page horizontal gestures
    e.preventDefault && e.preventDefault();

    const delta = computeDeltaSeconds(active.video, dx);
    if (!delta) return;

    // throttle apply for realtime preview
    const now = performance.now();
    if (cfg.realtimePreview) {
      if (now - active.lastApplyMs > cfg.throttleMs) {
        active.lastApplyMs = now;
        try {
          const newT = clamp(active.startTime + delta, 0, active.video.duration || 1e9);
          active.video.currentTime = newT;
          log('applied realtime currentTime', newT);
        } catch (err) { log('seek apply error', err); }
      }
    }

    showNotice(active.video, delta);
  }

  function onPointerUp(e) {
    if (!active.video) return;
    // final apply if realtimePreview off or to ensure final pos
    const dx = e.clientX - active.startX;
    const delta = computeDeltaSeconds(active.video, dx);
    if (!cfg.realtimePreview && delta) {
      try {
        const newT = clamp(active.startTime + delta, 0, active.video.duration || 1e9);
        active.video.currentTime = newT;
        log('final apply currentTime', newT);
      } catch (err) { log('final seek error', err); }
    }
    try { e.target && e.target.releasePointerCapture && e.target.releasePointerCapture(e.pointerId); } catch (ex) {}
    active.video = null;
  }

  /* Touch fallback (for browsers without pointer events) using identical math */
  let touchActive = { video: null, startX: 0, startY: 0, startTime: 0, lastApplyMs: 0 };
  function onTouchStart(e) {
    if (!e.touches || e.touches.length !== 1) return;
    const t = e.touches[0];
    const v = videoFromPoint(t.clientX, t.clientY);
    if (!v) return;
    if (cfg.ignoreLive && (!isFinite(v.duration) || v.duration <= 0)) return;
    touchActive.video = v;
    touchActive.startX = t.clientX;
    touchActive.startY = t.clientY;
    touchActive.startTime = v.currentTime || 0;
    touchActive.lastApplyMs = 0;
  }
  function onTouchMove(e) {
    if (!touchActive.video || !e.touches || e.touches.length === 0) return;
    const t = e.touches[0];
    const dx = t.clientX - touchActive.startX;
    const dy = t.clientY - touchActive.startY;
    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) return;
    e.preventDefault && e.preventDefault();
    const delta = computeDeltaSeconds(touchActive.video, dx);
    if (!delta) return;
    const now = performance.now();
    if (cfg.realtimePreview && now - touchActive.lastApplyMs > cfg.throttleMs) {
      touchActive.lastApplyMs = now;
      try {
        touchActive.video.currentTime = clamp(touchActive.startTime + delta, 0, touchActive.video.duration || 1e9);
      } catch (err) {}
    }
    showNotice(touchActive.video, delta);
  }
  function onTouchEnd(e) {
    if (!touchActive.video) return;
    if (!cfg.realtimePreview) {
      // try to get final touch point from changedTouches
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      const endX = t ? t.clientX : touchActive.startX;
      const dx = endX - touchActive.startX;
      const delta = computeDeltaSeconds(touchActive.video, dx);
      if (delta) {
        try {
          touchActive.video.currentTime = clamp(touchActive.startTime + delta, 0, touchActive.video.duration || 1e9);
        } catch (err) {}
        showNotice(touchActive.video, delta);
      }
    }
    touchActive.video = null;
  }

  /* ================= KEYBOARD SEEK (unchanged) ================= */
  document.addEventListener('keydown', e => {
    if (['INPUT','TEXTAREA'].includes(e.target.tagName)) return;
    const v = getVideoBest();
    if (!v) return;
    if (e.key === 'ArrowRight') {
      v.currentTime = clamp(v.currentTime + 5, 0, v.duration || 1e9);
      showNotice(v, 5);
    }
    if (e.key === 'ArrowLeft') {
      v.currentTime = clamp(v.currentTime - 5, 0, v.duration || 1e9);
      showNotice(v, -5);
    }
  }, true);

  // helper to pick best visible video for keyboard
  function getVideoBest() {
    try {
      const fs = currentFullscreenElement();
      if (fs) {
        if (fs.tagName === 'VIDEO') return fs;
        const v = fs.querySelector('video'); if (v) return v;
      }
    } catch (e) {}
    return document.querySelector('video') || getAnyVisibleVideo();
  }
  function getAnyVisibleVideo() {
    const vids = Array.from(document.querySelectorAll('video'));
    return vids.find(v => v.offsetWidth > 50 && v.offsetHeight > 30) || vids[0] || null;
  }

  /* ================= ATTACH HANDLERS ================= */
  if (window.PointerEvent) {
    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    document.addEventListener('pointermove', onPointerMove, { capture: true, passive: false });
    document.addEventListener('pointerup',   onPointerUp,   { capture: true, passive: true });
    log('pointer events attached');
  } else {
    // fallback to touch
    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true });
    document.addEventListener('touchmove',  onTouchMove,  { capture: true, passive: false });
    document.addEventListener('touchend',   onTouchEnd,   { capture: true, passive: true });
    log('touch fallback attached');
  }

  /* ================= FINAL NOTES ================= */
  // Exposed simple API for toggling debug / config via console if needed:
  window.__VF = window.__VF || {};
  window.__VF.cfg = cfg;
  window.__VF.save = save;
  window.__VF.showNotice = showNotice;

  log('Video Fixed v1.7.2 loaded', cfg);

})();
