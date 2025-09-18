// ==UserScript==
// @name         Unified Gestures: Double / Long-press / Right-click → Open Tab (BG/FG) or Close Tab + Settings [v1.4.0]
// @namespace    vm-unified-gestures-open-tab
// @version      1.4.0
// @description  Double-tap/Double-click, Long-press, Right-click để mở link tab mới (BG/FG) hoặc ĐÓNG TAB hiện tại; Fix: lưu cấu hình bền vững; Fix: long-press không còn kích hoạt click trang gốc; GM_openInTab mở tab mới kề bên.
// @match        *://*/*
// @run-at       document-start
// @noframes
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        window.close
// ==/UserScript==

(() => {
  'use strict';

  /* =================== SETTINGS =================== */
  const STORE_KEY = 'vmug_cfg';
  const DEFAULTS = {
    dblAct: 'open',                 // 'open' | 'close'
    dbl:    { enabled: true,  mode: 'bg' }, // chỉ dùng khi dblAct='open'
    lpress: { enabled: false, mode: 'bg' },
    rclick: { enabled: false, mode: 'bg' },
    dblMs:  280,
    tapTol: 24,
    longMs: 500
  };

  const deepClone = (o) => JSON.parse(JSON.stringify(o));

  // migrate: nếu bản cũ lưu nhầm 'dbl.mode'… thì chuyển sang nested object
  function migrateCfg(cfg) {
    const out = deepClone(DEFAULTS);
    // deep merge đơn giản
    for (const k of Object.keys(cfg || {})) {
      if (k in out && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) {
        Object.assign(out[k], cfg[k]);
      } else if (k in out) {
        out[k] = cfg[k];
      } else {
        // các khóa phẳng sai kiểu 'dbl.mode' → map về nested
        if (k === 'dbl.mode') out.dbl.mode = cfg[k];
        if (k === 'lpress.mode') out.lpress.mode = cfg[k];
        if (k === 'rclick.mode') out.rclick.mode = cfg[k];
      }
    }
    return out;
  }

  function loadCfg() {
    try {
      const raw = GM_getValue(STORE_KEY, '');
      if (!raw) return deepClone(DEFAULTS);
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return migrateCfg(parsed);
    } catch {
      return deepClone(DEFAULTS);
    }
  }

  function saveCfg() {
    GM_setValue(STORE_KEY, CFG);
  }

  // helpers set/get theo đường dẫn
  function getPath(path, obj = CFG) {
    return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
  }
  function setPath(path, val, obj = CFG) {
    const parts = path.split('.');
    let o = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!o[k] || typeof o[k] !== 'object') o[k] = {};
      o = o[k];
    }
    o[parts[parts.length - 1]] = val;
  }

  let CFG = loadCfg();

  /* =================== MENU (open panel) =================== */
  GM_registerMenuCommand('⚙️ Settings…', openSettingsPanel);
  GM_registerMenuCommand('↺ Reset to defaults', () => {
    CFG = deepClone(DEFAULTS);
    saveCfg();
    alert('Defaults restored.');
  });

  GM_addStyle(`
    .vmug-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2147483646;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(1px)}
    .vmug-panel{width:min(560px,92vw);max-height:90vh;overflow:auto;background:#1e1e1e;color:#eee;border:1px solid #333;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);font:14px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
    .vmug-title{margin:0 0 10px;font-size:18px}
    .vmug-card{border:1px solid #333;border-radius:10px;background:#121212;padding:12px;margin-bottom:10px}
    .vmug-row{display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center}
    .vmug-check{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid #3a3a3a;border-radius:8px;cursor:pointer;user-select:none}
    .vmug-check.active{border-color:#60a5fa;background:#1f2937}
    .vmug-modes{display:flex;gap:8px;flex-wrap:wrap}
    .vmug-mode{padding:6px 10px;border:1px solid #3a3a3a;border-radius:8px;cursor:pointer;user-select:none}
    .vmug-mode.selected{border-color:#2563eb;background:#1e3a8a}
    .vmug-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
    .vmug-btn{border:1px solid #3a3a3a;background:#2a2a2a;color:#eee;padding:8px 12px;border-radius:10px;cursor:pointer}
    .vmug-btn.primary{background:#2563eb;border-color:#2563eb}
    .vmug-note{color:#aaa;font-size:12px;margin-top:6px}
    @media (prefers-color-scheme: light){
      .vmug-panel{background:#fff;color:#222;border-color:#ddd}
      .vmug-card{background:#fafafa;border-color:#e5e5e5}
      .vmug-check{border-color:#ddd}
      .vmug-mode{border-color:#ddd}
      .vmug-btn{background:#f3f3f3;color:#222;border-color:#ddd}
      .vmug-btn.primary{color:#fff}
    }
  `);

  function openSettingsPanel() {
    const back = document.createElement('div');
    back.className = 'vmug-backdrop';
    back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });

    const panel = document.createElement('div');
    panel.className = 'vmug-panel';
    panel.innerHTML = `
      <h2 class="vmug-title">⚙️ Open / Close by gestures</h2>

      <div class="vmug-card">
        <div class="vmug-row">
          <div class="vmug-check ${CFG.dbl.enabled ? 'active' : ''}" id="vmug-dbl-on" role="checkbox" aria-checked="${CFG.dbl.enabled}">
            <span class="tick">${CFG.dbl.enabled ? '✓' : ''}</span>
            Double-tap / Double left mouse
          </div>
          <div class="vmug-modes">
            <div id="vmug-dbl-act-open"  class="vmug-mode ${CFG.dblAct==='open'  ? 'selected' : ''}">${CFG.dblAct==='open'  ? '✓ ' : ''}Open link</div>
            <div id="vmug-dbl-act-close" class="vmug-mode ${CFG.dblAct==='close' ? 'selected' : ''}">${CFG.dblAct==='close' ? '✓ ' : ''}Close tab</div>
          </div>
        </div>
        <div class="vmug-row vmug-dbl-open-opts" style="margin-top:8px; ${CFG.dblAct==='open' ? '' : 'display:none'}">
          <div style="opacity:.9">Open mode</div>
          <div class="vmug-modes">
            <div id="vmug-dbl-bg" class="vmug-mode ${CFG.dbl.mode==='bg' ? 'selected' : ''}">${CFG.dbl.mode==='bg' ? '✓ ' : ''}BG</div>
            <div id="vmug-dbl-fg" class="vmug-mode ${CFG.dbl.mode==='fg' ? 'selected' : ''}">${CFG.dbl.mode==='fg' ? '✓ ' : ''}FG</div>
          </div>
        </div>
      </div>

      <div class="vmug-card">
        <div class="vmug-row">
          <div class="vmug-check ${CFG.lpress.enabled ? 'active' : ''}" id="vmug-lp-on" role="checkbox" aria-checked="${CFG.lpress.enabled}">
            <span class="tick">${CFG.lpress.enabled ? '✓' : ''}</span>
            Long-press
          </div>
          <div class="vmug-modes">
            <div id="vmug-lp-bg" class="vmug-mode ${CFG.lpress.mode==='bg' ? 'selected' : ''}">${CFG.lpress.mode==='bg' ? '✓ ' : ''}BG</div>
            <div id="vmug-lp-fg" class="vmug-mode ${CFG.lpress.mode==='fg' ? 'selected' : ''}">${CFG.lpress.mode==='fg' ? '✓ ' : ''}FG</div>
          </div>
        </div>
      </div>

      <div class="vmug-card">
        <div class="vmug-row">
          <div class="vmug-check ${CFG.rclick.enabled ? 'active' : ''}" id="vmug-rc-on" role="checkbox" aria-checked="${CFG.rclick.enabled}">
            <span class="tick">${CFG.rclick.enabled ? '✓' : ''}</span>
            Right-click
          </div>
          <div class="vmug-modes">
            <div id="vmug-rc-bg" class="vmug-mode ${CFG.rclick.mode==='bg' ? 'selected' : ''}">${CFG.rclick.mode==='bg' ? '✓ ' : ''}BG</div>
            <div id="vmug-rc-fg" class="vmug-mode ${CFG.rclick.mode==='fg' ? 'selected' : ''}">${CFG.rclick.mode==='fg' ? '✓ ' : ''}FG</div>
          </div>
        </div>
      </div>

      <div class="vmug-actions">
        <button class="vmug-btn" id="vmug-reset">Reset</button>
        <button class="vmug-btn primary" id="vmug-save">Save</button>
        <button class="vmug-btn" id="vmug-close">Close</button>
      </div>
      <div class="vmug-note">
        Tips: GM_openInTab dùng <code>insert:true</code> để mở tab kề phải &amp; set “opener” (VM doc). Long-press đã có “ăn click” 1 lần để trang gốc không tự điều hướng.
      </div>
    `;
    back.appendChild(panel);
    document.documentElement.appendChild(back);

    // Toggle enable
    const toggler = (id, key) => {
      const node = panel.querySelector(id);
      node.addEventListener('click', () => {
        const on = !node.classList.contains('active');
        CFG[key].enabled = on;
        node.classList.toggle('active', on);
        node.setAttribute('aria-checked', String(on));
        const tick = node.querySelector('.tick');
        if (tick) tick.textContent = on ? '✓' : '';
      });
    };
    toggler('#vmug-dbl-on', 'dbl');
    toggler('#vmug-lp-on',  'lpress');
    toggler('#vmug-rc-on',  'rclick');

    // Mode pickers
    function makePair(pathOrKey, selA, selB, values) {
      const a = panel.querySelector(selA);
      const b = panel.querySelector(selB);
      const setSel = (val) => {
        if (pathOrKey.includes('.')) setPath(pathOrKey, val);
        else CFG[pathOrKey] = val;
        [a,b].forEach(n => { n.classList.remove('selected'); n.textContent = n.textContent.replace(/^✓\s?/, ''); });
        const node = (val === values[0]) ? a : b;
        node.classList.add('selected');
        node.textContent = '✓ ' + node.textContent.replace(/^✓\s?/, '');
      };
      a.addEventListener('click', () => { setSel(values[0]); updateOpenOpts(); });
      b.addEventListener('click', () => { setSel(values[1]); updateOpenOpts(); });
      return setSel;
    }
    makePair('dblAct',     '#vmug-dbl-act-open', '#vmug-dbl-act-close', ['open','close']);
    makePair('dbl.mode',   '#vmug-dbl-bg', '#vmug-dbl-fg', ['bg','fg']);
    makePair('lpress.mode','#vmug-lp-bg',  '#vmug-lp-fg',  ['bg','fg']);
    makePair('rclick.mode','#vmug-rc-bg',  '#vmug-rc-fg',  ['bg','fg']);

    function updateOpenOpts(){
      const row = panel.querySelector('.vmug-dbl-open-opts');
      if (row) row.style.display = (CFG.dblAct === 'open') ? '' : 'none';
    }
    updateOpenOpts();

    // Actions
    panel.querySelector('#vmug-close').addEventListener('click', () => back.remove());
    panel.querySelector('#vmug-reset').addEventListener('click', () => {
      CFG = deepClone(DEFAULTS);
      saveCfg();
      back.remove();
      openSettingsPanel();
    });
    panel.querySelector('#vmug-save').addEventListener('click', () => {
      saveCfg();
      back.remove();
      alert('Saved.');
    });
  }

  /* =================== HELPERS =================== */
  function getAnchorFromEvent(ev) {
    // ưu tiên composedPath để xuyên shadow DOM
    const path = (ev.composedPath && ev.composedPath()) || [];
    for (const n of path) {
      if (n && n.nodeType === 1 && n.nodeName === 'A' && n.hasAttribute && n.hasAttribute('href')) return n;
    }
    const t = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    return t || null;
  }
  function validLink(a) {
    if (!a) return false;
    const h = (a.getAttribute('href') || '').trim().toLowerCase();
    return h && !(h.startsWith('#') || h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:'));
  }
  function inEditable(el) {
    return !!(el && el.closest && el.closest('input,textarea,select,button,[contenteditable],[contenteditable="true"]'));
  }
  function hasSelection() {
    const s = window.getSelection && window.getSelection();
    return !!(s && s.type === 'Range' && String(s).length > 0);
  }
  function openByMode(url, mode) {
    const active = (mode === 'fg');
    try {
      // VM: insert mở kề phải + set opener; TM: best-effort
      GM_openInTab(url, { active, insert: true, setParent: true });
    } catch (e) {
      const w = window.open(url, '_blank', 'noopener');
      if (w && !active) { try { w.blur(); window.focus(); } catch (_) {} }
    }
  }
  function closeTabSafe() {
    try { window.close(); } catch (_) {}
    try { window.open('', '_self'); window.close(); } catch (_) {}
    try { if (history.length > 1) history.back(); } catch (_) {}
  }

  // Ăn click 1 lần sau khi đã xử lý long-press để trang gốc không điều hướng
  let suppressUntil = 0;
  let suppressAnchor = null;
  function eatNextClickFor(anchor, ms = 600) {
    suppressAnchor = anchor;
    suppressUntil = Date.now() + ms;
  }

  // chặn click ở pha capture nếu vừa long-press
  addEventListener('click', (ev) => {
    if (Date.now() <= suppressUntil) {
      const a = getAnchorFromEvent(ev);
      if (a && suppressAnchor && a === suppressAnchor) {
        ev.preventDefault(); ev.stopImmediatePropagation(); ev.stopPropagation();
        suppressUntil = 0; suppressAnchor = null;
        return;
      }
    }
  }, true); // capture

  /* =================== GESTURES =================== */

  // Long-press
  let lpDownX = 0, lpDownY = 0, lpAnchor = null, lpMoved = false, lpTimer = null;

  addEventListener('pointerdown', (ev) => {
    if (!CFG.lpress.enabled) return;
    if (inEditable(ev.target) || hasSelection()) return;
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;

    lpDownX = ev.clientX; lpDownY = ev.clientY;
    lpAnchor = a; lpMoved = false;

    clearTimeout(lpTimer);
    lpTimer = setTimeout(() => {
      if (!lpAnchor || lpMoved) return;
      // Mở tab và ăn click synth kế tiếp (rất quan trọng trên mobile)
      openByMode(lpAnchor.href, getPath('lpress.mode'));
      eatNextClickFor(lpAnchor, 800);
      // chặn contextmenu đúng lần này
      const eatOnce = (e) => { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); removeEventListener('contextmenu', eatOnce, true); };
      addEventListener('contextmenu', eatOnce, true);
    }, CFG.longMs);
  }, true);

  addEventListener('pointermove', (ev) => {
    if (!lpAnchor) return;
    const dx = Math.abs(ev.clientX - lpDownX);
    const dy = Math.abs(ev.clientY - lpDownY);
    if (dx > CFG.tapTol || dy > CFG.tapTol) {
      lpMoved = true;
      clearTimeout(lpTimer); lpTimer = null;
    }
  }, true);

  function endLP() {
    clearTimeout(lpTimer); lpTimer = null; lpAnchor = null;
  }
  addEventListener('pointerup', endLP, true);
  addEventListener('pointercancel', endLP, true);

  // Double-tap / Double-click
  let lastTapT = 0, lastTapX = 0, lastTapY = 0, singleTimer = null, pendingUrl = null;

  addEventListener('click', (ev) => {
    if (!CFG.dbl.enabled) return;

    const now = Date.now();
    const x = ev.clientX, y = ev.clientY;
    const closeTime = (now - lastTapT) <= CFG.dblMs;
    const closeSpace = Math.hypot(x - lastTapX, y - lastTapY) <= CFG.tapTol;

    // Mode: double = CLOSE TAB
    if (CFG.dblAct === 'close') {
      if (inEditable(ev.target)) return;
      if (closeTime && closeSpace) {
        ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
        lastTapT = 0;
        closeTabSafe();
        return;
      }
      lastTapT = now; lastTapX = x; lastTapY = y;
      return;
    }

    // Mode: double = OPEN LINK
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;
    if (inEditable(ev.target) || hasSelection()) return;
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;

    // chờ xác định double → chặn click mặc định
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();

    const url = a.href;
    if (closeTime && closeSpace) {
      if (singleTimer) { clearTimeout(singleTimer); singleTimer = null; pendingUrl = null; }
      lastTapT = 0;
      openByMode(url, getPath('dbl.mode'));
      return;
    }

    lastTapT = now; lastTapX = x; lastTapY = y; pendingUrl = url;
    if (singleTimer) clearTimeout(singleTimer);
    singleTimer = setTimeout(() => {
      if (pendingUrl) window.location.assign(pendingUrl);
      pendingUrl = null; singleTimer = null; lastTapT = 0;
    }, CFG.dblMs);
  }, true);

  // Right-click → mở tab mới
  addEventListener('contextmenu', (ev) => {
    if (!CFG.rclick.enabled) return;
    const a = getAnchorFromEvent(ev);
    if (!validLink(a)) return;
    ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation();
    openByMode(a.href, getPath('rclick.mode'));
  }, true);

})();
