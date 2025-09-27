// ==UserScript==
// @name         Quick Search
// @namespace    qsb.search.bubble
// @version      1.6.1
// @description  Bôi đen: bong bóng 10 icon (8 nhà cung cấp + Copy + Select all). Ảnh: di chuột/ấn lâu/chuột phải hiện 3 icon (Tải, Copy URL, Tìm ảnh). Không có icon Cài đặt trên bong bóng; chỉ mở cài đặt qua menu ScriptCat.
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/serch.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/serch.js
// @exclude      *://mail.google.com/*
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_download
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const STORE_KEY = 'qsb.providers.v4';
  const CFG_KEY   = 'qsb.cfg.v1';
  const OFFSET_Y  = 8;

  const getCfg = () => {
    try {
      const d = GM_getValue(CFG_KEY);
      if (!d) return { from: 'auto', to: 'vi' };
      const j = JSON.parse(d);
      return { from: j.from || 'auto', to: j.to || 'vi' };
    } catch { return { from: 'auto', to: 'vi' }; }
  };
  const setCfg = (cfg) => GM_setValue(CFG_KEY, JSON.stringify(cfg || {}));

  const defaultProviders = () => {
    const { from, to } = getCfg();
    return [
      { name: 'Google',     url: 'https://www.google.com/search?q={{q}}',                           icon: 'https://www.google.com/favicon.ico' },
      { name: 'YouTube',    url: 'https://www.youtube.com/results?search_query={{q}}',              icon: 'https://www.youtube.com/favicon.ico' },
      { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={{q}}',                                 icon: 'https://duckduckgo.com/favicon.ico' },
      { name: 'Bing',       url: 'https://www.bing.com/search?q={{q}}',                             icon: 'https://www.bing.com/favicon.ico' },
      { name: 'Ảnh Google', url: 'https://www.google.com/search?tbm=isch&q={{q}}',                  icon: 'https://www.google.com/favicon.ico' },
      { name: 'Bằng ảnh',   url: 'https://www.google.com/searchbyimage?image_url={{img}}',          icon: 'https://www.google.com/favicon.ico' },
      { name: 'Dịch (GG)',  url: 'https://translate.google.com/?sl={{from}}&tl={{to}}&text={{q}}&op=translate', icon: 'https://translate.google.com/favicon.ico' },
      { name: 'Perplexity', url: 'https://www.perplexity.ai/?q={{q}}',                              icon: 'https://www.perplexity.ai/favicon.ico' },
    ];
  };

  const getProviders = () => {
    try {
      const saved = GM_getValue(STORE_KEY);
      if (!saved) return defaultProviders();
      const arr = JSON.parse(saved);
      return Array.isArray(arr) && arr.length ? arr.slice(0,8) : defaultProviders();
    } catch { return defaultProviders(); }
  };
  const setProviders = (arr) => GM_setValue(STORE_KEY, JSON.stringify((arr||[]).slice(0,8)));

  const escQ = (s) => encodeURIComponent(String(s||'').trim().replace(/\s+/g,' '));
  const escHTML = (s='') => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const rectToPageXY = (rect) => ({ x: rect.left + scrollX, y: rect.bottom + scrollY });

  const copyText = async (txt) => {
    try { await navigator.clipboard.writeText(txt); return true; }
    catch {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta);
        ta.select(); document.execCommand('copy'); ta.remove(); return true;
      } catch { return false; }
    }
  };

  const selectAllSmart = () => {
    const ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
      try { ae.focus(); ae.select(); return true; } catch {}
    }
    try {
      const sel = getSelection?.(); if (!sel) return false;
      sel.removeAllRanges();
      const r = document.createRange();
      r.selectNodeContents(document.body || document.documentElement);
      sel.addRange(r);
      return true;
    } catch { return false; }
  };

  const filenameFromUrl = (u) => {
    try {
      const url = new URL(u, location.href);
      const name = url.pathname.split('/').pop() || 'image';
      const clean = name.split('?')[0].split('#')[0] || 'image';
      return clean.match(/\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i) ? clean : (clean + '.jpg');
    } catch { return 'image.jpg'; }
  };

  const downloadImage = (src) => {
    if (typeof GM_download === 'function') {
      try {
        GM_download({ url: src, name: filenameFromUrl(src), saveAs: false, onerror: ()=>fallback(), ontimeout: ()=>fallback() });
        return true;
      } catch {}
    }
    return fallback();
    function fallback(){
      GM_openInTab(src, {active:true, insert:true, setParent:true});
      return false;
    }
  };

  GM_addStyle(`
    .qsb-bubble{
      position:absolute; z-index:2147483646; display:inline-block;
      background:#101114;color:#fff;border:1px solid #2a2d33;border-radius:12px;
      padding:8px 10px 10px 10px; box-shadow:0 8px 22px rgba(0,0,0,.28)
    }
    .qsb-icons{ display:grid; grid-auto-rows:32px; gap:8px; }
    .qsb-item{ width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid transparent; user-select:none }
    .qsb-item:hover{ background:#1b1e24;border-color:#2d3138 }
    .qsb-item img{ width:18px;height:18px; object-fit:contain }
    .qsb-item .glyph{ font:16px/1 system-ui }
    .qsb-config{position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:2147483647}
    .qsb-config.show{display:flex}
    .qsb-backdrop{position:absolute; inset:0; background:rgba(0,0,0,.45)}
    .qsb-panel{position:relative; background:#0f1115; color:#e6e6e6; width:min(640px,92vw);
      border:1px solid #2a2d33; border-radius:12px; padding:14px 16px; box-shadow:0 10px 30px rgba(0,0,0,.35)}
    .qsb-panel h3{margin:0 0 10px; font:600 15px/1.4 system-ui}
    .qsb-grid{display:grid; grid-template-columns: 1fr 2fr 2fr; gap:6px; align-items:center}
    .qsb-grid input, .qsb-grid select{width:100%; padding:5px 7px; background:#12151b; border:1px solid #2a2d33; border-radius:8px; color:#e6e6e6; font:13px/1.3 system-ui}
    .qsb-grid label{font:12px/1.4 system-ui; opacity:.85}
    .qsb-actions{display:flex; gap:8px; justify-content:flex-end; margin-top:10px}
    .qsb-btn{padding:7px 10px; border:1px solid #2a2d33; border-radius:10px; background:#151923; color:#e6e6e6; cursor:pointer; font:13px/1 system-ui}
    .qsb-btn.primary{background:#1f6feb; border-color:#1f6feb; color:#fff}
    .qsb-hint{font:12px/1.4 system-ui; opacity:.8; margin:8px 0 0}
    .qsb-small{font:11px/1.4 system-ui; opacity:.7}
    .qsb-toast{position:fixed; padding:6px 10px; background:#151923; color:#e6e6e6; border:1px solid #2a2d33; border-radius:8px; font:12px/1 system-ui; z-index:2147483647; opacity:.98}
  `);

  let bubble, iconGrid, lastCtx = null, selTimer = null;
  let hoverTimer = null, hoverHideTimer = null, hoverImgEl = null;

  function ensureBubble(){
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.className = 'qsb-bubble';
    bubble.style.display = 'none';

    iconGrid = document.createElement('div');
    iconGrid.className = 'qsb-icons';
    bubble.appendChild(iconGrid);

    bubble.addEventListener('mouseenter', () => { clearTimeout(hoverHideTimer); });
    bubble.addEventListener('mouseleave', () => {
      if (!hoverImgEl || !hoverImgEl.matches(':hover')) hideBubble();
    });

    document.body.appendChild(bubble);
    return bubble;
  }
  function hideBubble(){ if (bubble) bubble.style.display = 'none'; lastCtx = null; }

  function toast(msg, x, y){
    const el = document.createElement('div');
    el.className = 'qsb-toast';
    el.textContent = msg;
    el.style.left = Math.min(x, scrollX + innerWidth - 200) + 'px';
    el.style.top  = Math.max(6, y - 36) + 'px';
    document.body.appendChild(el);
    setTimeout(()=>el.remove(), 1200);
  }

  // helper: tìm provider dùng {{img}} cho “Tìm ảnh”
  function findImageSearchProvider() {
    const p = getProviders();
    const byName = p.find(x => /bằng ảnh/i.test(x.name||''));
    if (byName) return byName;
    const byTpl = p.find(x => /\{\{img\}\}/.test(x.url||''));
    if (byTpl) return byTpl;
    return { name: 'Bằng ảnh', url: 'https://www.google.com/searchbyimage?image_url={{img}}', icon: 'https://www.google.com/favicon.ico' };
  }

  function buildBubble(ctx){
    ensureBubble();
    iconGrid.innerHTML = '';
    const providers = getProviders();
    const { from, to } = getCfg();

    const items = [];

    if (ctx.type === 'text') {
      // 10 icon: Copy + Select all + 8 providers
      items.push({
        title: 'Copy',
        html: `<span class="glyph">⧉</span>`,
        onClick: async () => {
          const ok = await copyText(String(ctx.text||''));
          hideBubble();
          toast(ok ? 'Đã copy' : 'Copy lỗi', ctx.x, ctx.y);
        }
      });
      items.push({
        title: 'Select all',
        html: `<span class="glyph">⤢</span>`,
        onClick: () => {
          const ok = selectAllSmart();
          toast(ok ? 'Đã chọn hết' : 'Không chọn được', ctx.x, ctx.y);
        }
      });
      providers.forEach((p)=>{
        items.push({
          title: p.name || '',
          html: p.icon ? `<img src="${p.icon}" alt="${p.name||''}">` : `<span class="glyph">🔗</span>`,
          onClick: () => {
            const q  = escQ(ctx.text);
            const u  = (p.url||'')
              .replaceAll('{{q}}', q)
              .replaceAll('{{img}}', '')
              .replaceAll('{{from}}', encodeURIComponent(from))
              .replaceAll('{{to}}',   encodeURIComponent(to));
            if (u) GM_openInTab(u, {active:true, insert:true, setParent:true});
            hideBubble();
          }
        });
      });
    } else if (ctx.type === 'image') {
      // 3 icon: Tải, Copy URL, Tìm ảnh
      const imgProv = findImageSearchProvider();
      items.push({
        title: 'Tải ảnh',
        html: `<span class="glyph">⬇</span>`,
        onClick: () => {
          const ok = downloadImage(ctx.img);
          hideBubble();
          toast(ok ? 'Đang tải / mở ảnh' : 'Mở ảnh để lưu', ctx.x, ctx.y);
        }
      });
      items.push({
        title: 'Copy URL',
        html: `<span class="glyph">⧉</span>`,
        onClick: async () => {
          const ok = await copyText(String(ctx.img||''));
          hideBubble();
          toast(ok ? 'Đã copy URL' : 'Copy lỗi', ctx.x, ctx.y);
        }
      });
      items.push({
        title: imgProv.name || 'Tìm ảnh',
        html: imgProv.icon ? `<img src="${imgProv.icon}" alt="${imgProv.name||''}">` : `<span class="glyph">🔗</span>`,
        onClick: () => {
          const im = encodeURIComponent(ctx.img);
          const u  = (imgProv.url||'')
            .replaceAll('{{q}}', '')
            .replaceAll('{{img}}', im)
            .replaceAll('{{from}}', encodeURIComponent(from))
            .replaceAll('{{to}}',   encodeURIComponent(to));
          if (u) GM_openInTab(u, {active:true, insert:true, setParent:true});
          hideBubble();
        }
      });
    }

    // render items
    const cols = Math.min(5, Math.max(1, items.length));
    iconGrid.style.gridTemplateColumns = `repeat(${cols}, 32px)`;
    items.forEach(it => {
      const btn = document.createElement('div');
      btn.className = 'qsb-item';
      btn.title = it.title || '';
      btn.innerHTML = it.html;
      btn.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); it.onClick?.(); });
      iconGrid.appendChild(btn);
    });
  }

  function placeAndShow(x,y){
    ensureBubble();
    bubble.style.visibility = 'hidden';
    bubble.style.display = 'inline-block';
    const w = bubble.offsetWidth || 0;
    const h = bubble.offsetHeight || 0;
    const left = Math.max(6, Math.min(x, scrollX + innerWidth - w - 6));
    const top  = Math.max(6, Math.min(y, scrollY + innerHeight - h - 6));
    bubble.style.left = left + 'px';
    bubble.style.top  = top  + 'px';
    bubble.style.visibility = 'visible';
  }

  // selection → show below
  function selectionRect(){
    const sel = getSelection?.(); if (!sel || sel.rangeCount===0) return null;
    if (!String(sel).trim()) return null;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r || (r.width===0 && r.height===0)) return null;
    return r;
  }
  function handleSelectionShow(){
    const rect = selectionRect();
    if (!rect){ hideBubble(); return; }
    const {x,y} = rectToPageXY(rect);
    const text = String(getSelection());
    lastCtx = { type:'text', text, x, y: y + OFFSET_Y };
    buildBubble(lastCtx);
    placeAndShow(lastCtx.x, lastCtx.y);
  }
  document.addEventListener('selectionchange', ()=>{
    clearTimeout(selTimer);
    selTimer = setTimeout(handleSelectionShow, 90);
  });

  // helper: tìm IMG thật, loại trừ phần tử trong bubble để tránh nhảy
  const getImgFromTarget = (t) => {
    if (!(t instanceof Element)) return null;
    if (t.closest('.qsb-bubble')) return null;
    if (t.tagName === 'IMG') return t;
    const pic = t.closest('picture');
    if (pic && !pic.closest('.qsb-bubble')) return pic.querySelector('img');
    return null;
  };

  // context menu trên ảnh
  document.addEventListener('contextmenu', (ev)=>{
    if (ev.target instanceof Element && ev.target.closest('.qsb-bubble')) return;
    const img = getImgFromTarget(ev.target);
    if (!img) return;
    const src = img.currentSrc || img.src;
    if (!src) return;
    ev.preventDefault();
    lastCtx = { type:'image', img: src, x: ev.pageX + 6, y: ev.pageY + 6 };
    buildBubble(lastCtx);
    placeAndShow(lastCtx.x, lastCtx.y);
  }, {capture:true});

  // long-press trên ảnh
  (function enableImageLongPress(){
    let pressTimer = null, startX=0, startY=0, targetImg=null;
    const HOLD_MS = 450, MOVE_CANCEL_PX = 6;

    const onDown = (ev) => {
      if (ev.target instanceof Element && ev.target.closest('.qsb-bubble')) return;
      const img = getImgFromTarget(ev.target);
      if (!img) return;
      targetImg = img;
      startX = (ev.touches?.[0]?.pageX) ?? ev.pageX;
      startY = (ev.touches?.[0]?.pageY) ?? ev.pageY;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(()=>{
        if (!targetImg) return;
        const src = targetImg.currentSrc || targetImg.src;
        if (!src) return;
        const x = startX + 6, y = startY + 6;
        lastCtx = { type:'image', img: src, x, y };
        buildBubble(lastCtx);
        placeAndShow(x, y);
      }, HOLD_MS);
    };
    const onMove = (ev) => {
      if (!pressTimer) return;
      const x = (ev.touches?.[0]?.pageX) ?? ev.pageX;
      const y = (ev.touches?.[0]?.pageY) ?? ev.pageY;
      if (Math.abs(x-startX) > MOVE_CANCEL_PX || Math.abs(y-startY) > MOVE_CANCEL_PX) {
        clearTimeout(pressTimer); pressTimer = null; targetImg=null;
      }
    };
    const onUpOrCancel = () => { clearTimeout(pressTimer); pressTimer = null; targetImg=null; };

    document.addEventListener('pointerdown', onDown, {passive:true, capture:true});
    document.addEventListener('pointermove', onMove, {passive:true, capture:true});
    document.addEventListener('pointerup', onUpOrCancel, {passive:true, capture:true});
    document.addEventListener('pointercancel', onUpOrCancel, {passive:true, capture:true});
    document.addEventListener('scroll', onUpOrCancel, {passive:true, capture:true});
  })();

  // hover chuột lên ảnh
  document.addEventListener('pointerenter', (ev)=>{
    if (ev.pointerType !== 'mouse') return;
    if (ev.target instanceof Element && ev.target.closest('.qsb-bubble')) return;
    const img = getImgFromTarget(ev.target);
    if (!img) return;
    hoverImgEl = img;
    clearTimeout(hoverHideTimer);
    clearTimeout(hoverTimer);
    const px = ev.pageX || (ev.clientX + scrollX);
    const py = ev.pageY || (ev.clientY + scrollY);
    hoverTimer = setTimeout(()=>{
      const src = img.currentSrc || img.src;
      if (!src) return;
      lastCtx = { type:'image', img: src, x: px + 6, y: py + 6 };
      buildBubble(lastCtx);
      placeAndShow(lastCtx.x, lastCtx.y);
    }, 120);
  }, {capture:true});

  document.addEventListener('pointerleave', (ev)=>{
    if (ev.pointerType !== 'mouse') return;
    const img = getImgFromTarget(ev.target);
    if (!img) return;
    if (img === hoverImgEl) {
      clearTimeout(hoverTimer);
      hoverHideTimer = setTimeout(()=>{
        if (!bubble || !bubble.matches(':hover')) hideBubble();
      }, 220);
    }
  }, {capture:true});

  // dismiss
  document.addEventListener('mousedown', (e)=>{ if (bubble && !bubble.contains(e.target)) hideBubble(); }, true);
  document.addEventListener('scroll', hideBubble, {capture:true, passive:true});
  addEventListener('resize', hideBubble, {passive:true});
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') hideBubble(); }, true);

  // Cài đặt chỉ qua menu
  function openSettings(){
    const providers = getProviders();
    const cfg = getCfg();

    const wrap = document.createElement('div');
    wrap.className = 'qsb-config show';
    wrap.innerHTML = `
      <div class="qsb-backdrop"></div>
      <div class="qsb-panel">
        <h3>Cấu hình 8 ô + ngôn ngữ dịch</h3>
        <div class="qsb-grid" id="qsb-grid"></div>

        <div class="qsb-grid" style="margin-top:8px; grid-template-columns: 1fr 1fr 1fr 1fr; align-items:center">
          <label>Từ (from)</label>
          <select id="qsb-from">
            ${['auto','vi','en','ja','zh-CN','ko','fr','de','es'].map(c=>`<option value="${c}" ${cfg.from===c?'selected':''}>${c}</option>`).join('')}
          </select>
          <label>Đến (to)</label>
          <select id="qsb-to">
            ${['vi','en','ja','zh-CN','ko','fr','de','es'].map(c=>`<option value="${c}" ${cfg.to===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>

        <div class="qsb-hint">
          Dùng <code>{{q}}</code> cho truy vấn văn bản, <code>{{img}}</code> cho URL ảnh, <code>{{from}}</code>/<code>{{to}}</code> cho ngôn ngữ dịch.
          <div class="qsb-small">Ví dụ: Translate: <code>https://translate.google.com/?sl={{from}}&tl={{to}}&text={{q}}&op=translate</code></div>
        </div>
        <div class="qsb-actions">
          <button class="qsb-btn" id="qsb-reset">Khôi phục mặc định (8 ô)</button>
          <button class="qsb-btn primary" id="qsb-save">Lưu</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const grid = wrap.querySelector('#qsb-grid');
    const rows = [];
    for (let i=0;i<8;i++){
      const p = providers[i] || { name:'', url:'', icon:'' };
      const row = document.createElement('div');
      row.className = 'qsb-row';
      row.innerHTML = `
        <label>Ô ${i+1} — Tên</label><input type="text" value="${escHTML(p.name)}" placeholder="Tên hiển thị">
        <label>URL</label><input type="text" value="${escHTML(p.url)}" placeholder="https://... {{q}}/{{img}} {{from}} {{to}}">
        <label>Icon</label><input type="text" value="${escHTML(p.icon)}" placeholder="https://...ico/png/svg">`;
      grid.appendChild(row);
      rows.push(row);
    }

    const close = () => wrap.remove();
    wrap.querySelector('.qsb-backdrop').addEventListener('click', close);
    wrap.addEventListener('keydown', (e)=>{ if (e.key==='Escape') close(); });

    wrap.querySelector('#qsb-reset').addEventListener('click', ()=>{
      setProviders(defaultProviders());
      close(); openSettings();
    });
    wrap.querySelector('#qsb-save').addEventListener('click', ()=>{
      const out = [];
      rows.forEach(r=>{
        const [nameI,urlI,iconI] = r.querySelectorAll('input');
        const name = nameI.value.trim(), url = urlI.value.trim(), icon = iconI.value.trim();
        if (name && url) out.push({name,url,icon});
      });
      while (out.length<8) out.push({name:'',url:'',icon:''});
      setProviders(out);

      const fromSel = wrap.querySelector('#qsb-from');
      const toSel   = wrap.querySelector('#qsb-to');
      setCfg({ from: fromSel.value, to: toSel.value });

      close();
      alert('Đã lưu cấu hình.');
    });
  }

  GM_registerMenuCommand('⚙️ Cấu hình Quick Search Bubble', openSettings);
})();
