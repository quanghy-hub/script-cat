// ==UserScript==
// @name         Floating Video Player (Mobile Touch Optimized)
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Tối ưu hoàn toàn cho mobile - chạm vuốt mượt mà, không xung đột
// @author       Claude
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- CSS ---
    const css = `
        #fvp-master-icon{position:fixed;bottom:20px;left:20px;z-index:2147483646;width:56px;height:56px;background:rgba(20,20,20,0.85);backdrop-filter:blur(8px);border:2px solid rgba(255,255,255,0.15);border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.4);transition:transform .2s;touch-action:manipulation}
        #fvp-master-icon:active{transform:scale(0.9)}
        #fvp-badge{position:absolute;top:-4px;right:-4px;background:#ff4444;color:#fff;font-size:11px;font-weight:700;min-width:22px;height:22px;display:flex;align-items:center;justify-content:center;border-radius:50%;border:2px solid #000}
        
        #fvp-menu{position:fixed;bottom:90px;left:20px;z-index:2147483646;background:rgba(15,15,15,0.95);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.15);border-radius:16px;width:min(320px,calc(100vw - 40px));max-height:60vh;overflow-y:auto;display:none;flex-direction:column;padding:8px 0;color:#eee;box-shadow:0 10px 40px rgba(0,0,0,0.6)}
        .fvp-menu-item{padding:16px 20px;font-size:15px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.05);display:flex;gap:14px;align-items:center;transition:background .2s;touch-action:manipulation}
        .fvp-menu-item:active{background:rgba(255,255,255,0.1)}
        .fvp-menu-item.active{background:rgba(255,255,255,0.15);font-weight:600}
        
        /* Container */
        #fvp-container{
            position:fixed;top:60px;right:20px;width:min(340px,calc(100vw - 40px));height:200px;
            background:#000;box-shadow:0 10px 50px rgba(0,0,0,.8);z-index:2147483647;
            border-radius:16px;display:flex;align-items:center;justify-content:center;
            border:2px solid rgba(255,255,255,.12);
            min-width:240px;min-height:140px;max-width:calc(100vw - 20px);max-height:calc(100vh - 80px);
            touch-action:none;user-select:none;-webkit-user-select:none;
        }
        #fvp-wrapper{width:100%;height:100%;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;border-radius:14px;}
        #fvp-wrapper video{width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;object-position:center!important}
        
        /* Overlays - Tăng padding cho dễ chạm */
        .fvp-overlay{position:absolute;left:0;width:100%;padding:14px 16px;opacity:0;transition:opacity .3s;z-index:20;display:flex;align-items:center;box-sizing:border-box;pointer-events:none}
        .fvp-overlay>*{pointer-events:auto}
        #fvp-container.fvp-show-controls .fvp-overlay{opacity:1}
        
        #fvp-head{top:0;justify-content:space-between;background:linear-gradient(to bottom,rgba(0,0,0,.95),transparent);padding-top:16px;height:60px;border-radius:14px 14px 0 0}
        #fvp-head-drag{flex:1;cursor:move;padding:8px;margin:-8px;touch-action:none}
        
        #fvp-ctrl{bottom:0;background:linear-gradient(to top,rgba(0,0,0,.95),transparent);padding-top:50px;gap:12px;justify-content:space-between;padding-bottom:14px;flex-direction:column;border-radius:0 0 14px 14px}
        
        .fvp-row{display:flex;width:100%;align-items:center;gap:10px;padding:0 4px}
        .fvp-grp{display:flex;align-items:center;gap:10px;position:relative}
        
        /* Nút bấm - Tăng kích thước cho dễ chạm */
        .fvp-btn{background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:#fff;cursor:pointer;font-size:20px;min-width:44px;min-height:44px;padding:0;display:flex;align-items:center;justify-content:center;border-radius:10px;transition:all .2s;touch-action:manipulation}
        .fvp-btn:active{background:rgba(255,255,255,0.25);transform:scale(0.92)}
        
        /* Sliders */
        #fvp-seek{flex:1;height:8px;background:rgba(255,255,255,.25);border-radius:4px;-webkit-appearance:none;cursor:pointer;margin:0 4px}
        #fvp-seek::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;background:#fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer}
        
        .fvp-v-slider{-webkit-appearance:none;width:6px;height:110px;writing-mode:vertical-lr;direction:rtl;margin:6px 0;background:rgba(255,255,255,0.25);border-radius:3px}
        .fvp-v-slider::-webkit-slider-thumb{-webkit-appearance:none;width:20px;height:20px;background:#fff;border-radius:50%;cursor:pointer;margin-right:-7px;box-shadow:0 2px 6px rgba(0,0,0,.4)}
        
        /* Popup - Tối ưu mobile */
        .fvp-popup{display:none;position:absolute;bottom:56px;left:50%;transform:translateX(-50%);background:rgba(20,20,20,.98);backdrop-filter:blur(15px);border:1px solid rgba(255,255,255,.15);padding:16px 12px;border-radius:18px;flex-direction:column;align-items:center;box-shadow:0 12px 40px rgba(0,0,0,.7);min-width:80px}
        .fvp-popup.active{display:flex}
        .fvp-val{font-size:13px;font-weight:700;color:#fff;font-family:monospace;margin-bottom:8px}
        
        #fvp-time{color:rgba(255,255,255,.85);font-size:12px;font-family:monospace;min-width:65px;text-align:center;padding:4px 8px;background:rgba(0,0,0,0.3);border-radius:6px}
        .fvp-ph{background:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#666;border:1px solid #333;border-radius:12px;font-size:14px;padding:12px}

        /* Resize Handles - Tối ưu cho ngón tay */
        .fvp-resize-handle{position:absolute;z-index:100;touch-action:none;background:transparent}
        .fvp-resize-r{top:30px;right:-18px;bottom:30px;width:44px;cursor:e-resize}
        .fvp-resize-b{bottom:-18px;left:30px;right:30px;height:44px;cursor:s-resize}
        .fvp-resize-br{bottom:-18px;right:-18px;width:56px;height:56px;cursor:se-resize;z-index:101}
        
        /* Visual feedback cho resize corner */
        .fvp-resize-br::after{content:'';position:absolute;bottom:8px;right:8px;width:28px;height:28px;background:linear-gradient(135deg,transparent 40%,rgba(255,255,255,0.3) 40%,rgba(255,255,255,0.3) 45%,transparent 45%,transparent 55%,rgba(255,255,255,0.3) 55%,rgba(255,255,255,0.3) 60%,transparent 60%);border-radius:0 0 12px 0;pointer-events:none}

        /* Animation */
        @keyframes fvp-fade-in{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
        #fvp-container{animation:fvp-fade-in .3s ease-out}
        
        /* Scrollbar cho menu */
        #fvp-menu::-webkit-scrollbar{width:6px}
        #fvp-menu::-webkit-scrollbar-track{background:transparent}
        #fvp-menu::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.3);border-radius:3px}
    `;
    const style = document.createElement('style'); 
    style.textContent = css; 
    document.head.appendChild(style);

    // --- HELPERS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => { 
        const e = document.createElement(tag); 
        if(c) e.className=c; 
        if(html) e.innerHTML=html; 
        return e; 
    };
    
    let box, icon, menu, curVid, origPar, ph, videos = [], fitIdx = 0;
    const FIT = ['contain', 'cover', 'fill'], ICONS = ['⤢', '🔍', '↔'];
    
    // Touch state
    let touchState = {
        isDrag: false,
        isResize: false,
        startX: 0,
        startY: 0,
        initLeft: 0,
        initTop: 0,
        initW: 0,
        initH: 0,
        resizeDir: '',
        hideControlsTimer: null
    };

    const getTouch = (e) => {
        const t = e.touches?.[0] || e.changedTouches?.[0] || e;
        return { x: t.clientX, y: t.clientY };
    };

    // --- UI SETUP ---
    function init() {
        // Icon & Menu
        icon = el('div', '', `
            <svg viewBox="0 0 24 24" style="width:28px;fill:#fff">
                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/>
            </svg>
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

        // Player Container
        box = el('div', '', `
            <div id="fvp-wrapper"></div>
            
            <div class="fvp-resize-handle fvp-resize-r"></div>
            <div class="fvp-resize-handle fvp-resize-b"></div>
            <div class="fvp-resize-handle fvp-resize-br"></div>
            
            <div id="fvp-head" class="fvp-overlay">
                <div id="fvp-head-drag">
                    <span style="font-weight:600;font-size:14px">Floating Player</span>
                </div>
                <button id="fvp-close" class="fvp-btn" style="font-size:22px">✕</button>
            </div>
            
            <div id="fvp-ctrl" class="fvp-overlay">
                <div class="fvp-row">
                    <input type="range" id="fvp-seek" min="0" max="100" value="0">
                </div>
                <div class="fvp-row">
                    <div class="fvp-grp">
                        <button id="fvp-prev" class="fvp-btn">⏮</button>
                        <button id="fvp-play" class="fvp-btn">▶</button>
                        <button id="fvp-next" class="fvp-btn">⏭</button>
                    </div>
                    
                    <span id="fvp-time">0:00</span>
                    
                    <div class="fvp-grp">
                        <button id="fvp-fit" class="fvp-btn">⤢</button>
                        
                        <div class="fvp-grp" style="position:relative">
                            <button class="fvp-btn" id="fvp-spd-btn" style="font-size:12px;font-weight:700;min-width:52px">1x</button>
                            <div class="fvp-popup" id="fvp-spd-popup">
                                <span class="fvp-val" id="fvp-spd-val">1.0x</span>
                                <input type="range" class="fvp-v-slider" id="fvp-spd" min="0.25" max="3" step="0.25" value="1">
                            </div>
                        </div>
                        
                        <div class="fvp-grp" style="position:relative">
                            <button id="fvp-vol-btn" class="fvp-btn">🔊</button>
                            <div class="fvp-popup" id="fvp-vol-popup">
                                <span class="fvp-val" id="fvp-vol-val">100%</span>
                                <input type="range" class="fvp-v-slider" id="fvp-vol" min="0" max="1" step="0.05" value="1">
                            </div>
                        </div>
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
        // --- SHOW/HIDE CONTROLS ---
        const showControls = () => {
            box.classList.add('fvp-show-controls');
            clearTimeout(touchState.hideControlsTimer);
            touchState.hideControlsTimer = setTimeout(() => {
                if(!touchState.isDrag && !touchState.isResize) {
                    box.classList.remove('fvp-show-controls');
                }
            }, 3000);
        };

        box.addEventListener('click', (e) => {
            if(e.target === box || e.target.id === 'fvp-wrapper') {
                box.classList.toggle('fvp-show-controls');
            }
        });

        // --- DRAG ---
        const dragArea = $('fvp-head-drag');
        dragArea.addEventListener('touchstart', (e) => {
            const t = getTouch(e);
            touchState.isDrag = true;
            touchState.startX = t.x;
            touchState.startY = t.y;
            touchState.initLeft = box.offsetLeft;
            touchState.initTop = box.offsetTop;
            showControls();
            e.stopPropagation();
        }, {passive: true});

        // --- RESIZE ---
        box.querySelectorAll('.fvp-resize-handle').forEach(handle => {
            handle.addEventListener('touchstart', (e) => {
                const t = getTouch(e);
                touchState.isResize = true;
                touchState.resizeDir = handle.className.includes('br') ? 'br' : 
                                       handle.className.includes('b') ? 'b' : 'r';
                touchState.startX = t.x;
                touchState.startY = t.y;
                touchState.initW = box.offsetWidth;
                touchState.initH = box.offsetHeight;
                showControls();
                e.stopPropagation();
            }, {passive: true});
        });

        // --- GLOBAL MOVE ---
        document.addEventListener('touchmove', (e) => {
            if(!touchState.isDrag && !touchState.isResize) return;
            
            const t = getTouch(e);
            const dx = t.x - touchState.startX;
            const dy = t.y - touchState.startY;

            if(touchState.isDrag) {
                let newLeft = touchState.initLeft + dx;
                let newTop = touchState.initTop + dy;
                
                // Giới hạn trong viewport
                newLeft = Math.max(10, Math.min(newLeft, window.innerWidth - box.offsetWidth - 10));
                newTop = Math.max(10, Math.min(newTop, window.innerHeight - box.offsetHeight - 10));
                
                box.style.left = newLeft + 'px';
                box.style.top = newTop + 'px';
                box.style.right = 'auto';
                box.style.bottom = 'auto';
            }

            if(touchState.isResize) {
                const dir = touchState.resizeDir;
                
                if(dir.includes('r') || dir === 'br') {
                    const newW = Math.max(240, Math.min(touchState.initW + dx, window.innerWidth - 20));
                    box.style.width = newW + 'px';
                }
                
                if(dir.includes('b') || dir === 'br') {
                    const newH = Math.max(140, Math.min(touchState.initH + dy, window.innerHeight - 80));
                    box.style.height = newH + 'px';
                }
            }
        }, {passive: true});

        document.addEventListener('touchend', () => {
            touchState.isDrag = false;
            touchState.isResize = false;
        }, {passive: true});

        // --- BUTTON HANDLERS ---
        const btn = (id, fn) => {
            const el = $(id);
            if(!el) return;
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                fn();
                showControls();
            });
        };

        btn('fvp-close', restore);
        btn('fvp-play', () => {
            if(!curVid) return;
            curVid.paused ? curVid.play() : curVid.pause();
        });

        btn('fvp-prev', () => switchVid(-1));
        btn('fvp-next', () => switchVid(1));

        btn('fvp-fit', () => {
            fitIdx = (fitIdx + 1) % 3;
            if(curVid) curVid.style.objectFit = FIT[fitIdx];
            $('fvp-fit').textContent = ICONS[fitIdx];
        });

        // Seek
        $('fvp-seek').addEventListener('input', (e) => {
            if(curVid && !isNaN(curVid.duration)) {
                curVid.currentTime = (e.target.value / 100) * curVid.duration;
            }
        });

        // Speed popup toggle
        btn('fvp-spd-btn', () => {
            $('fvp-spd-popup').classList.toggle('active');
            $('fvp-vol-popup').classList.remove('active');
        });

        $('fvp-spd').addEventListener('input', (e) => {
            if(!curVid) return;
            const rate = parseFloat(e.target.value);
            curVid.playbackRate = rate;
            $('fvp-spd-btn').textContent = rate + 'x';
            $('fvp-spd-val').textContent = rate.toFixed(2) + 'x';
        });

        // Volume popup toggle
        btn('fvp-vol-btn', () => {
            $('fvp-vol-popup').classList.toggle('active');
            $('fvp-spd-popup').classList.remove('active');
        });

        $('fvp-vol').addEventListener('input', (e) => {
            if(!curVid) return;
            curVid.volume = e.target.value;
            curVid.muted = false;
            updateVolIcon();
        });

        $('fvp-vol-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            if(curVid) {
                curVid.muted = !curVid.muted;
                if(!curVid.muted && curVid.volume === 0) {
                    curVid.volume = 0.5;
                    $('fvp-vol').value = 0.5;
                }
                updateVolIcon();
            }
        });
    }

    function updateVolIcon() {
        if(!curVid) return;
        const vol = curVid.muted ? 0 : curVid.volume;
        $('fvp-vol-btn').textContent = vol === 0 ? '🔇' : (vol < 0.5 ? '🔉' : '🔊');
        $('fvp-vol-val').textContent = Math.round(vol * 100) + '%';
        if(!curVid.muted) $('fvp-vol').value = vol;
    }

    function switchVid(dir) {
        if(!curVid || videos.length <= 1) return;
        const idx = videos.indexOf(curVid);
        if(idx === -1) return;
        const nextIdx = (idx + dir + videos.length) % videos.length;
        float(videos[nextIdx]);
    }

    function restore() {
        if(!curVid) return;
        origPar.replaceChild(curVid, ph);
        Object.assign(curVid.style, {width:'', height:'', objectFit:'', objectPosition:''});
        box.style.display = 'none';
        box.classList.remove('fvp-show-controls');
        curVid.ontimeupdate = null;
        curVid = null;
    }

    function float(v) {
        if(curVid && curVid !== v) restore();
        if(curVid === v) return;
        if(!box) init();
        
        origPar = v.parentNode;
        curVid = v;
        
        ph = el('div', 'fvp-ph', `<div style="font-size:28px;opacity:.5">📺</div><div style="margin-top:8px;font-size:12px">Floating Player Active</div>`);
        ph.style.width = (v.offsetWidth || 300) + 'px';
        ph.style.height = (v.offsetHeight || 200) + 'px';
        origPar.replaceChild(ph, v);
        
        $('fvp-wrapper').innerHTML = '';
        $('fvp-wrapper').appendChild(v);
        v.style.objectFit = FIT[fitIdx];
        v.style.objectPosition = 'center';
        
        // Set controls
        $('fvp-vol').value = v.volume;
        $('fvp-spd').value = v.playbackRate || 1;
        $('fvp-spd-btn').textContent = (v.playbackRate || 1) + 'x';
        $('fvp-spd-val').textContent = (v.playbackRate || 1).toFixed(2) + 'x';
        updateVolIcon();
        
        box.style.display = 'flex';
        box.classList.add('fvp-show-controls');
        v.play();
        menu.style.display = 'none';
        
        // Update time
        v.ontimeupdate = () => {
            $('fvp-play').textContent = v.paused ? '▶' : '⏸';
            if(!isNaN(v.duration)) {
                $('fvp-seek').value = (v.currentTime / v.duration) * 100;
                const s = Math.floor(v.currentTime);
                const m = Math.floor(s / 60);
                const ss = s % 60;
                $('fvp-time').textContent = `${m}:${ss < 10 ? '0' + ss : ss}`;
            }
        };
    }

    function renderMenu() {
        menu.innerHTML = `<div style="padding:14px 20px;font-size:13px;color:#999;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.05)">VIDEOS (${videos.length})</div>`;
        videos.forEach((v, i) => {
            const isActive = v === curVid;
            const item = el('div', `fvp-menu-item ${isActive ? 'active' : ''}`, `
                <span style="font-size:20px">${isActive ? '▶' : '🎬'}</span>
                <span style="flex:1">Video ${i + 1}</span>
                ${isActive ? '<span style="font-size:11px;color:#4CAF50">●</span>' : ''}
            `);
            item.addEventListener('click', () => float(v));
            menu.appendChild(item);
        });
    }

    // --- VIDEO DETECTION ---
    setInterval(() => {
        videos = Array.from(document.querySelectorAll('video')).filter(v => {
            const rect = v.getBoundingClientRect();
            return rect.width > 50 || v === curVid;
        });
        if(icon) {
            $('fvp-badge').textContent = videos.length;
            $('fvp-badge').style.display = videos.length ? 'flex' : 'none';
        }
    }, 2000);

    init();
})();
