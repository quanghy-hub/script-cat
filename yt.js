// ==UserScript==
// @name         YouTube
// @namespace    yt-tools-merged
// @version      2.5.0
// @description  Screenshot & Bilingual Subtitles (Vietnamese)
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini|webp|webm)[^\/]*$/
// @exclude      /^https?://\S+_live_chat*$/
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      translate.googleapis.com
// @inject-into  page
// @allFrames    true
// @run-at       document-start
// ==/UserScript==

(() => {
    'use strict';

    // ===== GUARDS =====
    if (window.top !== window) return;

    // ===== CONFIGURATION =====
    const CONFIG = {
        targetLang: 'vi',
        cacheSize: 500,
        debounceMs: 100
    };

    // ===== SELECTORS =====
    const SEL = {
        controls: '.ytp-right-controls',
        screenshotBtn: '.ytp-screenshot-button',
        translateBtn: '.ytp-translate-button',
        video: 'video',
        captionWindow: '.ytp-caption-window-container',
        captionSegment: '.ytp-caption-segment'
    };

    // ===== ICONS (Material Design Outlined - YouTube 2024 Style) =====
    const ICONS = {
        camera: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>`,
        translate: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 8l6 6"/>
      <path d="M4 14l6-6 2-3"/>
      <path d="M2 5h12"/>
      <path d="M7 2v3"/>
      <path d="M22 22l-5-10-5 10"/>
      <path d="M14 18h6"/>
    </svg>`,
        translateActive: `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" stroke="none">
      <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
    </svg>`
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
    const applyStyles = (el, styles) => Object.assign(el.style, styles);
    const isWatchPage = () => /\/watch|[?&]v=/.test(location.href);

    // ===== STYLES =====
    const BUTTON_STYLES = {
        base: {
            position: 'relative',
            width: '48px',
            height: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: '0.9',
            transition: 'opacity 0.1s ease'
        }
    };

    const injectStyles = () => {
        if ($('#yt-tools-styles')) return;
        const style = document.createElement('style');
        style.id = 'yt-tools-styles';
        style.textContent = `
      .ytp-caption-segment[data-translated]::after {
        content: attr(data-translated);
        display: block;
        color: #ffeb3b;
        font-size: 0.9em;
        margin-top: 4px;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
      }
      .ytp-translate-button.active svg {
        color: #ffeb3b;
      }
      .ytp-translate-button.active {
        opacity: 1 !important;
      }
    `;
        document.head.appendChild(style);
    };

    // ===== TRANSLATION API =====
    async function translateText(text) {
        if (!text || text.trim().length === 0) return '';

        // Check cache
        const cacheKey = text.trim();
        if (state.translationCache.has(cacheKey)) {
            return state.translationCache.get(cacheKey);
        }

        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${CONFIG.targetLang}&dt=t&q=${encodeURIComponent(text)}`;

            const response = await fetch(url);
            const data = await response.json();

            let translated = '';
            if (data && data[0]) {
                translated = data[0].map(item => item[0]).join('');
            }

            // Cache result
            if (state.translationCache.size >= CONFIG.cacheSize) {
                const firstKey = state.translationCache.keys().next().value;
                state.translationCache.delete(firstKey);
            }
            state.translationCache.set(cacheKey, translated);

            return translated;
        } catch (error) {
            console.error('[YT Tools] Translation error:', error);
            return '';
        }
    }

    // ===== SUBTITLE PROCESSING =====
    async function processSubtitle(segment) {
        const originalText = segment.textContent.trim();
        if (!originalText || segment.dataset.processed === originalText) return;

        // Mark as being processed
        if (state.processingQueue.has(originalText)) return;
        state.processingQueue.add(originalText);

        try {
            const translated = await translateText(originalText);
            if (translated && translated !== originalText) {
                segment.dataset.translated = translated;
                segment.dataset.processed = originalText;
            }
        } finally {
            state.processingQueue.delete(originalText);
        }
    }

    function processAllSubtitles() {
        if (!state.translateEnabled) return;
        const segments = $$(SEL.captionSegment);
        segments.forEach(processSubtitle);
    }

    // Debounced processing
    let processTimeout = null;
    function debouncedProcess() {
        if (processTimeout) clearTimeout(processTimeout);
        processTimeout = setTimeout(processAllSubtitles, CONFIG.debounceMs);
    }

    // ===== SUBTITLE OBSERVER =====
    function startSubtitleObserver() {
        if (state.observer) return;

        state.observer = new MutationObserver((mutations) => {
            if (!state.translateEnabled) return;

            for (const mutation of mutations) {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    debouncedProcess();
                    break;
                }
            }
        });

        // Observe caption container
        const observeTarget = $(SEL.captionWindow) || document.body;
        state.observer.observe(observeTarget, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    function stopSubtitleObserver() {
        if (state.observer) {
            state.observer.disconnect();
            state.observer = null;
        }
    }

    // ===== TOGGLE TRANSLATION =====
    function toggleTranslation() {
        state.translateEnabled = !state.translateEnabled;

        const btn = $(SEL.translateBtn);
        if (btn) {
            btn.classList.toggle('active', state.translateEnabled);
            btn.innerHTML = state.translateEnabled ? ICONS.translateActive : ICONS.translate;
            btn.title = state.translateEnabled ? 'Tắt dịch phụ đề (T)' : 'Dịch phụ đề sang Việt (T)';
        }

        if (state.translateEnabled) {
            startSubtitleObserver();
            processAllSubtitles();
        } else {
            stopSubtitleObserver();
            // Clear translations
            $$(SEL.captionSegment).forEach(seg => {
                delete seg.dataset.translated;
                delete seg.dataset.processed;
            });
        }
    }

    // ===== SCREENSHOT FUNCTIONALITY =====
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

        applyStyles(btn, BUTTON_STYLES.base);
        btn.addEventListener('click', onClick);
        btn.addEventListener('mouseenter', () => btn.style.opacity = '1');
        btn.addEventListener('mouseleave', () => {
            if (!btn.classList.contains('active')) btn.style.opacity = '0.9';
        });

        return btn;
    }

    function addButtons() {
        const controls = $(SEL.controls);
        if (!controls) return;

        // Add screenshot button
        if (!$(SEL.screenshotBtn)) {
            const screenshotBtn = createButton(
                'ytp-screenshot-button',
                'Chụp màn hình (S)',
                ICONS.camera,
                captureScreenshot
            );
            controls.insertBefore(screenshotBtn, controls.firstChild);
        }

        // Add translate button
        if (!$(SEL.translateBtn)) {
            const translateBtn = createButton(
                'ytp-translate-button',
                'Dịch phụ đề sang Việt (T)',
                ICONS.translate,
                toggleTranslation
            );
            controls.insertBefore(translateBtn, controls.firstChild);
        }
    }

    // ===== FULLSCREEN HANDLER =====
    function handleFullscreen() {
        const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
        const buttons = [$(SEL.screenshotBtn), $(SEL.translateBtn)];

        buttons.forEach(btn => {
            if (btn) btn.style.bottom = isFullscreen ? '2px' : '0';
        });
    }

    // ===== INITIALIZATION =====
    function init() {
        if (!isWatchPage()) return;
        injectStyles();
        addButtons();

        // Re-observe if translation was enabled
        if (state.translateEnabled) {
            startSubtitleObserver();
        }
    }

    function cleanup() {
        stopSubtitleObserver();
        state.translateEnabled = false;
        state.processingQueue.clear();
    }

    // ===== EVENT LISTENERS =====
    document.addEventListener('fullscreenchange', handleFullscreen);
    document.addEventListener('yt-navigate-finish', () => {
        cleanup();
        init();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable;
        if (isInput) return;

        const key = e.key.toLowerCase();

        // S - Screenshot
        if (key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if ($(SEL.video)) {
                e.preventDefault();
                captureScreenshot();
            }
        }

        // T - Toggle translation
        if (key === 't' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            if ($(SEL.video)) {
                e.preventDefault();
                toggleTranslation();
            }
        }
    });

    // MutationObserver for dynamic content
    const pageObserver = new MutationObserver(() => {
        if ($(SEL.controls)) {
            init();
            pageObserver.disconnect();
        }
    });
    pageObserver.observe(document.documentElement, { childList: true, subtree: true });

    // Initial load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 0);
    } else {
        window.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();
