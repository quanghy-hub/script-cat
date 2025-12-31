// ==UserScript==
// @name         Dark
// @namespace    dark
// @version      2.5
// @description  Smart Dark Mode - Chỉ CSS, giữ nguyên màu sắc.
// @author       You
// @match        http://*/*
// @match        https://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    /* ================= CONFIG ================= */
    const KEY = 'smart_dm_v7';
    const STYLE_ID = 'sdm-css';
    const host = location.hostname;

    const def = { enabled: true, auto: true, siteExcludes: [], brightness: 100, saturation: 100 };
    let cfg = { ...def, ...(() => { try { return JSON.parse(GM_getValue(KEY) || '{}'); } catch { return {}; } })() };
    if (!Array.isArray(cfg.siteExcludes)) cfg.siteExcludes = [];

    const isSiteEnabled = () => cfg.enabled && !cfg.siteExcludes.includes(host);

    /* ================= COLOR UTILS ================= */
    const parseColor = c => {
        if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return null;
        const m = c.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        return m ? { r: +m[1], g: +m[2], b: +m[3] } : null;
    };

    const getBrightness = c => {
        const p = parseColor(c);
        return p ? (p.r * 299 + p.g * 587 + p.b * 114) / 1000 : 255;
    };

    const isNeutral = c => {
        const p = parseColor(c);
        if (!p) return false;
        const max = Math.max(p.r, p.g, p.b), min = Math.min(p.r, p.g, p.b);
        return max === min || (max - min) / (max + min) * 200 < 15;
    };

    /* ================= CSS ================= */
    const DARK_CSS = `
/* Smart Dark Mode v2.5 */
html.sdm-active {
    background: #1a1a1a !important;
    color-scheme: dark !important;
    scrollbar-color: #555 #222;
    filter: brightness(var(--sdm-bri, 100%)) saturate(var(--sdm-sat, 100%)) !important;
}
html.sdm-active body {
    background: #1a1a1a !important;
    color: #e0e0e0 !important;
}

/* Block elements - transparent để inherit */
html.sdm-active div, html.sdm-active section, html.sdm-active article,
html.sdm-active main, html.sdm-active aside, html.sdm-active header,
html.sdm-active footer, html.sdm-active nav, html.sdm-active form,
html.sdm-active table, html.sdm-active thead, html.sdm-active tbody,
html.sdm-active tr, html.sdm-active td, html.sdm-active th,
html.sdm-active ul, html.sdm-active ol, html.sdm-active li,
html.sdm-active p, html.sdm-active blockquote, html.sdm-active pre,
html.sdm-active figure, html.sdm-active figcaption,
html.sdm-active dl, html.sdm-active dt, html.sdm-active dd, html.sdm-active fieldset {
    background-color: transparent !important;
}

/* Text - màu sáng */
html.sdm-active h1, html.sdm-active h2, html.sdm-active h3,
html.sdm-active h4, html.sdm-active h5, html.sdm-active h6,
html.sdm-active p, html.sdm-active span, html.sdm-active div,
html.sdm-active li, html.sdm-active td, html.sdm-active th,
html.sdm-active label, html.sdm-active strong, html.sdm-active em,
html.sdm-active b, html.sdm-active i, html.sdm-active small,
html.sdm-active time, html.sdm-active cite, html.sdm-active blockquote {
    color: #e0e0e0 !important;
}

/* Links */
html.sdm-active a { color: #6db3f2 !important; }
html.sdm-active a:visited { color: #b794f6 !important; }

/* Form elements */
html.sdm-active input, html.sdm-active textarea, html.sdm-active select {
    background: #333 !important;
    color: #fff !important;
    border: 1px solid #555 !important;
}
html.sdm-active button, html.sdm-active [type="button"],
html.sdm-active [type="submit"], html.sdm-active [role="button"] {
    background: #444 !important;
    color: #fff !important;
    border: 1px solid #555 !important;
}
html.sdm-active input::placeholder, html.sdm-active textarea::placeholder {
    color: #999 !important;
    opacity: 1 !important;
}
html.sdm-active input:focus, html.sdm-active textarea:focus {
    outline: 2px solid #0079d3 !important;
}

/* Code */
html.sdm-active pre, html.sdm-active code {
    background: #2d2d2d !important;
    color: #e0e0e0 !important;
}

/* Border */
html.sdm-active hr { border-color: #444 !important; }
html.sdm-active div, html.sdm-active section, html.sdm-active article,
html.sdm-active table, html.sdm-active td, html.sdm-active th,
html.sdm-active input, html.sdm-active textarea, html.sdm-active select,
html.sdm-active button, html.sdm-active fieldset {
    border-color: #444 !important;
}

/* Scrollbar */
html.sdm-active ::-webkit-scrollbar { width: 10px; }
html.sdm-active ::-webkit-scrollbar-track { background: #1a1a1a; }
html.sdm-active ::-webkit-scrollbar-thumb { background: #444; border-radius: 5px; }

/* Selection */
html.sdm-active ::selection { background: #3a5f8a !important; color: #fff !important; }
`;

    const PANEL_CSS = `
#sdm-panel{all:initial;position:fixed;top:20px;right:20px;z-index:2147483647;background:rgba(20,20,20,.97);color:#fff;padding:16px;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.6);font:14px system-ui,-apple-system,sans-serif;width:300px;backdrop-filter:blur(12px);display:flex;flex-direction:column;gap:12px;border:1px solid rgba(255,255,255,.15)}
#sdm-panel *{all:revert;box-sizing:border-box;font-family:inherit}
#sdm-panel .sdm-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid #444;margin-bottom:4px}
#sdm-panel .sdm-title{background:linear-gradient(135deg,#00bfff,#0079d3);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;font-size:16px}
#sdm-panel .sdm-row{display:flex;justify-content:space-between;align-items:center;color:#fff;font-size:14px;padding:6px 0}
#sdm-panel .sdm-row label{display:flex;align-items:center;gap:8px;cursor:pointer}
#sdm-panel .sdm-highlight{color:#00bfff;font-weight:600}
#sdm-panel input[type="checkbox"]{width:18px;height:18px;cursor:pointer;accent-color:#0079d3}
#sdm-panel .sdm-sliders{background:rgba(255,255,255,.06);border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:10px}
#sdm-panel .sdm-slider-row{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#bbb}
#sdm-panel .sdm-slider-val{color:#00bfff;font-weight:500}
#sdm-panel input[type="range"]{width:100%;height:6px;cursor:pointer;accent-color:#0079d3;margin-top:4px}
#sdm-panel .sdm-buttons{display:flex;gap:10px;margin-top:8px}
#sdm-panel .sdm-btn{flex:1;padding:10px 16px;border:none;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;text-align:center;transition:opacity .2s}
#sdm-panel .sdm-btn:hover{opacity:.85}
#sdm-panel .sdm-btn-primary{background:#0079d3;color:#fff}
#sdm-panel .sdm-btn-secondary{background:#555;color:#fff}
`;

    /* ================= DARK MODE ================= */
    let styleEl = null, isActive = false;

    function enable() {
        if (isActive) return;
        isActive = true;

        const root = document.documentElement;
        root.style.setProperty('--sdm-bri', cfg.brightness + '%');
        root.style.setProperty('--sdm-sat', cfg.saturation + '%');

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            styleEl.textContent = DARK_CSS;
        }

        const target = document.head || root;
        if (!styleEl.parentNode) target.insertBefore(styleEl, target.firstChild);
        styleEl.disabled = false;
        root.classList.add('sdm-active');

        // Xử lý elements có màu sắc
        document.body && requestAnimationFrame(processColored);
    }

    function disable() {
        isActive = false;
        document.documentElement.classList.remove('sdm-active');
        if (styleEl) styleEl.disabled = true;
    }

    function processColored() {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
            acceptNode: n => n.id === 'sdm-panel' || n.closest('#sdm-panel') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
        });

        let el;
        while (el = walker.nextNode()) {
            const style = getComputedStyle(el);
            const bg = style.backgroundColor;
            if (!parseColor(bg) || isNeutral(bg)) continue;

            const bgB = getBrightness(bg), txtB = getBrightness(style.color);
            if (bgB > 128 && txtB > 100) el.style.setProperty('color', '#1a1a1a', 'important');
            else if (bgB < 128 && txtB < 150) el.style.setProperty('color', '#e8e8e8', 'important');
            el.style.setProperty('background-color', bg, 'important');
        }
    }

    /* ================= AUTO DETECT ================= */
    function isNativeDark() {
        if (!document.body) return false;
        let bri = getBrightness(getComputedStyle(document.body).backgroundColor);
        if (bri === 255) bri = getBrightness(getComputedStyle(document.documentElement).backgroundColor);
        return bri < 128;
    }

    function apply() {
        if (!isSiteEnabled()) return disable();
        cfg.auto ? (isNativeDark() ? disable() : enable()) : enable();
    }

    /* ================= INIT ================= */
    if (isSiteEnabled() && !cfg.auto) enable();
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', apply) : apply();

    /* ================= UI ================= */
    GM_registerMenuCommand('Cài đặt Smart Dark Mode', () => {
        if (document.getElementById('sdm-panel')) return;

        // Panel CSS
        if (!document.getElementById('sdm-panel-css')) {
            const css = document.createElement('style');
            css.id = 'sdm-panel-css';
            css.textContent = PANEL_CSS;
            document.head.appendChild(css);
        }

        const excluded = cfg.siteExcludes.includes(host);
        const p = document.createElement('div');
        p.id = 'sdm-panel';
        p.innerHTML = `
            <div class="sdm-header">
                <span class="sdm-title">Smart Dark v2.5</span>
                <label><input type="checkbox" id="sdm-en" ${cfg.enabled ? 'checked' : ''}> Bật</label>
            </div>
            <div class="sdm-row">
                <span>Bật cho <span class="sdm-highlight">${host}</span></span>
                <input type="checkbox" id="sdm-site" ${!excluded ? 'checked' : ''}>
            </div>
            <div class="sdm-row">
                <span>Tự động nhận diện</span>
                <input type="checkbox" id="sdm-auto" ${cfg.auto ? 'checked' : ''}>
            </div>
            <div class="sdm-sliders">
                <div class="sdm-slider-row"><span>Độ sáng</span><span class="sdm-slider-val" id="sdm-bri-val">${cfg.brightness}%</span></div>
                <input type="range" id="sdm-bri" min="50" max="150" value="${cfg.brightness}">
                <div class="sdm-slider-row"><span>Độ bão hòa</span><span class="sdm-slider-val" id="sdm-sat-val">${cfg.saturation}%</span></div>
                <input type="range" id="sdm-sat" min="0" max="150" value="${cfg.saturation}">
            </div>
            <div class="sdm-buttons">
                <button class="sdm-btn sdm-btn-primary" id="sdm-save">Lưu</button>
                <button class="sdm-btn sdm-btn-secondary" id="sdm-close">Đóng</button>
            </div>
        `;

        document.body.appendChild(p);

        // Events
        const $ = s => p.querySelector(s);
        $('#sdm-bri').oninput = e => $('#sdm-bri-val').textContent = e.target.value + '%';
        $('#sdm-sat').oninput = e => $('#sdm-sat-val').textContent = e.target.value + '%';

        $('#sdm-save').onclick = () => {
            cfg.enabled = $('#sdm-en').checked;
            cfg.auto = $('#sdm-auto').checked;
            cfg.brightness = +$('#sdm-bri').value;
            cfg.saturation = +$('#sdm-sat').value;
            const on = $('#sdm-site').checked;
            cfg.siteExcludes = on ? cfg.siteExcludes.filter(h => h !== host) : [...new Set([...cfg.siteExcludes, host])];
            GM_setValue(KEY, JSON.stringify(cfg));
            location.reload();
        };
        $('#sdm-close').onclick = () => p.remove();
    });
})();
