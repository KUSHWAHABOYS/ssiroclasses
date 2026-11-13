import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const htmlContent = `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="UTF-8">
  <title>Smart Studio Presenter Pro - AI Translate Lens Mockup</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; }
    body {
      font-family: 'Inter', 'Noto Sans Devanagari', -apple-system, BlinkMacSystemFont, sans-serif;
      background-color: #060e22;
      color: #fff;
      overflow: hidden;
      width: 2560px;
      height: 1440px;
      position: relative;
    }

    /* 4K Stage Background */
    .stage {
      width: 2560px;
      height: 1440px;
      position: relative;
      background: radial-gradient(circle at 50% 30%, #0f1c3f 0%, #060d20 100%);
      display: flex;
      flex-direction: column;
    }

    /* Top Studio Header */
    .header {
      height: 72px;
      background: linear-gradient(180deg, rgba(6, 14, 34, 0.95) 0%, rgba(6, 14, 34, 0.75) 100%);
      border-bottom: 1px solid rgba(255, 215, 106, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 32px;
      z-index: 50;
      backdrop-filter: blur(12px);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 20px;
    }
    .channel-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      background: linear-gradient(135deg, rgba(255, 215, 106, 0.15), rgba(232, 137, 12, 0.2));
      border: 1px solid rgba(255, 215, 106, 0.35);
      padding: 8px 18px;
      border-radius: 24px;
      font-weight: 700;
      color: #ffd76a;
      font-size: 17px;
      letter-spacing: 0.5px;
    }
    .file-name {
      font-size: 16px;
      color: #dae2ff;
      font-weight: 500;
      opacity: 0.85;
    }
    .header-right {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .header-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #dae2ff;
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 600;
    }
    .header-btn.active {
      background: rgba(255, 215, 106, 0.2);
      border-color: #ffd76a;
      color: #ffd76a;
    }
    .page-counter {
      font-size: 16px;
      font-weight: 700;
      color: #ffd76a;
      background: rgba(0, 0, 0, 0.4);
      padding: 6px 16px;
      border-radius: 8px;
      border: 1px solid rgba(255, 215, 106, 0.25);
    }

    /* Main Lecture Slide Area */
    .slide-area {
      flex: 1;
      position: relative;
      padding: 48px 80px;
      display: flex;
      flex-direction: column;
    }

    /* Slide Content Card (representing PPT) */
    .slide-canvas-mock {
      flex: 1;
      background: #0b142c;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
      padding: 48px 56px;
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
    }

    .slide-title-bar {
      grid-column: 1 / -1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 2px solid rgba(255, 215, 106, 0.25);
      padding-bottom: 16px;
      margin-bottom: 8px;
    }
    .slide-title {
      font-size: 34px;
      font-weight: 800;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .slide-title span {
      background: linear-gradient(135deg, #ffd76a 0%, #e8890c 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .slide-subtitle {
      font-size: 18px;
      color: #94a3b8;
    }

    /* Left Column: English / Pali screenshot container */
    .screenshot-container {
      background: #0f1c3a;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 16px;
      padding: 24px;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .screenshot-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #94a3b8;
      font-size: 14px;
      font-weight: 600;
    }
    .academic-text-snippet {
      font-family: 'Georgia', serif;
      font-size: 19px;
      line-height: 1.65;
      color: #e2e8f0;
      background: rgba(2, 6, 23, 0.6);
      padding: 22px;
      border-radius: 12px;
      border-left: 4px solid #38bdf8;
    }
    .academic-text-snippet em {
      color: #ffd76a;
      font-style: italic;
    }

    /* Neon Selection Snip Box */
    .selection-snip-box {
      position: absolute;
      top: 64px;
      left: 18px;
      right: 18px;
      bottom: 24px;
      border: 2.5px dashed #ffd76a;
      border-radius: 14px;
      background: rgba(255, 215, 106, 0.08);
      box-shadow: 0 0 25px rgba(255, 215, 106, 0.35), inset 0 0 20px rgba(255, 215, 106, 0.1);
      pointer-events: none;
      animation: pulseBorder 2s infinite alternate;
    }
    .selection-tag {
      position: absolute;
      top: -16px;
      left: 18px;
      background: linear-gradient(135deg, #ffd76a, #e8890c);
      color: #060e22;
      font-size: 12px;
      font-weight: 800;
      padding: 4px 12px;
      border-radius: 6px;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .snip-handle {
      position: absolute;
      width: 14px;
      height: 14px;
      background: #ffd76a;
      border: 2px solid #060e22;
      border-radius: 3px;
    }
    .snip-handle.tl { top: -7px; left: -7px; }
    .snip-handle.tr { top: -7px; right: -7px; }
    .snip-handle.bl { bottom: -7px; left: -7px; }
    .snip-handle.br { bottom: -7px; right: -7px; }

    /* Right Column: AI Live Translation Popup Card */
    .translation-popover-card {
      background: rgba(13, 25, 54, 0.94);
      border: 2px solid rgba(255, 215, 106, 0.45);
      border-radius: 20px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(255, 215, 106, 0.2);
      backdrop-filter: blur(20px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      position: relative;
    }

    .popover-top-bar {
      background: linear-gradient(90deg, rgba(255, 215, 106, 0.15) 0%, rgba(232, 137, 12, 0.08) 100%);
      padding: 16px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 215, 106, 0.25);
    }
    .popover-badge {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 700;
      color: #ffd76a;
    }
    .popover-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .icon-chip-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #dae2ff;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .icon-chip-btn.pin {
      background: rgba(232, 137, 12, 0.25);
      border-color: #ffd76a;
      color: #ffd76a;
    }
    .icon-chip-btn.close {
      background: rgba(239, 68, 68, 0.15);
      border-color: rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }

    .detected-lang-pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(56, 189, 248, 0.15);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: #7dd3fc;
      padding: 5px 14px;
      border-radius: 14px;
      font-size: 13px;
      font-weight: 600;
      margin: 16px 24px 8px 24px;
      width: fit-content;
    }

    .popover-body {
      padding: 12px 24px 20px 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
    }

    .translation-section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #ffd76a;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hindi-translation-box {
      background: rgba(2, 8, 24, 0.65);
      border: 1px solid rgba(255, 215, 106, 0.2);
      border-radius: 14px;
      padding: 20px;
      font-size: 19px;
      line-height: 1.7;
      color: #ffffff;
      font-weight: 500;
      border-left: 5px solid #ffd76a;
    }
    .hindi-translation-box mark {
      background: rgba(255, 215, 106, 0.25);
      color: #ffd76a;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .glossary-box {
      background: rgba(2, 8, 24, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 12px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .glossary-item {
      font-size: 14.5px;
      line-height: 1.5;
      color: #cbd5e1;
      display: flex;
      align-items: baseline;
      gap: 8px;
    }
    .glossary-item b {
      color: #ffd76a;
      font-weight: 600;
    }

    .popover-footer-actions {
      background: rgba(6, 14, 34, 0.85);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .footer-left-btns {
      display: flex;
      gap: 10px;
    }
    .footer-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #dae2ff;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .footer-btn:hover {
      background: rgba(255, 215, 106, 0.15);
      color: #ffd76a;
    }

    /* Floating Draggable Toolbar with new AI Translate Tool */
    .toolbar-container {
      position: absolute;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(10, 22, 51, 0.92);
      backdrop-filter: blur(20px);
      border: 1.5px solid rgba(255, 215, 106, 0.35);
      border-radius: 36px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.75), 0 0 25px rgba(255, 215, 106, 0.18);
      padding: 8px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      z-index: 100;
    }
    .drag-handle {
      width: 28px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      cursor: grab;
      border-right: 1px solid rgba(255, 255, 255, 0.12);
      padding-right: 6px;
      margin-right: 2px;
    }
    .tool-btn {
      height: 48px;
      min-width: 52px;
      padding: 0 12px;
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      border: 1px solid transparent;
      background: transparent;
      color: #94a3b8;
      font-size: 11.5px;
      font-weight: 600;
      gap: 3px;
    }
    .tool-btn svg { width: 22px; height: 22px; }
    .tool-btn.active {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      border-color: rgba(255, 255, 255, 0.25);
    }
    /* HIGHLIGHTED NEW TOOL */
    .tool-btn.tool-ai-translate {
      background: linear-gradient(135deg, rgba(255, 215, 106, 0.28) 0%, rgba(232, 137, 12, 0.32) 100%);
      border: 1.5px solid #ffd76a;
      color: #ffd76a;
      box-shadow: 0 0 16px rgba(255, 215, 106, 0.5);
      position: relative;
    }
    .tool-badge-new {
      position: absolute;
      top: -6px;
      right: -4px;
      background: #e8890c;
      color: #fff;
      font-size: 9px;
      font-weight: 900;
      padding: 2px 5px;
      border-radius: 8px;
      text-transform: uppercase;
      box-shadow: 0 2px 6px rgba(0,0,0,0.5);
    }

    .swatch-group {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 0 6px;
      border-left: 1px solid rgba(255, 255, 255, 0.12);
      border-right: 1px solid rgba(255, 255, 255, 0.12);
      margin: 0 4px;
    }
    .color-swatch {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      border: 2px solid transparent;
    }
    .color-swatch.active {
      border-color: #fff;
      transform: scale(1.15);
    }

    /* Screen Annotation Callout Arrows */
    .indicator-arrow {
      position: absolute;
      top: 360px;
      left: 1040px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 90;
      background: rgba(14, 26, 57, 0.95);
      padding: 10px 18px;
      border-radius: 30px;
      border: 1px solid #ffd76a;
      box-shadow: 0 8px 24px rgba(0,0,0,0.6);
      font-size: 14px;
      font-weight: 700;
      color: #ffd76a;
      animation: floatBadge 2.5s infinite ease-in-out;
    }

    @keyframes pulseBorder {
      0% { box-shadow: 0 0 16px rgba(255, 215, 106, 0.3); }
      100% { box-shadow: 0 0 32px rgba(255, 215, 106, 0.6); }
    }
    @keyframes floatBadge {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
  </style>
</head>
<body>
  <div class="stage">
    <!-- Top Header -->
    <header class="header">
      <div class="header-left">
        <div class="channel-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          SSIRO Classes • Decoding Indology
        </div>
        <span class="file-name">Lecture_04_Buddhist_Epigraphy.pdf</span>
      </div>
      <div class="header-right">
        <span class="page-counter">Slide 4 / 18</span>
        <button class="header-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
          Fit: 16:9
        </button>
        <button class="header-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Board
        </button>
        <button class="header-btn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          Mic LIVE
        </button>
        <button class="header-btn active">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
          Zen 4K
        </button>
      </div>
    </header>

    <!-- Slide Canvas Area -->
    <div class="slide-area">
      <div class="slide-canvas-mock">
        <!-- Title -->
        <div class="slide-title-bar">
          <div class="slide-title">
            <span>प्रतीत्यसमुत्पाद (Paṭiccasamuppāda)</span> — मूल बौद्ध सिद्धांत
          </div>
          <div class="slide-subtitle">प्राचीन पालि व अंग्रेजी शोध उद्धरण विश्लेषण</div>
        </div>

        <!-- Left Column: English / Pali screenshot marked by AI Snip Box -->
        <div class="screenshot-container">
          <div class="screenshot-header">
            <span>📷 PPT में लगा शोध पत्र स्क्रीनशॉट (Source Paper Excerpt)</span>
            <span>English &amp; Pali Source</span>
          </div>

          <div class="academic-text-snippet">
            "The doctrine of <em>Paṭiccasamuppāda</em> (Pali: Paṭiccasamuppāda; Sanskrit: <em>Pratītyasamutpāda</em>) constitutes the foundational matrix of early Buddhist epistemology. It asserts that all phenomena arise in mutual dependence upon conditions, fundamentally rejecting the notion of an uncaused prime mover or permanent metaphysical self (<em>Anattā</em>)."
            <br><br>
            "<em>Imasmiṃ sati idaṃ hoti; imassuppādā idaṃ uppajjati.</em><br>
            (When this exists, that comes to be; with the arising of this, that arises.)"
          </div>

          <!-- The Snip Highlight Box -->
          <div class="selection-snip-box">
            <div class="selection-tag">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
              <span>अंगुली/पेन से चुना गया एरिया (Selected Snip)</span>
            </div>
            <div class="snip-handle tl"></div>
            <div class="snip-handle tr"></div>
            <div class="snip-handle bl"></div>
            <div class="snip-handle br"></div>
          </div>
        </div>

        <!-- Floating Pointer Badge -->
        <div class="indicator-arrow">
          <span>⚡ 0.8 सेकंड में लाइव अनुवाद ➔</span>
        </div>

        <!-- Right Column: AI Translation Studio Popover Card -->
        <div class="translation-popover-card">
          <!-- Popover Top Bar -->
          <div class="popover-top-bar">
            <div class="popover-badge">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              <span>AI अनुवाद लेंस (AI Smart Lens)</span>
            </div>
            <div class="popover-actions">
              <button class="icon-chip-btn pin" title="स्लाइड पर हमेशा के लिए चिपकाएं">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 17v5M9 2h6l1 7H8l1-7zM7 9h10v3l-2 3H9l-2-3V9z"/></svg>
                स्लाइड पर रखें (Pin)
              </button>
              <button class="icon-chip-btn close" title="पॉपअप बंद करें">✕</button>
            </div>
          </div>

          <!-- Detected Language Pill -->
          <div class="detected-lang-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            पहचानी गई भाषा: <strong>अंग्रेजी (English) + पालि गाथा (Pali)</strong> ➔ <strong>हिंदी</strong>
          </div>

          <!-- Popover Body -->
          <div class="popover-body">
            <div class="translation-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              सरल व शुद्ध हिंदी अनुवाद (Hindi Translation)
            </div>

            <div class="hindi-translation-box">
              "<strong>प्रतीत्यसमुत्पाद</strong> (पाली: पटिच्चसमुप्पाद; संस्कृत: प्रतीत्यसमुत्पाद) का सिद्धांत आरंभिक बौद्ध ज्ञानमीमांसा का मूल आधार है। यह स्पष्ट करता है कि संपूर्ण अस्तित्व और सांसारिक घटनाएँ पूर्व-शर्तों व कारणों पर निर्भर होकर ही उत्पन्न होती हैं। यह किसी अकारण निर्माता (प्रथम कर्ता) अथवा किसी भी स्थायी आत्म-तत्व (<mark>अनात्मन / Anattā</mark>) के विचार को मूल रूप से नकारता है।"
              <br><br>
              <span style="color:#ffd76a; font-size:18px;">गाथा का अर्थ:</span> <em>"इसके होने से वह होता है; इसके उत्पन्न होने से वह उत्पन्न होता है।"</em>
            </div>

            <div class="translation-section-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              मुख्य पारिभाषिक शब्दावली (Key Vocabulary)
            </div>

            <div class="glossary-box">
              <div class="glossary-item">
                <span>•</span>
                <span><b>Paṭiccasamuppāda (पटिच्चसमुप्पाद):</b> कार्य-कारण का सिद्धांत (Dependent Origination)।</span>
              </div>
              <div class="glossary-item">
                <span>•</span>
                <span><b>Epistemology (ज्ञानमीमांसा):</b> ज्ञान, सत्य और प्रमाण के स्वरूप का दार्शनिक अध्ययन।</span>
              </div>
              <div class="glossary-item">
                <span>•</span>
                <span><b>Anattā (अनात्मन):</b> कोई स्थायी या अमर आत्मा नहीं होना।</span>
              </div>
            </div>
          </div>

          <!-- Popover Footer Actions -->
          <div class="popover-footer-actions">
            <div class="footer-left-btns">
              <button class="footer-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
                हिंदी में सुनें
              </button>
              <button class="footer-btn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                कॉपी करें
              </button>
            </div>
            <button class="footer-btn" style="color:#ffd76a;">
              <span>मूल पाठ (OCR) देखें ▾</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Draggable Toolbar -->
    <div class="toolbar-container">
      <div class="drag-handle" title="Drag Toolbar">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>

      <button class="tool-btn" title="Select Tool">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 3 7 18 3-7 7-3L3 3z"/></svg>
        <span>Select</span>
      </button>

      <button class="tool-btn" title="Pen (Draw)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        <span>Pen ▾</span>
      </button>

      <button class="tool-btn" title="Marker (Highlighter)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
        <span>Marker ▾</span>
      </button>

      <button class="tool-btn" title="Eraser">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/></svg>
        <span>Eraser ▾</span>
      </button>

      <button class="tool-btn" title="Magnifier Lens">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <span>Lens ▾</span>
      </button>

      <!-- ✨ THE NEW AI TRANSLATE BUTTON ✨ -->
      <button class="tool-btn tool-ai-translate active" title="AI लाइव ट्रांसलेटर लेंस">
        <span class="tool-badge-new">NEW</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <span>AI अनुवाद</span>
      </button>

      <div class="swatch-group">
        <div class="color-swatch active" style="background:#f59e0b;"></div>
        <div class="color-swatch" style="background:#ffffff;"></div>
        <div class="color-swatch" style="background:#38bdf8;"></div>
        <div class="color-swatch" style="background:#10b981;"></div>
        <div class="color-swatch" style="background:#ef4444;"></div>
      </div>

      <button class="tool-btn" title="Undo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        <span>Undo</span>
      </button>

      <button class="tool-btn" title="Clear">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
        <span>Clear</span>
      </button>

      <button class="tool-btn" title="Mic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        <span>Mic</span>
      </button>

      <button class="tool-btn" title="More Tools">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/></svg>
        <span>More</span>
      </button>
    </div>
  </div>
</body>
</html>`;

async function renderMockup() {
  const mockupHtmlPath = path.join('D:/Smart-Studio-Project', 'mockup-temp.html');
  fs.writeFileSync(mockupHtmlPath, htmlContent, 'utf-8');

  console.log('Launching browser to capture 2560x1440 4K mockup...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 2560, height: 1440 },
    deviceScaleFactor: 1
  });

  await page.goto('file:///' + mockupHtmlPath.replace(/\\\\/g, '/'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const outPath = 'C:/Users/rnran/.gemini/antigravity/brain/e31a8e05-f75a-4c8a-907e-d6832304c124/ai-translate-lens-mockup.png';
  await page.screenshot({ path: outPath });
  console.log('Mockup saved successfully to:', outPath);

  await browser.close();
  try { fs.unlinkSync(mockupHtmlPath); } catch {}
}

renderMockup().catch(console.error);
