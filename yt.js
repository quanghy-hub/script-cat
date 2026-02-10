// ==UserScript==
// @name         YSub
// @namespace    yt
// @version      2.9.9
// @description  Bilingual Subtitles with Settings and Drag Support
// @match        https://www.youtube.com/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/yt.js
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini|webp|webm)[^\/]*$/
// @exclude      /^https?://\S+_live_chat*$/
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
        SENTENCE_STABLE_MS: 300,
        MIN_TEXT_LENGTH: 15,
        MAX_TEXT_LENGTH: 120,
        TRANSLATE_API: 'https://translate.googleapis.com/translate_a/single',
        SENTENCE_END: /[.!?;:。！？；：]\s*$/
    };

    const SEL = {
        player: '#movie_player, .html5-video-player',
        controls: '.ytp-right-controls',
        translateBtn: '.ytp-translate-button',
        settingsBtn: '.ytp-subtitle-settings-button',
        settingsPanel: '#yt-subtitle-settings',
        container: '#yt-bilingual-subtitles',
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
    const safeHTML = (html) => typeof trustedTypes !== 'undefined' && trustedTypes.defaultPolicy
        ? trustedTypes.defaultPolicy.createHTML(html) : html;

    // ==================== SETTINGS ====================
    const Settings = {
        defaults: {
            targetLang: 'vi',
            fontSize: 16,
            translatedFontSize: 16,
            originalColor: '#ffffff',
            translatedColor: '#0e8cecff',
            displayMode: 'compact',
            showOriginal: true,
            containerPosition: { x: '5%', y: '70px' },
            containerAlignment: 'left'
        },
        current: null,

        load() {
            try {
                const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
                this.current = { ...this.defaults, ...(saved ? JSON.parse(saved) : {}) };
            } catch { this.current = { ...this.defaults }; }
            return this.current;
        },

        save() {
            localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.current));
            Styles.update();
        },

        get(key) { return this.current?.[key] ?? this.defaults[key]; },
        set(key, value) { this.current[key] = value; this.save(); },

        savePosition(x, y, alignment = 'left') {
            this.current.containerPosition = { x, y };
            this.current.containerAlignment = alignment;
            this.save();
        }
    };

    // ==================== STATE ====================
    const State = {
        enabled: false,
        observer: null,
        processTimeout: null,
        sentenceTimeout: null,
        cache: new Map(),
        isDragging: false,
        dragStart: { x: 0, y: 0 },
        containerStart: { x: 0, y: 0 },
        lastRawText: '',
        lastStableText: '',
        settingsClickHandler: null
    };

    // ==================== DRAG MANAGER ====================
    const Drag = {
        _handlers: null,

        init(container) {
            if (!container || container._dragInit) return;
            container._dragInit = true;

            this._handlers = {
                move: this.onMove.bind(this),
                end: this.onEnd.bind(this)
            };

            this.applyPosition(container);
            container.style.cursor = 'move';
            container.style.userSelect = 'none';

            container.addEventListener('mousedown', (e) => this.onStart(e, container));
            container.addEventListener('touchstart', (e) => this.onStart(e, container), { passive: false });
            container.addEventListener('dragstart', (e) => e.preventDefault());
        },

        onStart(e, container) {
            if (window.getSelection()?.toString()) return;
            e.preventDefault();
            e.stopPropagation();

            const isTouch = e.type === 'touchstart';
            if (isTouch && e.touches.length !== 1) return;

            State.isDragging = true;
            const point = isTouch ? e.touches[0] : e;
            State.dragStart = { x: point.clientX, y: point.clientY };

            const rect = container.getBoundingClientRect();
            State.containerStart = { x: rect.left, y: rect.top };

            container.style.transition = 'none';
            container.style.opacity = '0.8';
            container.classList.add('yt-sub-dragging');

            document.addEventListener(isTouch ? 'touchmove' : 'mousemove', this._handlers.move, { passive: false });
            document.addEventListener(isTouch ? 'touchend' : 'mouseup', this._handlers.end);
            if (isTouch) document.addEventListener('touchcancel', this._handlers.end);
        },

        onMove(e) {
            if (!State.isDragging) return;
            e.preventDefault();

            const container = $(SEL.container);
            if (!container) return;

            const isTouch = e.type === 'touchmove';
            if (isTouch && e.touches.length !== 1) return;

            const point = isTouch ? e.touches[0] : e;
            const deltaX = point.clientX - State.dragStart.x;
            const deltaY = point.clientY - State.dragStart.y;

            const maxX = window.innerWidth - container.offsetWidth;
            const maxY = window.innerHeight - container.offsetHeight;
            const newX = Math.max(0, Math.min(State.containerStart.x + deltaX, maxX));
            const newY = Math.max(0, Math.min(State.containerStart.y + deltaY, maxY));

            const alignment = newX > maxX * 0.7 ? 'right' : newX < maxX * 0.3 ? 'left' : 'center';
            container.style.left = alignment === 'right' ? 'auto' : newX + 'px';
            container.style.right = alignment === 'right' ? (window.innerWidth - newX - container.offsetWidth) + 'px' : 'auto';
            container.style.top = newY + 'px';
            container.style.bottom = 'auto';
            container.style.transform = 'none';

            container._dragPos = { x: newX, y: newY, alignment };
        },

        onEnd() {
            if (!State.isDragging) return;

            const container = $(SEL.container);
            if (container) {
                container.style.transition = '';
                container.style.opacity = '';
                container.classList.remove('yt-sub-dragging');

                if (container._dragPos) {
                    const { x, y, alignment } = container._dragPos;
                    Settings.savePosition(x + 'px', y + 'px', alignment);
                    delete container._dragPos;
                }
            }

            State.isDragging = false;
            ['mousemove', 'mouseup', 'touchmove', 'touchend', 'touchcancel'].forEach(evt =>
                document.removeEventListener(evt, this._handlers[evt.includes('move') ? 'move' : 'end'])
            );
        },

        applyPosition(container) {
            if (!container) return;
            const pos = Settings.get('containerPosition');
            const align = Settings.get('containerAlignment');

            if (pos?.x && pos?.y) {
                container.style.left = align === 'right' ? 'auto' : align === 'center' ? '50%' : pos.x;
                container.style.right = align === 'right' ? pos.x : 'auto';
                container.style.transform = align === 'center' ? 'translateX(-50%)' : 'none';
                container.style.top = pos.y.includes('%') ? 'auto' : pos.y;
                container.style.bottom = pos.y.includes('%') ? pos.y : 'auto';
            } else {
                this.reset(container);
            }
        },

        reset(container) {
            if (!container) return;
            Object.assign(container.style, { left: '5%', bottom: '70px', top: 'auto', right: 'auto', transform: 'none' });
            Settings.savePosition('5%', '70px', 'left');
        }
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
            const hideOrig = s.displayMode === 'compact' && !s.showOriginal;

            el.textContent = `
                .ytp-translate-button, .ytp-subtitle-settings-button {
                    position: relative; width: 48px; height: 100%;
                    display: inline-flex !important; align-items: center; justify-content: center;
                    opacity: 0.9; transition: opacity 0.1s;
                }
                .ytp-translate-button svg, .ytp-subtitle-settings-button svg { width: 24px; height: 24px; }
                .ytp-translate-button:hover, .ytp-subtitle-settings-button:hover { opacity: 1; }
                .ytp-translate-button.active { opacity: 1; color: #1c87eb; }
                .ytp-translate-button.active svg { fill: #189aeb; }

                .yt-translating .ytp-caption-window-container,
                .yt-translating .caption-window {
                    opacity: 0 !important; visibility: hidden !important;
                    pointer-events: none !important; display: none !important;
                }

                #yt-bilingual-subtitles {
                    display: inline-flex !important; flex-direction: column !important;
                    align-items: flex-start !important; position: fixed !important;
                    padding: 8px 12px !important; background: rgba(8,8,8,0.85) !important;
                    border-radius: 6px !important; max-width: 90% !important; min-width: 200px !important;
                    z-index: 9998 !important; gap: 4px !important; cursor: move !important;
                    user-select: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
                    backdrop-filter: blur(4px) !important; transition: opacity 0.2s, transform 0.2s !important;
                }
                #yt-bilingual-subtitles:hover { background: rgba(15,15,15,0.9) !important; }
                #yt-bilingual-subtitles.yt-sub-dragging {
                    opacity: 0.8 !important; box-shadow: 0 6px 20px rgba(0,0,0,0.4) !important; z-index: 9999 !important;
                }
                #yt-bilingual-subtitles .sub-original {
                    color: ${s.originalColor} !important; font-size: ${s.fontSize}px !important;
                    text-shadow: 1px 1px 3px rgba(0,0,0,0.9) !important; line-height: 1.3 !important;
                    white-space: normal !important; word-wrap: break-word !important; max-width: 100% !important;
                    ${hideOrig ? 'display: none !important;' : ''}
                }
                #yt-bilingual-subtitles .sub-translated {
                    color: ${s.translatedColor} !important; font-size: ${s.translatedFontSize}px !important;
                    text-shadow: 1px 1px 3px rgba(0,0,0,0.9) !important; line-height: 1.3 !important;
                    white-space: normal !important; word-wrap: break-word !important; max-width: 100% !important;
                }

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
                #yt-subtitle-settings .reset-position-btn {
                    background: #555; color: #fff; border: none; border-radius: 4px;
                    padding: 6px 12px; cursor: pointer; font-size: 13px;
                    margin-top: 8px; width: 100%; transition: background 0.2s;
                }
                #yt-subtitle-settings .reset-position-btn:hover { background: #666; }
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
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const translated = data?.[0]?.map(i => i[0]).join('') || '';

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
            const captionWindows = $$('.caption-window');
            if (!captionWindows.length) {
                State.lastRawText = '';
                return this.removeContainer();
            }

            const lastWindow = captionWindows[captionWindows.length - 1];

            // Chỉ lấy dòng cuối cùng (caption-visual-line cuối) — dòng mới nhất YouTube đang hiện
            const lines = lastWindow.querySelectorAll('.caption-visual-line');
            let currentText;

            if (lines.length > 0) {
                // Lấy segments từ dòng cuối cùng
                const lastLine = lines[lines.length - 1];
                const segments = lastLine.querySelectorAll(SEL.captionSegment.replace('.', '') === 'ytp-caption-segment'
                    ? SEL.captionSegment : SEL.captionSegment);
                currentText = Array.from(segments).map(s => s.textContent.trim()).filter(Boolean).join(' ').trim();
            } else {
                // Fallback: lấy tất cả segments nếu không có visual-line
                const segments = $$(SEL.captionSegment, lastWindow);
                if (!segments.length) {
                    State.lastRawText = '';
                    return this.removeContainer();
                }
                currentText = Array.from(segments).map(s => s.textContent.trim()).filter(Boolean).join(' ').trim();
            }

            if (!currentText) return this.removeContainer();
            if (currentText === State.lastRawText) return;

            State.lastRawText = currentText;
            clearTimeout(State.sentenceTimeout);

            // Dịch ngay nếu đã có cache hoặc câu đã kết thúc
            if (State.cache.has(currentText.trim()) || CONFIG.SENTENCE_END.test(currentText)) {
                await this.translateAndShow(currentText);
            } else {
                // Đợi caption ổn định rồi mới dịch (tránh dịch khi text đang gõ dở)
                State.sentenceTimeout = setTimeout(async () => {
                    if (State.lastRawText === currentText) {
                        await this.translateAndShow(currentText);
                    }
                }, CONFIG.SENTENCE_STABLE_MS);
            }
        },

        async translateAndShow(text) {
            if (!text || text === State.lastStableText) return;

            const container = $(SEL.container);
            if (container?.dataset.source === text) return;

            const translated = await this.translate(text);
            if (translated && translated !== text) {
                State.lastStableText = text;
                this.updateContainer(text, translated);
            }
        },

        updateContainer(original, translated) {
            const player = $(SEL.player);
            if (!player) return;

            let container = $(SEL.container);
            if (!container) {
                container = document.createElement('div');
                container.id = 'yt-bilingual-subtitles';
                container.innerHTML = safeHTML(`<div class="sub-original"></div><div class="sub-translated"></div>`);
                document.body.appendChild(container);
                Drag.init(container);
            }

            container.querySelector('.sub-original').textContent = original;
            container.querySelector('.sub-translated').textContent = translated;
            container.dataset.source = original;
            player.classList.add('yt-translating');
        },

        removeContainer(forceRemove = false) {
            $(SEL.container)?.remove();
            State.lastStableText = '';
            if (forceRemove) $$('.yt-translating').forEach(el => el.classList.remove('yt-translating'));
        },

        debouncedProcess() {
            clearTimeout(State.processTimeout);
            State.processTimeout = setTimeout(() => State.enabled && this.process(), CONFIG.DEBOUNCE_MS);
        }
    };

    // ==================== OBSERVER ====================
    const Observer = {
        start() {
            if (State.observer) return;
            State.observer = new MutationObserver(() => State.enabled && Translation.debouncedProcess());
            State.observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        },
        stop() { State.observer?.disconnect(); State.observer = null; }
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
            const controls = $(SEL.controls);
            if (!controls) return;

            // Remove old buttons to prevent duplicates after SPA navigation
            $(SEL.settingsBtn)?.remove();
            $(SEL.translateBtn)?.remove();

            controls.insertBefore(
                this.createButton('ytp-subtitle-settings-button', 'Cài đặt phụ đề', ICONS.settings, () => this.showSettings()),
                controls.firstChild
            );
            controls.insertBefore(
                this.createButton('ytp-translate-button', 'Dịch phụ đề (T)', ICONS.translate, () => this.toggleTranslation()),
                controls.firstChild
            );
        },

        toggleTranslation() {
            State.enabled = !State.enabled;
            const btn = $(SEL.translateBtn);

            if (btn) {
                btn.classList.toggle('active', State.enabled);
                btn.innerHTML = safeHTML(State.enabled ? ICONS.translateActive : ICONS.translate);
                btn.title = State.enabled ? 'Tắt dịch (T)' : 'Dịch phụ đề (T)';
            }

            if (State.enabled) {
                Observer.start();
                Translation.process(); // Dịch ngay lập tức khi bật
            } else {
                Observer.stop();
                Translation.removeContainer(true);
            }
        },

        showSettings() {
            if ($(SEL.settingsPanel)) return;
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
                <button class="reset-position-btn" id="s-reset-pos">Đặt lại vị trí container</button>
            `);
            document.body.appendChild(panel);

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
            bind('#s-reset-pos', 'onclick', () => {
                Drag.reset($(SEL.container));
                panel.remove();
            });

            setTimeout(() => {
                // Remove previous handler if exists
                if (State.settingsClickHandler) {
                    document.removeEventListener('click', State.settingsClickHandler);
                }
                State.settingsClickHandler = (e) => {
                    if (!panel.contains(e.target) && !e.target.closest(SEL.settingsBtn)) {
                        panel.remove();
                        document.removeEventListener('click', State.settingsClickHandler);
                        State.settingsClickHandler = null;
                    }
                };
                document.addEventListener('click', State.settingsClickHandler);
            }, 100);
        },

        handleFullscreen() {
            const isFS = document.fullscreenElement || document.webkitFullscreenElement;
            [$(SEL.translateBtn), $(SEL.settingsBtn)].forEach(btn => {
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
        if (State.enabled) Observer.start();
    }

    function cleanup() {
        Observer.stop();
        clearTimeout(State.processTimeout);
        clearTimeout(State.sentenceTimeout);
        Translation.removeContainer(true);
        State.enabled = false;
        State.lastRawText = '';
        State.lastStableText = '';
        // Cleanup settings panel listener
        if (State.settingsClickHandler) {
            document.removeEventListener('click', State.settingsClickHandler);
            State.settingsClickHandler = null;
        }
        $(SEL.settingsPanel)?.remove();
    }

    // ==================== EVENT LISTENERS ====================
    document.addEventListener('fullscreenchange', () => UI.handleFullscreen());
    document.addEventListener('yt-navigate-finish', () => { cleanup(); init(); });

    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) return;
        if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.altKey && !e.metaKey && $(SEL.video)) {
            e.preventDefault();
            UI.toggleTranslation();
        }
    });

    window.addEventListener('resize', () => {
        const container = $(SEL.container);
        if (!container) return;
        const rect = container.getBoundingClientRect();
        if (rect.left < 0) container.style.left = '0px';
        if (rect.top < 0) container.style.top = '0px';
        if (rect.right > window.innerWidth) container.style.left = (window.innerWidth - container.offsetWidth) + 'px';
        if (rect.bottom > window.innerHeight) container.style.top = (window.innerHeight - container.offsetHeight) + 'px';
    });

    const waitForControls = () => {
        if ($(SEL.controls)) return init();
        let retries = 0;
        const observer = new MutationObserver(() => {
            if ($(SEL.controls)) { observer.disconnect(); init(); }
            else if (++retries > 50) observer.disconnect();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', waitForControls, { once: true })
        : waitForControls();
})();
