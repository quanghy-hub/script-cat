// ==UserScript==
// @name         Gestures
// @namespace    https://github.com/yourname/vm-unified-gestures-open-tab
// @version      1.7
// @description  Long-press mở link; right-click mở tab; DOUBLE right-click đóng tab; DOUBLE tap (touch) đóng tab; Hai ngón giữ nguyên ≥500ms (không di chuyển/không pinch/không scroll) → đi cuối trang.
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @run-at       document-start
// @noframes
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/gestures.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/gestures.js
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        window.close
// @license      MIT
// ==/UserScript==

/* ===== GLOBAL GUARD ===== */
(() => {
  'use strict';
  const G = (window.__GESTURES_GUARD__ ||= { killUntil:0, suppress(ms=800){ this.killUntil = Date.now()+ms; } });
  if (!window.__GESTURES_GUARD_LISTENERS__) {
    window.__GESTURES_GUARD_LISTENERS__ = true;
    const eat = ev => { if (Date.now() <= G.killUntil) { ev.preventDefault(); ev.stopPropagation(); } };
    addEventListener('click', eat, true);
    addEventListener('auxclick', eat, true);
    addEventListener('contextmenu', eat, true);
  }
})();

/* ===== Unified Gestures ===== */
(() => {
  'use strict';
  const G = window.__GESTURES_GUARD__;
  const STORE_KEY = 'vmug_cfg_v168';
  const DEFAULTS = {
    lpress:     { enabled:true, mode:'bg', longMs:500, tapTol:24 },
    rclick:     { enabled:true, mode:'fg' },
    dblRightMs: 600,
    dblTapMs:   260
  };

  const deepClone=o=>JSON.parse(JSON.stringify(o));
  const loadCfg=()=>{ try{ const raw=GM_getValue(STORE_KEY,''); return raw?Object.assign(deepClone(DEFAULTS), typeof raw==='string'?JSON.parse(raw):raw):deepClone(DEFAULTS);}catch{ return deepClone(DEFAULTS);} };
  const saveCfg=()=>{ try{ GM_setValue(STORE_KEY, JSON.stringify(CFG)); }catch{} };
  let CFG = loadCfg();

  /* ===== Menus ===== */
  GM_registerMenuCommand?.(`🖱️ Right-click open: ${CFG.rclick.enabled?'On':'Off'} • ${CFG.rclick.mode.toUpperCase()}`, () => {
    const on = confirm('Bật right-click mở tab mới? OK=On, Cancel=Off');
    CFG.rclick.enabled = on;
    if (on) {
      const mode = (prompt('Chọn BG hay FG?', CFG.rclick.mode||'fg')||'fg').toLowerCase().startsWith('f')?'fg':'bg';
      CFG.rclick.mode = mode;
    }
    saveCfg(); alert('Saved.');
  });
  GM_registerMenuCommand?.(`⚙️ Long-press: ${CFG.lpress.enabled?'On':'Off'} • ${CFG.lpress.mode.toUpperCase()}`, () => {
    const on = confirm('Bật long-press mở link? OK=On, Cancel=Off');
    CFG.lpress.enabled = on;
    if (on) {
      const mode = (prompt('Mode BG/FG?', CFG.lpress.mode||'bg')||'bg').toLowerCase().startsWith('f')?'fg':'bg';
      CFG.lpress.mode = mode;
      const ms = Number(prompt('Thời gian giữ (ms ≥ 300):', String(CFG.lpress.longMs)));
      if (Number.isFinite(ms) && ms>=300) CFG.lpress.longMs = ms;
    }
    saveCfg(); alert('Saved.');
  });
  GM_registerMenuCommand?.(`⏱️ Double tap window (ms): ${CFG.dblTapMs}`, () => {
    const v = Number(prompt('Khoảng thời gian double tap (ms):', String(CFG.dblTapMs)));
    if (Number.isFinite(v) && v>=200 && v<=800){ CFG.dblTapMs=v; saveCfg(); alert('Saved.'); }
  });
  GM_registerMenuCommand?.(`🎯 Tap tolerance (px): ${CFG.lpress.tapTol}`, () => {
    const v = Number(prompt('Dung sai vị trí (px):', String(CFG.lpress.tapTol)));
    if (Number.isFinite(v) && v>=8 && v<=64){ CFG.lpress.tapTol=v; saveCfg(); alert('Saved.'); }
  });

  /* ===== Helpers ===== */
  const inEditable = el => !!(el && el.closest && el.closest('input,textarea,select,button,[contenteditable]'));
  const hasSelection = () => { const s=window.getSelection&&window.getSelection(); return !!(s && s.type==='Range' && String(s).length>0); };
  const getAnchorFromEvent = ev => {
    const path=(ev.composedPath&&ev.composedPath())||[];
    for (const n of path) if (n?.nodeType===1 && n.nodeName==='A' && n.hasAttribute?.('href')) return n;
    return ev.target?.closest?.('a[href]')||null;
  };
  const validLink = a => {
    if (!a) return false;
    const h=(a.getAttribute('href')||'').trim().toLowerCase();
    return h && !(h.startsWith('#')||h.startsWith('javascript:')||h.startsWith('mailto:')||h.startsWith('tel:'));
  };
  function openByMode(url, mode){
    const active = (mode==='fg');
    try{ GM_openInTab(url,{active,insert:true,setParent:true}); }
    catch{ const w=window.open(url,'_blank','noopener'); if(w && !active){ try{ w.blur(); window.focus(); }catch{} } }
    G.suppress(900);
  }
  function closeTabSafe(){
    try{ window.close(); }catch{}
    try{ window.open('','_self'); window.close(); }catch{}
    try{ if(history.length>1) history.back(); }catch{}
    G.suppress(600);
    blockNextContextmenuUntil = Date.now()+600;
  }
  function scrollToBottomSmooth(){
    const se = document.scrollingElement || document.documentElement || document.body;
    const h = Math.max(se.scrollHeight, document.body.scrollHeight, document.documentElement.scrollHeight);
    try{ window.scrollTo({ top: h, behavior: 'smooth' }); }
    catch{ window.scrollTo(0, h); }
    G.suppress(300);
  }

  /* ===== State ===== */
  let blockNextContextmenuUntil = 0;
  let lastPointerType = 'mouse';
  let lpFiredAt = 0;
  addEventListener('pointerdown', ev => { lastPointerType = ev.pointerType||'mouse'; }, true);

  /* ===== Long-press mở LINK ===== */
  let lpDownX=0, lpDownY=0, lpAnchor=null, lpMoved=false, lpTimer=null, lpFired=false;
  addEventListener('pointerdown', ev => {
    if (!CFG.lpress.enabled) return;
    if (inEditable(ev.target) || hasSelection()) return;
    if (ev.pointerType==='mouse' && ev.button!==0) return;
    const a=getAnchorFromEvent(ev); if(!validLink(a)) return;

    lpDownX=ev.clientX; lpDownY=ev.clientY;
    lpAnchor=a; lpMoved=false; lpFired=false;
    clearTimeout(lpTimer);
    lpTimer=setTimeout(()=>{
      if(!lpAnchor||lpMoved) return;
      lpFired=true; lpFiredAt=Date.now();
      openByMode(lpAnchor.href, CFG.lpress.mode);
      G.suppress(2000);
      blockNextContextmenuUntil = Date.now()+2000;
    }, CFG.lpress.longMs);
  }, true);
  addEventListener('pointermove', ev => {
    if(!lpAnchor) return;
    const dx=Math.abs(ev.clientX-lpDownX), dy=Math.abs(ev.clientY-lpDownY);
    if(dx>CFG.lpress.tapTol || dy>CFG.lpress.tapTol){ lpMoved=true; clearTimeout(lpTimer); lpTimer=null; }
  }, true);
  function endLP(ev){
    if(lpTimer){ clearTimeout(lpTimer); lpTimer=null; }
    if(lpFired){ ev.preventDefault?.(); ev.stopPropagation?.(); G.suppress(1200); blockNextContextmenuUntil=Date.now()+1200; }
    lpAnchor=null; lpFired=false;
  }
  addEventListener('pointerup', endLP, {capture:true, passive:false});
  addEventListener('pointercancel', endLP, {capture:true, passive:false});

  /* ===== Chặn mousedown phải điều hướng tab hiện tại ===== */
  addEventListener('mousedown', ev => {
    if (ev.button!==2) return;
    if (!CFG.rclick.enabled) return;
    const a=getAnchorFromEvent(ev); if(!validLink(a)) return;
    ev.preventDefault(); ev.stopPropagation();
  }, true);

  /* ===== DOUBLE RIGHT click → CLOSE TAB ===== */
  let lastRTime=0, lastRX=0, lastRY=0;
  addEventListener('mousedown', ev => {
    if(ev.button!==2) return;
    if(inEditable(ev.target)) return;
    const now=Date.now();
    const closeTime=(now-lastRTime)<=CFG.dblRightMs;
    const closeSpace=Math.hypot(ev.clientX-lastRX, ev.clientY-lastRY)<=CFG.lpress.tapTol;
    if(closeTime && closeSpace){
      ev.preventDefault(); ev.stopPropagation();
      blockNextContextmenuUntil=now+600;
      lastRTime=0;
      closeTabSafe(); return;
    }
    lastRTime=now; lastRX=ev.clientX; lastRY=ev.clientY;
  }, true);

  /* ===== Right-click (contextmenu) → OPEN NEW TAB (BG/FG) ===== */
  addEventListener('contextmenu', ev => {
    if (!CFG.rclick.enabled) return;
    const now=Date.now();
    if(now - lpFiredAt <= 800){ ev.preventDefault(); ev.stopPropagation(); return; }
    if(now <= blockNextContextmenuUntil){ ev.preventDefault(); ev.stopPropagation(); return; }
    if(lastPointerType!=='mouse'){ ev.preventDefault(); ev.stopPropagation(); return; }
    const a=getAnchorFromEvent(ev); if(!validLink(a)) return;
    ev.preventDefault(); ev.stopPropagation();
    openByMode(a.href, CFG.rclick.mode);
    blockNextContextmenuUntil = now+600;
  }, true);

  /* ===== TOUCH: DOUBLE TAP → CLOSE TAB ===== */
  let taps=[]; // {t,x,y}
  addEventListener('touchstart', ev => {
    if(inEditable(ev.target)) return;
    if(ev.touches.length!==1) { taps=[]; return; }

    const now=Date.now();
    const t0=ev.touches?.[0]; if(!t0) return;

    if(!taps.length){
      taps=[{t:now,x:t0.clientX,y:t0.clientY}];
      return;
    }else{
      const tFirst=taps[0].t;
      const d=Math.hypot(t0.clientX-taps[0].x, t0.clientY-taps[0].y);
      if((now - tFirst) <= CFG.dblTapMs && d <= CFG.lpress.tapTol){
        ev.preventDefault(); ev.stopPropagation();
        taps=[]; closeTabSafe();
      }else{
        taps=[{t:now,x:t0.clientX,y:t0.clientY}];
      }
    }
  }, {capture:true, passive:false});

  /* ===== TOUCH: HAI NGÓN GIỮ NGUYÊN ≥500ms → SCROLL BOTTOM =====
     Điều kiện:
     - Bắt đầu với đúng 2 ngón.
     - Mỗi ngón không dịch chuyển quá MOVE_TOL.
     - Khoảng cách giữa 2 ngón không đổi trong SCALE_TOL (tránh pinch/zoom).
     - Trang không bị cuộn quá SCROLL_TOL trong thời gian giữ.
     - Không preventDefault → không cản trở pinch/zoom/scroll tự nhiên; chỉ kích hoạt khi thật sự đứng yên. */
  const TWO_FINGER_HOLD_MS = 500;
  const MOVE_TOL   = 12;  // px: mỗi ngón không được lệch quá mức này
  const SCALE_TOL  = 10;  // px: thay đổi khoảng cách giữa 2 ngón coi như pinch
  const SCROLL_TOL = 2;   // px: nếu trang đã cuộn trong lúc giữ, hủy

  let tf = null; // {timer, id1,id2, start:[{id,x,y},{id,x,y}], startDist, sX,sY, movedOrScaled, scrolled}

  function clearTF(){ if(tf?.timer){ clearTimeout(tf.timer); } tf=null; }

  function getTouchById(touchList, id){
    for(let i=0;i<touchList.length;i++){ if(touchList[i].identifier===id) return touchList[i]; }
    return null;
  }

  addEventListener('touchstart', ev => {
    if(inEditable(ev.target)) return;

    // khởi tạo khi vừa có đúng 2 ngón
    if(!tf && ev.touches.length===2){
      const a = ev.touches[0], b = ev.touches[1];
      const dist0 = Math.hypot(a.clientX-b.clientX, a.clientY-b.clientY);
      tf = {
        id1:a.identifier, id2:b.identifier,
        start:[{id:a.identifier,x:a.clientX,y:a.clientY},{id:b.identifier,x:b.clientX,y:b.clientY}],
        startDist: dist0,
        sX: (document.scrollingElement||document.documentElement).scrollLeft || window.pageXOffset || 0,
        sY: (document.scrollingElement||document.documentElement).scrollTop  || window.pageYOffset || 0,
        movedOrScaled:false, scrolled:false,
        timer: setTimeout(() => {
          if(tf && !tf.movedOrScaled && !tf.scrolled){
            scrollToBottomSmooth();
            clearTF();
          }
        }, TWO_FINGER_HOLD_MS)
      };
      return;
    }

    // nếu thêm bớt ngón → hủy
    if(tf && ev.touches.length!==2) clearTF();
  }, {capture:true, passive:true});

  addEventListener('touchmove', ev => {
    if(!tf) return;

    // số ngón phải luôn là 2
    if(ev.touches.length!==2){ clearTF(); return; }

    // phát hiện trang đã cuộn
    const se = document.scrollingElement||document.documentElement;
    const nowX = se.scrollLeft || window.pageXOffset || 0;
    const nowY = se.scrollTop  || window.pageYOffset || 0;
    if(Math.abs(nowX - tf.sX) > SCROLL_TOL || Math.abs(nowY - tf.sY) > SCROLL_TOL){
      tf.scrolled = true; clearTF(); return;
    }

    // vị trí hiện tại của 2 id
    const t1 = getTouchById(ev.touches, tf.id1);
    const t2 = getTouchById(ev.touches, tf.id2);
    if(!t1 || !t2){ clearTF(); return; }

    // kiểm tra di chuyển từng ngón
    const s1 = tf.start[0].id===tf.id1 ? tf.start[0] : tf.start[1];
    const s2 = tf.start[0].id===tf.id2 ? tf.start[0] : tf.start[1];
    const move1 = Math.hypot(t1.clientX - s1.x, t1.clientY - s1.y);
    const move2 = Math.hypot(t2.clientX - s2.x, t2.clientY - s2.y);
    if(move1 > MOVE_TOL || move2 > MOVE_TOL){ tf.movedOrScaled = true; clearTF(); return; }

    // kiểm tra thay đổi khoảng cách 2 ngón (pinch/zoom)
    const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
    if(Math.abs(dist - tf.startDist) > SCALE_TOL){ tf.movedOrScaled = true; clearTF(); return; }
  }, {capture:true, passive:true});

  addEventListener('touchend', () => { if(tf) clearTF(); }, {capture:true, passive:true});
  addEventListener('touchcancel', () => { if(tf) clearTF(); }, {capture:true, passive:true});
})();
