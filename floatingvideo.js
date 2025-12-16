// ==UserScript==
// @name         Floating Video Player (Hybrid: Custom UI + Playlist + PiP)
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Kết hợp Khung nổi tùy chỉnh (để full chức năng) và nút chuyển PiP gốc (để ra màn hình chính). Hỗ trợ Touch, Resize, Playlist.
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CSS (Custom UI + Touch Support) ---
    const css = `
        /* Master Icon */
        #fvp-master-icon{position:fixed;bottom:20px;left:20px;z-index:2147483646;width:48px;height:48px;background:rgba(20,20,20,0.6);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);border-radius:50%;color:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:all .3s}
        #fvp-badge{position:absolute;top:-2px;right:-2px;background:#ff4757;color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%}
        
        /* Menu */
        #fvp-menu{position:fixed;bottom:80px;left:20px;z-index:2147483646;background:rgba(10,10,10,0.95);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;width:280px;max-height:50vh;overflow-y:auto;display:none;flex-direction:column;padding:8px 0;color:#eee}
        .fvp-menu-item{padding:12px 16px;font-size:14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .fvp-menu-item.active{background:rgba(255,255,255,0.15);font-weight:bold;color:#4caf50}

        /* CONTAINER (Custom Floating Window) */
        #fvp-container{
            position:fixed;top:60px;right:20px;width:320px;height:190px;
            background:#000;
            box-shadow:0 15px 50px rgba(0,0,0,0.9);
            z-index:2147483647;
            border-radius:12px;
            display:flex;align-items:center;justify-content:center;
            border:1px solid rgba(255,255,255,.15);
            min-width:220px;min-height:140px; 
            touch-action: none; user-select: none; -webkit-user-select: none;
        }
        #fvp-wrapper{width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:12px}
        #fvp-wrapper video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-position:center!important}
        
        /* Overlays (Controls) */
        .fvp-overlay{position:absolute;left:0;width:100%;padding:8px 12px;opacity:0;transition:opacity .3s;z-index:20;display:flex;align-items:center;box-sizing:border-box}
        #fvp-container:hover .fvp-overlay, #fvp-container.fvp-touch-active .fvp-overlay {opacity:1}
        
        #fvp-head{top:0;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,.9),transparent);padding-top:12px;height:45px;cursor:move;border-radius:12px 12px 0 0}
        #fvp-ctrl{bottom:0;background:linear-gradient(to top,rgba(0,0,0,.95),transparent);padding-top:35px;gap:8px;justify-content:space-between;padding-bottom:12px;cursor:default;border-radius:0 0 12px 12px}
        
        .fvp-grp{display:flex;align-items:center;gap:8px;position:relative}
        .fvp-btn{background:0 0;border:0;color:rgba(255,255,255,.9);cursor:pointer;font-size:18px;width:28px;height:28px;padding:0;display:flex;align-items:center;justify-content:center}
        .fvp-btn:active{transform:scale(0.9);color:#4caf50}

        /* Sliders */
        input[type=range]{-webkit-appearance:none;background:0 0;cursor:pointer}
        #fvp-seek{flex-grow:1;margin:0 10px;height:3px;background:rgba(255,255,255,.3);border-radius:2px}
        #fvp-seek::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.5)}
        
        /* Vertical Sliders (Popup style) */
        .fvp-v-slider{-webkit-appearance:none;width:4px;height:90px;writing-mode:vertical-lr;direction:rtl;margin:5px 0;background:rgba(255,255,255,0.2);border-radius:2px}
        .fvp-v-slider::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:#fff;border-radius:50%;cursor:pointer;margin-right:-4px}

        /* Popups */
        .fvp-popup{display:none;position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(15,15,15,.95);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);padding:10px 6px;border-radius:15px;flex-direction:column;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.6)}
        .fvp-grp.active .fvp-popup{display:flex}
        .fvp-val{font-size:10px;font-weight:600;color:#fff;font-family:monospace;margin-bottom:4px}
        
        #fvp-time{color:rgba(255,255,255,.7);font-size:10px;font-family:monospace;min-width:65px;text-align:center;pointer-events:none}
        .fvp-ph{background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#666;border:1px solid #333;border-radius:8px;font-size:12px;padding:10px}

        /* Resize Handles */
        .fvp-resize-handle{position:absolute;z-index:100;touch-action:none;background:transparent}
        .fvp-resize-r{top:20px;right:-10px;bottom:20px;width:30px;cursor:e-resize}
        .fvp-resize-t{top:-10px;left:20px;right:20px;height:30px;cursor:n-resize}
        .fvp-resize-br{bottom:-10px;right:-10px;width:40px;height:40px;cursor:se-resize;z-index:101}
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    // --- 2. HELPERS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => { const e = document.createElement(tag); if(c) e.className=c; if(html) e.innerHTML=html; return e; };
    const on = (el, events, fn) => events.split(' ').forEach(ev => el.addEventListener(ev, fn, {passive: false})); 
    
    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0;
    const FIT = ['contain', 'cover', 'fill'], ICONS = ['⤢', '🔍', '↔'];
    
    let isDrag = false, isResizing = false;
    let startX = 0, startY = 0, initLeft = 0, initTop = 0, initW = 0, initH = 0, rDir = ''; 

    const getXY = (e) => { const p = e.touches ? e.touches[0] : e; return { x: p.clientX, y: p.clientY }; };

    // --- 3. UI SETUP ---
    function init() {
        // Icon
        icon = el('div', '', `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg><span id="fvp-badge">0</span>`);
        icon.id = 'fvp-master-icon'; document.body.appendChild(icon);

        // Menu
        menu = el('div'); menu.id = 'fvp-menu'; document.body.appendChild(menu);

        on(icon, 'click touchend', (e) => { 
            if(e.type === 'touchend') e.preventDefault(); e.stopPropagation(); 
            menu.style.display = menu.style.display==='flex'?'none':'flex'; 
            if(menu.style.display==='flex') renderMenu(); 
        });

        // CONTAINER HTML
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <!-- Resize Handles -->
            <div class="fvp-resize-handle fvp-resize-t" data-dir="t"></div>
            <div class="fvp-resize-handle fvp-resize-r" data-dir="r"></div>
            <div class="fvp-resize-handle fvp-resize-br" data-dir="br"></div>
            
            <!-- Header -->
            <div id="fvp-head" class="fvp-overlay">
                <span>Floating Player</span>
                <div class="fvp-grp">
                    <button id="fvp-pip-native" class="fvp-btn" title="Chuyển sang PiP Gốc (Android)" style="font-size:16px">↗</button>
                    <button id="fvp-close" class="fvp-btn">✕</button>
                </div>
            </div>
            
            <!-- Controls -->
            <div id="fvp-ctrl" class="fvp-overlay">
                <div class="fvp-grp">
                    <button id="fvp-prev" class="fvp-btn">⏮</button>
                    <button id="fvp-play" class="fvp-btn">⏯</button>
                    <button id="fvp-next" class="fvp-btn">⏭</button>
                </div>
                <input type="range" id="fvp-seek">
                <div class="fvp-grp">
                    <span id="fvp-time">00:00</span>
                    <button id="fvp-fit" class="fvp-btn">⤢</button>
                    
                    <div class="fvp-grp" style="margin-left:5px">
                        <button class="fvp-btn" id="fvp-spd-btn" style="font-size:11px;font-weight:700">1x</button>
                        <div class="fvp-popup"><span class="fvp-val" id="fvp-spd-val">1.0x</span><input type="range" class="fvp-v-slider" id="fvp-spd" min=".25" max="3" step=".25" value="1"></div>
                    </div>
                    
                    <div class="fvp-grp" style="margin-left:15px">
                        <button id="fvp-mute" class="fvp-btn">🔊</button>
                        <div class="fvp-popup"><span class="fvp-val" id="fvp-vol-val">100%</span><input type="range" class="fvp-v-slider" id="fvp-vol" min="0" max="1" step=".05" value="1"></div>
                    </div>
                </div>
            </div>
        `);
        box.id = 'fvp-container'; box.style.display='none'; document.body.appendChild(box);

        // --- EVENTS ---
        
        // 1. Chặn Touch xuyên thấu
        on(box, 'touchstart touchmove touchend', (e) => e.stopPropagation());

        // 2. Drag Logic
        const startDrag = (e) => {
            if(e.target.closest('.fvp-popup') || ['BUTTON','INPUT'].includes(e.target.tagName)) return;
            isDrag = true;
            const xy = getXY(e); startX = xy.x; startY = xy.y;
            initLeft = box.offsetLeft; initTop = box.offsetTop;
            box.classList.add('fvp-touch-active');
            e.stopPropagation(); e.preventDefault();
        };
        on($('fvp-head'), 'mousedown touchstart', startDrag); 
        
        // 3. Resize Logic
        const startResize = (e) => {
            isResizing = true; rDir = e.target.getAttribute('data-dir');
            const xy = getXY(e); startX = xy.x; startY = xy.y;
            initW = box.offsetWidth; initH = box.offsetHeight; initTop = box.offsetTop;
            box.classList.add('fvp-touch-active');
            e.stopPropagation(); e.preventDefault();
        };
        box.querySelectorAll('.fvp-resize-handle').forEach(h => on(h, 'mousedown touchstart', startResize));

        // 4. Global Move
        on(document, 'mousemove touchmove', (e) => {
            if(!isDrag && !isResizing) return;
            const xy = getXY(e); const dX = xy.x - startX; const dY = xy.y - startY;

            if (isDrag) {
                e.preventDefault();
                box.style.left = (initLeft + dX) + 'px'; box.style.top = (initTop + dY) + 'px';
                box.style.right = 'auto'; box.style.bottom = 'auto';
            }
            if (isResizing) {
                e.preventDefault();
                if(rDir.includes('r')) box.style.width = Math.max(220, initW + dX) + 'px';
                if(rDir.includes('t')) { const nH = Math.max(140, initH - dY); box.style.height = nH + 'px'; box.style.top = (initTop + (initH - nH)) + 'px'; }
                if(rDir === 'br') box.style.height = Math.max(140, initH + dY) + 'px';
            }
        });
        
        on(document, 'mouseup touchend', () => { isDrag = false; isResizing = false; box.classList.remove('fvp-touch-active'); });

        // 5. Click Interactions
        on(box, 'click touchstart', (e) => { if(e.target === box || e.target.id === 'fvp-wrapper') box.classList.toggle('fvp-touch-active'); });

        const btnClick = (id, fn) => on($(id), 'click touchend', (e) => { e.stopPropagation(); if(e.type==='touchend') e.preventDefault(); fn(e); });

        btnClick('fvp-close', restore);
        btnClick('fvp-play', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        on($('fvp-seek'), 'input', (e) => curVid && (curVid.currentTime = (e.target.value/100) * curVid.duration));
        
        btnClick('fvp-prev', () => switchVid(-1));
        btnClick('fvp-next', () => switchVid(1));

        // Native PiP Button
        btnClick('fvp-pip-native', async () => {
             if(curVid) {
                 try { 
                     await curVid.requestPictureInPicture();
                     // Lưu ý: Khi vào Native PiP, Custom UI sẽ trống rỗng video (vì video bị move sang PiP window)
                     // Ta có thể ẩn Custom UI đi hoặc giữ lại làm Remote.
                     // Ở đây ta ẩn Custom UI để tránh rối
                     box.style.display = 'none';
                     
                     // Khi thoát PiP thì hiện lại Custom UI
                     curVid.addEventListener('leavepictureinpicture', () => {
                         box.style.display = 'flex';
                     }, {once: true});
                 } catch(e) { alert("Thiết bị không hỗ trợ PiP"); }
             }
        });

        // Sliders & Popup Toggle
        const togglePopup = (btn) => { const g = btn.closest('.fvp-grp'); g.classList.toggle('active'); };
        on($('fvp-spd-btn'), 'touchstart', (e) => { e.preventDefault(); togglePopup(e.target); });
        
        on($('fvp-spd'), 'input', (e) => { if(curVid) { const r = parseFloat(e.target.value); curVid.playbackRate=r; $('fvp-spd-btn').textContent = r+'x'; $('fvp-spd-val').textContent = r.toFixed(2)+'x'; }});
        on($('fvp-vol'), 'input', (e) => { if(curVid) { curVid.volume = e.target.value; curVid.muted=false; $('fvp-vol-val').textContent = Math.round(curVid.volume*100)+'%'; }});
        
        btnClick('fvp-fit', () => { fitIdx = (fitIdx+1)%3; if(curVid) curVid.style.objectFit = FIT[fitIdx]; $('fvp-fit').textContent = ICONS[fitIdx]; });
    }

    // --- 4. LOGIC ---
    function restore() {
        if(!curVid) return;
        origPar.replaceChild(curVid, ph);
        Object.assign(curVid.style, {width:'', height:'', objectFit:'', objectPosition:''});
        box.style.display='none'; curVid.ontimeupdate=null; curVid=null;
    }

    function float(v) {
        if(curVid && curVid !== v) restore(); if(curVid === v) return;
        if(!box) init(); 
        origPar = v.parentNode; curVid = v;
        
        ph = el('div', 'fvp-ph', `<div style="font-size:24px;opacity:.5">📺</div>`);
        ph.style.width = (v.offsetWidth||300)+'px'; ph.style.height = (v.offsetHeight||200)+'px';
        origPar.replaceChild(ph, v);
        
        $('fvp-wrapper').innerHTML=''; $('fvp-wrapper').appendChild(v);
        v.style.objectFit = FIT[fitIdx]; v.style.objectPosition = 'center';
        
        // Sync State
        $('fvp-vol').value = v.volume; $('fvp-spd').value = v.playbackRate || 1;
        $('fvp-spd-btn').textContent = (v.playbackRate||1)+'x'; $('fvp-spd-val').textContent = (v.playbackRate||1).toFixed(2)+'x';
        
        box.style.display='flex'; v.play(); menu.style.display='none';
        
        setupMediaSession(); // Kích hoạt điều khiển màn hình khóa
        
        v.ontimeupdate = () => {
            $('fvp-play').textContent = v.paused ? '▶' : '⏸';
            if(!isNaN(v.duration)) {
                if(document.activeElement !== $('fvp-seek')) $('fvp-seek').value = (v.currentTime/v.duration)*100;
                let s=v.currentTime, m=Math.floor(s/60), ss=Math.floor(s%60);
                $('fvp-time').textContent = `${m}:${ss<10?'0'+ss:ss}`;
            }
        };
    }

    function switchVid(dir) {
        if(!curVid || videos.length <= 1) return;
        let idx = videos.indexOf(curVid); if(idx === -1) return;
        let nextIdx = (idx + dir + videos.length) % videos.length;
        float(videos[nextIdx]);
    }

    function setupMediaSession() {
        if ('mediaSession' in navigator && curVid) {
            navigator.mediaSession.metadata = new MediaMetadata({ title: document.title, artist: 'Floating Player' });
            const cmds = [['play', ()=>curVid.play()], ['pause', ()=>curVid.pause()], ['previoustrack', ()=>switchVid(-1)], ['nexttrack', ()=>switchVid(1)]];
            cmds.forEach(([a, h]) => navigator.mediaSession.setActionHandler(a, h));
        }
    }

    function renderMenu() {
        menu.innerHTML = `<div style="padding:10px;font-size:12px;color:#aaa;border-bottom:1px solid #333">DANH SÁCH (${videos.length})</div>`;
        videos.forEach((v, i) => {
            const item = el('div', `fvp-menu-item ${v===curVid?'active':''}`, `<span>${v===curVid?'▶':'🎬'}</span><span>Video ${i+1}</span>`);
            on(item, 'click touchend', (e) => { e.preventDefault(); e.stopPropagation(); float(v); }); 
            menu.appendChild(item);
        });
    }

    setInterval(() => {
        videos = Array.from(document.querySelectorAll('video')).filter(v => (v.getBoundingClientRect().width>50 || v===curVid) && v.style.display!=='none');
        if(icon) { $('fvp-badge').textContent = videos.length; $('fvp-badge').style.display = videos.length?'flex':'none'; }
    }, 2000);
    
    init();

})();
