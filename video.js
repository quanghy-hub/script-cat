// ==UserScript==
// @name         Video
// @namespace    https://your.namespace
// @version      1.1.0
// @description  Full-screen landscape, swipe seek with realtime frame preview, long-press speed, ArrowRight/Forward-key seek, ArrowLeft/Back-key seek, 500% volume boost (WebAudio), in-page Settings panel.
// @match        *://*/*
// @updateURL   https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/video.js
// @downloadURL https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/video.js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==
/*jshint esversion: 8*/
(function () {
  'use strict';

  GM_addStyle(`
    :not(:root):fullscreen{user-select:none !important;}
    .mvh-toast{position:fixed;left:50%;top:12%;transform:translateX(-50%);
      background:#000;opacity:.6;color:#fff;padding:6px 10px;border-radius:6px;z-index:2147483647;font-size:14px;pointer-events:none}
    .mvh-settings-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483646;display:flex;align-items:center;justify-content:center}
    .mvh-settings{width:min(92vw,560px);background:#111;color:#f2f2f2;border:1px solid #333;border-radius:12px;
      box-shadow:0 12px 28px rgba(0,0,0,.45);padding:14px 16px;max-height:80vh;overflow:auto}
    .mvh-settings h3{margin:0 0 10px 0;font-size:16px}
    .mvh-row{display:flex;gap:10px;align-items:center;margin:8px 0;flex-wrap:wrap}
    .mvh-row label{min-width:180px}
    .mvh-settings input[type="number"]{width:110px;background:#181818;color:#eee;border:1px solid #444;border-radius:6px;padding:4px 6px}
    .mvh-settings input[type="range"]{width:220px}
    .mvh-settings input[type="checkbox"]{transform:scale(1.1)}
    .mvh-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:10px}
    .mvh-btn{background:#2b6cb0;border:none;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer}
    .mvh-btn.secondary{background:#444}
    .mvh-note{opacity:.8;font-size:12px}
  `);

  const LOG = (...a)=>console.log('[MobileVideoHelper]', ...a);

  const videos  = document.getElementsByTagName('video');
  const iframes = document.getElementsByTagName('iframe');
  const baseDomain = location.host.toLowerCase().split('.').slice(-2).join('.');

  const STORE_KEY = 'mvh_cfg_v2';
  const defaults = {
    voiced: true,
    speed:  true,
    rate:   4,
    sensitivity1: 0.5,
    threshold:    300,
    sensitivity2: 0.2,
    hotkeys: true,
    forwardStep: 5,     // ArrowRight/Forward
    boostEnabled: true,
    boostLevel: 1.0,    // 1.0x→5.0x
    maxBoost: 5.0,
    // NEW:
    realtimePreview: true, // update frame while swiping
    scrubThrottleMs: 80     // throttle seek updates (ms)
  };

  const settings = Object.assign({}, defaults);
  for (const k in defaults) {
    const v = GM_getValue(`${STORE_KEY}:${k}`);
    settings[k] = (v == null) ? defaults[k] : v;
  }
  const saveSetting=(k,v)=>{ settings[k]=v; try{GM_setValue(`${STORE_KEY}:${k}`,v);}catch(e){} };

  const showToast=(msg,ms=900)=>{
    const t=document.createElement('div'); t.className='mvh-toast'; t.textContent=msg;
    document.documentElement.appendChild(t); setTimeout(()=>t.remove(), ms);
  };

  const isTyping=(el)=> !!el && (el.isContentEditable || ['input','textarea','select'].includes((el.tagName||'').toLowerCase()));

  const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));

  function getActiveVideo(){
    if (document.fullscreenElement){
      const fe=document.fullscreenElement;
      if (fe?.tagName?.toLowerCase()==='video') return fe;
      const v=fe?.querySelector?.('video'); if (v) return v;
    }
    for (const v of videos){ if (v.readyState>=2 && !v.paused && v.offsetWidth>0 && v.offsetHeight>0) return v; }
    for (const v of videos){ if (v.offsetWidth>0 && v.offsetHeight>0) return v; }
    return null;
  }

  // --- WebAudio Boost ---
  let audioCtx=null; const boosters=new WeakMap();
  const ensureAudioCtx=()=> audioCtx||(audioCtx=new (window.AudioContext||window.webkitAudioContext)());
  function attachBoost(video){
    if (!settings.boostEnabled || !video) return false;
    if (boosters.has(video)) return true;
    const ctx=ensureAudioCtx(); if (!ctx) return false;
    try{
      const src=ctx.createMediaElementSource(video); const gain=ctx.createGain();
      const level=clamp(Number(settings.boostLevel)||1,1,Number(settings.maxBoost)||5);
      gain.gain.value=level; src.connect(gain).connect(ctx.destination); boosters.set(video,{source:src,gain});
      return true;
    }catch(e){ boosters.set(video,{error:true}); return false; }
  }
  function applyBoostLevel(video,level){
    if (!video) return;
    if (!attachBoost(video)){ showToast('Audio boost not available here'); return; }
    const ref=boosters.get(video);
    if (ref?.gain){ const lv=clamp(level,1,Number(settings.maxBoost)||5); ref.gain.gain.value=lv; saveSetting('boostLevel',lv); showToast(`BOOST ${Math.round(lv*100)}%`); }
  }

  // --- Prepare videos/iframes ---
  function makeVideoAndIframeReady(){
    for (let v of videos){ if (v.controls) v.controlsList=['nofullscreen']; }
    for (let f of iframes){ f.allowFullscreen=true; }
  }
  makeVideoAndIframeReady();

  let mutationTimer=0;
  new MutationObserver(list=>{
    for (const m of list){
      if (m.type!=='childList') continue;
      for (const node of m.addedNodes){
        if (node.nodeType!==1) continue;
        const tag=node.tagName.toLowerCase();
        if (tag==='video'||tag==='iframe'){
          if (mutationTimer) clearTimeout(mutationTimer);
          mutationTimer=setTimeout(()=>{ mutationTimer=0; makeVideoAndIframeReady(); },800);
          return;
        }
      }
    }
  }).observe(document.body,{childList:true,subtree:true});

  // --- Keyboard: forward & backward seek + boost cycle ---
  document.addEventListener('keydown', async (e)=>{
    if (!settings.hotkeys) return;
    if (isTyping(e.target)) return;
    const v=getActiveVideo(); if (!v) return;

    if (audioCtx && audioCtx.state==='suspended'){ try{await audioCtx.resume();}catch{} }

    const step=clamp(Number(settings.forwardStep)||5,1,120);
    const key=e.key;

    // Forward
    if (key==='ArrowRight' || key==='MediaTrackNext' || key==='MediaFastForward'){
      try{ v.currentTime = clamp(v.currentTime + step, 0, (v.duration||1e9)-0.05); }catch{}
      showToast(`>> ${step}s`); e.preventDefault(); return;
    }
    // Backward (NEW)
    if (key==='ArrowLeft' || key==='MediaTrackPrevious' || key==='MediaRewind'){
      try{ v.currentTime = clamp(v.currentTime - step, 0, (v.duration||1e9)-0.05); }catch{}
      showToast(`<< ${step}s`); e.preventDefault(); return;
    }
    // Quick boost cycle
    if (key==='b' || key==='B'){
      if (!settings.boostEnabled){ showToast('Boost disabled'); return; }
      let next=(Number(settings.boostLevel)||1)+1; if (next>settings.maxBoost) next=1;
      applyBoostLevel(v,next); e.preventDefault(); return;
    }
  }, true);

  // --- Settings panel in VM menu ---
  if (window===top){ GM_registerMenuCommand('⚙️ Open Settings Panel', openSettingsPanel); }
  function openSettingsPanel(){
    const mask=document.createElement('div'); mask.className='mvh-settings-mask';
    const panel=document.createElement('div'); panel.className='mvh-settings'; mask.appendChild(panel);
    const s=settings, boostPct=Math.round((Number(s.boostLevel)||1)*100);

    panel.innerHTML = `
      <h3>Mobile Video Helper — Settings</h3>
      <div class="mvh-row"><label><input type="checkbox" id="mvh-hotkeys" ${s.hotkeys?'checked':''}> Enable keyboard hotkeys</label></div>
      <div class="mvh-row"><label>Forward/Backward step (s)</label>
        <input type="number" id="mvh-forward" min="1" max="120" step="1" value="${Number(s.forwardStep)||5}">
        <span class="mvh-note">ArrowRight / ArrowLeft</span>
      </div>
      <div class="mvh-row"><label><input type="checkbox" id="mvh-voiced" ${s.voiced?'checked':''}> Unmute video on touch</label></div>
      <div class="mvh-row"><label><input type="checkbox" id="mvh-speedbtn" ${s.speed?'checked':''}> Show Speed button on long-press (fullscreen)</label></div>
      <div class="mvh-row"><label>Long-press speed (x)</label>
        <input type="number" id="mvh-rate" min="0.25" max="6" step="0.25" value="${Number(s.rate)||4}">
      </div>
      <div class="mvh-row"><label>Swipe sensitivity (long video)</label>
        <input type="number" id="mvh-sens1" min="0" max="3" step="0.1" value="${Number(s.sensitivity1)||0.5}">
      </div>
      <div class="mvh-row"><label>Short video threshold (s)</label>
        <input type="number" id="mvh-thr" min="0" max="36000" step="1" value="${Number(s.threshold)||300}">
      </div>
      <div class="mvh-row"><label>Swipe sensitivity (short video)</label>
        <input type="number" id="mvh-sens2" min="0" max="3" step="0.1" value="${Number(s.sensitivity2)||0.2}">
      </div>
      <hr style="border-color:#333">
      <div class="mvh-row"><label><input type="checkbox" id="mvh-rt" ${s.realtimePreview?'checked':''}> Realtime preview while swiping</label></div>
      <div class="mvh-row"><label>Scrub throttle (ms)</label>
        <input type="number" id="mvh-throttle" min="0" max="500" step="5" value="${Number(s.scrubThrottleMs)||80}">
        <span class="mvh-note">Lower = smoother but heavier</span>
      </div>
      <hr style="border-color:#333">
      <div class="mvh-row"><label><input type="checkbox" id="mvh-boost-enabled" ${s.boostEnabled?'checked':''}> Enable Audio Boost (WebAudio)</label></div>
      <div class="mvh-row"><label>Boost level</label>
        <input type="range" id="mvh-boost" min="100" max="${Math.round(Number(s.maxBoost||5)*100)}" step="25" value="${boostPct}">
        <span id="mvh-boost-label">${boostPct}%</span>
      </div>
      <div class="mvh-actions">
        <button class="mvh-btn secondary" id="mvh-cancel">Close</button>
        <button class="mvh-btn" id="mvh-save">Save</button>
      </div>
      <div class="mvh-note" style="margin-top:6px">
        Tips: ArrowRight/ArrowLeft to seek. Press <b>B</b> to cycle Boost 100% → … → 500%.
      </div>
    `;
    panel.querySelector('#mvh-boost').addEventListener('input', ev=>{
      panel.querySelector('#mvh-boost-label').textContent = `${Number(ev.target.value||100)}%`;
    });
    panel.querySelector('#mvh-cancel').addEventListener('click', ()=>mask.remove());
    panel.querySelector('#mvh-save').addEventListener('click', ()=>{
      const hotkeys = panel.querySelector('#mvh-hotkeys').checked;
      const fwd = clamp(Number(panel.querySelector('#mvh-forward').value)||5,1,120);
      const voiced = panel.querySelector('#mvh-voiced').checked;
      const speedbtn = panel.querySelector('#mvh-speedbtn').checked;
      const rate = clamp(Number(panel.querySelector('#mvh-rate').value)||1,0.25,6);
      const sens1 = clamp(Number(panel.querySelector('#mvh-sens1').value)||0.5,0,3);
      const thr = clamp(Number(panel.querySelector('#mvh-thr').value)||300,0,36000);
      const sens2 = clamp(Number(panel.querySelector('#mvh-sens2').value)||0.2,0,3);
      const rt = panel.querySelector('#mvh-rt').checked;
      const throttle = clamp(Number(panel.querySelector('#mvh-throttle').value)||80,0,500);
      const boostEnabled = panel.querySelector('#mvh-boost-enabled').checked;
      const boostPct2 = clamp(Number(panel.querySelector('#mvh-boost').value)||100,100,Math.round(Number(settings.maxBoost||5)*100));
      const boostLevel = boostPct2/100;

      saveSetting('hotkeys', hotkeys);
      saveSetting('forwardStep', fwd);
      saveSetting('voiced', voiced);
      saveSetting('speed', speedbtn);
      saveSetting('rate', rate);
      saveSetting('sensitivity1', sens1);
      saveSetting('threshold', thr);
      saveSetting('sensitivity2', sens2);
      saveSetting('realtimePreview', rt);
      saveSetting('scrubThrottleMs', throttle);
      saveSetting('boostEnabled', boostEnabled);
      saveSetting('boostLevel', boostLevel);

      const v=getActiveVideo(); if (v && boostEnabled){ applyBoostLevel(v, boostLevel); }
      showToast('Settings saved'); mask.remove();
    });
    document.documentElement.appendChild(mask);
  }

  // --- Touch / gesture with realtime preview ---
  let listenTarget=document; listen();

  function listen(){
    listenTarget.addEventListener("touchstart",(e)=>{
      if (e.touches.length!==1) return;

      const screenX=e.touches[0].screenX, screenY=e.touches[0].screenY;
      if (document.fullscreenElement){
        if (screenX<screen.width*0.05 || screenX>screen.width*0.95 ||
            screenY<screen.height*0.05 || screenY>screen.height*0.95) return;
      }
      let startX=Math.ceil(e.touches[0].clientX);
      let startY=Math.ceil(screenY);
      let endX=startX, endY=startY;

      let videoElement, target=e.target;
      const others=[{domain:"avbebe.com", selector:".fp-ui"}];
      for (let o of others){
        if (baseDomain===o.domain){
          let _t=document.querySelector(o.selector);
          if (!(_t && (target===_t || _t.contains(target)))) return;
          if (target.clientWidth<_t.clientWidth*0.3 || target.clientHeight<_t.clientHeight*0.4) return;
          target=_t; break;
        }
      }

      // find container to place UI
      let biggestContainer, targetWidth=target.clientWidth, targetHeight=target.clientHeight;
      let suitParents=[], allParents=[], temp=target, maybeTiktok=false;

      while(true){
        temp=temp.parentElement; if (!temp) return;
        allParents.push(temp);
        if (temp.clientWidth>0 && temp.clientWidth<targetWidth*1.2 && temp.clientHeight>0 && temp.clientHeight<targetHeight*1.2) suitParents.push(temp);
        if (temp.tagName==='BODY'||temp.tagName==='HTML'||!temp.parentElement){
          if (suitParents.length>0) biggestContainer=suitParents[suitParents.length-1];
          else if (target.tagName!=='VIDEO') return;
          suitParents=null; break;
        }
      }

      if (target.tagName!=='VIDEO'){
        const arr=biggestContainer.getElementsByTagName('video');
        if (arr.length===0) return;
        if (arr.length===1) videoElement=arr[0];
        else { for (let v of arr){ if (v.paused===false) videoElement=v; } if (!videoElement) return; }
      } else videoElement=target;

      if (!document.fullscreenElement && top===window && !videoElement.controls &&
          target.clientHeight>window.innerHeight*0.8 && target.clientWidth>window.innerWidth*0.8){
        maybeTiktok=true;
      }
      if (!maybeTiktok && targetHeight>videoElement.clientHeight*1.5) return;

      const wasPlaying = !videoElement.paused;
      let sampleVideo=false, videoReady=false;
      const onReady=()=>{ videoReady=true; if (videoElement.duration<30) sampleVideo=true; };
      if (videoElement.readyState>0) onReady(); else videoElement.addEventListener('loadedmetadata', onReady, {once:true});

      const componentContainer = findComponentContainer();

      let notice;
      let timeChange=0;
      let direction; // 1 forward, 2 backward
      let haveControls=videoElement.controls;
      let longPress=false;
      let rateTimerBack;

      // Realtime scrub vars (NEW)
      const scrubStartTime = videoElement.currentTime;
      let lastScrubUpdate = 0;
      let didRealtimeSeek = false;
      let pausedForScrub = false;

      // disable long-press context menus
      makeTagAQuiet();
      if (!videoElement.getAttribute("disable_contextmenu")){
        videoElement.addEventListener("contextmenu",(ev)=>ev.preventDefault());
        videoElement.setAttribute("disable_contextmenu", true);
      }
      if (target.tagName==='IMG'){
        target.draggable=false;
        if (!target.getAttribute('disable_contextmenu')){
          target.addEventListener('contextmenu',(ev)=>ev.preventDefault());
          target.setAttribute('disable_contextmenu', true);
        }
      }

      const sharedCSS="border-radius:4px;z-index:99999;opacity:0.5;background-color:black;color:white;display:flex;justify-content:center;align-items:center;text-align:center;user-select:none;";

      // Long-press speed
      let rateTimer=setTimeout(()=>{
        if (wasPlaying && videoElement.paused) videoElement.play();
        rateTimerBack=setTimeout(()=>{ if (videoElement.playbackRate===1) videoElement.playbackRate=settings.rate; },500);
        videoElement.playbackRate=settings.rate;
        videoElement.controls=false;
        target.removeEventListener('touchmove', touchmoveHandler);
        notice.innerText="x"+settings.rate;
        notice.style.display="flex";
        longPress=true;
        rateTimer=null;
        if (!document.fullscreenElement || videoElement.readyState===0 || !settings.speed) return;
        let speedBtn=componentContainer.querySelector(':scope>.me-speed-btn');
        if (speedBtn) speedBtn.style.display='flex';
        else{
          speedBtn=document.createElement('div');
          speedBtn.className='me-speed-btn';
          speedBtn.style.cssText=sharedCSS+"position:absolute;width:30px;height:30px;font-size:16px;";
          speedBtn.style.top="50px"; speedBtn.style.right="20px"; speedBtn.textContent="SPD";
          componentContainer.appendChild(speedBtn);
          speedBtn.addEventListener('touchstart', showSpeedMenu);
        }
        setTimeout(()=>{ speedBtn.style.display='none'; },4000);
        window.addEventListener('resize', ()=>{ speedBtn.style.display='none'; }, {once:true});

        function showSpeedMenu(ev){
          ev.stopPropagation(); this.style.display='none';
          let container=componentContainer.querySelector(':scope>.me-speed-container');
          if (container) container.style.display='flex';
          else{
            container=document.createElement('div'); container.className='me-speed-container'; componentContainer.appendChild(container);
            let css;
            if (videoElement.videoHeight>videoElement.videoWidth){ css=`flex-direction:column;top:0;bottom:0;left:${(window.innerWidth*2)/3 + 40}px`; }
            else { css=`flex-direction:row;left:0;right:0;top:${(window.innerHeight/3)-30}px`; }
            container.style.cssText="display:flex;position:absolute;flex-wrap:nowrap;z-index:99999;justify-content:center;"+css;
            [0.25,0.5,0.75,1,1.25,1.5,1.75,2,3,4,5,6].forEach(val=>{
              const b=document.createElement('div'); container.appendChild(b); b.className='button'; b.textContent=String(val);
              b.style.cssText=sharedCSS+"width:40px;height:30px;margin:2px;font-size:16px;";
              b.addEventListener('touchstart',(ev2)=>{ ev2.stopPropagation(); container.style.display='none'; videoElement.playbackRate=val; setTimeout(()=>{ if (videoElement.playbackRate===1) videoElement.playbackRate=val; },500); });
            });
          }
          componentContainer.addEventListener('touchstart', ()=>{ container.style.display='none'; }, {capture:true, once:true});
          window.addEventListener('resize', ()=>{ container.style.display='none'; }, {once:true});
        }
      }, 800);

      const screenWidth=screen.width;
      const componentMoveLeft=componentContainer.offsetLeft;
      const moveNum=Math.floor(componentMoveLeft*1.1/screenWidth);

      let noticeEl=componentContainer.querySelector(':scope>.me-notice');
      if (!noticeEl){
        noticeEl=document.createElement('div'); noticeEl.className='me-notice';
        const noticeWidth=110, noticeTop=Math.round(componentContainer.clientHeight/6);
        const noticeLeft=Math.round(moveNum*screenWidth + componentContainer.clientWidth/2 - noticeWidth/2);
        noticeEl.style.cssText=sharedCSS+"font-size:16px;position:absolute;display:none;letter-spacing:normal;";
        noticeEl.style.width=noticeWidth+'px'; noticeEl.style.height='30px';
        noticeEl.style.left=noticeLeft+'px'; noticeEl.style.top=noticeTop+'px';
        componentContainer.appendChild(noticeEl);
        window.addEventListener('resize', ()=>noticeEl.remove(), {once:true});
      }
      notice=noticeEl;

      target.addEventListener('touchmove', touchmoveHandler, {passive:false});
      target.addEventListener('touchend', touchendHandler, {once:true});

      function makeTagAQuiet(){
        for (let el of allParents){
          if (el.tagName==='A' && !el.getAttribute('disable_menu_and_drag')){
            el.addEventListener('contextmenu',(ev)=>ev.preventDefault()); el.draggable=false;
            el.setAttribute('disable_menu_and_drag', true); el.target='_blank'; break;
          }
        }
        allParents=null;
      }

      function findComponentContainer(){
        const special=[{domain:'spankbang.com', selector:'.vjs-controls-container'}];
        for (let sp of special){
          if (baseDomain===sp.domain){ const el=document.querySelector(sp.selector); if (el) return commonAncestorWithSize(el, videoElement); }
        }
        if (target.tagName==='VIDEO'){
          let t=videoElement; while(t.parentElement){ if (t.parentElement.clientWidth>0 && t.parentElement.clientHeight>0) return t.parentElement; t=t.parentElement; }
        } else {
          if (getComputedStyle(target).opacity==='0'){ target.style.visibility='hidden'; target.style.opacity='1'; }
          return target;
        }
        function commonAncestorWithSize(e1,e2){
          const anc=(el)=>{const arr=[]; let cur=el; while(cur){arr.push(cur); cur=cur.parentElement;} return arr;};
          const a1=anc(e1), a2=anc(e2);
          for (let x of a1){ if (a2.includes(x) && x.clientWidth>0 && x.clientHeight>0) return x; }
          return null;
        }
      }

      function getClearTimeChange(sec){
        sec=Math.abs(sec); const m=Math.floor(sec/60), s=sec%60; return (m===0?'':(m+'min'))+s+'s';
      }

      function setTimeThrottled(t){
        const now=performance.now();
        if (now - lastScrubUpdate < (Number(settings.scrubThrottleMs)||80)) return;
        lastScrubUpdate=now;
        const tt=clamp(t,0,(videoElement.duration||1e9)-0.05);
        try{
          if (typeof videoElement.fastSeek==='function') videoElement.fastSeek(tt);
          else videoElement.currentTime=tt;
        }catch{ /* ignore */ }
      }

      function touchmoveHandler(ev){
        if (rateTimer){ clearTimeout(rateTimer); rateTimer=null; }
        if ((sampleVideo && !maybeTiktok) || !videoReady) return;

        ev.preventDefault();
        if (ev.touches.length===1){
          const temp=Math.ceil(ev.touches[0].clientX);
          if (temp===endX) return; else endX=temp;
          endY=Math.ceil(ev.touches[0].screenY);
        }

        if (endX > startX+10){
          if (!direction) direction=1;
          if (direction===1){
            timeChange = Math.round((endX-startX-10) * (videoElement.duration<=settings.threshold ? settings.sensitivity2 : settings.sensitivity1));
          } else timeChange=0;
        } else if (endX < startX-10){
          if (!direction) direction=2;
          if (direction===2){
            timeChange = Math.round((endX-startX+10) * (videoElement.duration<=settings.threshold ? settings.sensitivity2 : settings.sensitivity1));
          } else timeChange=0;
        } else if (timeChange!==0) timeChange=0; else return;

        if (notice.style.display==='none' && Math.abs(endY-startY)>Math.abs(endX-startX)){ timeChange=0; return; }

        if (direction){
          notice.style.display='flex';
          notice.innerText=(direction===1?'>>>':'<<<') + getClearTimeChange(timeChange);

          // NEW: realtime preview while swiping
          if (settings.realtimePreview){
            if (!pausedForScrub && wasPlaying){
              try{ videoElement.pause(); }catch{} pausedForScrub=true;
            }
            const targetTime = scrubStartTime + timeChange;
            setTimeThrottled(targetTime);
            didRealtimeSeek = true;
          }
        }
      }

      function touchendHandler(){
        if (notice) notice.style.display='none';

        if (settings.voiced) videoElement.muted=false;

        // Resume after scrub if it was playing
        if (pausedForScrub){
          // slight delay to let last seek settle
          setTimeout(()=>{ try{ if (wasPlaying && videoElement.paused) videoElement.play(); }catch{} }, 100);
        } else {
          setTimeout(()=>{ if (wasPlaying && videoElement.paused && !maybeTiktok) videoElement.play(); }, 500);
        }

        // show temp fullscreen hint for native-control videos
        if (!longPress && videoElement.controls && !document.fullscreenElement){
          let btn=componentContainer.getElementsByClassName('me-fullscreen-btn')[0];
          const sharedCSS="border-radius:4px;z-index:99999;opacity:0.5;background-color:black;color:white;display:flex;justify-content:center;align-items:center;text-align:center;user-select:none;";
          if (!btn){
            btn=document.createElement('div'); btn.className='me-fullscreen-btn';
            btn.style.cssText=sharedCSS+"position:absolute;width:40px;padding:2px;font-size:12px;font-weight:bold;box-sizing:border-box;border:1px solid white;white-space:normal;line-height:normal;";
            btn.innerText="Tap\nFull";
            const divH=40; btn.style.height=divH+'px';
            const screenWidth=screen.width, moveNum=Math.floor(componentContainer.offsetLeft*1.1/screenWidth);
            btn.style.top=Math.round(componentContainer.clientHeight/2 - divH/2 - 10) + 'px';
            btn.style.left=Math.round(moveNum*screenWidth + componentContainer.clientWidth*5/7) + 'px';
            componentContainer.append(btn);
            btn.addEventListener('touchstart', async function(){ btn.style.display='none'; try{ await componentContainer.requestFullscreen(); }catch{} });
            videoElement.controlsList=['nofullscreen'];
          } else btn.style.display='flex';
          setTimeout(()=>{ if(btn) btn.style.display='none'; }, 2000);
        }

        // If realtime seek already applied during move, don't add again
        if (!didRealtimeSeek && timeChange!==0){
          try{ videoElement.currentTime = clamp(videoElement.currentTime + timeChange, 0, (videoElement.duration||1e9)-0.05); }catch{}
        }

        // restore long-press artifacts
        if (rateTimer){ clearTimeout(rateTimer); }
        if (rateTimerBack){ clearTimeout(rateTimerBack); rateTimerBack=null; }
        if (longPress){ videoElement.controls=haveControls; videoElement.playbackRate=1; }

        target.removeEventListener('touchmove', touchmoveHandler);
      }
    }, {capture:true});
  }

  // --- Fullscreen & orientation lock ---
  window.tempLock=screen.orientation.lock;
  const myLock=()=>LOG('Page tried to call screen.orientation.lock()');
  screen.orientation.lock=myLock;

  if (top===window){
    window.addEventListener('message', async (e)=>{
      if (typeof e.data==='string' && e.data.includes('MeVideoJS')){
        if (document.fullscreenElement){
          screen.orientation.lock=window.tempLock;
          try{ await screen.orientation.lock('landscape'); }catch{}
          screen.orientation.lock=myLock;
        }
      }
    });
  }

  let inTimes=0;
  window.addEventListener('resize', ()=>setTimeout(fullscreenHandler,500));
  function fullscreenHandler(){
    const fe=document.fullscreenElement;
    if (fe){ if (fe.tagName==='IFRAME') return; inTimes++; }
    else if (inTimes>0) inTimes=0; else return;
    if (inTimes!==1) return;

    let v;
    if (fe.tagName!=='VIDEO'){ const arr=fe.getElementsByTagName('video'); if (arr.length>0) v=arr[0]; }
    else v=fe;
    if (!v) return;

    const fn=()=>{
      if (v.videoHeight < v.videoWidth){ top.postMessage('MeVideoJS','*'); }
      if (settings.boostEnabled){ attachBoost(v); const want=clamp(Number(settings.boostLevel)||1,1,Number(settings.maxBoost)||5); const ref=boosters.get(v); if (ref?.gain) ref.gain.gain.value=want; }
    };
    if (v.readyState<1) v.addEventListener('loadedmetadata', fn, {once:true}); else fn();
  }

})();
