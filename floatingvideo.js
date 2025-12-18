// ==UserScript==
// @name         Floating Video Player Plus
// @namespace    http://tampermonkey.net/
// @version      5.0
// @description  Floating video player với fullscreen, zoom, controls luôn hiển thị. Tối ưu cho Chromium/mobile.
// @author       Claude
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- CSS OPTIMIZED ---
    const css = `
        /* Master Icon - Fixed */
        #fvp-master-icon {
            position: fixed; z-index: 2147483646;
            width: 48px; height: 48px;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 50%; color: #fff;
            display: flex; align-items: center; justify-content: center;
            cursor: move; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: transform .2s, opacity .3s, background .2s;
            touch-action: none; will-change: transform, opacity;
            opacity: 1;
        }
        #fvp-master-icon.fvp-idle { opacity: 0.4; }
        #fvp-master-icon:hover, #fvp-master-icon:active { opacity: 1; transform: scale(1.05); background: rgba(0,0,255,0.7); }
        
        #fvp-badge {
            position: absolute; top: -2px; right: -2px;
            background: #ff3b30; color: #fff; font-size: 10px; font-weight: 700;
            min-width: 18px; height: 18px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%; border: 2px solid #000;
        }

        /* Menu */
        #fvp-menu {
            position: fixed; z-index: 2147483646;
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
        .fvp-menu-item:hover { background: rgba(255,255,255,0.1); }
        .fvp-menu-item.active { background: rgba(255,255,255,0.08); color: #4CAF50; font-weight: 600; }

        /* Player Container */
        #fvp-container {
            position: fixed; 
            width: min(320px, calc(100vw - 40px)); height: 180px;
            background: #000; box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            z-index: 2147483647; border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            border: 1px solid rgba(255,255,255,0.1);
            min-width: 200px; min-height: 120px;
            max-width: calc(100vw - 10px); max-height: calc(100vh - 60px);
            touch-action: none; user-select: none; -webkit-user-select: none;
            overflow: hidden; will-change: transform, width, height;
        }
        #fvp-wrapper { 
            width: 100%; height: 100%; 
            background: #000; display: flex; 
            align-items: center; justify-content: center; 
            overflow: hidden;
        }
        #fvp-wrapper video { 
            width: 100%!important; 
            height: 100%!important; 
            max-width: none!important; 
            max-height: none!important; 
            object-position: center!important; 
            transition: transform 0.2s ease;
        }

        /* Overlays */
        .fvp-overlay {
            position: absolute; left: 0; width: 100%; padding: 0 12px;
            opacity: 1; /* LUÔN HIỂN THỊ */
            transition: opacity .25s ease; z-index: 20;
            display: flex; align-items: center; box-sizing: border-box;
            pointer-events: none;
        }
        .fvp-overlay > * { pointer-events: auto; }

        /* Drag Zones */
        #fvp-head {
            top: 0; justify-content: flex-end;
            background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
            height: 40px; padding-top: 4px;
        }
        #fvp-head-drag { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: move; touch-action: none; z-index: 1; }
        #fvp-left-drag { position: absolute; top: 40px; left: 0; bottom: 80px; width: 25px; z-index: 19; cursor: move; touch-action: none; background: transparent; }
        #fvp-close { z-index: 2; font-size: 18px; width: 32px; height: 32px; margin-right: -4px; }

        /* Controls - LUÔN HIỂN THỊ */
        #fvp-ctrl {
            bottom: 0;
            background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%);
            padding: 12px 12px 8px 12px;
            flex-direction: column; justify-content: flex-end;
            gap: 8px;
            height: 80px; /* Chiều cao cố định cho controls */
        }
        .fvp-row { 
            display: flex; width: 100%; 
            align-items: center; gap: 8px; 
            flex-wrap: nowrap;
        }
        .fvp-grp { 
            display: flex; align-items: center; 
            gap: 6px; flex: 1; 
            justify-content: flex-end;
            min-width: 0; /* Cho phép co lại */
        }
        .fvp-btn {
            background: transparent; border: none; 
            color: rgba(255,255,255,0.9);
            cursor: pointer; font-size: 18px; 
            min-width: 36px; min-height: 36px;
            padding: 0; display: flex; 
            align-items: center; justify-content: center;
            border-radius: 8px; transition: background .15s, transform .1s;
            touch-action: manipulation; flex-shrink: 0;
        }
        .fvp-btn:active, .fvp-btn:hover { 
            background: rgba(255,255,255,0.2); 
            transform: scale(0.95); color: #fff; 
        }

        /* Seek Bar */
        #fvp-seek {
            width: 100%; height: 4px; 
            background: rgba(255,255,255,0.3);
            border-radius: 2px; -webkit-appearance: none; 
            cursor: pointer; margin: 0;
        }
        #fvp-seek::-webkit-slider-thumb {
            -webkit-appearance: none; width: 14px; height: 14px;
            background: #fff; border-radius: 50%; border: 0;
            box-shadow: 0 1px 4px rgba(0,0,0,0.5); transition: transform .1s;
        }
        #fvp-seek:hover::-webkit-slider-thumb { transform: scale(1.2); }

        /* HORIZONTAL SLIDERS - LUÔN HIỂN THỊ */
        .fvp-h-slider-container {
            display: flex; align-items: center; 
            gap: 4px; flex-shrink: 1;
            min-width: 80px; max-width: 120px;
        }
        .fvp-h-slider-label {
            font-size: 10px; color: rgba(255,255,255,0.8);
            min-width: 28px; text-align: center;
            font-weight: 600;
        }
        .fvp-h-slider {
            -webkit-appearance: none; 
            height: 4px; flex: 1;
            background: rgba(255,255,255,0.3);
            border-radius: 2px; cursor: pointer;
            min-width: 40px;
        }
        .fvp-h-slider::-webkit-slider-thumb {
            -webkit-appearance: none; width: 12px; height: 12px;
            background: #fff; border-radius: 50%; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }

        /* Time display */
        #fvp-time {
            font-size: 11px; font-family: sans-serif; 
            color: rgba(255,255,255,0.8);
            min-width: 50px; text-align: center; 
            margin: 0 4px; pointer-events: none;
            flex-shrink: 0;
        }

        /* Resize Handles */
        .fvp-resize-handle { 
            position: absolute; z-index: 100; 
            touch-action: none; background: transparent; 
        }
        .fvp-resize-r { top: 20px; right: -10px; bottom: 80px; width: 20px; cursor: e-resize; }
        .fvp-resize-b { bottom: 80px; left: 20px; right: 20px; height: 20px; cursor: s-resize; }
        .fvp-resize-br { 
            bottom: 80px; right: -10px; 
            width: 30px; height: 30px; 
            cursor: se-resize; z-index: 101; 
        }
        .fvp-resize-br::after {
            content: ''; position: absolute; 
            bottom: 14px; right: 14px;
            width: 8px; height: 8px; 
            border-bottom: 2px solid rgba(255,255,255,0.5); 
            border-right: 2px solid rgba(255,255,255,0.5);
            border-radius: 0 0 2px 0; pointer-events: none;
        }

        /* Placeholder */
        .fvp-ph { 
            background: #111; border: 1px dashed #333; 
            border-radius: 8px; display: flex; 
            align-items: center; justify-content: center; 
            opacity: 0.5; 
        }

        /* Fullscreen mode */
        #fvp-container:fullscreen {
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
            border-radius: 0 !important;
            background: #000;
        }
        #fvp-container:fullscreen #fvp-wrapper {
            width: 100% !important;
            height: 100% !important;
        }

        /* Mobile optimization */
        @media (max-width: 480px) {
            #fvp-container {
                width: min(280px, calc(100vw - 20px));
                height: 160px;
            }
            .fvp-h-slider-container {
                min-width: 60px;
            }
            .fvp-btn {
                min-width: 32px;
                min-height: 32px;
                font-size: 16px;
            }
            #fvp-ctrl {
                padding: 8px 8px 6px 8px;
                height: 70px;
            }
        }

        /* Animation */
        @keyframes fvp-fade-in { 
            from { opacity: 0; transform: scale(0.95); } 
            to { opacity: 1; transform: scale(1); } 
        }
        #fvp-container { animation: fvp-fade-in .2s ease-out; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- OPTIMIZED UTILS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => {
        const e = document.createElement(tag);
        if(c) e.className=c;
        if(html) e.innerHTML=html;
        return e;
    };
    
    // Optimized coordinate getter
    const getCoord = (e) => {
        if (e.touches && e.touches.length > 0) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.changedTouches && e.changedTouches.length > 0) {
            return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    };

    // Throttle function for performance
    const throttle = (fn, delay) => {
        let lastCall = 0;
        return (...args) => {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                fn(...args);
            }
        };
    };

    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0, zoomLevel = 1;
    const FIT = ['contain', 'cover', 'fill'], FIT_ICONS = ['⤢', '🔍', '↔'];

    // --- MAIN STATE với performance optimization ---
    let state = {
        isDrag: false, isResize: false, isIconDrag: false,
        startX: 0, startY: 0,
        initX: 0, initY: 0, initW: 0, initH: 0,
        iconStartX: 0, iconStartY: 0,
        resizeDir: '',
        idleIconTimer: null,
        // Debounced functions
        updateSeekThrottled: null
    };

    function init() {
        // --- ICON ---
        icon = el('div', 'fvp-idle', `
            <svg viewBox="0 0 24 24" style="width:24px;fill:#fff">
                <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
            </svg>
            <span id="fvp-badge" style="display:none">0</span>
        `);
        icon.id = 'fvp-master-icon';
        icon.style.bottom = '20px'; icon.style.left = '20px';
        document.body.appendChild(icon);

        menu = el('div'); menu.id = 'fvp-menu'; document.body.appendChild(menu);

        // --- PLAYER BOX với controls mới ---
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <div id="fvp-left-drag"></div>
            <div class="fvp-resize-handle fvp-resize-r"></div>
            <div class="fvp-resize-handle fvp-resize-b"></div>
            <div class="fvp-resize-handle fvp-resize-br"></div>

            <div id="fvp-head" class="fvp-overlay">
                <div id="fvp-head-drag"></div>
                <button id="fvp-close" class="fvp-btn" title="Close">✕</button>
            </div>

            <div id="fvp-ctrl" class="fvp-overlay">
                <div class="fvp-row" style="margin-bottom:4px">
                    <input type="range" id="fvp-seek" min="0" max="100" value="0" title="Seek">
                </div>
                
                <div class="fvp-row">
                    <button id="fvp-play" class="fvp-btn" title="Play/Pause">▶</button>
                    <span id="fvp-time">0:00</span>
                    
                    <div class="fvp-grp">
                        <button id="fvp-prev" class="fvp-btn" title="Previous video">⏮</button>
                        <button id="fvp-next" class="fvp-btn" title="Next video">⏭</button>
                        
                        <!-- Speed Slider Horizontal -->
                        <div class="fvp-h-slider-container">
                            <span class="fvp-h-slider-label">Speed</span>
                            <input type="range" class="fvp-h-slider" id="fvp-spd" 
                                   min="0.25" max="3" step="0.25" value="1" title="Playback speed">
                            <span class="fvp-h-slider-label" id="fvp-spd-val">1x</span>
                        </div>
                        
                        <!-- Volume Slider Horizontal -->
                        <div class="fvp-h-slider-container">
                            <button id="fvp-vol-btn" class="fvp-btn" title="Mute/Unmute" style="min-width:24px">🔊</button>
                            <input type="range" class="fvp-h-slider" id="fvp-vol" 
                                   min="0" max="1" step="0.05" value="1" title="Volume">
                            <span class="fvp-h-slider-label" id="fvp-vol-val">100</span>
                        </div>
                        
                        <!-- Fit Mode -->
                        <button id="fvp-fit" class="fvp-btn" title="Fit mode">⤢</button>
                        
                        <!-- Zoom Button -->
                        <button id="fvp-zoom" class="fvp-btn" title="Zoom video">+</button>
                        
                        <!-- Fullscreen Button -->
                        <button id="fvp-full" class="fvp-btn" title="Fullscreen">⛶</button>
                    </div>
                </div>
            </div>
        `);
        box.id = 'fvp-container'; 
        box.style.display = 'none';
        
        // Vị trí mặc định: giữa trái
        const defaultTop = Math.max(20, (window.innerHeight - 180) / 2);
        box.style.top = defaultTop + 'px';
        box.style.left = '20px';
        
        document.body.appendChild(box);

        // Khởi tạo throttled function
        state.updateSeekThrottled = throttle(() => {
            if (!curVid || !curVid.duration) return;
            const seek = $('fvp-seek');
            if (seek) {
                seek.value = (curVid.currentTime / curVid.duration) * 100;
            }
        }, 100);

        setupInteractions();
        resetIdle();
    }

    // Toggle menu
    const toggleMenu = () => {
        resetIdle();
        const isShow = menu.style.display === 'flex';
        menu.style.display = isShow ? 'none' : 'flex';
        if(!isShow) {
            const rect = icon.getBoundingClientRect();
            menu.style.left = Math.min(rect.left, window.innerWidth - 290) + 'px';
            const spaceBelow = window.innerHeight - rect.bottom;
            if (spaceBelow < 300) {
                menu.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                menu.style.top = 'auto';
            } else {
                menu.style.top = (rect.bottom + 10) + 'px';
                menu.style.bottom = 'auto';
            }
            renderMenu();
        }
    };

    const resetIdle = () => {
        if(!icon) return;
        icon.classList.remove('fvp-idle');
        clearTimeout(state.idleIconTimer);
        state.idleIconTimer = setTimeout(() => {
            if (icon && !state.isIconDrag) {
                icon.classList.add('fvp-idle');
            }
        }, 3000);
    };

    function setupInteractions() {
        // --- DRAG LOGIC với passive listeners ---
        const startIconDrag = (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetIdle();
            const c = getCoord(e);
            state.isIconDrag = true;
            state.startX = c.x; state.startY = c.y;
            state.iconStartX = c.x; state.iconStartY = c.y;
            
            const rect = icon.getBoundingClientRect();
            state.initX = rect.left; state.initY = rect.top;
        };

        // Sử dụng passive: false chỉ cho touchstart vì cần preventDefault
        icon.addEventListener('touchstart', startIconDrag, {passive: false});
        icon.addEventListener('mousedown', startIconDrag);

        const move = (e) => {
            if(!state.isDrag && !state.isResize && !state.isIconDrag) return;
            const c = getCoord(e);
            const dx = c.x - state.startX;
            const dy = c.y - state.startY;

            // Icon Move
            if(state.isIconDrag) {
                let nx = state.initX + dx;
                let ny = state.initY + dy;
                nx = Math.max(10, Math.min(nx, window.innerWidth - 58));
                ny = Math.max(10, Math.min(ny, window.innerHeight - 58));
                icon.style.left = nx + 'px'; 
                icon.style.top = ny + 'px';
                icon.style.bottom = 'auto'; 
                icon.style.right = 'auto';
                resetIdle();
                return;
            }

            // Player Move - sử dụng transform cho performance
            if(state.isDrag) {
                let nx = state.initX + dx;
                let ny = state.initY + dy;
                nx = Math.max(0, Math.min(nx, window.innerWidth - box.offsetWidth));
                ny = Math.max(0, Math.min(ny, window.innerHeight - box.offsetHeight));
                box.style.left = nx + 'px'; 
                box.style.top = ny + 'px';
            }
            
            // Resize
            if(state.isResize) {
                if(state.resizeDir.includes('r') || state.resizeDir === 'br') {
                    box.style.width = Math.max(200, state.initW + dx) + 'px';
                }
                if(state.resizeDir.includes('b') || state.resizeDir === 'br') {
                    box.style.height = Math.max(120, state.initH + dy) + 'px';
                }
            }
        };

        const end = (e) => {
            if(state.isIconDrag) {
                const c = getCoord(e);
                const dx = c.x - state.iconStartX;
                const dy = c.y - state.iconStartY;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                // Nếu di chuyển ít hơn 8px thì coi là click
                if(dist < 8) {
                    toggleMenu();
                }
            }

            state.isDrag = false; 
            state.isResize = false; 
            state.isIconDrag = false; 
        };
        
        // Sử dụng passive: true cho touchmove/mousemove để performance
        document.addEventListener('touchmove', move, {passive: true});
        document.addEventListener('mousemove', move);
        document.addEventListener('touchend', end, {passive: true});
        document.addEventListener('mouseup', end);

        // Player Drag Start
        const startDrag = (e) => {
            const c = getCoord(e);
            state.isDrag = true; 
            state.startX = c.x; 
            state.startY = c.y;
            state.initX = box.offsetLeft; 
            state.initY = box.offsetTop;
            e.preventDefault(); 
            e.stopPropagation();
        };
        
        ['fvp-head-drag', 'fvp-left-drag'].forEach(id => {
            const el = $(id);
            if (el) {
                el.addEventListener('touchstart', startDrag, {passive: false});
                el.addEventListener('mousedown', startDrag);
            }
        });

        // Resize Start
        box.querySelectorAll('.fvp-resize-handle').forEach(h => {
            const startResize = (e) => {
                const c = getCoord(e);
                state.isResize = true;
                state.resizeDir = h.className.includes('br') ? 'br' : 
                                 h.className.includes('b') ? 'b' : 'r';
                state.startX = c.x; 
                state.startY = c.y;
                state.initW = box.offsetWidth; 
                state.initH = box.offsetHeight;
                e.preventDefault(); 
                e.stopPropagation();
            };
            h.addEventListener('touchstart', startResize, {passive: false});
            h.addEventListener('mousedown', startResize);
        });

        // Button handlers
        const btn = (id, fn) => {
            const element = $(id);
            if (element) {
                element.addEventListener('click', (e) => { 
                    e.stopPropagation(); 
                    fn(); 
                });
            }
        };
        
        btn('fvp-close', restore);
        btn('fvp-play', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        btn('fvp-prev', () => switchVid(-1));
        btn('fvp-next', () => switchVid(1));
        btn('fvp-fit', () => {
            fitIdx = (fitIdx + 1) % 3;
            if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = FIT_ICONS[fitIdx];
        });
        
        // Zoom button
        btn('fvp-zoom', () => {
            if (!curVid) return;
            zoomLevel = zoomLevel === 1 ? 1.5 : 1;
            curVid.style.transform = `scale(${zoomLevel})`;
            curVid.style.transformOrigin = 'center';
            $('fvp-zoom').textContent = zoomLevel === 1 ? '+' : '-';
            $('fvp-zoom').title = zoomLevel === 1 ? 'Zoom in' : 'Zoom out';
        });
        
        // Fullscreen button
        btn('fvp-full', toggleFullscreen);
        
        // Volume button (mute/unmute)
        $('fvp-vol-btn').addEventListener('click', (e) => { 
            e.stopPropagation();
            if(curVid) { 
                curVid.muted = !curVid.muted; 
                updateVolUI(); 
            }
        });

        // Seek bar
        $('fvp-seek').addEventListener('input', (e) => {
            if(curVid && curVid.duration) {
                curVid.currentTime = (e.target.value/100) * curVid.duration;
            }
        });

        // Speed slider
        $('fvp-spd').addEventListener('input', (e) => { 
            if(curVid) { 
                const value = parseFloat(e.target.value);
                curVid.playbackRate = value;
                $('fvp-spd-val').textContent = value.toFixed(2) + 'x';
            } 
        });

        // Volume slider
        $('fvp-vol').addEventListener('input', (e) => { 
            if(curVid) { 
                const value = parseFloat(e.target.value);
                curVid.volume = value;
                curVid.muted = false;
                updateVolUI();
            } 
        });
    }

    function updateVolUI() {
        if(!curVid) return;
        const v = curVid.muted ? 0 : curVid.volume;
        $('fvp-vol-btn').textContent = v == 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
        $('fvp-vol-val').textContent = Math.round(v*100);
        if(!curVid.muted) {
            $('fvp-vol').value = v;
        }
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (box.requestFullscreen) {
                box.requestFullscreen();
            } else if (box.webkitRequestFullscreen) {
                box.webkitRequestFullscreen();
            } else if (box.mozRequestFullScreen) {
                box.mozRequestFullScreen();
            } else if (box.msRequestFullscreen) {
                box.msRequestFullscreen();
            }
            $('fvp-full').textContent = '⛶';
            $('fvp-full').title = 'Exit fullscreen';
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            $('fvp-full').textContent = '⛶';
            $('fvp-full').title = 'Fullscreen';
        }
    }

    // Fullscreen change handler
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    function handleFullscreenChange() {
        if (!document.fullscreenElement && 
            !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && 
            !document.msFullscreenElement) {
            $('fvp-full').textContent = '⛶';
            $('fvp-full').title = 'Fullscreen';
        }
    }

    function getSortedVideos() {
        const all = Array.from(document.querySelectorAll('video, .fvp-ph'));
        const list = [];
        all.forEach(el => {
            if(el.classList.contains('fvp-ph')) { 
                if(curVid) list.push(curVid); 
            } else if(el !== curVid && !el.closest('#fvp-wrapper')) {
                list.push(el);
            }
        });
        return list;
    }

    function switchVid(dir) {
        const list = getSortedVideos();
        if(!curVid || list.length <= 1) return;
        const idx = list.indexOf(curVid);
        if(idx === -1) return;
        float(list[(idx + dir + list.length) % list.length]);
    }

    function restore() {
        if(!curVid) return;
        if (origPar && ph) {
            origPar.replaceChild(curVid, ph);
        }
        Object.assign(curVid.style, {
            width: '', 
            height: '', 
            objectFit: '', 
            objectPosition: '',
            transform: ''
        });
        box.style.display = 'none';
        zoomLevel = 1;
        curVid = null;
    }

    function float(v) {
        if(curVid && curVid !== v) restore();
        if(curVid === v) return;
        
        if(!box) init();
        
        origPar = v.parentNode; 
        curVid = v;
        
        ph = el('div', 'fvp-ph', `<div style="font-size:20px;opacity:.5">📺</div>`);
        ph.style.width = (v.offsetWidth || 300)+'px'; 
        ph.style.height = (v.offsetHeight || 200)+'px';
        
        if (origPar) {
            origPar.replaceChild(ph, v);
        }
        
        $('fvp-wrapper').innerHTML = '';
        $('fvp-wrapper').appendChild(v);
        
        v.style.objectFit = FIT[fitIdx]; 
        v.style.objectPosition = 'center';
        
        $('fvp-vol').value = v.volume;
        updateVolUI();
        
        box.style.display = 'flex'; 
        menu.style.display = 'none';
        
        // Reset zoom
        zoomLevel = 1;
        v.style.transform = 'scale(1)';
        $('fvp-zoom').textContent = '+';
        $('fvp-zoom').title = 'Zoom in';
        
        // Play video
        v.play().catch(e => console.log('Autoplay prevented:', e));
        
        // Setup timeupdate với throttling
        v.ontimeupdate = () => {
            $('fvp-play').textContent = v.paused ? '▶' : '⏸';
            if(v.duration) {
                state.updateSeekThrottled();
                const s = Math.floor(v.currentTime), m = Math.floor(s/60), ss = s%60;
                $('fvp-time').textContent = `${m}:${ss<10?'0'+ss:ss}`;
            }
        };
        
        // Setup ended event
        v.onended = () => {
            switchVid(1);
        };
    }

    function renderMenu() {
        const list = getSortedVideos();
        menu.innerHTML = `<div style="padding:10px 16px;font-size:12px;color:#888;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05)">
            VIDEOS (${list.length})</div>`;
        
        list.forEach((v, i) => {
            const isActive = v === curVid;
            const item = el('div', `fvp-menu-item ${isActive ? 'active' : ''}`, `
                <span>${isActive ? '▶' : '🎬'}</span>
                <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    Video ${i + 1} ${isActive ? '(Current)' : ''}
                </span>
            `);
            item.addEventListener('click', () => float(v));
            menu.appendChild(item);
        });
        
        if (list.length === 0) {
            const empty = el('div', 'fvp-menu-item', `
                <span>📹</span>
                <span style="flex:1">No videos found</span>
            `);
            empty.style.opacity = '0.5';
            menu.appendChild(empty);
        }
    }

    // Periodically check for videos
    setInterval(() => {
        const list = getSortedVideos().filter(v => {
            if(v === curVid) return true;
            const r = v.getBoundingClientRect();
            return r.width > 50 && r.height > 50;
        });
        
        if(icon) {
            const badge = $('fvp-badge');
            if (badge) {
                badge.textContent = list.length;
                badge.style.display = list.length ? 'flex' : 'none';
            }
        }
    }, 3000);

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
