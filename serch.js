// ==UserScript==
// @name         Search
// @namespace    search
// @version      2.3.0
// @description  Quick Search Bubble - Dual Bubble Edition
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_openInTab
// @grant        GM_download
// @license      MIT
// ==/UserScript==

(() => {
    'use strict';

    // === CONFIG ===
    const C = {
        KEY: 'qsb.providers.v5',
        OFF: 8, SZ: 28, IMG: 18, MAX: 6, ROW_TEXT: 4, ROW_IMG: 4,
        TOAST: 1200, SEL: 300, HOVER: 120, HIDE: 220, LONG: 450
    };

    const DEF = [
        { name: 'Google', url: 'https://www.google.com/search?q={{q}}', icon: 'https://www.google.com/favicon.ico' },
        { name: 'YouTube', url: 'https://www.youtube.com/results?search_query={{q}}', icon: 'https://www.youtube.com/favicon.ico' },
        { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={{q}}', icon: 'https://duckduckgo.com/favicon.ico' },
        { name: 'Bing', url: 'https://www.bing.com/search?q={{q}}', icon: 'https://www.bing.com/favicon.ico' },
        { name: 'Ảnh Google', url: 'https://www.google.com/search?tbm=isch&q={{q}}', icon: 'https://www.google.com/favicon.ico' },
        { name: 'Perplexity', url: 'https://www.perplexity.ai/?q={{q}}', icon: 'https://www.google.com/s2/favicons?domain=perplexity.ai&sz=32' },
    ];

    // Image search providers (search by image URL)
    const IMG_SEARCH = [
        { name: 'Google Lens', url: 'https://lens.google.com/uploadbyurl?url={{img}}', icon: 'https://www.google.com/favicon.ico' },
        { name: 'Bing Visual', url: 'https://www.bing.com/images/search?view=detailv2&iss=sbi&form=SBIIDP&q=imgurl:{{img}}', icon: 'https://www.bing.com/favicon.ico' },
    ];

    // === STORAGE ===
    const get = k => { try { return JSON.parse(GM_getValue(k)); } catch { return null; } };
    const set = (k, v) => GM_setValue(k, JSON.stringify(v));
    const providers = () => { const a = get(C.KEY); return Array.isArray(a) && a.length ? a.slice(0, C.MAX) : DEF; };

    // === UTILS ===
    const enc = s => encodeURIComponent(String(s || '').trim().replace(/\s+/g, ' '));
    const esc = s => (s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

    const copy = async txt => {
        try { await navigator.clipboard.writeText(txt); return true; }
        catch { const t = Object.assign(document.createElement('textarea'), { value: txt, style: 'position:fixed;opacity:0' }); document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); return true; }
    };

    const selectAll = () => {
        const a = document.activeElement;
        if (a?.tagName === 'INPUT' || a?.tagName === 'TEXTAREA') { a.focus(); a.select(); return; }
        const s = getSelection(); s?.removeAllRanges(); const r = document.createRange(); r.selectNodeContents(document.body); s?.addRange(r);
    };

    const IMG_RE = /\.(png|jpe?g|webp|gif|bmp|svg|avif)$/i;
    const fname = u => { try { const n = new URL(u, location.href).pathname.split('/').pop()?.split('?')[0] || 'image'; return IMG_RE.test(n) ? n : n + '.jpg'; } catch { return 'image.jpg'; } };
    const getImg = t => !t?.tagName || t.closest?.('.qsb') ? null : t.tagName === 'IMG' ? t : t.closest?.('picture')?.querySelector('img');

    // === STYLES ===
    GM_addStyle(`
.qsb{position:absolute;z-index:2147483646;display:none;background:#1a1a1a;padding:1px;border-radius:8px;box-shadow:0 8px 25px rgba(0,0,0,.5)}
.qsb-g{display:grid;gap:1px}
.qsb-i{width:${C.SZ}px;height:${C.SZ}px;border-radius:5px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s}
.qsb-i:hover{background:rgba(255,255,255,.15)}
.qsb-i img{width:${C.IMG}px;height:${C.IMG}px;object-fit:contain}
.qsb-i .g{font:20px/1 system-ui;color:#eee}
.qsb-t{position:fixed;padding:6px 12px;background:#222;color:#fff;border-radius:6px;font:12px system-ui;z-index:2147483647;box-shadow:0 5px 15px rgba(0,0,0,.3)}
.qsb-m{position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;z-index:2147483647;font-family:system-ui}
.qsb-p{background:#181818;color:#eee;width:min(650px,94vw);border-radius:12px;padding:20px;box-shadow:0 15px 50px #000}
.qsb-p h3{margin:0 0 15px;font-size:16px;font-weight:600;color:#fff}
.qsb-gr{display:grid;grid-template-columns:1fr 2fr 2fr;gap:8px;margin-bottom:15px}
.qsb-h{font-size:11px;opacity:.6;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.qsb-gr input{background:#252525;border:none;color:#fff;padding:6px 10px;border-radius:4px;width:100%;font:13px system-ui}
.qsb-gr input:focus{background:#303030;outline:none}
.qsb-a{display:flex;justify-content:space-between;align-items:center;margin-top:15px}
.qsb-b{padding:8px 16px;border:none;border-radius:6px;background:#333;color:#eee;cursor:pointer}
.qsb-b.p{background:#238636;color:#fff}
.qsb-b:hover{filter:brightness(1.1)}
.qsb-n{font-size:11px;opacity:.5;max-width:300px}`);

    // === UI — DUAL BUBBLE SYSTEM ===
    let textBubble, textGrid, imgBubble, imgGrid;
    let textCtx = null, imgCtx = null, hoverImg, timers = {};
    let showTime = { text: 0, img: 0 };
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', e => { mouseX = e.pageX; mouseY = e.pageY; }, { passive: true });

    const toast = (msg, x, y) => {
        const el = Object.assign(document.createElement('div'), { className: 'qsb-t', textContent: msg });
        el.style.cssText = `left:${Math.min(x, innerWidth - 200)}px;top:${Math.max(6, y - 36)}px`;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), C.TOAST);
    };

    const createBubble = () => {
        const b = Object.assign(document.createElement('div'), { className: 'qsb' });
        const g = Object.assign(document.createElement('div'), { className: 'qsb-g' });
        b.append(g);
        document.body.appendChild(b);
        return { bubble: b, grid: g };
    };

    const hideText = () => { if (textBubble) textBubble.style.display = 'none'; textCtx = null; };
    const hideImg = () => { if (imgBubble) imgBubble.style.display = 'none'; imgCtx = null; };
    const hideAll = () => { hideText(); hideImg(); };

    const showBubble = (bubble, grid, itms, x, y, cols, type) => {
        grid.innerHTML = '';
        itms.forEach(it => {
            const b = Object.assign(document.createElement('div'), { className: 'qsb-i', title: it.t || '', innerHTML: it.h });
            b.onclick = e => { e.preventDefault(); e.stopPropagation(); it.f(); };
            grid.appendChild(b);
        });
        grid.style.gridTemplateColumns = `repeat(${cols},${C.SZ}px)`;
        bubble.style.display = 'block';
        showTime[type] = Date.now();
        const w = bubble.offsetWidth, h = bubble.offsetHeight;
        bubble.style.left = Math.max(6, Math.min(x, scrollX + innerWidth - w - 6)) + 'px';
        bubble.style.top = Math.max(6, Math.min(y, scrollY + innerHeight - h - 6)) + 'px';
    };

    const showText = (itms, x, y, cols) => {
        if (!textBubble) {
            const r = createBubble();
            textBubble = r.bubble; textGrid = r.grid;
        }
        showBubble(textBubble, textGrid, itms, x, y, cols, 'text');
    };

    const showImg = (itms, x, y, cols) => {
        if (!imgBubble) {
            const r = createBubble();
            imgBubble = r.bubble; imgGrid = r.grid;
            imgBubble.onmouseenter = () => clearTimeout(timers.hh);
            imgBubble.onmouseleave = () => {
                if (imgCtx && !hoverImg?.matches(':hover')) {
                    timers.hh = setTimeout(() => { if (!imgBubble?.matches(':hover')) hideImg(); }, C.HIDE);
                }
            };
        }
        showBubble(imgBubble, imgGrid, itms, x, y, cols, 'img');
    };

    const dl = (src, x, y) => {
        const fb = () => GM_openInTab(src, { active: true, insert: true });
        if (typeof GM_download === 'function') {
            try { GM_download({ url: src, name: fname(src), saveAs: false, onerror: fb, ontimeout: fb }); toast('Đang tải ảnh...', x, y); return; } catch { }
        }
        fb(); toast('Mở tab mới để lưu', x, y);
    };

    // === ACTIONS ===
    const open = (url, txt, img) => {
        const u = (url || '').replace('{{q}}', enc(txt || '')).replace('{{img}}', img ? encodeURIComponent(img) : '');
        if (u) GM_openInTab(u, { active: true, insert: true });
        hideAll();
    };

    const buildItems = c => {
        const ps = providers(), arr = [];
        if (c.type === 'text') {
            arr.push({ t: 'Copy', h: '<span class="g">⧉</span>', f: async () => { toast(await copy(c.text) ? 'Đã chép' : 'Lỗi', c.x, c.y); hideText(); } });
            arr.push({ t: 'Select All', h: '<span class="g">⤢</span>', f: () => { selectAll(); toast('Đã chọn hết', c.x, c.y); } });
            ps.forEach(p => arr.push({ t: p.name, h: p.icon ? `<img src="${p.icon}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'g',textContent:'${p.name[0] || '?'}'}))">` : '<span class="g">🔗</span>', f: () => open(p.url, c.text) }));
        } else if (c.type === 'image') {
            arr.push({ t: 'Tải ảnh', h: '<span class="g">⬇</span>', f: () => { dl(c.img, c.x, c.y); hideImg(); } });
            arr.push({ t: 'Copy URL', h: '<span class="g">⧉</span>', f: async () => { await copy(c.img); toast('Đã chép URL', c.x, c.y); hideImg(); } });
            IMG_SEARCH.forEach(p => arr.push({ t: p.name, h: p.icon ? `<img src="${p.icon}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'g',textContent:'${p.name[0] || '?'}'}))">` : '<span class="g">🔗</span>', f: () => open(p.url, null, c.img) }));
        }
        return arr;
    };

    // === SETTINGS ===
    const openSettings = () => {
        const ps = providers();
        const rows = Array.from({ length: C.MAX }).map((_, i) => {
            const p = ps[i] || {};
            return `<input value="${esc(p.name || '')}" placeholder="Tên ${i + 1}"><input value="${esc(p.url || '')}" placeholder="URL..."><input value="${esc(p.icon || '')}" placeholder="Icon...">`;
        }).join('');

        const m = Object.assign(document.createElement('div'), { className: 'qsb-m' });
        m.innerHTML = `<div class="qsb-p"><h3>Cấu hình Quick Search</h3><div class="qsb-gr" id="qg"><div class="qsb-h">Tên</div><div class="qsb-h">URL ({{q}})</div><div class="qsb-h">Icon</div>${rows}</div><div class="qsb-a"><div class="qsb-n">Mẹo: Dùng {{q}} cho từ khóa tìm kiếm</div><div style="display:flex;gap:10px"><button class="qsb-b" id="qr">Mặc định</button><button class="qsb-b p" id="qs">Lưu</button></div></div></div>`;
        m.onclick = e => e.target === m && m.remove();
        m.querySelector('#qr').onclick = () => { set(C.KEY, DEF); m.remove(); alert('Đã khôi phục!'); };
        m.querySelector('#qs').onclick = () => {
            const ins = m.querySelectorAll('#qg input'), np = [];
            for (let i = 0; i < ins.length; i += 3) if (ins[i].value.trim()) np.push({ name: ins[i].value.trim(), url: ins[i + 1].value.trim(), icon: ins[i + 2].value.trim() });
            set(C.KEY, np.slice(0, C.MAX));
            m.remove(); alert('Đã lưu!');
        };
        document.body.appendChild(m);
    };

    // === EVENTS ===

    // Text selection — show textBubble, persist while selection active
    document.addEventListener('selectionchange', () => {
        clearTimeout(timers.sel);
        timers.sel = setTimeout(() => {
            const s = getSelection(), t = String(s).trim(), a = document.activeElement;
            if (!t || a?.tagName === 'INPUT' || a?.tagName === 'TEXTAREA') {
                // Selection cleared — hide text bubble
                hideText();
                return;
            }
            if (textCtx?.text === t && textBubble?.style.display === 'block') return;
            const r = s.getRangeAt(0).getBoundingClientRect();
            if (r.width > 0) {
                const posX = mouseX || (r.left + scrollX);
                const posY = (mouseY || (r.bottom + scrollY)) + C.OFF;
                textCtx = { type: 'text', text: t, x: posX, y: posY };
                showText(buildItems(textCtx), textCtx.x, textCtx.y, C.ROW_TEXT);
            }
        }, C.SEL);
    });

    // Right-click image
    document.addEventListener('contextmenu', e => {
        const img = getImg(e.target);
        if (img?.src) {
            imgCtx = { type: 'image', img: img.src, x: e.pageX + 6, y: e.pageY + 6 };
            showImg(buildItems(imgCtx), imgCtx.x, imgCtx.y, C.ROW_IMG);
        }
    }, { capture: true });

    // Hover image — show imgBubble independently
    document.addEventListener('pointerenter', e => {
        if (e.pointerType !== 'mouse') return;
        const img = getImg(e.target); if (!img) return;
        hoverImg = img; clearTimeout(timers.hv); clearTimeout(timers.hh);
        timers.hv = setTimeout(() => {
            const src = img.currentSrc || img.src; if (!src) return;
            imgCtx = { type: 'image', img: src, x: e.pageX + 6, y: e.pageY + 6 };
            showImg(buildItems(imgCtx), imgCtx.x, imgCtx.y, C.ROW_IMG);
        }, C.HOVER);
    }, { capture: true });

    document.addEventListener('pointerleave', e => {
        if (e.pointerType !== 'mouse' || getImg(e.target) !== hoverImg) return;
        clearTimeout(timers.hv);
        timers.hh = setTimeout(() => { if (!imgBubble?.matches(':hover')) hideImg(); }, C.HIDE);
    }, { capture: true });

    // Long press image
    let lp = {}, lpT;
    document.addEventListener('pointerdown', e => {
        const img = getImg(e.target); if (!img) return;
        lp = { img, x: e.pageX, y: e.pageY };
        lpT = setTimeout(() => {
            const src = img.currentSrc || img.src;
            if (src) { imgCtx = { type: 'image', img: src, x: lp.x + 6, y: lp.y + 6 }; showImg(buildItems(imgCtx), imgCtx.x, imgCtx.y, C.ROW_IMG); }
        }, C.LONG);
    }, { passive: true });
    document.addEventListener('pointermove', e => { if (lpT && (Math.abs(e.pageX - lp.x) > 5 || Math.abs(e.pageY - lp.y) > 5)) { clearTimeout(lpT); lpT = null; } }, { passive: true });
    const cancelLp = () => { clearTimeout(lpT); lpT = null; };
    document.addEventListener('pointerup', cancelLp, { passive: true });
    document.addEventListener('pointercancel', cancelLp, { passive: true });

    // Dismiss — only hide bubble that was clicked outside of
    document.addEventListener('mousedown', e => {
        const now = Date.now();
        if (imgBubble && !imgBubble.contains(e.target) && now - showTime.img > 300) hideImg();
        if (textBubble && !textBubble.contains(e.target) && now - showTime.text > 300) {
            // Only hide text bubble if no selection remains after click
            setTimeout(() => { if (!String(getSelection()).trim()) hideText(); }, 50);
        }
    });
    document.addEventListener('scroll', () => {
        const now = Date.now();
        clearTimeout(timers.sc);
        timers.sc = setTimeout(() => {
            if (now - showTime.img > 400) hideImg();
            if (now - showTime.text > 400) hideText();
        }, 200);
    }, { capture: true, passive: true });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') hideAll(); });

    // Menu
    GM_registerMenuCommand('⚙️ Cấu hình Quick Search', openSettings);
})();
