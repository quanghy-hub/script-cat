// ==UserScript==
// @name         Forum destop
// @namespace    forum-fit-auto-wide
// @version      1.5.0-combined
// @description  Auto-wide forums + on-page modal settings (Alt+Shift+F). Kèm điều hướng trang bằng cuộn ngang: trái=trang trước, phải=trang sau; ≥3 lần liên tiếp: trái=trang đầu, phải=trang cuối. Tránh vùng cuộn ngang nội bộ.
// @author       you
// @match        http://*/*
// @match        https://*/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @updateURL   https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/forum.js
// @downloadURL https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/forum.js
// ==/UserScript==

(function () {
  'use strict';

  // -------- Settings (per-site) --------
  const STORAGE_KEY = 'forum-fit.settings.v150combo';
  const host = location.host;
  const defaults = () => ({
    // Forum Fit
    enabled: false,
    mode: 'fit',          // 'fit' | 'custom'
    maxWidthPx: 1440,
    hideSidebars: false,
    imgIframesResponsive: true,
    customSelector: '',
    // Horizontal Pager
    pagerEnabled: true,
    pagerWheelThreshold: 80,   // |deltaX| tích lũy cho 1 lần đếm
    pagerWindowMs: 1200,       // gom nhiều cú cuộn cùng hướng
    pagerTripleHops: 3         // ≥3 lần → đầu/cuối
  });

  const loadAll = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } };
  const saveAll = (all) => localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  const load = () => ({ ...defaults(), ...(loadAll()[host] || {}) });
  const save = (siteCfg) => { const all = loadAll(); all[host] = siteCfg; saveAll(all); };

  let cfg = load();

  // -------- Style (ASAP) --------
  const style = document.createElement('style'); style.id = 'ff-style';
  document.documentElement.appendChild(style);

  if (cfg.enabled) {
    document.documentElement.classList.add('ff-active');
    if (cfg.hideSidebars) document.documentElement.classList.add('ff-hide-sidebars');
    if (cfg.imgIframesResponsive) document.documentElement.classList.add('ff-media');
  }

  function updateStyle(c) {
    const max = c.mode === 'custom' ? `${c.maxWidthPx}px` : 'min(98vw, 1920px)';
    style.textContent = `
      html.ff-active { --ff-max: ${max}; }
      html.ff-active body { overflow-x: hidden; scrollbar-gutter: stable both-edges; }
      @media (prefers-reduced-motion: reduce) {
        html.ff-active * { transition: none !important; animation: none !important; }
      }
      html.ff-vt::view-transition-old(root),
      html.ff-vt::view-transition-new(root) {
        animation-duration: 220ms;
        animation-timing-function: cubic-bezier(.22,.61,.36,1);
      }
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
      html.ff-active .ipsLayout,
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
      html.ff-active .ff-target,
      html.ff-active .p-body-inner,
      html.ff-active .pageWidth,
      html.ff-active .wrap,
      html.ff-active #wrap { width: auto !important; }

      html.ff-active.ff-media img,
      html.ff-active.ff-media video,
      html.ff-active.ff-media iframe,
      html.ff-active.ff-media embed {
        max-width: 100% !important; height: auto;
        transition: max-width 180ms cubic-bezier(.22,.61,.36,1);
      }

      html.ff-active.ff-hide-sidebars aside,
      html.ff-active.ff-hide-sidebars [class*="sidebar"],
      html.ff-active.ff-hide-sidebars .p-body-sidebar,
      html.ff-active.ff-hide-sidebars .ipsLayout_sidebar { display: none !important; }

      /* Modal */
      #ff-backdrop {
        position: fixed; inset: 0; background: rgba(0,0,0,.35);
        z-index: 2147483646; opacity: 0; pointer-events: none;
        transition: opacity 140ms ease;
      }
      #ff-modal {
        position: fixed; z-index: 2147483647; inset: 50% auto auto 50%;
        transform: translate(-50%,-50%) scale(.98);
        width: min(92vw, 460px); max-height: min(86vh, 640px);
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
      #ff-modal .row { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: center; margin: 6px 0; }
      #ff-modal label { display: flex; align-items: center; gap: 8px; }
      #ff-modal input[type="number"] { width: 120px; }
      #ff-modal input[type="text"] { width: 100%; }
      #ff-modal .hr { height:1px; background:rgba(0,0,0,.08); margin:10px 0; }
      #ff-modal .actions { display:flex; gap:8px; justify-content:flex-end; margin-top: 8px; }
      #ff-modal .btn {
        padding: 7px 10px; border-radius: 10px; border:1px solid rgba(0,0,0,.12);
        background:#fff; cursor:pointer; font-weight:600;
      }
      #ff-modal .btn.primary { background:#111; color:#fff; border-color:#111; }
      #ff-modal .hint { font-size: 12px; color:#666; }
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

    if (!cfg.enabled){ cleanupTargets(); }
    if (cfg.enabled && forceRetarget) cleanupTargets();

    if (cfg.enabled) pickTargets().forEach(el => el.classList.add('ff-target'));

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
      '.p-body-inner', '.p-pageWrapper', '.p-wrap',
      '.pageWidth', '#content', '.container', '.container-fluid', '.wrap', '#wrap',
      '#vbcontent', '#content_container', '#page',
      '.ipsLayout_container', '.ipsLayout',
      '.discourse', '.d-header + .wrap', '.topic-body .wrap',
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
  let _toastTimer = 0;
  function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    Object.assign(t.style, {
      position:'fixed', zIndex:2147483647, left:'50%', top:'12px', transform:'translateX(-50%)',
      background:'rgba(0,0,0,.75)', color:'#fff', padding:'8px 12px', borderRadius:'10px', font:'600 13px system-ui',
      viewTransitionName: 'none'
    });
    document.documentElement.appendChild(t);
    clearTimeout(_toastTimer); _toastTimer = setTimeout(()=>t.remove(), 1600);
  }

  // -------- Modal (unified) --------
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
    const enable = el('label', {}, el('input',{type:'checkbox',checked:cfg.enabled}), ' Enable Forum Fit on this site');

    // Mode
    const modeRow = el('div',{className:'row'});
    const modeLbl = el('div',{},'Mode');
    const modeWrap = el('div',{style:'display:flex;gap:12px;align-items:center;'});
    const r1 = el('label',{}, el('input',{type:'radio',name:'ff-mode',checked:cfg.mode==='fit'}),' Fill screen');
    const r2 = el('label',{}, el('input',{type:'radio',name:'ff-mode',checked:cfg.mode==='custom'}),' Max width');
    modeWrap.append(r1,r2); modeRow.append(modeLbl, modeWrap);

    // Max width
    const widthRow = el('div',{className:'row'});
    widthRow.append(el('div',{},'Max width (px)'), el('input',{type:'number',min:'720',max:'3000',step:'10',value:String(cfg.maxWidthPx)}));

    // Checkboxes
    const cbRow1 = el('div',{className:'row'});
    cbRow1.append(el('div',{},'Hide sidebars'), el('label',{}, el('input',{type:'checkbox',checked:cfg.hideSidebars})));

    const cbRow2 = el('div',{className:'row'});
    cbRow2.append(el('div',{},'Responsive media (img/iframe)'), el('label',{}, el('input',{type:'checkbox',checked:cfg.imgIframesResponsive})));

    // Custom selector
    const hr1 = el('div',{className:'hr'});
    const selRow = el('div',{className:'row'});
    selRow.append(el('div',{},'Custom wrapper selector'), el('input',{type:'text',value:cfg.customSelector,placeholder:'.p-body-inner / .wrap / #content'}));
    const hint = el('div',{className:'hint'}, 'Để trống để auto-detect. Dùng khi forum có wrapper riêng.');

    // ----- Horizontal Pager section -----
    const hrPager = el('div',{className:'hr'});
    const pagerTitle = el('h3', {}, 'Horizontal Pager');
    const pagerEnableRow = el('div',{className:'row'});
    pagerEnableRow.append(el('div',{},'Enable'), el('label',{}, el('input',{type:'checkbox',checked:cfg.pagerEnabled})));

    const pagerThRow = el('div',{className:'row'});
    pagerThRow.append(el('div',{},'Wheel threshold (|ΔX|)'), el('input',{type:'number',min:'20',max:'300',step:'5',value:String(cfg.pagerWheelThreshold)}));

    const pagerWinRow = el('div',{className:'row'});
    pagerWinRow.append(el('div',{},'Gesture window (ms)'), el('input',{type:'number',min:'300',max:'3000',step:'100',value:String(cfg.pagerWindowMs)}));

    const pagerTriRow = el('div',{className:'row'});
    pagerTriRow.append(el('div',{},'Triple hops (times)'), el('input',{type:'number',min:'2',max:'5',step:'1',value:String(cfg.pagerTripleHops)}));

    // Actions
    const hr2 = el('div',{className:'hr'});
    const actions = el('div',{className:'actions'});
    const btnRetarget = el('button',{className:'btn'},'Re-detect');
    const btnClose = el('button',{className:'btn'},'Close');
    const btnApply = el('button',{className:'btn primary'},'Apply now');
    actions.append(btnRetarget, btnClose, btnApply);

    modal.append(
      title, sub, enable,
      modeRow, widthRow, cbRow1, cbRow2,
      hr1, selRow, hint,
      hrPager, pagerTitle, pagerEnableRow, pagerThRow, pagerWinRow, pagerTriRow,
      hr2, actions
    );
    document.documentElement.append(backdrop, modal);

    // Events
    const [$enable] = enable.querySelectorAll('input');
    const [modeFitInp] = r1.querySelectorAll('input');
    const [modeCustomInp] = r2.querySelectorAll('input');
    const widthInp = widthRow.querySelector('input');
    const hideInp = cbRow1.querySelector('input');
    const mediaInp = cbRow2.querySelector('input');
    const selInp = selRow.querySelector('input');

    const pagerEnableInp = pagerEnableRow.querySelector('input');
    const pagerThInp = pagerThRow.querySelector('input');
    const pagerWinInp = pagerWinRow.querySelector('input');
    const pagerTriInp = pagerTriRow.querySelector('input');

    $enable.addEventListener('change', () => withVT(()=>{ cfg.enabled = !!$enable.checked; persistAndApply(cfg,{forceRetarget:true}); toast(`Forum Fit: ${cfg.enabled?'ON':'OFF'}`); }));
    modeFitInp.addEventListener('change', () => withVT(()=>{ cfg.mode = 'fit'; persistAndApply(cfg); }));
    modeCustomInp.addEventListener('change', () => withVT(()=>{ cfg.mode = 'custom'; persistAndApply(cfg); }));
    widthInp.addEventListener('change', () => withVT(()=>{ cfg.maxWidthPx = clampInt(widthInp.value,cfg.maxWidthPx,720,3000); cfg.mode='custom'; persistAndApply(cfg); }));
    hideInp.addEventListener('change', () => withVT(()=>{ cfg.hideSidebars = !!hideInp.checked; persistAndApply(cfg); }));
    mediaInp.addEventListener('change', () => { cfg.imgIframesResponsive = !!mediaInp.checked; persistAndApply(cfg); });
    selInp.addEventListener('change', () => withVT(()=>{ cfg.customSelector = selInp.value.trim(); persistAndApply(cfg,{forceRetarget:true}); }));

    pagerEnableInp.addEventListener('change', () => { cfg.pagerEnabled = !!pagerEnableInp.checked; persistAndApply(cfg); toast(`Horizontal Pager: ${cfg.pagerEnabled?'ON':'OFF'}`); });
    pagerThInp.addEventListener('change', () => { cfg.pagerWheelThreshold = clampInt(pagerThInp.value,cfg.pagerWheelThreshold,20,300); persistAndApply(cfg); });
    pagerWinInp.addEventListener('change', () => { cfg.pagerWindowMs = clampInt(pagerWinInp.value,cfg.pagerWindowMs,300,3000); persistAndApply(cfg); });
    pagerTriInp.addEventListener('change', () => { cfg.pagerTripleHops = clampInt(pagerTriInp.value,cfg.pagerTripleHops,2,5); persistAndApply(cfg); });

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
    const qs = (s)=>modal.querySelector(s);
    // Sync
    qs('label input[type="checkbox"]').checked = cfg.enabled; // first checkbox
    const radios = modal.querySelectorAll('input[name="ff-mode"]');
    radios[0].checked = (cfg.mode==='fit'); radios[1].checked = (cfg.mode==='custom');
    modal.querySelector('div.row input[type="number"]').value = String(cfg.maxWidthPx);
    const cbs = modal.querySelectorAll('label input[type="checkbox"]');
    cbs[1].checked = cfg.hideSidebars;
    cbs[2].checked = cfg.imgIframesResponsive;
    modal.querySelector('input[type="text"]').value = cfg.customSelector || '';

    // Pager sync
    const pagerInputs = modal.querySelectorAll('h3 + .row input, h3 + .row + .row input, h3 + .row + .row + .row input, h3 + .row + .row + .row + .row input');
    pagerInputs[0].checked = cfg.pagerEnabled;
    pagerInputs[1].value = String(cfg.pagerWheelThreshold);
    pagerInputs[2].value = String(cfg.pagerWindowMs);
    pagerInputs[3].value = String(cfg.pagerTripleHops);

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

  // -------- ScriptCat menu --------
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

  // =========================
  // Horizontal Pager feature
  // =========================

  // Utils for pager
  function isEditable(el) {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return true;
    if (el.isContentEditable) return true;
    return false;
  }
  function hasHorizontalScroll(el) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowX)) {
      if (el.scrollWidth > el.clientWidth + 2) return true;
    }
    return false;
  }
  function inHorizScrollableChain(start) {
    let el = start;
    for (let i = 0; i < 6 && el; i++, el = el.parentElement) {
      if (hasHorizontalScroll(el)) return true;
    }
    return false;
  }
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  function getAllLinks() { return $$('a[href]'); }
  function textIncludes(el, needles) {
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
    return needles.some(n => t.includes(n));
  }
  function extractInt(s) {
    const m = String(s || '').match(/\d+/);
    return m ? parseInt(m[0], 10) : NaN;
  }
  function getPaginationNumberLinks() {
    const containers = $$(
      '.pagination, .pager, .pageNav, nav[aria-label*="page"], nav[role="navigation"], .paging, .pagenav'
    );
    const scope = containers.length ? containers : [document];
    const out = [];
    for (const root of scope) {
      for (const a of $$('a[href]', root)) {
        if (/\d/.test(a.textContent)) out.push(a);
      }
    }
    return out;
  }
  function currentPageFromURL() {
    const u = new URL(location.href);
    for (const key of ['page','p','paged']) {
      const v = u.searchParams.get(key);
      if (v && /^\d+$/.test(v)) return { key, n: parseInt(v, 10), type: 'qs' };
    }
    const path = u.pathname;
    let m = path.match(/(?:^|\/)(?:page[-\/]?|p)(\d+)(?:\/|$)/i);
    if (m) return { seg: m[0], n: parseInt(m[1], 10), type: 'path' };
    return null;
  }
  function buildURLWithPage(baseHref, pageNum) {
    try {
      const u = new URL(baseHref, location.href);
      if (u.searchParams.has('page')) { u.searchParams.set('page', pageNum); return u.href; }
      if (u.searchParams.has('p'))    { u.searchParams.set('p', pageNum);    return u.href; }
      if (u.searchParams.has('paged')){ u.searchParams.set('paged', pageNum);return u.href; }
      u.searchParams.set('page', pageNum);
      return u.href;
    } catch { return null; }
  }
  function guessNumericPage(delta) {
    const nums = getPaginationNumberLinks();
    if (!nums.length) return null;
    let curN = NaN;
    for (const a of nums) {
      const n = extractInt(a.textContent);
      if (!isNaN(n)) {
        const ariaCur = a.getAttribute('aria-current');
        const cls = a.className || '';
        if ((ariaCur && ariaCur.toLowerCase() === 'page') || /current|active|is-active/.test(cls)) {
          curN = n;
        }
      }
    }
    if (isNaN(curN)) {
      const info = currentPageFromURL();
      if (info && !isNaN(info.n)) curN = info.n;
    }
    if (isNaN(curN)) return null;
    const target = curN + delta;
    if (target < 1) return null;

    const ref = nums.find(a => extractInt(a.textContent) === curN);
    if (ref) {
      const direct = nums.find(a => extractInt(a.textContent) === target);
      if (direct) return direct.href;
      const built = buildURLWithPage(ref.href, target);
      if (built) return built;
    }
    const built2 = buildURLWithPage(location.href, target);
    return built2 || null;
  }
  function findLinkPrev() {
    const rel = document.querySelector('a[rel="prev"], link[rel="prev"]');
    if (rel && rel.href) return rel.href;
    const cand = getAllLinks().find(a => textIncludes(a, [
      'previous','prev','trước','lùi','上一','上一页','zurück'
    ]));
    if (cand) return cand.href;
    return guessNumericPage(-1);
  }
  function findLinkNext() {
    const rel = document.querySelector('a[rel="next"], link[rel="next"]');
    if (rel && rel.href) return rel.href;
    const cand = getAllLinks().find(a => textIncludes(a, [
      'next','tiếp','sau','›','»','下一','下一页','weiter'
    ]));
    if (cand) return cand.href;
    return guessNumericPage(+1);
  }
  function findLinkLast() {
    const rel = document.querySelector('a[rel="last"], link[rel="last"]');
    if (rel && rel.href) return rel.href;
    const lab = getAllLinks().find(a => textIncludes(a, [
      'last','cuối','trang cuối','末页','letzte','last »'
    ]));
    if (lab) return lab.href;
    const pageLinks = getPaginationNumberLinks();
    if (pageLinks.length) {
      const max = pageLinks.reduce((m, a) => {
        const n = extractInt(a.textContent);
        return (!isNaN(n) && n > m.n) ? { n, href: a.href } : m;
      }, { n: -1, href: null });
      if (max.href) return max.href;
    }
    const ref = pageLinks.find(a => extractInt(a.textContent) >= 2) || pageLinks[0];
    const built = buildURLWithPage(ref ? ref.href : location.href, 999999);
    return built;
  }
  function findLinkFirst() {
    const rel = document.querySelector('a[rel="first"], link[rel="first"]');
    if (rel && rel.href) return rel.href;
    const lab = getAllLinks().find(a => textIncludes(a, [
      'first','đầu','trang đầu','首页','erste','« first'
    ]));
    if (lab) return lab.href;
    const pageLinks = getPaginationNumberLinks();
    if (pageLinks.length) {
      const min = pageLinks.reduce((m, a) => {
        const n = extractInt(a.textContent);
        return (!isNaN(n) && n < m.n) ? { n, href: a.href } : m;
      }, { n: Infinity, href: null });
      if (min.href) return min.href;
    }
    return buildURLWithPage(location.href, 1);
  }

  // Wheel gesture state
  let accDX = 0;
  let lastDir = 0; // -1 left, +1 right
  let countSameDir = 0;
  let pagerTimer = null;
  window.__forumPagerDisabled = false;

  function resetPagerWindow() {
    accDX = 0;
    lastDir = 0;
    countSameDir = 0;
    clearTimeout(pagerTimer);
    pagerTimer = null;
  }

  function registerPager(dir) {
    if (dir === 0) return;
    if (dir === lastDir) countSameDir++; else { lastDir = dir; countSameDir = 1; }
    clearTimeout(pagerTimer);
    pagerTimer = setTimeout(resetPagerWindow, cfg.pagerWindowMs);

    // Triple hops to edges
    if (countSameDir >= cfg.pagerTripleHops) {
      if (dir > 0) {
        const lastHref = findLinkLast();
        if (lastHref) { toast('▶▶▶ Trang cuối'); location.href = lastHref; }
        else toast('Không tìm được trang cuối');
      } else {
        const firstHref = findLinkFirst();
        if (firstHref) { toast('◀◀◀ Trang đầu'); location.href = firstHref; }
        else toast('Không tìm được trang đầu');
      }
      resetPagerWindow();
      return;
    }

    // Single step
    if (dir > 0) {
      const href = findLinkNext();
      if (href) { toast(`▶ Trang tiếp${countSameDir === 2 ? ' (x2)' : ''}`); location.href = href; }
      else toast('Không có trang tiếp');
    } else {
      const href = findLinkPrev();
      if (href) { toast(`◀ Trang trước${countSameDir === 2 ? ' (x2)' : ''}`); location.href = href; }
      else toast('Không có trang trước');
    }
  }

  // Wheel handler
  window.addEventListener('wheel', (e) => {
    if (!cfg.pagerEnabled || window.__forumPagerDisabled) return;
    // Chỉ nhận ý định ngang
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    const t = e.target;
    if (isEditable(t)) return;
    if (inHorizScrollableChain(t)) return;

    accDX += e.deltaX;
    if (Math.abs(accDX) >= cfg.pagerWheelThreshold) {
      const dir = accDX > 0 ? +1 : -1; // right → next, left → prev
      accDX = 0;
      registerPager(dir);
      e.preventDefault();
      e.stopPropagation();
    }
  }, { passive: false });

  // Shift để tạm tắt
  window.addEventListener('keydown', (e) => { if (e.key === 'Shift') window.__forumPagerDisabled = true; });
  window.addEventListener('keyup',   (e) => { if (e.key === 'Shift') window.__forumPagerDisabled = false; });

})();
