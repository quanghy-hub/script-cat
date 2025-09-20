// ==UserScript==
// @name         PACS CT Swipe Override — Fast Slice (Chromium Android Foldables)
// @namespace    pacs.ct.swipe.override
// @version      0.6.2
// @description  Vô hiệu gesture gốc và thay bằng vuốt để đổi lát cắt rất nhanh; 1 ngón = slice, 2 ngón = zoom. Tối ưu cho PACS chạy Cornerstone/OHIF/Weasis. Bật/tắt nhanh, nhạy mượt, không lag.
// @match        https://pacs.umc.edu.vn/*
// @updateURL   https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/pac.js
// @downloadURL https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/pac.js
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// ==/UserScript==
(() => {
  'use strict';

  const KEY = 'pacs_swipe_cfg';
  const def = {
    enabled: true,
    axis: 'horizontal',   // 'horizontal' | 'vertical'  — 1 ngón đổi slice theo trục này
    invert: false,        // đảo chiều
    sens: 0.14,           // độ nhạy (px → số bước/lát), tăng nếu stack dày ~700 ảnh
    dead: 8,              // vùng chết px
    zoomCtrlWheel: true,  // 2 ngón -> gửi wheel với ctrlKey để zoom
    stepPulse: 1,         // mỗi “bước” gửi bao nhiêu wheel events
    wheelDelta: 120,      // độ lớn deltaY mỗi nhịp (120 là chuẩn legacy)
    edgeGuard: 20         // bỏ qua vuốt bắt đầu sát rìa tránh gesture hệ thống
  };
  const cfg = load();

  function load() {
    try { return Object.assign({}, def, GM_getValue(KEY) || {}); } catch { return {...def}; }
  }
  function save(k, v) { cfg[k] = v; try { GM_setValue(KEY, cfg); } catch {} }

  const log = (...a) => console.log('[PACS Swipe]', ...a);

  // ===== UI nhỏ: nút bật/tắt và toast =====
  GM_addStyle(`
    .psw-toast{position:fixed;left:50%;top:12%;transform:translateX(-50%);background:#000c;color:#fff;
      padding:6px 10px;border-radius:8px;z-index:2147483647;font-size:13px;pointer-events:none}
    .psw-fab{position:fixed;right:10px;bottom:12px;width:36px;height:36px;border-radius:50%;
      background:#0a84ffcc;color:#fff;display:flex;align-items:center;justify-content:center;
      font:600 14px/1 system-ui;z-index:2147483646}
    .psw-fab.off{background:#666a}
  `);
  const toast = (s, ms=900) => { const t=document.createElement('div'); t.className='psw-toast'; t.textContent=s;
    document.documentElement.appendChild(t); setTimeout(()=>t.remove(), ms); };

  // Menu
  if (window===top) {
    GM_registerMenuCommand(`[${cfg.enabled?'ON':'OFF'}] PACS Swipe: bật/tắt`, () => toggle());
    GM_registerMenuCommand(`Trục: ${cfg.axis} (đổi trục)`, () => { save('axis', cfg.axis==='horizontal'?'vertical':'horizontal'); toast('Trục: '+cfg.axis); });
    GM_registerMenuCommand(`Đảo chiều: ${cfg.invert?'Có':'Không'} (đổi)`, () => { save('invert', !cfg.invert); toast('Đảo chiều: '+(cfg.invert?'Có':'Không')); });
    GM_registerMenuCommand('Tăng độ nhạy', () => { save('sens', +(cfg.sens*1.25).toFixed(3)); toast('Nhạy: '+cfg.sens); });
    GM_registerMenuCommand('Giảm độ nhạy', () => { save('sens', +(cfg.sens/1.25).toFixed(3)); toast('Nhạy: '+cfg.sens); });
  }

  // FAB bật/tắt nhanh
  let fab;
  const mountFab = () => {
    if (fab || document.readyState==='loading') return;
    fab = document.createElement('button');
    fab.className='psw-fab'+(cfg.enabled?'':' off');
    fab.textContent='CT';
    fab.title='Bật/tắt PACS Swipe';
    fab.addEventListener('click', toggle, {passive:true});
    document.documentElement.appendChild(fab);
  };
  const toggle = () => { save('enabled', !cfg.enabled); fab && fab.classList.toggle('off', !cfg.enabled); toast(cfg.enabled?'Swipe: ON':'Swipe: OFF'); };

  // ===== Tìm viewport ảnh (canvas lớn nhất) và phủ overlay =====
  let overlay, targetEl;

  function visible(el){ const r=el.getBoundingClientRect(); return r.width>320 && r.height>240 && r.top<innerHeight && r.bottom>0 && getComputedStyle(el).visibility!=='hidden' && el.offsetParent!==null; }
  function pickViewport(){
    // ứng viên phổ biến: Cornerstone/OHIF/Weasis
    const qs = [
      '.cornerstone-canvas','canvas.cornerstone-canvas','div.viewport-element canvas','div.imageViewerViewport canvas',
      'canvas.dwv','canvas.weasis', 'canvas', '.dicomImage', '.ViewportCanvas'
    ].join(',');
    let nodes = Array.from(document.querySelectorAll(qs)).filter(visible);
    if (!nodes.length) return null;
    // chọn canvas có diện tích lớn nhất
    nodes.sort((a,b)=> (b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight));
    const canvas = nodes[0];
    // lấy cha hiển thị để bắt sự kiện
    let p=canvas; while (p && p.parentElement && p.parentElement.clientWidth>=canvas.clientWidth*0.8 && p.parentElement.clientHeight>=canvas.clientHeight*0.8) p=p.parentElement;
    return p || canvas;
  }

  function mountOverlay(){
    if (overlay) overlay.remove();
    targetEl = pickViewport();
    if (!targetEl) return;

    // Ngăn gesture gốc của trang trong vùng ảnh
    targetEl.style.touchAction = 'none';
    targetEl.style.webkitUserSelect = 'none';
    targetEl.style.userSelect = 'none';
    targetEl.style.overscrollBehavior = 'contain';

    overlay = document.createElement('div');
    overlay.style.position='absolute';
    overlay.style.inset='0';
    overlay.style.pointerEvents='auto';
    overlay.style.background='transparent';
    overlay.style.touchAction='none';
    overlay.style.zIndex='2147483645';

    // đặt đúng stacking context
    const host = targetEl;
    host.style.position = getComputedStyle(host).position==='static' ? 'relative' : getComputedStyle(host).position;
    host.appendChild(overlay);

    bindGestures(overlay, host);
    log('Overlay mounted on', host);
  }

  // Theo dõi thay đổi DOM (SPA trong portal)
  new MutationObserver(() => {
    if (!document.body) return;
    if (!overlay || !overlay.isConnected) mountOverlay();
  }).observe(document.documentElement, {childList:true, subtree:true});

  window.addEventListener('load', () => { mountFab(); mountOverlay(); });
  if (document.readyState!=='loading') { mountFab(); mountOverlay(); }

  // ===== Bộ phát “wheel”/“key” giả lập =====
  function emitWheel(target, {dx=0, dy=0, ctrl=false, x, y}) {
    const r = target.getBoundingClientRect();
    const cx = x ?? (r.left + r.width/2);
    const cy = y ?? (r.top + r.height/2);
    const ev = new WheelEvent('wheel', {
      bubbles:true, cancelable:true, composed:true,
      deltaX: dx, deltaY: dy, deltaMode: 0,
      clientX: cx, clientY: cy, ctrlKey: ctrl
    });
    target.dispatchEvent(ev);
  }
  function emitKey(target, code){ // dự phòng nếu viewer bắt phím
    const ev = new KeyboardEvent('keydown', {bubbles:true, cancelable:true, key:code.includes('Arrow')?code.replace('Arrow',''):code, code, which:0});
    target.dispatchEvent(ev);
  }

  // ===== Gesture một ngón = đổi lát cắt; hai ngón = zoom =====
  function bindGestures(layer, wheelTarget){
    let touching=false, t0x=0, t0y=0, lastStep=0, multi=false, startTime=0;

    const stopNative = (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); };

    layer.addEventListener('touchstart', (e) => {
      if (!cfg.enabled) return;
      if (!(e.target===layer || layer.contains(e.target))) return;
      if (e.touches.length===1){
        const t=e.touches[0];
        if (t.clientX<cfg.edgeGuard || t.clientX>innerWidth-cfg.edgeGuard) return; // tránh gesture hệ thống
        touching=true; multi=false; startTime=performance.now();
        t0x = t.clientX; t0y = t.clientY; lastStep=0;
        stopNative(e);
      } else if (e.touches.length===2){
        touching=true; multi=true; lastStep=0; stopNative(e);
      }
    }, {capture:true, passive:false});

    layer.addEventListener('touchmove', (e) => {
      if (!cfg.enabled || !touching) return;
      stopNative(e);

      if (!multi && e.touches.length===1){
        const t=e.touches[0];
        const dx = t.clientX - t0x;
        const dy = t.clientY - t0y;
        const dist = (cfg.axis==='horizontal' ? dx : dy);
        if (Math.abs(dist) <= cfg.dead) return;

        // bước mới tính theo độ nhạy; có đảo chiều
        let step = Math.floor((dist - Math.sign(dist)*cfg.dead) * cfg.sens);
        if (cfg.invert) step = -step;

        if (step !== lastStep){
          const delta = Math.sign(step - lastStep) * (cfg.wheelDelta||120);
          const times = Math.min(20, Math.abs(step - lastStep) * (cfg.stepPulse||1));
          const pos = { x: t.clientX, y: t.clientY };

          // phát nhiều nhịp wheel để “nhảy” nhiều lát
          for (let i=0;i<times;i++){
            emitWheel(wheelTarget, {dy: -delta, x: pos.x, y: pos.y}); // -delta: điều chỉnh để trực quan
          }

          // dự phòng nếu wheel không ăn
          if (times===0){
            emitKey(wheelTarget, delta>0 ? 'ArrowRight' : 'ArrowLeft');
            emitKey(wheelTarget, delta>0 ? 'PageDown' : 'PageUp');
          }

          lastStep = step;
        }
      }

      if ((multi && e.touches.length>=2) || (!multi && e.touches.length===2)){
        multi = true;
        // pinch zoom → gửi wheel với ctrlKey
        if (!cfg.zoomCtrlWheel) return;
        const [a,b] = [e.touches[0], e.touches[1]];
        const cx = (a.clientX+b.clientX)/2, cy=(a.clientY+b.clientY)/2;
        // dùng khoảng cách biến thiên thành nhịp wheel
        const dx = (a.clientX-b.clientX), dy=(a.clientY-b.clientY);
        const dist = Math.hypot(dx,dy);
        // lưu lần đầu
        if (!layer._pz0){ layer._pz0 = dist; }
        const delta = dist - layer._pz0;
        if (Math.abs(delta) > 6){
          const pulses = Math.min(12, Math.round(Math.abs(delta)/12));
          const sign = delta>0 ? -1 : 1; // zoom in = wheel lên (âm)
          for (let i=0;i<pulses;i++){
            emitWheel(wheelTarget, {dy: sign*(cfg.wheelDelta||120), ctrl:true, x: cx, y: cy});
          }
          layer._pz0 = dist;
        }
      }
    }, {capture:true, passive:false});

    const endAll = (e) => {
      if (!touching) return;
      stopNative(e);
      touching=false; multi=false; layer._pz0=undefined;

      // giữ 2 ngón ~800ms để toggle
      if ((e.changedTouches?.length>=1) && performance.now()-startTime>800 && e.type==='touchend'){
        // nếu là thao tác 2 ngón kéo ngắn thì coi như toggle
        if (e.touches.length===0 && (e.changedTouches.length>1)){
          toggle();
        }
      }
    };
    layer.addEventListener('touchend', endAll, {capture:true, passive:false});
    layer.addEventListener('touchcancel', endAll, {capture:true, passive:false});

    // Ngăn trang tự nghe touch/wheel trong vùng overlay
    ['pointerdown','pointermove','pointerup','wheel'].forEach(type=>{
      layer.addEventListener(type, (e)=>{ if (cfg.enabled){ stopNative(e); } }, {capture:true, passive:false});
    });
  }

  // ===== Thay đổi layout màn gập =====
  window.addEventListener('resize', () => {
    // viewport thay đổi trên màn gập → remount overlay để khít vùng ảnh
    if (overlay && overlay.isConnected) {
      requestAnimationFrame(() => { mountOverlay(); });
    }
  });

})();
