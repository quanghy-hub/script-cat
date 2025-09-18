// ==UserScript==
// @name         Inline Translate: Ctrl/Swipe → Insert Below (Paragraph/Gemini)
// @namespace    vn.inline.translate.ctrl.swipe
// @version      1.1.0
// @description  Dịch ngay dưới văn bản gốc: Ctrl trên vị trí trỏ hoặc vuốt trái/phải. Chọn chế độ Dòng/câu hoặc Đoạn. Nhà cung cấp: Google miễn phí hoặc Gemini (API key). Panel cài đặt trong ScriptCat.
// @author       you
// @match        http://*/*
// @match        https://*/*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      generativelanguage.googleapis.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  'use strict';

  // ---------- Storage ----------
  const HOST_KEY = `inline_t_cfg::${location.host}`;
  const defaults = {
    targetLang: navigator.language?.slice(0,2) || 'vi',
    mode: 'paragraph',       // 'sentence' | 'paragraph'
    provider: 'google',      // 'google' | 'gemini'
    geminiKey: '',
    geminiModel: 'gemini-1.5-flash',
    swipeEnabled: true,
    swipePx: 60,
    swipeSlopeMax: 0.5,
    fontScale: 0.95,
    italic: true,
    mutedColor: '#666',
    bgBlend: 'transparent',
    maxChars: 2000,
    dedupeSeconds: 2,
    showPanelOnStart: false
  };
  const cfg = loadCfg();
  function loadCfg(){ try{ const s=GM_getValue(HOST_KEY); return s?{...defaults,...JSON.parse(s)}:{...defaults}; }catch{ return {...defaults}; } }
  function saveCfg(){ GM_setValue(HOST_KEY, JSON.stringify(cfg)); }

  // ---------- Styles ----------
  const style = document.createElement('style');
  style.textContent = `
  .ilt-panel{position:fixed;z-index:2147483646;top:16px;right:16px;background:#111a;border:1px solid #444;border-radius:12px;padding:12px 14px;color:#eee;font:14px/1.4 system-ui,Segoe UI,Roboto,Arial;backdrop-filter:saturate(1.2) blur(6px)}
  .ilt-panel h3{margin:0 0 8px;font-size:14px;font-weight:600}
  .ilt-row{display:flex;align-items:center;gap:8px;margin:6px 0}
  .ilt-row label{min-width:120px;color:#ccc}
  .ilt-panel input[type="text"], .ilt-panel input[type="number"], .ilt-panel select{width:160px;padding:4px 6px;background:#222;border:1px solid #444;border-radius:8px;color:#eee}
  .ilt-panel input[type="checkbox"]{transform:scale(1.1)}
  .ilt-panel button{padding:6px 10px;border:1px solid #555;background:#1e1e1e;color:#eee;border-radius:8px;cursor:pointer}
  .ilt-panel .rowsp{display:flex;gap:8px;flex-wrap:wrap}
  .ilt-tag{display:inline-block;padding:1px 6px;border-radius:999px;border:1px solid #555;color:#ddd;font-size:12px;margin-left:6px}
  .ilt-trans{margin-top:6px;padding:6px 8px;border-left:3px solid #999;border-radius:4px;background:var(--ilt-bg,transparent);color:var(--ilt-fg,#666);font-style:var(--ilt-it,italic);font-size:var(--ilt-fs,0.95em)}
  .ilt-trans[data-state="loading"]{opacity:0.7}
  .ilt-trans .ilt-meta{font-size:11px;opacity:0.75;margin-bottom:2px}
  `;
  document.head.appendChild(style);

  // ---------- Panel ----------
  let panel;
  function buildPanel(){
    if(panel) return panel;
    panel = document.createElement('div');
    panel.className = 'ilt-panel';
    panel.innerHTML = `
      <h3>Inline Translate <span class="ilt-tag">${location.host}</span></h3>
      <div class="ilt-row"><label>Target</label>
        <input id="ilt-lang" type="text" maxlength="10" value="${cfg.targetLang}">
      </div>
      <div class="ilt-row"><label>Chế độ</label>
        <select id="ilt-mode">
          <option value="sentence" ${cfg.mode==='sentence'?'selected':''}>Dòng/câu</option>
          <option value="paragraph" ${cfg.mode==='paragraph'?'selected':''}>Đoạn</option>
        </select>
      </div>
      <div class="ilt-row"><label>Provider</label>
        <select id="ilt-provider">
          <option value="google" ${cfg.provider==='google'?'selected':''}>Google (miễn phí)</option>
          <option value="gemini" ${cfg.provider==='gemini'?'selected':''}>Gemini (API)</option>
        </select>
      </div>
      <div class="ilt-row"><label>Gemini Key</label>
        <input id="ilt-gkey" type="text" placeholder="AIza..." value="${cfg.geminiKey}">
      </div>
      <div class="ilt-row"><label>Gemini Model</label>
        <input id="ilt-gmodel" type="text" value="${cfg.geminiModel}">
      </div>
      <div class="ilt-row"><label>Swipe</label>
        <input id="ilt-swipe" type="checkbox" ${cfg.swipeEnabled?'checked':''}>
        <span>Vuốt trái/phải để dịch</span>
      </div>
      <div class="ilt-row"><label>Swipe px</label>
        <input id="ilt-swipePx" type="number" min="24" max="300" step="2" value="${cfg.swipePx}">
      </div>
      <div class="ilt-row"><label>Font scale</label>
        <input id="ilt-fs" type="number" min="0.6" max="1.2" step="0.01" value="${cfg.fontScale}">
      </div>
      <div class="ilt-row"><label>Italic</label>
        <input id="ilt-it" type="checkbox" ${cfg.italic?'checked':''}>
      </div>
      <div class="ilt-row"><label>Color</label>
        <input id="ilt-fg" type="text" value="${cfg.mutedColor}">
      </div>
      <div class="ilt-row"><label>Background</label>
        <input id="ilt-bg" type="text" value="${cfg.bgBlend}">
      </div>
      <div class="ilt-row"><label>Show on start</label>
        <input id="ilt-start" type="checkbox" ${cfg.showPanelOnStart?'checked':''}>
      </div>
      <div class="ilt-row rowsp">
        <button id="ilt-save">Save</button>
        <button id="ilt-close">Close</button>
        <button id="ilt-warn">Test quyền mạng</button>
      </div>
      <div style="margin-top:6px;font-size:12px;color:#aaa">
        Dùng: Trỏ vào văn bản và nhấn <b>Ctrl</b>, hoặc vuốt ngang.
      </div>
    `;
    document.body.appendChild(panel);
    const $ = (id)=>panel.querySelector(id);
    $('#ilt-save').onclick = () => {
      cfg.targetLang = $('#ilt-lang').value.trim() || cfg.targetLang;
      cfg.mode = $('#ilt-mode').value;
      cfg.provider = $('#ilt-provider').value;
      cfg.geminiKey = $('#ilt-gkey').value.trim();
      cfg.geminiModel = $('#ilt-gmodel').value.trim() || 'gemini-1.5-flash';
      cfg.swipeEnabled = $('#ilt-swipe').checked;
      cfg.swipePx = clamp(+$('#ilt-swipePx').value, 24, 300, cfg.swipePx);
      cfg.fontScale = clamp(+$('#ilt-fs').value, 0.6, 1.2, cfg.fontScale);
      cfg.italic = $('#ilt-it').checked;
      cfg.mutedColor = $('#ilt-fg').value.trim() || cfg.mutedColor;
      cfg.bgBlend = $('#ilt-bg').value.trim();
      cfg.showPanelOnStart = $('#ilt-start').checked;
      saveCfg(); applyRuntimeStyle(); notify('Saved');
    };
    $('#ilt-close').onclick = () => { panel.remove(); panel=null; };
    $('#ilt-warn').onclick = () => notify('Nếu Gemini: cần API key hợp lệ và @connect generativelanguage.googleapis.com');
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
    document.body.appendChild(n); setTimeout(()=>n.remove(),1200);
  }
  function applyRuntimeStyle(){
    document.documentElement.style.setProperty('--ilt-fs', `${cfg.fontScale}em`);
    document.documentElement.style.setProperty('--ilt-it', cfg.italic?'italic':'normal');
    document.documentElement.style.setProperty('--ilt-fg', cfg.mutedColor);
    document.documentElement.style.setProperty('--ilt-bg', cfg.bgBlend || 'transparent');
  }
  applyRuntimeStyle();
  if (cfg.showPanelOnStart) buildPanel();

  // ---------- Hit test ----------
  let lastMouse = {x:0,y:0};
  document.addEventListener('mousemove', e => { lastMouse.x=e.clientX; lastMouse.y=e.clientY; }, {passive:true});

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

  function caretRangeFromPointSafe(x,y){
    const el = document.elementFromPoint(x,y); if(!el) return null;
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x,y);
    if (document.caretPositionFromPoint){
      const pos = document.caretPositionFromPoint(x,y); if(!pos) return null;
      const r=document.createRange(); r.setStart(pos.offsetNode,pos.offset); r.collapse(true); return r;
    }
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.nodeValue.trim()?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_REJECT
    });
    const textNode = walker.nextNode(); if(!textNode) return null;
    const r=document.createRange(); r.setStart(textNode,0); r.collapse(true); return r;
  }
  function descendToText(el){ if(!el) return null; if(el.nodeType===3) return el;
    for(const c of el.childNodes){ const t=descendToText(c); if(t && t.nodeValue.trim()) return t; } return null; }
  function closestBlock(node){
    let el = node.nodeType===1 ? node : node.parentElement;
    while(el && el!==document.body){ const d=getComputedStyle(el).display;
      if (/(block|list-item|table|grid|flex)/.test(d)) return el; el=el.parentElement; }
    return document.body;
  }

  // ---------- Translate ----------
  const recent = new Map(); // text -> ts
  function shouldSkip(text){
    const t=recent.get(text), now=performance.now()/1000;
    if(t && now-t<cfg.dedupeSeconds) return true;
    recent.set(text, now); return false;
  }

  async function translate(text, target){
    if (cfg.provider === 'gemini') return translateGemini(text, target);
    return translateGoogle(text, target);
  }

  function translateGoogle(text, target){
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    return new Promise((resolve,reject)=>{
      GM_xmlhttpRequest({
        method:'GET', url, responseType:'json',
        onload: res=>{
          try{
            const data = res.response || JSON.parse(res.responseText);
            const out = (data[0]||[]).map(a=>a[0]).join('');
            const src = (data[2] && data[2]) || 'auto';
            resolve({translated: out, src});
          }catch(e){ reject(e); }
        }, onerror: err=>reject(err)
      });
    });
  }

  function translateGemini(text, target){
    return new Promise((resolve,reject)=>{
      if(!cfg.geminiKey){ reject(new Error('Thiếu Gemini API key')); return; }
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.geminiModel)}:generateContent?key=${encodeURIComponent(cfg.geminiKey)}`;
      const body = {
        contents: [{
          role: 'user',
          parts: [{ text:
`Translate the text strictly into ${target}. Preserve meaning. Output translation only, no extra notes.

TEXT:
${text}` }]
        }],
        generationConfig: { temperature: 0 }
      };
      GM_xmlhttpRequest({
        method:'POST', url:endpoint, data: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
        responseType:'json',
        onload: res=>{
          try{
            const data = res.response || JSON.parse(res.responseText);
            const cand = data.candidates && data.candidates[0];
            const t = cand && cand.content && cand.content.parts && cand.content.parts[0] && cand.content.parts[0].text;
            if(!t) throw new Error('Gemini: không nhận được văn bản');
            resolve({ translated: t.trim(), src: 'auto' });
          }catch(e){ reject(e); }
        },
        onerror: err=>reject(err)
      });
    });
  }

  function insertTranslation(container, original){
    const key = original.slice(0,200); // id ngắn
    const existing = Array.from(container.querySelectorAll(':scope > .ilt-trans')).find(e => e.dataset.orig === key);
    if (existing) { existing.remove(); return; }

    const div = document.createElement('div');
    div.className = 'ilt-trans';
    div.dataset.orig = key;
    div.dataset.state = 'loading';
    div.innerHTML = `<div class="ilt-meta">Translating… (${cfg.provider})</div>`;
    container.appendChild(div);

    translate(original, cfg.targetLang).then(({translated, src})=>{
      div.dataset.state = 'done';
      const lang = cfg.targetLang;
      div.innerHTML = `
        <div class="ilt-meta">➡️ ${src} → ${lang} · ${cfg.mode} · ${cfg.provider}</div>
        <div class="ilt-txt">${escapeHTML(translated)}</div>
      `;
    }).catch(err=>{
      div.dataset.state='error';
      div.innerHTML = `<div class="ilt-meta">Error: ${escapeHTML(String(err?.message||err))}</div>`;
      setTimeout(()=>div.remove(), 3000);
    });
  }
  function escapeHTML(s){ return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  // ---------- Triggers ----------
  document.addEventListener('keydown', e=>{
    if(e.key!=='Control') return;
    const active = document.activeElement;
    if (active && (active.isContentEditable || /^(input|textarea|select)$/i.test(active.tagName))) return;
    const hit = getTextAtPoint(lastMouse.x,lastMouse.y);
    if(!hit) return;
    if(shouldSkip(hit.text)) return;
    insertTranslation(hit.container, hit.text);
  }, true);

  let swipe = {startX:0,startY:0};
  function pointerDown(e){ if(!cfg.swipeEnabled) return; swipe.startX=e.clientX; swipe.startY=e.clientY; }
  function pointerUp(e){
    if(!cfg.swipeEnabled) return;
    const dx=e.clientX-swipe.startX, dy=e.clientY-swipe.startY;
    if(Math.abs(dx)<cfg.swipePx) return;
    if(Math.abs(dy)/Math.max(Math.abs(dx),1) > cfg.swipeSlopeMax) return;
    const hit = getTextAtPoint(swipe.startX, swipe.startY);
    if(!hit) return;
    if(shouldSkip(hit.text)) return;
    insertTranslation(hit.container, hit.text);
  }
  document.addEventListener('pointerdown', pointerDown, {capture:true, passive:true});
  document.addEventListener('pointerup', pointerUp, {capture:true, passive:true});

  // ---------- Misc ----------
  document.addEventListener('keydown', e=>{
    if(e.altKey && e.shiftKey && (e.key.toLowerCase?.()==='t')){ e.preventDefault(); buildPanel(); }
  }, true);

  const mo = new MutationObserver(()=>applyRuntimeStyle());
  mo.observe(document.documentElement,{subtree:true, childList:true});

  // ignore panel clicks
  document.addEventListener('pointerdown', e=>{ if(panel && panel.contains(e.target)) e.stopPropagation(); }, true);

})();
