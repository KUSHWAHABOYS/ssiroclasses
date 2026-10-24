// MIC-AI: Anthropic Claude Messages API Adapter
import { httpClient } from '../http';
import { AIProvider, ChatPayload, ModelInfo, VisionPayload } from './types';

export class AnthropicProvider implements AIProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic Claude';
  readonly baseUrl = 'https://api.anthropic.com/v1';
  readonly expectedHost = 'api.anthropic.com';

  private getHeaders(apiKey: string): Record<string, string> {
    return {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json'
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models`;
      const res = await httpClient.request({
        url,
        method: 'GET',
        headers: this.getHeaders(apiKey),
        expectedHost: this.expectedHost,
        providerId: this.id
      });
      return res.ok && Array.isArray(res.data?.data);
    } catch {
      return false;
    }
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const url = `${this.baseUrl}/models`;
      const res = await httpClient.request({
        url,
        method: 'GET',
        headers: this.getHeaders(apiKey),
        expectedHost: this.expectedHost,
        providerId: this.id
      });

      const raw = res.data?.data || [];
      const models: ModelInfo[] = [];

      for (const m of raw) {
        const id = m.id;
        models.push({
          id,
          provider: this.id,
          name: m.display_name || id,
          family: 'claude',
          contextWindow: 200000,
          supportsVision: true, // All Claude 3 and 3.5 models support vision
          supportsText: true
        });
      }

      if (models.length > 0) return models;
    } catch {}

    // Fallback catalog if /models list is restricted on standard keys
    return [
      {
        id: 'claude-3-5-sonnet-20241022',
        provider: this.id,
        name: 'Claude 3.5 Sonnet',
        family: 'claude',
        contextWindow: 200000,
        supportsVision: true,
        supportsText: true
      },
      {
        id: 'claude-3-5-haiku-20241022',
        provider: this.id,
        name: 'Claude 3.5 Haiku',
        family: 'claude',
        contextWindow: 200000,
        supportsVision: true,
        supportsText: true
      },
      {
        id: 'claude-3-opus-20240229',
        provider: this.id,
        name: 'Claude 3 Opus',
        family: 'claude',
        contextWindow: 200000,
        supportsVision: true,
        supportsText: true
      }
    ];
  }

  async chat(apiKey: string, payload: ChatPayload): Promise<string> {
    const model = payload.model || 'claude-3-5-sonnet-20241022';
    const url = `${this.baseUrl}/messages`;

    // Separate system messages for Claude Messages API
    const systemMsg = payload.messages.find((m) => m.role === 'system')?.content;
    const nonSystem = payload.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content
      }));

    const body: any = {
      model,
      max_tokens: payload.maxTokens ?? 2048,
      temperature: payload.temperature ?? 0.7,
      messages: nonSystem.length > 0 ? nonSystem : [{ role: 'user', content: 'Hello' }],
      ...(systemMsg ? { system: systemMsg } : {})
    };

    const res = await httpClient.request({
      url,
      method: 'POST',
      headers: this.getHeaders(apiKey),
      data: body,
      signal: payload.signal,
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const block = res.data?.content?.[0];
    const text = block?.text;
    if (!text && text !== '') {
      throw new Error('Claude ने कोई उत्तर नहीं दिया (No response returned)');
    }

    if (payload.onStreamChunk) {
      payload.onStreamChunk(text);
    }

    return text;
  }

  async vision(apiKey: string, payload: VisionPayload): Promise<string> {
    const model = payload.model || 'claude-3-5-sonnet-20241022';
    const url = `${this.baseUrl}/messages`;

    let base64 = payload.image;
    let mimeType = payload.mimeType || 'image/jpeg';

    if (base64.startsWith('data:')) {
      const match = base64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64 = match[2];
      }
    }

    const body: any = {
      model,
      max_tokens: payload.maxTokens ?? 1024,
      temperature: payload.temperature ?? 0.2,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mimeType,
                data: base64
              }
            },
            {
              type: 'text',
              text: payload.prompt
            }
          ]
        }
      ]
    };

    const res = await httpClient.request({
      url,
      method: 'POST',
      headers: this.getHeaders(apiKey),
      data: body,
      signal: payload.signal,
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const block = res.data?.content?.[0];
    const text = block?.text;
    if (!text && text !== '') {
      throw new Error('Claude Vision ने कोई उत्तर नहीं दिया (No vision response returned)');
    }

    return text;
  }
}

export const anthropicProvider = new AnthropicProvider();
