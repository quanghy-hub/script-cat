// ==UserScript==
// @name         Floating Video Player (Native PiP + Remote Control)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Sử dụng Picture-in-Picture gốc của Android. Tách video ra khỏi trình duyệt. Hỗ trợ Playlist & MediaSession.
// @author       Gemini
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CSS (Remote Control UI) ---
    const css = `
        /* Master Icon */
        #fvp-master-icon {
            position: fixed; bottom: 20px; left: 20px; z-index: 2147483647;
            width: 48px; height: 48px;
            background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
            border: 1px solid rgba(255,255,255,0.2); border-radius: 50%;
            color: #fff; display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.2s;
        }
        #fvp-master-icon:active { transform: scale(0.9); background: #333; }
        #fvp-badge {
            position: absolute; top: -2px; right: -2px;
            background: #ff4757; color: #fff;
            font-size: 10px; font-weight: bold;
            min-width: 18px; height: 18px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
        }

        /* Menu List */
        #fvp-menu {
            position: fixed; bottom: 80px; left: 20px; z-index: 2147483647;
            background: rgba(15,15,15,0.95); backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1); border-radius: 12px;
            width: 260px; max-height: 50vh; overflow-y: auto;
            display: none; flex-direction: column; color: #eee;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .fvp-menu-item {
            padding: 12px 16px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
            display: flex; align-items: center; gap: 10px;
        }
        .fvp-menu-item:active { background: rgba(255,255,255,0.1); }
        .fvp-menu-item.active { color: #4caf50; font-weight: bold; background: rgba(76, 175, 80, 0.1); }

        /* REMOTE CONTROL (Floating Pill) */
        #fvp-remote {
            position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
            z-index: 2147483646;
            background: rgba(10,10,10,0.9); backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 50px;
            padding: 8px 20px;
            display: none; align-items: center; gap: 15px;
            box-shadow: 0 5px 20px rgba(0,0,0,0.5);
            transition: opacity 0.3s;
        }
        .fvp-btn {
            background: none; border: none; color: #fff;
            font-size: 20px; padding: 5px; width: 32px; height: 32px;
            display: flex; align-items: center; justify-content: center;
        }
        .fvp-btn:active { transform: scale(0.9); color: #4caf50; }
        
        /* Speed Popup */
        .fvp-grp { position: relative; display: flex; align-items: center; }
        .fvp-speed-popup {
            position: absolute; bottom: 45px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.9); border-radius: 8px; border: 1px solid #333;
            display: none; flex-direction: column; padding: 5px;
            min-width: 50px; text-align: center;
        }
        .fvp-grp.active .fvp-speed-popup { display: flex; }
        .fvp-spd-opt { padding: 8px; font-size: 12px; color: #aaa; border-bottom: 1px solid #222; }
        .fvp-spd-opt:last-child { border: none; }
        .fvp-spd-opt.active { color: #4caf50; font-weight: bold; }
        
        #fvp-status { font-size: 12px; color: #4caf50; font-weight: bold; font-family: monospace; pointer-events: none; }
    `;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

    // --- 2. HELPERS ---
    const $ = (id) => document.getElementById(id);
    const el = (tag, c, html) => { const e = document.createElement(tag); if(c) e.className=c; if(html) e.innerHTML=html; return e; };
    const on = (el, evt, fn) => el.addEventListener(evt, fn);

    let icon, menu, remote, curVid, videos = [];
    const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

    // --- 3. UI SETUP ---
    function init() {
        // Master Icon
        icon = el('div', '', `<svg viewBox="0 0 24 24" style="width:24px;fill:#fff"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg><span id="fvp-badge">0</span>`);
        icon.id = 'fvp-master-icon'; document.body.appendChild(icon);

        // Menu
        menu = el('div'); menu.id = 'fvp-menu'; document.body.appendChild(menu);

        // Remote Control (Hiển thị khi đang PiP)
        remote = el('div', '', `
            <div id="fvp-status">PiP ACTIVE</div>
            <button id="fvp-prev" class="fvp-btn">⏮</button>
            <button id="fvp-play" class="fvp-btn">⏯</button>
            <button id="fvp-next" class="fvp-btn">⏭</button>
            
            <div class="fvp-grp" id="fvp-spd-grp">
                <button class="fvp-btn" id="fvp-spd-btn" style="font-size:12px;font-weight:700;width:auto;padding:0 5px">1x</button>
                <div class="fvp-speed-popup" id="fvp-spd-list"></div>
            </div>
            
            <button id="fvp-exit" class="fvp-btn" style="color:#ff4757">✕</button>
        `);
        remote.id = 'fvp-remote'; document.body.appendChild(remote);

        // --- EVENTS ---
        
        // Toggle Menu
        on(icon, 'click', (e) => { 
            e.stopPropagation(); 
            menu.style.display = menu.style.display==='flex'?'none':'flex'; 
            if(menu.style.display==='flex') renderMenu(); 
        });
        
        on(document, 'click', (e) => {
            if(!icon.contains(e.target) && !menu.contains(e.target)) menu.style.display='none';
            if(!remote.contains(e.target)) $('fvp-spd-grp').classList.remove('active');
        });

        // Remote Actions
        on($('fvp-play'), 'click', () => curVid && (curVid.paused ? curVid.play() : curVid.pause()));
        on($('fvp-exit'), 'click', () => document.exitPictureInPicture());
        on($('fvp-prev'), 'click', () => switchVid(-1));
        on($('fvp-next'), 'click', () => switchVid(1));
        
        // Speed Menu
        const spdList = $('fvp-spd-list');
        SPEEDS.forEach(s => {
            const opt = el('div', 'fvp-spd-opt', s + 'x');
            on(opt, 'click', (e) => {
                e.stopPropagation();
                if(curVid) {
                    curVid.playbackRate = s;
                    $('fvp-spd-btn').textContent = s + 'x';
                    $('fvp-spd-grp').classList.remove('active');
                    updateSpeedUI();
                }
            });
            spdList.appendChild(opt);
        });

        on($('fvp-spd-btn'), 'click', (e) => {
            e.stopPropagation();
            $('fvp-spd-grp').classList.toggle('active');
        });
    }

    // --- 4. CORE LOGIC (Native PiP) ---

    async function enterPiP(video) {
        if (!video) return;
        try {
            if (curVid !== video && document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            }
            curVid = video;
            await video.requestPictureInPicture();
            
            // UI Update
            remote.style.display = 'flex';
            menu.style.display = 'none';
            updateRemoteState();
            setupMediaSession();
            
            // Listen for PiP exit
            video.addEventListener('leavepictureinpicture', onPiPExit, {once: true});
            video.addEventListener('play', updateRemoteState);
            video.addEventListener('pause', updateRemoteState);
            
        } catch (err) {
            console.error('PiP Error:', err);
            alert('Không thể mở chế độ nổi (PiP). Có thể trình duyệt chặn hoặc video chưa sẵn sàng.');
        }
    }

    function onPiPExit() {
        remote.style.display = 'none';
        if(curVid) {
            curVid.removeEventListener('play', updateRemoteState);
            curVid.removeEventListener('pause', updateRemoteState);
        }
    }

    function updateRemoteState() {
        if(!curVid) return;
        $('fvp-play').textContent = curVid.paused ? '▶' : '⏸';
        $('fvp-spd-btn').textContent = curVid.playbackRate + 'x';
        updateSpeedUI();
    }
    
    function updateSpeedUI() {
        if(!curVid) return;
        Array.from($('fvp-spd-list').children).forEach(opt => {
            opt.className = 'fvp-spd-opt' + (parseFloat(opt.textContent) === curVid.playbackRate ? ' active' : '');
        });
    }

    // --- 5. PLAYLIST & MEDIASESSION ---
    
    function switchVid(dir) {
        if(!curVid || videos.length <= 1) return;
        let idx = videos.indexOf(curVid);
        if(idx === -1) return;
        let nextIdx = (idx + dir + videos.length) % videos.length;
        
        // Chuyển video: Cần load video mới và kích hoạt PiP lại
        const nextVid = videos[nextIdx];
        
        // Cuộn tới video đó trên trang (tuỳ chọn)
        nextVid.scrollIntoView({behavior: "smooth", block: "center"});
        
        // Play video mới
        nextVid.play().then(() => {
            // Android Chrome thường tự giữ PiP khi chuyển video trong cùng context, 
            // nhưng nếu mất, ta gọi lại.
            if (!document.pictureInPictureElement) {
                enterPiP(nextVid);
            } else {
                // Nếu đang PiP, chỉ cần cập nhật tham chiếu curVid
                // Lưu ý: Một số trình duyệt yêu cầu gọi lại requestPictureInPicture cho element mới
                enterPiP(nextVid); 
            }
        });
    }

    function setupMediaSession() {
        if ('mediaSession' in navigator) {
            const ms = navigator.mediaSession;
            const meta = new MediaMetadata({
                title: curVid.title || document.title || 'Floating Video',
                artist: 'Floating Player'
            });
            ms.metadata = meta;

            ms.setActionHandler('play', () => curVid.play());
            ms.setActionHandler('pause', () => curVid.pause());
            ms.setActionHandler('previoustrack', () => switchVid(-1));
            ms.setActionHandler('nexttrack', () => switchVid(1));
            ms.setActionHandler('seekbackward', () => curVid.currentTime -= 10);
            ms.setActionHandler('seekforward', () => curVid.currentTime += 10);
        }
    }

    // --- 6. SCANNER ---
    
    function getVideoName(v, i) {
        return (v.title || v.getAttribute('aria-label') || `Video #${i+1}`).substring(0, 30);
    }

    function renderMenu() {
        menu.innerHTML = `<div style="padding:10px;font-size:12px;color:#aaa;border-bottom:1px solid #333">FOUND ${videos.length} VIDEOS</div>`;
        videos.forEach((v, i) => {
            const item = el('div', `fvp-menu-item ${v===curVid?'active':''}`, `<span>${v===curVid?'▶':'🎬'}</span><span>${getVideoName(v, i)}</span>`);
            on(item, 'click', (e) => { 
                e.preventDefault(); e.stopPropagation(); 
                enterPiP(v); 
            });
            menu.appendChild(item);
        });
    }

    setInterval(() => {
        // Quét video: Lọc video quá nhỏ hoặc bị ẩn
        videos = Array.from(document.querySelectorAll('video')).filter(v => {
            const r = v.getBoundingClientRect();
            return (r.width > 50 && r.height > 50) && v.style.display !== 'none';
        });
        
        if(icon) {
            const count = videos.length;
            $('fvp-badge').textContent = count;
            $('fvp-badge').style.display = count ? 'flex' : 'none';
        }
    }, 2000);

    init();

})();
