// ==UserScript==
// @name         Floating Video
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Bản rút gọn. 
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. COMPACT CSS ---
    const css = `
        #fvp-master-icon{position:fixed;bottom:30px;left:30px;z-index:2147483646;width:48px;height:48px;background:rgba(20,20,20,0.6);backdrop-filter:blur(5px);border:1px solid rgba(255,255,255,0.1);border-radius:50%;color:rgba(255,255,255,0.9);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:all .3s}#fvp-master-icon:hover{transform:scale(1.1);background:rgba(40,40,40,0.8)}#fvp-master-icon svg{width:20px;height:20px;fill:currentColor}
        #fvp-badge{position:absolute;top:-2px;right:-2px;background:#fff;color:#000;font-size:10px;font-weight:700;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:50%}
        #fvp-menu{position:fixed;bottom:90px;left:30px;z-index:2147483646;background:rgba(10,10,10,0.7);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,0.08);border-radius:12px;width:300px;max-height:400px;overflow-y:auto;display:none;flex-direction:column;padding:8px 0;color:#eee}
        .fvp-menu-header{padding:10px 16px;font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;border-bottom:1px solid rgba(255,255,255,0.05)}
        .fvp-menu-item{padding:10px 16px;font-size:13px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.02);display:flex;gap:12px;transition:background .2s}.fvp-menu-item:hover{background:rgba(255,255,255,0.08)}.fvp-menu-item.active{background:rgba(255,255,255,0.15);font-weight:500}
        
        #fvp-container{position:fixed;top:50px;right:50px;width:550px;height:310px;background:#000;box-shadow:0 30px 60px rgba(0,0,0,.6);z-index:2147483647;border-radius:12px;overflow:hidden;resize:both;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.1);min-width:300px;min-height:200px}
        #fvp-wrapper{width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden}
        #fvp-wrapper video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-position:center!important}
        
        .fvp-overlay{position:absolute;left:0;width:100%;padding:10px 15px;opacity:0;transition:opacity .3s;z-index:20;display:flex;align-items:center;box-sizing:border-box;cursor:move}
        #fvp-container:hover .fvp-overlay{opacity:1}
        #fvp-head{top:0;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,.8),transparent);padding-top:15px;pointer-events:none}
        #fvp-head * {pointer-events:auto}
        
        #fvp-ctrl{bottom:0;background:linear-gradient(to top,rgba(0,0,0,.8),transparent);padding-top:40px;gap:15px;justify-content:space-between}
        .fvp-grp{display:flex;align-items:center;gap:8px;position:relative}
        .fvp-btn{background:0 0;border:0;color:rgba(255,255,255,.8);cursor:pointer;font-size:18px;width:24px;height:24px;padding:0;display:flex;align-items:center;justify-content:center;transition:.2s}
        .fvp-btn:hover{color:#fff;transform:scale(1.1)}
        
        /* Nav Buttons */
        #fvp-prev, #fvp-next {font-size:20px} /* Icon to hơn chút */

        /* STYLE THANH TRƯỢT */
        input[type=range]{-webkit-appearance:none;background:0 0;cursor:pointer}
        input[type=range]:focus{outline:none}
        
        /* Horizontal (Seek) */
        #fvp-seek{flex-grow:1;margin:0 15px;height:2px;background:rgba(255,255,255,.2);border-radius:1px;transition:height .2s}
        #fvp-seek:hover{height:4px}
        #fvp-seek::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;background:#fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,.5)}
        
        /* Vertical (Speed/Vol) */
        .fvp-v-slider{-webkit-appearance:none;width:4px;height:90px;writing-mode:vertical-lr;direction:rtl;margin:5px 0;background:rgba(255,255,255,0.2);border-radius:2px}
        .fvp-v-slider::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;background:#fff;border-radius:50%;cursor:pointer;margin-right:-3px}
        .fvp-v-slider:hover::-webkit-slider-thumb{transform:scale(1.2)}
        
        /* Popup */
        .fvp-popup{display:none;position:absolute;bottom:30px;left:50%;transform:translateX(-50%);background:rgba(10,10,10,.85);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.1);padding:10px 6px;border-radius:15px;flex-direction:column;align-items:center;box-shadow:0 10px 30px rgba(0,0,0,.5)}
        .fvp-grp:hover .fvp-popup{display:flex}.fvp-popup::after{content:'';position:absolute;top:100%;left:0;width:100%;height:20px}
        .fvp-val{font-size:10px;font-weight:600;color:#fff;font-family:monospace;margin-bottom:2px}
        
        #fvp-time{color:rgba(255,255,255,.7);font-size:11px;font-family:monospace;min-width:80px;text-align:center;pointer-events:none}
        .fvp-ph{background:#000;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#555;border:1px solid #222;border-radius:8px;font-size:13px;padding:20px}

        /* RESIZE HANDLES */
        .fvp-resize-handle{position:absolute;z-index:100}
        .fvp-resize-r{top:0;right:0;bottom:15px;width:6px;cursor:e-resize;background:transparent}
        .fvp-resize-t{top:0;left:0;right:0;height:6px;cursor:n-resize;background:transparent}
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    // --- 2. HELPERS & VARS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => { const e = document.createElement(tag); if(c) e.className=c; if(html) e.innerHTML=html; return e; };
    const on = (el, ev, fn) => el.addEventListener(ev, fn);
    
    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0;
    const FIT = ['contain', 'cover', 'fill'], ICONS = ['⤢', '🔍', '↔'], NAMES = ['Vừa', 'Zoom', 'Dãn'];
    let isDrag = false, dx = 0, dy = 0;
    let isResizing = false, rDir = '', rStart = {}, rDim = {};

    // --- 3. UI SETUP ---
    function init() {
        // Icon & Menu
        icon = el('div', '', `<svg viewBox="0 0 24 24" style="width:20px;fill:#fff"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg><span id="fvp-badge">0</span>`);
        icon.id = 'fvp-master-icon'; document.body.appendChild(icon);
        menu = el('div'); menu.id = 'fvp-menu'; document.body.appendChild(menu);

        on(icon, 'click', (e) => { e.stopPropagation(); menu.style.display = menu.style.display==='flex'?'none':'flex'; if(menu.style.display==='flex') renderMenu(); });
        on(document, 'click', (e) => { if(!icon.contains(e.target) && !menu.contains(e.target)) menu.style.display='none'; });

        // Player Container
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <div class="fvp-resize-handle fvp-resize-t" data-dir="t" title="Resize Height"></div>
            <div class="fvp-resize-handle fvp-resize-r" data-dir="r" title="Resize Width"></div>
            
            <div id="fvp-head" class="fvp-overlay"><span>Floating Player</span><button id="fvp-close" class="fvp-btn">✕</button></div>
            <div id="fvp-ctrl" class="fvp-overlay">
                <div class="fvp-grp">
                    <button id="fvp-prev" class="fvp-btn" title="Video trước">⏮</button>
                    <button id="fvp-play" class="fvp-btn">⏯</button>
                    <button id="fvp-next" class="fvp-btn" title="Video tiếp">⏭</button>
                    <span id="fvp-time">00:00</span>
                </div>
                <input type="range" id="fvp-seek">
                <div class="fvp-grp">
                    <button id="fvp-fit" class="fvp-btn" title="Chế độ">⤢</button>
                    <div class="fvp-grp"><button class="fvp-btn" id="fvp-spd-btn" style="font-size:12px;font-weight:700">1x</button>
                        <div class="fvp-popup"><span class="fvp-val" id="fvp-spd-val">1.0x</span><input type="range" class="fvp-v-slider" id="fvp-spd" min=".25" max="3" step=".25" value="1"></div></div>
                    <div class="fvp-grp" style="margin-left:15px"><button id="fvp-mute" class="fvp-btn">🔊</button>
                        <div class="fvp-popup"><span class="fvp-val" id="fvp-vol-val">100%</span><input type="range" class="fvp-v-slider" id="fvp-vol" min="0" max="1" step=".05" value="1"></div></div>
                </div>
            </div>
        `);
        box.id = 'fvp-container'; box.style.display='none'; document.body.appendChild(box);

        // --- EVENTS ---
        
        // Drag
        const startDrag = (e) => {
            if(e.target.closest('.fvp-popup') || ['BUTTON','INPUT'].includes(e.target.tagName)) return;
            isDrag = true; dx = e.clientX - box.offsetLeft; dy = e.clientY - box.offsetTop;
            $('fvp-head').style.cursor = $('fvp-ctrl').style.cursor = 'grabbing';
        };
        on($('fvp-head'), 'mousedown', startDrag); on($('fvp-ctrl'), 'mousedown', startDrag);

        // Resize
        const startResize = (e) => {
            e.stopPropagation(); e.preventDefault();
            isResizing = true; rDir = e.target.getAttribute('data-dir');
            rStart = {x: e.clientX, y: e.clientY}; rDim = {w: box.offsetWidth, h: box.offsetHeight, t: box.offsetTop};
        };
        box.querySelectorAll('.fvp-resize-handle').forEach(h => on(h, 'mousedown', startResize));

        on(document, 'mousemove', (e) => {
            if(isDrag) {
                e.preventDefault(); 
                box.style.left = (e.clientX - dx) + 'px'; box.style.top = (e.clientY - dy) + 'px';
                box.style.right = 'auto'; box.style.bottom = 'auto';
            }
            if(isResizing) {
                e.preventDefault();
                if(rDir === 'r') box.style.width = Math.max(200, rDim.w + (e.clientX - rStart.x)) + 'px';
                else if(rDir === 't') {
                    const diff = e.clientY - rStart.y; const newH = Math.max(150, rDim.h - diff);
                    box.style.height = newH + 'px'; box.style.top = (rDim.t + (rDim.h - newH)) + 'px'; 
                }
            }
        });
        
        on(document, 'mouseup', () => { isDrag = false; isResizing = false; $('fvp-head').style.cursor = $('fvp-ctrl').style.cursor = 'move'; });

        // Controls
        on($('fvp-close'), 'click', restore);
        on($('fvp-play'), 'click', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        on($('fvp-seek'), 'input', (e) => curVid && (curVid.currentTime = (e.target.value/100) * curVid.duration));
        
        // Navigation Logic
        const switchVid = (dir) => {
            if(!curVid || videos.length <= 1) return;
            let idx = videos.indexOf(curVid);
            if(idx === -1) return;
            let nextIdx = (idx + dir + videos.length) % videos.length;
            float(videos[nextIdx]);
        };
        on($('fvp-prev'), 'click', () => switchVid(-1));
        on($('fvp-next'), 'click', () => switchVid(1));

        // Volume & Speed
        const updVol = (v) => { $('fvp-mute').textContent = v==0?'🔇':(v<.5?'🔉':'🔊'); $('fvp-vol-val').textContent = Math.round(v*100)+'%'; };
        on($('fvp-vol'), 'input', (e) => { if(curVid) { curVid.volume = e.target.value; curVid.muted=false; updVol(curVid.volume); } });
        on($('fvp-mute'), 'click', () => { if(curVid) { curVid.muted = !curVid.muted; $('fvp-vol').value = curVid.muted ? 0 : curVid.volume; updVol(curVid.muted ? 0 : curVid.volume); }});
        on($('fvp-spd'), 'input', (e) => { if(curVid) { const r = parseFloat(e.target.value); curVid.playbackRate=r; $('fvp-spd-btn').textContent = r+'x'; $('fvp-spd-val').textContent = r.toFixed(2)+'x'; }});

        on($('fvp-fit'), 'click', () => {
            fitIdx = (fitIdx+1)%3; if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = ICONS[fitIdx]; $('fvp-fit').title = NAMES[fitIdx];
        });
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
        
        ph = el('div', 'fvp-ph', `<div style="font-size:24px;opacity:.5">📺</div><div style="opacity:.5">Floating</div>`);
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
        menu.innerHTML = `<div class="fvp-menu-header">Found ${videos.length} Videos</div>`;
        if(!videos.length) return menu.innerHTML += `<div class="fvp-menu-item" style="justify-content:center;color:#777">None</div>`;
        videos.forEach((v, i) => {
            const item = el('div', `fvp-menu-item ${v===curVid?'active':''}`, `<span>${v===curVid?'▶':'🎬'}</span><span>${(v.title||v.getAttribute('aria-label')||`Video #${i+1}`).substring(0,50)}</span>`);
            on(item, 'click', () => float(v)); menu.appendChild(item);
        });
    }

    // Scan
    setInterval(() => {
        videos = Array.from(document.querySelectorAll('video')).filter(v => (v.getBoundingClientRect().width>60 || v===curVid));
        if(icon) { 
            $('fvp-badge').textContent = videos.length; 
            $('fvp-badge').style.display = videos.length?'flex':'none'; 
        }
        // Auto hide nav buttons if only 1 video
        if(box && box.style.display !== 'none') {
            const d = videos.length > 1 ? 'flex' : 'none';
            if($('fvp-next').style.display !== d) $('fvp-next').style.display = $('fvp-prev').style.display = d;
        }
    }, 2000);
    
    init();

})();
