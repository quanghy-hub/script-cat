// ==UserScript==
// @name         translate
// @namespace    vn.inline.translate.ctrl.swipe
// @version      1.7.0
// @description  Ctrl (desktop) hoặc Vuốt ngang (mobile) để chèn bản dịch ngay dưới đoạn/câu. Tự động: nếu nguồn KHÔNG phải tiếng Việt → dịch sang VI; nếu nguồn là tiếng Việt → dịch sang EN. Nhấn lại để hoàn tác. Cấu hình dùng chung mọi trang. Không có “giữ lâu”.
// @author       you
// @updateURL   https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/translate.js
// @downloadURL https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/translate.js
// @match        http://*/*
// @match        https://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      clients5.google.com
// @connect      generativelanguage.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ========= Storage (GLOBAL) =========
  const GLOBAL_KEY = 'inline_t_cfg::GLOBAL';
  const defaults = {
    mode: 'paragraph',           // 'sentence' | 'paragraph'
    provider: 'google',          // 'google' | 'gemini'
    geminiKey: '',
    geminiModel: 'gemini-1.5-flash',
    // Swipe (VideoHelper-style)
    swipeEnabled: true,
    swipePx: 60,
    swipeSlopeMax: 0.5,
    swipeDir: 'both',
    swipeVHMode: true,
    scrubThrottleMs: 80,
    // Chọn để dịch
    selectEnabled: false,
    // Hiển thị
    fontScale: 0.95,
    italic: true,
    mutedColor: '#666',
    bgBlend: 'transparent',
    // Khác
    maxChars: 2000,
    dedupeSeconds: 0.7,          // chỉ chống double-insert, không cản hoàn tác
    showPanelOnStart: false
  };
  const cfg = loadCfg();
  function loadCfg(){ try{ const s=GM_getValue(GLOBAL_KEY); return s?{...defaults,...JSON.parse(s)}:{...defaults}; }catch{ return {...defaults}; } }
  function saveCfg(){ GM_setValue(GLOBAL_KEY, JSON.stringify(cfg)); }

  // ========= Styles =========
  const style = document.createElement('style');
  style.textContent = `
  :root{ --ilt-fs:${cfg.fontScale}em; --ilt-it:${cfg.italic?'italic':'normal'}; --ilt-fg:${cfg.mutedColor}; --ilt-bg:${cfg.bgBlend||'transparent'} }
  .ilt-panel{position:fixed;z-index:2147483646;top:16px;right:16px;background:#111a;border:1px solid #444;border-radius:12px;padding:12px 14px;color:#eee;font:14px/1.4 system-ui,Segoe UI,Roboto,Arial;max-width:360px;touch-action:manipulation}
  .ilt-panel h3{margin:0 0 8px;font-size:14px;font-weight:600}
  .ilt-row{display:flex;align-items:center;gap:8px;margin:6px 0}
  .ilt-row label{min-width:150px;color:#ccc}
  .ilt-panel input[type="text"], .ilt-panel input[type="number"], .ilt-panel select{width:160px;padding:4px 6px;background:#222;border:1px solid #444;border-radius:8px;color:#eee}
  .ilt-panel input[type="checkbox"]{transform:scale(1.1)}
  .ilt-panel button{padding:6px 10px;border:1px solid #555;background:#1e1e1e;color:#eee;border-radius:8px;cursor:pointer}
  .ilt-trans{margin-top:6px;padding:6px 8px;border-left:3px solid #999;border-radius:4px;background:var(--ilt-bg,transparent);color:var(--ilt-fg,#666);font-style:var(--ilt-it,italic);font-size:var(--ilt-fs,0.95em)}
  .ilt-trans[data-state="loading"]{opacity:0.7}
  .ilt-trans .ilt-meta{font-size:11px;opacity:0.75;margin-bottom:2px}
  `;
  document.head.appendChild(style);

  // ========= Panel =========
  let panel;
  function buildPanel(){
    if(panel) return panel;
    panel = document.createElement('div');
    panel.className = 'ilt-panel';
    panel.innerHTML = `
      <h3>Inline Translate <span style="opacity:.7">Cấu hình chung</span></h3>

      <div class="ilt-row"><label>Chế độ dịch</label>
        <select id="ilt-mode">
          <option value="sentence" ${cfg.mode==='sentence'?'selected':''}>Dòng/Câu</option>
          <option value="paragraph" ${cfg.mode==='paragraph'?'selected':''}>Đoạn</option>
        </select>
      </div>

      <div class="ilt-row"><label>Nhà cung cấp</label>
        <select id="ilt-provider">
          <option value="google" ${cfg.provider==='google'?'selected':''}>Google (miễn phí)</option>
          <option value="gemini" ${cfg.provider==='gemini'?'selected':''}>Gemini (API)</option>
        </select>
      </div>
      <div class="ilt-row"><label>Gemini API Key</label><input id="ilt-gkey" type="text" placeholder="AIza..." value="${cfg.geminiKey}"></div>
      <div class="ilt-row"><label>Gemini Model</label><input id="ilt-gmodel" type="text" value="${cfg.geminiModel}"></div>

      <div class="ilt-row"><label>Vuốt để dịch</label><input id="ilt-swipe" type="checkbox" ${cfg.swipeEnabled?'checked':''}><span>Kiểu VideoHelper</span></div>
      <div class="ilt-row"><label>Hướng vuốt</label>
        <select id="ilt-swipeDir">
          <option value="both" ${cfg.swipeDir==='both'?'selected':''}>Cả hai</option>
          <option value="left" ${cfg.swipeDir==='left'?'selected':''}>Trái</option>
          <option value="right" ${cfg.swipeDir==='right'?'selected':''}>Phải</option>
        </select>
      </div>
      <div class="ilt-row"><label>Ngưỡng vuốt (px)</label><input id="ilt-swipePx" type="number" min="24" max="300" step="2" value="${cfg.swipePx}"></div>
      <div class="ilt-row"><label>Độ dốc tối đa |dy/dx|</label><input id="ilt-slope" type="number" min="0.1" max="1" step="0.05" value="${cfg.swipeSlopeMax}"></div>
      <div class="ilt-row"><label>Throttle (ms)</label><input id="ilt-throttle" type="number" min="0" max="500" step="5" value="${cfg.scrubThrottleMs}"></div>

      <div class="ilt-row"><label>Dịch khi bôi đen</label><input id="ilt-select" type="checkbox" ${cfg.selectEnabled?'checked':''}></div>

      <div class="ilt-row"><label>Font tỉ lệ</label><input id="ilt-fs" type="number" min="0.6" max="1.2" step="0.01" value="${cfg.fontScale}"></div>
      <div class="ilt-row"><label>Chữ nghiêng</label><input id="ilt-it" type="checkbox" ${cfg.italic?'checked':''}></div>
      <div class="ilt-row"><label>Màu chữ</label><input id="ilt-fg" type="text" value="${cfg.mutedColor}"></div>
      <div class="ilt-row"><label>Nền</label><input id="ilt-bg" type="text" value="${cfg.bgBlend}"></div>
      <div class="ilt-row"><label>Mở bảng khi vào trang</label><input id="ilt-start" type="checkbox" ${cfg.showPanelOnStart?'checked':''}></div>

      <div class="ilt-row" style="gap:8px;flex-wrap:wrap">
        <button id="ilt-save">Lưu</button><button id="ilt-close">Đóng</button><button id="ilt-warn">Kiểm tra quyền mạng</button>
      </div>
    `;
    document.body.appendChild(panel);
    const $ = (id)=>panel.querySelector(id);
    $('#ilt-save').onclick = () => {
      cfg.mode = $('#ilt-mode').value;
      cfg.provider = $('#ilt-provider').value;
      cfg.geminiKey = $('#ilt-gkey').value.trim();
      cfg.geminiModel = $('#ilt-gmodel').value.trim() || 'gemini-1.5-flash';

      cfg.swipeEnabled = $('#ilt-swipe').checked;
      cfg.swipeDir = $('#ilt-swipeDir').value;
      cfg.swipePx = clamp(+$('#ilt-swipePx').value, 24, 300, cfg.swipePx);
      cfg.swipeSlopeMax = clamp(+$('#ilt-slope').value, 0.1, 1, cfg.swipeSlopeMax);
      cfg.scrubThrottleMs = clamp(+$('#ilt-throttle').value, 0, 500, cfg.scrubThrottleMs);

      cfg.selectEnabled = $('#ilt-select').checked;

      cfg.fontScale = clamp(+$('#ilt-fs').value, 0.6, 1.2, cfg.fontScale);
      cfg.italic = $('#ilt-it').checked;
      cfg.mutedColor = $('#ilt-fg').value.trim() || cfg.mutedColor;
      cfg.bgBlend = $('#ilt-bg').value.trim();
      cfg.showPanelOnStart = $('#ilt-start').checked;

      saveCfg(); applyRuntimeStyle(); notify('Đã lưu cấu hình');
    };
    $('#ilt-close').onclick = () => { panel.remove(); panel=null; };
    $('#ilt-warn').onclick = () => notify('Google/Gemini đã cấp quyền @connect. VPN chung có thể bị chặn IP.');
    return panel;
  }
  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('⚙️ Inline Translate: Cài đặt', () => { buildPanel(); });
    GM_registerMenuCommand('🗑 Xóa tất cả bản dịch', () => {
      document.querySelectorAll('.ilt-trans').forEach(e=>e.remove());
      notify('Đã xóa bản dịch');
    });
  }

  function clamp(v,min,max,fallback){ return Number.isFinite(v)?Math.min(max,Math.max(min,v)):fallback; }
  function notify(msg){ const n=document.createElement('div'); n.textContent=msg;
    Object.assign(n.style,{position:'fixed',bottom:'16px',right:'16px',background:'#111a',color:'#eee',border:'1px solid #444',padding:'8px 10px',borderRadius:'8px',zIndex:2147483647});
    document.body.appendChild(n); setTimeout(()=>n.remove(),1400);
  }
  function applyRuntimeStyle(){
    document.documentElement.style.setProperty('--ilt-fs', `${cfg.fontScale}em`);
    document.documentElement.style.setProperty('--ilt-it', cfg.italic?'italic':'normal');
    document.documentElement.style.setProperty('--ilt-fg', cfg.mutedColor);
    document.documentElement.style.setProperty('--ilt-bg', cfg.bgBlend || 'transparent');
  }
  applyRuntimeStyle();
  if (cfg.showPanelOnStart) buildPanel();

  // ========= Hit test =========
  let lastMouse = {x:0,y:0};
  document.addEventListener('mousemove', e => { lastMouse.x=e.clientX; lastMouse.y=e.clientY; }, {passive:true});

  function caretRangeFromPointSafe(x,y){
    const el = document.elementFromPoint(x,y); if(!el) return null;
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x,y);
    if (document.caretPositionFromPoint){ const p=document.caretPositionFromPoint(x,y);
      if(!p) return null; const r=document.createRange(); r.setStart(p.offsetNode,p.offset); r.collapse(true); return r; }
    const r=document.createRange(); r.setStart(el,0); r.collapse(true); return r;
  }
  function descendToText(el){ if(!el) return null; if(el.nodeType===3) return el;
    for(const c of el.childNodes){ const t=descendToText(c); if(t && t.nodeValue.trim()) return t; } return null; }
  function closestBlock(node){
    if(!node) return document.body;
    let el = node.nodeType===1 ? node : node.parentElement;
    while(el && el!==document.body){ const d=getComputedStyle(el).display;
      if (/(block|list-item|table|grid|flex)/.test(d)) return el; el=el.parentElement; }
    return document.body;
  }
  function getTextAtPoint(x,y){
    const range = caretRangeFromPointSafe(x,y);
    if(!range || !range.startContainer) return null;
    let node = range.startContainer;
    if(node.nodeType!==3){ const t = descendToText(node); if(t) node=t; else return null; }
    const container = closestBlock(node);
    if (cfg.mode === 'paragraph') {
      const raw = (container?.innerText || container?.textContent || '').trim();
      if(!raw) return null;
      return { text: raw.slice(0,cfg.maxChars), container };
    } else {
      const text = node.data || ''; const idx = range.startOffset ?? 0;
      const left = text.slice(0, idx), right = text.slice(idx);
      const leftSplit = left.split(/(?<=[\.!?…])\s+/);
      const rightSplit = right.split(/(?<=[\.!?…])\s+/);
      const leftPart = leftSplit.length ? leftSplit[leftSplit.length - 1] : left;
      const rightPart = rightSplit.length ? rightSplit[0] : right;
      const sentence = (leftPart + rightPart).trim().slice(0,cfg.maxChars);
      if(!sentence) return null;
      return { text: sentence, container };
    }
  }
  function getSelectionHit(){
    const sel = window.getSelection();
    if(!sel || sel.isCollapsed) return null;
    const txt = sel.toString().trim(); if(!txt) return null;
    const node = sel.anchorNode || sel.focusNode;
    return { text: txt.slice(0,cfg.maxChars), container: closestBlock(node) };
  }

  // ========= Language helpers =========
  const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  function looksVietnamese(s){
    if (!s) return false;
    if (VI_CHARS.test(s)) return true;
    const k = /\b(và|là|của|nhưng|với|trong|không|một|những|được|này|khi|đã|tôi|bạn)\b/i;
    return k.test(s);
  }

  // ========= Translate (auto VI↔EN) =========
  const recent = new Map(); // text -> ts
  function tooSoon(text){ // chỉ ngăn double-insert, KHÔNG ngăn hoàn tác
    const now=performance.now()/1000, t=recent.get(text);
    if(t && now-t<cfg.dedupeSeconds) return true;
    recent.set(text, now); return false;
  }

  async function translateAuto(text){
    if (cfg.provider === 'gemini') {
      const target = looksVietnamese(text) ? 'en' : 'vi';
      const translated = await translateGemini(text, target);
      return {translated, src: looksVietnamese(text)?'vi':'auto'};
    } else {
      const det = await translateGoogle(text, 'vi');
      const src = det.src || 'auto';
      if (String(src).toLowerCase().startsWith('vi')) {
        const en = await translateGoogle(text, 'en');
        return {translated: en.translated, src: 'vi'};
      } else {
        return det; // đã là VI
      }
    }
  }

  function parseGoogleBody(body){
    // body có thể là object, array, hoặc string có XSSI ")]}'"
    if (typeof body === 'string'){
      let s = body.trim();
      if (s.startsWith(")]}'")) s = s.replace(/^\)\]\}'\s*\n?/, '');
      const data = JSON.parse(s);
      return data;
    }
    return body;
  }

  function translateGoogle(text, target){
    const u1 = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}&ie=UTF-8&oe=UTF-8`;
    const u2 = `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodeURIComponent(target)}&q=${encodeURIComponent(text)}`;
    const urls = [u1, u2];
    let lastErr = null;
    return new Promise((resolve,reject)=>{
      const tryAt = (i)=>{
        if(i>=urls.length) return reject(lastErr||new Error('Google: thất bại'));
        GM_xmlhttpRequest({
          method:'GET', url: urls[i], timeout: 12000,
          onload: res=>{
            try{
              const raw = res.response ?? res.responseText ?? '';
              const data = parseGoogleBody(raw);
              // dạng mảng (gtx)
              if (Array.isArray(data)){
                const out = (data[0]||[]).map(a=>a && a[0] || '').join('');
                const src = (data[2] && data[2]) || 'auto';
                resolve({translated: out, src}); return;
              }
              // dạng object (clients5)
              if (data && data.sentences){
                const out = (data.sentences||[]).map(s=>s.trans || s.translit || '').join('');
                const src = data.src || 'auto';
                resolve({translated: out, src}); return;
              }
              throw new Error('Google: định dạng lạ');
            }catch(e){
              lastErr = e; tryAt(i+1);
            }
          },
          onerror: err=>{ lastErr = err; tryAt(i+1); },
          ontimeout: ()=>{ lastErr = new Error('Google: timeout'); tryAt(i+1); }
        });
      };
      tryAt(0);
    });
  }

  function translateGemini(text, target){
    return new Promise((resolve,reject)=>{
      if(!cfg.geminiKey){ reject(new Error('Thiếu Gemini API key')); return; }
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent?key=${encodeURIComponent(cfg.geminiKey)}`;
      const body = {
        contents: [{ role:'user', parts:[{ text:
`Translate strictly into ${target}. Preserve meaning. Output translation only.

TEXT:
${text}` }]}],
        generationConfig: { temperature: 0 }
      };
      GM_xmlhttpRequest({
        method:'POST', url:endpoint, data: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' }, responseType:'json', timeout: 15000,
        onload: res=>{ try{
          const data = res.response || JSON.parse(res.responseText);
          const cand = data?.candidates?.[0];
          const t = cand?.content?.parts?.[0]?.text;
          if(!t) throw new Error('Gemini: không nhận được văn bản');
          resolve(t.trim());
        }catch(e){ reject(e); } },
        onerror: err=>reject(err),
        ontimeout: ()=>reject(new Error('Gemini: timeout'))
      });
    });
  }

  // ========= Toggle insert/remove =========
  function toggleTranslate(container, original){
    const existed = container.querySelector(':scope > .ilt-trans');
    if (existed){ existed.remove(); return; }     // hoàn tác
    if (tooSoon(original)) return;                // chặn double-insert do một thao tác phát nhiều sự kiện
    insertTranslation(container, original);       // chèn
  }

  function insertTranslation(container, original){
    const div = document.createElement('div');
    div.className = 'ilt-trans';
    div.dataset.state = 'loading';
    div.innerHTML = `<div class="ilt-meta">Đang dịch… (${cfg.provider})</div>`;
    container.appendChild(div);
    translateAuto(original).then(({translated})=>{
      div.dataset.state = 'done';
      div.innerHTML = `<div class="ilt-txt">${escapeHTML(translated)}</div>`;
    }).catch(err=>{
      div.dataset.state='error';
      div.innerHTML = `<div class="ilt-meta">Lỗi: ${escapeHTML(String(err?.message||err))}</div>`;
      // giữ lại 2s để đọc lỗi rồi tự xóa cho sạch
      setTimeout(()=>{ try{div.remove();}catch{} }, 2000);
    });
  }
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ========= Triggers =========
  // Desktop: Ctrl tại điểm trỏ
  document.addEventListener('keydown', e=>{
    if(e.key!=='Control') return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(input|textarea|select)$/i.test(a.tagName))) return;
    const hit = getTextAtPoint(lastMouse.x,lastMouse.y);
    if(!hit) return;
    toggleTranslate(hit.container, hit.text);
  }, true);

  // Mobile: Swipe kiểu VideoHelper
  let swipe = {startX:0,startY:0};
  let swiping = false, suppressScroll = false, lastMoveTs = 0;
  function touchStart(e){
    if(!cfg.swipeEnabled || !cfg.swipeVHMode) return;
    if(e.touches?.length!==1) return;
    swipe.startX = e.touches[0].clientX;
    swipe.startY = e.touches[0].clientY;
    swiping = false; suppressScroll = false;
  }
  function touchMove(e){
    if(!cfg.swipeEnabled || !cfg.swipeVHMode) return;
    if(e.touches?.length!==1) return;
    const now = performance.now();
    if (now - lastMoveTs < cfg.scrubThrottleMs) return;
    lastMoveTs = now;

    const dx = e.touches[0].clientX - swipe.startX;
    const dy = e.touches[0].clientY - swipe.startY;
    if (!swiping){
      if (Math.abs(dx) >= 10 && Math.abs(dy)/Math.max(Math.abs(dx),1) <= cfg.swipeSlopeMax){
        swiping = true; suppressScroll = true;
        document.documentElement.style.touchAction = 'none';
      }
    }
    if (suppressScroll && e.cancelable) e.preventDefault();
  }
  function touchEnd(e){
    if(!cfg.swipeEnabled || !cfg.swipeVHMode) return;
    document.documentElement.style.touchAction = '';
    if (!swiping) return;
    const x = (e.changedTouches?.[0]?.clientX ?? swipe.startX);
    const y = (e.changedTouches?.[0]?.clientY ?? swipe.startY);
    const dx = x - swipe.startX;
    const dy = y - swipe.startY;
    if (Math.abs(dx) < cfg.swipePx) return;
    if (Math.abs(dy)/Math.max(Math.abs(dx),1) > cfg.swipeSlopeMax) return;
    const dir = dx > 0 ? 'right' : 'left';
    if(cfg.swipeDir !== 'both' && cfg.swipeDir !== dir) return;
    const hit = getTextAtPoint(swipe.startX, swipe.startY);
    if(!hit) return;
    toggleTranslate(hit.container, hit.text);
  }
  document.addEventListener('touchstart', touchStart, {capture:true, passive:false});
  document.addEventListener('touchmove',  touchMove,  {capture:true, passive:false});
  document.addEventListener('touchend',   touchEnd,   {capture:true, passive:false});
  document.addEventListener('touchcancel',()=>{ document.documentElement.style.touchAction=''; swiping=false; }, {capture:true});

  // Chọn để dịch
  function handlePossibleSelection(){
    if(!cfg.selectEnabled) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || /^(input|textarea|select)$/i.test(a.tagName))) return;
    const hit = getSelectionHit();
    if(!hit) return;
    toggleTranslate(hit.container, hit.text);
    try{ const sel = window.getSelection(); sel.removeAllRanges(); }catch{}
  }
  document.addEventListener('mouseup', () => setTimeout(handlePossibleSelection, 0), true);
  document.addEventListener('keyup',  () => setTimeout(handlePossibleSelection, 0), true);

  // ========= Misc =========
  document.addEventListener('keydown', e=>{
    if(e.altKey && e.shiftKey && (e.key.toLowerCase?.()==='t')){ e.preventDefault(); buildPanel(); }
  }, true);
  const mo = new MutationObserver(()=>applyRuntimeStyle());
  mo.observe(document.documentElement,{subtree:true, childList:true});
  document.addEventListener('pointerdown', e=>{ if(panel && panel.contains(e.target)) e.stopPropagation(); }, true);

})();
