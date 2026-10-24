// MIC-AI: Universal OpenAI-Compatible API Adapter (OpenAI, xAI, Groq, Mistral, DeepSeek, OpenRouter, Perplexity, Custom)
import { httpClient } from '../http';
import { AIProvider, ChatPayload, ModelInfo, VisionPayload } from './types';

export interface OpenAICompatConfig {
  id: string;
  name: string;
  baseUrl: string;
  expectedHost: string;
  defaultModel: string;
  defaultVisionModel?: string;
  extraHeaders?: Record<string, string>;
}

export class OpenAICompatProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly expectedHost: string;
  readonly defaultModel: string;
  readonly defaultVisionModel?: string;
  readonly extraHeaders?: Record<string, string>;

  constructor(config: OpenAICompatConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.expectedHost = config.expectedHost;
    this.defaultModel = config.defaultModel;
    this.defaultVisionModel = config.defaultVisionModel;
    this.extraHeaders = config.extraHeaders;
  }

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models`;
      const res = await httpClient.request({
        url,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(this.extraHeaders || {})
        },
        expectedHost: this.expectedHost,
        providerId: this.id
      });
      return res.ok && (Array.isArray(res.data?.data) || Array.isArray(res.data));
    } catch {
      return false;
    }
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    const url = `${this.baseUrl}/models`;
    const res = await httpClient.request({
      url,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(this.extraHeaders || {})
      },
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const rawList = Array.isArray(res.data?.data)
      ? res.data.data
      : Array.isArray(res.data)
      ? res.data
      : [];

    const models: ModelInfo[] = [];

    for (const item of rawList) {
      const id = typeof item === 'string' ? item : item.id;
      if (!id || typeof id !== 'string') continue;

      const lower = id.toLowerCase();
      // Heuristic detection of vision support
      const isVision =
        lower.includes('vision') ||
        lower.includes('vl') ||
        lower.includes('4o') ||
        lower.includes('pixtral') ||
        lower.includes('gpt-4-turbo') ||
        lower.includes('claude-3') ||
        lower.includes('gemini') ||
        lower.includes('groq-vision') ||
        lower.includes('llava');

      // Filter out embeddings / tts / audio-only models from chat list
      if (lower.includes('embed') || lower.includes('tts') || lower.includes('dall-e') || lower.includes('whisper')) {
        continue;
      }

      models.push({
        id,
        provider: this.id,
        name: typeof item === 'object' && item.name ? item.name : id,
        family: this.inferFamily(id),
        contextWindow: typeof item === 'object' && item.context_length ? item.context_length : 32000,
        supportsVision: isVision,
        supportsText: true,
        deprecated: lower.includes('instruct') || lower.includes('0314') || lower.includes('0613')
      });
    }

    return models;
  }

  async chat(apiKey: string, payload: ChatPayload): Promise<string> {
    const model = payload.model || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    const body: any = {
      model,
      messages: payload.messages.map((m) => ({
        role: m.role,
        content: m.content
      })),
      temperature: payload.temperature ?? 0.7,
      max_tokens: payload.maxTokens ?? 2048
    };

    const res = await httpClient.request({
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(this.extraHeaders || {})
      },
      data: body,
      signal: payload.signal,
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const choice = res.data?.choices?.[0];
    const text = choice?.message?.content;
    if (!text && text !== '') {
      throw new Error(`${this.name} ने कोई उत्तर नहीं दिया (No response returned)`);
    }

    if (payload.onStreamChunk) {
      payload.onStreamChunk(text);
    }

    return text;
  }

  async vision(apiKey: string, payload: VisionPayload): Promise<string> {
    const model = payload.model || this.defaultVisionModel || this.defaultModel;
    const url = `${this.baseUrl}/chat/completions`;

    let dataUrl = payload.image;
    if (!dataUrl.startsWith('data:')) {
      const mime = payload.mimeType || 'image/jpeg';
      dataUrl = `data:${mime};base64,${dataUrl}`;
    }

    const body: any = {
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: payload.prompt },
            {
              type: 'image_url',
              image_url: {
                url: dataUrl
              }
            }
          ]
        }
      ],
      temperature: payload.temperature ?? 0.2,
      max_tokens: payload.maxTokens ?? 1024
    };

    const res = await httpClient.request({
      url,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(this.extraHeaders || {})
      },
      data: body,
      signal: payload.signal,
      expectedHost: this.expectedHost,
      providerId: this.id
    });

    const choice = res.data?.choices?.[0];
    const text = choice?.message?.content;
    if (!text && text !== '') {
      throw new Error(`${this.name} Vision ने कोई उत्तर नहीं दिया (No vision response returned)`);
    }

    return text;
  }

  private inferFamily(modelId: string): string {
    const lower = modelId.toLowerCase();
    if (lower.includes('gpt')) return 'gpt';
    if (lower.includes('grok')) return 'grok';
    if (lower.includes('claude')) return 'claude';
    if (lower.includes('llama')) return 'llama';
    if (lower.includes('mistral') || lower.includes('mixtral')) return 'mistral';
    if (lower.includes('deepseek')) return 'deepseek';
    if (lower.includes('qwen')) return 'qwen';
    return 'other';
  }
}
