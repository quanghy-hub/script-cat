// ==UserScript==
// @name      2Column
// @namespace    twocol.virtual.viewport
// @version      1.0.0
// @description  2 khung (Trái=Top, Phải=Bottom). Icon+panel. Kéo gap mượt (PointerEvents+rAF). Hoán đổi tức thì. Chặn SPA tự điều hướng, anti-blank nhanh. Bật/tắt tức thì không tải lại. Guard chống thanh cuộn nhảy.
// @match        *://*/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/colum.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/colum.js
// @exclude      *://mail.google.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @license      MIT
// ==/UserScript==
(() => {
  'use strict';
  if (window.__TWC_RUNNING__) return; window.__TWC_RUNNING__ = true;

  const P_KEY='__twocol_iframe', V_KEY='__twocol_view';
  const SHELL_ID='twc-shell', ICON_ID='twc-fab', POP_ID='twc-pop', BD_ID='twc-backdrop';
  const HOST_KEY='twc.site.'+location.host;

  /* ===== Storage ===== */
  const S = (() => {
    const hasGM = typeof GM_getValue==='function' && typeof GM_setValue==='function';
    return {
      get(k, d){ try{ return hasGM ? GM_getValue(k,d) : (JSON.parse(localStorage.getItem(k)) ?? d);}catch(_){return d;} },
      set(k, v){ try{ hasGM ? GM_setValue(k,v) : localStorage.setItem(k, JSON.stringify(v)); }catch(_){} }
    };
  })();

  const defaults = { icon:true, overlay:false, route:true, swap:false, gap:10, split:0.5 };
  let cfg = Object.assign({}, defaults, S.get(HOST_KEY, {}));
  const save = (patch)=>{ cfg=Object.assign({}, cfg, patch); S.set(HOST_KEY, cfg); syncUI(); };

  /* ===== Mirror branch (bên trong iframe) — có scroll guard ===== */
  const url = new URL(location.href);
  if (url.searchParams.get(P_KEY)==='1') {
    const view = url.searchParams.get(V_KEY) || 'top';
    const anchorRatio = view==='bottom' ? 0.5 : 0.0;

    const EPS = 32;        // sai số vị trí cho phép
    const QUIET_MS = 1200; // thời gian yên lặng sau khi user cuộn
    const H_DELTA = 48;    // đổi chiều cao đủ lớn mới resync

    let lastUserScroll = 0;
    let lastDocH = 0;
    let raf = 0;
    let moDebounce = 0;

    try { history.scrollRestoration = 'manual'; } catch(_){}

    const measureH = () => {
      const de=document.documentElement, b=document.body;
      return Math.max(
        de.scrollHeight, de.offsetHeight, de.clientHeight,
        b ? b.scrollHeight : 0
      );
    };

    const targetY = () => {
      const h = measureH();
      const vh = innerHeight || document.documentElement.clientHeight;
      const max = Math.max(0, h - vh);
      return (max * anchorRatio) | 0;
    };

    const resyncCore = () => {
      const now = Date.now();
      if (now - lastUserScroll < QUIET_MS) return;
      const t = targetY();
      if (Math.abs((scrollY||0) - t) <= EPS) return;
      scrollTo(0, t);
    };

    const resync = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; resyncCore(); });
    };

    addEventListener('scroll', () => { lastUserScroll = Date.now(); }, {passive:true});

    const mo = new MutationObserver(() => {
      clearTimeout(moDebounce);
      moDebounce = setTimeout(() => {
        const h = measureH();
        if (Math.abs(h - lastDocH) >= H_DELTA) {
          lastDocH = h;
          resync();
        }
      }, 120);
    });

    addStyle('html,body{margin:0!important;background:transparent!important;}');

    addEventListener('DOMContentLoaded', () => { lastDocH = measureH(); resync(); }, {once:true});
    addEventListener('load', () => { lastDocH = measureH(); resync(); }, {once:true});
    addEventListener('resize', () => { lastDocH = measureH(); resync(); });
    addEventListener('pageshow', resync);
    addEventListener('message', (e)=>{ if (e?.data && e.data.__twc==='resync'){ lastDocH = measureH(); resync(); } }, false);

    mo.observe(document.documentElement, {childList:true,subtree:true,attributes:false});
    return;
  }

  /* ===== UI boot ===== */
  whenReady(() => {
    injectCSS();
    buildFAB(); buildPOP(); buildBackdrop();
    try{
      if (typeof GM_registerMenuCommand==='function') {
        GM_registerMenuCommand((cfg.icon?'Ẩn':'Hiện')+' icon', ()=>save({icon:!cfg.icon}));
        GM_registerMenuCommand((cfg.overlay?'Tắt':'Bật')+' 2 khung', ()=>save({overlay:!cfg.overlay, icon:true}));
      }
    }catch(_){}
    document.addEventListener('keydown', e=>{
      if (e.altKey && e.shiftKey && e.code==='Digit2'){ e.preventDefault(); save({overlay:!cfg.overlay, icon:true}); }
      if (e.key==='Escape') togglePOP(false);
    }, true);
    syncUI();
  });

  function injectCSS(){
    addStyle(`
#${ICON_ID}{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:40px;height:40px;border-radius:9999px;background:rgba(20,20,20,.25);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;color:#fff;font:16px/1 system-ui;border:1px solid rgba(255,255,255,.18);box-shadow:0 2px 10px rgba(0,0,0,.25);cursor:pointer;user-select:none}
#${ICON_ID}.hidden{display:none}#${ICON_ID}:hover{background:rgba(20,20,20,.35)}
#${ICON_ID} .dot{position:absolute;top:6px;right:6px;width:6px;height:6px;border-radius:50%;background:#999;opacity:.9}

#${BD_ID}{position:fixed;inset:0;z-index:2147483646;background:transparent}
#${BD_ID}.hidden{display:none}

#${POP_ID}{position:fixed;right:64px;bottom:16px;z-index:2147483647;min-width:220px;padding:10px;border-radius:12px;background:rgba(18,18,18,.92);color:#eee;font:13px/1.25 system-ui;border:1px solid rgba(255,255,255,.16);box-shadow:0 8px 24px rgba(0,0,0,.35)}
#${POP_ID}.hidden{display:none}#${POP_ID} label{display:flex;gap:8px;align-items:center;margin:6px 0}.hint{opacity:.6;font-size:12px}

#${SHELL_ID}{position:fixed;inset:0;z-index:2147483645;background:transparent;--gap:${cfg.gap|0}px;--left:${(cfg.split*100).toFixed(3)}%;opacity:1;pointer-events:auto;transition:opacity .12s ease;will-change:opacity}
#${SHELL_ID}.hidden{display:none}
#${SHELL_ID}.inert{opacity:0;pointer-events:none}
#${SHELL_ID} .wrap{position:absolute;inset:0;display:flex;will-change:width}
#${SHELL_ID} iframe{height:100%;border:0;background:transparent!important;border-radius:10px;overflow:hidden;display:block;transition:none;contain:paint;opacity:1}
#${SHELL_ID}.dragging iframe{pointer-events:none}
#${SHELL_ID} .left{width:calc(var(--left) - (var(--gap)/2))}
#${SHELL_ID} .right{width:calc(100% - var(--left) - (var(--gap)/2));margin-left:var(--gap)}
#${SHELL_ID} .resizer{position:absolute;top:0;bottom:0;left:var(--left);width:var(--gap);margin-left:calc(var(--gap)*-0.5);cursor:col-resize;touch-action:none;background:transparent}
#${SHELL_ID} .resizer::after{content:"";position:absolute;top:0;bottom:0;left:50%;transform:translateX(-50%);width:12px}

#twc-fallback{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.03)}
#twc-fallback .inner{position:absolute;inset:0;overflow:auto;padding:12px}
#twc-fallback .inner>.host{column-count:2;column-gap:${cfg.gap|0}px}
#twc-fallback .inner>.host>*{break-inside:avoid}
#twc-fallback .x{position:absolute;top:10px;right:12px;width:32px;height:32px;border-radius:8px;background:rgba(20,20,20,.75);color:#eee;border:0;cursor:pointer}
    `);
  }

  function buildFAB(){
    if (byId(ICON_ID)) return;
    const d=document.createElement('div');
    d.id=ICON_ID; d.innerHTML=`<span>II</span><span class="dot"></span>`;
    d.onclick=(e)=>{ e.stopPropagation(); togglePOP(true); };
    document.documentElement.appendChild(d);
  }
  function buildBackdrop(){
    if (byId(BD_ID)) return;
    const b=document.createElement('div'); b.id=BD_ID; b.className='hidden';
    b.addEventListener('click', ()=>togglePOP(false), true);
    document.documentElement.appendChild(b);
  }
  function buildPOP(){
    if (byId(POP_ID)) return;
    const p=document.createElement('div'); p.id=POP_ID; p.className='hidden';
    p.innerHTML=`
      <div style="font-weight:600;margin-bottom:4px">Two-Column</div>
      <label><input id="twc-ov" type="checkbox"> Bật 2 khung</label>
      <label><input id="twc-rt" type="checkbox"> Link trái → mở bên phải</label>
      <label><input id="twc-sw" type="checkbox"> Hoán đổi Trái ↔ Phải</label>
      <label><input id="twc-ic" type="checkbox"> Ghim icon site này</label>
      <div class="hint">Kéo vùng “gap” giữa 2 khung để đổi tỉ lệ.</div>`;
    document.documentElement.appendChild(p);
    on('#twc-ov','change',e=>save({overlay:e.target.checked}));
    on('#twc-rt','change',e=>save({route:e.target.checked}));
    on('#twc-sw','change',e=>{ cfg.swap=!!e.target.checked; S.set(HOST_KEY,cfg); applyInstantSwap(); syncFabDot(); });
    on('#twc-ic','change',e=>save({icon:e.target.checked}));
    p.addEventListener('click', e=>e.stopPropagation());
  }
  function togglePOP(show){
    const p=byId(POP_ID), b=byId(BD_ID); if (!p||!b) return;
    p.classList.toggle('hidden', show===false);
    b.classList.toggle('hidden', show===false);
    if (!p.classList.contains('hidden')){
      qs('#twc-ov').checked=!!cfg.overlay;
      qs('#twc-rt').checked=!!cfg.route;
      qs('#twc-sw').checked=!!cfg.swap;
      qs('#twc-ic').checked=!!cfg.icon;
    }
  }

  function syncFabDot(){
    const fab=byId(ICON_ID);
    if (fab){
      fab.classList.toggle('hidden', !cfg.icon);
      const dot=fab.querySelector('.dot'); if (dot) dot.style.background = cfg.overlay ? '#4ade80' : '#999';
    }
  }

  function syncUI(){
    syncFabDot();
    if (cfg.overlay) showOverlay(); else hideOverlay();
  }

  /* ===== Overlay (giữ sống để bật/tắt tức thì) ===== */
  let L=null, R=null, built=false;

  async function ensureOverlayBuilt(){
    if (built) return;
    const sh=document.createElement('div');
    sh.id=SHELL_ID;
    sh.className='inert hidden';
    sh.innerHTML=`
      <div class="wrap">
        <iframe class="left"  loading="eager" importance="high"
          sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer-when-downgrade" allow="autoplay;clipboard-read;clipboard-write"></iframe>
        <iframe class="right" loading="eager" importance="high"
          sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock allow-modals allow-popups allow-popups-to-escape-sandbox"
          referrerpolicy="no-referrer-when-downgrade" allow="autoplay;clipboard-read;clipboard-write"></iframe>
        <div class="resizer" title="Kéo để đổi tỉ lệ"></div>
      </div>`;
    document.documentElement.appendChild(sh);
    sh.style.setProperty('--gap', (cfg.gap|0)+'px');
    sh.style.setProperty('--left', (cfg.split*100).toFixed(3)+'%');

    L=sh.querySelector('iframe.left'); R=sh.querySelector('iframe.right');
    loadMirrors();

    const ready = new Promise(resolve=>{
      let shown=false;
      const show=()=>{ if (shown) return; shown=true; sh.classList.remove('inert'); resolve(); };
      const t=setTimeout(show,800);
      [L,R].forEach(f=>f.addEventListener('load', ()=>{ try{ void f.contentWindow.document; show(); clearTimeout(t);}catch(_){ } }, {once:true}));
    });

    L.addEventListener('load', ()=>{ try{ if (cfg.route) hookRouting(L,R,new URL(location.href)); }catch(_){ } }, {once:true});

    const res=sh.querySelector('.resizer');
    bindSmoothDrag(sh, res,
      ratio => { sh.style.setProperty('--left', (ratio*100).toFixed(3)+'%'); cfg.split=ratio; },
      () => { S.set(HOST_KEY,cfg); }
    );

    await ready;
    built = true;
  }

  function showOverlay(){
    ensureOverlayBuilt().then(()=>{
      const sh=byId(SHELL_ID); if (!sh) return;
      sh.classList.remove('hidden');
      sh.style.setProperty('--gap', (cfg.gap|0)+'px');
      sh.style.setProperty('--left', (cfg.split*100).toFixed(3)+'%');
      lockScroll(true);
      try{ L.contentWindow?.postMessage({__twc:'resync'}, '*'); }catch(_){}
      try{ R.contentWindow?.postMessage({__twc:'resync'}, '*'); }catch(_){}
    });
  }

  function hideOverlay(){
    const sh=byId(SHELL_ID); if (!sh) return;
    sh.classList.add('hidden');
    lockScroll(false);
  }

  function loadMirrors(){
    const base=new URL(location.href); base.searchParams.set(P_KEY,'1');
    const uA=new URL(base), uB=new URL(base);
    if (!cfg.swap){ uA.searchParams.set(V_KEY,'top'); uB.searchParams.set(V_KEY,'bottom'); }
    else          { uA.searchParams.set(V_KEY,'bottom'); uB.searchParams.set(V_KEY,'top'); }
    navigateInFrame(L, uA.href);
    navigateInFrame(R, uB.href);
  }

  function applyInstantSwap(){
    if (!L || !R) return;
    loadMirrors();
    try{ L.contentWindow?.postMessage({__twc:'resync'}, '*'); }catch(_){}
    try{ R.contentWindow?.postMessage({__twc:'resync'}, '*'); }catch(_){}
  }

  /* ===== Routing + Anti-blank nhanh ===== */
  function navigateInFrame(ifr, href){
    try{ ifr.__navToken = (Math.random()+''+Date.now()); ifr.src = href; }catch(_){ window.open(href, '_blank'); return; }
    const myToken = ifr.__navToken;
    const timer = setTimeout(()=>{ // nghi ngờ bị chặn
      if (ifr.__navToken !== myToken) return;
      let blocked=true;
      try{
        const doc=ifr.contentDocument;
        if (doc && doc.body && doc.body.childElementCount>0) blocked=false;
      }catch(_){ blocked=false; } // cross-origin: không coi là chặn
      if (blocked){ try{ window.open(href, '_blank'); }catch(_){ } }
    }, 900);
    ifr.addEventListener('load', ()=>clearTimeout(timer), { once:true });
  }

  function hookRouting(leftIFR, rightIFR, baseUrl){
    function qualify(href, targetRight=true){
      try{
        const u=new URL(href, baseUrl);
        u.searchParams.set(P_KEY,'1');
        u.searchParams.set(V_KEY, targetRight
          ? (cfg.swap ? 'top' : 'bottom')
          : (cfg.swap ? 'bottom' : 'top'));
        return u.href;
      }catch(_){ return href; }
    }
    const attach=(doc)=>{
      const hardBlock = (e)=>{
        if (!cfg.route) return;
        const a = e.target && e.target.closest ? e.target.closest('a,[role="link"]') : null;
        if (!a) return;
        if (e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target==='_blank') return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      };
      doc.addEventListener('mousedown', hardBlock, {capture:true});

      const handler=(e)=>{
        if (!cfg.route) return;
        const a = e.target && e.target.closest ? e.target.closest('a,[role="link"]') : null;
        if (!a) return;
        if (e.button!==0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target==='_blank') return;
        const href = a.href || a.getAttribute('href'); if (!href) return;
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        navigateInFrame(rightIFR, qualify(href,true));
      };
      doc.addEventListener('click', handler, {capture:true});
      doc.addEventListener('auxclick', handler, {capture:true});
    };
    const onLoad = (ifr)=>{ try{ attach(ifr.contentDocument || ifr.contentWindow.document); }catch(_){ } };
    leftIFR.addEventListener('load', ()=>onLoad(leftIFR));
    try{ if (leftIFR.contentDocument) attach(leftIFR.contentDocument); }catch(_){}
  }

  /* ===== Fallback columns (same-origin) ===== */
  function fallbackColumns(){
    if (byId('twc-fallback')) return;
    const w=document.createElement('div');
    w.id='twc-fallback';
    w.innerHTML=`<div class="inner"></div><button class="x" title="Đóng">✕</button>`;
    document.documentElement.appendChild(w);
    const host=document.createElement('div'); host.className='host';
    while (document.body.firstChild) host.appendChild(document.body.firstChild);
    w.querySelector('.inner').appendChild(host);
    lockScroll(true);
    w.querySelector('.x').onclick=()=>{ while (host.firstChild) document.body.appendChild(host.firstChild); w.remove(); lockScroll(false); save({overlay:false}); };
  }

  /* ===== Smooth drag tối ưu ===== */
  function bindSmoothDrag(shell, handle, onMoveRatio, onEnd){
    if (!handle) return;
    let dragging=false, rafId=0, lastClientX=null, activePointerId=null;
    let rect={left:0,width:1};

    const step = () => {
      if (!dragging || lastClientX==null) return;
      let ratio = (lastClientX - rect.left) / rect.width;
      ratio = Math.max(0.15, Math.min(0.85, ratio));
      onMoveRatio(ratio);
      rafId = requestAnimationFrame(step);
    };

    const onPointerMove = (e) => { if (e.pointerId===activePointerId) lastClientX = e.clientX; };
    const stop = () => {
      if (!dragging) return;
      dragging=false;
      shell.classList.remove('dragging');
      try{ handle.releasePointerCapture && activePointerId!=null && handle.releasePointerCapture(activePointerId); }catch(_){}
      activePointerId=null;
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', stop, true);
      window.removeEventListener('pointercancel', stop, true);
      window.removeEventListener('blur', stop, true);
      cancelAnimationFrame(rafId);
      rafId=0; lastClientX=null;
      if (onEnd) onEnd();
    };
    const start = (e) => {
      e.preventDefault();
      dragging=true;
      shell.classList.add('dragging');
      activePointerId = e.pointerId;
      try{ handle.setPointerCapture && handle.setPointerCapture(activePointerId); }catch(_){}
      const r = shell.getBoundingClientRect(); rect.left=r.left; rect.width=Math.max(1,r.width);
      lastClientX = e.clientX;
      window.addEventListener('pointermove', onPointerMove, true);
      window.addEventListener('pointerup', stop, true);
      window.addEventListener('pointercancel', stop, true);
      window.addEventListener('blur', stop, true);
      rafId = requestAnimationFrame(step);
    };
    handle.addEventListener('pointerdown', start, { passive:false, capture:true });
    new ResizeObserver(()=>{ if (!dragging){ const r=shell.getBoundingClientRect(); rect.left=r.left; rect.width=Math.max(1,r.width); } }).observe(shell);
  }

  /* ===== Utils ===== */
  function addStyle(css){ try{ typeof GM_addStyle==='function' ? GM_addStyle(css) : (()=>{ const s=document.createElement('style'); s.textContent=css; document.documentElement.appendChild(s); })(); } catch(_){ const s=document.createElement('style'); s.textContent=css; document.documentElement.appendChild(s); } }
  function whenReady(fn){ if (document.documentElement) fn(); else document.addEventListener('readystatechange', ()=>{ if (document.documentElement) fn(); }, {once:true}); }
  function byId(id){ return document.getElementById(id); }
  function qs(s){ return document.querySelector(s); }
  function on(s,ev,cb){ const el=qs(s); if (el) el.addEventListener(ev, cb); }
  function lockScroll(y){ const de=document.documentElement; if (y){ de.style.setProperty('--twc-prev', getComputedStyle(de).overflow); de.style.overflow='hidden'; } else { const p=de.style.getPropertyValue('--twc-prev'); de.style.overflow=p||''; de.style.removeProperty('--twc-prev'); } }
})();
