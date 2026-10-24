// ECON: Comprehensive Hindi/English Voice Commands Dictionary (Part E)
// Supports ordinals up to 50, Devanagari digits, Roman transliterations, and synonyms

export const FILLER_WORDS = [
  'भैया', 'यार', 'जरा', 'ज़रा', 'कृपया', 'सुनो', 'सुन', 'अरे', 'प्लीज', 'प्लीज़',
  'bhaiya', 'yaar', 'zara', 'please', 'suno', 'sun', 'arey', 'bhai'
];

// Devanagari digits map (१ - ५०)
export const DEVANAGARI_DIGITS: Record<string, number> = {
  '१': 1, '२': 2, '३': 3, '४': 4, '५': 5, '६': 6, '७': 7, '८': 8, '९': 9, '१०': 10,
  '११': 11, '१२': 12, '१३': 13, '१४': 14, '१५': 15, '१६': 16, '१७': 17, '१८': 18, '१९': 19, '२०': 20,
  '२१': 21, '२२': 22, '२३': 23, '२४': 24, '२५': 25, '२६': 26, '२७': 27, '२८': 28, '२९': 29, '३०': 30,
  '३१': 31, '३२': 32, '३३': 33, '३४': 34, '३५': 35, '३६': 36, '३७': 37, '३८': 38, '३९': 39, '४०': 40,
  '४१': 41, '४२': 42, '४३': 43, '४४': 44, '४५': 45, '४६': 46, '४७': 47, '४८': 48, '४९': 49, '५०': 50
};

// Hindi words, ordinals, English words up to 50
export const NUMBER_WORDS: Record<string, number> = {
  // 1 - 10
  '1': 1, 'one': 1, 'एक': 1, 'पहला': 1, 'पहली': 1, 'प्रथम': 1, 'first': 1, 'ek': 1, 'pehla': 1, 'pehli': 1,
  '2': 2, 'two': 2, 'दो': 2, 'दूसरा': 2, 'दूसरी': 2, 'द्वितीय': 2, 'second': 2, 'do': 2, 'doosra': 2, 'doosri': 2,
  '3': 3, 'three': 3, 'तीन': 3, 'तीसरा': 3, 'तीसरी': 3, 'तृतीय': 3, 'third': 3, 'teen': 3, 'teesra': 3, 'teesri': 3,
  '4': 4, 'four': 4, 'चार': 4, 'चौथा': 4, 'चौथी': 4, 'चतुर्थ': 4, 'fourth': 4, 'chaar': 4, 'chautha': 4, 'chauthi': 4,
  '5': 5, 'five': 5, 'पाँच': 5, 'पांच': 5, 'पाँचवा': 5, 'पाँचवी': 5, 'पांचवा': 5, 'पांचवी': 5, 'fifth': 5, 'paanch': 5,
  '6': 6, 'six': 6, 'छह': 6, 'छः': 6, 'छठा': 6, 'छठी': 6, 'sixth': 6, 'chhah': 6, 'chhe': 6,
  '7': 7, 'seven': 7, 'सात': 7, 'सातवा': 7, 'सातवी': 7, 'seventh': 7, 'saat': 7,
  '8': 8, 'eight': 8, 'आठ': 8, 'आठवा': 8, 'आठवी': 8, 'eighth': 8, 'aath': 8,
  '9': 9, 'nine': 9, 'नौ': 9, 'नौवा': 9, 'नौवी': 9, 'ninth': 9, 'nau': 9,
  '10': 10, 'ten': 10, 'दस': 10, 'दसवा': 10, 'दसवी': 10, 'tenth': 10, 'das': 10,

  // 11 - 20
  '11': 11, 'eleven': 11, 'ग्यारह': 11, 'gyaarah': 11,
  '12': 12, 'twelve': 12, 'बारह': 12, 'baarah': 12,
  '13': 13, 'thirteen': 13, 'तेरह': 13, 'terah': 13,
  '14': 14, 'fourteen': 14, 'चौदह': 14, 'chaudah': 14,
  '15': 15, 'fifteen': 15, 'पंद्रह': 15, 'पंद्रहवां': 15, 'पंद्रहवीं': 15, 'pandrah': 15,
  '16': 16, 'sixteen': 16, 'सोलह': 16, 'solah': 16,
  '17': 17, 'seventeen': 17, 'सत्रह': 17, 'satrah': 17,
  '18': 18, 'eighteen': 18, 'अठारह': 18, 'athaarah': 18,
  '19': 19, 'nineteen': 19, 'उन्नीस': 19, 'unnees': 19,
  '20': 20, 'twenty': 20, 'बीस': 20, 'bees': 20,

  // 21 - 30
  '21': 21, 'इक्कीस': 21, 'twenty one': 21,
  '22': 22, 'बाईस': 22, 'twenty two': 22,
  '23': 23, 'तेईस': 23, 'twenty three': 23,
  '24': 24, 'चौबीस': 24, 'twenty four': 24,
  '25': 25, 'पच्चीस': 25, 'पच्चीसवां': 25, 'पच्चीसवीं': 25, 'twenty five': 25,
  '26': 26, 'छब्बीस': 26, 'twenty six': 26,
  '27': 27, 'सत्ताईस': 27, 'twenty seven': 27,
  '28': 28, 'अट्ठाईस': 28, 'twenty eight': 28,
  '29': 29, 'उनतीस': 29, 'twenty nine': 29,
  '30': 30, 'तीस': 30, 'thirty': 30,

  // 31 - 40
  '31': 31, 'इकत्तीस': 31, 'thirty one': 31,
  '32': 32, 'बत्तीस': 32, 'thirty two': 32,
  '33': 33, 'तैंतीस': 33, 'thirty three': 33,
  '34': 34, 'चौंतीस': 34, 'thirty four': 34,
  '35': 35, 'पैंतीस': 35, 'thirty five': 35,
  '36': 36, 'छत्तीस': 36, 'thirty six': 36,
  '37': 37, 'सैंतीस': 37, 'thirty seven': 37,
  '38': 38, 'अड़तीस': 38, 'thirty eight': 38,
  '39': 39, 'उनतालीस': 39, 'thirty nine': 39,
  '40': 40, 'चालीस': 40, 'forty': 40,

  // 41 - 50
  '41': 41, 'इकतालीस': 41, 'forty one': 41,
  '42': 42, 'बयालीस': 42, 'forty two': 42,
  '43': 43, 'तैंतालीस': 43, 'forty three': 43,
  '44': 44, 'चवालीस': 44, 'forty four': 44,
  '45': 45, 'पैंतालीस': 45, 'forty five': 45,
  '46': 46, 'छियालीस': 46, 'forty six': 46,
  '47': 47, 'सैंतालीस': 47, 'forty seven': 47,
  '48': 48, 'अड़तालीस': 48, 'forty eight': 48,
  '49': 49, 'उनचास': 49, 'forty nine': 49,
  '50': 50, 'पचास': 50, 'पचासवां': 50, 'पचासवीं': 50, 'fifty': 50
};

// Merge Devanagari digits into number words
for (const [k, v] of Object.entries(DEVANAGARI_DIGITS)) {
  NUMBER_WORDS[k] = v;
}

export interface VoiceCommandDef {
  action: string;
  icon: string;
  synonyms: string[];
}

export const COMMANDS_REGISTRY: VoiceCommandDef[] = [
  {
    action: 'next',
    icon: '➡️',
    synonyms: ['next', 'अगला', 'अगली', 'आगे', 'agla', 'agli', 'aage', 'aage chalo', 'aage badho', 'next slide']
  },
  {
    action: 'prev',
    icon: '⬅️',
    synonyms: ['back', 'पिछला', 'पिछली', 'पीछे', 'pichla', 'pichli', 'peeche', 'piche chalo', 'previous', 'previous slide']
  },
  {
    action: 'first_slide',
    icon: '⏮️',
    synonyms: ['पहली स्लाइड', 'पहला पेज', 'first slide', 'start slide', 'shuruati slide']
  },
  {
    action: 'last_slide',
    icon: '⏭️',
    synonyms: ['आख़िरी स्लाइड', 'आखिरी स्लाइड', 'अंतिम स्लाइड', 'last slide', 'aakhri slide', 'end slide']
  },
  {
    action: 'pen',
    icon: '✏️',
    synonyms: ['pen', 'पेन', 'कलम', 'likho', 'write', 'draw']
  },
  {
    action: 'marker',
    icon: '🖍️',
    synonyms: ['marker', 'highlighter', 'मार्कर', 'हाइलाइटर', 'highlight karo', 'mark karo']
  },
  {
    action: 'eraser',
    icon: '🧹',
    synonyms: ['eraser', 'इरेज़र', 'इरेजर', 'रबर', 'mitane wala']
  },
  {
    action: 'clear',
    icon: '🗑️',
    synonyms: ['clear', 'साफ़', 'साफ', 'मिटाओ', 'सब मिटाओ', 'clear all', 'sab mitao']
  },
  {
    action: 'undo',
    icon: '↩️',
    synonyms: ['undo', 'वापस', 'undo karo', 'piche lo']
  },
  {
    action: 'board',
    icon: '📋',
    synonyms: ['board', 'ब्लैकबोर्ड', 'बोर्ड', 'blackboard', 'whiteboard', 'greenboard']
  },
  {
    action: 'magnifier',
    icon: '🔍',
    synonyms: ['magnifier', 'lens', 'मैग्नीफ़ायर', 'मैग्नीफायर', 'लेंस', 'chashma']
  },
  {
    action: 'zoom_in',
    icon: '🔎+',
    synonyms: ['zoom in', 'बड़ा करो', 'bada karo', 'zoom karo', 'zoom badhao']
  },
  {
    action: 'zoom_out',
    icon: '🔎−',
    synonyms: ['zoom out', 'छोटा करो', 'chhota karo', 'zoom ghatao']
  },
  {
    action: 'zoom_reset',
    icon: '🔍0',
    synonyms: ['reset zoom', 'zoom reset', 'normal karo', 'झूम हटाओ', 'रीसेट झूम']
  },
  {
    action: 'spotlight',
    icon: '💡',
    synonyms: ['spotlight', 'स्पॉटलाइट', 'focus light']
  },
  {
    action: 'fullscreen',
    icon: '⛶',
    synonyms: ['fullscreen', 'फुलस्क्रीन', 'पूर्ण स्क्रीन', 'full screen']
  },
  {
    action: 'close',
    icon: '✕',
    synonyms: ['close', 'बंद करो', 'बंद', 'हटाओ', 'band karo']
  },
  {
    action: 'mic_off',
    icon: '🎙️✕',
    synonyms: ['stop listening', 'माइक बंद', 'माइक ऑफ', 'माइक बंद करो', 'mic off', 'mute mic', 'chup raho']
  },
  // Color commands
  {
    action: 'color_red',
    icon: '🔴',
    synonyms: ['लाल रंग', 'लाल', 'red', 'laal rang', 'red color']
  },
  {
    action: 'color_blue',
    icon: '🔵',
    synonyms: ['नीला रंग', 'नीला', 'blue', 'neela rang', 'blue color']
  },
  {
    action: 'color_green',
    icon: '🟢',
    synonyms: ['हरा रंग', 'हरा', 'green', 'hara rang', 'green color']
  },
  {
    action: 'color_yellow',
    icon: '🟡',
    synonyms: ['पीला रंग', 'पीला', 'yellow', 'peela rang', 'saffron', 'gold']
  },
  {
    action: 'color_white',
    icon: '⚪',
    synonyms: ['सफ़ेद रंग', 'सफेद रंग', 'सफ़ेद', 'सफेद', 'white', 'safed rang']
  },
  // Size commands
  {
    action: 'size_thicker',
    icon: '✏️▲',
    synonyms: ['मोटा करो', 'mota karo', 'thicker', 'increase pen size', 'pen mota']
  },
  {
    action: 'size_thinner',
    icon: '✏️▼',
    synonyms: ['पतला करो', 'patla karo', 'thinner', 'decrease pen size', 'pen patla']
  }
];

/**
 * ECON: Strips conversational fillers and punctuation from raw transcript (Part E)
 */
export function normalizeSpeech(phrase: string): string {
  let clean = ' ' + (phrase || '').toLowerCase().replace(/[।.,!?]/g, ' ') + ' ';
  for (const f of FILLER_WORDS) {
    clean = clean.split(' ' + f + ' ').join(' ');
  }
  return clean.replace(/\s+/g, ' ').trim();
}

/**
 * ECON: Deterministic local matcher for 60+ voice commands without AI (Part E)
 */
export function matchCommandFromDict(phrase: string): { action: string; icon: string } | null {
  const norm = normalizeSpeech(phrase);
  if (!norm) return null;

  // 1. Mic off
  if (/stop\s*(listening|mic)|माइक\s*(बंद|ऑफ)|turn\s*off\s*microphone|mute\s*mic/i.test(norm)) {
    return { action: 'mic:off', icon: '🎙️✕' };
  }

  // 2. Navigation Next
  if (/^(अगली|आगे|अगला|next)(\s+(स्लाइड|slide|पर|चलो|badho|chalo))*$/i.test(norm) || /^(next\s*slide|आगे\s*चलो|अगली\s*स्लाइड)$/i.test(norm)) {
    return { action: 'next', icon: '➡️' };
  }

  // 3. Navigation Prev
  if (/^(पिछली|पीछे|पिछला|back|previous)(\s+(स्लाइड|slide|पर|चलो|chalo))*$/i.test(norm) || /^(previous\s*slide|पीछे\s*चलो|पिछली\s*स्लाइड)$/i.test(norm)) {
    return { action: 'prev', icon: '⬅️' };
  }

  // 4. First / Last slide
  if (/(पहली\s*स्लाइड|पहला\s*पेज|first\s*slide|start\s*slide)/i.test(norm)) {
    return { action: 'goto:1', icon: '⏮️' };
  }
  if (/(आख़िरी|आखिरी|अंतिम|last)\s*(स्लाइड|slide)/i.test(norm)) {
    return { action: 'goto:last', icon: '⏭️' };
  }

  // 5. Ordinals / Numbered slide (e.g. "तीसरी स्लाइड", "दूसरी स्लाइड", "slide 5", "स्लाइड १०", "पंद्रहवीं स्लाइड पर चलो")
  const sortedNumberWords = Object.entries(NUMBER_WORDS).sort((a, b) => b[0].length - a[0].length);
  for (const [word, num] of sortedNumberWords) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex1 = new RegExp(`(?:स्लाइड|slide)\\s*${escaped}(?![०-९0-9])`, 'i');
    const regex2 = new RegExp(`(?:^|\\s)${escaped}(?![०-९0-9])\\s*(?:स्लाइड|slide|पेज|page|वीं|th|nd|rd|st)`, 'i');
    const regex3 = new RegExp(`(?:^|\\s)${escaped}(?![०-९0-9])\\s*(?:स्लाइड\\s*पर\\s*चलो)`, 'i');
    if (regex1.test(norm) || regex2.test(norm) || regex3.test(norm)) {
      return { action: `goto:${num}`, icon: '🎯' };
    }
  }

  const digitMatch = norm.match(/(?:स्लाइड|slide)\s*(\d+)/i);
  if (digitMatch) {
    return { action: `goto:${digitMatch[1]}`, icon: '🎯' };
  }

  // 6. Tools
  if (/pen|पेन|कलम/i.test(norm)) {
    return { action: 'tool:pen', icon: '✏️' };
  }
  if (/marker|मार्कर|हाईलाइटर|हाइलाइटर/i.test(norm)) {
    return { action: 'tool:marker', icon: '🖍️' };
  }
  if (/eraser|इरेज़र|इरेजर|रबर/i.test(norm)) {
    return { action: 'tool:eraser', icon: '🧹' };
  }
  if (/मैग्नीफ़ायर|magnifier|lens|आवर्धक/i.test(norm)) {
    return { action: 'tool:lens', icon: '🔍' };
  }

  // 7. Board & Zoom & Fullscreen
  if (/बोर्ड|blackboard|board|श्वेतपट्ट/i.test(norm)) {
    return { action: 'board:toggle', icon: '📋' };
  }
  if (/ज़ूम\s*इन|zoom\s*in/i.test(norm)) {
    return { action: 'zoom:in', icon: '🔎+' };
  }
  if (/ज़ूम\s*आउट|zoom\s*out/i.test(norm)) {
    return { action: 'zoom:out', icon: '🔎−' };
  }
  if (/ज़ूम\s*रीसेट|zoom\s*reset|reset\s*zoom/i.test(norm)) {
    return { action: 'zoom:reset', icon: '🔍0' };
  }
  if (/फुलस्क्रीन|fullscreen|पूर्ण\s*स्क्रीन/i.test(norm)) {
    return { action: 'fullscreen:toggle', icon: '⛶' };
  }
  if (/स्पॉटलाइट|spotlight/i.test(norm)) {
    return { action: 'spotlight:toggle', icon: '💡' };
  }

  // 8. Colors
  if (/लाल|red/i.test(norm)) {
    return { action: 'color:#ef4444', icon: '🔴' };
  }
  if (/नीला|blue/i.test(norm)) {
    return { action: 'color:#3b82f6', icon: '🔵' };
  }
  if (/हरा|green/i.test(norm)) {
    return { action: 'color:#22c55e', icon: '🟢' };
  }
  if (/पीला|yellow/i.test(norm)) {
    return { action: 'color:#eab308', icon: '🟡' };
  }
  if (/सफ़ेद|सफेद|white/i.test(norm)) {
    return { action: 'color:#ffffff', icon: '⚪' };
  }
  if (/(?:^|\s)(?:काला|black)(?:\s|$| रंग| color)/i.test(norm) || /^(काला|black)$/i.test(norm)) {
    return { action: 'color:#000000', icon: '⚫' };
  }

  // 9. Actions
  if (/साफ़|साफ|clear/i.test(norm)) {
    return { action: 'action:clear', icon: '🗑️' };
  }
  if (/वापस|undo/i.test(norm)) {
    return { action: 'action:undo', icon: '↩️' };
  }

  return null;
}

export const commandsDict = {
  FILLER_WORDS,
  DEVANAGARI_DIGITS,
  NUMBER_WORDS,
  COMMANDS_REGISTRY,
  normalizeSpeech,
  matchCommandFromDict
};

