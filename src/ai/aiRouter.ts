// MIC-AI: Central Multi-Provider AI Router with Automatic Best-Model Selection, Fallbacks, and Abort Control
import { store } from '../state/store';
import { keyVault } from './keyVault';
import { AITask, ChatPayload, VisionPayload, QualityPreference, ModelInfo } from './providers/types';
import { PROVIDERS_REGISTRY } from './providers/registry';
import { discoverModels } from './modelDiscovery';
import { pickBestModel, TASK_PROFILES } from './modelCatalog';

export interface AIRunOptions {
  provider?: string;
  model?: string;
  quality?: QualityPreference;
  signal?: AbortSignal;
}

export interface AIRunResult {
  text: string;
  provider: string;
  providerId: string;
  model: string;
}

export class AIRouter {
  private activeAbortController: AbortController | null = null;
  private sessionCallCount: number = 0;
  private warnedSessionLimit: boolean = false;

  constructor() {
    // MIC-AI: Cancel in-flight AI requests on slide change or when AI panel closes (C5)
    store.subscribe((state, prevState) => {
      if (state.currentPage !== prevState.currentPage) {
        this.cancelCurrent();
      }
      if (!state.isGeminiOpen && prevState.isGeminiOpen) {
        this.cancelCurrent();
      }
    });
  }

  /**
   * Immediately aborts any in-flight AI request
   */
  cancelCurrent(): void {
    if (this.activeAbortController) {
      try {
        this.activeAbortController.abort();
      } catch {}
      this.activeAbortController = null;
    }
  }

  getSessionCallCount(): number {
    return this.sessionCallCount;
  }

  resetSessionCallCount(): void {
    this.sessionCallCount = 0;
    this.warnedSessionLimit = false;
  }

  /**
   * Main router entry point: executes task using best suitable model or configured fallback chain.
   */
  async run(
    task: AITask,
    payload: ChatPayload | VisionPayload | string,
    options: AIRunOptions = {}
  ): Promise<AIRunResult> {
    const state = store.getState();
    const quality = options.quality || state.settings.aiQualityPreference || 'balanced';
    const profile = TASK_PROFILES[task] || TASK_PROFILES.chat;

    // Normalise payload
    const isVisionTask = profile.requiresVision || (typeof payload === 'object' && 'image' in payload);
    let chatPayload: ChatPayload;
    let visionPayload: VisionPayload;

    if (typeof payload === 'string') {
      chatPayload = {
        messages: [{ role: 'user', content: payload }],
        temperature: profile.defaultTemperature,
        maxTokens: profile.defaultMaxTokens
      };
      visionPayload = {
        image: '',
        prompt: payload,
        temperature: profile.defaultTemperature,
        maxTokens: profile.defaultMaxTokens
      };
    } else if ('image' in payload) {
      visionPayload = {
        ...payload,
        temperature: payload.temperature ?? profile.defaultTemperature,
        maxTokens: payload.maxTokens ?? profile.defaultMaxTokens
      };
      chatPayload = {
        messages: [{ role: 'user', content: payload.prompt }],
        temperature: profile.defaultTemperature,
        maxTokens: profile.defaultMaxTokens
      };
    } else {
      chatPayload = {
        ...payload,
        temperature: payload.temperature ?? profile.defaultTemperature,
        maxTokens: payload.maxTokens ?? profile.defaultMaxTokens
      };
      visionPayload = {
        image: '',
        prompt: payload.messages[payload.messages.length - 1]?.content || '',
        temperature: profile.defaultTemperature,
        maxTokens: profile.defaultMaxTokens
      };
    }

    const configured = keyVault.getAllConfiguredProviders();
    if (configured.length === 0) {
      throw new Error(
        'कोई AI प्रदाता कॉन्फ़िगर नहीं है (No AI API key found. Please add a key in Settings → AI).'
      );
    }

    // Determine provider candidate order
    const prioritySetting = state.settings.aiProviderPriority || [];
    let candidates = prioritySetting.filter((p) => configured.includes(p));
    for (const c of configured) {
      if (!candidates.includes(c)) {
        candidates.push(c);
      }
    }

    // Pinned model or user option priority
    const pinned = state.settings.aiTaskPinnedModels?.[task];
    if (options.provider && candidates.includes(options.provider)) {
      candidates = [options.provider, ...candidates.filter((p) => p !== options.provider)];
    } else if (pinned?.provider && candidates.includes(pinned.provider)) {
      candidates = [pinned.provider, ...candidates.filter((p) => p !== pinned.provider)];
    }

    if (candidates.length === 0) {
      throw new Error('कोई सक्रिय AI प्रदाता उपलब्ध नहीं है (No active AI provider available).');
    }

    // Abort controller setup
    const controller = new AbortController();
    this.activeAbortController = controller;
    if (options.signal) {
      options.signal.addEventListener('abort', () => controller.abort());
    }

    let attempts = 0;
    let lastError: any = null;
    let hadVisionCapableProvider = false;

    for (const pId of candidates) {
      if (controller.signal.aborted) {
        throw new Error('अनुरोध रद्द कर दिया गया (Request aborted)');
      }

      const meta = PROVIDERS_REGISTRY[pId];
      if (!meta) continue;

      const apiKey = await keyVault.getKey(pId);
      if (!apiKey) continue;

      try {
        // Step 1: Discover models
        let models: ModelInfo[] = [];
        try {
          models = await discoverModels(pId, apiKey);
        } catch (discErr) {
          console.warn(`Model discovery failed for ${pId}:`, discErr);
          // If models discovery failed, we can still attempt with default model
          models = [];
        }

        // Step 2: Pick model
        let chosenModel: ModelInfo | null = null;

        if (options.model) {
          chosenModel = models.find((m) => m.id === options.model) || {
            id: options.model,
            provider: pId,
            supportsVision: isVisionTask,
            supportsText: true
          };
        } else if (pinned?.provider === pId && pinned?.model) {
          chosenModel = models.find((m) => m.id === pinned.model) || {
            id: pinned.model,
            provider: pId,
            supportsVision: isVisionTask,
            supportsText: true
          };
        } else if (models.length > 0) {
          chosenModel = pickBestModel(models, pId, task, quality);
        }

        // If no model from catalog, use adapter default
        if (!chosenModel) {
          const defModel = (meta.adapter as any).config?.defaultVisionModel || (meta.adapter as any).config?.defaultModel || 'default';
          chosenModel = {
            id: defModel,
            provider: pId,
            supportsVision: true,
            supportsText: true
          };
        }

        // Check vision capability requirement
        if (isVisionTask) {
          const supportsVision = chosenModel.supportsVision;
          if (!supportsVision) {
            // Skip this provider because it does not support vision
            continue;
          }
          hadVisionCapableProvider = true;
        }

        // Step 3: Execute request
        let textResult = '';
        if (isVisionTask) {
          textResult = await meta.adapter.vision(apiKey, {
            ...visionPayload,
            model: chosenModel.id,
            signal: controller.signal
          });
        } else {
          textResult = await meta.adapter.chat(apiKey, {
            ...chatPayload,
            model: chosenModel.id,
            signal: controller.signal
          });
        }

        // Step 4: Success handling
        this.sessionCallCount++;
        const warnThreshold = state.settings.aiWarnAfterCalls || 0;
        if (warnThreshold > 0 && this.sessionCallCount >= warnThreshold && !this.warnedSessionLimit) {
          this.warnedSessionLimit = true;
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: {
                message: `⚠️ AI कॉल चेतावनी: सत्र में ${this.sessionCallCount} कॉल पूरे हुए (Call limit threshold reached: ${this.sessionCallCount})`
              }
            })
          );
        }

        // Notify if fallback was used
        if (attempts > 0) {
          window.dispatchEvent(
            new CustomEvent('app-toast', {
              detail: {
                message: `⚡ AI फ़ॉलबैक: ${meta.name} (${chosenModel.id})`
              }
            })
          );
        }

        this.activeAbortController = null;
        return {
          text: textResult,
          provider: meta.name,
          providerId: pId,
          model: chosenModel.id
        };
      } catch (err: any) {
        if (controller.signal.aborted) {
          throw new Error('अनुरोध रद्द कर दिया गया (Request aborted)');
        }
        attempts++;
        lastError = err;
        console.warn(`AI Router: Provider ${pId} attempt failed:`, err);
      }
    }

    this.activeAbortController = null;

    if (isVisionTask && !hadVisionCapableProvider) {
      throw new Error(
        'कोई विज़न-सक्षम AI प्रदाता उपलब्ध नहीं है (No vision-capable AI provider configured. Please configure Gemini, Claude, OpenAI, or Grok in Settings → AI).'
      );
    }

    throw new Error(
      lastError?.message || 'सभी AI प्रदाता विफल रहे (All AI providers in fallback chain failed).'
    );
  }
}

export const aiRouter = new AIRouter();
