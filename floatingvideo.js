// ==UserScript==
// @name         Floating
// @namespace    
// @version      5.9.21
// @description  Floating video player optimized for mobile with video rotation
// @author       Claude
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ============================================
    // CONSTANTS
    // ============================================
    const ZINDEX = { ICON: 2147483646, PLAYER: 2147483647 };
    const FIT_MODES = ['contain', 'cover', 'fill'];
    const FIT_ICONS = ['⤢', '🔍', '↔'];
    const ZOOM_LEVELS = [1, 1.5, 2, 3];
    const ZOOM_ICONS = ['+', '++', '+++', '-'];
    const IDLE_TIMEOUT = 3000;
    const VIDEO_CHECK_INTERVAL = 2000;

    // ============================================
    // CSS STYLES
    // ============================================
    const css = `
        /* Base Elements */
        #fvp-master-icon, #fvp-menu, #fvp-container { position: fixed; }
        
        #fvp-master-icon {
            z-index: ${ZINDEX.ICON}; width: 42px; height: 42px;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
            border-radius: 50%;
            color: #fff; display: flex; align-items: center; justify-content: center;
            cursor: move; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: transform .2s, opacity .3s, background .2s;
            touch-action: none; will-change: transform, opacity;
        }
        #fvp-master-icon.fvp-idle { opacity: 0.4; }
        #fvp-master-icon:hover, #fvp-master-icon:active { 
            opacity: 1; transform: scale(1.05); background: rgba(0,0,255,0.7); 
        }
        
        #fvp-badge {
            position: absolute; top: -2px; right: -2px;
            background: #ff3b30; color: #fff; font-size: 10px; font-weight: 700;
            min-width: 18px; height: 18px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 50%;
        }

        #fvp-menu {
            z-index: ${ZINDEX.ICON}; display: none; flex-direction: column;
            background: rgba(20,20,20,0.95); backdrop-filter: blur(20px);
            border-radius: 12px;
            width: min(280px, calc(100vw - 40px)); max-height: 50vh;
            overflow-y: auto; padding: 4px 0; color: #eee;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        
        .fvp-menu-item {
            padding: 12px 16px; font-size: 14px; cursor: pointer;
            display: flex; gap: 10px; align-items: center;
            transition: background .2s;
        }
        .fvp-menu-item:hover { background: rgba(255,255,255,0.1); }
        .fvp-menu-item.active { background: rgba(255,255,255,0.08); color: #4CAF50; font-weight: 600; }

        /* Player Container */
        #fvp-container {
            z-index: ${ZINDEX.PLAYER}; display: flex;
            align-items: center; justify-content: center;
            width: min(680px, calc(100vw - 40px)); height: 420px;
            min-width: 200px; min-height: 120px;
            max-width: calc(100vw - 10px); max-height: calc(100vh - 60px);
            background: #000; border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6);
            touch-action: none; user-select: none; -webkit-user-select: none;
            overflow: hidden; will-change: transform, width, height;
            animation: fvp-fade-in .2s ease-out;
        }
        
        #fvp-wrapper { 
            width: 100%; height: 100%; position: relative;
            background: #000; display: flex; 
            align-items: center; justify-content: center; 
            overflow: hidden;
        }
        #fvp-wrapper video { 
            width: 100%!important; height: 100%!important; 
            max-width: none!important; max-height: none!important; 
            object-position: center!important; 
            position: absolute; top: 0; left: 0;
            transition: transform 0.3s ease;
            pointer-events: none;
        }

        /* Overlay Controls */
        .fvp-overlay {
            position: absolute; left: 0; width: 100%; padding: 0 12px;
            display: flex; align-items: center; box-sizing: border-box;
            opacity: 1; z-index: 20;
            pointer-events: none;
        }
        .fvp-overlay > * { pointer-events: auto; }

        #fvp-left-drag { 
            position: absolute; cursor: move; touch-action: none;
            top: 0; left: 0; bottom: 0; width: 40px; z-index: 19;
        }

        /* Left Panel - Vertical button stack */
        #fvp-left-panel {
            position: absolute; left: 2px; top: 50%; transform: translateY(-50%);
            z-index: 21; display: flex; flex-direction: column;
            align-items: center; gap: 1px;
            opacity: 0.4; transition: opacity .2s;
        }
        #fvp-left-panel:hover, #fvp-left-panel:active { opacity: 1; }
        #fvp-left-panel .fvp-btn { 
            min-width: 30px; min-height: 30px; font-size: 15px;
            background: rgba(58,58,58,0.4); border-radius: 6px;
        }
        #fvp-left-panel .fvp-separator {
            width: 20px; height: 1px; background: rgba(255,255,255,0.15); margin: 0;
        }
        #fvp-close:hover, #fvp-close:active { background: rgba(255,0,0,0.6) !important; }

        #fvp-ctrl {
            bottom: 0; height: 28px; padding: 2px 12px 4px;
            flex-direction: row; justify-content: center; gap: 0;
        }

        /* Resolution Popup */
        #fvp-res-popup {
            position: absolute; left: 38px; bottom: 50%;
            transform: translateY(50%);
            z-index: 22; display: none; flex-direction: column;
            background: rgba(20,20,20,0.95); backdrop-filter: blur(15px);
            border-radius: 8px; padding: 4px 0; min-width: 90px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        }
        .fvp-res-item {
            padding: 6px 12px; font-size: 12px; color: #ccc;
            cursor: pointer; white-space: nowrap;
            transition: background .15s;
        }
        .fvp-res-item:hover { background: rgba(255,255,255,0.1); }
        .fvp-res-item.active { color: #1da6f0; font-weight: 600; }

        /* Seek Bar */
        #fvp-seek-row { display: flex; align-items: center; gap: 6px; width: 100%; }
        #fvp-time-display {
            flex-shrink: 0; font-size: 10px; color: #1da6f0;
            font-weight: 500; white-space: nowrap; pointer-events: none;
            min-width: 70px;
        }
        #fvp-seek-container { position: relative; flex: 1; min-width: 0; padding: 14px 0; margin: -14px 0; }
        
        #fvp-seek-track {
            position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%);
            height: 10px; background: rgba(255,255,255,0.2); border-radius: 5px;
            overflow: hidden; pointer-events: none; z-index: 1;
        }
        #fvp-buffer {
            position: absolute; top: 0; left: 0; height: 100%; width: 0%;
            background: rgba(255,255,255,0.5); border-radius: 5px;
        }
        #fvp-seek {
            width: 100%; height: 20px; margin: 0; z-index: 2;
            position: relative; background: transparent;
            -webkit-appearance: none; cursor: pointer; touch-action: none;
            outline: none; border: none;
        }
        #fvp-seek::-webkit-slider-runnable-track { height: 10px; background: transparent; border-radius: 5px; }
        #fvp-seek::-webkit-slider-thumb {
            -webkit-appearance: none; width: 20px; height: 20px; margin-top: -5px;
            background: #1da6f0; border-radius: 50%; border: none;
            box-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }
        #fvp-seek:active::-webkit-slider-thumb { background: #0d8fd8; }

        /* Buttons */
        .fvp-btn {
            background: transparent; border: none; color: rgba(255,255,255,0.9);
            cursor: pointer; font-size: 18px; padding: 0;
            min-width: 32px; min-height: 32px;
            display: flex; align-items: center; justify-content: center;
            border-radius: 6px; flex-shrink: 0;
            transition: background .15s, transform .1s;
            touch-action: manipulation;
        }
        .fvp-btn:active, .fvp-btn:hover { 
            background: rgba(255,255,255,0.2); transform: scale(0.95); color: #fff; 
        }

        /* Resize Handles */
        .fvp-resize-handle { position: absolute; z-index: 100; touch-action: none; }
        .fvp-resize-br { bottom: 34px; right: 34px; width: 30px; height: 30px; cursor: se-resize; z-index: 101; }
        .fvp-resize-br::after {
            content: ''; position: absolute; bottom: 8px; right: 8px;
            width: 10px; height: 10px; pointer-events: none;
            border-bottom: 2px solid rgba(255,255,255,0.5); 
            border-right: 2px solid rgba(255,255,255,0.5);
            border-radius: 0 0 2px 0;
        }
        .fvp-resize-bl { bottom: 34px; left: 34px; width: 30px; height: 30px; cursor: sw-resize; z-index: 101; }
        .fvp-resize-bl::after {
            content: ''; position: absolute; bottom: 8px; left: 8px;
            width: 10px; height: 10px; pointer-events: none;
            border-bottom: 2px solid rgba(255,255,255,0.5); 
            border-left: 2px solid rgba(255,255,255,0.5);
            border-radius: 0 0 0 2px;
        }

        /* Placeholder */
        .fvp-ph { 
            background: #111; border-radius: 8px;
            display: flex; align-items: center; justify-content: center; opacity: 0.5; 
        }

        /* Fullscreen */
        #fvp-container:fullscreen {
            width: 100vw !important; height: 100vh !important;
            max-width: none !important; max-height: none !important;
            border-radius: 0 !important;
        }
        #fvp-container:fullscreen #fvp-wrapper { width: 100% !important; height: 100% !important; }

        /* Responsive */
        @media (max-width: 480px) {
            #fvp-ctrl { padding: 2px 6px 2px; height: 26px; }
            .fvp-btn { min-width: 28px; min-height: 28px; font-size: 16px; }
            #fvp-left-panel .fvp-btn { min-width: 26px; min-height: 26px; font-size: 13px; }
            #fvp-time-display { font-size: 9px; min-width: 60px; }
        }
        @media (max-width: 360px) {
            .fvp-btn { min-width: 26px; min-height: 26px; font-size: 14px; }
            #fvp-left-panel .fvp-btn { min-width: 24px; min-height: 24px; font-size: 12px; }
            #fvp-time-display { font-size: 8px; min-width: 55px; }
        }

        @keyframes fvp-fade-in { 
            from { opacity: 0; transform: scale(0.95); } 
            to { opacity: 1; transform: scale(1); } 
        }
    `;

    // ============================================
    // UTILITIES
    // ============================================
    const $ = id => document.getElementById(id);
    const el = (tag, cls, html) => Object.assign(document.createElement(tag), { className: cls || '', innerHTML: html || '' });
    const getCoord = e => { const t = e.touches?.[0] || e.changedTouches?.[0] || e; return { x: t.clientX, y: t.clientY }; };
    const formatTime = s => `${Math.floor(s / 60)}.${(Math.floor(s) % 60).toString().padStart(2, '0')}`;
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const onPointer = (el, fn, passive = false) => { el?.addEventListener('touchstart', fn, { passive }); el?.addEventListener('mousedown', fn); };

    // ============================================
    // PERSISTENCE (localStorage)
    // ============================================
    const STORAGE_KEY_LAYOUT = 'fvp-layout';
    const STORAGE_KEY_ICON = 'fvp-icon-pos';

    const saveLayout = () => {
        if (!box || box.style.display === 'none') return;
        try {
            localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify({
                top: box.style.top, left: box.style.left,
                width: box.style.width, height: box.style.height,
                borderRadius: box.style.borderRadius
            }));
        } catch (e) { }
    };

    const loadLayout = () => {
        try {
            const d = JSON.parse(localStorage.getItem(STORAGE_KEY_LAYOUT));
            if (d && d.width && d.height) return d;
        } catch (e) { }
        return null;
    };

    const saveIconPos = () => {
        if (!icon) return;
        try {
            localStorage.setItem(STORAGE_KEY_ICON, JSON.stringify({
                top: icon.style.top, left: icon.style.left
            }));
        } catch (e) { }
    };

    const loadIconPos = () => {
        try {
            const d = JSON.parse(localStorage.getItem(STORAGE_KEY_ICON));
            if (d && d.top && d.left) return d;
        } catch (e) { }
        return null;
    };

    // ============================================
    // STATE
    // ============================================
    let box, icon, menu, curVid, origPar, ph;
    let fitIdx = 0, zoomIdx = 0, rotationAngle = 0;

    const state = {
        isDrag: false, isResize: false, isIconDrag: false,
        startX: 0, startY: 0, initX: 0, initY: 0, initW: 0, initH: 0, resizeDir: '',
        idleTimer: null, rafId: null, isSeeking: false, origW: 0, origH: 0
    };

    // ============================================
    // UI FUNCTIONS
    // ============================================
    const updateVolUI = () => {
        if (!curVid) return;
        const v = curVid.muted ? 0 : curVid.volume;
        $('fvp-vol-btn').textContent = v === 0 ? '🔇' : v < 0.5 ? '🔉' : '🔊';
    };

    const updatePlayPauseUI = () => {
        if (curVid) $('fvp-play-pause').textContent = curVid.paused ? '▶' : '⏸';
    };

    const applyTransform = () => {
        if (!curVid) return;
        const zoom = ZOOM_LEVELS[zoomIdx];
        const transforms = [];
        if (rotationAngle) transforms.push(`rotate(${rotationAngle}deg)`);
        if (zoom !== 1) transforms.push(`scale(${zoom})`);
        curVid.style.transform = transforms.join(' ');
        curVid.style.objectFit = (rotationAngle === 90 || rotationAngle === 270) ? 'contain' : FIT_MODES[fitIdx];
    };

    const adjustForRotation = () => {
        if (!box || !curVid || document.fullscreenElement === box) return;
        if (!state.origW) { state.origW = box.offsetWidth; state.origH = box.offsetHeight; }

        if (rotationAngle === 90 || rotationAngle === 270) {
            box.style.width = `${Math.min(state.origH, innerWidth - 40)}px`;
            box.style.height = `${Math.min(state.origW, innerHeight - 100)}px`;
            const r = box.getBoundingClientRect();
            if (r.right > innerWidth) box.style.left = `${innerWidth - r.width - 10}px`;
            if (r.bottom > innerHeight) box.style.top = `${innerHeight - r.height - 10}px`;
        } else {
            box.style.width = `${state.origW}px`;
            box.style.height = `${state.origH}px`;
        }
    };

    const resetIdle = () => {
        if (!icon) return;
        icon.classList.remove('fvp-idle');
        clearTimeout(state.idleTimer);
        state.idleTimer = setTimeout(() => icon?.classList.add('fvp-idle'), IDLE_TIMEOUT);
    };

    // ============================================
    // VIDEO MANAGEMENT
    // ============================================
    const getVideos = () => Array.from(document.querySelectorAll('video, .fvp-ph')).reduce((arr, v) => {
        if (v.classList.contains('fvp-ph')) { if (curVid) arr.push(curVid); }
        else if (v !== curVid && !v.closest('#fvp-wrapper')) arr.push(v);
        return arr;
    }, []);

    const switchVid = dir => {
        const list = getVideos();
        if (!curVid || list.length < 2) return;
        const idx = list.indexOf(curVid);
        if (idx >= 0) float(list[(idx + dir + list.length) % list.length]);
    };

    const restore = () => {
        if (!curVid) return;
        cancelAnimationFrame(state.rafId);
        origPar?.replaceChild(curVid, ph);
        Object.assign(curVid.style, { width: '', height: '', objectFit: '', objectPosition: '', transform: '' });
        curVid.onloadedmetadata = curVid.onended = curVid.onplay = curVid.onpause = null;
        box.style.display = 'none';
        zoomIdx = 0; rotationAngle = 0; state.origW = state.origH = 0;
        curVid = null;
    };

    const float = v => {
        if (curVid && curVid !== v) restore();
        if (curVid === v) return;
        if (!box) init();

        origPar = v.parentNode;
        curVid = v;

        ph = el('div', 'fvp-ph', '<div style="font-size:20px;opacity:.5">📺</div>');
        ph.style.cssText = `width:${v.offsetWidth || 300}px;height:${v.offsetHeight || 200}px`;
        origPar?.replaceChild(ph, v);

        const wrapper = $('fvp-wrapper');
        wrapper.innerHTML = '';
        wrapper.appendChild(v);

        v.style.objectFit = FIT_MODES[fitIdx];
        zoomIdx = 0; rotationAngle = 0;
        applyTransform();

        // Reset UI
        $('fvp-zoom').textContent = ZOOM_ICONS[0];
        $('fvp-rotate').style.transform = '';
        updateVolUI();

        box.style.display = 'flex';
        menu.style.display = 'none';

        // Restore saved layout or use default
        const saved = loadLayout();
        if (saved) {
            box.style.width = saved.width;
            box.style.height = saved.height;
            box.style.top = saved.top;
            box.style.left = saved.left;
            box.style.borderRadius = saved.borderRadius || '12px';
        } else {
            const isPortrait = innerHeight > innerWidth;
            if (isPortrait) {
                box.style.width = `${innerWidth}px`;
                box.style.height = `${innerHeight}px`;
                box.style.top = '0px';
                box.style.left = '0px';
                box.style.borderRadius = '0';
            } else {
                const w = Math.floor(innerWidth * 0.5);
                const h = innerHeight - 40;
                box.style.width = `${w}px`;
                box.style.height = `${h}px`;
                box.style.top = '20px';
                box.style.left = `${Math.floor((innerWidth - w) / 2)}px`;
                box.style.borderRadius = '12px';
            }
        }

        // Seek bar update loop
        const updateTimeDisplay = () => {
            const cur = curVid.currentTime || 0;
            const dur = curVid.duration || 0;
            $('fvp-time-display').textContent = `${formatTime(cur)}/${formatTime(dur)}`;
        };
        const updateLoop = () => {
            if (!curVid) return;
            if (!state.isSeeking && curVid.duration && !isNaN(curVid.duration)) {
                $('fvp-seek').value = (curVid.currentTime / curVid.duration) * 10000;
                updateTimeDisplay();
            }
            if (curVid.buffered.length > 0 && curVid.duration) {
                $('fvp-buffer').style.width = `${(curVid.buffered.end(curVid.buffered.length - 1) / curVid.duration) * 100}%`;
            }
            state.rafId = requestAnimationFrame(updateLoop);
        };
        state.rafId = requestAnimationFrame(updateLoop);

        v.onloadedmetadata = () => {
            if (v.duration && !isNaN(v.duration)) updateTimeDisplay();
        };
        if (v.readyState >= 1 && v.duration) updateTimeDisplay();

        v.onplay = v.onpause = updatePlayPauseUI;
        v.onended = () => switchVid(1);
        v.play().catch(() => { });
        updatePlayPauseUI();
    };

    // ============================================
    // MENU
    // ============================================
    const toggleMenu = () => {
        resetIdle();
        const show = menu.style.display !== 'flex';
        menu.style.display = show ? 'flex' : 'none';
        if (show) {
            const r = icon.getBoundingClientRect();
            menu.style.left = `${clamp(r.left, 10, innerWidth - 290)}px`;
            menu.style.top = innerHeight - r.bottom < 300 ? 'auto' : `${r.bottom + 10}px`;
            menu.style.bottom = innerHeight - r.bottom < 300 ? `${innerHeight - r.top + 10}px` : 'auto';
            renderMenu();
        }
    };

    const renderMenu = () => {
        const list = getVideos();
        menu.innerHTML = `<div style="padding:10px 16px;font-size:12px;color:#888;font-weight:600">VIDEOS (${list.length})</div>`;

        if (!list.length) {
            const empty = el('div', 'fvp-menu-item', '<span>📹</span><span style="flex:1">No videos found</span>');
            empty.style.opacity = '0.5';
            menu.appendChild(empty);
            return;
        }

        list.forEach((v, i) => {
            const active = v === curVid;
            const item = el('div', `fvp-menu-item${active ? ' active' : ''}`,
                `<span>${active ? '▶' : '🎬'}</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Video ${i + 1}${active ? ' (Current)' : ''}</span>`);
            item.onclick = () => float(v);
            menu.appendChild(item);
        });
    };

    // ============================================
    // FULLSCREEN
    // ============================================
    const toggleFullscreen = () => {
        const fs = document.fullscreenElement || document.webkitFullscreenElement;
        if (!fs) (box.requestFullscreen || box.webkitRequestFullscreen || box.mozRequestFullScreen)?.call(box);
        else (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen)?.call(document);
    };

    // ============================================
    // EVENTS
    // ============================================
    const setupEvents = () => {
        // Icon Drag
        const startIconDrag = e => {
            e.preventDefault(); e.stopPropagation(); resetIdle();
            const c = getCoord(e), r = icon.getBoundingClientRect();
            state.isIconDrag = true;
            state.startX = c.x; state.startY = c.y;
            state.initX = r.left; state.initY = r.top;
        };
        onPointer(icon, startIconDrag);

        // Global Move/End
        const move = e => {
            if (!state.isDrag && !state.isResize && !state.isIconDrag) return;
            if (e.cancelable) e.preventDefault();
            const c = getCoord(e);
            const dx = c.x - state.startX, dy = c.y - state.startY;

            if (state.isIconDrag) {
                icon.style.left = `${clamp(state.initX + dx, 10, innerWidth - 58)}px`;
                icon.style.top = `${clamp(state.initY + dy, 10, innerHeight - 58)}px`;
                icon.style.bottom = icon.style.right = 'auto';
                resetIdle();
            } else if (state.isDrag) {
                // Allow dragging beyond edges, keep at least 60px visible
                const minVisible = 60;
                box.style.left = `${clamp(state.initX + dx, -box.offsetWidth + minVisible, innerWidth - minVisible)}px`;
                box.style.top = `${clamp(state.initY + dy, -box.offsetHeight + minVisible, innerHeight - minVisible)}px`;
            } else if (state.isResize) {
                if (state.resizeDir === 'bl') {
                    const newW = Math.max(200, state.initW - dx);
                    box.style.width = `${newW}px`;
                    box.style.left = `${state.initX + (state.initW - newW)}px`;
                    box.style.height = `${Math.max(120, state.initH + dy)}px`;
                } else {
                    box.style.width = `${Math.max(200, state.initW + dx)}px`;
                    box.style.height = `${Math.max(120, state.initH + dy)}px`;
                }
            }
        };

        const end = e => {
            const wasActive = state.isDrag || state.isResize || state.isIconDrag;
            if (wasActive && e.cancelable) e.preventDefault();
            if (state.isIconDrag) {
                if (Math.hypot(getCoord(e).x - state.startX, getCoord(e).y - state.startY) < 8) toggleMenu();
                else saveIconPos();
            }
            if (state.isDrag || state.isResize) saveLayout();
            state.isDrag = state.isResize = state.isIconDrag = false;
        };

        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', end);

        // Touch move/end for icon drag
        icon.addEventListener('touchmove', e => {
            if (state.isIconDrag && e.cancelable) e.preventDefault();
            move(e);
        }, { passive: false });
        icon.addEventListener('touchend', e => { end(e); }, { passive: false });

        // Player Drag
        const startDrag = e => {
            e.preventDefault(); e.stopPropagation();
            const c = getCoord(e);
            state.isDrag = true;
            state.startX = c.x; state.startY = c.y;
            state.initX = box.offsetLeft; state.initY = box.offsetTop;
        };
        onPointer($('fvp-left-drag'), startDrag);

        // Resize Handles
        box.querySelectorAll('.fvp-resize-handle').forEach(h => {
            const startResize = e => {
                e.preventDefault(); e.stopPropagation();
                const c = getCoord(e);
                state.isResize = true;
                state.resizeDir = h.className.includes('bl') ? 'bl' : 'br';
                state.startX = c.x; state.startY = c.y;
                state.initW = box.offsetWidth; state.initH = box.offsetHeight;
                state.initX = box.offsetLeft;
            };
            onPointer(h, startResize);
        });

        box.addEventListener('touchstart', e => {
            e.stopPropagation();
            if (!e.target.closest('input, button, .fvp-res-item')) e.preventDefault();
        }, { passive: false });
        // Capture-phase preventDefault blocks scrolling on Chrome Android (bubble-phase is ignored)
        box.addEventListener('touchmove', e => {
            e.preventDefault();
            e.stopPropagation();
            move(e);
        }, { capture: true, passive: false });
        box.addEventListener('touchend', e => {
            e.stopPropagation();
            end(e);
        }, { passive: false });

        // Button Handlers
        const btn = (id, fn) => $(id)?.addEventListener('click', e => { e.stopPropagation(); fn(); });
        btn('fvp-close', restore);
        btn('fvp-prev', () => switchVid(-1));
        btn('fvp-next', () => switchVid(1));
        btn('fvp-fit', () => {
            fitIdx = (fitIdx + 1) % FIT_MODES.length;
            if (curVid) curVid.style.objectFit = FIT_MODES[fitIdx];
            $('fvp-fit').textContent = FIT_ICONS[fitIdx];
        });
        btn('fvp-zoom', () => {
            if (!curVid) return;
            zoomIdx = (zoomIdx + 1) % ZOOM_LEVELS.length;
            applyTransform();
            $('fvp-zoom').textContent = ZOOM_ICONS[zoomIdx];
        });
        btn('fvp-rotate', () => {
            if (!curVid) return;
            rotationAngle = (rotationAngle + 90) % 360;
            applyTransform();
            adjustForRotation();
            $('fvp-rotate').style.transform = `rotate(${rotationAngle}deg)`;
        });
        btn('fvp-full', toggleFullscreen);
        btn('fvp-vol-btn', () => { if (curVid) { curVid.muted = !curVid.muted; updateVolUI(); } });
        btn('fvp-play-pause', () => {
            if (!curVid) return;
            curVid.paused ? curVid.play().catch(() => { }) : curVid.pause();
        });
        btn('fvp-res', () => toggleResPopup());

        // Seek Bar
        const seek = $('fvp-seek');
        const seekTo = val => {
            if (curVid?.duration) {
                curVid.currentTime = (val / 10000) * curVid.duration;
                const cur = curVid.currentTime || 0;
                const dur = curVid.duration || 0;
                $('fvp-time-display').textContent = `${formatTime(cur)}/${formatTime(dur)}`;
            }
        };
        seek?.addEventListener('input', e => { state.isSeeking = true; seekTo(e.target.value); });
        seek?.addEventListener('touchstart', e => {
            state.isSeeking = true;
            const rect = seek.getBoundingClientRect();
            const pos = clamp((e.touches[0].clientX - rect.left) / rect.width, 0, 1);
            seek.value = pos * 10000;
            seekTo(seek.value);
        }, { passive: true });
        seek?.addEventListener('change', () => { state.isSeeking = false; });
        seek?.addEventListener('touchend', () => { state.isSeeking = false; }, { passive: true });
    };

    // ============================================
    // RESOLUTION SELECTOR
    // ============================================
    const getQualityLevels = () => {
        const levels = [];
        try {
            // YouTube player API
            const ytPlayer = document.querySelector('#movie_player');
            if (ytPlayer?.getAvailableQualityLevels) {
                const ytLevels = ytPlayer.getAvailableQualityLevels();
                const ytLabels = { highres: '4K+', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p', hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p' };
                const curQ = ytPlayer.getPlaybackQuality?.() || '';
                ytLevels.forEach(q => {
                    if (q === 'auto') return;
                    levels.push({ label: ytLabels[q] || q, value: q, active: q === curQ, type: 'yt' });
                });
                if (levels.length) return levels;
            }
        } catch (e) { }
        try {
            // HLS.js - find instance attached to video
            if (curVid) {
                const hls = curVid._hls || curVid.hls || window.hls;
                if (hls?.levels?.length) {
                    hls.levels.forEach((lv, i) => {
                        const h = lv.height || lv.attrs?.RESOLUTION?.split('x')[1];
                        levels.push({ label: h ? `${h}p` : `Level ${i}`, value: i, active: hls.currentLevel === i || hls.loadLevel === i, type: 'hls' });
                    });
                    // Sort by height descending
                    levels.sort((a, b) => parseInt(b.label) - parseInt(a.label));
                    levels.unshift({ label: 'Auto', value: -1, active: hls.currentLevel === -1, type: 'hls' });
                    if (levels.length > 1) return levels;
                }
            }
        } catch (e) { }
        try {
            // Generic <source> elements
            if (curVid) {
                const sources = curVid.querySelectorAll('source');
                if (sources.length > 1) {
                    sources.forEach((src, i) => {
                        const label = src.getAttribute('label') || src.getAttribute('size') || src.getAttribute('data-quality') || `Source ${i + 1}`;
                        levels.push({ label, value: src.src, active: curVid.currentSrc === src.src, type: 'src' });
                    });
                }
            }
        } catch (e) { }
        return levels;
    };

    const setQuality = (item) => {
        try {
            if (item.type === 'yt') {
                const ytPlayer = document.querySelector('#movie_player');
                ytPlayer?.setPlaybackQualityRange?.(item.value, item.value);
                ytPlayer?.setPlaybackQuality?.(item.value);
            } else if (item.type === 'hls') {
                const hls = curVid?._hls || curVid?.hls || window.hls;
                if (hls) hls.currentLevel = item.value;
            } else if (item.type === 'src') {
                const t = curVid.currentTime;
                const playing = !curVid.paused;
                curVid.src = item.value;
                curVid.currentTime = t;
                if (playing) curVid.play().catch(() => { });
            }
        } catch (e) { }
        $('fvp-res-popup').style.display = 'none';
    };

    const toggleResPopup = () => {
        const popup = $('fvp-res-popup');
        if (!popup) return;
        const isShown = popup.style.display === 'flex';
        if (isShown) { popup.style.display = 'none'; return; }
        const levels = getQualityLevels();
        popup.innerHTML = '';
        if (!levels.length) {
            const noItem = el('div', 'fvp-res-item', 'N/A');
            noItem.style.opacity = '0.5';
            popup.appendChild(noItem);
        } else {
            levels.forEach(lv => {
                const item = el('div', `fvp-res-item${lv.active ? ' active' : ''}`, lv.label);
                item.onclick = e => { e.stopPropagation(); setQuality(lv); };
                popup.appendChild(item);
            });
        }
        popup.style.display = 'flex';
    };

    // ============================================
    // INITIALIZATION
    // ============================================
    const init = () => {
        document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));

        // Icon
        icon = el('div', 'fvp-idle', `
            <svg viewBox="0 0 24 24" style="width:24px;fill:#fff">
                <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
            </svg>
            <span id="fvp-badge" style="display:none">0</span>
        `);
        icon.id = 'fvp-master-icon';
        const savedIcon = loadIconPos();
        const iconTop = savedIcon ? savedIcon.top : `${(innerHeight - 48) / 2}px`;
        const iconLeft = savedIcon ? savedIcon.left : '12px';
        Object.assign(icon.style, { top: iconTop, left: iconLeft, display: document.querySelectorAll('video').length ? 'flex' : 'none' });
        document.body.appendChild(icon);

        // Menu
        menu = el('div');
        menu.id = 'fvp-menu';
        document.body.appendChild(menu);

        // Player Box
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <div id="fvp-left-drag"></div>
            <div id="fvp-left-panel">
                <button id="fvp-vol-btn" class="fvp-btn" title="Mute/Unmute">🔊</button>
                <button id="fvp-res" class="fvp-btn" title="Quality" style="font-size:11px;font-weight:700">HD</button>
                <div id="fvp-res-popup"></div>
                <button id="fvp-rotate" class="fvp-btn" title="Rotate 90°">↻</button>
                <button id="fvp-zoom" class="fvp-btn" title="Zoom video">+</button>
                <button id="fvp-fit" class="fvp-btn" title="Fit mode">⤢</button>
                <button id="fvp-full" class="fvp-btn" title="Fullscreen">⛶</button>
                <button id="fvp-close" class="fvp-btn" title="Close">✕</button>
                <button id="fvp-play-pause" class="fvp-btn" title="Play/Pause">▶</button>
                <button id="fvp-prev" class="fvp-btn" title="Previous">⏮</button>
                <button id="fvp-next" class="fvp-btn" title="Next">⏭</button>
            </div>
            <div class="fvp-resize-handle fvp-resize-br"></div>
            <div class="fvp-resize-handle fvp-resize-bl"></div>
            <div id="fvp-ctrl" class="fvp-overlay">
                <div id="fvp-seek-row">
                    <span id="fvp-time-display">0.00/0.00</span>
                    <div id="fvp-seek-container">
                        <div id="fvp-seek-track"><div id="fvp-buffer"></div></div>
                        <input type="range" id="fvp-seek" min="0" max="10000" step="1" value="0" title="Seek">
                    </div>
                </div>
            </div>
        `);
        box.id = 'fvp-container';
        box.style.display = 'none';
        document.body.appendChild(box);

        setupEvents();
        resetIdle();
    };

    // Video detection
    setInterval(() => {
        const list = getVideos().filter(v => {
            if (v === curVid) return true;
            const r = v.getBoundingClientRect();
            return r.width > 50 && r.height > 50;
        });
        if (icon) icon.style.display = list.length ? 'flex' : 'none';
        const badge = $('fvp-badge');
        if (badge) {
            badge.textContent = list.length;
            badge.style.display = list.length > 1 ? 'flex' : 'none';
        }
    }, VIDEO_CHECK_INTERVAL);

    // Start
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
