export const i18n = {
  hi: {
    appTitle: 'स्मार्ट स्टूडियो प्रस्तुतकर्ता प्रो',
    channelName: 'Decoding Indology',
    openDeck: 'डेक खोलें',
    board: 'ब्लैकबोर्ड',
    fullscreen: 'फुलस्क्रीन (Zen)',
    select: 'चयन',
    pen: 'पेन',
    highlighter: 'हाइलाइटर',
    eraser: 'रबर',
    undo: 'पूर्ववत करें',
    clearAll: 'सब साफ़ करें',
    shapes: 'आकृतियाँ',
    rect: 'आयत',
    circle: 'वृत्त',
    line: 'रेखा',
    arrow: 'स्मार्ट तीर',
    handwriting: 'हस्तलेखन ➔ टेक्स्ट',
    media: 'मीडिया जोड़ें',
    browser: 'ब्राउज़र',
    gemini: 'जेमिनी AI',
    settings: 'सेटिंग्स',
    close: 'बंद करें',
    pageOf: 'पृष्ठ {current} का {total}',
    webFallbackTitle: 'यह साइट इस बॉक्स में सीधे नहीं खुल सकती',
    webFallbackMsg: 'सुरक्षा (X-Frame-Options) के कारण गूगल या बाहरी साइटें इन-ऐप फ़्रेम में अवरुद्ध हैं। कृपया इसे नई विंडो में खोलें और OBS/StreamYard में विंडो कैप्चर का उपयोग करें।',
    openInNewWindow: 'नई विंडो में खोलें',
    undoConversion: 'हस्तलेखन रूपांतरण पूर्ववत करें',
    geminiExplainSlide: 'यह स्लाइड समझाएं (Explain Slide)',
    geminiPlaceholder: 'जेमिनी से कुछ भी पूछें (हिंदी या English)...',
    apiKeyNote: 'आपकी API कुंजी इस डिवाइस पर AES-GCM से एन्क्रिप्टेड है और सीधे Google को जाती है।',
    offlineNotice: 'ऑफ़लाइन मोड सक्रिय',
    // SSIRO-UPDATE: Strings for Magnifier & Zoom
    magnifier: 'मैग्नीफ़ायर',
    zoom: 'झूम',
    pinLens: 'लेंस टिकाएँ',
    resetZoom: 'रीसेट 1×',
    spotlight: 'स्पॉटलाइट'
  },
  en: {
    appTitle: 'Smart Studio Presenter Pro',
    channelName: 'Decoding Indology',
    openDeck: 'Open Deck',
    board: 'Blackboard',
    fullscreen: 'Fullscreen (Zen)',
    select: 'Select',
    pen: 'Pen',
    highlighter: 'Highlighter',
    eraser: 'Eraser',
    undo: 'Undo',
    clearAll: 'Clear All',
    shapes: 'Shapes',
    rect: 'Rectangle',
    circle: 'Circle',
    line: 'Line',
    arrow: 'Smart Arrow',
    handwriting: 'Handwriting ➔ Text',
    media: 'Add Media',
    browser: 'Browser',
    gemini: 'Gemini AI',
    settings: 'Settings',
    close: 'Close',
    pageOf: 'Page {current} of {total}',
    webFallbackTitle: 'This site cannot be loaded inside this frame',
    webFallbackMsg: 'Due to X-Frame-Options / CSP policies, Google or external websites are blocked in iframes. Please open in a new window and use Window Capture in OBS/StreamYard.',
    openInNewWindow: 'Open in New Window',
    undoConversion: 'Undo Handwriting Conversion',
    geminiExplainSlide: 'Explain this Slide with Vision',
    geminiPlaceholder: 'Ask Gemini anything (Hindi or English)...',
    apiKeyNote: 'Your API key is encrypted on-device via AES-GCM; requests go directly to Google.',
    offlineNotice: 'Offline Mode Active',
    // SSIRO-UPDATE: Strings for Magnifier & Zoom
    magnifier: 'Magnifier',
    zoom: 'Zoom',
    pinLens: 'Pin lens',
    resetZoom: 'Reset 1×',
    spotlight: 'Spotlight'
  }
};

export function t(key: keyof typeof i18n['hi'], lang: 'hi' | 'en' = 'hi', params?: Record<string, string | number>): string {
  let str = (i18n[lang] && i18n[lang][key]) || i18n['en'][key] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}
