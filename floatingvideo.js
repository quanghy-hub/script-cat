// ==UserScript==
// @name         Floating Video
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Giao diện tinh gọn, trong suốt. Hỗ trợ tốt cho cả Touch (Mobile) và Mouse (Laptop).
// @author       Claude
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- CSS Tinh chỉnh ---
    const css = `
        /* Master Icon */
        #fvp-master-icon {
            position: fixed; bottom: 20px; left: 20px; z-index: 2147483646;
            width: 48px; height: 48px;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 50%; color: #fff;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: transform .2s, background .2s; touch-action: manipulation;
        }
        #fvp-master-icon:active { transform: scale(0.9); background: rgba(0,0,0,0.8); }
        #fvp-badge {
            position: absolute; top: -2px; right: -2px;
            background: #ff3b30; color: #fff; font-size: 10px; font-weight: 700;
            min-width: 18px; height: 18px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%; border: 2px solid #000;
        }

        /* Menu */
        #fvp-menu {
            position: fixed; bottom: 80px; left: 20px; z-index: 2147483646;
            background: rgba(20,20,20,0.95); backdrop-filter: blur(20px);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px; width: min(280px, calc(100vw - 40px));
            max-height: 50vh; overflow-y: auto; display: none;
            flex-direction: column; padding: 4px 0; color: #eee;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .fvp-menu-item {
            padding: 12px 16px; font-size: 14px; cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex; gap: 10px; align-items: center;
            transition: background .2s;
        }
        .fvp-menu-item:active, .fvp-menu-item:hover { background: rgba(255,255,255,0.1); }
        .fvp-menu-item.active { background: rgba(255,255,255,0.08); color: #4CAF50; font-weight: 600; }

        /* Player Container */
        #fvp-container {
            position: fixed; top: 60px; right: 20px;
            width: min(320px, calc(100vw - 40px)); height: 180px;
            background: #000; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            z-index: 2147483647; border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.1);
            min-width: 200px; min-height: 120px;
            max-width: calc(100vw - 10px); max-height: calc(100vh - 60px);
            touch-action: none; user-select: none; -webkit-user-select: none;
            overflow: hidden;
        }
        #fvp-wrapper { width: 100%; height: 100%; background: #000; display: flex; align-items: center; justify-content: center; }
        #fvp-wrapper video { width: 100%!important; height: 100%!important; max-width: none!important; max-height: none!important; object-position: center!important; }

        /* Overlays */
        .fvp-overlay {
            position: absolute; left: 0; width: 100%; padding: 0 12px;
            opacity: 0; transition: opacity .25s ease; z-index: 20;
            display: flex; align-items: center; box-sizing: border-box; pointer-events: none;
        }
        .fvp-overlay > * { pointer-events: auto; }
        #fvp-container.fvp-show-controls .fvp-overlay { opacity: 1; }

        /* Drag Zones */
        #fvp-head {
            top: 0; justify-content: flex-end;
            background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
            height: 40px; padding-top: 4px;
        }
        #fvp-head-drag {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            cursor: move; touch-action: none; z-index: 1;
        }
        /* Vùng drag bên trái */
        #fvp-left-drag {
            position: absolute; top: 40px; left: 0; bottom: 50px; width: 20px;
            z-index: 19; cursor: move; touch-action: none; background: transparent;
        }
        
        #fvp-close { z-index: 2; font-size: 18px; width: 32px; height: 32px; margin-right: -4px; }

        /* Controls */
        #fvp-ctrl {
            bottom: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
            padding-top: 30px; padding-bottom: 8px; gap: 8px;
            flex-direction: column; justify-content: flex-end;
        }

        .fvp-row { display: flex; width: 100%; align-items: center; gap: 8px; }
        .fvp-grp { display: flex; align-items: center; gap: 2px; flex: 1; justify-content: space-between; }

        .fvp-btn {
            background: transparent; border: none;
            color: rgba(255,255,255,0.9);
            cursor: pointer; font-size: 18px;
            min-width: 36px; min-height: 36px;
            padding: 0; display: flex; align-items: center; justify-content: center;
            border-radius: 8px; transition: background .15s, transform .1s;
            touch-action: manipulation;
        }
        .fvp-btn:active, .fvp-btn:hover { background: rgba(255,255,255,0.2); transform: scale(0.95); color: #fff; }

        /* Seek Bar */
        #fvp-seek {
            width: 100%; height: 4px; background: rgba(255,255,255,0.3);
            border-radius: 2px; -webkit-appearance: none; cursor: pointer; margin-bottom: 4px;
        }
        #fvp-seek::-webkit-slider-thumb {
            -webkit-appearance: none; width: 14px; height: 14px;
            background: #fff; border-radius: 50%; border: 0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
            transition: transform .1s;
        }
        #fvp-seek:hover::-webkit-slider-thumb { transform: scale(1.2); }

        /* Vertical Sliders (Speed/Volume) - Fix căn giữa & bỏ nền */
        .fvp-popup {
            display: none; position: absolute; bottom: 45px; left: 50%; transform: translateX(-50%);
            background: transparent; /* Bỏ nền xám */
            /* backdrop-filter: blur(10px); */ /* Bỏ blur nếu muốn hoàn toàn trong suốt */
            padding: 0; /* Bỏ padding thừa */
            flex-direction: column; align-items: center;
            min-width: 30px;
        }
        .fvp-popup.active { display: flex; }
        .fvp-val { 
            font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 4px; 
            text-shadow: 0 1px 3px rgba(0,0,0,0.8); /* Thêm bóng chữ cho dễ đọc trên nền video */
        }
        
        .fvp-v-slider {
            -webkit-appearance: none; width: 4px; height: 100px;
            writing-mode: vertical-lr; direction: rtl; margin: 4px 0;
            background: rgba(255,255,255,0.4); border-radius: 2px;
            cursor: pointer;
        }
        /* Căn chỉnh lại thumb cho cân đối */
        .fvp-v-slider::-webkit-slider-thumb {
            -webkit-appearance: none; 
            width: 16px; height: 16px;
            background: #fff; border-radius: 50%; 
            margin-right: -6px; /* Căn giữa thumb 16px trên track 4px: (4-16)/2 = -6 */
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }

        #fvp-time {
            font-size: 11px; font-family: sans-serif; color: rgba(255,255,255,0.8);
            min-width: 40px; text-align: center; margin: 0 4px; pointer-events: none;
        }

        /* Resize Handles */
        .fvp-resize-handle { position: absolute; z-index: 100; touch-action: none; background: transparent; }
        .fvp-resize-r { top: 20px; right: -10px; bottom: 20px; width: 20px; cursor: e-resize; }
        .fvp-resize-b { bottom: -10px; left: 20px; right: 20px; height: 20px; cursor: s-resize; }
        .fvp-resize-br { bottom: -10px; right: -10px; width: 30px; height: 30px; cursor: se-resize; z-index: 101; }
        .fvp-resize-br::after {
            content: ''; position: absolute; bottom: 14px; right: 14px;
            width: 8px; height: 8px; border-bottom: 2px solid rgba(255,255,255,0.5); border-right: 2px solid rgba(255,255,255,0.5);
            border-radius: 0 0 2px 0; pointer-events: none;
        }

        .fvp-ph {
            background: #111; display: flex; flex-direction: column;
            align-items: center; justify-content: center; color: #555;
            border: 1px dashed #333; border-radius: 8px;
        }

        @keyframes fvp-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        #fvp-container { animation: fvp-fade-in .2s ease-out; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- LOGIC ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => {
        const e = document.createElement(tag);
        if(c) e.className=c;
        if(html) e.innerHTML=html;
        return e;
    };

    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0;
    const FIT = ['contain', 'cover', 'fill'], ICONS = ['⤢', '🔍', '↔'];

    let state = {
        isDrag: false, isResize: false, 
        startX: 0, startY: 0,
        initLeft: 0, initTop: 0, initW: 0, initH: 0, 
        resizeDir: '',
        hideControlsTimer: null
    };

    // Hỗ trợ cả Touch và Mouse
    const getCoord = (e) => {
        if(e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if(e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    };

    function init() {
        icon = el('div', '', `
            <svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>
            <span id="fvp-badge">0</span>
        `);
        icon.id = 'fvp-master-icon';
        document.body.appendChild(icon);

        menu = el('div');
        menu.id = 'fvp-menu';
        document.body.appendChild(menu);

        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const isShow = menu.style.display === 'flex';
            menu.style.display = isShow ? 'none' : 'flex';
            if(!isShow) renderMenu();
        });

        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            
            <!-- Vùng kéo thả bên trái -->
            <div id="fvp-left-drag"></div>
            
            <!-- Resize Handles -->
            <div class="fvp-resize-handle fvp-resize-r"></div>
            <div class="fvp-resize-handle fvp-resize-b"></div>
            <div class="fvp-resize-handle fvp-resize-br"></div>

            <!-- Header Drag -->
            <div id="fvp-head" class="fvp-overlay">
                <div id="fvp-head-drag"></div>
                <button id="fvp-close" class="fvp-btn">✕</button>
            </div>

            <!-- Controls -->
            <div id="fvp-ctrl" class="fvp-overlay">
                 <div class="fvp-row" style="padding: 0 4px;">
                    <input type="range" id="fvp-seek" min="0" max="100" value="0">
                </div>
                <div class="fvp-row">
                    <button id="fvp-play" class="fvp-btn">▶</button>
                    <span id="fvp-time">0:00</span>

                    <div class="fvp-grp">
                        <button id="fvp-prev" class="fvp-btn" style="font-size:14px">⏮</button>
                        <button id="fvp-next" class="fvp-btn" style="font-size:14px">⏭</button>

                        <div style="position:relative">
                            <button class="fvp-btn" id="fvp-spd-btn" style="font-size:11px;font-weight:700;width:30px">1x</button>
                            <div class="fvp-popup" id="fvp-spd-popup">
                                <span class="fvp-val" id="fvp-spd-val">1x</span>
                                <input type="range" class="fvp-v-slider" id="fvp-spd" min="0.25" max="3" step="0.25" value="1">
                            </div>
                        </div>

                         <div style="position:relative">
                            <button id="fvp-vol-btn" class="fvp-btn" style="font-size:14px">🔊</button>
                            <div class="fvp-popup" id="fvp-vol-popup">
                                <span class="fvp-val" id="fvp-vol-val">100</span>
                                <input type="range" class="fvp-v-slider" id="fvp-vol" min="0" max="1" step="0.05" value="1">
                            </div>
                        </div>

                        <button id="fvp-fit" class="fvp-btn" style="font-size:14px">⤢</button>
                    </div>
                </div>
            </div>
        `);
        box.id = 'fvp-container';
        box.style.display = 'none';
        document.body.appendChild(box);

        setupInteractions();
    }

    function setupInteractions() {
        const showControls = () => {
            box.classList.add('fvp-show-controls');
            clearTimeout(state.hideControlsTimer);
            state.hideControlsTimer = setTimeout(() => {
                // Chỉ ẩn khi không drag, không resize và không có popup nào đang mở
                if(!state.isDrag && !state.isResize && !box.querySelector('.fvp-popup.active')) {
                    box.classList.remove('fvp-show-controls');
                }
            }, 3000);
        };

        // Click để hiện/ẩn controls
        box.addEventListener('click', (e) => {
            if(!e.target.closest('.fvp-popup') && !e.target.closest('#fvp-spd-btn') && !e.target.closest('#fvp-vol-btn')) {
                 document.querySelectorAll('.fvp-popup').forEach(p => p.classList.remove('active'));
            }
            if(e.target === box || e.target.id === 'fvp-wrapper' || e.target.id === 'fvp-head-drag') {
                box.classList.toggle('fvp-show-controls');
            } else {
                showControls();
            }
        });

        // --- DRAG LOGIC (TOUCH + MOUSE) ---
        const startDrag = (e) => {
            const c = getCoord(e);
            state.isDrag = true;
            state.startX = c.x; state.startY = c.y;
            state.initLeft = box.offsetLeft; state.initTop = box.offsetTop;
            showControls();
            if(e.type === 'mousedown') e.preventDefault(); // Ngăn chọn text
            e.stopPropagation();
        };

        // Gán sự kiện cho cả Top Header và Left Edge
        ['fvp-head-drag', 'fvp-left-drag'].forEach(id => {
            const el = $(id);
            if(el) {
                el.addEventListener('touchstart', startDrag, {passive: false});
                el.addEventListener('mousedown', startDrag);
            }
        });

        // --- RESIZE LOGIC (TOUCH + MOUSE) ---
        box.querySelectorAll('.fvp-resize-handle').forEach(handle => {
            const startResize = (e) => {
                const c = getCoord(e);
                state.isResize = true;
                state.resizeDir = handle.className.includes('br') ? 'br' : handle.className.includes('b') ? 'b' : 'r';
                state.startX = c.x; state.startY = c.y;
                state.initW = box.offsetWidth; state.initH = box.offsetHeight;
                showControls();
                if(e.type === 'mousedown') e.preventDefault();
                e.stopPropagation();
            };
            handle.addEventListener('touchstart', startResize, {passive: false});
            handle.addEventListener('mousedown', startResize);
        });

        // --- GLOBAL MOVE/UP (TOUCH + MOUSE) ---
        const move = (e) => {
            if(!state.isDrag && !state.isResize) return;
            const c = getCoord(e);
            const dx = c.x - state.startX;
            const dy = c.y - state.startY;

            if(state.isDrag) {
                let newLeft = state.initLeft + dx;
                let newTop = state.initTop + dy;
                newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - box.offsetWidth));
                newTop = Math.max(0, Math.min(newTop, window.innerHeight - box.offsetHeight));
                box.style.left = newLeft + 'px'; box.style.top = newTop + 'px';
                box.style.right = 'auto'; box.style.bottom = 'auto';
            }
            if(state.isResize) {
                const dir = state.resizeDir;
                if(dir.includes('r') || dir === 'br') box.style.width = Math.max(200, state.initW + dx) + 'px';
                if(dir.includes('b') || dir === 'br') box.style.height = Math.max(120, state.initH + dy) + 'px';
            }
        };

        const end = () => { state.isDrag = false; state.isResize = false; };

        // Touch events
        document.addEventListener('touchmove', move, {passive: false});
        document.addEventListener('touchend', end, {passive: true});

        // Mouse events
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);

        // Buttons
        const btn = (id, fn) => {
            const el = $(id);
            if(el) el.addEventListener('click', (e) => { e.stopPropagation(); fn(); showControls(); });
        };

        btn('fvp-close', restore);
        btn('fvp-play', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        btn('fvp-prev', () => switchVid(-1));
        btn('fvp-next', () => switchVid(1));
        btn('fvp-fit', () => {
            fitIdx = (fitIdx + 1) % 3;
            if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = ICONS[fitIdx];
        });

        $('fvp-seek').addEventListener('input', (e) => {
            if(curVid && curVid.duration) curVid.currentTime = (e.target.value / 100) * curVid.duration;
        });
        
        // Popup toggles
        const togglePopup = (popupId, otherId) => {
            $(popupId).classList.toggle('active');
            $(otherId).classList.remove('active');
        };

        btn('fvp-spd-btn', () => togglePopup('fvp-spd-popup', 'fvp-vol-popup'));
        $('fvp-spd').addEventListener('input', (e) => {
            if(!curVid) return;
            curVid.playbackRate = parseFloat(e.target.value);
            $('fvp-spd-btn').textContent = e.target.value + 'x';
            $('fvp-spd-val').textContent = e.target.value + 'x';
        });

        btn('fvp-vol-btn', () => togglePopup('fvp-vol-popup', 'fvp-spd-popup'));
        $('fvp-vol').addEventListener('input', (e) => {
            if(!curVid) return;
            curVid.volume = e.target.value; curVid.muted = false; updateVolIcon();
        });
        $('fvp-vol-btn').addEventListener('click', (e) => {
            if(!curVid) return;
            curVid.muted = !curVid.muted;
            updateVolIcon();
        });
    }

    function updateVolIcon() {
        if(!curVid) return;
        const v = curVid.muted ? 0 : curVid.volume;
        $('fvp-vol-btn').textContent = v == 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
        $('fvp-vol-val').textContent = Math.round(v*100);
        if(!curVid.muted) $('fvp-vol').value = v;
    }

    function switchVid(dir) {
        if(!curVid || videos.length <= 1) return;
        const idx = videos.indexOf(curVid);
        if(idx === -1) return;
        float(videos[(idx + dir + videos.length) % videos.length]);
    }

    function restore() {
        if(!curVid) return;
        origPar.replaceChild(curVid, ph);
        Object.assign(curVid.style, {width:'', height:'', objectFit:'', objectPosition:''});
        box.style.display = 'none';
        box.classList.remove('fvp-show-controls');
        curVid = null;
    }

    function float(v) {
        if(curVid && curVid !== v) restore();
        if(curVid === v) return;
        if(!box) init();
        origPar = v.parentNode; curVid = v;
        ph = el('div', 'fvp-ph', `<div style="font-size:20px;opacity:.5">📺</div>`);
        ph.style.width = (v.offsetWidth || 300)+'px'; ph.style.height = (v.offsetHeight || 200)+'px';
        origPar.replaceChild(ph, v);
        $('fvp-wrapper').innerHTML=''; $('fvp-wrapper').appendChild(v);
        v.style.objectFit = FIT[fitIdx]; v.style.objectPosition = 'center';
        $('fvp-vol').value = v.volume;
        box.style.display = 'flex'; box.classList.add('fvp-show-controls'); v.play(); menu.style.display = 'none';
        
        v.ontimeupdate = () => {
            $('fvp-play').textContent = v.paused ? '▶' : '⏸';
            if(v.duration) {
                $('fvp-seek').value = (v.currentTime / v.duration) * 100;
                const s = Math.floor(v.currentTime), m = Math.floor(s/60), ss = s%60;
                $('fvp-time').textContent = `${m}:${ss<10?'0'+ss:ss}`;
            }
        };
    }

    function renderMenu() {
        menu.innerHTML = `<div style="padding:10px 16px;font-size:12px;color:#888;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05)">DANH SÁCH VIDEO (${videos.length})</div>`;
        videos.forEach((v, i) => {
            const isActive = v === curVid;
            const item = el('div', `fvp-menu-item ${isActive ? 'active' : ''}`, `
                <span>${isActive ? '▶' : '🎬'}</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Video ${i + 1}</span>
            `);
            item.addEventListener('click', () => float(v));
            menu.appendChild(item);
        });
    }

    setInterval(() => {
        videos = Array.from(document.querySelectorAll('video')).filter(v => {
            const r = v.getBoundingClientRect();
            return (r.width > 50 && r.height > 50) || v === curVid;
        });
        if(icon) {
            $('fvp-badge').textContent = videos.length;
            $('fvp-badge').style.display = videos.length ? 'flex' : 'none';
        }
    }, 2000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
