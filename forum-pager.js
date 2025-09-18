// ==UserScript==
// @name         Forum Pager: Swipe/Wheel → Append Next | Top | First/Last
// @namespace    forum-pager-horizontal
// @version      1.2.0
// @description  Phải: bấm “Xem thêm” hoặc tải trang sau và ghép dưới cùng tab. Trái: cuộn về đầu. 3 lần phải→cuối, 3 lần trái→đầu. Tối ưu Chromium.
// @match        *://*/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ===== Config =====
  const WHEEL_THRESHOLD = 80;        // |deltaX| để tính 1 cú cuộn
  const TOUCH_THRESHOLD = 60;        // px vuốt ngang
  const GESTURE_WINDOW_MS = 1200;    // gom nhiều cú cùng hướng
  const TRIPLE_TO_EDGE = 3;          // >=3 lần → đầu/cuối
  const TOAST_MS = 900;

  // ===== Utils DOM =====
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function isEditable(el){ return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable); }
  function hasHorizontalScroll(el){
    const cs = getComputedStyle(el);
    return /(auto|scroll)/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2;
  }
  function inHorizScrollableChain(start){
    let el = start;
    for (let i=0; i<6 && el; i++, el = el.parentElement) if (hasHorizontalScroll(el)) return true;
    return false;
  }
  function getAllLinks(root=document){ return $$('a[href]', root); }
  function textIncludes(el, needles){
    const t = (el.getAttribute('aria-label') || el.textContent || '').trim().toLowerCase();
    return needles.some(n => t.includes(n));
  }
  function extractInt(s){ const m = String(s||'').match(/\d+/); return m ? parseInt(m[0],10) : NaN; }

  // ===== Pagination finders =====
  function getPaginationNumberLinks(root=document){
    const containers = $$(
      '.pagination, .pager, .pageNav, nav[aria-label*="page"], nav[role="navigation"], .paging, .pagenav',
      root
    );
    const scope = containers.length ? containers : [root];
    const out = [];
    for (const r of scope) for (const a of $$('a[href]', r)) if (/\d/.test(a.textContent)) out.push(a);
    return out;
  }
  function currentPageFromURL(urlStr){
    const u = new URL(urlStr || location.href);
    for (const key of ['page','p','paged']) {
      const v = u.searchParams.get(key);
      if (v && /^\d+$/.test(v)) return { key, n: parseInt(v,10), type: 'qs' };
    }
    const m = u.pathname.match(/(?:^|\/)(?:page[-\/]?|p)(\d+)(?:\/|$)/i);
    if (m) return { seg: m[0], n: parseInt(m[1],10), type: 'path' };
    return null;
  }
  function buildURLWithPage(baseHref, pageNum){
    try{
      const u = new URL(baseHref, location.href);
      if (u.searchParams.has('page')) { u.searchParams.set('page', pageNum); return u.href; }
      if (u.searchParams.has('p'))    { u.searchParams.set('p', pageNum);    return u.href; }
      if (u.searchParams.has('paged')){ u.searchParams.set('paged', pageNum);return u.href; }
      u.searchParams.set('page', pageNum);
      return u.href;
    }catch{ return null; }
  }
  function findLinkPrev(root=document){
    const rel = $('a[rel="prev"], link[rel="prev"]', root); if (rel?.href) return rel.href;
    const cand = getAllLinks(root).find(a => textIncludes(a, ['previous','prev','trước','lùi','«','‹','上一','上一页','zurück']));
    if (cand) return cand.href;
    return guessNumericPage(-1, root);
  }
  function findLinkNext(root=document){
    const rel = $('a[rel="next"], link[rel="next"]', root); if (rel?.href) return rel.href;
    const cand = getAllLinks(root).find(a => textIncludes(a, ['next','tiếp','sau','›','»','下一','下一页','weiter']));
    if (cand) return cand.href;
    return guessNumericPage(+1, root);
  }
  function findLinkLast(root=document){
    const rel = $('a[rel="last"], link[rel="last"]', root); if (rel?.href) return rel.href;
    const lab = getAllLinks(root).find(a => textIncludes(a, ['last','cuối','trang cuối','末页','letzte']));
    if (lab) return lab.href;
    const nums = getPaginationNumberLinks(root);
    if (nums.length){
      const mx = nums.reduce((m,a)=>{ const n = extractInt(a.textContent); return n>m.n?{n,href:a.href}:m; },{n:-1,href:null});
      if (mx.href) return mx.href;
    }
    return null;
  }
  function findLinkFirst(root=document){
    const rel = $('a[rel="first"], link[rel="first"]', root); if (rel?.href) return rel.href;
    const lab = getAllLinks(root).find(a => textIncludes(a, ['first','đầu','trang đầu','首页','erste']));
    if (lab) return lab.href;
    const nums = getPaginationNumberLinks(root);
    if (nums.length){
      const mn = nums.reduce((m,a)=>{ const n = extractInt(a.textContent); return (!isNaN(n) && (m.n===-1||n<m.n))?{n,href:a.href}:m; },{n:-1,href:null});
      if (mn.href) return mn.href;
      const cur = currentPageFromURL();
      if (cur?.n) {
        const ref = nums.find(a => extractInt(a.textContent) === cur.n) || { href: location.href };
        const built = buildURLWithPage(ref.href, 1);
        if (built) return built;
      }
      const built2 = buildURLWithPage(location.href, 1);
      if (built2) return built2;
    }
    return null;
  }
  function guessNumericPage(delta, root=document){
    const nums = getPaginationNumberLinks(root);
    if (!nums.length) return null;
    let curN = NaN;
    for (const a of nums) {
      const n = extractInt(a.textContent);
      if (isNaN(n)) continue;
      const ariaCur = a.getAttribute('aria-current');
      const cls = a.className || '';
      if ((ariaCur && ariaCur.toLowerCase()==='page') || /current|active|is-active/.test(cls)) curN = n;
    }
    if (isNaN(curN)) { const info = currentPageFromURL(); if (info && !isNaN(info.n)) curN = info.n; }
    if (isNaN(curN)) return null;
    const target = curN + delta; if (target < 1) return null;
    const ref = nums.find(a => extractInt(a.textContent) === curN);
    if (ref){
      const direct = nums.find(a => extractInt(a.textContent) === target);
      if (direct) return direct.href;
      const built = buildURLWithPage(ref.href, target);
      if (built) return built;
    }
    return buildURLWithPage(location.href, target);
  }

  // ===== Toast HUD =====
  let toastTimer = null;
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    position:'fixed', top:'12px', left:'50%', transform:'translateX(-50%)',
    padding:'6px 10px', background:'rgba(0,0,0,0.7)', color:'#fff',
    fontSize:'13px', borderRadius:'10px', zIndex:2147483647,
    pointerEvents:'none', opacity:'0', transition:'opacity 120ms ease'
  });
  document.documentElement.appendChild(toast);
  function showToast(msg){
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>toast.style.opacity='0', TOAST_MS);
  }

  // ===== Load-more detector =====
  function visible(el){
    const r = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return r.width>0 && r.height>0 && style.visibility!=='hidden' && style.display!=='none';
  }
  function findLoadMore(){
    const needles = [
      'load more','more posts','show more','see more','more',
      'xem thêm','tải thêm','hiển thị thêm','xem tiếp','xem nữa'
    ];
    const candidates = [
      ...$$('button, a[role="button"], a')
    ].filter(el => textIncludes(el, needles) && visible(el));
    // ưu tiên cái nằm gần cuối trang
    candidates.sort((a,b)=>b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    return candidates[0] || null;
  }

  // ===== Append next page =====
  let isAppending = false;
  let appendedURLs = new Set();

  function chooseContentRoot(doc){
    const prefs = [
      'main', '[role="main"]',
      '#content','.content','.postlist','.threadlist','.pageContent',
      '.container','.container-main','.layout__content',
      '.articles','.list','.items'
    ];
    for (const sel of prefs){
      const node = doc.querySelector(sel);
      if (node && node.children && node.children.length > 0) return node;
    }
    // fallback: biggest child of body
    let best = null, bestScore = -1;
    for (const el of Array.from(doc.body.children)){
      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width: el.offsetWidth, height: el.offsetHeight };
      const score = (rect.width||el.scrollWidth) * (rect.height||el.scrollHeight);
      if (score > bestScore){ bestScore = score; best = el; }
    }
    return best || doc.body;
  }

  async function appendNextPage(){
    if (isAppending) { showToast('Đang tải…'); return; }
    const loadMore = findLoadMore();
    if (loadMore){
      loadMore.click();
      showToast('Đã bấm “Xem thêm”');
      return;
    }
    const nextHref = findLinkNext();
    if (!nextHref){ showToast('Không có trang tiếp'); return; }
    if (appendedURLs.has(nextHref)){ showToast('Trang tiếp đã ghép'); return; }

    isAppending = true;
    showToast('Tải trang tiếp…');
    try{
      const res = await fetch(nextHref, { credentials:'include' });
      const html = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // chọn phần nội dung và loại bỏ script/style
      const root = chooseContentRoot(doc);
      if (!root){ showToast('Không tìm thấy nội dung'); isAppending=false; return; }

      const wrapper = document.createElement('div');
      wrapper.style.marginTop = '24px';
      wrapper.style.borderTop = '1px solid rgba(127,127,127,0.3)';
      wrapper.style.paddingTop = '16px';

      const badge = document.createElement('div');
      Object.assign(badge.style, {
        fontSize:'12px', color:'#666', margin:'4px 0 12px 0'
      });
      badge.textContent = `— Ghép từ: ${nextHref} —`;
      wrapper.appendChild(badge);

      // clone sạch script/style
      const frag = document.createElement('div');
      frag.innerHTML = root.innerHTML;
      frag.querySelectorAll('script, style, link[rel="preload"], link[rel="modulepreload"]').forEach(n=>n.remove());
      // tránh id trùng
      frag.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
      wrapper.appendChild(frag);

      // chèn vào cuối phần chính của trang hiện tại
      const hereRoot = chooseContentRoot(document) || document.body;
      hereRoot.appendChild(wrapper);

      appendedURLs.add(nextHref);
      showToast('Đã ghép trang tiếp');
    }catch(e){
      console.error(e);
      showToast('Lỗi khi tải trang tiếp');
    }finally{
      isAppending = false;
    }
  }

  // ===== Actions =====
  function doPrev(){ /* Không back trang. Yêu cầu mới: trái = về đầu trang */ fastScrollTop(); }
  function doNext(){ appendNextPage(); }
  function doFirst(){ const href = findLinkFirst(); if (href) location.href = href; else fastScrollTop(); }
  function doLast(){ const href = findLinkLast(); if (href) location.href = href; else appendNextPage(); }

  function fastScrollTop(){
    try{ window.scrollTo({ top: 0, behavior: 'smooth' }); }
    catch{ window.scrollTo(0,0); }
    showToast('Về đầu trang');
  }

  // ===== Gesture state =====
  let accDX = 0, lastDir = 0, countSameDir = 0, timer = null;
  function resetWindow(){ accDX=0; lastDir=0; countSameDir=0; clearTimeout(timer); timer=null; }

  function registerGesture(dir){
    if (dir === 0) return;
    if (dir === lastDir) countSameDir++; else { lastDir = dir; countSameDir = 1; }
    clearTimeout(timer); timer = setTimeout(resetWindow, GESTURE_WINDOW_MS);

    if (countSameDir >= TRIPLE_TO_EDGE) {
      if (dir > 0) { showToast('▶▶▶ Trang cuối'); doLast(); }
      else { showToast('◀◀◀ Trang đầu'); doFirst(); }
      resetWindow(); return;
    }
    if (dir > 0) { showToast('▶ Trang tiếp'); doNext(); }
    else { showToast('◀ Về đầu'); doPrev(); }
  }

  // ===== Wheel (desktop) =====
  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
    const t = e.target;
    if (isEditable(t)) return;
    if (inHorizScrollableChain(t)) return;
    accDX += e.deltaX;
    if (Math.abs(accDX) >= WHEEL_THRESHOLD) {
      const dir = accDX > 0 ? +1 : -1; // phải → Next/Append
      accDX = 0; registerGesture(dir);
      e.preventDefault(); e.stopPropagation();
    }
  }, { passive: false });

  // ===== Touch (mobile/tablet) =====
  let tX = null, tY = null;
  window.addEventListener('touchstart', (e) => {
    const t = e.target;
    if (isEditable(t) || inHorizScrollableChain(t)) { tX = null; return; }
    const c = e.changedTouches[0]; tX = c.clientX; tY = c.clientY;
  }, { passive: true });

  window.addEventListener('touchend', (e) => {
    if (tX == null) return;
    const c = e.changedTouches[0];
    const dx = c.clientX - tX, dy = c.clientY - tY;
    tX = null;
    if (Math.abs(dx) < Math.abs(dy)) return;
    if (Math.abs(dx) < TOUCH_THRESHOLD) return;
    const dir = dx > 0 ? -1 : +1; // yêu cầu: trái=Next/Append, phải=Top
    registerGesture(dir);
    e.preventDefault();
  }, { passive: false });

  // ===== Shift để tắt tạm =====
  window.addEventListener('keydown', (e)=>{ if (e.key==='Shift') window.__forumPagerDisabled = true; });
  window.addEventListener('keyup',   (e)=>{ if (e.key==='Shift') window.__forumPagerDisabled = false; });
  const _reg = registerGesture; registerGesture = (dir)=>{ if (!window.__forumPagerDisabled) _reg(dir); };
})();
