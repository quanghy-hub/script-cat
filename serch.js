// ==UserScript==
// @name         Quick Search
// @namespace    qsb.search.bubble
// @version      1.2.0
// @description  Bôi đen là hiện bong bóng ngay dưới; ảnh: trỏ rồi nhấp chuột phải. 8 biểu tượng, chia 2 hàng. Preset 7 dịch vụ tìm kiếm/ảnh/dịch + Perplexity. Cài đặt đổi nhà cung cấp và ngôn ngữ dịch.
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
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const STORE_KEY = 'qsb.providers.v3';
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
      { name: 'YouTube',    url: 'https://www.youtube.com/results?search_query={{q}}',              icon: 'https://www.youtube.com/favicon.ico' }, // fixed
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

  GM_addStyle(`
    .qsb-bubble{
      position:absolute; z-index:2147483646; display:inline-block;
      background:#101114;color:#fff;border:1px solid #2a2d33;border-radius:12px;
      padding:8px 10px 10px 10px; box-shadow:0 8px 22px rgba(0,0,0,.28)
    }
    .qsb-icons{ display:grid; grid-template-columns: repeat(4, 32px); grid-auto-rows:32px; gap:8px; }
    .qsb-item{ width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid transparent }
    .qsb-item:hover{ background:#1b1e24;border-color:#2d3138 }
    .qsb-item img{ width:18px;height:18px; object-fit:contain }
    .qsb-gear{ position:absolute; top:6px; right:6px; font:16px/1 system-ui; padding:2px 6px;
      border:1px solid #2a2d33;border-radius:8px;cursor:pointer;background:#151923 }
    .qsb-gear:hover{ background:#1b1e24 }

    .qsb-config{position:fixed; inset:0; display:none; align-items:center; justify-content:center; z-index:2147483647}
    .qsb-config.show{display:flex}
    .qsb-backdrop{position:absolute; inset:0; background:rgba(0,0,0,.45)}
    .qsb-panel{position:relative; background:#0f1115; color:#e6e6e6; width:min(780px,96vw);
      border:1px solid #2a2d33; border-radius:14px; padding:16px 18px; box-shadow:0 10px 30px rgba(0,0,0,.35)}
    .qsb-panel h3{margin:0 0 12px; font:600 16px/1.4 system-ui}
    .qsb-grid{display:grid; grid-template-columns: 1fr 2fr 2fr; gap:8px; align-items:center}
    .qsb-grid input, .qsb-grid select{width:100%; padding:6px 8px; background:#12151b; border:1px solid #2a2d33; border-radius:8px; color:#e6e6e6}
    .qsb-grid label{font:12px/1.4 system-ui; opacity:.85}
    .qsb-row{display:contents}
    .qsb-actions{display:flex; gap:8px; justify-content:flex-end; margin-top:12px}
    .qsb-btn{padding:8px 12px; border:1px solid #2a2d33; border-radius:10px; background:#151923; color:#e6e6e6; cursor:pointer}
    .qsb-btn.primary{background:#1f6feb; border-color:#1f6feb; color:#fff}
    .qsb-hint{font:12px/1.4 system-ui; opacity:.8; margin:8px 0 0}
    .qsb-small{font:11px/1.4 system-ui; opacity:.7}
  `);

  let bubble, iconGrid, lastCtx = null, selTimer = null;

  function ensureBubble(){
    if (bubble) return bubble;
    bubble = document.createElement('div');
    bubble.className = 'qsb-bubble';
    bubble.style.display = 'none';

    iconGrid = document.createElement('div');
    iconGrid.className = 'qsb-icons';
    bubble.appendChild(iconGrid);

    const gear = document.createElement('div');
    gear.className = 'qsb-gear';
    gear.title = 'Cấu hình';
    gear.textContent = '⚙︎';
    gear.addEventListener('click', (e)=>{ e.stopPropagation(); openSettings(); });
    bubble.appendChild(gear);

    document.body.appendChild(bubble);
    return bubble;
  }
  function hideBubble(){ if (bubble) bubble.style.display = 'none'; lastCtx = null; }

  function buildBubble(ctx){
    ensureBubble();
    iconGrid.innerHTML = '';
    const providers = getProviders();
    const { from, to } = getCfg();

    providers.forEach((p)=>{
      const btn = document.createElement('div');
      btn.className = 'qsb-item';
      btn.title = p.name || '';
      const img = document.createElement('img');
      img.src = p.icon || '';
      img.alt = p.name || '';
      btn.appendChild(img);
      btn.addEventListener('click', (e)=>{
        e.preventDefault(); e.stopPropagation();
        const q = ctx.type==='text'  ? escQ(ctx.text) : '';
        const im= ctx.type==='image' ? encodeURIComponent(ctx.img) : '';
        let target = (p.url||'')
          .replaceAll('{{q}}', q)
          .replaceAll('{{img}}', im)
          .replaceAll('{{from}}', encodeURIComponent(from))
          .replaceAll('{{to}}', encodeURIComponent(to));
        if (target) GM_openInTab(target, {active:true, insert:true, setParent:true});
        hideBubble();
      });
      iconGrid.appendChild(btn);
    });
  }

  function placeAndShow(x,y){
    ensureBubble();
    const left = Math.max(6, Math.min(x, scrollX + innerWidth - bubble.offsetWidth - 6));
    const top  = Math.max(6, Math.min(y, scrollY + innerHeight - bubble.offsetHeight - 6));
    bubble.style.left = left + 'px';
    bubble.style.top  = top  + 'px';
    bubble.style.display = 'inline-block';
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

  // image → right click
  document.addEventListener('contextmenu', (ev)=>{
    const t = ev.target;
    if (!(t instanceof Element)) return;
    let img = null;
    if (t.tagName==='IMG') img = t;
    else img = t.closest?.('picture')?.querySelector('img') || null;
    if (!img) return;
    const src = img.currentSrc || img.src;
    if (!src) return;
    ev.preventDefault();
    lastCtx = { type:'image', img: src, x: ev.pageX + 6, y: ev.pageY + 6 };
    buildBubble(lastCtx);
    placeAndShow(lastCtx.x, lastCtx.y);
  }, {capture:true});

  // dismiss
  document.addEventListener('mousedown', (e)=>{ if (bubble && !bubble.contains(e.target)) hideBubble(); }, true);
  document.addEventListener('scroll', hideBubble, {capture:true, passive:true});
  addEventListener('resize', hideBubble, {passive:true});
  document.addEventListener('keydown', (e)=>{ if (e.key==='Escape') hideBubble(); }, true);

  // settings
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

        <div class="qsb-grid" style="margin-top:10px; grid-template-columns: 1fr 1fr 1fr 1fr; align-items:center">
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
