// ==UserScript==
// @name         Translate
// @namespace    translate
// @version      2.7.9
// @description  Swipe/hotkey translate. Video safe zone. Optimized for mobile.
// @author       you
// @match        http://*/*
// @match        https://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      generativelanguage.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  /* ================= CONFIG ================= */
  const K = 'inline_t_cfg::GLOBAL';
  const def = {
    provider: 'google', geminiKey: '', geminiModel: 'gemini-1.5-flash',
    hotkey: 'f2', swipeEnabled: true, swipeDir: 'both',
    swipePx: 60, swipeSlopeMax: 0.4,
    fontScale: 0.95, mutedColor: '#00bfff', bgBlend: 'transparent',
    dedupeSeconds: 0.7
  };
  let cfg = { ...def, ...JSON.parse(GM_getValue(K) || '{}') };
  const save = () => GM_setValue(K, JSON.stringify(cfg));

  /* ================= STYLES ================= */
  const sty = document.createElement('style');
  sty.textContent = `
    :root{--ilt-fs:${cfg.fontScale}em;--ilt-fg:${cfg.mutedColor};--ilt-bg:${cfg.bgBlend}}
    .ilt-panel{position:fixed;z-index:2147483647;top:10px;right:10px;background:#1a1a1ae6;border:1px solid #444;border-radius:12px;padding:12px;color:#eee;font:13px system-ui;max-width:320px;backdrop-filter:blur(6px)}
    .ilt-row{display:flex;justify-content:space-between;margin:8px 0;gap:10px}
    .ilt-panel input,.ilt-panel select{background:#333;border:1px solid #555;color:#fff;border-radius:4px;padding:4px;max-width:140px}
    .ilt-btn{width:100%;margin-top:10px;padding:8px;background:#0079d3;border:none;border-radius:4px;color:#fff;cursor:pointer}
    .ilt-trans-container{margin:8px 0;width:100%;animation:iF .2s;border-top:1px dashed #444;padding-top:6px}
    .ilt-trans{padding:6px 12px;background:var(--ilt-bg);color:var(--ilt-fg);font:italic var(--ilt-fs)/1.6 system-ui;white-space:pre-wrap}
    .ilt-meta{font-size:.75em;opacity:.6}
    @keyframes iF{from{transform:translateY(-5px);opacity:0}to{transform:none;opacity:1}}
  `;
  document.head.appendChild(sty);

  /** Update CSS variables without reloading */
  function applyCSSVars() {
    const r = document.documentElement.style;
    r.setProperty('--ilt-fs', cfg.fontScale + 'em');
    r.setProperty('--ilt-fg', cfg.mutedColor);
    r.setProperty('--ilt-bg', cfg.bgBlend);
  }

  /* ================= TEXT DETECTION ================= */
  const isReddit = location.hostname.includes('reddit.com');
  const R_DEEP = ['div[id$="-post-rtjson-content"]', '.md', '[data-post-click-location="text-body"] > div', '[slot="text-body"] div', '[slot="text-body"]'];
  const VALID_TAGS = /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV|SPAN|A|ARTICLE|LABEL|SECTION|ASIDE|FIGURE|DETAILS|SUMMARY|CODE|NAV|HEADER|FOOTER|MAIN|MARK)$/;

  function getBlock(el) {
    if (!el || el === document.body) return null;

    // Reddit: find post/comment content
    if (isReddit) {
      const post = el.closest('shreddit-post');
      if (post) {
        const body = post.querySelector('shreddit-post-text-body');
        if (body) {
          for (const s of R_DEEP) {
            const c = body.querySelector(s);
            if (c?.innerText.trim()) return { t: c.innerText.trim(), n: c };
          }
          if (body.innerText.trim()) return { t: body.innerText.trim(), n: body };
        }
        const title = post.querySelector('[slot="title"]');
        if (title?.innerText.trim()) return { t: title.innerText.trim(), n: title };
      }
      const comment = el.closest('shreddit-comment');
      if (comment) {
        const c = comment.querySelector('.md, [slot="comment"]');
        if (c?.innerText.trim()) return { t: c.innerText.trim(), n: c };
      }
    }

    // Generic: walk up to find text block
    let cur = el;
    while (cur && cur !== document.body) {
      if (cur.style.display === 'none') { cur = cur.parentElement; continue; }
      const txt = (cur.innerText || '').trim();
      if (VALID_TAGS.test(cur.tagName) && txt.length > 0 && txt.length < 5000) {
        // Large DIV with many children → find closest smaller child instead of going up
        if (cur.tagName === 'DIV' && txt.length > 500 && cur.children.length > 5) {
          const child = [...cur.children].find(c => {
            const ct = (c.innerText || '').trim();
            return VALID_TAGS.test(c.tagName) && ct.length > 0 && ct.length < 500;
          });
          if (child) return { t: child.innerText.trim(), n: child };
          // No suitable child → just use current text (capped)
          return { t: txt.slice(0, 2000), n: cur };
        }
        return { t: txt, n: cur };
      }
      cur = cur.parentElement;
    }
    return null;
  }

  function hit(x, y) {
    for (const el of document.elementsFromPoint(x, y)) {
      if (el.closest('.ilt-trans-container')) continue;
      if (isReddit && el.tagName === 'A' && el.classList.contains('absolute')) continue;
      const b = getBlock(el);
      if (b) return b;
    }
    return null;
  }

  /* ================= TRANSLATION ================= */
  const CACHE_MAX = 200;
  const cache = new Map(); // key: text → value: { result, ts }
  const JUNK = /[\s\d\p{P}\p{S}\p{M}\p{C}\u200B-\u200D\uFEFF]/gu;
  const hasMeaningful = txt => txt.replace(JUNK, '').length > 0;
  const cleanJunk = txt => txt.replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gmu, '').replace(/\n{3,}/g, '\n\n').trim();
  const parseGT = r => r?.[0]?.map(x => x[0]).join('') || '';

  /** Evict oldest entries when cache exceeds max size */
  function trimCache() {
    if (cache.size <= CACHE_MAX) return;
    const sorted = [...cache.entries()].sort((a, b) => a[1].ts - b[1].ts);
    const toDelete = sorted.slice(0, cache.size - CACHE_MAX);
    for (const [k] of toDelete) cache.delete(k);
  }

  /** Create translation container with optional text */
  function mkTransBox(text) {
    const w = document.createElement('div');
    w.className = 'ilt-trans-container';
    const inner = document.createElement('div');
    inner.className = 'ilt-trans';
    if (text) {
      inner.textContent = text;
    } else {
      inner.innerHTML = '<span class="ilt-meta">…</span>';
    }
    w.appendChild(inner);
    return w;
  }

  /** Check if node or parent clips overflow (translation would be hidden) */
  function isClipped(el) {
    for (let n = el, i = 0; n && n !== document.body && i < 3; n = n.parentElement, i++) {
      const s = getComputedStyle(n);
      if (/hidden|scroll|auto|clip/.test(s.overflow + s.overflowY)) return true;
      if (s.maxHeight && s.maxHeight !== 'none') return true;
    }
    return false;
  }

  /** Insert translation box: after node if clipped, else as child */
  function insertTrans(node, w) {
    if (isClipped(node)) {
      node.insertAdjacentElement('afterend', w);
    } else {
      node.appendChild(w);
    }
  }

  /** Find existing translation (child or next sibling) */
  function findTrans(node) {
    return node.querySelector(':scope > .ilt-trans-container')
      || (node.nextElementSibling?.classList.contains('ilt-trans-container') ? node.nextElementSibling : null);
  }

  async function trans(txt, node) {
    // Toggle: remove existing translation
    const existing = findTrans(node);
    if (existing) { existing.remove(); return; }

    if (!hasMeaningful(txt)) return;

    // Check cache
    const cached = cache.get(txt);
    const now = Date.now();
    if (cached?.result) {
      if (now - cached.ts < cfg.dedupeSeconds * 1000) return;
      cached.ts = now;
      insertTrans(node, mkTransBox(cached.result));
      return;
    }

    // Dedupe pending requests
    if (cached && now - cached.ts < cfg.dedupeSeconds * 1000) return;
    cache.set(txt, { result: null, ts: now });

    const w = mkTransBox();
    insertTrans(node, w);

    try {
      let res;
      if (cfg.provider === 'gemini' && cfg.geminiKey) {
        const lang = /[àáảãạăằắẳẵặâầấẩẫậ]/.test(txt) ? 'English' : 'Vietnamese';
        res = await new Promise((ok, fail) => GM_xmlhttpRequest({
          method: 'POST',
          url: `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`,
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ contents: [{ parts: [{ text: `Translate to ${lang}:\n${txt}` }] }] }),
          onload: e => {
            try {
              const data = JSON.parse(e.responseText);
              const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
              if (text) ok(text);
              else fail(new Error('Empty Gemini response: ' + e.responseText.slice(0, 200)));
            } catch (x) { fail(x); }
          },
          onerror: () => fail(new Error('Gemini network error'))
        }));
      } else {
        const gtUrl = tl => `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(txt)}`;
        const gtReq = tl => new Promise((ok, fail) => GM_xmlhttpRequest({
          method: 'GET', url: gtUrl(tl),
          onload: e => { try { ok(JSON.parse(e.responseText)); } catch (x) { fail(x); } },
          onerror: () => fail(new Error('Google Translate network error'))
        }));
        const r1 = await gtReq('vi');
        res = r1?.[2] === 'vi' ? parseGT(await gtReq('en')) : parseGT(r1);
      }
      const cleaned = cleanJunk(res);
      if (!cleaned) { w.remove(); return; }

      cache.set(txt, { result: cleaned, ts: Date.now() });
      trimCache();

      w.firstChild.textContent = cleaned;
    } catch (e) {
      console.error('[Translate]', e);
      w.textContent = 'Err';
      setTimeout(() => w.remove(), 2000);
    }
  }

  function act(x, y) {
    const h = hit(x, y);
    if (h) trans(h.t, h.n);
  }

  /* ================= VIDEO SAFE ZONE ================= */
  const inRect = (x, y, el) => { const r = el.getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
  const inVideoZone = (x, y) =>
    [...document.querySelectorAll('video')].some(v => v.offsetWidth && inRect(x, y, v)) ||
    [...document.querySelectorAll('iframe')].some(f => f.offsetWidth && inRect(x, y, f) && /youtube|vimeo|dailymotion|twitch|facebook.*video|tiktok/i.test(f.src)) ||
    document.elementsFromPoint(x, y).some(el => el.closest?.('video, .html5-video-player, .jwplayer, .vjs-tech, .plyr, .flowplayer'));

  /* ================= INPUT HANDLERS ================= */
  // Mouse position (desktop only)
  let lx = 0, ly = 0;
  if (!('ontouchstart' in window)) {
    document.addEventListener('mousemove', e => { lx = e.clientX; ly = e.clientY; }, { passive: true });
  }

  // Keyboard
  document.addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const k = cfg.hotkey;
    if ((k === 'f2' && e.code === 'F2') || (k === 'f4' && e.code === 'F4') || (k === 'f8' && e.code === 'F8')) { e.preventDefault(); act(lx, ly); }
    if (e.shiftKey && e.altKey && e.code === 'KeyX') ui();
  });

  // Swipe (mobile)
  let sx = 0, sy = 0, t0 = 0, sVid = false;

  document.addEventListener('touchstart', e => {
    if (!cfg.swipeEnabled || e.touches.length !== 1) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    t0 = Date.now(); sVid = inVideoZone(sx, sy);
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!cfg.swipeEnabled || !sx || Date.now() - t0 > 500) { sx = 0; return; }
    const ex = e.changedTouches[0].clientX, ey = e.changedTouches[0].clientY;
    if (sVid || inVideoZone(ex, ey)) { sx = 0; return; }
    const dx = ex - sx, dy = ey - sy; sx = 0;
    if (Math.abs(dx) > cfg.swipePx && Math.abs(dy) < Math.abs(dx) * cfg.swipeSlopeMax &&
      (cfg.swipeDir === 'both' || (cfg.swipeDir === 'right' && dx > 0) || (cfg.swipeDir === 'left' && dx < 0)))
      act(ex - dx / 2, ey - dy / 2);
  }, { passive: true });

  /* ================= SETTINGS UI ================= */
  function ui() {
    if (document.querySelector('.ilt-panel')) return;

    const p = document.createElement('div');
    p.className = 'ilt-panel';
    p.innerHTML = `
      <h3>Cài đặt Dịch</h3>
      <div class="ilt-row"><label>Mode</label><select id="pm"><option value="google">Google</option><option value="gemini">Gemini</option></select></div>
      <div class="ilt-row"><label>Phím tắt</label><select id="ph"><option value="f2">F2</option><option value="f4">F4</option><option value="f8">F8</option></select></div>
      <div class="ilt-row"><label>Vuốt</label><select id="ps"><option value="both">Cả hai</option><option value="right">Sang phải</option><option value="left">Sang trái</option><option value="none">Tắt</option></select></div>
      <div class="ilt-row"><label>Cỡ chữ</label><input id="pfs" type="number" step="0.05" min="0.5" max="2" style="width:60px"></div>
      <div class="ilt-row"><label>Màu chữ</label><input id="pc" type="color"></div>
      <div class="ilt-row"><label>Model</label><input id="pmd" type="text" placeholder="gemini-1.5-flash" style="width:100%"></div>
      <div class="ilt-row"><input id="pk" type="password" placeholder="Gemini API Key" style="width:100%"></div>
      <button class="ilt-btn" id="sv">Lưu & Áp dụng</button>
    `;
    document.body.appendChild(p);

    const $ = i => p.querySelector(i);
    $('#pm').value = cfg.provider;
    $('#ph').value = cfg.hotkey;
    $('#ps').value = cfg.swipeEnabled ? cfg.swipeDir : 'none';
    $('#pk').value = cfg.geminiKey;
    $('#pmd').value = cfg.geminiModel;
    $('#pfs').value = cfg.fontScale;
    $('#pc').value = cfg.mutedColor;

    $('#sv').onclick = () => {
      cfg.provider = $('#pm').value;
      cfg.hotkey = $('#ph').value;
      cfg.geminiKey = $('#pk').value;
      cfg.geminiModel = $('#pmd').value.trim() || 'gemini-1.5-flash';
      cfg.fontScale = parseFloat($('#pfs').value) || 0.95;
      cfg.mutedColor = $('#pc').value;

      const s = $('#ps').value;
      cfg.swipeEnabled = s !== 'none';
      if (s !== 'none') cfg.swipeDir = s;

      save();
      applyCSSVars(); // Realtime update — no reload needed
      p.remove();
    };

    p.onclick = e => { if (e.target === p) p.remove(); };
  }

  GM_registerMenuCommand('Settings', ui);
})();
