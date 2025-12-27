// ==UserScript==
// @name        Facebook video downloader + In-Bar Button (VN) [v1.4.4 OpenInNewTab]
// @icon        https://www.facebook.com/favicon.ico
// @namespace   Violentmonkey Scripts
// @match       https://www.facebook.com/*
// @match       https://web.facebook.com/*
// @grant       GM_registerMenuCommand
// @grant       GM_openInTab
// @version     1.4.4
// @author      https://github.com/HoangTran0410 + mod
// @description Nút tải gắn thanh control; luôn mở video sang TAB MỚI (không chiếm tab Facebook). Alt+D & long-press.
// @license     MIT
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/fbd.js
// @downloadURL https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/fbd.js
// ==/UserScript==

(() => {
  'use strict';

  // ======== Config ========
  const BTN_SIZE_PX = 28;         // icon trong thanh bar
  const BTN_OVERLAY_SIZE = 34;    // overlay fallback
  const BTN_OFFSET_PX = 10;       // overlay: cách mép trái/dưới
  const LONG_PRESS_MS = 600;

  // Open behavior:
  const FORCE_DIRECT_DOWNLOAD = false; // true = gắn download -> vài trình duyệt có thể vẫn tải trong tab mới
  const STYLE_ID = 'fbvdl-style-inbar';
  const DEBUG_OUTLINE = false;

  // ======== Styles ========
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .fbvdl-toast{
        position:fixed; top:16px; left:50%; transform:translateX(-50%);
        background:#111; color:#fff; padding:10px 14px; border-radius:10px;
        font:14px/1.2 system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Arial,Noto Sans;
        z-index:2147483646; box-shadow:0 6px 18px rgba(0,0,0,.28); opacity:.98;
      }
      .fbvdl-inbar{
        display:inline-flex; align-items:center; justify-content:center;
        width:${BTN_SIZE_PX}px; height:${BTN_SIZE_PX}px; min-width:${BTN_SIZE_PX}px;
        border-radius:6px; margin-left:8px; cursor:pointer;
        background:rgba(255,255,255,.06);
        transition:transform .15s ease,background .2s ease,opacity .2s ease;
        opacity:.95;
      }
      .fbvdl-inbar:hover{ transform:scale(1.06); background:rgba(255,255,255,.12); }
      .fbvdl-inbar svg{ width:70%; height:70%; fill:#fff; display:block; }
      .fbvdl-inbar[disabled]{ opacity:.5; pointer-events:none; }

      .fbvdl-wrap-fixed{
        position:fixed; pointer-events:none; z-index:2147483000;
        ${DEBUG_OUTLINE ? 'outline:1px dashed rgba(255,0,0,.35);' : ''}
      }
      .fbvdl-btn{
        pointer-events:auto; user-select:none; -webkit-user-select:none;
        position:absolute;
        left:${BTN_OFFSET_PX}px; bottom:${BTN_OFFSET_PX}px;
        width:${BTN_OVERLAY_SIZE}px; height:${BTN_OVERLAY_SIZE}px; border-radius:999px;
        background: rgba(0,0,0,.6); backdrop-filter:saturate(1.2) blur(2px);
        display:grid; place-items:center; cursor:pointer;
        box-shadow:0 2px 6px rgba(0,0,0,.25);
        transition:transform .15s ease, opacity .2s ease;
        opacity:.92;
      }
      .fbvdl-btn:hover{ transform:scale(1.06); opacity:1; }
      .fbvdl-btn svg{ width:60%; height:60%; fill:#fff; display:block; }
    `.trim();
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ======== Utils ========
  function showToast(msg, ms = 1500) {
    const el = document.createElement('div');
    el.className = 'fbvdl-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => { el.remove(); }, ms);
  }

  function getOverlapScore(el) {
    const r = el.getBoundingClientRect();
    return Math.min(r.bottom, window.innerHeight) - Math.max(0, r.top);
  }

  const approxEqual = (a, b, eps = 4) => Math.abs(a - b) <= eps;

  function safeRequire(mod) {
    try { return (window.require || window.__d?.require || require)?.(mod); } catch { return null; }
  }

  function getVideoIdFromVideoElement(video) {
    let el = video;
    for (let depth = 0; depth < 7 && el; depth++) {
      try {
        for (const k in el) {
          if (k && typeof k === 'string' && k.startsWith('__reactProps')) {
            const p = el[k];
            const id = p?.children?.props?.videoFBID
              || p?.children?.props?.video?.id
              || p?.children?.props?.video?.videoId;
            if (id) return String(id);
          }
        }
      } catch { }
      el = el.parentElement;
    }
    return null;
  }

  async function getWatchingVideoId() {
    const all = Array.from(document.querySelectorAll('video'));
    const res = [];
    for (const v of all) {
      const id = getVideoIdFromVideoElement(v);
      if (id) {
        res.push({
          videoId: id,
          overlapScore: getOverlapScore(v),
          playing: !!(v.currentTime > 0 && !v.paused && !v.ended && v.readyState > 2),
        });
      }
    }
    const playing = res.find(x => x.playing);
    if (playing) return [playing.videoId];
    return res
      .filter(x => x.videoId && (x.overlapScore > 0 || x.playing))
      .sort((a, b) => b.overlapScore - a.overlapScore)
      .map(x => x.videoId);
  }

  function stringifyVariables(d, e) {
    const f = [];
    for (const a in d) if (Object.prototype.hasOwnProperty.call(d, a)) {
      const g = e ? e + '[' + a + ']' : a;
      const b = d[a];
      f.push((b !== null && typeof b === 'object') ? stringifyVariables(b, g)
        : encodeURIComponent(g) + '=' + encodeURIComponent(b));
    }
    return f.join('&');
  }

  function fetchGraphQl(doc_id, variables, dtsg) {
    return fetch('https://www.facebook.com/api/graphql/', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: stringifyVariables({
        doc_id,
        variables: JSON.stringify(variables),
        fb_dtsg: dtsg,
        server_timestamps: true,
      }),
    });
  }

  async function getDtsg() {
    const mod = safeRequire('DTSGInitialData');
    if (mod?.token) return mod.token;
    const el = document.querySelector('input[name="fb_dtsg"]');
    if (el?.value) return el.value;
    throw Error('Không lấy được fb_dtsg (token). Hãy refresh trang.');
  }

  async function getLinkFbVideo2(videoId, dtsg) {
    const res = await fetch('https://www.facebook.com/video/video_data_async/?video_id=' + videoId, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: stringifyVariables({ __a: '1', fb_dtsg: dtsg }),
    });
    let text = await res.text();
    text = text.replace('for (;;);', '');
    const json = JSON.parse(text);
    const { hd_src, hd_src_no_ratelimit, sd_src, sd_src_no_ratelimit } = json?.payload || {};
    return hd_src_no_ratelimit || hd_src || sd_src_no_ratelimit || sd_src || null;
  }

  async function getLinkFbVideo1(videoId, dtsg) {
    const res = await fetchGraphQl('5279476072161634', {
      UFI2CommentsProvider_commentsKey: 'CometTahoeSidePaneQuery',
      caller: 'CHANNEL_VIEW_FROM_PAGE_TIMELINE',
      displayCommentsContextEnableComment: null,
      displayCommentsContextIsAdPreview: null,
      displayCommentsContextIsAggregatedShare: null,
      displayCommentsContextIsStorySet: null,
      displayCommentsFeedbackContext: null,
      feedbackSource: 41,
      feedLocation: 'TAHOE',
      focusCommentID: null,
      privacySelectorRenderLocation: 'COMET_STREAM',
      renderLocation: 'video_channel',
      scale: 1,
      streamChainingSection: false,
      useDefaultActor: false,
      videoChainingContext: null,
      videoID: videoId,
    }, dtsg);
    const text = await res.text();
    const firstLine = text.split('\n')[0];
    const a = JSON.parse(firstLine);
    return a?.data?.video?.playable_url_quality_hd || a?.data?.video?.playable_url || null;
  }

  async function getVideoUrlFromVideoId(videoId) {
    const dtsg = await getDtsg();
    try { return await getLinkFbVideo2(videoId, dtsg); }
    catch { return await getLinkFbVideo1(videoId, dtsg); }
  }

  // ======== Open in NEW TAB (robust) ========
  function openInNewTab(url, downloadName = null) {
    // 1) GM_openInTab (ổn định nhất trên mobile)
    if (typeof GM_openInTab === 'function') {
      GM_openInTab(url, { active: true, insert: true, setParent: true }); // luôn tab mới, foreground
      return true;
    }
    // 2) window.open
    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (win && !win.closed) {
      try { win.opener = null; } catch { }
      return true;
    }
    // 3) Fallback: <a target="_blank">
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (downloadName && FORCE_DIRECT_DOWNLOAD) a.download = downloadName; // optional
    document.body.appendChild(a);
    a.click();
    a.remove();
    return false;
  }

  function openVideo(url) {
    // Edge Mobile: ưu tiên VIEW trong tab mới để không đụng tab FB
    // Nếu bạn muốn tải ngay file: đặt FORCE_DIRECT_DOWNLOAD = true
    if (FORCE_DIRECT_DOWNLOAD) {
      return openInNewTab(url, 'fb_video.mp4');
    }
    return openInNewTab(url, null);
  }

  let clicking = false;
  async function openByVideoId(videoId) {
    if (!videoId) throw Error('Không tìm được videoId');
    if (clicking) return;
    clicking = true;
    showToast('Đang lấy link video…');
    try {
      const videoUrl = await getVideoUrlFromVideoId(videoId);
      if (!videoUrl) throw Error('Không lấy được link phát');
      openVideo(videoUrl); // <— mở sang TAB MỚI
      showToast('Đã mở video ở tab mới');
    } finally {
      setTimeout(() => clicking = false, 250);
    }
  }

  async function openWatchingVideo() {
    try {
      const list = await getWatchingVideoId();
      if (!list?.length) throw Error('Không tìm thấy video trong trang');
      for (const vid of list) await openByVideoId(vid);
    } catch (e) { alert('ERROR: ' + e); }
  }

  // ======== Find control bar & attach ========
  function isControlBarCandidate(el, vr) {
    const r = el.getBoundingClientRect();
    const nearBottom = (r.bottom <= vr.bottom + 4) && (vr.bottom - r.bottom < 120);
    const widthClose = r.width > vr.width * 0.9;
    const heightOk = r.height >= 28 && r.height <= 120;
    const hasButtons = el.querySelector('button,[role="button"],[aria-valuemin][aria-valuemax]');
    return nearBottom && widthClose && heightOk && hasButtons;
  }

  function findControlBar(video) {
    const vr = video.getBoundingClientRect();
    let el = video.parentElement;
    for (let d = 0; d < 6 && el; d++, el = el.parentElement) {
      const roleToolbar = el.querySelector('div[role="toolbar"]');
      if (roleToolbar && isControlBarCandidate(roleToolbar, vr)) return roleToolbar;

      const ariaCandidates = el.querySelectorAll('div[aria-label], div[role="group"]');
      for (const c of ariaCandidates) if (isControlBarCandidate(c, vr)) return c;

      const slider = el.querySelector('[aria-valuemin][aria-valuemax]');
      if (slider) {
        const bar = slider.parentElement || slider;
        if (isControlBarCandidate(bar, vr)) return bar;
      }

      const divs = el.querySelectorAll('div');
      for (const c of divs) if (isControlBarCandidate(c, vr)) return c;
    }
    return null;
  }

  function makeInBarButton(video) {
    const btn = document.createElement('div');
    btn.className = 'fbvdl-inbar';
    btn.setAttribute('title', 'Mở video ở tab mới');
    btn.setAttribute('draggable', 'false');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/>
      </svg>
    `.trim();

    // Click (capture) + fallback
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      try {
        let vid = getVideoIdFromVideoElement(video);
        if (!vid) {
          const list = await getWatchingVideoId();
          vid = list && list[0];
        }
        if (!vid) throw Error('Không tìm thấy videoId');
        await openByVideoId(vid);
      } catch (err) { alert('ERROR: ' + err); }
    }, { capture: true });

    return btn;
  }

  function attachInBar(video) {
    if (!video || video.dataset.fbvdlInBarAttached) return false;
    const bar = findControlBar(video);
    if (!bar) return false;
    if (bar.querySelector('.fbvdl-inbar')) { video.dataset.fbvdlInBarAttached = '1'; return true; }
    try { bar.appendChild(makeInBarButton(video)); }
    catch { return false; }
    video.dataset.fbvdlInBarAttached = '1';
    return true;
  }

  // ======== Overlay fallback (đặt sát đáy video) ========
  function attachOverlayBottom(video) {
    if (!video || video.dataset.fbvdlOverlayAttached) return;
    const wrap = document.createElement('div');
    wrap.className = 'fbvdl-wrap-fixed';

    const btn = document.createElement('div');
    btn.className = 'fbvdl-btn';
    btn.setAttribute('title', 'Mở video ở tab mới (giữ để mở)');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 12.59V4a1 1 0 0 1 1-1zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1z"/>
      </svg>
    `.trim();

    // Click: mở tab mới
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      try {
        let vid = getVideoIdFromVideoElement(video);
        if (!vid) {
          const list = await getWatchingVideoId();
          vid = list && list[0];
        }
        if (!vid) throw Error('Không tìm thấy videoId');
        await openByVideoId(vid);
      } catch (err) { alert('ERROR: ' + err); }
    }, { capture: true });

    wrap.appendChild(btn);
    document.body.appendChild(wrap);

    let rafId = 0;
    const track = () => {
      if (!document.contains(video)) { cancelAnimationFrame(rafId); wrap.remove(); return; }
      const r = video.getBoundingClientRect();
      wrap.style.top = r.top + 'px';
      wrap.style.left = r.left + 'px';
      wrap.style.width = r.width + 'px';
      wrap.style.height = r.height + 'px';
      rafId = requestAnimationFrame(track);
    };
    track();

    // Long-press: chỉ kích hoạt khi NHẢ (để giữ “user gesture”)
    let pressTimer = null, heldLong = false;
    const startLP = () => {
      heldLong = false;
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(() => { heldLong = true; }, LONG_PRESS_MS);
    };
    const endLP = async () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (!heldLong) return;
      try {
        let vid = getVideoIdFromVideoElement(video) || (await getWatchingVideoId())[0];
        if (!vid) throw Error('Không tìm thấy videoId');
        await openByVideoId(vid);
      } catch (err) { alert('ERROR: ' + err); }
    };

    // Mobile & desktop
    video.addEventListener('touchstart', startLP, { passive: true });
    video.addEventListener('touchend', endLP, { passive: false });
    video.addEventListener('touchcancel', () => { if (pressTimer) clearTimeout(pressTimer); }, { passive: true });
    video.addEventListener('mousedown', startLP, { passive: true });
    video.addEventListener('mouseup', endLP, { passive: false });
    video.addEventListener('mouseleave', () => { if (pressTimer) clearTimeout(pressTimer); }, { passive: true });

    video.dataset.fbvdlOverlayAttached = '1';
  }

  function attachButton(video) {
    const ok = attachInBar(video);
    if (!ok) attachOverlayBottom(video);
  }

  function scanAndAttach() {
    document.querySelectorAll('video').forEach(attachButton);
  }

  function observeVideoInsertion() {
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === 'childList' && m.addedNodes?.length) {
          m.addedNodes.forEach(node => {
            if (node?.nodeType === 1) {
              if (node.tagName === 'VIDEO') attachButton(node);
              else node.querySelectorAll?.('video').forEach(attachButton);
            }
          });
        }
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // ======== Keyboard & Menu ========
  function registerHotkeys() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && !e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); openWatchingVideo();
      }
    });
  }
  function resisterMenuCommand() {
    if (typeof GM_registerMenuCommand === 'function') {
      GM_registerMenuCommand('Open watching video in NEW TAB (Alt+D)', openWatchingVideo);
    }
  }

  // ======== Init ========
  function init() {
    ensureStyle();
    resisterMenuCommand();
    registerHotkeys();
    scanAndAttach();
    observeVideoInsertion();
  }

  init();
})();
