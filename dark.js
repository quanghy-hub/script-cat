// ==UserScript==
// @name         Smart Dark Mode
// @namespace    smart-dark-mode
// @version      1.3
// @description  Smart Dark Mode with per-site settings, auto-detection, and color preservation.
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

    /* ================= CẤU HÌNH (CONFIG) ================= */
    const KEY = 'smart_dm_cfg_v3'; // Bump version to clear old config or handle migration
    const def = {
        enabled: true,
        auto: true,        // Tự động nhận diện dark mode của web
        siteExcludes: [],  // Danh sách tên miền tắt dark mode
        threshold: 128,    // Ngưỡng phát hiện dark mode
        brightness: 100,   // %
        contrast: 100,     // %
        sepia: 0,          // %
        grayscale: 0,      // %
        excludeIcons: true // Giữ màu icon
    };

    // Merge config
    let saved = {};
    try { saved = JSON.parse(GM_getValue(KEY) || '{}'); } catch (e) { }

    let cfg = { ...def, ...saved };
    // Ensure array type for siteExcludes
    if (!Array.isArray(cfg.siteExcludes)) cfg.siteExcludes = [];

    const host = window.location.hostname;

    function saveCfg() {
        GM_setValue(KEY, JSON.stringify(cfg));
        refreshConfig();
    }

    function isSiteEnabled() {
        if (!cfg.enabled) return false;
        if (cfg.siteExcludes.includes(host)) return false;
        return true;
    }

    /* ================= CORE STYLES ================= */
    const styleEl = document.createElement('style');
    styleEl.id = 'smart-dm-core';

    // Filter "Smart Invert" chuẩn: Giữ Hue, Đảo Lightness
    // Thêm saturate(100%) để đảm bảo màu không bị nhạt nhòa nếu user muốn
    const getFilterFn = () => `invert(1) hue-rotate(180deg) brightness(${cfg.brightness}%) contrast(${cfg.contrast}%) sepia(${cfg.sepia}%) grayscale(${cfg.grayscale}%)`;

    const getExcludesCss = () => {
        // Revert filter để khôi phục màu gốc cho ảnh/video
        const revert = `invert(1) hue-rotate(180deg) brightness(100%) contrast(100%) sepia(0%) grayscale(0%)`;
        const sels = [
            'img', 'video', 'iframe', 'canvas', 'svg',
            '[style*="background-image"]',
            '.html5-video-player', '#player', '.jwplayer',
            '[role="img"]', '[aria-label*="image"]',
            'embed', 'object', 'ins'
        ];
        if (cfg.excludeIcons) {
            sels.push(
                'i', 'em[class*="icon"]', 'span[class*="icon"]',
                '[class*="icon"]', '[class*="Icon"]',
                '.fa', '.fas', '.fab', '.far', '.fi',
                '.material-icons', '.material-symbols-outlined',
                'button i', 'a i', 'button svg', 'a svg'
            );
        }
        return `${sels.join(', ')} { filter: ${revert} !important; }`;
    };

    function generateCSS() {
        return `
            html {
                background-color: #fefefe !important; /* Force nền trắng để invert thành đen */
                filter: ${getFilterFn()} !important;
                scrollbar-color: #444 #222;
                -webkit-font-smoothing: antialiased !important;
            }
            body {
                background-color: #fefefe !important;
                min-height: 100vh;
            }
            ${getExcludesCss()}
            /* Blend mode giúp background image hòa trộn tốt hơn thay vì chỉ invert màu */
            [style*="background-image"] { background-blend-mode: difference; }
        `;
    }

    // Hàm bật Dark Mode
    function enableDarkMode() {
        if (!styleEl.textContent) {
            styleEl.textContent = generateCSS();
        }
        if (!styleEl.parentNode) {
            (document.head || document.documentElement).appendChild(styleEl);
        }
        styleEl.disabled = false;
    }

    // Hàm tắt Dark Mode
    function disableDarkMode() {
        styleEl.disabled = true;
        // Hoặc xóa styleEl khỏi DOM nếu cần, nhưng disabled là đủ
    }

    // Apply on start Logic
    // Logic mới:
    // 1. Nếu Auto = False -> Bật ngay (như cũ).
    // 2. Nếu Auto = True -> Chưa bật vội -> Check -> Bật nếu Sáng.
    function run() {
        if (!isSiteEnabled()) return;

        if (!cfg.auto) {
            // Manual mode: Bật luôn để chống flash (Anti-flash)
            enableDarkMode();
        } else {
            // Auto mode: Check trước
            // Tuy nhiên, nếu check ngay lúc document-start thì body chưa có,
            // nên khả năng cao là chưa check được màu nền chính xác.
            // Ta sẽ đợi DOMContentLoaded hoặc check sớm nhất có thể.
            // Auto mode: Đợi DOM ready rồi mới check
            if (document.body) {
                checkAndApply();
            }
            // Nếu chưa có body, listener sẽ được add ở cuối file
        }
    }

    function refreshConfig() {
        // Cập nhật CSS text
        if (styleEl.textContent) {
            styleEl.textContent = generateCSS();
        }

        // Re-check logic bật/tắt
        if (isSiteEnabled()) {
            if (cfg.auto) {
                // Nếu auto đang bật, chạy lại check để quyết định
                checkAndApply();
            } else {
                // Auto tắt -> Ép bật luôn
                enableDarkMode();
            }
        } else {
            disableDarkMode();
        }
    }

    /* ================= INTELLIGENT CHECK ================= */
    function checkAndApply() {
        if (!isSiteEnabled() || !cfg.auto) return;

        // Lấy màu nền
        let isDark = false;
        try {
            const getBri = (c) => {
                // Parse màu
                const m = (c || '').match(/[\d\.]+/g);
                if (!m || m.length < 3) return 255; // Không parse được -> Default Sáng

                const r = parseFloat(m[0]);
                const g = parseFloat(m[1]);
                const b = parseFloat(m[2]);
                const a = m.length >= 4 ? parseFloat(m[3]) : 1;

                // Nếu trong suốt (alpha ~ 0) -> Coi như nền browser (thường là trắng)
                if (a < 0.1) return 255;

                // Tính độ sáng (Perceived brightness)
                return (r * 299 + g * 587 + b * 114) / 1000;
            };

            // Ưu tiên check body, fallback html
            let bg = 'rgba(0,0,0,0)';
            if (document.body) {
                bg = window.getComputedStyle(document.body).backgroundColor;
            }
            let bri = getBri(bg);

            // Nếu body transparent, check html
            if (bri === 255) {
                if (document.documentElement) {
                    const bgH = window.getComputedStyle(document.documentElement).backgroundColor;
                    // Nếu html cũng transparent thì thôi, bri vẫn là 255 -> Sáng
                    const briH = getBri(bgH);
                    // Nếu html có màu (khác 255 do transparent) thì lấy html.
                    // Logic: ban đầu 255. Nếu html < 255 (tức là có màu tối/màu rõ), lấy html.
                    // Nếu html cũng 255 (trắng hoặc trong suốt), thì vẫn là 255.
                    if (briH < 255) bri = briH;
                }
            }

            // Nếu độ sáng < threshold -> Web tối -> Không bật
            if (bri < cfg.threshold) isDark = true;
            console.log(`[SmartDM] Check: ${host}, Bri: ${bri}, NativeDark: ${isDark}`);
        } catch (e) {
            console.error(e);
        }

        if (isDark) {
            disableDarkMode();
        } else {
            enableDarkMode();
        }
    }

    // Chạy logic chính
    run();
    // Nếu Auto mode và DOM chưa ready, add listener để check sau
    if (cfg.auto && isSiteEnabled() && document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', checkAndApply, { once: true });
    }

    /* ================= SETTINGS UI ================= */
    function showPanel() {
        if (document.getElementById('sdm-panel')) return;

        const p = document.createElement('div');
        p.id = 'sdm-panel';
        p.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 2147483647;
            background: rgba(20, 20, 20, 0.95); color: #fff; padding: 16px; border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.6); font-family: system-ui, -apple-system, sans-serif;
            width: 300px; font-size: 14px; border: 1px solid rgba(255,255,255,0.08);
            backdrop-filter: blur(12px); display: flex; flex-direction: column; gap: 14px;
            opacity: 0; transform: translateY(-10px); transition: all 0.2s ease;
        `;

        requestAnimationFrame(() => { p.style.opacity = '1'; p.style.transform = 'none'; });

        const row = (lbl, key, min, max, unit = '') => `
            <div style="display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; color:#ddd; font-weight:500;">
                    <span>${lbl}</span>
                    <span id="sdm-v-${key}" style="color:#00bfff; font-variant-numeric: tabular-nums;">${cfg[key]}${unit}</span>
                </div>
                <input type="range" id="sdm-i-${key}" min="${min}" max="${max}" value="${cfg[key]}" 
                    style="width:100%; height:4px; border-radius:4px; appearance:none; background:#444; outline:none; cursor:pointer;">
            </div>
        `;

        const isExcluded = cfg.siteExcludes.includes(host);

        p.innerHTML = `
            <div style="font-weight:700; font-size:18px; margin-bottom:4px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;">
                <span style="background: linear-gradient(135deg, #00bfff, #0079d3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">Smart Dark</span>
                <div style="display:flex; align-items:center; gap:8px; font-size:14px;">
                    <span style="color:#ccc;">Tổng</span>
                    <input type="checkbox" id="sdm-en" ${cfg.enabled ? 'checked' : ''} style="cursor:pointer;">
                </div>
            </div>

            <!-- Site Settings -->
            <div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:8px; display:flex; flex-direction:column; gap:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Bật cho <b>${host}</b></span>
                    <input type="checkbox" id="sdm-site" ${!isExcluded ? 'checked' : ''}>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span>Tự động nhận diện</span>
                    <input type="checkbox" id="sdm-auto" ${cfg.auto ? 'checked' : ''}>
                </div>
            </div>

            ${row('Độ sáng (Brightness)', 'brightness', 50, 150, '%')}
            ${row('Độ tương phản (Contrast)', 'contrast', 50, 150, '%')}
            ${row('Sepia', 'sepia', 0, 100, '%')}
            ${row('Grayscale', 'grayscale', 0, 100, '%')}

            <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding-top:4px;">
                <span style="color:#ddd;">Giữ màu Icon/Ảnh</span>
                <input type="checkbox" id="sdm-icon" ${cfg.excludeIcons ? 'checked' : ''}>
            </label>

            <div style="display:flex; gap:10px; margin-top:12px;">
                <button id="sdm-save" style="flex:1; padding:10px; background:#0079d3; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; transition:background 0.2s;">Lưu</button>
                <button id="sdm-close" style="flex:1; padding:10px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer; font-weight:600; transition:background 0.2s;">Đóng</button>
            </div>
            
            <style>
                #sdm-panel input[type=checkbox] { accent-color: #0079d3; transform: scale(1.2); cursor: pointer; }
                #sdm-panel input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; background: #00bfff; border-radius: 50%; border: 2px solid #222; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transition: transform 0.1s; }
                #sdm-panel input[type=range]::-webkit-slider-thumb:hover { transform: scale(1.1); }
            </style>
        `;

        document.body.appendChild(p);

        const $ = id => p.querySelector(id);

        ['brightness', 'contrast', 'sepia', 'grayscale'].forEach(k => {
            $(`#sdm-i-${k}`).oninput = (e) => {
                $(`#sdm-v-${k}`).textContent = e.target.value + '%';
            };
        });

        $('#sdm-save').onclick = () => {
            cfg.enabled = $('#sdm-en').checked;
            cfg.auto = $('#sdm-auto').checked;
            cfg.excludeIcons = $('#sdm-icon').checked;

            cfg.brightness = parseInt($('#sdm-i-brightness').value);
            cfg.contrast = parseInt($('#sdm-i-contrast').value);
            cfg.sepia = parseInt($('#sdm-i-sepia').value);
            cfg.grayscale = parseInt($('#sdm-i-grayscale').value);

            // Handle Site Exclude
            const siteEnabled = $('#sdm-site').checked;
            if (siteEnabled) {
                // Ensure host is NOT in list
                cfg.siteExcludes = cfg.siteExcludes.filter(h => h !== host);
            } else {
                // Ensure host IS in list
                if (!cfg.siteExcludes.includes(host)) cfg.siteExcludes.push(host);
            }

            saveCfg();
            p.remove();
        };

        $('#sdm-save').onmouseover = () => $('#sdm-save').style.background = '#0062ab';
        $('#sdm-save').onmouseout = () => $('#sdm-save').style.background = '#0079d3';
        $('#sdm-close').onclick = () => { p.remove(); };
    }

    GM_registerMenuCommand('Cài đặt Smart Dark Mode', showPanel);

})();
