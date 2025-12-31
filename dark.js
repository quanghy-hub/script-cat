// ==UserScript==
// @name         Dark
// @namespace    dark
// @version      2.3
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
    const def = { enabled: true, auto: true, siteExcludes: [], threshold: 128, brightness: 100, saturation: 100 };

    let cfg = { ...def };
    try { cfg = { ...def, ...JSON.parse(GM_getValue(KEY) || '{}') }; } catch (e) { }
    if (!Array.isArray(cfg.siteExcludes)) cfg.siteExcludes = [];

    const host = location.hostname;
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

    /* ================= DARK MODE ================= */
    const STYLE_ID = 'sdm-css';
    let styleEl = null, isActive = false;

    const getCSS = () => `
/* Smart Dark Mode v2.2 */
html.sdm-active {
    background: #1a1a1a !important;
    color-scheme: dark !important;
    scrollbar-color: #555 #222;
    filter: brightness(${cfg.brightness}%) saturate(${cfg.saturation}%) !important;
}

html.sdm-active body {
    background: #1a1a1a !important;
    color: #e0e0e0 !important;
}

/* Block elements - transparent để inherit từ body */
html.sdm-active div, html.sdm-active section, html.sdm-active article,
html.sdm-active main, html.sdm-active aside, html.sdm-active header,
html.sdm-active footer, html.sdm-active nav, html.sdm-active form,
html.sdm-active table, html.sdm-active thead, html.sdm-active tbody,
html.sdm-active tr, html.sdm-active td, html.sdm-active th,
html.sdm-active ul, html.sdm-active ol, html.sdm-active li,
html.sdm-active p, html.sdm-active blockquote, html.sdm-active pre,
html.sdm-active figure, html.sdm-active figcaption, html.sdm-active dl,
html.sdm-active dt, html.sdm-active dd, html.sdm-active fieldset {
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

html.sdm-active input::placeholder,
html.sdm-active textarea::placeholder {
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

/* Border & HR */
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

/* Panel exclude */
#sdm-panel, #sdm-panel * { all: revert !important; }
`;

    function enable() {
        if (isActive) return;
        isActive = true;

        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = STYLE_ID;
            styleEl.textContent = getCSS();
        }

        const t = document.head || document.documentElement;
        if (!styleEl.parentNode) t.insertBefore(styleEl, t.firstChild);
        styleEl.disabled = false;
        document.documentElement.classList.add('sdm-active');

        // Xử lý elements có màu sắc - chỉ 1 lần khi load
        if (document.body) {
            requestAnimationFrame(processColored);
        }
    }

    function disable() {
        isActive = false;
        document.documentElement.classList.remove('sdm-active');
        if (styleEl) styleEl.disabled = true;
    }

    function processColored() {
        document.body.querySelectorAll('*').forEach(el => {
            if (el.id === 'sdm-panel') return;
            const style = getComputedStyle(el);
            const bg = style.backgroundColor;
            const txt = style.color;
            const p = parseColor(bg);

            if (p && !isNeutral(bg)) {
                const bgB = getBrightness(bg), txtB = getBrightness(txt);
                // Điều chỉnh text cho contrast tốt
                if (bgB > 128 && txtB > 100) el.style.setProperty('color', '#1a1a1a', 'important');
                else if (bgB < 128 && txtB < 150) el.style.setProperty('color', '#e8e8e8', 'important');
                el.style.setProperty('background-color', bg, 'important');
            }
        });
    }

    /* ================= AUTO DETECT ================= */
    function isNativeDark() {
        if (!document.body) return false;
        const bg = getComputedStyle(document.body).backgroundColor;
        let bri = getBrightness(bg);
        if (bri === 255) {
            bri = getBrightness(getComputedStyle(document.documentElement).backgroundColor);
        }
        return bri < cfg.threshold;
    }

    function apply() {
        if (!isSiteEnabled()) return disable();
        cfg.auto ? (isNativeDark() ? disable() : enable()) : enable();
    }

    /* ================= INIT ================= */
    if (isSiteEnabled() && !cfg.auto) enable();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }

    /* ================= UI ================= */
    GM_registerMenuCommand('Cài đặt Smart Dark Mode', () => {
        if (document.getElementById('sdm-panel')) return;

        const p = document.createElement('div');
        p.id = 'sdm-panel';
        p.style.cssText = `
            all: initial;
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 2147483647 !important;
            background: rgba(20,20,20,0.95) !important;
            color: #fff !important;
            padding: 16px !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6) !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            width: 300px !important;
            font-size: 14px !important;
            backdrop-filter: blur(12px) !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
        `;

        const excluded = cfg.siteExcludes.includes(host);
        p.innerHTML = `
            <div style="all:initial;display:flex !important;justify-content:space-between !important;align-items:center !important;font-weight:700 !important;font-size:16px !important;padding-bottom:8px !important;border-bottom:1px solid #333 !important;font-family:system-ui !important;">
                <span style="all:initial;background:linear-gradient(135deg,#00bfff,#0079d3) !important;-webkit-background-clip:text !important;-webkit-text-fill-color:transparent !important;font-weight:700 !important;font-size:16px !important;font-family:system-ui !important;">Smart Dark v2.3</span>
                <label style="all:initial;display:flex !important;align-items:center !important;gap:6px !important;color:#fff !important;font-family:system-ui !important;font-size:13px !important;cursor:pointer !important;">
                    <input type="checkbox" id="sdm-en" ${cfg.enabled ? 'checked' : ''} style="all:initial;cursor:pointer !important;accent-color:#0079d3 !important;width:16px !important;height:16px !important;"> Bật
                </label>
            </div>
            <label style="all:initial;display:flex !important;justify-content:space-between !important;align-items:center !important;color:#fff !important;font-family:system-ui !important;font-size:14px !important;cursor:pointer !important;">
                <span style="all:initial;color:#fff !important;font-family:system-ui !important;">Bật cho <b style="all:initial;color:#00bfff !important;font-weight:700 !important;font-family:system-ui !important;">${host}</b></span>
                <input type="checkbox" id="sdm-site" ${!excluded ? 'checked' : ''} style="all:initial;cursor:pointer !important;accent-color:#0079d3 !important;width:16px !important;height:16px !important;">
            </label>
            <label style="all:initial;display:flex !important;justify-content:space-between !important;align-items:center !important;color:#fff !important;font-family:system-ui !important;font-size:14px !important;cursor:pointer !important;">
                <span style="all:initial;color:#fff !important;font-family:system-ui !important;">Tự động nhận diện</span>
                <input type="checkbox" id="sdm-auto" ${cfg.auto ? 'checked' : ''} style="all:initial;cursor:pointer !important;accent-color:#0079d3 !important;width:16px !important;height:16px !important;">
            </label>
            <div style="all:initial;display:flex !important;flex-direction:column !important;gap:8px !important;padding:10px !important;background:rgba(255,255,255,0.05) !important;border-radius:8px !important;">
                <div style="all:initial;display:flex !important;justify-content:space-between !important;color:#fff !important;font-family:system-ui !important;font-size:13px !important;">
                    <span style="all:initial;color:#aaa !important;font-family:system-ui !important;">Độ sáng</span>
                    <span id="sdm-bri-val" style="all:initial;color:#00bfff !important;font-family:system-ui !important;">${cfg.brightness}%</span>
                </div>
                <input type="range" id="sdm-bri" min="50" max="150" value="${cfg.brightness}" style="all:initial;width:100% !important;height:4px !important;cursor:pointer !important;accent-color:#0079d3 !important;">
                <div style="all:initial;display:flex !important;justify-content:space-between !important;color:#fff !important;font-family:system-ui !important;font-size:13px !important;margin-top:6px !important;">
                    <span style="all:initial;color:#aaa !important;font-family:system-ui !important;">Độ bão hòa</span>
                    <span id="sdm-sat-val" style="all:initial;color:#00bfff !important;font-family:system-ui !important;">${cfg.saturation}%</span>
                </div>
                <input type="range" id="sdm-sat" min="0" max="150" value="${cfg.saturation}" style="all:initial;width:100% !important;height:4px !important;cursor:pointer !important;accent-color:#0079d3 !important;">
            </div>
            <div style="all:initial;display:flex !important;gap:8px !important;margin-top:8px !important;">
                <button id="sdm-save" style="all:initial;flex:1 !important;padding:10px !important;background:#0079d3 !important;color:#fff !important;border:none !important;border-radius:6px !important;cursor:pointer !important;font-weight:600 !important;font-family:system-ui !important;font-size:14px !important;text-align:center !important;">Lưu</button>
                <button id="sdm-close" style="all:initial;flex:1 !important;padding:10px !important;background:#444 !important;color:#fff !important;border:none !important;border-radius:6px !important;cursor:pointer !important;font-weight:600 !important;font-family:system-ui !important;font-size:14px !important;text-align:center !important;">Đóng</button>
            </div>
        `;

        document.body.appendChild(p);

        // Slider events
        p.querySelector('#sdm-bri').oninput = e => p.querySelector('#sdm-bri-val').textContent = e.target.value + '%';
        p.querySelector('#sdm-sat').oninput = e => p.querySelector('#sdm-sat-val').textContent = e.target.value + '%';

        p.querySelector('#sdm-save').onclick = () => {
            cfg.enabled = p.querySelector('#sdm-en').checked;
            cfg.auto = p.querySelector('#sdm-auto').checked;
            cfg.brightness = +p.querySelector('#sdm-bri').value;
            cfg.saturation = +p.querySelector('#sdm-sat').value;
            const on = p.querySelector('#sdm-site').checked;
            cfg.siteExcludes = on ? cfg.siteExcludes.filter(h => h !== host) : [...new Set([...cfg.siteExcludes, host])];
            GM_setValue(KEY, JSON.stringify(cfg));
            location.reload();
        };
        p.querySelector('#sdm-close').onclick = () => p.remove();
    });
})();
