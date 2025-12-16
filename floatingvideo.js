// ==UserScript==
// @name         Floating Video Player (Mobile Optimized + Touch Support)
// @namespace    http://tampermonkey.net/
// @version      3.2
// @description  Hỗ trợ cảm ứng (Touch), kéo thả mượt mà trên Mobile. Fix lỗi xung đột cử chỉ.
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CSS (Optimized for Touch Targets) ---
    const css = `
        #fvp-master-icon{position:fixed;bottom:20px;left:20px;z-index:2147483646;width:48px;height:48px;background:rgba(20,20,20,0.6);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);border-radius:50%;color:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:all .3s}
        #fvp-badge{position:absolute;top:-2px;right:-2px;background:#fff;color:#000;font-size:10px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%}
        #fvp-menu{position:fixed;bottom:80px;left:20px;z-index:2147483646;background:rgba(10,10,10,0.85);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.1);border-radius:12px;width:280px;max-height:50vh;overflow-y:auto;display:none;flex-direction:column;padding:8px 0;color:#eee}
        .fvp-menu-item{padding:12px 16px;font-size:14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:12px}.fvp-menu-item.active{background:rgba(255,255,255,0.15);font-weight:500}
        
        /* Container */
        #fvp-container{position:fixed;top:60px;right:20px;width:300px;height:180px;background:#000;box-shadow:0 10px 40px rgba(0,0,0,.8);z-index:2147483647;border-radius:12px;overflow:hidden;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.1);min-width:200px;min-height:120px; touch-action: none;} /* touch-action: none quan trọng để chặn scroll */
        #fvp-wrapper{width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
        #fvp-wrapper video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-position:center!important}
        
        /* Overlays */
        .fvp-overlay{position:absolute;left:0;width:100%;padding:10px 15px;opacity:0;transition:opacity .3s;z-index:20;display:flex;align-items:center;box-sizing:border-box;cursor:move}
        #fvp-container:hover .fvp-overlay, #fvp-container.fvp-touch-active .fvp-overlay {opacity:1} /* Hiện khi touch */
        
        #fvp-head{top:0;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,.85),transparent);padding-top:15px;height:50px}
        #fvp-ctrl{bottom:0;background:linear-gradient(to top,rgba(0,0,0,.85),transparent);padding-top:40px;gap:10px;justify-content:space-between;padding-bottom:10px}
        
        .fvp-grp{display:flex;align-items:center;gap:10px;position:relative}
        .fvp-btn{background:0 0;border:0;color:rgba(255,255,255,.9);cursor:pointer;font-size:20px;width:30px;height:30px;padding:0;display:flex;align-items:center;justify-content:center}
        
        /* Sliders */
        input[type=range]{-webkit-appearance:none;background:0 0;cursor:pointer}
        #fvp-seek{flex-grow:1;margin:0 10px;height:3px;background:rgba(255,255,255,.3);border-radius:2px}
        #fvp-seek::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.5)}
        
        .fvp-v-slider{-webkit-appearance:none;width:4px;height:100px;writing-mode:vertical-lr;direction:rtl;margin:5px 0;background:rgba(255,255,255,0.2);border-radius:2px}
        .fvp-v-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;background:#fff;border-radius:50%;cursor:pointer;margin-right:-5px}
        
        /* Popup */
        .fvp-popup{display:none;position:absolute;bottom:40px;left:50%;transform:translateX(-50%);background:rgba(15,15,15,.9);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);padding:12px 8px;border-radius:15px;flex-direction:column;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.5)}
        .fvp-grp:hover .fvp-popup, .fvp-grp.active .fvp-popup{display:flex}
        .fvp-popup::after{content:'';position:absolute;top:100%;left:0;width:100%;height:30px} /* Bridge lớn hơn cho touch */
        .fvp-val{font-size:11px;font-weight:600;color:#fff;font-family:monospace;margin-bottom:4px}
        
        #fvp-time{color:rgba(255,255,255,.7);font-size:11px;font-family:monospace;min-width:70px;text-align:center;pointer-events:none}
        .fvp-ph{background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#666;border:1px solid #333;border-radius:8px;font-size:12px;padding:10px}

        /* RESIZE HANDLES (Tăng kích thước vùng chạm cho Mobile) */
        .fvp-resize-handle{position:absolute;z-index:100;touch-action:none}
        .fvp-resize-r{top:0;right:0;bottom:0;width:25px;cursor:e-resize;background:transparent} /* Vùng chạm rộng 25px */
        .fvp-resize-t{top:0;left:0;right:0;height:25px;cursor:n-resize;background:transparent} /* Vùng chạm cao 25px */
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    // --- 2. HELPERS & VARS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => { const e = document.createElement(tag); if(c) e.className=c; if(html) e.innerHTML=html; return e; };
    // Helper sự kiện hỗ trợ cả Mouse và Touch
    const on = (el, events, fn) => events.split(' ').forEach(ev => el.addEventListener(ev, fn, {passive: false})); // passive: false để dùng preventDefault
    
    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0;
    const FIT = ['contain', 'cover', 'fill'], ICONS = ['⤢', '🔍', '↔'];
    
    // State variables
    let isDrag = false, isResizing = false;
    let startX = 0, startY = 0; // Tọa độ bắt đầu chạm/click
    let initLeft = 0, initTop = 0; // Vị trí box ban đầu
    let initW = 0, initH = 0; // Kích thước box ban đầu
    let rDir = ''; // Hướng resize

    // Lấy tọa độ X, Y từ event (Touch hoặc Mouse)
    const getXY = (e) => {
        const p = e.touches ? e.touches[0] : e;
        return { x: p.clientX, y: p.clientY };
    };

    // --- 3. UI SETUP ---
    function init() {
        // Icon & Menu
        icon = el('div', '', `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg><span id="fvp-badge">0</span>`);
        icon.id = 'fvp-master-icon'; document.body.appendChild(icon);
        menu = el('div'); menu.id = 'fvp-menu'; document.body.appendChild(menu);

        on(icon, 'click touchend', (e) => { 
            if(e.type === 'touchend') e.preventDefault(); // Tránh double click trên mobile
            e.stopPropagation(); 
            menu.style.display = menu.style.display==='flex'?'none':'flex'; 
            if(menu.style.display==='flex') renderMenu(); 
        });

        // Player Container
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <!-- Resize Handles (To hơn cho touch) -->
            <div class="fvp-resize-handle fvp-resize-t" data-dir="t"></div>
            <div class="fvp-resize-handle fvp-resize-r" data-dir="r"></div>
            
            <div id="fvp-head" class="fvp-overlay"><span>Floating Player</span><button id="fvp-close" class="fvp-btn">✕</button></div>
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
                    <!-- Tách xa Audio/Speed -->
                    <div class="fvp-grp" style="margin-left:5px"><button class="fvp-btn" id="fvp-spd-btn" style="font-size:11px;font-weight:700">1x</button>
                        <div class="fvp-popup"><span class="fvp-val" id="fvp-spd-val">1.0x</span><input type="range" class="fvp-v-slider" id="fvp-spd" min=".25" max="3" step=".25" value="1"></div></div>
                    <div class="fvp-grp" style="margin-left:15px"><button id="fvp-mute" class="fvp-btn">🔊</button>
                        <div class="fvp-popup"><span class="fvp-val" id="fvp-vol-val">100%</span><input type="range" class="fvp-v-slider" id="fvp-vol" min="0" max="1" step=".05" value="1"></div></div>
                </div>
            </div>
        `);
        box.id = 'fvp-container'; box.style.display='none'; document.body.appendChild(box);

        // --- XỬ LÝ SỰ KIỆN KÉO THẢ & RESIZE (TOUCH & MOUSE) ---
        
        // 1. DRAG START
        const startDrag = (e) => {
            // Chỉ drag khi chạm vào Head hoặc Ctrl, không chạm vào nút bấm/slider
            if(e.target.closest('.fvp-popup') || ['BUTTON','INPUT'].includes(e.target.tagName)) return;
            
            isDrag = true;
            const xy = getXY(e);
            startX = xy.x; startY = xy.y;
            initLeft = box.offsetLeft; initTop = box.offsetTop;
            
            box.classList.add('fvp-touch-active'); // Giữ overlay hiện khi đang kéo
            e.stopPropagation(); // Ngăn sự kiện lan xuống dưới (scroll trang)
        };
        
        on($('fvp-head'), 'mousedown touchstart', startDrag); 
        on($('fvp-ctrl'), 'mousedown touchstart', startDrag);

        // 2. RESIZE START
        const startResize = (e) => {
            isResizing = true;
            rDir = e.target.getAttribute('data-dir');
            
            const xy = getXY(e);
            startX = xy.x; startY = xy.y;
            initW = box.offsetWidth; initH = box.offsetHeight; initTop = box.offsetTop;
            
            box.classList.add('fvp-touch-active');
            e.stopPropagation(); e.preventDefault(); // Ngăn scroll tuyệt đối khi resize
        };
        box.querySelectorAll('.fvp-resize-handle').forEach(h => on(h, 'mousedown touchstart', startResize));

        // 3. GLOBAL MOVE (DRAG & RESIZE)
        on(document, 'mousemove touchmove', (e) => {
            if(!isDrag && !isResizing) return;
            
            const xy = getXY(e);
            const deltaX = xy.x - startX;
            const deltaY = xy.y - startY;

            if (isDrag) {
                e.preventDefault(); // Chặn scroll trang khi đang kéo video
                box.style.left = (initLeft + deltaX) + 'px';
                box.style.top = (initTop + deltaY) + 'px';
                box.style.right = 'auto'; box.style.bottom = 'auto';
            }
            
            if (isResizing) {
                e.preventDefault(); // Chặn scroll trang khi resize
                if(rDir === 'r') {
                    box.style.width = Math.max(200, initW + deltaX) + 'px';
                } else if(rDir === 't') {
                    const newH = Math.max(120, initH - deltaY);
                    box.style.height = newH + 'px';
                    box.style.top = (initTop + (initH - newH)) + 'px';
                }
            }
        });
        
        // 4. GLOBAL END
        on(document, 'mouseup touchend', () => { 
            isDrag = false; isResizing = false;
            box.classList.remove('fvp-touch-active');
        });

        // --- CONTROLS EVENTS ---
        
        // Mobile Tap to toggle controls (để overlay không tự tắt quá nhanh)
        on(box, 'touchstart', () => {
             box.classList.toggle('fvp-touch-active');
        });

        const btnClick = (id, fn) => on($(id), 'click touchend', (e) => { 
            //e.preventDefault(); // Fix double fire
            e.stopPropagation(); 
            fn(e); 
        });

        btnClick('fvp-close', restore);
        btnClick('fvp-play', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        
        on($('fvp-seek'), 'input', (e) => curVid && (curVid.currentTime = (e.target.value/100) * curVid.duration));
        
        // Navigation Logic
        const switchVid = (dir) => {
            if(!curVid || videos.length <= 1) return;
            let idx = videos.indexOf(curVid);
            if(idx === -1) return;
            let nextIdx = (idx + dir + videos.length) % videos.length;
            float(videos[nextIdx]);
        };
        btnClick('fvp-prev', () => switchVid(-1));
        btnClick('fvp-next', () => switchVid(1));

        // Volume & Speed & Fit
        const updVol = (v) => { $('fvp-mute').textContent = v==0?'🔇':(v<.5?'🔉':'🔊'); $('fvp-vol-val').textContent = Math.round(v*100)+'%'; };
        on($('fvp-vol'), 'input', (e) => { if(curVid) { curVid.volume = e.target.value; curVid.muted=false; updVol(curVid.volume); } });
        btnClick('fvp-mute', () => { if(curVid) { curVid.muted = !curVid.muted; $('fvp-vol').value = curVid.muted ? 0 : curVid.volume; updVol(curVid.muted ? 0 : curVid.volume); }});
        
        on($('fvp-spd'), 'input', (e) => { if(curVid) { const r = parseFloat(e.target.value); curVid.playbackRate=r; $('fvp-spd-btn').textContent = r+'x'; $('fvp-spd-val').textContent = r.toFixed(2)+'x'; }});
        
        btnClick('fvp-fit', () => {
            fitIdx = (fitIdx+1)%3; if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = ICONS[fitIdx];
        });

        // Handle Popup toggle on Mobile (Touch vào icon thì hiện slider)
        const togglePopup = (btnId) => {
             const grp = $(btnId).parentNode.parentNode; // Lấy thẻ div.fvp-grp
             if(grp.classList.contains('active')) grp.classList.remove('active');
             else grp.classList.add('active');
        };
        // Cần xử lý riêng cho touch để mở popup
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
        
        $('fvp-vol').value = v.volume; $('fvp-spd').value = v.playbackRate || 1;
        $('fvp-spd-btn').textContent = (v.playbackRate||1)+'x'; $('fvp-spd-val').textContent = (v.playbackRate||1).toFixed(2)+'x';
        
        box.style.display='flex'; v.play(); menu.style.display='none';
        
        v.ontimeupdate = () => {
            $('fvp-play').textContent = v.paused ? '▶' : '⏸';
            if(!isNaN(v.duration)) {
                if(document.activeElement !== $('fvp-seek')) $('fvp-seek').value = (v.currentTime/v.duration)*100;
                let s=v.currentTime, m=Math.floor(s/60), ss=Math.floor(s%60);
                $('fvp-time').textContent = `${m}:${ss<10?'0'+ss:ss}`;
            }
        };
    }

    function renderMenu() {
        menu.innerHTML = `<div style="padding:10px;font-size:12px;color:#aaa">FOUND ${videos.length} VIDEOS</div>`;
        videos.forEach((v, i) => {
            const item = el('div', `fvp-menu-item ${v===curVid?'active':''}`, `<span>${v===curVid?'▶':'🎬'}</span><span>Video ${i+1}</span>`);
            on(item, 'click touchend', (e) => { 
                e.preventDefault(); e.stopPropagation(); 
                float(v); 
            }); 
            menu.appendChild(item);
        });
    }

    setInterval(() => {
        videos = Array.from(document.querySelectorAll('video')).filter(v => (v.getBoundingClientRect().width>50 || v===curVid));
        if(icon) { $('fvp-badge').textContent = videos.length; $('fvp-badge').style.display = videos.length?'flex':'none'; }
    }, 2000);
    
    init();

})();
