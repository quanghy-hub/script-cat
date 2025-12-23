// ==UserScript==
// @name         YTSub
// @namespace    yt-bilingual-subs
// @version      2.7.0
...
// @description  Bilingual Subtitles with Settings
// @match        https://www.youtube.com/*
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

    // ==================== CONFIG ====================
    const CONFIG = {
        STORAGE_KEY: 'yt-subtitle-settings',
        CACHE_LIMIT: 500,
        DEBOUNCE_MS: 100,
        TRANSLATE_API: 'https://translate.googleapis.com/translate_a/single'
    };

    const SELECTORS = {
        controls: '.ytp-right-controls',
        translateBtn: '.ytp-translate-button',
        settingsBtn: '.ytp-subtitle-settings-button',
        settingsPanel: '#yt-subtitle-settings',
        translationContainer: '#yt-translation-container',
        captionSegment: '.ytp-caption-segment',
        video: 'video'
    };

    const ICONS = {
        translate: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 8l6 6M4 14l6-6 2-3M2 5h12M7 2v3"/><path d="M22 22l-5-10-5 10M14 18h6"/></svg>`,
        translateActive: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`,
        settings: `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`
    };

    // ==================== UTILITIES ====================
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => ctx.querySelectorAll(sel);
    const isWatchPage = () => /\/watch|[?&]v=/.test(location.href);

    const safeHTML = (html) => {
        if (typeof trustedTypes !== 'undefined' && trustedTypes.defaultPolicy) {
            return trustedTypes.defaultPolicy.createHTML(html);
        }
        return html;
    };

    // ==================== SETTINGS ====================
    const Settings = {
        defaults: {
            targetLang: 'vi',
            fontSize: 16,
            translatedFontSize: 16,
            originalColor: '#ffffff',
            translatedColor: '#ffeb3b',
            displayMode: 'compact',
            showOriginal: true
        },
        current: null,

        load() {
            try {
                const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
                this.current = { ...this.defaults, ...(saved ? JSON.parse(saved) : {}) };
            } catch {
                this.current = { ...this.defaults };
            }
            return this.current;
        },

        save() {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.current));
            Styles.update();
        },

        get(key) {
            return this.current?.[key] ?? this.defaults[key];
        },

        set(key, value) {
            this.current[key] = value;
            this.save();
        }
    };

    // ==================== STATE ====================
    const State = {
        translateEnabled: false,
        observer: null,
        processTimeout: null,
        cache: new Map()
    };

    // ==================== STYLES ====================
    const Styles = {
        update() {
            let el = $('#yt-tools-styles');
            if (!el) {
                el = document.createElement('style');
                el.id = 'yt-tools-styles';
                document.head.appendChild(el);
            }

            const s = Settings.current;
            const hideOriginal = s.displayMode === 'compact' && !s.showOriginal;

            el.textContent = `
                /* Buttons */
                .ytp-translate-button, .ytp-subtitle-settings-button {
                    position: relative; width: 48px; height: 100%;
                    display: inline-flex !important; align-items: center; justify-content: center;
                    opacity: 0.9; transition: opacity 0.1s;
                }
                .ytp-translate-button svg, .ytp-subtitle-settings-button svg { width: 24px; height: 24px; }
                .ytp-translate-button:hover, .ytp-subtitle-settings-button:hover { opacity: 1; }
                .ytp-translate-button.active { opacity: 1; color: #1c87eb; }
                .ytp-translate-button.active svg { fill: #189aeb; }

                /* Caption containers */
                .ytp-caption-window-container, .ytp-caption-window-bottom,
                .ytp-caption-window-bottom-inner, .caption-window {
                    max-height: none !important; overflow: visible !important;
                }

                /* Original subtitles */
                .ytp-caption-segment {
                    font-size: ${s.fontSize}px !important;
                    color: ${s.originalColor} !important;
                    white-space: pre-wrap !important; word-wrap: break-word !important;
                    overflow: visible !important; display: inline !important;
                    line-height: 1.4 !important;
                    ${hideOriginal ? 'display: none !important;' : ''}
                }
                .caption-visual-line {
                    white-space: pre-wrap !important; word-wrap: break-word !important;
                    overflow: visible !important;
                }

                /* Translation container */
                #yt-translation-container {
                    display: block !important; visibility: visible !important; opacity: 1 !important;
                    color: ${s.translatedColor} !important;
                    font-size: ${s.translatedFontSize}px !important;
                    text-shadow: 1px 1px 2px rgba(0,0,0,0.8) !important;
                    margin-top: 8px !important; padding: 6px 12px !important;
                    background: rgba(8,8,8,0.75) !important; border-radius: 4px !important;
                    white-space: pre-wrap !important; word-wrap: break-word !important;
                    line-height: 1.5 !important; max-width: 85vw !important;
                    text-align: center !important; position: relative !important; z-index: 999 !important;
                }

                /* Settings panel */
                #yt-subtitle-settings {
                    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                    background: rgba(28,28,28,0.95); border-radius: 12px; padding: 20px;
                    z-index: 99999; min-width: 280px; color: #fff;
                    font-family: 'Roboto', Arial, sans-serif;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5); backdrop-filter: blur(10px);
                }
                #yt-subtitle-settings h3 {
                    margin: 0 0 16px; font-size: 16px; font-weight: 500;
                    display: flex; justify-content: space-between; align-items: center;
                }
                #yt-subtitle-settings .close-btn {
                    background: none; border: none; color: #aaa;
                    font-size: 20px; cursor: pointer; padding: 0; line-height: 1;
                }
                #yt-subtitle-settings .close-btn:hover { color: #fff; }
                #yt-subtitle-settings .setting-row {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 12px; font-size: 14px;
                }
                #yt-subtitle-settings label { color: #aaa; }
                #yt-subtitle-settings input[type="range"] { width: 100px; accent-color: #ff0000; }
                #yt-subtitle-settings input[type="color"] {
                    width: 40px; height: 28px; border: none; border-radius: 4px; cursor: pointer;
                }
                #yt-subtitle-settings select {
                    background: #333; color: #fff; border: 1px solid #555;
                    border-radius: 4px; padding: 4px 8px;
                }
                #yt-subtitle-settings .toggle {
                    position: relative; width: 40px; height: 20px;
                    background: #555; border-radius: 10px; cursor: pointer; transition: background 0.2s;
                }
                #yt-subtitle-settings .toggle.active { background: #ff0000; }
                #yt-subtitle-settings .toggle::after {
                    content: ''; position: absolute; width: 16px; height: 16px;
                    background: #fff; border-radius: 50%; top: 2px; left: 2px; transition: left 0.2s;
                }
                #yt-subtitle-settings .toggle.active::after { left: 22px; }
            `;
        }
    };

    // ==================== TRANSLATION ====================
    const Translation = {
        async translate(text) {
            if (!text?.trim()) return '';
            const key = text.trim();

            if (State.cache.has(key)) return State.cache.get(key);

            try {
                const url = `${CONFIG.TRANSLATE_API}?client=gtx&sl=auto&tl=${Settings.get('targetLang')}&dt=t&q=${encodeURIComponent(text)}`;
                const res = await fetch(url);
                const data = await res.json();
                const translated = data?.[0]?.map(i => i[0]).join('') || '';

                // Cache with limit
                if (State.cache.size >= CONFIG.CACHE_LIMIT) {
                    State.cache.delete(State.cache.keys().next().value);
                }
                State.cache.set(key, translated);
                return translated;
            } catch (e) {
                console.error('[YT-Sub] Translation failed:', e);
                return '';
            }
        },

        async process() {
            const segments = $$(SELECTORS.captionSegment);
            if (!segments.length) return this.removeContainer();

            const allText = Array.from(segments).map(s => s.textContent.trim()).filter(Boolean).join(' ');
            if (!allText) return this.removeContainer();

            const container = $(SELECTORS.translationContainer);
            if (container?.dataset.source === allText) return;

            const translated = await this.translate(allText);
            if (translated && translated !== allText) {
                this.updateContainer(translated, allText);
            }
        },

        updateContainer(text, source) {
            const segment = $(SELECTORS.captionSegment);
            if (!segment) return;

            const captionWindow = segment.closest('.ytp-caption-window-bottom')
                || segment.closest('.caption-window')
                || segment.closest('.ytp-caption-window-container')
                || segment.parentElement?.parentElement?.parentElement;

            if (!captionWindow) return;

            let container = $(SELECTORS.translationContainer);
            if (!container) {
                container = document.createElement('div');
                container.id = 'yt-translation-container';
            }
            captionWindow.appendChild(container);
            container.textContent = text;
            container.dataset.source = source;
        },

        removeContainer() {
            $(SELECTORS.translationContainer)?.remove();
        },

        debouncedProcess() {
            clearTimeout(State.processTimeout);
            State.processTimeout = setTimeout(() => {
                if (State.translateEnabled) this.process();
            }, CONFIG.DEBOUNCE_MS);
        }
    };

    // ==================== OBSERVER ====================
    const Observer = {
        start() {
            if (State.observer) return;
            State.observer = new MutationObserver(() => {
                if (State.translateEnabled) Translation.debouncedProcess();
            });
            State.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        },

        stop() {
            State.observer?.disconnect();
            State.observer = null;
        }
    };

    // ==================== UI ====================
    const UI = {
        createButton(className, title, icon, onClick) {
            const btn = document.createElement('button');
            btn.className = `ytp-button ${className}`;
            btn.title = title;
            btn.innerHTML = safeHTML(icon);
            btn.addEventListener('click', (e) => { e.stopPropagation(); onClick(); });
            return btn;
        },

        addButtons() {
            const controls = $(SELECTORS.controls);
            if (!controls) return;

            if (!$(SELECTORS.settingsBtn)) {
                controls.insertBefore(
                    this.createButton('ytp-subtitle-settings-button', 'Cài đặt phụ đề', ICONS.settings, () => this.showSettings()),
                    controls.firstChild
                );
            }
            if (!$(SELECTORS.translateBtn)) {
                controls.insertBefore(
                    this.createButton('ytp-translate-button', 'Dịch phụ đề (T)', ICONS.translate, () => this.toggleTranslation()),
                    controls.firstChild
                );
            }
        },

        toggleTranslation() {
            State.translateEnabled = !State.translateEnabled;
            const btn = $(SELECTORS.translateBtn);
            if (btn) {
                btn.classList.toggle('active', State.translateEnabled);
                btn.innerHTML = safeHTML(State.translateEnabled ? ICONS.translateActive : ICONS.translate);
                btn.title = State.translateEnabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
            }

            if (State.translateEnabled) {
                Observer.start();
                Translation.debouncedProcess();
            } else {
                Observer.stop();
                Translation.removeContainer();
            }
        },

        showSettings() {
            if ($(SELECTORS.settingsPanel)) return;
            const s = Settings.current;

            const panel = document.createElement('div');
            panel.id = 'yt-subtitle-settings';
            panel.innerHTML = safeHTML(`
                <h3>Cài đặt phụ đề<button class="close-btn">×</button></h3>
                <div class="setting-row">
                    <label>Cỡ chữ gốc</label>
                    <div><input type="range" id="s-fontsize" min="12" max="32" value="${s.fontSize}"> <span id="s-fontsize-val">${s.fontSize}px</span></div>
                </div>
                <div class="setting-row">
                    <label>Cỡ chữ dịch</label>
                    <div><input type="range" id="s-trans-fontsize" min="12" max="32" value="${s.translatedFontSize}"> <span id="s-trans-fontsize-val">${s.translatedFontSize}px</span></div>
                </div>
                <div class="setting-row"><label>Màu gốc</label><input type="color" id="s-orig-color" value="${s.originalColor}"></div>
                <div class="setting-row"><label>Màu dịch</label><input type="color" id="s-trans-color" value="${s.translatedColor}"></div>
                <div class="setting-row">
                    <label>Chế độ</label>
                    <select id="s-mode">
                        <option value="compact" ${s.displayMode === 'compact' ? 'selected' : ''}>Gọn</option>
                        <option value="full" ${s.displayMode === 'full' ? 'selected' : ''}>Đầy đủ</option>
                    </select>
                </div>
                <div class="setting-row"><label>Hiện gốc</label><div class="toggle ${s.showOriginal ? 'active' : ''}" id="s-show-orig"></div></div>
            `);
            document.body.appendChild(panel);

            // Event handlers
            const bind = (id, event, handler) => panel.querySelector(id)[event] = handler;
            bind('.close-btn', 'onclick', () => panel.remove());
            bind('#s-fontsize', 'oninput', (e) => {
                Settings.set('fontSize', +e.target.value);
                panel.querySelector('#s-fontsize-val').textContent = e.target.value + 'px';
            });
            bind('#s-trans-fontsize', 'oninput', (e) => {
                Settings.set('translatedFontSize', +e.target.value);
                panel.querySelector('#s-trans-fontsize-val').textContent = e.target.value + 'px';
            });
            bind('#s-orig-color', 'oninput', (e) => Settings.set('originalColor', e.target.value));
            bind('#s-trans-color', 'oninput', (e) => Settings.set('translatedColor', e.target.value));
            bind('#s-mode', 'onchange', (e) => Settings.set('displayMode', e.target.value));
            bind('#s-show-orig', 'onclick', (e) => {
                Settings.set('showOriginal', !Settings.get('showOriginal'));
                e.target.classList.toggle('active', Settings.get('showOriginal'));
            });

            // Close on outside click
            setTimeout(() => {
                const handler = (e) => {
                    if (!panel.contains(e.target) && !e.target.closest(SELECTORS.settingsBtn)) {
                        panel.remove();
                        document.removeEventListener('click', handler);
                    }
                };
                document.addEventListener('click', handler);
            }, 100);
        },

        handleFullscreen() {
            const isFS = document.fullscreenElement || document.webkitFullscreenElement;
            [$(SELECTORS.translateBtn), $(SELECTORS.settingsBtn)].forEach(btn => {
                if (btn) btn.style.bottom = isFS ? '2px' : '0';
            });
        }
    };

    // ==================== INITIALIZATION ====================
    function init() {
        if (!isWatchPage()) return;
        Settings.load();
        Styles.update();
        UI.addButtons();
        if (State.translateEnabled) Observer.start();
    }

    function cleanup() {
        Observer.stop();
        Translation.removeContainer();
        State.translateEnabled = false;
    }

    // ==================== EVENT LISTENERS ====================
    document.addEventListener('fullscreenchange', () => UI.handleFullscreen());
    document.addEventListener('yt-navigate-finish', () => { cleanup(); init(); });

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return;
        if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.altKey && !e.metaKey && $(SELECTORS.video)) {
            e.preventDefault();
            UI.toggleTranslation();
        }
    });

    // Wait for YouTube player controls
    const pageObserver = new MutationObserver(() => {
        if ($(SELECTORS.controls)) {
            init();
            pageObserver.disconnect();
        }
    });
    pageObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState !== 'loading') {
        setTimeout(init, 0);
    } else {
        window.addEventListener('DOMContentLoaded', init, { once: true });
    }
})();
