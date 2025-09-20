// ==UserScript== 
// @name         Forum2-Column
// @namespace    forum-2col-landscape
// @version      0.6.2
// @description  2 cột: columns hoặc split. Menu gọn, Flow trên cùng. Tự OFF khi gập, ON khi mở (fold-aware).
// @match        http://*/*
// @match        https://*/*
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/f2.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/f2.js
// @run-at       document-end
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  'use strict';

  const HOST_KEY = 'forum2col.cfg.' + location.host;

  const PRESET_SELECTORS = [
    '.threadlist', '.posts', '.topic-list', '#content .list',
    '[role="feed"]', 'main [role="feed"]', 'main .feed', '.stream'
  ];

  const defaults = () => ({
    enabled: false,
    containerSel: '',
    flowMode: 'columns', // 'columns' | 'split'
    minItemHeight: 60,
    gap: 24,
    minWidth: 1100,
    autoFold: true // NEW: tự OFF khi gập
  });

  const cfg = Object.assign(defaults(), GM_getValue(HOST_KEY, {}));
  const save = () => GM_setValue(HOST_KEY, cfg);

  /* ===== Menu ===== */
  GM_registerMenuCommand('Kiểu dòng chảy: ' + cfg.flowMode + ' → đổi…', () => {
    cfg.flowMode = (cfg.flowMode === 'columns') ? 'split' : 'columns';
    save(); applyOrRevert(true);
  });

  GM_registerMenuCommand((cfg.enabled ? 'Tắt' : 'Bật') + ' 2 cột (site này)', () => {
    cfg.enabled = !cfg.enabled; save(); applyOrRevert(true);
  });

  GM_registerMenuCommand('Tự OFF khi gập (Fold-aware): ' + (cfg.autoFold?'Bật':'Tắt') + ' → đổi…', () => {
    cfg.autoFold = !cfg.autoFold; save(); applyOrRevert(true);
  });

  GM_registerMenuCommand('Chọn container (preset hoặc nhập CSS)…', () => {
    const msg =
`Chọn số preset hoặc nhập CSS selector.
0 = tự động nhận.
Hiện tại: ${cfg.containerSel || '(auto)'}.

Presets:
` + PRESET_SELECTORS.map((s,i)=>`${i+1}. ${s}`).join('\n');
    const ans = prompt(msg, '0'); if (ans == null) return;
    const k = parseInt(ans, 10);
    if (!isNaN(k)) {
      if (k===0){ cfg.containerSel=''; save(); applyOrRevert(true); return; }
      if (k>0 && k<=PRESET_SELECTORS.length){ cfg.containerSel=PRESET_SELECTORS[k-1]; save(); applyOrRevert(true); return; }
    }
    const css = String(ans).trim(); if (css){ cfg.containerSel = css; save(); applyOrRevert(true); }
  });

  GM_registerMenuCommand('Thiết lập nhanh (gap,minWidth,minItemHeight)…', () => {
    const seed = [cfg.gap, cfg.minWidth, cfg.minItemHeight].join(',');
    const a = prompt('Nhập: gap,minWidth,minItemHeight\nVD: 24,1100,60', seed);
    if (a == null) return;
    const parts = a.split(',').map(s=>+s.trim());
    if (parts.length>=2 && parts.every(n=>!isNaN(n) && n>0)){
      const [gap, minW, minH = cfg.minItemHeight] = parts;
      cfg.gap = Math.max(8, gap|0);
      cfg.minWidth = Math.max(800, minW|0);
      cfg.minItemHeight = Math.max(20, minH|0);
      save(); applyOrRevert(true);
    } else alert('Giá trị không hợp lệ.');
  });

  /* ===== Styles ===== */
  const STYLE_ID = 'forum2col-style';
  function ensureStyle(){
    const css = `
      .f2c-columns {
        column-count: 2;
        column-gap: ${cfg.gap}px;
        column-fill: balance;
      }
      .f2c-item {
        break-inside: avoid;
        -webkit-column-break-inside: avoid;
        page-break-inside: avoid;
        width: 100% !important;
      }
      .f2c-item img, .f2c-item video, .f2c-item canvas, .f2c-item iframe {
        max-width: 100%; height: auto;
      }
      .f2c-split-wrap { display: grid; grid-template-columns: 1fr 1fr; gap: ${cfg.gap}px; align-items: start; }
      .f2c-col { display: flex; flex-direction: column; gap: ${Math.max(8, Math.floor(cfg.gap/2))}px; }
    `;
    let el = document.getElementById(STYLE_ID);
    if (!el) { el = document.createElement('style'); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = css;
  }

  /* ===== Helpers ===== */
  const visible = (el) => {
    const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width>0 && r.height>0 && s.display!=='none' && s.visibility!=='hidden';
  };

  // Fold-aware detection
  const mqlSpanningNone         = safeMql('(spanning: none)');
  const mqlSpanningFoldVert     = safeMql('(spanning: single-fold-vertical)');
  const mqlSpanningFoldHorz     = safeMql('(spanning: single-fold-horizontal)');
  function safeMql(q){ try { return matchMedia(q); } catch { return {matches:false, addEventListener(){}, removeEventListener(){}}; } }

  function isFoldedNarrow(){
    if (!cfg.autoFold) return false;
    // If app spans across a fold, treat as "opened" → allow ON
    if (mqlSpanningFoldVert.matches || mqlSpanningFoldHorz.matches) return false;
    // Otherwise decide by effective viewport width
    const vvW = (window.visualViewport && window.visualViewport.width) || window.innerWidth;
    const threshold = Math.max(800, cfg.minWidth);
    return vvW < threshold;
  }

  /* ===== State ===== */
  let applied=false, target=null, mo=null;
  let splitWrap=null, colL=null, colR=null;
  const orig = new WeakMap(); // node -> {parent, nextSibling}

  function tagItemsColumns(container){
    for (const ch of Array.from(container.children)){
      if (visible(ch) && ch.getBoundingClientRect().height >= cfg.minItemHeight){
        ch.classList.add('f2c-item');
      }
    }
  }

  function observeColumns(container){
    mo = new MutationObserver(muts => {
      for (const m of muts){
        if (m.type === 'childList' && m.addedNodes?.length){
          for (const n of m.addedNodes){
            if (n.nodeType === 1 && n.parentElement === container){
              if (visible(n) && n.getBoundingClientRect().height >= cfg.minItemHeight){
                n.classList.add('f2c-item');
              }
            }
          }
        }
      }
    });
    mo.observe(container, {childList:true, subtree:false});
  }

  function setupSplit(container){
    const items = Array.from(container.children);
    for (const n of items){ if (!orig.has(n)) orig.set(n, {parent: container, next: n.nextSibling}); }
    splitWrap = document.createElement('div'); splitWrap.className = 'f2c-split-wrap';
    colL = document.createElement('div'); colL.className = 'f2c-col';
    colR = document.createElement('div'); colR.className = 'f2c-col';
    splitWrap.append(colL, colR);
    container.insertAdjacentElement('beforebegin', splitWrap);

    const filtered = items.filter(n => visible(n) && n.getBoundingClientRect().height >= cfg.minItemHeight);
    let flip=false;
    for (const n of filtered){ (flip ? colR : colL).appendChild(n); flip = !flip; }

    mo = new MutationObserver(muts => {
      for (const m of muts){
        if (m.type==='childList' && m.addedNodes?.length){
          for (const n of m.addedNodes){
            if (n.nodeType!==1) continue;
            if (!visible(n)) continue;
            if (n.parentElement !== container) continue;
            if (n.getBoundingClientRect().height < cfg.minItemHeight) continue;
            const hL = colL.scrollHeight, hR = colR.scrollHeight;
            (hL <= hR ? colL : colR).appendChild(n);
          }
        }
      }
    });
    mo.observe(container, {childList:true, subtree:false});
    container.style.display = 'none';
  }

  function teardownSplit(container){
    if (!splitWrap) return;
    if (mo){ mo.disconnect(); mo=null; }
    for (const col of [colL, colR]){
      for (const n of Array.from(col.childNodes)){
        const o = orig.get(n);
        if (o && o.parent){ o.parent.insertBefore(n, o.next || null); }
      }
    }
    splitWrap.remove(); splitWrap=null; colL=null; colR=null;
    container.style.display = '';
  }

  function canApplyNow(){
    if (!cfg.enabled) return false;
    if (isFoldedNarrow()) return false;
    if (window.innerWidth < cfg.minWidth) return false;
    return true;
  }

  function apply(){
    if (applied || !canApplyNow()) return;

    target = null;
    if (cfg.containerSel){ try { target = document.querySelector(cfg.containerSel) || null; } catch {} }
    if (!target) target = autoFindContainer();
    if (!target) return;

    ensureStyle();

    if (cfg.flowMode === 'columns'){
      target.classList.add('f2c-columns');
      tagItemsColumns(target);
      observeColumns(target);
      applied = true;
      return;
    }
    if (cfg.flowMode === 'split'){ setupSplit(target); applied = true; }
  }

  function revert(){
    if (!applied) return;
    if (mo){ mo.disconnect(); mo=null; }
    if (target){
      if (cfg.flowMode === 'columns'){
        target.classList.remove('f2c-columns');
        for (const ch of Array.from(target.children)){ ch.classList?.remove('f2c-item'); }
      }
      if (cfg.flowMode === 'split'){ teardownSplit(target); }
    }
    applied = false;
  }

  function applyOrRevert(forceRecalc=false){
    if (forceRecalc) target = null;
    if (canApplyNow()) { if (!applied) apply(); }
    else { revert(); }
  }

  function onResize(){ applyOrRevert(); }

  // auto-detect container
  function autoFindContainer(){
    const roots = [
      document.querySelector('main'),
      document.getElementById('main'),
      document.querySelector('.main'),
      document.getElementById('content'),
      document.querySelector('.content'),
      document.querySelector('[role="main"]'),
      document.body
    ].filter(Boolean);

    let best=null, bestScore=-1;
    for (const root of roots){
      const all = root.querySelectorAll('*');
      for (const p of all){
        if (p.children.length < 6) continue;
        if (!visible(p)) continue;
        const kids = Array.from(p.children).filter(ch => visible(ch) && ch.getBoundingClientRect().height >= cfg.minItemHeight);
        if (kids.length < 6) continue;
        const hs = kids.map(k => k.getBoundingClientRect().height);
        const avg = hs.reduce((a,b)=>a+b,0)/hs.length;
        const varsum = hs.reduce((a,h)=>a+Math.pow(h-avg,2),0)/hs.length;
        const std = Math.sqrt(varsum);
        const w = p.getBoundingClientRect().width;
        const score = kids.length * (w/800) * (1/(1+std/avg));
        if (score > bestScore){ bestScore=score; best=p; }
      }
      if (best) break;
    }
    return best || null;
  }

  // Listeners: resize, orientation, visualViewport, spanning
  addEventListener('resize', onResize, {passive:true});
  addEventListener('orientationchange', onResize, {passive:true});
  if (window.visualViewport) window.visualViewport.addEventListener('resize', onResize, {passive:true});
  mqlSpanningNone.addEventListener?.('change', onResize);
  mqlSpanningFoldVert.addEventListener?.('change', onResize);
  mqlSpanningFoldHorz.addEventListener?.('change', onResize);

  // Hotkey
  addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && e.code === 'Digit2') {
      cfg.enabled = !cfg.enabled; save(); applyOrRevert(true);
    }
  }, {passive:true});

  const start = () => { applyOrRevert(true); };

  if (document.readyState === 'loading') {
    addEventListener('DOMContentLoaded', start, {once:true});
  } else {
    start();
  }
})();
