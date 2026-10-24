// ECON: Optional Chrome Built-in AI Provider (Part C5: on-device, free, Desktop Chrome only)
import { AIProvider, ChatPayload, ModelInfo, VisionPayload } from './types';

export class ChromeBuiltInProvider implements AIProvider {
  readonly id = 'chrome_ai';
  readonly name = 'Chrome built-in AI (on-device, free)';

  private session: any = null;

  async isSupported(): Promise<boolean> {
    try {
      const ai = (window as any).ai || (self as any).ai;
      if (!ai?.languageModel) return false;
      const caps = await ai.languageModel.capabilities();
      return caps?.available === 'readily' || caps?.available === 'after-download';
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<{ available: boolean; statusText: string }> {
    try {
      const ai = (window as any).ai || (self as any).ai;
      if (!ai?.languageModel) {
        return { available: false, statusText: 'इस ब्राउज़र में उपलब्ध नहीं (Requires Desktop Chrome with Prompt API)' };
      }
      const caps = await ai.languageModel.capabilities();
      if (caps?.available === 'readily') {
        return { available: true, statusText: 'उपलब्ध (Ready on device)' };
      }
      if (caps?.available === 'after-download') {
        return { available: true, statusText: 'डाउनलोड की आवश्यकता (Download needed)' };
      }
      return { available: false, statusText: 'उपलब्ध नहीं (Not available)' };
    } catch (e: any) {
      return { available: false, statusText: `जांच में त्रुटि: ${e?.message || 'Error'}` };
    }
  }

  async validateKey(_apiKey: string): Promise<boolean> {
    return this.isSupported();
  }

  async listModels(_apiKey: string): Promise<ModelInfo[]> {
    const supported = await this.isSupported();
    if (!supported) return [];
    return [
      {
        id: 'gemini-nano',
        provider: this.id,
        name: 'Gemini Nano (Chrome on-device)',
        family: 'nano',
        contextWindow: 4096,
        supportsVision: false,
        supportsText: true
      }
    ];
  }

  async chat(_apiKey: string, payload: ChatPayload): Promise<string> {
    const ai = (window as any).ai || (self as any).ai;
    if (!ai?.languageModel) {
      throw new Error('Chrome Built-in AI is not available in this environment');
    }

    if (!this.session) {
      this.session = await ai.languageModel.create();
    }

    const lastMsg = payload.messages[payload.messages.length - 1]?.content || '';
    const result = await this.session.prompt(lastMsg);
    if (!result) {
      throw new Error('Chrome Built-in AI returned empty response');
    }

    if (payload.onStreamChunk) {
      payload.onStreamChunk(result);
    }

    return result;
  }

  async vision(_apiKey: string, _payload: VisionPayload): Promise<string> {
    throw new Error('Chrome Built-in AI does not currently support vision tasks on-device');
  }

  async isAvailable(): Promise<boolean> {
    return this.isSupported();
  }

  async testPrompt(): Promise<{ success: boolean; message: string }> {
    const supported = await this.isSupported();
    if (!supported) {
      return {
        success: false,
        message: 'Chrome built-in AI इस ब्राउज़र में उपलब्ध नहीं है (Not supported in this browser).'
      };
    }
    try {
      const res = await this.chat('', {
        messages: [{ role: 'user', content: 'Say "SSIRO Chrome on-device AI active" in 5 words.' }]
      });
      return { success: true, message: res };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Execution error' };
    }
  }
}

export const chromeBuiltInProvider = new ChromeBuiltInProvider();
