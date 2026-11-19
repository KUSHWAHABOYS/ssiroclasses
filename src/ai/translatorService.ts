import { keyVault } from './keyVault';
import { store } from '../state/store';

export interface TranslationResult {
  detectedLanguage: string;
  originalText: string;
  hindiTranslation: string;
  keyGlossary: Array<{ term: string; meaning: string }>;
  summary?: string;
  rawResponse?: string;
}

export class TranslatorService {
  private cachedWorkingModel: string | null = null;
  private readonly fallbackCandidates = [
    'gemini-2.0-flash',
    'gemini-1.5-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro'
  ];

  /**
   * Automatically resolves the best active Gemini model with zero network discovery delay
   */
  async resolveWorkingModel(apiKey: string, forceFresh = false): Promise<string> {
    if (!forceFresh && this.cachedWorkingModel) {
      return this.cachedWorkingModel;
    }

    if (!forceFresh) {
      try {
        const saved = localStorage.getItem('smart_studio_working_gemini_model');
        if (saved && saved.startsWith('gemini') && (saved.includes('2.0') || saved.includes('1.5') || saved.includes('2.5'))) {
          this.cachedWorkingModel = saved;
          return saved;
        }
      } catch {}
    }

    // Default directly to fastest gemini-2.0-flash for sub-second responses
    const defaultModel = 'gemini-2.0-flash';
    this.setWorkingModel(defaultModel);
    return defaultModel;
  }

  private setWorkingModel(model: string): void {
    this.cachedWorkingModel = model;
    try {
      localStorage.setItem('smart_studio_working_gemini_model', model);
      store.updateSettings({ geminiModel: model });
    } catch {}
  }

  /**
   * Translates an image snippet (English / Sanskrit / Pali) into high-quality Hindi
   * @param base64PngWithoutPrefix Base64 encoded PNG data (without data:image/png;base64,)
   */
  async translateImageRegion(base64PngWithoutPrefix: string): Promise<TranslationResult> {
    const apiKey = await keyVault.getKey('gemini');
    if (!apiKey) {
      const err: any = new Error('NO_API_KEY');
      err.code = 'NO_API_KEY';
      throw err;
    }

    const initialModel = await this.resolveWorkingModel(apiKey);

    // Build ordered list of candidate models for seamless automatic fallback
    const candidateList = [
      initialModel,
      ...this.fallbackCandidates.filter((m) => m !== initialModel)
    ];

    const systemPrompt = `You are a distinguished scholar and master translator. The user is a teacher lecturing live on a digital smart board to Indian students.
Examine the provided image (academic screenshot, book passage, Sanskrit shloka, or Pali sutta).

Instructions:
1. Provide a clear, natural, and fluent Hindi translation in "hindiTranslation".
2. If there are technical, philosophical, or difficult terms, provide 1 to 4 of them in the "keyGlossary" array with brief Hindi meanings.
3. Keep the response concise, high-speed, direct, and ready for immediate teaching.

Return ONLY a valid JSON object with this exact structure:
{
  "detectedLanguage": "string",
  "hindiTranslation": "string (pure, clear, fluent Hindi translation)",
  "keyGlossary": [
    { "term": "term", "meaning": "Hindi explanation" }
  ],
  "originalText": "string (transcribed source text)"
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            { text: systemPrompt },
            {
              inline_data: {
                mime_type: 'image/png',
                data: base64PngWithoutPrefix
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        maxOutputTokens: 1024
      }
    };

    let lastError: Error | null = null;

    // Resilient automatic model fallback: try candidates until success
    for (const modelCandidate of candidateList) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelCandidate}:generateContent`;

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify(requestBody)
        });
      } catch (networkErr: any) {
        throw new Error(`इंटरनेट या नेटवर्क त्रुटि: ${networkErr.message || 'कनेक्शन नहीं बन सका'}`);
      }

      if (response.ok) {
        const data = await response.json();
        const rawCandidate = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        // Remember successful working model
        this.setWorkingModel(modelCandidate);
        return this.parseResponse(rawCandidate);
      }

      const errData = await response.json().catch(() => ({}));
      const msg: string = errData?.error?.message || `HTTP ${response.status} ${response.statusText}`;

      // If invalid API key, fail fast
      if (response.status === 400 && msg.toLowerCase().includes('api key')) {
        throw new Error(`Gemini API Key अमान्य है: ${msg}`);
      } else if (response.status === 403) {
        throw new Error(`Gemini API Key प्रतिबंधित या अनाधिकृत है: ${msg}`);
      } else if (response.status === 429) {
        // Model-specific quota exceeded, attempt next candidate model!
        console.warn(`Model ${modelCandidate} quota limit (429) reached, falling back to next candidate...`);
        lastError = new Error(`Gemini कोटा सीमा (Rate Limit) समाप्त हो गई है। कृपया थोड़ी देर बाद पुनः प्रयास करें।`);
        continue;
      }

      // If model not found (404) or temporary service unavailable (503), try next candidate
      console.warn(`Model ${modelCandidate} failed (${msg}), trying next available candidate...`);
      lastError = new Error(`अनुवाद त्रुटि: ${msg}`);
    }

    throw lastError || new Error('सभी उपलब्ध Gemini मॉडल अनुपलब्ध रहे। कृपया इंटरनेट कनेक्शन जांचें।');
  }

  private parseResponse(raw: string): TranslationResult {
    // Clean code fences if present (```json ... ```)
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\s*/, '').replace(/\s*```$/, '').trim();
    }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }

    try {
      const parsed = JSON.parse(cleaned);
      return {
        detectedLanguage: parsed.detectedLanguage || 'स्वचालित (Auto-detected)',
        originalText: parsed.originalText || '',
        hindiTranslation: parsed.hindiTranslation || '',
        keyGlossary: Array.isArray(parsed.keyGlossary) ? parsed.keyGlossary : [],
        summary: parsed.summary || '',
        rawResponse: raw
      };
    } catch (e) {
      // Robust fallback: Extract fields even if JSON has minor syntax or escaping quirks
      let detectedLanguage = 'स्वचालित (Auto-detected)';
      let originalText = '';
      let hindiTranslation = '';
      let summary = '';
      const keyGlossary: Array<{ term: string; meaning: string }> = [];

      const langMatch = cleaned.match(/"detectedLanguage"\s*:\s*"([^"]+)"/);
      if (langMatch) detectedLanguage = langMatch[1];

      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([^"]+)"/);
      if (summaryMatch) summary = summaryMatch[1];

      const hindiMatch =
        cleaned.match(/"hindiTranslation"\s*:\s*"((?:[^"\\]|\\.)*)"/s) ||
        cleaned.match(/"hindiTranslation"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"\w+"|\s*})/s);
      if (hindiMatch && hindiMatch[1]) {
        hindiTranslation = hindiMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .replace(/\\t/g, '\t')
          .replace(/\\r/g, '')
          .trim();
      }

      const origMatch =
        cleaned.match(/"originalText"\s*:\s*"((?:[^"\\]|\\.)*)"/s) ||
        cleaned.match(/"originalText"\s*:\s*"([\s\S]*?)(?:"\s*,\s*"\w+"|\s*})/s);
      if (origMatch && origMatch[1]) {
        originalText = origMatch[1]
          .replace(/\\n/g, '\n')
          .replace(/\\"/g, '"')
          .trim();
      }

      if (hindiTranslation && hindiTranslation.length > 5) {
        return {
          detectedLanguage,
          originalText,
          hindiTranslation,
          keyGlossary,
          summary,
          rawResponse: raw
        };
      }

      return {
        detectedLanguage: 'अंग्रेजी / पालि / संस्कृत ➔ हिंदी',
        originalText: '',
        hindiTranslation: cleaned.replace(/^[{\s]*"hindiTranslation"\s*:\s*"?/, '').replace(/["}\s]*$/, ''),
        keyGlossary: [],
        summary,
        rawResponse: raw
      };
    }
  }
}

export const translatorService = new TranslatorService();
