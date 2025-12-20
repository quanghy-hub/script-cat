// ==UserScript==
// @name         YouTube
// @namespace    yt-tools-merged
// @version      2.6.0
// @description  Screenshot & Bilingual Subtitles with Settings
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini|webp|webm)[^\/]*$/
// @exclude      /^https?://\S+_live_chat*$/
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      translate.googleapis.com
// @inject-into  page
// @allFrames    true
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    if (window.top !== window) return;

    // ===== CONFIGURATION =====
    const DEFAULT_SETTINGS = {
        targetLang: 'vi',
        fontSize: 16,
        originalColor: '#ffffff',
        translatedColor: '#ffeb3b',
        displayMode: 'compact', // 'compact' | 'full'
        showOriginal: true,
        autoTranslate: false
    };

    let settings = { ...DEFAULT_SETTINGS };

    // Load settings
    try {
        const saved = localStorage.getItem('yt-subtitle-settings');
        if (saved) settings = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
    } catch (e) { }

    const saveSettings = () => {
        localStorage.setItem('yt-subtitle-settings', JSON.stringify(settings));
        updateStyles();
    };

    // ===== SELECTORS =====
    const SEL = {
        controls: '.ytp-right-controls',
        mobileControls: '.player-controls-bottom, .btt-controls-top-buttons',
        screenshotBtn: '.ytp-screenshot-button',
        translateBtn: '.ytp-translate-button',
        settingsBtn: '.ytp-subtitle-settings-button',
        video: 'video',
        captionWindow: '.ytp-caption-window-container',
        captionSegment: '.ytp-caption-segment',
        settingsPanel: '#yt-subtitle-settings'
    };

    // ===== ICONS =====
    const ICONS = {
        camera: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
        translate: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3"/><path d="M22 22l-5-10-5 10M14 18h6"/></svg>`,
        translateActive: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
    };

    // ===== STATE =====
    const state = {
        translateEnabled: false,
        translationCache: new Map(),
        observer: null,
        processingQueue: new Set()
    };

    // ===== UTILITIES =====
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);
    const isMobile = () => /m\.youtube\.com|Android|iPhone|iPad/i.test(navigator.userAgent + location.host);
    const isWatchPage = () => /\/watch|[?&]v=/.test(location.href);

    // ===== STYLES =====
    function updateStyles() {
        let styleEl = $('#yt-tools-styles');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'yt-tools-styles';
            document.head.appendChild(styleEl);
        }

        const compactMode = settings.displayMode === 'compact';

        styleEl.textContent = `
      /* Button styles */
      .ytp-screenshot-button, .ytp-translate-button, .ytp-subtitle-settings-button {
        position: relative;
        width: ${isMobile() ? '40px' : '48px'};
        height: 100%;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        opacity: 0.9;
        transition: opacity 0.1s;
        padding: ${isMobile() ? '8px' : '0'};
      }
      .ytp-screenshot-button:hover, .ytp-translate-button:hover, .ytp-subtitle-settings-button:hover {
        opacity: 1;
      }
      .ytp-translate-button.active { opacity: 1; color: #ffeb3b; }
      .ytp-translate-button.active svg { fill: #ffeb3b; }

      /* Subtitle styles */
      .ytp-caption-segment {
        font-size: ${settings.fontSize}px !important;
        color: ${settings.originalColor} !important;
        ${compactMode && !settings.showOriginal ? 'display: none !important;' : ''}
      }
      .ytp-caption-segment[data-translated]::after {
        content: attr(data-translated);
        display: block;
        color: ${settings.translatedColor};
        font-size: ${compactMode ? settings.fontSize * 0.85 : settings.fontSize}px;
        margin-top: ${compactMode ? '2px' : '4px'};
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        line-height: 1.2;
      }
      ${compactMode ? `
        .ytp-caption-window-container { padding: 4px 8px !important; }
        .captions-text { line-height: 1.3 !important; }
      ` : ''}

      /* Settings panel */
      #yt-subtitle-settings {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(28, 28, 28, 0.95);
        border-radius: 12px;
        padding: 20px;
        z-index: 99999;
        min-width: 280px;
        color: #fff;
        font-family: 'Roboto', Arial, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        backdrop-filter: blur(10px);
      }
      #yt-subtitle-settings h3 {
        margin: 0 0 16px;
        font-size: 16px;
        font-weight: 500;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #yt-subtitle-settings .close-btn {
        background: none;
        border: none;
        color: #aaa;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
      }
      #yt-subtitle-settings .close-btn:hover { color: #fff; }
      #yt-subtitle-settings .setting-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        font-size: 14px;
      }
      #yt-subtitle-settings label { color: #aaa; }
      #yt-subtitle-settings input[type="range"] {
        width: 100px;
        accent-color: #ff0000;
      }
      #yt-subtitle-settings input[type="color"] {
        width: 40px;
        height: 28px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }
      #yt-subtitle-settings select {
        background: #333;
        color: #fff;
        border: 1px solid #555;
        border-radius: 4px;
        padding: 4px 8px;
      }
      #yt-subtitle-settings .toggle {
        position: relative;
        width: 40px;
        height: 20px;
        background: #555;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s;
      }
      #yt-subtitle-settings .toggle.active { background: #ff0000; }
      #yt-subtitle-settings .toggle::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        background: #fff;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: left 0.2s;
      }
      #yt-subtitle-settings .toggle.active::after { left: 22px; }

      /* Mobile fixes */
      @media (max-width: 768px), (pointer: coarse) {
        .ytp-screenshot-button, .ytp-translate-button, .ytp-subtitle-settings-button {
          width: 36px !important;
          min-width: 36px !important;
        }
        .ytp-screenshot-button svg, .ytp-translate-button svg, .ytp-subtitle-settings-button svg {
          width: 20px !important;
          height: 20px !important;
        }
      }
    `;
    }

    // ===== SETTINGS PANEL =====
    function createSettingsPanel() {
        if ($(SEL.settingsPanel)) return;

        const panel = document.createElement('div');
        panel.id = 'yt-subtitle-settings';
        panel.innerHTML = `
      <h3>
        Cài đặt phụ đề
        <button class="close-btn">×</button>
      </h3>
      <div class="setting-row">
        <label>Cỡ chữ</label>
        <div><input type="range" id="s-fontsize" min="12" max="32" value="${settings.fontSize}"> <span id="s-fontsize-val">${settings.fontSize}px</span></div>
      </div>
      <div class="setting-row">
        <label>Màu gốc</label>
        <input type="color" id="s-orig-color" value="${settings.originalColor}">
      </div>
      <div class="setting-row">
        <label>Màu dịch</label>
        <input type="color" id="s-trans-color" value="${settings.translatedColor}">
      </div>
      <div class="setting-row">
        <label>Chế độ</label>
        <select id="s-mode">
          <option value="compact" ${settings.displayMode === 'compact' ? 'selected' : ''}>Gọn</option>
          <option value="full" ${settings.displayMode === 'full' ? 'selected' : ''}>Đầy đủ</option>
        </select>
      </div>
      <div class="setting-row">
        <label>Hiện gốc</label>
        <div class="toggle ${settings.showOriginal ? 'active' : ''}" id="s-show-orig"></div>
      </div>
    `;

        document.body.appendChild(panel);

        // Event handlers
        panel.querySelector('.close-btn').onclick = () => panel.remove();
        panel.querySelector('#s-fontsize').oninput = (e) => {
            settings.fontSize = parseInt(e.target.value);
            panel.querySelector('#s-fontsize-val').textContent = settings.fontSize + 'px';
            saveSettings();
        };
        panel.querySelector('#s-orig-color').oninput = (e) => {
            settings.originalColor = e.target.value;
            saveSettings();
        };
        panel.querySelector('#s-trans-color').oninput = (e) => {
            settings.translatedColor = e.target.value;
            saveSettings();
        };
        panel.querySelector('#s-mode').onchange = (e) => {
            settings.displayMode = e.target.value;
            saveSettings();
        };
        panel.querySelector('#s-show-orig').onclick = (e) => {
            settings.showOriginal = !settings.showOriginal;
            e.target.classList.toggle('active', settings.showOriginal);
            saveSettings();
        };

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function handler(e) {
                if (!panel.contains(e.target) && !e.target.closest('.ytp-subtitle-settings-button')) {
                    panel.remove();
                    document.removeEventListener('click', handler);
                }
            });
        }, 100);
    }

    // ===== TRANSLATION API =====
    async function translateText(text) {
        if (!text?.trim()) return '';

        const cacheKey = text.trim();
        if (state.translationCache.has(cacheKey)) {
            return state.translationCache.get(cacheKey);
        }

        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${settings.targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            const data = await response.json();

            let translated = '';
            if (data?.[0]) {
                translated = data[0].map(item => item[0]).join('');
            }

            // Cache with size limit
            if (state.translationCache.size >= 500) {
                const firstKey = state.translationCache.keys().next().value;
                state.translationCache.delete(firstKey);
            }
            state.translationCache.set(cacheKey, translated);

            return translated;
        } catch (e) {
            console.error('[YT] Translation error:', e);
            return '';
        }
    }

    // ===== SUBTITLE PROCESSING =====
    async function processSubtitle(segment) {
        const text = segment.textContent.trim();
        if (!text || segment.dataset.processed === text) return;
        if (state.processingQueue.has(text)) return;

        state.processingQueue.add(text);
        try {
            const translated = await translateText(text);
            if (translated && translated !== text) {
                segment.dataset.translated = translated;
                segment.dataset.processed = text;
            }
        } finally {
            state.processingQueue.delete(text);
        }
    }

    let processTimeout = null;
    function debouncedProcess() {
        if (processTimeout) clearTimeout(processTimeout);
        processTimeout = setTimeout(() => {
            if (!state.translateEnabled) return;
            $$(SEL.captionSegment).forEach(processSubtitle);
        }, 100);
    }

    // ===== OBSERVER =====
    function startObserver() {
        if (state.observer) return;
        state.observer = new MutationObserver(() => {
            if (state.translateEnabled) debouncedProcess();
        });
        const target = $(SEL.captionWindow) || document.body;
        state.observer.observe(target, { childList: true, subtree: true, characterData: true });
    }

    function stopObserver() {
        state.observer?.disconnect();
        state.observer = null;
    }

    // ===== TOGGLE =====
    function toggleTranslation() {
        state.translateEnabled = !state.translateEnabled;

        const btn = $(SEL.translateBtn);
        if (btn) {
            btn.classList.toggle('active', state.translateEnabled);
            btn.innerHTML = state.translateEnabled ? ICONS.translateActive : ICONS.translate;
            btn.title = state.translateEnabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
        }

        if (state.translateEnabled) {
            startObserver();
            debouncedProcess();
        } else {
            stopObserver();
            $$(SEL.captionSegment).forEach(seg => {
                delete seg.dataset.translated;
                delete seg.dataset.processed;
            });
        }
    }

    // ===== SCREENSHOT =====
    function captureScreenshot() {
        const video = $(SEL.video);
        if (!video) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

        const filename = (document.title.replace(/\s-\sYouTube$/, '').trim() || 'screenshot') + '.png';
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename;
        link.click();
    }

    // ===== BUTTON CREATION =====
    function createButton(className, title, icon, onClick) {
        const btn = document.createElement('button');
        btn.className = `ytp-button ${className}`;
        btn.title = title;
        btn.innerHTML = icon;
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onClick();
        });
        return btn;
    }

    function addButtons() {
        // Desktop controls
        const controls = $(SEL.controls);
        if (controls) {
            if (!$(SEL.settingsBtn)) {
                controls.insertBefore(createButton('ytp-subtitle-settings-button', 'Cài đặt phụ đề', ICONS.settings, createSettingsPanel), controls.firstChild);
            }
            if (!$(SEL.translateBtn)) {
                controls.insertBefore(createButton('ytp-translate-button', 'Dịch phụ đề (T)', ICONS.translate, toggleTranslation), controls.firstChild);
            }
            if (!$(SEL.screenshotBtn)) {
                controls.insertBefore(createButton('ytp-screenshot-button', 'Chụp màn hình (S)', ICONS.camera, captureScreenshot), controls.firstChild);
            }
        }

        // Mobile controls - try multiple selectors
        if (isMobile()) {
            const mobileTargets = [
                '.player-controls-bottom',
                '.btt-controls-top-buttons',
                '.player-controls-top',
                'ytm-player-controls-overlay'
            ];

            for (const sel of mobileTargets) {
                const mobileControls = $(sel);
                if (mobileControls && !mobileControls.querySelector(SEL.translateBtn)) {
                    const translateBtn = createButton('ytp-translate-button', 'Dịch', ICONS.translate, toggleTranslation);
                    translateBtn.style.cssText = 'width:36px;height:36px;padding:6px;';
                    mobileControls.appendChild(translateBtn);
                    break;
                }
            }
        }
    }

    // ===== FULLSCREEN =====
    function handleFullscreen() {
        const isFS = document.fullscreenElement || document.webkitFullscreenElement;
        [$(SEL.screenshotBtn), $(SEL.translateBtn), $(SEL.settingsBtn)].forEach(btn => {
            if (btn) btn.style.bottom = isFS ? '2px' : '0';
        });
    }

    // ===== INIT =====
    function init() {
        if (!isWatchPage()) return;
        updateStyles();
        addButtons();
        if (state.translateEnabled) startObserver();
    }

    function cleanup() {
        stopObserver();
        state.translateEnabled = false;
        state.processingQueue.clear();
    }

    // ===== EVENTS =====
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('yt-navigate-finish', () => { cleanup(); init(); });

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return;

        const key = e.key.toLowerCase();
        if (key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey && $(SEL.video)) {
            e.preventDefault();
            captureScreenshot();
        }
        if (key === 't' && !e.ctrlKey && !e.altKey && !e.metaKey && $(SEL.video)) {
            e.preventDefault();
            toggleTranslation();
        }
    });

    // Observer for dynamic content
    const pageObserver = new MutationObserver(() => {
        if ($(SEL.controls)) {
            init();
            // Keep observing for mobile controls
            if (!isMobile()) pageObserver.disconnect();
        }
    });
    pageObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 0);
    } else {
        window.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();
