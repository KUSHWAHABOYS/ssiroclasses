// MIC-AI: Google Gemini API Adapter (x-goog-api-key header, Generative Language API)
import { httpClient } from '../http';
import { AIProvider, ChatPayload, ModelInfo, VisionPayload } from './types';

export class GeminiProvider implements AIProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly baseUrl = 'https://generativelanguage.googleapis.com';
  readonly expectedHost = 'generativelanguage.googleapis.com';

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/v1beta/models?pageSize=5`;
      const res = await httpClient.request({
        url,
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey
        },
        expectedHost: this.expectedHost,
        providerId: this.id
      });
      return res.ok && Array.isArray(res.data?.models);
    } catch {
      return false;
    }
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    const url = `${this.baseUrl}/v1beta/models?pageSize=50`;
    const res = await httpClient.request({
      url,
      method: 'GET',
      headers: {
        'x-goog-api-key': apiKey
      },
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const modelsRaw = res.data?.models || [];
    const models: ModelInfo[] = [];

    for (const m of modelsRaw) {
      const id = m.name?.replace(/^models\//, '') || m.name;
      // Filter for models supporting generateContent
      const methods: string[] = m.supportedGenerationMethods || [];
      if (methods.includes('generateContent') || methods.includes('generateAnswer')) {
        const isVision =
          id.includes('gemini') ||
          id.includes('vision') ||
          id.includes('flash') ||
          id.includes('pro');

        models.push({
          id,
          provider: this.id,
          name: m.displayName || id,
          family: 'gemini',
          contextWindow: m.inputTokenLimit || 32000,
          supportsVision: isVision,
          supportsText: true,
          deprecated: id.includes('001') || id.includes('legacy')
        });
      }
    }

    return models;
  }

  async chat(apiKey: string, payload: ChatPayload): Promise<string> {
    const model = payload.model || 'gemini-1.5-flash';
    const cleanModel = model.replace(/^models\//, '');
    const url = `${this.baseUrl}/v1beta/models/${cleanModel}:generateContent`;

    const contents = payload.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body: any = {
      contents,
      generationConfig: {
        temperature: payload.temperature ?? 0.7,
        maxOutputTokens: payload.maxTokens ?? 2048
      }
    };

    const res = await httpClient.request({
      url,
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey
      },
      data: body,
      signal: payload.signal,
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const candidate = res.data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini ने कोई उत्तर नहीं दिया (No response returned)');
    }

    if (payload.onStreamChunk) {
      payload.onStreamChunk(text);
    }

    return text;
  }

  async vision(apiKey: string, payload: VisionPayload): Promise<string> {
    const model = payload.model || 'gemini-1.5-flash';
    const cleanModel = model.replace(/^models\//, '');
    const url = `${this.baseUrl}/v1beta/models/${cleanModel}:generateContent`;

    let base64 = payload.image;
    let mimeType = payload.mimeType || 'image/jpeg';

    if (base64.startsWith('data:')) {
      const match = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64 = match[2];
      }
    }

    const contents = [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64
            }
          },
          {
            text: payload.prompt
          }
        ]
      }
    ];

    const body: any = {
      contents,
      generationConfig: {
        temperature: payload.temperature ?? 0.2,
        maxOutputTokens: payload.maxTokens ?? 1024
      }
    };

    const res = await httpClient.request({
      url,
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey
      },
      data: body,
      signal: payload.signal,
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const candidate = res.data?.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini Vision ने कोई उत्तर नहीं दिया (No vision response returned)');
    }

    return text;
  }
}

export const geminiProvider = new GeminiProvider();
