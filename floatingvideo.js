// ==UserScript==
// @name         Floating Video
// @namespace    http://tampermonkey.net/
// @version      4.3
// @description  Giao diện tinh gọn, trong suốt. Icon di chuyển được. Sửa lỗi thứ tự Next/Prev.
// @author       Claude
// @match        *://*/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- CSS ---
    const css = `
        /* Master Icon - Có thể di chuyển, tự làm mờ */
        #fvp-master-icon {
            position: fixed; z-index: 2147483646;
            width: 48px; height: 48px;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 50%; color: #fff;
            display: flex; align-items: center; justify-content: center;
            cursor: move; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: transform .2s, opacity .3s, background .2s;
            touch-action: none; /* Quan trọng để drag mượt */
            opacity: 1;
        }
        #fvp-master-icon.fvp-idle { opacity: 0.4; } /* Mờ đi khi không dùng */
        #fvp-master-icon:hover, #fvp-master-icon:active { opacity: 1; transform: scale(1.05); background: rgba(0,0,0,0.8); }
        
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
        #fvp-head-drag { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: move; touch-action: none; z-index: 1; }
        #fvp-left-drag { position: absolute; top: 40px; left: 0; bottom: 50px; width: 25px; z-index: 19; cursor: move; touch-action: none; background: transparent; }
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
            background: transparent; border: none; color: rgba(255,255,255,0.9);
            cursor: pointer; font-size: 18px; min-width: 36px; min-height: 36px;
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
            box-shadow: 0 1px 4px rgba(0,0,0,0.5); transition: transform .1s;
        }
        #fvp-seek:hover::-webkit-slider-thumb { transform: scale(1.2); }

        /* Vertical Sliders (Speed/Volume) - CÂN ĐỐI TUYỆT ĐỐI */
        .fvp-popup {
            display: none; position: absolute; bottom: 45px; left: 50%; transform: translateX(-50%);
            background: transparent; padding: 0;
            flex-direction: column; align-items: center; min-width: 30px;
        }
        .fvp-popup.active { display: flex; }
        .fvp-val { font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 2px; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
        
        .fvp-v-slider {
            -webkit-appearance: none;
            width: 20px; /* Rộng hơn để dễ thao tác */
            height: 100px;
            writing-mode: vertical-lr; direction: rtl; margin: 4px 0;
            background: transparent;
            cursor: pointer;
            /* Tạo đường kẻ track giả ở chính giữa */
            background-image: linear-gradient(to right, transparent 8px, rgba(255,255,255,0.4) 8px, rgba(255,255,255,0.4) 12px, transparent 12px);
            border-radius: 10px;
        }
        /* Thumb nằm chính giữa input width 20px */
        .fvp-v-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 16px; height: 16px;
            background: #fff; border-radius: 50%;
            margin-right: 2px; /* (20 - 16) / 2 = 2. Căn giữa chuẩn */
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

        /* Placeholder */
        .fvp-ph { background: #111; border: 1px dashed #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; opacity: 0.5; }

        @keyframes fvp-fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        #fvp-container { animation: fvp-fade-in .2s ease-out; }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    // --- UTILS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => {
        const e = document.createElement(tag);
        if(c) e.className=c;
        if(html) e.innerHTML=html;
        return e;
    };
    const getCoord = (e) => {
        const t = e.touches?.[0] || e.changedTouches?.[0] || e;
        return { x: t.clientX, y: t.clientY };
    };

    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0;
    const FIT = ['contain', 'cover', 'fill'], ICONS = ['⤢', '🔍', '↔'];

    // --- MAIN STATE ---
    let state = {
        isDrag: false, isResize: false, isIconDrag: false,
        startX: 0, startY: 0,
        initX: 0, initY: 0, initW: 0, initH: 0,
        resizeDir: '',
        hideControlsTimer: null,
        idleIconTimer: null
    };

    function init() {
        // --- ICON ---
        icon = el('div', 'fvp-idle', `
            <svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>
            <span id="fvp-badge">0</span>
        `);
        icon.id = 'fvp-master-icon';
        // Set vị trí ban đầu
        icon.style.bottom = '20px';
        icon.style.left = '20px';
        document.body.appendChild(icon);

        menu = el('div'); menu.id = 'fvp-menu'; document.body.appendChild(menu);

        // --- ICON INTERACTION ---
        const resetIdle = () => {
            icon.classList.remove('fvp-idle');
            clearTimeout(state.idleIconTimer);
            state.idleIconTimer = setTimeout(() => icon.classList.add('fvp-idle'), 3000);
        };

        // Icon Click (Chỉ mở menu nếu không drag)
        let isDraggingIcon = false;
        icon.addEventListener('click', (e) => {
            if(isDraggingIcon) return;
            e.stopPropagation();
            resetIdle();
            const isShow = menu.style.display === 'flex';
            menu.style.display = isShow ? 'none' : 'flex';
            // Cập nhật vị trí menu theo icon
            if(!isShow) {
                const rect = icon.getBoundingClientRect();
                menu.style.left = Math.min(rect.left, window.innerWidth - 290) + 'px';
                menu.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
                renderMenu();
            }
        });

        // Icon Drag Logic
        const startIconDrag = (e) => {
            e.preventDefault(); // Ngăn scroll
            e.stopPropagation();
            resetIdle();
            const c = getCoord(e);
            state.isIconDrag = true; isDraggingIcon = false;
            state.startX = c.x; state.startY = c.y;
            const rect = icon.getBoundingClientRect();
            state.initX = rect.left; state.initY = rect.top;
        };

        icon.addEventListener('touchstart', startIconDrag, {passive: false});
        icon.addEventListener('mousedown', startIconDrag);

        // --- PLAYER BOX ---
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            <div id="fvp-left-drag"></div>
            <div class="fvp-resize-handle fvp-resize-r"></div>
            <div class="fvp-resize-handle fvp-resize-b"></div>
            <div class="fvp-resize-handle fvp-resize-br"></div>

            <div id="fvp-head" class="fvp-overlay">
                <div id="fvp-head-drag"></div>
                <button id="fvp-close" class="fvp-btn">✕</button>
            </div>

            <div id="fvp-ctrl" class="fvp-overlay">
                 <div class="fvp-row" style="padding:0 4px"><input type="range" id="fvp-seek" min="0" max="100" value="0"></div>
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
        box.id = 'fvp-container'; box.style.display = 'none';
        document.body.appendChild(box);
        setupInteractions(resetIdle, () => isDraggingIcon = true);
        resetIdle();
    }

    function setupInteractions(resetIconIdle, setIconDragged) {
        const showControls = () => {
            box.classList.add('fvp-show-controls');
            clearTimeout(state.hideControlsTimer);
            state.hideControlsTimer = setTimeout(() => {
                if(!state.isDrag && !state.isResize && !box.querySelector('.fvp-popup.active')) {
                    box.classList.remove('fvp-show-controls');
                }
            }, 3000);
        };

        box.addEventListener('click', (e) => {
            if(!e.target.closest('.fvp-popup') && !e.target.closest('#fvp-spd-btn') && !e.target.closest('#fvp-vol-btn')) {
                 document.querySelectorAll('.fvp-popup').forEach(p => p.classList.remove('active'));
            }
            if(e.target === box || e.target.id === 'fvp-wrapper' || e.target.id === 'fvp-head-drag') {
                box.classList.toggle('fvp-show-controls');
            } else showControls();
        });

        // --- GLOBAL MOVE HANDLER ---
        const move = (e) => {
            if(!state.isDrag && !state.isResize && !state.isIconDrag) return;
            const c = getCoord(e);
            const dx = c.x - state.startX;
            const dy = c.y - state.startY;

            // Icon Drag
            if(state.isIconDrag) {
                if(Math.abs(dx) > 5 || Math.abs(dy) > 5) setIconDragged();
                let nx = state.initX + dx;
                let ny = state.initY + dy;
                nx = Math.max(10, Math.min(nx, window.innerWidth - 58));
                ny = Math.max(10, Math.min(ny, window.innerHeight - 58));
                icon.style.left = nx + 'px'; icon.style.top = ny + 'px';
                icon.style.bottom = 'auto'; icon.style.right = 'auto';
                resetIconIdle();
                return;
            }

            // Player Drag
            if(state.isDrag) {
                let nx = state.initX + dx;
                let ny = state.initY + dy;
                nx = Math.max(0, Math.min(nx, window.innerWidth - box.offsetWidth));
                ny = Math.max(0, Math.min(ny, window.innerHeight - box.offsetHeight));
                box.style.left = nx + 'px'; box.style.top = ny + 'px';
            }
            // Resize
            if(state.isResize) {
                if(state.resizeDir.includes('r') || state.resizeDir === 'br') box.style.width = Math.max(200, state.initW + dx) + 'px';
                if(state.resizeDir.includes('b') || state.resizeDir === 'br') box.style.height = Math.max(120, state.initH + dy) + 'px';
            }
        };

        const end = () => { state.isDrag = false; state.isResize = false; state.isIconDrag = false; };
        
        document.addEventListener('touchmove', move, {passive: false});
        document.addEventListener('mousemove', move);
        document.addEventListener('touchend', end, {passive: true});
        document.addEventListener('mouseup', end);

        // Player Drag Start
        const startDrag = (e) => {
            const c = getCoord(e);
            state.isDrag = true; state.startX = c.x; state.startY = c.y;
            state.initX = box.offsetLeft; state.initY = box.offsetTop;
            showControls(); e.preventDefault(); e.stopPropagation();
        };
        ['fvp-head-drag', 'fvp-left-drag'].forEach(id => {
            $(id).addEventListener('touchstart', startDrag, {passive: false});
            $(id).addEventListener('mousedown', startDrag);
        });

        // Resize Start
        box.querySelectorAll('.fvp-resize-handle').forEach(h => {
            const startResize = (e) => {
                const c = getCoord(e);
                state.isResize = true;
                state.resizeDir = h.className.includes('br') ? 'br' : h.className.includes('b') ? 'b' : 'r';
                state.startX = c.x; state.startY = c.y;
                state.initW = box.offsetWidth; state.initH = box.offsetHeight;
                showControls(); e.preventDefault(); e.stopPropagation();
            };
            h.addEventListener('touchstart', startResize, {passive: false});
            h.addEventListener('mousedown', startResize);
        });

        // Buttons
        const btn = (id, fn) => $(id).addEventListener('click', (e) => { e.stopPropagation(); fn(); showControls(); });
        btn('fvp-close', restore);
        btn('fvp-play', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        btn('fvp-prev', () => switchVid(-1));
        btn('fvp-next', () => switchVid(1));
        btn('fvp-fit', () => {
            fitIdx = (fitIdx + 1) % 3;
            if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = ICONS[fitIdx];
        });
        $('fvp-seek').addEventListener('input', (e) => curVid && curVid.duration && (curVid.currentTime = (e.target.value/100)*curVid.duration));

        const toggleP = (p, o) => { $(p).classList.toggle('active'); $(o).classList.remove('active'); };
        btn('fvp-spd-btn', () => toggleP('fvp-spd-popup', 'fvp-vol-popup'));
        btn('fvp-vol-btn', () => toggleP('fvp-vol-popup', 'fvp-spd-popup'));
        $('fvp-vol-btn').addEventListener('click', () => { if(curVid) { curVid.muted = !curVid.muted; updateVolIcon(); }});

        $('fvp-spd').addEventListener('input', (e) => { if(curVid) { curVid.playbackRate = parseFloat(e.target.value); $('fvp-spd-btn').textContent = $('fvp-spd-val').textContent = e.target.value + 'x'; }});
        $('fvp-vol').addEventListener('input', (e) => { if(curVid) { curVid.volume = e.target.value; curVid.muted = false; updateVolIcon(); }});
    }

    function updateVolIcon() {
        if(!curVid) return;
        const v = curVid.muted ? 0 : curVid.volume;
        $('fvp-vol-btn').textContent = v == 0 ? '🔇' : (v < 0.5 ? '🔉' : '🔊');
        $('fvp-vol-val').textContent = Math.round(v*100);
        if(!curVid.muted) $('fvp-vol').value = v;
    }

    // --- FIX LOGIC SWITCH VIDEO (QUAN TRỌNG) ---
    function getSortedVideos() {
        // Lấy tất cả video VÀ placeholder
        // Placeholder đại diện cho vị trí gốc của video đang float
        const all = Array.from(document.querySelectorAll('video, .fvp-ph'));
        const list = [];
        all.forEach(el => {
            // Nếu là placeholder, nghĩa là đây là vị trí của curVid
            if(el.classList.contains('fvp-ph')) {
                if(curVid) list.push(curVid);
            } 
            // Nếu là video thường (không phải cái đang float)
            else if(el !== curVid && !el.closest('#fvp-wrapper')) {
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
        const next = list[(idx + dir + list.length) % list.length];
        float(next);
    }

    function restore() {
        if(!curVid) return;
        origPar.replaceChild(curVid, ph);
        Object.assign(curVid.style, {width:'', height:'', objectFit:'', objectPosition:''});
        box.style.display = 'none'; box.classList.remove('fvp-show-controls');
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
        const list = getSortedVideos();
        menu.innerHTML = `<div style="padding:10px 16px;font-size:12px;color:#888;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05)">DANH SÁCH (${list.length})</div>`;
        list.forEach((v, i) => {
            const isActive = v === curVid;
            const item = el('div', `fvp-menu-item ${isActive ? 'active' : ''}`, `
                <span>${isActive ? '▶' : '🎬'}</span><span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Video ${i + 1}</span>
            `);
            item.addEventListener('click', () => float(v));
            menu.appendChild(item);
        });
    }

    setInterval(() => {
        // Chỉ đếm video thực sự có kích thước, tránh video ẩn/quảng cáo
        const list = getSortedVideos().filter(v => {
            if(v === curVid) return true;
            const r = v.getBoundingClientRect();
            return r.width > 50 && r.height > 50;
        });
        if(icon) {
            $('fvp-badge').textContent = list.length;
            $('fvp-badge').style.display = list.length ? 'flex' : 'none';
        }
    }, 2000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
