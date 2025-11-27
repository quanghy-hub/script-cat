// ==UserScript==
// @name         YouTube
// @namespace    yt-tools-merged
// @version      2.3.2
// @description  Screenshot button + dual subtitles (English + Vietnamese) for YouTube.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini|webp|webm)[^\/]*$/
// @exclude      /^https?://\S+_live_chat*$/
// @require      https://cdn.jsdelivr.net/gh/culefa/xhProxy@eaa2e84b40290fc63af1ca777f3f545008bf79bb/dist/xhProxy.min.js
// @grant        none
// @inject-into  page
// @allFrames    true
// @run-at       document-start
// ==/UserScript==

/* global xhProxy */

// ---------- Dual Subtitles: Always show EN + VI ----------
(() => {
  if (location.pathname === '/live_chat' || location.pathname === '/live_chat_replay') return;

  let requestDeferred = Promise.resolve();

  const inPlaceArrayPush = (() => {
    const LIMIT_N = typeof AbortSignal !== 'undefined' && typeof (AbortSignal || 0).timeout === 'function' ? 50000 : 10000;
    return (dest, source) => {
      let i = 0, len = source.length;
      while (i < len) {
        const n = Math.min(LIMIT_N, len - i);
        dest.push(...source.slice(i, i + n));
        i += n;
      }
    };
  })();

  const encodeFW = t => t.replace(/\n/g, '\n®\n').replace(/\u3000/g, '\n©\n');
  const decodeFW = t => t.replace(/\n©\n/g, '\u3000').replace(/\n®\n/g, '\n');

  xhProxy.hook({
    onConfig(xhr, config) {
      const u = config.url || '';
      if (!u.includes('/api/timedtext') || u.includes('&translate_h00ked')) {
        this.byPassRequest = true;
      }
    },
    async onResponse(xhr, config) {
      const url = config.url || '';
      if (!url.includes('/api/timedtext') || url.includes('&translate_h00ked')) return;

      const j = xhr.xhJson;
      if (!j || !j.events) return;

      // Lấy nội dung phụ đề gốc
      const lines = [];
      for (const ev of j.events) {
        if (!ev.segs) continue;
        for (const seg of ev.segs) {
          if (seg && typeof seg.utf8 === 'string') {
            inPlaceArrayPush(lines, seg.utf8.split('\n'));
          }
        }
      }
      if (!lines.length) return;

      // Dịch SANG TIẾNG VIỆT (luôn luôn)
      const reqVI =
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dj=1&dt=t&dt=rm&q=' +
        encodeURIComponent(encodeFW(lines.join('\n'))) +
        '&ie=UTF-8&oe=UTF-8';

      const run = () =>
        fetch(reqVI, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer' })
          .then(r => r.json())
          .then(r => {
            if (!r || !r.sentences) throw new Error('No translation to VI');
            return decodeFW(r.sentences.map(s => ('trans' in s ? s.trans : '')).join('')).split('\n');
          })
          .then(trVI => {
            // Bắt đầu ghép: [Gốc] + [Tiếng Việt]
            let i = 0;
            for (const ev of j.events) {
              if (!ev.segs) continue;
              for (const seg of ev.segs) {
                if (seg && typeof seg.utf8 === 'string') {
                  const src = seg.utf8.split('\n');
                  const out = src.map((line, k) => {
                    const srcLine = lines[i + k];
                    const tlVI = trVI[i + k] || '';
                    if (line !== srcLine) return line; // bảo toàn format
                    if (!tlVI || tlVI === line) return line;
                    return line + '\n' + tlVI; // Dòng gốc + Dòng TIẾNG VIỆT
                  });
                  seg.utf8 = out.join('\n');
                  i += src.length;
                }
              }
            }
            xhr.xhJson = j;
          })
          .catch(err => {
            console.warn('Dịch sang tiếng Việt thất bại:', err);
          });

      requestDeferred = requestDeferred.then(run);
      await requestDeferred;
    }
  });
})();

// ---------- Screenshot Button (điều chỉnh lại, không lệch) ----------
(() => {
  if (window.top !== window) return;

  function addButton() {
    const controls = document.querySelector('.ytp-right-controls');
    if (!controls || document.querySelector('.ytp-screenshot-button')) return;

    const btn = document.createElement('button');
    btn.className = 'ytp-button ytp-screenshot-button';
    btn.title = 'Take screenshot';

    // Chỉ chỉnh nhẹ, không đẩy icon lên quá cao
    btn.style.position = 'relative';
    btn.style.bottom = '0px';      // trước đây là 12px → gây lệch
    btn.style.width = '44px';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 487 487');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('fill', '#ffffff');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M308.1,277.95c0,35.7-28.9,64.6-64.6,64.6s-64.6-28.9-64.6-64.6s28.9-64.6,64.6-64.6S308.1,242.25,308.1,277.95z M440.3,116.05c25.8,0,46.7,20.9,46.7,46.7v122.4v103.8c0,27.5-22.3,49.8-49.8,49.8H49.8c-27.5,0-49.8-22.3-49.8-49.8v-103.9 v-122.3l0,0c0-25.8,20.9-46.7,46.7-46.7h93.4l4.4-18.6c6.7-28.8,32.4-49.2,62-49.2h74.1c29.6,0,55.3,20.4,62,49.2l4.3,18.6H440.3z M97.4,183.45c0-12.9-10.5,23.4-23.4,23.4c-13,0-23.5-10.5-23.5,23.4s10.5,23.4,23.4,23.4C86.9,206.95,97.4,196.45,97.4,183.45z M358.7,277.95c0-63.6-51.6-115.2-115.2-115.2s-115.2,51.6-115.2,115.2s51.6,115.2,115.2,115.2S358.7,341.55,358.7,277.95z'
    );
    svg.appendChild(path);
    btn.appendChild(svg);

    btn.addEventListener('click', () => {
      const video = document.querySelector('video');
      if (!video) return;
      const c = document.createElement('canvas');
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      const name = (document.title.replace(/\s-\sYouTube$/, '').trim() || 'screenshot') + '.png';
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = name;
      a.click();
    });

    controls.insertBefore(btn, controls.firstChild);
  }

  function onFS() {
    const btn = document.querySelector('.ytp-screenshot-button');
    if (!btn) return;
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    // Khi fullscreen nhích nhẹ 1–3px cho cân, KHÔNG đẩy quá cao
    btn.style.bottom = fs ? '3px' : '0px';
  }

  function tryInit() {
    if (!/\/watch/.test(location.pathname) && !/\bwatch\?v=/.test(location.href)) return;
    addButton();
  }

  document.addEventListener('fullscreenchange', onFS);
  document.addEventListener('yt-navigate-finish', tryInit);

  const mo = new MutationObserver(() => {
    if (document.querySelector('.ytp-right-controls')) {
      tryInit();
      mo.disconnect();
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(tryInit, 0);
  } else {
    window.addEventListener('DOMContentLoaded', tryInit, { once: true });
  }
})();
