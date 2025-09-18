// ==UserScript== 
// @name         Forum Fit (Auto-Wide) – ScriptCat Modal Settings (Chromium Smooth)
// @namespace    forum-fit-auto-wide
// @version      1.4.2-sc-modal
// @description  Single ScriptCat menu → opens an on-page modal settings panel (no floating icon). Smooth transitions via Chromium ViewTransition. Per-site config. Alt+Shift+F to toggle.
// @author       you
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  'use strict';

  // -------- Settings (per-site) --------
  const STORAGE_KEY = 'forum-fit.settings.v142scm';
  const host = location.host;
  const defaults = () => ({
    enabled: false,
    mode: 'fit',          // 'fit' | 'custom'
    maxWidthPx: 1440,     // used if mode === 'custom'
    hideSidebars: false,
    imgIframesResponsive: true,
    customSelector: '',   // optional CSS selector for the main wrapper (advanced)
  });

  const loadAll = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } };
  const saveAll = (all) => localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  const load = () => ({ ...defaults(), ...(loadAll()[host] || {}) });
  const save = (siteCfg) => { const all = loadAll(); all[host] = siteCfg; saveAll(all); };

  let cfg = load();

  // -------- Style (ASAP to avoid flashes) --------
  const style = document.createElement('style'); style.id = 'ff-style';
  document.documentElement.appendChild(style);

  // Pre-apply classes early if enabled
  if (cfg.enabled) {
    document.documentElement.classList.add('ff-active');
    if (cfg.hideSidebars) document.documentElement.classList.add('ff-hide-sidebars');
    if (cfg.imgIframesResponsive) document.documentElement.classList.add('ff-media');
  }

  function updateStyle(c) {
    const max = c.mode === 'custom' ? `${c.maxWidthPx}px` : 'min(98vw, 1920px)';
    style.textContent = `
      /* Root vars + smoothing */
      html.ff-active { --ff-max: ${max}; }
      html.ff-active body { overflow-x: hidden; scrollbar-gutter: stable both-edges; }

      @media (prefers-reduced-motion: reduce) {
        html.ff-active * { transition: none !important; animation: none !important; }
      }

      /* View Transitions for Chromium */
      html.ff-vt::view-transition-old(root),
      html.ff-vt::view-transition-new(root) {
        animation-duration: 220ms;
        animation-timing-function: cubic-bezier(.22,.61,.36,1);
      }

      /* Targets to widen */
      html.ff-active .ff-target,
      html.ff-active .p-body-inner, /* XenForo */
      html.ff-active .p-pageWrapper,
      html.ff-active .p-wrap,
      html.ff-active .pageWidth,
      html.ff-active .container,
      html.ff-active .container-fluid,
      html.ff-active .wrap,
      html.ff-active #wrap,
      html.ff-active #content,
      html.ff-active main[role="main"],
      html.ff-active .site-content,
      html.ff-active .ipsLayout_container, /* IPS */
      html.ff-active .ipsLayout, /* IPS */
      html.ff-active .discourse, /* Discourse */
      html.ff-active .topic-body .wrap,
      html.ff-active #vbcontent, /* vBulletin */
      html.ff-active #content_container {
        max-width: var(--ff-max) !important;
        width: min(100%, var(--ff-max)) !important;
        margin-left: auto !important;
        margin-right: auto !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        transition: max-width 180ms cubic-bezier(.22,.61,.36,1),
                    width 180ms cubic-bezier(.22,.61,.36,1),
                    margin 180ms ease;
      }

      /* Remove stubborn fixed widths */
      html.ff-active .ff-target,
      html.ff-active .p-body-inner,
      html.ff-active .pageWidth,
      html.ff-active .wrap,
      html.ff-active #wrap { width: auto !important; }

      /* Media responsive */
      html.ff-active.ff-media img,
      html.ff-active.ff-media video,
      html.ff-active.ff-media iframe,
      html.ff-active.ff-media embed {
        max-width: 100% !important; height: auto;
        transition: max-width 180ms cubic-bezier(.22,.61,.36,1);
      }

      /* Hide sidebars if chosen */
      html.ff-active.ff-hide-sidebars aside,
      html.ff-active.ff-hide-sidebars [class*="sidebar"],
      html.ff-active.ff-hide-sidebars .p-body-sidebar,
      html.ff-active.ff-hide-sidebars .ipsLayout_sidebar { display: none !important; }

      /* ---------- Modal settings ---------- */
      #ff-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.35);
        z-index: 2147483646; opacity: 0; pointer-events: none;
        transition: opacity 140ms ease;
      }
      #ff-modal {
        position: fixed; z-index: 2147483647; inset: 50% auto auto 50%;
        transform: translate(-50%,-50%) scale(.98);
        width: min(92vw, 420px); max-height: min(86vh, 640px);
        overflow: auto; padding: 14px 14px 12px;
        border-radius: 16px; border: 1px solid rgba(0,0,0,.12);
        background: rgba(255,255,255,.98); color:#111;
        box-shadow: 0 14px 48px rgba(0,0,0,.18);
        font: 13px/1.45 system-ui, sans-serif;
        opacity: 0; pointer-events: none;
        transition: opacity 140ms ease, transform 140ms ease;
      }
      #ff-modal[data-open="1"], #ff-backdrop[data-open="1"] { opacity: 1; pointer-events: auto; }
      #ff-modal[data-open="1"] { transform: translate(-50%,-50%) scale(1); }
      #ff-modal h3 { margin: 0 0 8px 0; font-size: 14px; font-weight: 700; }
      #ff-modal .sub { font-size: 12px; color:#555; margin-bottom: 6px; }
      #ff-modal .row { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
      #ff-modal label { display: flex; align-items: center; gap: 8px; }
      #ff-modal input[type="number"] { width: 110px; }
      #ff-modal input[type="text"] { width: 100%; }
      #ff-modal .hr { height:1px; background:rgba(0,0,0,.08); margin:10px 0; }
      #ff-modal .actions { display:flex; gap:8px; justify-content:flex-end; margin-top: 8px; }
      #ff-modal .btn {
        padding: 7px 10px; border-radius: 10px; border:1px solid rgba(0,0,0,.12);
        background:#fff; cursor:pointer; font-weight:600;
      }
      #ff-modal .btn.primary { background:#111; color:#fff; border-color:#111; }
      #ff-modal .hint { font-size: 12px; color:#666; }
      /* Keep modal out of view transitions */
      #ff-modal, #ff-backdrop { view-transition-name: none; }
    `;
  }
  updateStyle(cfg);

  // -------- ViewTransition helper --------
  const hasVT = typeof document.startViewTransition === 'function';
  function withVT(fn) {
    if (!hasVT) return void fn();
    try {
      document.documentElement.classList.add('ff-vt');
      const vt = document.startViewTransition(() => fn());
      vt.finished.finally(() => document.documentElement.classList.remove('ff-vt'));
    } catch {
      fn(); document.documentElement.classList.remove('ff-vt');
    }
  }

  // -------- Core apply --------
  let mo = null, ro = null, retargetTimer = 0;

  function persistAndApply(newCfg, opts={}) {
    cfg = newCfg; save(cfg); updateStyle(cfg);
    applyNow(opts);
  }

  function applyNow({forceRetarget=false}={}) {
    document.documentElement.classList.toggle('ff-active', cfg.enabled);
    document.documentElement.classList.toggle('ff-hide-sidebars', cfg.enabled && cfg.hideSidebars);
    document.documentElement.classList.toggle('ff-media', cfg.enabled && cfg.imgIframesResponsive);

    if (!cfg.enabled){ cleanupTargets(); return; }
    if (forceRetarget) cleanupTargets();

    pickTargets().forEach(el => el.classList.add('ff-target'));

    if (!mo) {
      mo = new MutationObserver(() => {
        if (!document.documentElement.classList.contains('ff-active')) return;
        const current = document.querySelectorAll('.ff-target');
        if (current.length === 0) {
          clearTimeout(retargetTimer);
          retargetTimer = setTimeout(()=>applyNow({forceRetarget:true}), 60);
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }

    if (!ro) {
      ro = new ResizeObserver(() => {});
      document.querySelectorAll('.ff-target').forEach(el => ro.observe(el));
    }
  }

  function cleanupTargets(){
    document.querySelectorAll('.ff-target').forEach(el => el.classList.remove('ff-target'));
  }

  function isVisible(el){
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getDepth(el){ let d = 0; while (el && el.parentElement) { d++; el = el.parentElement; } return d; }

  function pickGoodCandidates(list){
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
    const scored = list.map(el => {
      const rect = el.getBoundingClientRect();
      const depth = getDepth(el);
      const wScore = rect.width / vw;
      const areaScore = (rect.width * rect.height) / (vw * window.innerHeight);
      const score = wScore * 0.7 + (1 / (depth + 1)) * 0.3 + areaScore * 0.2;
      return { el, score };
    }).sort((a,b)=>b.score - a.score);

    const picked = [];
    for (const {el} of scored) {
      if (!picked.some(p => p.contains(el) || el.contains(p))) picked.push(el);
      if (picked.length >= 3) break;
    }
    return picked;
  }

  function pickTargets(){
    if (cfg.customSelector) {
      const found = Array.from(document.querySelectorAll(cfg.customSelector)).filter(isVisible);
      if (found.length) return found;
    }
    const presetSelectors = [
      '.p-body-inner', '.p-pageWrapper', '.p-wrap', /* XenForo */
      '.pageWidth', '#content', '.container', '.container-fluid', '.wrap', '#wrap', /* phpBB/generic */
      '#vbcontent', '#content_container', '#page', /* vBulletin */
      '.ipsLayout_container', '.ipsLayout', /* IPS */
      '.discourse', '.d-header + .wrap', '.topic-body .wrap', /* Discourse */
      'main[role="main"]', '.site-content'
    ];
    const presetEls = presetSelectors.flatMap(sel => Array.from(document.querySelectorAll(sel)));
    const goodPreset = pickGoodCandidates(presetEls.filter(isVisible));
    if (goodPreset.length) return goodPreset;

    const all = Array.from(document.querySelectorAll('main, div, section, article'));
    const cands = [];
    const vw = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);

    for (const el of all) {
      if (!isVisible(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') continue;
      const rect = el.getBoundingClientRect();
      const w = rect.width;
      if (w < 480 || w > Math.min(1600, vw * 0.98)) continue;
      const centered = (cs.marginLeft === 'auto' && cs.marginRight === 'auto') || Math.abs(rect.left - (vw - rect.right)) < 8;
      const hasMax = cs.maxWidth !== 'none';
      const likely = centered && (hasMax || w < vw * 0.9);
      if (likely) cands.push(el);
    }
    return pickGoodCandidates(cands);
  }

  // -------- Toast --------
  let toastTimer = 0;
  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', zIndex:2147483647, left:'50%', top:'12px', transform:'translateX(-50%)',
      background:'rgba(0,0,0,.75)', color:'#fff', padding:'8px 12px', borderRadius:'10px', font:'600 13px system-ui',
      viewTransitionName: 'none'
    });
    document.documentElement.appendChild(t);
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.remove(), 1600);
  }

  // -------- Modal (single unified settings panel) --------
  let modal, backdrop;
  function ensureModal() {
    if (modal) return;
    backdrop = document.createElement('div'); backdrop.id = 'ff-backdrop'; backdrop.setAttribute('data-open','0');
    modal = document.createElement('div'); modal.id = 'ff-modal'; modal.setAttribute('data-open','0');

    const el = (tag, attrs={}, ...children) => {
      const e = document.createElement(tag);
      Object.entries(attrs).forEach(([k,v]) => (k in e ? e[k]=v : e.setAttribute(k,v)));
      children.forEach(ch => e.append(ch));
      return e;
    };

    const title = el('h3', {}, 'Forum Fit – Settings');
    const sub   = el('div', {className:'sub'}, `Site: ${host}`);

    // Enable
    const enable = el('label', {}, el('input',{type:'checkbox',checked:cfg.enabled}), ' Enable on this site');

    // Mode
    const modeRow = el('div',{className:'row'});
    const r1 = el('label',{}, el('input',{type:'radio',name:'ff-mode',checked:cfg.mode==='fit'}),' Fill screen');
    const r2 = el('label',{}, el('input',{type:'radio',name:'ff-mode',checked:cfg.mode==='custom'}),' Max width');
    modeRow.append(r1,r2);

    // Max width
    const widthRow = el('label',{}, 'Max width (px): ', el('input',{type:'number',min:'720',max:'3000',step:'10',value:String(cfg.maxWidthPx)}));

    // Checkboxes
    const cb1 = el('label',{}, el('input',{type:'checkbox',checked:cfg.hideSidebars}), ' Hide sidebars');
    const cb2 = el('label',{}, el('input',{type:'checkbox',checked:cfg.imgIframesResponsive}), ' Responsive media (img/iframe)');

    // Custom selector
    const hr1 = el('div',{className:'hr'});
    const sel = el('label',{}, 'Custom wrapper selector:',
      el('input',{type:'text',value:cfg.customSelector,placeholder:'.p-body-inner / .wrap / #content'})
    );
    const hint = el('div',{className:'hint'}, 'Để trống để auto-detect. Dùng khi forum có wrapper riêng.');

    // Actions
    const hr2 = el('div',{className:'hr'});
    const actions = el('div',{className:'actions'});
    const btnRetarget = el('button',{className:'btn'},'Re-detect');
    const btnClose = el('button',{className:'btn'},'Close');
    const btnApply = el('button',{className:'btn primary'},'Apply now');
    actions.append(btnRetarget, btnClose, btnApply);

    modal.append(title, sub, enable, modeRow, widthRow, cb1, cb2, hr1, sel, hint, hr2, actions);
    document.documentElement.append(backdrop, modal);

    // Events
    const [enableInp] = enable.querySelectorAll('input');
    const [modeFitInp] = r1.querySelectorAll('input');
    const [modeCustomInp] = r2.querySelectorAll('input');
    const widthInp = widthRow.querySelector('input');
    const [hideInp] = cb1.querySelectorAll('input');
    const [mediaInp] = cb2.querySelectorAll('input');
    const selInp = sel.querySelector('input');

    // Live apply on change (mượt), vẫn có nút Apply để retarget nếu muốn
    enableInp.addEventListener('change', () => withVT(()=>{ cfg.enabled = !!enableInp.checked; persistAndApply(cfg,{forceRetarget:true}); toast(`Forum Fit: ${cfg.enabled?'ON':'OFF'}`); }));
    modeFitInp.addEventListener('change', () => withVT(()=>{ cfg.mode = 'fit'; persistAndApply(cfg); }));
    modeCustomInp.addEventListener('change', () => withVT(()=>{ cfg.mode = 'custom'; persistAndApply(cfg); }));
    widthInp.addEventListener('change', () => withVT(()=>{ cfg.maxWidthPx = clampInt(widthInp.value,1440,720,3000); cfg.mode='custom'; persistAndApply(cfg); }));
    hideInp.addEventListener('change', () => withVT(()=>{ cfg.hideSidebars = !!hideInp.checked; persistAndApply(cfg); }));
    mediaInp.addEventListener('change', () => { cfg.imgIframesResponsive = !!mediaInp.checked; persistAndApply(cfg); });

    selInp.addEventListener('change', () => withVT(()=>{ cfg.customSelector = selInp.value.trim(); persistAndApply(cfg,{forceRetarget:true}); }));

    btnRetarget.addEventListener('click', () => withVT(()=>{ applyNow({forceRetarget:true}); toast('Re-detected'); }));
    btnApply.addEventListener('click', () => withVT(()=>{ persistAndApply(cfg,{forceRetarget:true}); toast('Applied'); }));
    btnClose.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeModal(); });

    function clampInt(v, def, min, max){
      const n = parseInt(v,10); if (Number.isNaN(n)) return def;
      return Math.max(min, Math.min(max, n));
    }
  }

  function openModal(){
    ensureModal();
    // Sync UI with latest cfg before show
    const qs = (s)=>modal.querySelector(s);
    qs('label input[type="checkbox"]').checked = cfg.enabled; // first checkbox (enable)
    const radios = modal.querySelectorAll('input[name="ff-mode"]');
    radios[0].checked = (cfg.mode==='fit'); radios[1].checked = (cfg.mode==='custom');
    modal.querySelector('label input[type="number"]').value = String(cfg.maxWidthPx);
    const cbs = modal.querySelectorAll('label input[type="checkbox"]');
    cbs[1].checked = cfg.hideSidebars; // second checkbox in order
    cbs[2].checked = cfg.imgIframesResponsive; // third checkbox
    modal.querySelector('label input[type="text"]').value = cfg.customSelector || '';

    modal.setAttribute('data-open','1'); backdrop.setAttribute('data-open','1');
  }
  function closeModal(){
    if (!modal) return;
    modal.setAttribute('data-open','0'); backdrop.setAttribute('data-open','0');
  }

  // -------- Keyboard toggle --------
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.code === 'KeyF') {
      withVT(() => {
        cfg.enabled = !cfg.enabled; persistAndApply(cfg);
        toast(`Forum Fit: ${cfg.enabled ? 'ON' : 'OFF'}`);
      });
    }
  }, true);

  // -------- ScriptCat menu (single entry opens modal) --------
  function registerMenu() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    GM_registerMenuCommand('Forum Fit – Settings…', openModal);
  }
  registerMenu();

  // -------- Boot --------
  applyNow();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyNow({forceRetarget:true}), { once: true });
  } else {
    setTimeout(()=>applyNow({forceRetarget:true}), 0);
  }
})();
