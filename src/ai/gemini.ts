import { keyVault } from './keyVault';
import { store } from '../state/store';

export class GeminiService {
  async recognizeHandwriting(base64PngWithoutPrefix: string): Promise<string> {
    const apiKey = await keyVault.getApiKey();
    if (!apiKey) {
      throw new Error('नो API कुंजी (No Gemini API key found in settings)');
    }

    const model = store.getState().settings.geminiModel || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const prompt =
      'Transcribe the single handwritten word or short phrase in this image exactly. Return only the text. Preserve Devanagari matras and shirorekha. If it is Hindi return Devanagari only; if English return Latin letters only. No explanation.';

    const requestBody = {
      contents: [
        {
          parts: [
            { text: prompt },
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
        temperature: 0.0,
        maxOutputTokens: 60
      }
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini API HTTP ${res.status}`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return candidateText;
  }

  async sendChat(
    history: Array<{ role: 'user' | 'model'; text: string }>,
    slideBase64Png?: string
  ): Promise<string> {
    const apiKey = await keyVault.getApiKey();
    if (!apiKey) {
      throw new Error('API Key missing. Please configure your Google Gemini key in Settings.');
    }

    const model = store.getState().settings.geminiModel || 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

    const formattedContents = history.map((msg, index) => {
      const isLast = index === history.length - 1;
      const parts: any[] = [{ text: msg.text }];

      // Attach slide screenshot if requested on last message
      if (isLast && slideBase64Png && msg.role === 'user') {
        parts.unshift({
          inline_data: {
            mime_type: 'image/png',
            data: slideBase64Png
          }
        });
      }

      return {
        role: msg.role === 'user' ? 'user' : 'model',
        parts
      };
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({ contents: formattedContents })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

export const geminiService = new GeminiService();
