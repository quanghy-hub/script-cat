// ==UserScript==
// @name         Screenshot
// @namespace    video-screenshot
// @version      1.1.0
// @description  Screenshot any video on any website
// @match        *://*/*
// @exclude      /^https?://\S+\.(txt|png|jpg|jpeg|gif|xml|svg|manifest|log|ini)[^\/]*$/
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(() => {
    'use strict';

    // Skip frames
    if (window.top !== window) return;

    const BUTTON_SIZE = 32;
    const ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;

    const processedVideos = new WeakSet();

    function createButton() {
        const btn = document.createElement('button');
        btn.className = 'video-screenshot-btn';
        btn.innerHTML = ICON;
        btn.title = 'Chụp màn hình (S)';
        return btn;
    }

    function captureScreenshot(video) {
        if (!video || video.videoWidth === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const filename = (document.title.trim() || 'screenshot') + '_' + Date.now() + '.png';
        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = filename.replace(/[<>:"/\\|?*]/g, '_');
        link.click();
    }

    function addButtonToVideo(video) {
        if (processedVideos.has(video)) return;
        if (video.offsetWidth < 200 || video.offsetHeight < 150) return;

        processedVideos.add(video);

        // Create container
        const container = document.createElement('div');
        container.className = 'video-screenshot-container';

        // Create button
        const btn = createButton();
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            captureScreenshot(video);
        });

        container.appendChild(btn);

        // Position container relative to video
        const parent = video.parentElement;
        if (parent) {
            const parentStyle = getComputedStyle(parent);
            if (parentStyle.position === 'static') {
                parent.style.position = 'relative';
            }
            parent.appendChild(container);
        }

        // Show for 10s -> fade to 40% -> then hide -> click video to show again
        let fadeTimeout, hideTimeout;

        const showBtn = () => {
            clearTimeout(fadeTimeout);
            clearTimeout(hideTimeout);
            container.style.opacity = '1';
            startAutoHide();
        };

        const startAutoHide = () => {
            // After 3s, fade to 40%
            fadeTimeout = setTimeout(() => {
                container.style.opacity = '0.4';
                // After another 3s, hide completely
                hideTimeout = setTimeout(() => {
                    container.style.opacity = '0';
                }, 3000);
            }, 3000);
        };

        // Click on video to show button again
        video.addEventListener('click', showBtn);
        container.addEventListener('mouseenter', () => {
            clearTimeout(fadeTimeout);
            clearTimeout(hideTimeout);
            container.style.opacity = '1';
        });
        container.addEventListener('mouseleave', startAutoHide);

        // Initial show
        container.style.opacity = '1';
        startAutoHide();
    }

    function scanVideos() {
        document.querySelectorAll('video').forEach(addButtonToVideo);
    }

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
        .video-screenshot-container {
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 9999;
            opacity: 1;
            transition: opacity 0.5s;
            pointer-events: auto;
        }
        .video-screenshot-btn {
            width: ${BUTTON_SIZE}px;
            height: ${BUTTON_SIZE}px;
            border: none;
            border-radius: 6px;
            background: rgba(0, 0, 0, 0.7);
            color: #fff;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
            transition: background 0.15s, transform 0.15s;
            touch-action: manipulation;
            -webkit-tap-highlight-color: transparent;
        }
        .video-screenshot-btn:hover {
            background: rgba(255, 255, 255, 0.9);
            color: #000;
            transform: scale(1.1);
        }
        .video-screenshot-btn:active {
            background: rgba(255, 255, 255, 0.9);
            color: #000;
            transform: scale(0.95);
        }
    `;
    document.head.appendChild(style);

    // Keyboard shortcut
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
        if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
            // Find video in viewport
            const videos = document.querySelectorAll('video');
            for (const video of videos) {
                const rect = video.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0 &&
                    rect.left < window.innerWidth && rect.right > 0 &&
                    video.videoWidth > 0) {
                    e.preventDefault();
                    captureScreenshot(video);
                    break;
                }
            }
        }
    });

    // Observer for dynamic content
    const observer = new MutationObserver(scanVideos);
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial scan
    scanVideos();
    setTimeout(scanVideos, 1000);
    setTimeout(scanVideos, 3000);
})();
