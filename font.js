// ==UserScript==
// @name         size text 
// @namespace    qh.textsize.per_site
// @version      1.3.0
// @description  Nút "Aa" mở bảng cài đặt để tăng/giảm cỡ chữ THEO TỪNG WEBSITE. Chỉ phóng chữ bằng text-size-adjust. Bước 1%. Tối đa +100%. Có menu ScriptCat.
// @match        *://*/*
// @exclude      *://*/*
// @run-at       document-start
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  // ===== Storage (per host) =====
  const HOST = location.host.replace(/^www\./, '');
  const KEY  = `qh_ts:${HOST}`;
  const DEFAULT = { enabled: true, adjPct: 0 }; // adjPct = phần trăm tăng thêm so với 100% (phạm vi đề xuất: 0..100)
  let state = read();

  function read() {
    try { return Object.assign({}, DEFAULT, JSON.parse(GM_getValue(KEY, '{}'))); }
    catch { return { ...DEFAULT }; }
  }
  function save() { GM_setValue(KEY, JSON.stringify(state)); }

  // ===== CSS apply (text only) =====
  // Dựa trên -webkit-text-size-adjust / text-size-adjust. Ảnh/video không bị phóng.
  GM_addStyle(`
    html{ --qh_ts_value: ${100 + state.adjPct}% !important; }
    html{ -webkit-text-size-adjust: var(--qh_ts_value) !important; text-size-adjust: var(--qh_ts_value) !important; }
    /* UI */
    .qh-aa-btn{
      position: fixed; inset: auto 12px 12px auto;
      z-index: 2147483647; width: 40px; height: 40px;
      border-radius: 10px; border: 1px solid rgba(0,0,0,.15);
      background: rgba(255,255,255,.9); color:#111; font: 700 16px/40px system-ui, sans-serif;
      text-align:center; box-shadow: 0 2px 12px rgba(0,0,0,.15);
      user-select:none; -webkit-user-select:none;
    }
    .qh-aa-btn:active{ transform: scale(.98); }
    .qh-aa-panel{
      position: fixed; inset: auto 12px 60px auto; z-index: 2147483647;
      min-width: 240px; padding: 10px 12px; border-radius: 12px;
      background: rgba(255,255,255,.98); color:#111; border:1px solid rgba(0,0,0,.12);
      box-shadow: 0 8px 32px rgba(0,0,0,.18); font: 500 14px/1.35 system-ui, sans-serif;
    }
    .qh-aa-row{ display:flex; align-items:center; gap:8px; margin-top:8px; }
    .qh-aa-row:first-child{ margin-top:0; }
    .qh-aa-range{ flex:1; }
    .qh-aa-badge{ min-width: 64px; text-align:right; font-weight:700; }
    .qh-aa-btn2{
      padding:6px 10px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff;
      font: 600 13px/1 system-ui, sans-serif;
    }
    .qh-aa-top{ display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; }
    .qh-aa-top .title{ font-weight:800; }
    .qh-aa-x{ width:28px; height:28px; border-radius:8px; border:1px solid rgba(0,0,0,.12); background:#fff; }
    .qh-aa-note{ font-size:12px; color:#555; margin-top:6px; }
    @media (prefers-color-scheme: dark) {
      .qh-aa-btn{ background: rgba(20,20,20,.9); color:#f1f1f1; border-color: rgba(255,255,255,.15); }
      .qh-aa-panel{ background: rgba(26,26,26,.98); color:#f1f1f1; border-color: rgba(255,255,255,.12); }
      .qh-aa-btn2, .qh-aa-x{ background:#151515; color:#eee; border-color: rgba(255,255,255,.12); }
      .qh-aa-note{ color:#aaa; }
    }
  `);

  // ===== UI =====
  let $btn, $panel, $range, $out, $enable;

  function mountUI() {
    if (!$btn) {
      $btn = document.createElement('button');
      $btn.className = 'qh-aa-btn';
      $btn.type = 'button';
      $btn.textContent = 'Aa';
      $btn.title = 'Mở cài đặt cỡ chữ';
      $btn.addEventListener('click', togglePanel);
    }
    if (!$panel) {
      $panel = document.createElement('div');
      $panel.className = 'qh-aa-panel';
      $panel.style.display = 'none';
      $panel.innerHTML = `
        <div class="qh-aa-top">
          <div class="title">Cỡ chữ trang này</div>
          <button class="qh-aa-x" type="button" aria-label="Đóng">✕</button>
        </div>
        <div class="qh-aa-row">
          <input class="qh-aa-range" type="range" min="0" max="100" step="1" value="${clamp(state.adjPct,0,100)}" />
          <div class="qh-aa-badge"><span id="qh-aa-out">${state.adjPct}</span>%</div>
        </div>
        <div class="qh-aa-row">
          <button class="qh-aa-btn2" data-delta="-1">-1%</button>
          <button class="qh-aa-btn2" data-delta="+1">+1%</button>
          <button class="qh-aa-btn2" data-set="0">Reset</button>
        </div>
        <div class="qh-aa-row">
          <label style="display:flex;align-items:center;gap:8px;">
            <input id="qh-aa-enable" type="checkbox" ${state.enabled ? 'checked' : ''} />
            Bật trên ${HOST}
          </label>
        </div>
        <div class="qh-aa-note">Chỉ ảnh hưởng chữ bằng <code>text-size-adjust</code>. Bước 1%, tối đa +100%.</div>
      `;
      $panel.querySelector('.qh-aa-x').onclick = () => showPanel(false);
      $range = $panel.querySelector('.qh-aa-range');
      $out   = $panel.querySelector('#qh-aa-out');
      $enable= $panel.querySelector('#qh-aa-enable');

      $range.addEventListener('input', () => {
        state.adjPct = clamp(parseInt($range.value || '0',10), 0, 100);
        apply();
        $out.textContent = state.adjPct;
        save();
      });
      $panel.querySelectorAll('.qh-aa-btn2[data-delta]').forEach(b => {
        b.addEventListener('click', () => {
          const d = b.getAttribute('data-delta') === '+1' ? 1 : -1;
          state.adjPct = clamp(state.adjPct + d, 0, 100);
          apply();
          $range.value = state.adjPct;
          $out.textContent = state.adjPct;
          save();
        });
      });
      $panel.querySelector('.qh-aa-btn2[data-set="0"]').onclick = () => {
        state.adjPct = 0;
        apply();
        $range.value = 0;
        $out.textContent = 0;
        save();
      };
      $enable.onchange = () => {
        state.enabled = !!$enable.checked;
        apply();
        save();
      };

      // Ẩn khi chạm ngoài
      document.addEventListener('click', (e) => {
        if (!$panel || $panel.style.display === 'none') return;
        const inside = $panel.contains(e.target) || $btn.contains(e.target);
        if (!inside) showPanel(false);
      }, true);
    }

    // Gắn vào DOM khi tương tác được
    const mount = () => {
      if (state.enabled) {
        if (!$btn.isConnected) document.documentElement.appendChild($btn);
      } else {
        if ($btn.isConnected) $btn.remove();
        if ($panel && $panel.isConnected) $panel.remove();
      }
      if (state.enabled) {
        if (!$panel.isConnected) document.documentElement.appendChild($panel);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }
  }

  function showPanel(v) {
    if (!$panel) return;
    $panel.style.display = v ? 'block' : 'none';
  }
  function togglePanel() {
    if (!$panel) return;
    const v = $panel.style.display !== 'block';
    showPanel(v);
  }

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }

  // ===== Apply scale =====
  function apply() {
    const pct = state.enabled ? (100 + clamp(state.adjPct, 0, 100)) : 100;
    document.documentElement.style.setProperty('--qh_ts_value', pct + '%');
    // Thiết lập lại thuộc tính để chắc chắn ưu tiên
    document.documentElement.style.setProperty('text-size-adjust', pct + '%', 'important');
    document.documentElement.style.setProperty('-webkit-text-size-adjust', pct + '%', 'important');
    // Cập nhật UI nếu tồn tại
    if ($enable) $enable.checked = !!state.enabled;
  }

  // ===== ScriptCat Menu =====
  function registerMenu() {
    try {
      GM_registerMenuCommand(`Aa • Mở bảng`, () => { mountUI(); showPanel(true); });
      GM_registerMenuCommand(`Aa • +1%`, () => { state.adjPct = clamp(state.adjPct + 1, 0, 100); save(); apply(); });
      GM_registerMenuCommand(`Aa • -1%`, () => { state.adjPct = clamp(state.adjPct - 1, 0, 100); save(); apply(); });
      GM_registerMenuCommand(`Aa • Reset (0%)`, () => { state.adjPct = 0; save(); apply(); });
      GM_registerMenuCommand(state.enabled ? `Aa • Tắt trên ${HOST}` : `Aa • Bật trên ${HOST}`, () => {
        state.enabled = !state.enabled; save(); apply(); mountUI();
      });
    } catch {}
  }

  // ===== Init =====
  registerMenu();
  apply();
  mountUI();

})();
