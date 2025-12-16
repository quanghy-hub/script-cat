// ==UserScript==
// @name         Translate
// @namespace    vn.inline.translate.ctrl.swipe.groups
// @version      2.4.0
// @description   Fix VPN.
// @author       you
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
    hotkey: 'shift',         // 'shift' | 'alt' | 'ctrl'
    swipeEnabled: true,
    swipeDir: 'both',        // 'left' | 'right' | 'both'
    swipePx: 60,             // Tăng lên để tránh chạm nhầm (cũ: 60)
    swipeSlopeMax: 0.4,      // Giảm xuống để yêu cầu vuốt ngang "thẳng" hơn (cũ: 0.5)
    fontScale: 0.95,
    mutedColor: '#00bfff',
    bgBlend: 'transparent',
    maxChars: 3000,
    dedupeSeconds: 0.7
  };

  let cfg = loadCfg();
  function loadCfg(){ try{ const s=GM_getValue(GLOBAL_KEY); return s?{...defaults,...JSON.parse(s)}:{...defaults}; }catch{ return {...defaults}; } }
  function saveCfg(){ GM_setValue(GLOBAL_KEY, JSON.stringify(cfg)); }

  // ========= Styles =========
  const style = document.createElement('style');
  style.textContent = `
  :root{ --ilt-fs:${cfg.fontScale}em; --ilt-fg:${cfg.mutedColor}; --ilt-bg:${cfg.bgBlend||'transparent'} }
  .ilt-panel{position:fixed;z-index:2147483647;top:10px;right:10px;background:#1a1a1ae6;border:1px solid #444;border-radius:12px;padding:12px 14px;color:#eee;font:13px/1.4 system-ui,sans-serif;max-width:320px;backdrop-filter:blur(6px);box-shadow:0 4px 12px rgba(0,0,0,0.5); transform: scale(1); transition: opacity 0.2s;}
  .ilt-panel h3{margin:0 0 10px;font-size:15px;font-weight:700;color:#fff;border-bottom:1px solid #444;padding-bottom:5px}
  .ilt-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:8px 0}
  .ilt-row label{color:#ccc;flex:1}
  .ilt-panel input, .ilt-panel select{background:#333;border:1px solid #555;color:#fff;border-radius:4px;padding:4px 6px;max-width:140px}
  .ilt-panel button{width:100%;margin-top:10px;padding:8px;background:#0079d3;border:none;border-radius:4px;color:white;cursor:pointer;font-weight:600}
  .ilt-panel button:hover{background:#005fa3}
  
  .ilt-trans-container {
      display: block; margin: 8px 0 16px 0; clear: both; width: 100%;
      animation: iltFadeIn 0.2s ease-out; border-top: 1px dashed #444; padding-top: 6px;
  }
  .ilt-trans {
      padding: 6px 12px; border-left: 3px solid var(--ilt-fg); background: var(--ilt-bg);
      color: var(--ilt-fg); font-style: italic; font-size: var(--ilt-fs);
      line-height: 1.6; word-wrap: break-word; font-family: system-ui, sans-serif;
      white-space: pre-wrap;
  }
  .ilt-trans[data-state="loading"]{opacity:0.7}
  .ilt-meta{font-size:0.75em;opacity:0.6;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px}
  @keyframes iltFadeIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);

  // ========= Block Detection & Logic =========
  
  function closestBlock(node){
    if(!node) return document.body;
    let el = node.nodeType===1 ? node : node.parentElement;
    while(el && el!==document.body){ 
      const style = window.getComputedStyle(el);
      const isContentBlock = /^(P|LI|H[1-6]|BLOCKQUOTE|TD|TH|PRE|FIGCAPTION|DIV|SPAN)$/.test(el.tagName);
      // Update: Cho phép inline-block hoặc block
      const isDisplayBlock = /(block|list-item|table|flex|grid)/.test(style.display);
      if (isContentBlock && isDisplayBlock && el.innerText.trim().length > 0) return el;
      el = el.parentElement; 
    }
    return document.body;
  }

  function getTextAndOffset(x,y){
    let range, container;
    // Fallback cho Firefox và Chrome cũ
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

  // Gom nhóm sibling (Dành cho các trang web chia text thành nhiều thẻ P hoặc Div nhỏ)
  function expandSiblings(container, maxItems) {
      let collectedText = container.innerText.trim();
      let lastNode = container;
      const validTags = /^(LI|P|DIV|H[1-6]|TD)$/;
      if (!validTags.test(container.tagName)) return { text: collectedText, lastNode: container };

      let next = container.nextElementSibling;
      let count = 1;
      while(next && count < maxItems) {
          const style = window.getComputedStyle(next);
          if (style.display === 'none' || style.visibility === 'hidden') { next = next.nextElementSibling; continue; }
          if (next.tagName !== container.tagName) break;
          const t = next.innerText.trim();
          if (t) { collectedText += "\n" + t; lastNode = next; count++; }
          next = next.nextElementSibling;
      }
      return { text: collectedText, lastNode: lastNode };
  }

  // Tách câu thông minh
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
      const startIndex = Math.max(0, targetIndex - Math.floor(groupSize/2)); // Lấy câu xung quanh vị trí click
      const endIndex = Math.min(startIndex + groupSize, sentences.length);
      return sentences.slice(startIndex, endIndex).map(s => s.text).join('').trim();
  }

  // ========= API Translate =========
  const recent = new Map();
  function tooSoon(text){
    const now=Date.now(), t=recent.get(text);
    if(t && now-t < cfg.dedupeSeconds*1000) return true;
    recent.set(text, now); return false;
  }

  async function translateAuto(text){
    if (cfg.provider === 'gemini') {
      const target = looksVietnamese(text) ? 'English' : 'Vietnamese';
      return { translated: await translateGemini(text, target), src: target==='English'?'vi':'en' };
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
                        if (Array.isArray(d) && Array.isArray(d[0])) out = d[0].map(x => x[0]).join(''); 
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
      const prompt = `Translate to ${target}. Preserve formatting and line breaks.\n\n${text}`;
      GM_xmlhttpRequest({
        method:'POST', url: url, headers: {'Content-Type': 'application/json'},
        data: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        onload: res=>{ try{ resolve(JSON.parse(res.responseText).candidates[0].content.parts[0].text.trim()); }catch(e){ reject(e); } },
        onerror: reject
      });
    });
  }

  // ========= UI Inject =========
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
    
    if (anchorNode.parentNode) anchorNode.parentNode.insertBefore(wrap, anchorNode.nextSibling);
    else anchorNode.appendChild(wrap);

    translateAuto(textToTranslate).then(({translated})=>{
      div.dataset.state = 'done';
      div.innerHTML = `<div class="ilt-txt">${escapeHTML(translated)}</div>`;
    }).catch(()=>{
      div.innerHTML = `<div class="ilt-meta" style="color:#ff6b6b">Error</div>`;
      setTimeout(()=>wrap.remove(), 2000);
    });
  }

  const VI_CHARS = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
  function looksVietnamese(s){ return VI_CHARS.test(s); }
  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  
  // ========= Interaction Logic =========
  let lastMouse = {x:0,y:0};
  // Throttle mousemove để tiết kiệm hiệu năng
  let ticking = false;
  document.addEventListener('mousemove', e=>{
      if(!ticking) {
          window.requestAnimationFrame(()=> {
              lastMouse.x = e.clientX;
              lastMouse.y = e.clientY;
              ticking = false;
          });
          ticking = true;
      }
  }, {passive:true});

  function handleTrigger(x, y) {
      const hit = getTextAndOffset(x, y);
      if (!hit) return;

      let text = '';
      let anchor = hit.container;

      if (cfg.mode === 'paragraph') {
          text = hit.text.slice(0, cfg.maxChars);
      } else if (cfg.mode === 'group') {
          if (hit.text.length < 200) {
             const exp = expandSiblings(hit.container, cfg.groupSize);
             text = exp.text; anchor = exp.lastNode;
          }
          if (!text || text.length <= hit.text.length) {
              text = getSentenceGroup(hit.text, hit.offset, cfg.groupSize);
              anchor = hit.container;
          }
      } else {
          text = getSentenceGroup(hit.text, hit.offset, 1);
      }
      if (text) toggleTranslate(anchor, text);
  }

  // Hotkey Handler
  document.addEventListener('keydown', e=>{
    if (e.repeat) return;
    const isShift = cfg.hotkey === 'shift' && e.shiftKey;
    const isAlt = cfg.hotkey === 'alt' && e.altKey;
    const isCtrl = cfg.hotkey === 'ctrl' && e.ctrlKey;

    if(isShift || isAlt || isCtrl){
      const a = document.activeElement;
      if(a && (a.isContentEditable || /input|textarea/i.test(a.tagName))) return;
      handleTrigger(lastMouse.x, lastMouse.y);
    }
    // Tổ hợp mở panel: Shift + Alt + X
    if(e.shiftKey && e.altKey && e.code==='KeyX') buildPanel();
  });

  // Swipe Logic (Optimized)
  let sx=0, sy=0, st=0;
  document.addEventListener('touchstart', e=>{
    if(!cfg.swipeEnabled || e.touches.length>1) return;
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; st=Date.now();
  }, {passive:true});

  document.addEventListener('touchend', e=>{
      if(!cfg.swipeEnabled || !sx || (Date.now() - st > 500)) { sx=0; return; } // Timeout 500ms để tránh giữ quá lâu
      
      const ex = e.changedTouches[0].clientX;
      const ey = e.changedTouches[0].clientY;
      const dx = ex - sx;
      const dy = ey - sy;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Reset
      sx=0; sy=0;

      // 1. Phải vuốt đủ dài (cfg.swipePx)
      if (absDx < cfg.swipePx) return;
      
      // 2. Phải vuốt ngang "thẳng", không chéo quá (Slope check)
      // Nếu dy/dx > slope nghĩa là đang vuốt dọc nhiều hơn ngang
      if (absDy > absDx * cfg.swipeSlopeMax) return;

      // 3. Kiểm tra hướng
      let validDir = false;
      if (cfg.swipeDir === 'both') validDir = true;
      else if (cfg.swipeDir === 'right' && dx > 0) validDir = true; // Vuốt từ trái sang phải
      else if (cfg.swipeDir === 'left' && dx < 0) validDir = true;  // Vuốt từ phải sang trái

      if (validDir) {
          // Dùng toạ độ bắt đầu (sx, sy) để xác định vị trí text
          // (Lưu ý: e.changedTouches lúc end có thể lệch, nên dùng sx sy cũ hoặc lấy trung bình)
          handleTrigger(ex - dx/2, ey - dy/2); 
      }
  });

  // ========= Settings Panel =========
  function buildPanel(){
      if(document.querySelector('.ilt-panel')) return;
      const p = document.createElement('div');
      p.className = 'ilt-panel';
      
      // HTML Settings
      p.innerHTML = `
        <h3>Translate Settings</h3>
        <div class="ilt-row"><label>Provider</label><select id="p_prov"><option value="google">Google</option><option value="gemini">Gemini</option></select></div>
        <div class="ilt-row"><label>Mode</label><select id="p_mode"><option value="paragraph">Paragraph</option><option value="group">Group (Gom)</option><option value="sentence">Sentence</option></select></div>
        <div class="ilt-row" id="row_grp"><label>Lines/Group</label><input id="p_grp" type="number" min="1" max="10"></div>
        
        <div class="ilt-row"><label>Hotkey</label>
            <select id="p_hot">
                <option value="shift">Shift</option>
                <option value="alt">Alt</option>
                <option value="ctrl">Ctrl</option>
            </select>
        </div>

        <div class="ilt-row"><label>Swipe Dir</label>
            <select id="p_swd">
                <option value="both">Both (Trái/Phải)</option>
                <option value="right">Right (Sang phải)</option>
                <option value="left">Left (Sang trái)</option>
                <option value="none">Disable</option>
            </select>
        </div>
        
        <div class="ilt-row"><label>Gemini Key</label><input id="p_key" type="password" placeholder="AI Key..."></div>
        <div class="ilt-row"><label>Màu chữ</label><input id="p_col" type="color"></div>
        <button id="p_save">Lưu & Reload</button>
      `;
      document.body.appendChild(p);

      // Populate Data
      const $ = (s) => p.querySelector(s);
      $('#p_prov').value = cfg.provider;
      $('#p_mode').value = cfg.mode;
      $('#p_grp').value = cfg.groupSize;
      $('#p_hot').value = cfg.hotkey;
      $('#p_swd').value = cfg.swipeEnabled ? cfg.swipeDir : 'none';
      $('#p_key').value = cfg.geminiKey;
      $('#p_col').value = cfg.mutedColor;

      const toggleGrp = () => $('#row_grp').style.display = $('#p_mode').value==='group'?'flex':'none';
      $('#p_mode').onchange = toggleGrp; toggleGrp();

      $('#p_save').onclick = () => {
          cfg.provider = $('#p_prov').value;
          cfg.mode = $('#p_mode').value;
          cfg.groupSize = +$('#p_grp').value || 3;
          cfg.geminiKey = $('#p_key').value;
          cfg.mutedColor = $('#p_col').value;
          cfg.hotkey = $('#p_hot').value;
          
          const swVal = $('#p_swd').value;
          if (swVal === 'none') {
              cfg.swipeEnabled = false;
          } else {
              cfg.swipeEnabled = true;
              cfg.swipeDir = swVal;
          }

          saveCfg();
          p.remove();
          // location.reload(); // Reload trang để áp dụng
          alert('Saved! Refresh page to apply.');
      };
      
      // Click outside to close
      document.addEventListener('click', function close(e){
          if(!p.contains(e.target) && !e.shiftKey) {
             p.remove(); document.removeEventListener('click', close);
          }
      }, {once:true, capture:true});
  }
  
  if(typeof GM_registerMenuCommand !== 'undefined') GM_registerMenuCommand("Settings", buildPanel);
})();
