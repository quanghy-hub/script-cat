// ==UserScript==
// @name         Gestures
// @namespace    https://github.com/yourname/vm-unified-gestures
// @version      2.0.0
// @description  Long-press mở link; Right-click mở tab; Double Right-click đóng tab; Double Tap đóng tab; 2 ngón giữ yên 500ms xuống cuối trang.
// @match        *://*/*
// @exclude      *://mail.google.com/*
// @run-at       document-start
// @noframes
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// @grant        window.close
// @license      MIT
// ==/UserScript==

/* ===== CONFIGURATION ===== */
const CONFIG = {
    key: 'vmug_cfg_lite',
    defaults: {
        lpress: { enabled: true, mode: 'bg', ms: 500, tol: 20 },
        rclick: { enabled: true, mode: 'fg' },
        dblRightMs: 500,
        dblTapMs: 300,
        twoFingerMs: 500
    },
    get() {
        try {
            const raw = GM_getValue(this.key);
            return { ...this.defaults, ...(raw ? JSON.parse(raw) : {}) };
        } catch { return this.defaults; }
    },
    save(cfg) { GM_setValue(this.key, JSON.stringify(cfg)); }
};

let CFG = CONFIG.get();

/* ===== STATE MANAGEMENT ===== */
const State = {
    suppressUntil: 0,
    lp: { timer: null, active: false, x: 0, y: 0 },
    dblRight: { lastTime: 0, x: 0, y: 0 },
    dblTap: { taps: [] },
    tf: { timer: null, active: false, startDist: 0, startScroll: { x: 0, y: 0 }, touches: [] }
};

/* ===== UTILITIES ===== */
const Utils = {
    suppress: (ms = 500) => { State.suppressUntil = Date.now() + ms; },

    isEditable: (el) => {
        if (!el) return false;
        const tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    },

    getLink: (ev) => {
        const path = ev.composedPath?.() || [];
        for (const n of path) {
            if (n.tagName === 'A' && n.href) return n;
        }
        return null;
    },

    isValidLink: (a) => {
        if (!a || !a.href) return false;
        const h = a.href.trim();
        return !/^(javascript|mailto|tel|sms|#):/.test(h);
    },

    openTab: (url, mode) => {
        const active = mode === 'fg';
        try {
            GM_openInTab(url, { active, insert: true, setParent: true });
        } catch {
            const w = window.open(url, '_blank', active ? '' : 'noopener');
            if (w && !active) { w.blur(); window.focus(); }
        }
        Utils.suppress(800);
    },

    closeTab: () => {
        try { window.close(); } catch {}
        try { window.open('', '_self'); window.close(); } catch {} // Fallback
        try { if (history.length > 1) history.back(); } catch {} // Fallback
        Utils.suppress(600);
    },

    scrollToBottom: () => {
        const h = document.documentElement.scrollHeight || document.body.scrollHeight;
        window.scrollTo({ top: h, behavior: 'smooth' });
        Utils.suppress(400);
    }
};

/* ===== MENU COMMANDS ===== */
if (typeof GM_registerMenuCommand !== 'undefined') {
    const reg = (label, promptText, key, isBool = false, isMode = false) => {
        GM_registerMenuCommand(label, () => {
            let val = isBool ? confirm(promptText) : prompt(promptText, isMode ? CFG[key].mode : (typeof CFG[key] === 'object' ? CFG[key].ms : CFG[key]));
            if (val === null) return;
            if (!isMode && !isBool) val = Number(val);
            
            if (isMode) CFG[key].mode = val.toLowerCase().startsWith('f') ? 'fg' : 'bg';
            else if (isBool) CFG[key].enabled = val;
            else if (typeof CFG[key] === 'object') CFG[key].ms = val;
            else CFG[key] = val;

            CONFIG.save(CFG);
            alert('Đã lưu! F5 để áp dụng.');
        });
    };
    reg(`⚙️ Long-press: ${CFG.lpress.enabled ? 'ON' : 'OFF'}`, 'Bật Long-press?', 'lpress', true);
    reg(`   ↳ Mode: ${CFG.lpress.mode.toUpperCase()}`, 'Mode "bg" hoặc "fg":', 'lpress', false, true);
    reg(`   ↳ Time: ${CFG.lpress.ms}ms`, 'Thời gian giữ (ms):', 'lpress');
}

/* ===== MAIN LOGIC ===== */
(() => {
    'use strict';

    // Global Event Guard
    const stopFn = (e) => {
        if (Date.now() < State.suppressUntil) {
            e.preventDefault(); e.stopPropagation(); return true;
        }
        return false;
    };
    ['click', 'auxclick', 'contextmenu'].forEach(evt => window.addEventListener(evt, stopFn, true));

    /* --- 1. LONG PRESS (Pointer Events - No Visuals) --- */
    const cancelLP = () => {
        if (State.lp.timer) { clearTimeout(State.lp.timer); State.lp.timer = null; }
        State.lp.active = false;
    };

    window.addEventListener('pointerdown', (e) => {
        if ((e.pointerType === 'mouse' && e.button !== 0) || !CFG.lpress.enabled || Utils.isEditable(e.target)) return;
        const link = Utils.getLink(e);
        if (!Utils.isValidLink(link)) return;

        State.lp.active = true;
        State.lp.x = e.clientX;
        State.lp.y = e.clientY;

        State.lp.timer = setTimeout(() => {
            if (State.lp.active) {
                State.lp.active = false;
                Utils.openTab(link.href, CFG.lpress.mode);
            }
        }, CFG.lpress.ms);
    }, true);

    window.addEventListener('pointermove', (e) => {
        if (State.lp.active && Math.hypot(e.clientX - State.lp.x, e.clientY - State.lp.y) > CFG.lpress.tol) cancelLP();
    }, true);

    ['pointerup', 'pointercancel'].forEach(evt => window.addEventListener(evt, cancelLP, true));

    /* --- 2. DOUBLE RIGHT CLICK (Desktop) --- */
    window.addEventListener('mousedown', (e) => {
        if (e.button !== 2 || Utils.isEditable(e.target)) return;
        const now = Date.now();
        if (now - State.dblRight.lastTime < CFG.dblRightMs && Math.hypot(e.clientX - State.dblRight.x, e.clientY - State.dblRight.y) < 20) {
            e.preventDefault(); e.stopPropagation(); State.dblRight.lastTime = 0;
            Utils.closeTab();
        } else {
            State.dblRight.lastTime = now; State.dblRight.x = e.clientX; State.dblRight.y = e.clientY;
        }
    }, true);

    /* --- 3. RIGHT CLICK OPEN LINK (Desktop) --- */
    window.addEventListener('contextmenu', (e) => {
        if (stopFn(e) || !CFG.rclick.enabled || e.button !== 2) return;
        const link = Utils.getLink(e);
        if (Utils.isValidLink(link)) {
            e.preventDefault(); e.stopPropagation();
            Utils.openTab(link.href, CFG.rclick.mode);
        }
    }, true);

    /* --- 4. TOUCH GESTURES (Double Tap & 2-Finger Hold) --- */
    const clearTF = () => { if (State.tf.timer) clearTimeout(State.tf.timer); State.tf.timer = null; State.tf.active = false; };

    window.addEventListener('touchstart', (e) => {
        if (Utils.isEditable(e.target)) return;
        const now = Date.now();

        // A. DOUBLE TAP (1 finger)
        if (e.touches.length === 1) {
            const t = e.touches[0], last = State.dblTap.taps[0];
            if (last && (now - last.time < CFG.dblTapMs) && Math.hypot(t.clientX - last.x, t.clientY - last.y) < 30) {
                e.preventDefault(); e.stopPropagation(); State.dblTap.taps = [];
                Utils.closeTab();
            } else {
                State.dblTap.taps = [{ time: now, x: t.clientX, y: t.clientY }];
            }
        } 
        // B. 2 FINGER HOLD
        else if (e.touches.length === 2) {
            cancelLP(); // Hủy long press nếu có
            const t1 = e.touches[0], t2 = e.touches[1];
            State.tf.active = true;
            State.tf.startDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
            const se = document.scrollingElement || document.documentElement;
            State.tf.startScroll = { x: se.scrollLeft, y: se.scrollTop };
            State.tf.touches = [{ id: t1.identifier, x: t1.clientX, y: t1.clientY }, { id: t2.identifier, x: t2.clientX, y: t2.clientY }];
            
            State.tf.timer = setTimeout(() => { if (State.tf.active) { Utils.scrollToBottom(); State.tf.active = false; } }, CFG.twoFingerMs);
        } else clearTF();
    }, { capture: true, passive: false });

    window.addEventListener('touchmove', (e) => {
        if (!State.tf.active || e.touches.length !== 2) { clearTF(); return; }
        const se = document.scrollingElement || document.documentElement;
        // Check scroll
        if (Math.abs(se.scrollTop - State.tf.startScroll.y) > 10 || Math.abs(se.scrollLeft - State.tf.startScroll.x) > 10) { clearTF(); return; }
        
        const t1 = e.touches[0], t2 = e.touches[1];
        // Check pinch
        if (Math.abs(Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY) - State.tf.startDist) > 15) { clearTF(); return; }
        // Check finger movement
        const i1 = State.tf.touches.find(x => x.id === t1.identifier), i2 = State.tf.touches.find(x => x.id === t2.identifier);
        if ((i1 && Math.hypot(t1.clientX - i1.x, t1.clientY - i1.y) > 15) || (i2 && Math.hypot(t2.clientX - i2.x, t2.clientY - i2.y) > 15)) clearTF();
    }, { capture: true, passive: true });

    ['touchend', 'touchcancel'].forEach(evt => window.addEventListener(evt, clearTF, true));
})();
