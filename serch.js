// ==UserScript==
// @name         Search
// @namespace    qsb.search.bubble
// @version      1.6.9
// @description  Khôi phục toàn bộ tính năng gốc
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

  // --- CONFIG & STORAGE ---
  const STORE_KEY = 'qsb.providers.v4';
  const CFG_KEY   = 'qsb.cfg.v1';
  const OFFSET_Y  = 8;

  const getCfg = () => {
    try { return JSON.parse(GM_getValue(CFG_KEY)) || { from: 'auto', to: 'vi' }; }
    catch { return { from: 'auto', to: 'vi' }; }
  };
  const setCfg = (cfg) => GM_setValue(CFG_KEY, JSON.stringify(cfg || {}));

  const defaultProviders = () => [
    { name: 'Google',     url: 'https://www.google.com/search?q={{q}}', icon: 'https://www.google.com/favicon.ico' },
    { name: 'YouTube',    url: 'https://www.youtube.com/results?search_query={{q}}', icon: 'https://www.youtube.com/favicon.ico' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={{q}}', icon: 'https://duckduckgo.com/favicon.ico' },
    { name: 'Bing',       url: 'https://www.bing.com/search?q={{q}}', icon: 'https://www.bing.com/favicon.ico' },
    { name: 'Ảnh Google', url: 'https://www.google.com/search?tbm=isch&q={{q}}', icon: 'https://www.google.com/favicon.ico' },
    { name: 'Bằng ảnh',   url: 'https://www.google.com/searchbyimage?image_url={{img}}', icon: 'https://www.google.com/favicon.ico' },
    { name: 'Dịch (GG)',  url: 'https://translate.google.com/?sl={{from}}&tl={{to}}&text={{q}}&op=translate', icon: 'https://translate.google.com/favicon.ico' },
    { name: 'Perplexity', url: 'https://www.perplexity.ai/?q={{q}}', icon: 'https://www.perplexity.ai/favicon.ico' },
  ];

  const getProviders = () => {
    try {
      const arr = JSON.parse(GM_getValue(STORE_KEY));
      return Array.isArray(arr) && arr.length ? arr.slice(0,8) : defaultProviders();
    } catch { return defaultProviders(); }
  };
  const setProviders = (arr) => GM_setValue(STORE_KEY, JSON.stringify((arr||[]).slice(0,8)));

  // --- HELPERS ---
  const escQ = (s) => encodeURIComponent(String(s||'').trim().replace(/\s+/g,' '));
  const escHTML = (s='') => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  const toast = (msg, x, y) => {
    const el = document.createElement('div'); el.className = 'qsb-toast'; el.textContent = msg;
    el.style.left = Math.min(x, innerWidth - 200) + 'px';
    el.style.top  = Math.max(6, y - 36) + 'px';
    document.body.appendChild(el); setTimeout(()=>el.remove(), 1200);
  };

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
      const sel = getSelection(); if (!sel) return false;
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

  const downloadImage = (src, x, y) => {
    const cb = () => GM_openInTab(src, {active:true, insert:true});
    if (typeof GM_download === 'function') {
      try {
        GM_download({ url: src, name: filenameFromUrl(src), saveAs: false, onerror: cb, ontimeout: cb });
        toast('Đang tải ảnh...', x, y);
        return;
      } catch {}
    }
    cb();
    toast('Mở tab mới để lưu', x, y);
  };

  // --- STYLE (Flat & Clean) ---
  GM_addStyle(`
    .qsb-bubble {
      position:absolute; z-index:2147483646; display:none;
      background:#1a1a1a; padding:6px; border-radius:8px;
      box-shadow:0 8px 25px rgba(0,0,0,.5);
    }
    .qsb-icons { display:grid; gap:6px; grid-template-columns:repeat(5, 28px); }
    .qsb-item {
      width:28px; height:28px; border-radius:6px;
      display:flex; align-items:center; justify-content:center;
      cursor:pointer; transition:background .15s;
    }
    .qsb-item:hover { background:rgba(255,255,255,.15); }
    .qsb-item img { width:16px; height:16px; object-fit:contain; }
    .qsb-item .glyph { font:15px/1 system-ui; color:#eee; }
    .qsb-toast {
      position:fixed; padding:6px 12px; background:#222; color:#fff;
      border-radius:6px; font:12px system-ui; z-index:2147483647;
      box-shadow:0 5px 15px rgba(0,0,0,.3);
    }
    /* Settings Grid Style */
    .qsb-cfg { position:fixed; inset:0; background:rgba(0,0,0,.7); display:flex; align-items:center; justify-content:center; z-index:2147483647; font-family:system-ui; }
    .qsb-panel { background:#181818; color:#eee; width:min(650px,94vw); border-radius:12px; padding:20px; box-shadow:0 15px 50px #000; }
    .qsb-panel h3 { margin:0 0 15px; font-size:16px; font-weight:600; color:#fff; }
    .qsb-grid { display:grid; grid-template-columns:1fr 2fr 2fr; gap:8px; margin-bottom:15px; }
    .qsb-head { font-size:11px; opacity:.6; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
    .qsb-grid input, .qsb-lang select { background:#252525; border:none; color:#fff; padding:6px 10px; border-radius:4px; width:100%; font:13px system-ui; }
    .qsb-grid input:focus, .qsb-lang select:focus { background:#303030; outline:none; }
    .qsb-acts { display:flex; justify-content:space-between; align-items:center; margin-top:15px; }
    .qsb-btn { padding:8px 16px; border:none; border-radius:6px; background:#333; color:#eee; cursor:pointer; }
    .qsb-btn.p { background:#238636; color:#fff; } .qsb-btn:hover { filter:brightness(1.1); }
    .qsb-note { font-size:11px; opacity:.5; max-width:300px; }
  `);

  let bubble, grid, lastCtx = null, selTimer = null;
  let hoverTimer = null, hoverHideTimer = null, hoverImgEl = null;

  function ensureBubble(){
    if (bubble) return bubble;
    bubble = document.createElement('div'); bubble.className = 'qsb-bubble';
    grid = document.createElement('div'); grid.className = 'qsb-icons';
    bubble.appendChild(grid);
    bubble.onmouseenter = () => clearTimeout(hoverHideTimer);
    bubble.onmouseleave = () => { if(!hoverImgEl?.matches(':hover')) hideBubble(); };
    document.body.appendChild(bubble);
    return bubble;
  }
  function hideBubble(){ if(bubble) bubble.style.display='none'; lastCtx=null; }

  function showBubble(items, x, y) {
    ensureBubble();
    grid.innerHTML = '';
    items.forEach(it => {
      const btn = document.createElement('div');
      btn.className = 'qsb-item'; btn.title = it.title || '';
      btn.innerHTML = it.html;
      btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); it.onClick(); };
      grid.appendChild(btn);
    });
    grid.style.gridTemplateColumns = `repeat(${Math.min(5, items.length)}, 28px)`;
    
    // Position check
    bubble.style.display = 'block'; // Show first to get dimensions
    const w = bubble.offsetWidth, h = bubble.offsetHeight;
    const l = Math.max(6, Math.min(x, scrollX + innerWidth - w - 6));
    const t = Math.max(6, Math.min(y, scrollY + innerHeight - h - 6));
    bubble.style.left = l + 'px';
    bubble.style.top = t + 'px';
  }

  // --- LOGIC XỬ LÝ ---
  const findImgProv = (providers) => {
    return providers.find(x => /bằng ảnh/i.test(x.name)) || 
           providers.find(x => x.url.includes('{{img}}')) || 
           { name:'Tìm ảnh', url:'https://www.google.com/searchbyimage?image_url={{img}}' };
  };

  const buildItems = (ctx) => {
    const providers = getProviders();
    const { from, to } = getCfg();
    const items = [];

    const run = (p, txt, img) => {
      const u = (p.url||'')
        .replace('{{q}}', img ? '' : escQ(txt))
        .replace('{{img}}', img ? encodeURIComponent(img) : '')
        .replace('{{from}}', encodeURIComponent(from))
        .replace('{{to}}', encodeURIComponent(to));
      if(u) GM_openInTab(u, {active:true, insert:true});
      hideBubble();
    };

    if (ctx.type === 'text') {
      items.push({ title:'Copy', html:'<span class="glyph">⧉</span>', onClick:async()=>{
        const ok = await copyText(ctx.text); toast(ok?'Đã chép':'Lỗi chép', ctx.x, ctx.y); hideBubble();
      }});
      items.push({ title:'Select All', html:'<span class="glyph">⤢</span>', onClick:()=>{
        selectAllSmart(); toast('Đã chọn hết', ctx.x, ctx.y);
      }});
      providers.forEach(p => items.push({
        title: p.name, html: p.icon?`<img src="${p.icon}">`:'<span class="glyph">🔗</span>', onClick:()=>run(p, ctx.text)
      }));
    } else if (ctx.type === 'image') {
      const iP = findImgProv(providers);
      items.push({ title:'Tải ảnh', html:'<span class="glyph">⬇</span>', onClick:()=> {
        downloadImage(ctx.img, ctx.x, ctx.y); hideBubble();
      }});
      items.push({ title:'Copy URL', html:'<span class="glyph">⧉</span>', onClick:async()=>{
        await copyText(ctx.img); toast('Đã chép URL', ctx.x, ctx.y); hideBubble();
      }});
      items.push({ title:iP.name, html:iP.icon?`<img src="${iP.icon}">`:'<span class="glyph">🔗</span>', onClick:()=>run(iP, null, ctx.img) });
    }
    return items;
  };

  // --- EVENTS: TEXT SELECTION ---
  document.addEventListener('selectionchange', () => {
    clearTimeout(selTimer);
    selTimer = setTimeout(() => {
      const sel = getSelection();
      const txt = String(sel).trim();
      // Bỏ qua nếu đang nhập liệu input/textarea
      if (!txt || (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) return;
      
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (r.width > 0) {
        lastCtx = { type:'text', text:txt, x:r.left + scrollX, y:r.bottom + scrollY + OFFSET_Y };
        showBubble(buildItems(lastCtx), lastCtx.x, lastCtx.y);
      }
    }, 150);
  });

  // --- EVENTS: IMAGE (Robust) ---
  const getImg = (t) => {
    if (t.closest && t.closest('.qsb-bubble')) return null;
    if (t.tagName === 'IMG') return t;
    return t.closest('picture')?.querySelector('img');
  };

  // 1. Context Menu (Chuột phải)
  document.addEventListener('contextmenu', (e) => {
    const img = getImg(e.target);
    if (img && img.src) {
      // e.preventDefault(); // Uncomment nếu muốn chặn menu chuột phải trình duyệt
      const x = e.pageX + 6, y = e.pageY + 6;
      lastCtx = { type:'image', img:img.src, x, y };
      showBubble(buildItems(lastCtx), x, y);
    }
  }, {capture:true});

  // 2. Hover (Di chuột)
  document.addEventListener('pointerenter', (e) => {
    if (e.pointerType !== 'mouse') return;
    const img = getImg(e.target);
    if (!img) return;
    
    hoverImgEl = img;
    clearTimeout(hoverTimer); clearTimeout(hoverHideTimer);
    
    hoverTimer = setTimeout(() => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      const x = e.pageX + 6, y = e.pageY + 6;
      lastCtx = { type:'image', img:src, x, y };
      showBubble(buildItems(lastCtx), x, y);
    }, 120);
  }, {capture:true});

  document.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    if (getImg(e.target) === hoverImgEl) {
      clearTimeout(hoverTimer);
      hoverHideTimer = setTimeout(() => {
        if (!bubble || !bubble.matches(':hover')) hideBubble();
      }, 220);
    }
  }, {capture:true});

  // 3. Long Press (Giữ chuột/Touch)
  (() => {
    let pressTmr, sX, sY, tImg;
    const onDown = (e) => {
      tImg = getImg(e.target);
      if (!tImg) return;
      sX = e.pageX || e.touches?.[0]?.pageX;
      sY = e.pageY || e.touches?.[0]?.pageY;
      pressTmr = setTimeout(() => {
        if (!tImg) return;
        const src = tImg.currentSrc || tImg.src;
        if (src) {
          lastCtx = { type:'image', img:src, x:sX+6, y:sY+6 };
          showBubble(buildItems(lastCtx), lastCtx.x, lastCtx.y);
        }
      }, 450); // 450ms hold time
    };
    const onMove = (e) => {
      if (!pressTmr) return;
      const x = e.pageX || e.touches?.[0]?.pageX;
      const y = e.pageY || e.touches?.[0]?.pageY;
      if (Math.abs(x - sX) > 5 || Math.abs(y - sY) > 5) { clearTimeout(pressTmr); pressTmr=null; }
    };
    const onUp = () => { clearTimeout(pressTmr); pressTmr=null; };

    document.addEventListener('pointerdown', onDown, {passive:true});
    document.addEventListener('pointermove', onMove, {passive:true});
    document.addEventListener('pointerup', onUp, {passive:true});
    document.addEventListener('pointercancel', onUp, {passive:true});
  })();

  // Dismiss events
  document.addEventListener('mousedown', (e) => { if(bubble && !bubble.contains(e.target)) hideBubble(); });
  document.addEventListener('scroll', hideBubble, {capture:true, passive:true});
  document.addEventListener('keydown', (e) => { if(e.key==='Escape') hideBubble(); });

  // --- SETTINGS UI (Grid Layout) ---
  GM_registerMenuCommand('⚙️ Cấu hình Quick Search', () => {
    const ps = getProviders();
    const cfg = getCfg();
    const langs = ['auto','vi','en','ja','zh-CN','ko','fr','de','es'];
    const div = document.createElement('div'); div.className = 'qsb-cfg';
    
    div.innerHTML = `
      <div class="qsb-panel">
        <h3>Cấu hình Quick Search</h3>
        <div class="qsb-grid" id="qsb-grid">
          <div class="qsb-head">Tên hiển thị</div>
          <div class="qsb-head">URL Query ({{q}} / {{img}})</div>
          <div class="qsb-head">Icon URL</div>
          ${Array.from({length:8}).map((_,i) => {
             const p = ps[i] || {name:'', url:'', icon:''};
             return `<input value="${escHTML(p.name)}" placeholder="Tên ${i+1}">
                     <input value="${escHTML(p.url)}" placeholder="URL...">
                     <input value="${escHTML(p.icon)}" placeholder="Icon...">`;
          }).join('')}
        </div>
        <div class="qsb-lang" style="display:flex;gap:10px;align-items:center">
          <label>Dịch từ:</label>
          <select id="qf">${langs.map(l => `<option ${cfg.from===l?'selected':''}>${l}</option>`).join('')}</select>
          <label>đến:</label>
          <select id="qt">${langs.map(l => `<option ${cfg.to===l?'selected':''}>${l}</option>`).join('')}</select>
        </div>
        <div class="qsb-acts">
          <div class="qsb-note">Mẹo: Dùng {{q}} cho text, {{img}} cho ảnh.</div>
          <div style="display:flex;gap:10px">
            <button class="qsb-btn" id="qr">Mặc định</button>
            <button class="qsb-btn p" id="qs">Lưu</button>
          </div>
        </div>
      </div>`;
    
    div.onclick = e => e.target === div && div.remove();
    div.querySelector('#qr').onclick = () => { setProviders(defaultProviders()); div.remove(); alert('Đã khôi phục mặc định!'); };
    div.querySelector('#qs').onclick = () => {
      const ins = div.querySelectorAll('#qsb-grid input');
      const newP = [];
      for(let i=0; i<ins.length; i+=3) {
        if(ins[i].value.trim()) newP.push({
            name: ins[i].value.trim(), 
            url: ins[i+1].value.trim(), 
            icon: ins[i+2].value.trim()
        });
      }
      setProviders(newP);
      setCfg({ from:div.querySelector('#qf').value, to:div.querySelector('#qt').value });
      div.remove(); alert('Đã lưu cấu hình!');
    };
    document.body.appendChild(div);
  });
})();
