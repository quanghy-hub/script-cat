// ==UserScript==
// @name         Tinder Unblur
// @namespace    
// @version      1.3
// @description  Unblur Tinder fast match teasers and show names
// @match        https://tinder.com/*
// @grant        none
// @license MIT
// ==/UserScript==

(function () {
    'use strict';

    let debounceTimer = null;

    function getAuthToken() {
        return localStorage.getItem("TinderWeb/APIToken");
    }

    async function unblur() {
        const authToken = getAuthToken();
        if (!authToken) {
            console.error("Tinder Unblur: Auth token not found.");
            return;
        }

        try {
            const response = await fetch("https://api.gotinder.com/v2/fast-match/teasers", {
                headers: {
                    "X-Auth-Token": authToken,
                    "Platform": "android",
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                console.error(`Tinder Unblur: Fetch error - ${response.statusText}`);
                return;
            }

            const data = await response.json();
            const teasers = data?.data?.results;

            if (!teasers || !Array.isArray(teasers)) {
                console.error("Tinder Unblur: Invalid teaser data.");
                return;
            }

            const teaserEls = document.querySelectorAll(
                ".Expand.enterAnimationContainer > div:nth-child(1)"
            );

            teasers.forEach((teaser, index) => {
                const teaserEl = teaserEls[index];
                if (!teaserEl || !teaser.user?.photos?.length) return;
                if (teaserEl.dataset.unblurred) return; // Already processed

                const photo = teaser.user.photos[0];
                // Use direct URL from API, fallback to constructed URL
                let teaserImage = photo.url;
                if (!teaserImage || teaserImage.includes('unknown')) {
                    teaserImage = `https://preview.gotinder.com/${teaser.user._id}/original_${photo.id}.jpeg`;
                }
                // Skip if still invalid (server-side blurred)
                if (teaserImage.includes('unknown')) return;

                teaserEl.style.backgroundImage = `url(${teaserImage})`;
                teaserEl.style.filter = 'none';
                teaserEl.dataset.unblurred = 'true';

                // Skip if name overlay already exists
                if (teaserEl.querySelector('.tinder-name-overlay')) return;

                const nameDiv = document.createElement('div');
                nameDiv.className = 'tinder-name-overlay';
                let text = teaser.user.name || 'Unknown';
                if (teaser.user.birth_date) {
                    text += `, ${new Date().getFullYear() - new Date(teaser.user.birth_date).getFullYear()}`;
                }
                nameDiv.textContent = text;
                Object.assign(nameDiv.style, {
                    position: 'absolute', bottom: '10px', left: '10px',
                    backgroundColor: 'rgba(0,0,0,0.7)', color: 'white',
                    padding: '5px 10px', borderRadius: '5px',
                    fontSize: '14px', fontWeight: 'bold', zIndex: '1000'
                });
                teaserEl.appendChild(nameDiv);
            });

            console.log("Tinder Unblur: Images unblurred and names added successfully.");
        } catch (error) {
            console.error("Tinder Unblur: Error during unblur process.", error);
        }
    }

    function debouncedUnblur() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(unblur, 300);
    }

    window.addEventListener('load', () => {
        setTimeout(unblur, 3000);
    });

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                debouncedUnblur();
                break;
            }
        }
    });

    const targetNode = document.body;
    const config = { childList: true, subtree: true };
    observer.observe(targetNode, config);
})();