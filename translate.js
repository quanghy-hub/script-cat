// ==UserScript==
// @name         Translate
// @namespace    vn.inline.translate.ctrl.swipe.groups
// @version      2.3.0
// @description  Shift/Alt (desktop) hoặc Vuốt ngang (mobile) để dịch. Hỗ trợ dịch theo nhóm, giữ nguyên định dạng xuống dòng. Fix VPN.
// @author       you
// @updateURL    https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/translate.js
// @downloadURL  https://raw.githubusercontent.com/quanghy-hub/script-cat/refs/heads/main/translate.js
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
    mode: 'group',           // 'sentence' | 'paragraph' | 'group'
    groupSize: 3,            // Số câu/dòng gom lại
    provider: 'google',      // 'google' | 'gemini'
    geminiKey: '',
    geminiModel: 'gemini-1.5-flash',
    hotkey: 'shift',         // 'shift' | 'alt'
    swipeEnabled: true,
    swipePx: 60,
    swipeSlopeMax: 0.5,
    swipeDir: 'both',
    swipeVHMode: true,
    scrubThrottleMs: 80,
    fontScale: 0.95,
    italic: true,
    mutedColor: '#00bfff',
    bgBlend: 'transparent',
    maxChars: 3000,
    dedupeSeconds: 0.7,
    showPanelOnStart: false
  };
  const cfg = loadCfg();
  function loadCfg(){ try{ const s=GM_getValue(GLOBAL_KEY); return s?{...defaults,...JSON.parse(s)}:{...defaults}; }catch{ return {...defaults}; } }
  function saveCfg(){ GM_setValue(GLOBAL_KEY, JSON.stringify(cfg)); }

  // ========= Styles =========
  const style = document.createElement('style');
  style.textContent = `
  :root{ --ilt-fs:${cfg.fontScale}em; --ilt-it:${cfg.italic?'italic':'normal'}; --ilt-fg:${cfg.mutedColor}; --ilt-bg:${cfg.bgBlend||'transparent'} }
  .ilt-panel{position:fixed;z-index:2147483647;top:16px;right:16px;background:#1a1a1ae6;border:1px solid #444;border-radius:12px;padding:12px 14px;color:#eee;font:13px/1.4 system-ui,sans-serif;max-width:320px;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,0.5)}
  .ilt-panel h3{margin:0 0 10px;font-size:15px;font-weight:700;color:#fff}
  .ilt-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:8px 0}
  .ilt-row label{color:#ccc;flex:1}
  .ilt-panel input, .ilt-panel select{background:#333;border:1px solid #555;color:#fff;border-radius:4px;padding:3px 6px;max-width:140px}
  .ilt-panel button{width:100%;margin-top:10px;padding:8px;background:#0079d3;border:none;border-radius:4px;color:white;cursor:pointer;font-weight:600}
  .ilt-panel button:hover{background:#005fa3}
  
  .ilt-trans-container {
      display: block;
      margin: 8px 0 16px 0;
      clear: both;
      width: 100%;
      animation: iltFadeIn 0.2s ease-out;
      border-top: 1px dashed #444;
      padding-top: 6px;
  }
  .ilt-trans {
      padding: 6px 12px;
      border-left: 3px solid var(--ilt-fg);
      background: var(--ilt-bg);
      color: var(--ilt-fg);
      font-style: var(--ilt-it);
      font-size: var(--ilt-fs);
      line-height: 1.6; /* Tăng line-height cho dễ đọc */
      word-wrap: break-word;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      white-space: pre-wrap; /* QUAN TRỌNG: Giữ nguyên xuống dòng */
  }
  .ilt-trans[data-state="loading"]{opacity:0.7}
  .ilt-meta{font-size:0.75em;opacity:0.6;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px}
  @keyframes iltFadeIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);

  // ========= Block Detection =========
  
  function closestBlock(node){
    if(!node) return document.body;
    let el = node.nodeType===1 ? node : node.parentElement;
    
    while(el && el!==document.body){ 
      const style = window.getComputedStyle(el);
      const isContentBlock = /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV)$/.test(el.tagName);
      const isDisplayBlock = /(block|list-item|table|flex|grid)/.test(style.display);
      
      if (isContentBlock && isDisplayBlock) {
          if (el.innerText.trim().length > 0) return el;
      }
      el = el.parentElement; 
    }
    return document.body;
  }

  function getTextAndOffset(x,y){
    let range, container;
    if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(x,y);
    } else if (document.caretPositionFromPoint) {
        const p = document.caretPositionFromPoint(x,y);
        if(p) { range=document.createRange(); range.setStart(p.offsetNode,p.offset); range.collapse(true); }
    }

    if (!range) return null;
    container = closestBlock(range.startContainer);
    if (!container || container === document.body) return null;

    const fullText = container.innerText || container.textContent || '';
    if (fullText.length < 1) return null;

    let offset = 0;
    try {
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(container);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        offset = preCaretRange.toString().length;
    } catch(e) { offset = 0; }

    return { text: fullText, container, offset };
  }

  // ========= Aggregation Logic =========

  function expandSiblings(container, maxItems) {
      let collectedText = container.innerText.trim();
      let lastNode = container;
      
      const validTags = /^(LI|P|DIV|H[1-6]|TD)$/;
      if (!validTags.test(container.tagName)) {
          return { text: collectedText, lastNode: container };
      }

      let next = container.nextElementSibling;
      let count = 1;

      while(next && count < maxItems) {
          const style = window.getComputedStyle(next);
          if (style.display === 'none' || style.visibility === 'hidden') {
              next = next.nextElementSibling;
              continue;
          }
          if (next.tagName !== container.tagName) break;
          
          const t = next.innerText.trim();
          if (t) {
              collectedText += "\n" + t; // Thêm \n để giữ format
              lastNode = next; 
              count++;
          }
          next = next.nextElementSibling;
      }
      return { text: collectedText, lastNode: lastNode };
  }

  function getSentenceGroup(fullText, clickOffset, groupSize) {
      const sentenceRegex = /[^.!?]+([.!?]+|$)(?:\s+|$)/g;
      const sentences = [];
      let match;
      while ((match = sentenceRegex.exec(fullText)) !== null) {
          sentences.push({ text: match[0], start: match.index, end: match.index + match[0].length });
      }
      if (sentences.length === 0) return fullText;

      let targetIndex = 0;
      for (let i = 0; i < sentences.length; i++) {
          if ((clickOffset >= sentences[i].start && clickOffset < sentences[i].end) || 
              (i === sentences.length - 1 && clickOffset >= sentences[i].end)) {
              targetIndex = i; break;
          }
      }
      const startIndex = Math.floor(targetIndex / groupSize) * groupSize;
      const endIndex = Math.min(startIndex + groupSize, sentences.length);
      
      return sentences.slice(startIndex, endIndex).map(s => s.text).join('').trim();
  }

  // ========= API =========
  const recent = new Map();
  function tooSoon(text){
    const now=Date.now(), t=recent.get(text);
    if(t && now-t < cfg.dedupeSeconds*1000) return true;
    recent.set(text, now); return false;
  }

  async function translateAuto(text){
    if (cfg.provider === 'gemini') {
      const target = looksVietnamese(text) ? 'en' : 'vi';
      return { translated: await translateGemini(text, target), src: target==='en'?'vi':'auto' };
    } else {
      const det = await translateGoogleMulti(text, 'vi');
      if (det.src && det.src.startsWith('vi')) return await translateGoogleMulti(text, 'en');
      return det;
    }
  }

  function translateGoogleMulti(text, target) {
    const urls = [
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${target}&dt=t&q=${encodeURIComponent(text)}`,
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${target}&q=${encodeURIComponent(text)}`
    ];
    return new Promise((resolve, reject) => {
        let att = 0;
        const next = () => {
            if (att >= urls.length) return reject("Google Fail");
            GM_xmlhttpRequest({
                method: 'GET', url: urls[att++], timeout: 10000,
                onload: res => {
                    if (res.status !== 200) return next();
                    try {
                        const d = JSON.parse(res.responseText);
                        let out = '', src = d.src || d[2] || 'auto';
                        // Google trả về mảng các câu, join bằng \n nếu cần thiết, 
                        // nhưng thường google tự tách câu, ta cứ join '' vì text input đã có \n
                        if (Array.isArray(d)) out = d[0].map(x => x[0]).join(''); 
                        else if (d.sentences) out = d.sentences.map(s => s.trans).join('');
                        
                        if(out) resolve({translated: out, src}); else next();
                    } catch { next(); }
                }, onerror: next, ontimeout: next
            });
        };
        next();
    });
  }

  function translateGemini(text, target){
    return new Promise((resolve,reject)=>{
      if(!cfg.geminiKey) return reject('Missing Key');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.geminiModel}:generateContent?key=${cfg.geminiKey}`;
      // Thêm yêu cầu Preserve formatting
      const prompt = `Translate to ${target === 'vi'?'Vietnamese':'English'}. Preserve original formatting and line breaks. Output translation only.\n\n${text}`;
      
      GM_xmlhttpRequest({
        method:'POST', url: url, headers: {'Content-Type': 'application/json'},
        data: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        onload: res=>{ try{ resolve(JSON.parse(res.responseText).candidates[0].content.parts[0].text.trim()); }catch(e){ reject(e); } },
        onerror: reject
      });
    });
  }

  // ========= UI & Handlers =========
  
  function toggleTranslate(anchorNode, textToTranslate){
    if (!anchorNode || !textToTranslate) return;
    
    const next = anchorNode.nextElementSibling;
    if (next && next.classList.contains('ilt-trans-container')) { next.remove(); return; }
    
    if (tooSoon(textToTranslate)) return;

    const wrap = document.createElement('div');
    wrap.className = 'ilt-trans-container';
    const div = document.createElement('div');
    div.className = 'ilt-trans';
    div.dataset.state = 'loading';
    div.innerHTML = `<div class="ilt-meta">Translating...</div>`;
    wrap.appendChild(div);
    
    // Inject sau anchorNode (node cuối cùng của nhóm)
    if (anchorNode.parentNode) {
        anchorNode.parentNode.insertBefore(wrap, anchorNode.nextSibling);
    } else {
        anchorNode.appendChild(wrap);
    }

    translateAuto(textToTranslate).then(({translated})=>{
      div.dataset.state = 'done';
      // Chỉ escapeHTML, không replace \n vì CSS pre-wrap sẽ lo việc hiển thị
      div.innerHTML = `<div class="ilt-txt">${escapeHTML(translated)}</div>`;
    }).catch(e=>{
      div.innerHTML = `<div class="ilt-meta" style="color:#ff6b6b">Error</div>`;
      setTimeout(()=>wrap.remove(), 2000);
    });
  }

  const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  function looksVietnamese(s){ return VI_CHARS.test(s); }
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  
  let lastMouse = {x:0,y:0};
  document.addEventListener('mousemove', e=>{lastMouse.x=e.clientX; lastMouse.y=e.clientY;}, {passive:true});

  function handleTrigger(x, y) {
      const hit = getTextAndOffset(x, y);
      if (!hit) return;

      let textToTrans = '';
      let anchorNode = hit.container;

      if (cfg.mode === 'paragraph') {
          textToTrans = hit.text.slice(0, cfg.maxChars);
      } 
      else if (cfg.mode === 'group') {
          const isShortBlock = hit.text.length < 200;
          
          if (isShortBlock) {
             const expanded = expandSiblings(hit.container, cfg.groupSize);
             textToTrans = expanded.text;
             anchorNode = expanded.lastNode;
          }
          
          if (!textToTrans || textToTrans.length <= hit.text.length) {
              textToTrans = getSentenceGroup(hit.text, hit.offset, cfg.groupSize);
              anchorNode = hit.container;
          }
      } 
      else {
          textToTrans = getSentenceGroup(hit.text, hit.offset, 1);
      }

      if (textToTrans) toggleTranslate(anchorNode, textToTrans);
  }

  document.addEventListener('keydown', e=>{
    const k = cfg.hotkey==='shift'?'Shift':'Alt';
    if(e.key===k && !e.repeat){
      const a = document.activeElement;
      if(a && (a.isContentEditable || /input|textarea/i.test(a.tagName))) return;
      handleTrigger(lastMouse.x, lastMouse.y);
    }
    if(e.shiftKey && e.altKey && e.code==='KeyX') buildPanel();
  });

  let sx=0, sy=0, isSwiping=false;
  document.addEventListener('touchstart', e=>{
    if(!cfg.swipeEnabled || e.touches.length>1) return;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; isSwiping=false;
  }, {passive:true});
  document.addEventListener('touchmove', e=>{
      if(!cfg.swipeEnabled || !sx) return;
      const dx = e.touches[0].clientX - sx, dy = e.touches[0].clientY - sy;
      if(Math.abs(dx) > 10 && Math.abs(dy) < Math.abs(dx)*cfg.swipeSlopeMax) isSwiping = true;
  }, {passive:true});
  document.addEventListener('touchend', e=>{
      if(!isSwiping) return;
      if(Math.abs(e.changedTouches[0].clientX - sx) > cfg.swipePx) handleTrigger(sx, sy);
      sx=0; sy=0;
  });

  function buildPanel(){
      if(document.querySelector('.ilt-panel')) return;
      const p = document.createElement('div');
      p.className = 'ilt-panel';
      p.innerHTML = `
        <h3>Inline Translate Settings</h3>
        <div class="ilt-row"><label>Provider</label><select id="p_prov"><option value="google">Google</option><option value="gemini">Gemini</option></select></div>
        <div class="ilt-row"><label>Mode</label><select id="p_mode"><option value="paragraph">Paragraph</option><option value="group">Group (Gom)</option><option value="sentence">Sentence</option></select></div>
        <div class="ilt-row" id="row_grp"><label>Số câu/dòng</label><input id="p_grp" type="number" min="1" max="10" value="${cfg.groupSize}"></div>
        <div class="ilt-row"><label>Gemini Key</label><input id="p_key" type="password" value="${cfg.geminiKey}"></div>
        <div class="ilt-row"><label>Màu chữ</label><input id="p_col" type="color" value="${cfg.mutedColor}"></div>
        <button id="p_save">Lưu</button>
      `;
      document.body.appendChild(p);
      const elMode = p.querySelector('#p_mode'), elGrp = p.querySelector('#row_grp');
      p.querySelector('#p_prov').value = cfg.provider;
      elMode.value = cfg.mode;
      const toggle = ()=>elGrp.style.display = elMode.value==='group'?'flex':'none';
      elMode.onchange = toggle; toggle();
      p.querySelector('#p_save').onclick = () => {
          cfg.provider = p.querySelector('#p_prov').value;
          cfg.mode = elMode.value;
          cfg.groupSize = +p.querySelector('#p_grp').value || 3;
          cfg.geminiKey = p.querySelector('#p_key').value;
          cfg.mutedColor = p.querySelector('#p_col').value;
          saveCfg(); p.remove(); location.reload(); 
      };
  }
  if(typeof GM_registerMenuCommand !== 'undefined') GM_registerMenuCommand("Settings", buildPanel);
})();
