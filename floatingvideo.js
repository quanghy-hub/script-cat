// ==UserScript==
// @name         Floating
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Floating video player tối ưu cho mobile
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
        
        #fvp-badge { position: absolute; top: -2px; right: -2px; background: #ff3b30; color: #fff; font-size: 10px; font-weight: 700; min-width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2px solid #000; }

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
        #fvp-wrapper { width: 100%; height: 100%; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        #fvp-wrapper video { width: 100%!important; height: 100%!important; max-width: none!important; max-height: none!important; object-position: center!important; transition: transform 0.2s ease; }

        /* Overlays */
        .fvp-overlay {
            position: absolute; left: 0; width: 100%; padding: 0 12px;
            opacity: 1; transition: opacity .25s ease; z-index: 20;
            display: flex; align-items: center; box-sizing: border-box;
            pointer-events: none;
        }
        .fvp-overlay > * { pointer-events: auto; }

        /* Drag Zones */
        #fvp-head { top: 0; justify-content: flex-end; background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%); height: 40px; padding-top: 4px; }
        #fvp-head-drag { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: move; touch-action: none; z-index: 1; }
        #fvp-left-drag { position: absolute; top: 40px; left: 0; bottom: 60px; width: 25px; z-index: 19; cursor: move; touch-action: none; background: transparent; }
        #fvp-close { z-index: 2; font-size: 18px; width: 32px; height: 32px; margin-right: -4px; }

        /* Controls */
        #fvp-ctrl {
            bottom: 0; background: linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.8) 100%);
            padding: 12px 12px 8px 12px; flex-direction: column; justify-content: flex-end;
            gap: 6px; height: 60px;
        }
        
        /* Seek Bar với touch area mở rộng */
        #fvp-seek-container {
            position: relative; width: 100%; margin-bottom: 4px;
            height: 24px; /* Tăng chiều cao touch area */
            display: flex; align-items: center;
        }
        
        #fvp-seek {
            width: 100%; height: 4px; 
            background: rgba(255,255,255,0.3);
            border-radius: 2px; -webkit-appearance: none; 
            cursor: pointer; margin: 0; z-index: 2;
            position: relative;
        }
        #fvp-seek::-webkit-slider-thumb {
            -webkit-appearance: none; width: 18px; height: 18px; /* Tăng kích thước thumb */
            background: #fff; border-radius: 50%; border: 0;
            box-shadow: 0 2px 6px rgba(0,0,0,0.6); transition: transform .1s;
        }
        #fvp-seek:hover::-webkit-slider-thumb { transform: scale(1.3); }
        
        /* Touch overlay cho seek bar */
        #fvp-seek-touch {
            position: absolute;
            top: -10px; bottom: -10px;
            left: 0; right: 0;
            z-index: 1;
            cursor: pointer;
        }

        /* Time Display */
        #fvp-time-display {
            position: absolute; top: -18px; left: 0; right: 0;
            display: flex; justify-content: space-between;
            font-size: 10px; color: rgba(255,255,255,0.8);
            padding: 0 4px; pointer-events: none;
        }
        #fvp-current-time, #fvp-duration {
            background: rgba(0,0,0,0.5); padding: 1px 4px; border-radius: 2px;
        }

        /* Control Row */
        .fvp-control-row {
            display: flex; width: 100%; align-items: center;
            gap: 6px; justify-content: space-between;
            flex-wrap: nowrap; min-height: 36px;
        }
        
        .fvp-volume-container { display: flex; align-items: center; gap: 4px; flex-shrink: 0; min-width: 80px; }
        
        .fvp-volume-slider {
            -webkit-appearance: none; height: 4px; width: 60px;
            background: rgba(255,255,255,0.3); border-radius: 2px; cursor: pointer;
            flex-shrink: 0;
        }
        .fvp-volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none; width: 14px; height: 14px;
            background: #fff; border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        
        .fvp-icon-group {
            display: flex; align-items: center; gap: 4px;
            justify-content: flex-end; flex: 1; min-width: 0;
        }

        .fvp-btn {
            background: transparent; border: none; color: rgba(255,255,255,0.9);
            cursor: pointer; font-size: 18px; min-width: 32px; min-height: 32px;
            padding: 0; display: flex; align-items: center; justify-content: center;
            border-radius: 6px; transition: background .15s, transform .1s;
            touch-action: manipulation; flex-shrink: 0;
        }
        .fvp-btn:active, .fvp-btn:hover { background: rgba(255,255,255,0.2); transform: scale(0.95); color: #fff; }
        
        #fvp-fit { font-size: 16px; }
        #fvp-zoom { font-size: 16px; font-weight: bold; }
        #fvp-full { font-size: 16px; }

        /* Resize Handles */
        .fvp-resize-handle { position: absolute; z-index: 100; touch-action: none; background: transparent; }
        .fvp-resize-r { top: 20px; right: -10px; bottom: 60px; width: 20px; cursor: e-resize; }
        .fvp-resize-b { bottom: 60px; left: 20px; right: 20px; height: 20px; cursor: s-resize; }
        .fvp-resize-br { bottom: 60px; right: -10px; width: 30px; height: 30px; cursor: se-resize; z-index: 101; }
        .fvp-resize-br::after {
            content: ''; position: absolute; bottom: 14px; right: 14px;
            width: 8px; height: 8px; border-bottom: 2px solid rgba(255,255,255,0.5); 
            border-right: 2px solid rgba(255,255,255,0.5); border-radius: 0 0 2px 0; pointer-events: none;
        }

        /* Placeholder */
        .fvp-ph { background: #111; border: 1px dashed #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; opacity: 0.5; }

        /* Fullscreen mode */
        #fvp-container:fullscreen { width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; border-radius: 0 !important; background: #000; }
        #fvp-container:fullscreen #fvp-wrapper { width: 100% !important; height: 100% !important; }

        /* Mobile optimization với touch area lớn hơn */
        @media (max-width: 480px) {
            #fvp-container { width: min(280px, calc(100vw - 20px)); height: 150px; }
            .fvp-control-row { gap: 4px; }
            .fvp-btn { min-width: 36px; min-height: 36px; font-size: 18px; } /* Tăng kích thước nút */
            #fvp-ctrl { padding: 8px 8px 6px 8px; height: 55px; }
            .fvp-volume-container { min-width: 70px; }
            .fvp-volume-slider { width: 50px; }
            .fvp-icon-group { gap: 4px; }
            
            /* Tăng touch area cho seek bar trên mobile */
            #fvp-seek-container { height: 32px; }
            #fvp-seek-touch { top: -14px; bottom: -14px; }
            #fvp-seek::-webkit-slider-thumb { width: 22px; height: 22px; }
        }
        
        @media (max-width: 360px) {
            .fvp-control-row { gap: 3px; }
            .fvp-btn { min-width: 34px; min-height: 34px; font-size: 16px; }
            #fvp-fit, #fvp-zoom, #fvp-full { font-size: 16px; }
            .fvp-volume-slider { width: 40px; }
        }

        /* Animation */
        @keyframes fvp-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        #fvp-container { animation: fvp-fade-in .2s ease-out; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    // --- UTILS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => {
        const e = document.createElement(tag);
        if(c) e.className=c;
        if(html) e.innerHTML=html;
        return e;
    };
    
    const getCoord = (e) => {
        if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        else if (e.changedTouches && e.changedTouches.length > 0) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    };

    // Animation frame cho seek mượt mà
    let rafId = null;
    const updateSeekSmooth = () => {
        if (!curVid || !curVid.duration) return;
        const seek = $('fvp-seek');
        if (seek) {
            seek.value = (curVid.currentTime / curVid.duration) * 100;
        }
        $('fvp-current-time').textContent = formatTime(curVid.currentTime);
        if (!curVid.paused && !curVid.ended) {
            rafId = requestAnimationFrame(updateSeekSmooth);
        }
    };

    const formatTime = (seconds) => {
        const s = Math.floor(seconds);
        const m = Math.floor(s / 60);
        const ss = s % 60;
        return `${m}:${ss < 10 ? '0' + ss : ss}`;
    };

    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0, zoomLevel = 1, isSeeking = false;
    const FIT = ['contain', 'cover', 'fill'], FIT_ICONS = ['⤢', '🔍', '↔'];

    // --- MAIN STATE ---
    let state = {
        isDrag: false, isResize: false, isIconDrag: false,
        startX: 0, startY: 0,
        initX: 0, initY: 0, initW: 0, initH: 0,
        iconStartX: 0, iconStartY: 0,
        resizeDir: '',
        idleIconTimer: null
    };

    function init() {
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
                <div id="fvp-seek-container">
                    <div id="fvp-time-display">
                        <span id="fvp-current-time">0:00</span>
                        <span id="fvp-duration">0:00</span>
                    </div>
                    <div id="fvp-seek-touch"></div>
                    <input type="range" id="fvp-seek" min="0" max="100" value="0" title="Seek">
                </div>
                
                <div class="fvp-control-row">
                    <div class="fvp-volume-container">
                        <button id="fvp-vol-btn" class="fvp-btn" title="Mute/Unmute">🔊</button>
                        <input type="range" class="fvp-volume-slider" id="fvp-vol" min="0" max="1" step="0.05" value="1" title="Volume">
                    </div>
                    
                    <div class="fvp-icon-group">
                        <button id="fvp-fit" class="fvp-btn" title="Fit mode">⤢</button>
                        <button id="fvp-zoom" class="fvp-btn" title="Zoom video">+</button>
                        <button id="fvp-full" class="fvp-btn" title="Fullscreen">⛶</button>
                        <button id="fvp-prev" class="fvp-btn" title="Previous">⏮</button>
                        <button id="fvp-next" class="fvp-btn" title="Next">⏭</button>
                    </div>
                </div>
            </div>
        `);
        box.id = 'fvp-container'; 
        box.style.display = 'none';
        const defaultTop = Math.max(20, (window.innerHeight - 180) / 2);
        box.style.top = defaultTop + 'px';
        box.style.left = '20px';
        document.body.appendChild(box);

        setupInteractions();
        resetIdle();
    }

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
            if (icon && !state.isIconDrag) icon.classList.add('fvp-idle');
        }, 3000);
    };

    function setupInteractions() {
        // --- DRAG LOGIC ---
        const startIconDrag = (e) => {
            e.preventDefault(); e.stopPropagation();
            resetIdle();
            const c = getCoord(e);
            state.isIconDrag = true;
            state.startX = c.x; state.startY = c.y;
            state.iconStartX = c.x; state.iconStartY = c.y;
            const rect = icon.getBoundingClientRect();
            state.initX = rect.left; state.initY = rect.top;
        };

        icon.addEventListener('touchstart', startIconDrag, {passive: false});
        icon.addEventListener('mousedown', startIconDrag);

        const move = (e) => {
            if(!state.isDrag && !state.isResize && !state.isIconDrag) return;
            const c = getCoord(e);
            const dx = c.x - state.startX;
            const dy = c.y - state.startY;

            if(state.isIconDrag) {
                let nx = state.initX + dx;
                let ny = state.initY + dy;
                nx = Math.max(10, Math.min(nx, window.innerWidth - 58));
                ny = Math.max(10, Math.min(ny, window.innerHeight - 58));
                icon.style.left = nx + 'px'; icon.style.top = ny + 'px';
                icon.style.bottom = 'auto'; icon.style.right = 'auto';
                resetIdle();
                return;
            }

            if(state.isDrag) {
                let nx = state.initX + dx;
                let ny = state.initY + dy;
                nx = Math.max(0, Math.min(nx, window.innerWidth - box.offsetWidth));
                ny = Math.max(0, Math.min(ny, window.innerHeight - box.offsetHeight));
                box.style.left = nx + 'px'; box.style.top = ny + 'px';
            }
            
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
                if(dist < 8) toggleMenu();
            }
            state.isDrag = false; state.isResize = false; state.isIconDrag = false;
        };
        
        document.addEventListener('touchmove', move, {passive: true});
        document.addEventListener('mousemove', move);
        document.addEventListener('touchend', end, {passive: true});
        document.addEventListener('mouseup', end);

        // Player Drag Start
        const startDrag = (e) => {
            const c = getCoord(e);
            state.isDrag = true; state.startX = c.x; state.startY = c.y;
            state.initX = box.offsetLeft; state.initY = box.offsetTop;
            e.preventDefault(); e.stopPropagation();
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
                state.resizeDir = h.className.includes('br') ? 'br' : h.className.includes('b') ? 'b' : 'r';
                state.startX = c.x; state.startY = c.y;
                state.initW = box.offsetWidth; state.initH = box.offsetHeight;
                e.preventDefault(); e.stopPropagation();
            };
            h.addEventListener('touchstart', startResize, {passive: false});
            h.addEventListener('mousedown', startResize);
        });

        // Button handlers
        const btn = (id, fn) => $(id)?.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
        btn('fvp-close', restore);
        btn('fvp-prev', () => switchVid(-1));
        btn('fvp-next', () => switchVid(1));
        btn('fvp-fit', () => {
            fitIdx = (fitIdx + 1) % 3;
            if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = FIT_ICONS[fitIdx];
        });
        
        btn('fvp-zoom', () => {
            if (!curVid) return;
            zoomLevel = zoomLevel === 1 ? 1.5 : zoomLevel === 1.5 ? 2 : 1;
            curVid.style.transform = `scale(${zoomLevel})`;
            curVid.style.transformOrigin = 'center';
            $('fvp-zoom').textContent = zoomLevel === 1 ? '+' : zoomLevel === 1.5 ? '++' : '-';
            $('fvp-zoom').title = `Zoom ${zoomLevel}x`;
        });
        
        btn('fvp-full', toggleFullscreen);
        
        $('fvp-vol-btn').addEventListener('click', (e) => { 
            e.stopPropagation();
            if(curVid) { curVid.muted = !curVid.muted; updateVolUI(); }
        });

        // Seek bar với cảm ứng mượt mà
        const seekBar = $('fvp-seek');
        const seekTouch = $('fvp-seek-touch');
        
        const startSeek = (e) => {
            isSeeking = true;
            if (rafId) cancelAnimationFrame(rafId);
            handleSeek(e);
            document.addEventListener('mousemove', handleSeek);
            document.addEventListener('touchmove', handleSeek, {passive: true});
            document.addEventListener('mouseup', endSeek);
            document.addEventListener('touchend', endSeek, {passive: true});
        };

        const handleSeek = (e) => {
            if (!curVid || !curVid.duration || !isSeeking) return;
            const rect = seekBar.getBoundingClientRect();
            const c = getCoord(e);
            let percent = (c.x - rect.left) / rect.width;
            percent = Math.max(0, Math.min(1, percent));
            seekBar.value = percent * 100;
            curVid.currentTime = percent * curVid.duration;
            $('fvp-current-time').textContent = formatTime(curVid.currentTime);
        };

        const endSeek = () => {
            isSeeking = false;
            document.removeEventListener('mousemove', handleSeek);
            document.removeEventListener('touchmove', handleSeek);
            document.removeEventListener('mouseup', endSeek);
            document.removeEventListener('touchend', endSeek);
            if (!curVid.paused && !curVid.ended) {
                rafId = requestAnimationFrame(updateSeekSmooth);
            }
        };

        seekTouch.addEventListener('touchstart', startSeek, {passive: false});
        seekTouch.addEventListener('mousedown', startSeek);
        seekBar.addEventListener('input', (e) => {
            if(curVid && curVid.duration) {
                curVid.currentTime = (e.target.value/100) * curVid.duration;
            }
        });

        // Volume slider với cảm ứng mượt mà
        const volSlider = $('fvp-vol');
        volSlider.addEventListener('input', (e) => { 
            if(curVid) { 
                curVid.volume = parseFloat(e.target.value);
                curVid.muted = false;
                updateVolUI();
            } 
        });
        
        // Click video to play/pause
        box.addEventListener('click', (e) => {
            if (e.target === box || e.target.id === 'fvp-wrapper' || e.target.id === 'fvp-head-drag') {
                if (curVid) curVid.paused ? curVid.play() : curVid.pause();
            }
        });
    }

    function updateVolUI() {
        if(!curVid) return;
        const v = curVid.muted ? 0 : curVid.volume;
        $('fvp-vol-btn').textContent = v == 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
        if(!curVid.muted) $('fvp-vol').value = v;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            box.requestFullscreen?.() || box.webkitRequestFullscreen?.() || 
            box.mozRequestFullScreen?.() || box.msRequestFullscreen?.();
            $('fvp-full').textContent = '⛶'; $('fvp-full').title = 'Exit fullscreen';
        } else {
            document.exitFullscreen?.() || document.webkitExitFullscreen?.() || 
            document.mozCancelFullScreen?.() || document.msExitFullscreen?.();
            $('fvp-full').textContent = '⛶'; $('fvp-full').title = 'Fullscreen';
        }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    function handleFullscreenChange() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement && 
            !document.mozFullScreenElement && !document.msFullscreenElement) {
            $('fvp-full').textContent = '⛶'; $('fvp-full').title = 'Fullscreen';
        }
    }

    function getSortedVideos() {
        const all = Array.from(document.querySelectorAll('video, .fvp-ph'));
        return all.filter(el => {
            if(el.classList.contains('fvp-ph')) return curVid;
            return el !== curVid && !el.closest('#fvp-wrapper');
        });
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
        if (origPar && ph) origPar.replaceChild(curVid, ph);
        Object.assign(curVid.style, { width: '', height: '', objectFit: '', objectPosition: '', transform: '' });
        if (rafId) cancelAnimationFrame(rafId);
        box.style.display = 'none'; zoomLevel = 1; curVid = null;
    }

    function float(v) {
        if(curVid && curVid !== v) restore();
        if(curVid === v) return;
        if(!box) init();
        
        origPar = v.parentNode; curVid = v;
        ph = el('div', 'fvp-ph', `<div style="font-size:20px;opacity:.5">📺</div>`);
        ph.style.width = (v.offsetWidth || 300)+'px'; 
        ph.style.height = (v.offsetHeight || 200)+'px';
        if (origPar) origPar.replaceChild(ph, v);
        
        $('fvp-wrapper').innerHTML = ''; $('fvp-wrapper').appendChild(v);
        v.style.objectFit = FIT[fitIdx]; v.style.objectPosition = 'center';
        $('fvp-vol').value = v.volume; updateVolUI();
        box.style.display = 'flex'; menu.style.display = 'none';
        zoomLevel = 1; v.style.transform = 'scale(1)';
        $('fvp-zoom').textContent = '+'; $('fvp-zoom').title = 'Zoom in';
        
        // Setup video events với animation frame mượt mà
        const updateTime = () => {
            if (v.duration && !isNaN(v.duration)) {
                $('fvp-current-time').textContent = formatTime(v.currentTime);
                $('fvp-duration').textContent = formatTime(v.duration);
            }
        };
        
        v.ontimeupdate = updateTime;
        v.onloadedmetadata = () => {
            if (v.duration && !isNaN(v.duration)) $('fvp-duration').textContent = formatTime(v.duration);
            updateTime();
            if (!v.paused && !v.ended) rafId = requestAnimationFrame(updateSeekSmooth);
        };
        
        v.onplay = () => {
            if (!isSeeking) rafId = requestAnimationFrame(updateSeekSmooth);
        };
        
        v.onpause = v.onended = () => {
            if (rafId) cancelAnimationFrame(rafId);
        };
        
        if (v.readyState >= 1) updateTime();
        v.onended = () => switchVid(1);
        
        v.play().catch(e => console.log('Autoplay prevented'));
    }

    function renderMenu() {
        const list = getSortedVideos();
        menu.innerHTML = `<div style="padding:10px 16px;font-size:12px;color:#888;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05)">VIDEOS (${list.length})</div>`;
        
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
            const empty = el('div', 'fvp-menu-item', `<span>📹</span><span style="flex:1">No videos found</span>`);
            empty.style.opacity = '0.5'; menu.appendChild(empty);
        }
    }

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

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
