// MIC-AI: Central Multi-Provider AI Router with Automatic Best-Model Selection, Fallbacks, and Abort Control
// ECON: Economy Model Preference, Quota Cooldown Awareness, Token Minimization, and Usage Tracking
import { store } from '../state/store';
import { keyVault } from './keyVault';
import { AITask, ChatPayload, VisionPayload, QualityPreference, ModelInfo } from './providers/types';
import { PROVIDERS_REGISTRY } from './providers/registry';
import { discoverModels } from './modelDiscovery';
import { pickBestModel, getNextStrongerModel, TASK_PROFILES } from './modelCatalog';
import { quotaManager, FriendlyErrorResult } from './quotaManager';
import { responseCache } from './responseCache';

export interface AIRunOptions {
  provider?: string;
  model?: string;
  quality?: QualityPreference;
  signal?: AbortSignal;
  betterAnswer?: boolean;
  slideTextContext?: string;
  skipCache?: boolean;
}

export interface AIRunResult {
  text: string;
  provider: string;
  providerId: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  cached?: boolean;
}

export interface AIUsageStats {
  callsSession: number;
  callsToday: number;
  promptTokensToday: number;
  completionTokensToday: number;
  totalTokensToday: number;
  currentModel: string;
  currentProvider: string;
  dateKey: string;
}

const USAGE_STORAGE_KEY = 'ssiro_ai_usage_stats_v1';

export class AIRouter {
  private activeAbortController: AbortController | null = null;
  private sessionCallCount: number = 0;
  private warnedSessionLimit: boolean = false;
  private inFlightRequests: Map<string, Promise<AIRunResult>> = new Map();
  private usageStats: AIUsageStats;

  constructor() {
    this.usageStats = this.loadUsageStats();

    // Cancel in-flight AI requests on slide change or when AI panel closes
    store.subscribe((state, prevState) => {
      if (state.currentPage !== prevState.currentPage) {
        this.cancelCurrent();
      }
      if (!state.isGeminiOpen && prevState.isGeminiOpen) {
        this.cancelCurrent();
      }
    });
  }

  private loadUsageStats(): AIUsageStats {
    const todayStr = new Date().toISOString().slice(0, 10);
    try {
      const raw = localStorage.getItem(USAGE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.dateKey === todayStr) {
          return {
            ...parsed,
            callsSession: 0
          };
        }
      }
    } catch {}

    return {
      callsSession: 0,
      callsToday: 0,
      promptTokensToday: 0,
      completionTokensToday: 0,
      totalTokensToday: 0,
      currentModel: 'gemini-2.0-flash-lite',
      currentProvider: 'Google Gemini',
      dateKey: todayStr
    };
  }

  private saveUsageStats(): void {
    try {
      localStorage.setItem(USAGE_STORAGE_KEY, JSON.stringify(this.usageStats));
    } catch {}
  }

  public getUsageStats(): AIUsageStats {
    return { ...this.usageStats };
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
    this.inFlightRequests.clear();
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
   * Includes duplicate request coalescing (Part C2.8) and 24h caching (Part C2.5).
   */
  async run(
    task: AITask,
    payload: ChatPayload | VisionPayload | string,
    options: AIRunOptions = {}
  ): Promise<AIRunResult> {
    // Generate request fingerprint for in-flight coalescing
    const requestKey = this.computeRequestKey(task, payload, options);
    const existing = this.inFlightRequests.get(requestKey);
    if (existing) {
      return existing;
    }

    const runPromise = this.executeRun(task, payload, options);
    this.inFlightRequests.set(requestKey, runPromise);

    try {
      const result = await runPromise;
      return result;
    } finally {
      this.inFlightRequests.delete(requestKey);
    }
  }

  private computeRequestKey(
    task: AITask,
    payload: ChatPayload | VisionPayload | string,
    options: AIRunOptions
  ): string {
    let contentKey = '';
    if (typeof payload === 'string') {
      contentKey = payload;
    } else if ('image' in payload) {
      contentKey = `${payload.prompt}_${payload.image.slice(0, 40)}`;
    } else {
      contentKey = payload.messages.map((m) => `${m.role}:${m.content}`).join('|');
    }
    return `${task}::${contentKey}::${options.betterAnswer ? 'better' : 'std'}`;
  }

  private async executeRun(
    task: AITask,
    payload: ChatPayload | VisionPayload | string,
    options: AIRunOptions = {}
  ): Promise<AIRunResult> {
    const state = store.getState();
    const quality = options.quality || state.settings.aiQualityPreference || 'economy';
    const profile = TASK_PROFILES[task] || TASK_PROFILES.chat;

    // ECON: Answer length mapping (Part C2.1)
    const lengthSetting = state.settings.aiAnswerLength || 'normal';
    let maxTokens = profile.defaultMaxTokens;
    if (task === 'chat' || task === 'slide-explain') {
      if (lengthSetting === 'short') {
        maxTokens = 300;
      } else if (lengthSetting === 'detailed') {
        maxTokens = 1500;
      } else {
        maxTokens = 600;
      }
    }

    // Normalise payload
    const isVisionTask = profile.requiresVision || (typeof payload === 'object' && 'image' in payload);
    let chatPayload: ChatPayload;
    let visionPayload: VisionPayload;

    const thinkingBudget = options.betterAnswer ? 512 : 0;

    if (typeof payload === 'string') {
      chatPayload = {
        messages: [{ role: 'user', content: payload }],
        temperature: profile.defaultTemperature,
        maxTokens,
        thinkingBudget
      };
      visionPayload = {
        image: '',
        prompt: payload,
        temperature: profile.defaultTemperature,
        maxTokens,
        thinkingBudget
      };
    } else if ('image' in payload) {
      visionPayload = {
        ...payload,
        temperature: payload.temperature ?? profile.defaultTemperature,
        maxTokens: payload.maxTokens ?? maxTokens,
        thinkingBudget: payload.thinkingBudget ?? thinkingBudget
      };
      chatPayload = {
        messages: [{ role: 'user', content: payload.prompt }],
        temperature: profile.defaultTemperature,
        maxTokens,
        thinkingBudget
      };
    } else {
      chatPayload = {
        ...payload,
        temperature: payload.temperature ?? profile.defaultTemperature,
        maxTokens: payload.maxTokens ?? maxTokens,
        thinkingBudget: payload.thinkingBudget ?? thinkingBudget
      };
      visionPayload = {
        image: '',
        prompt: payload.messages[payload.messages.length - 1]?.content || '',
        temperature: profile.defaultTemperature,
        maxTokens,
        thinkingBudget
      };
    }

    // ECON: 24h response cache lookup for chat / quick questions (Part C2.5)
    if (!options.skipCache && !options.betterAnswer && task === 'chat') {
      const userQuestion = chatPayload.messages[chatPayload.messages.length - 1]?.content || '';
      const slideContext = options.slideTextContext || '';
      const cacheKey = await responseCache.computeKey(
        quality,
        slideContext,
        userQuestion,
        state.settings.language || 'hi',
        lengthSetting
      );

      const cached = await responseCache.get(cacheKey);
      if (cached) {
        return {
          text: cached.text,
          provider: cached.provider,
          providerId: 'cache',
          model: cached.model,
          cached: true
        };
      }
    }

    const configured = keyVault.getAllConfiguredProviders();
    if (configured.length === 0) {
      const friendly = quotaManager.formatFriendlyError({ code: 'invalid_key' });
      const err: any = new Error(friendly.friendlyHindi);
      err.friendly = friendly;
      throw err;
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
    let lastModelUsed = '';
    let hadVisionCapableProvider = false;

    // Outer provider loop
    for (const pId of candidates) {
      if (controller.signal.aborted) {
        throw new Error('अनुरोध रद्द कर दिया गया (Request aborted)');
      }

      const meta = PROVIDERS_REGISTRY[pId];
      if (!meta) continue;

      const apiKey = await keyVault.getKey(pId);
      if (!apiKey) continue;

      // Step 1: Discover models
      let models: ModelInfo[] = [];
      try {
        models = await discoverModels(pId, apiKey);
      } catch (discErr) {
        console.warn(`Model discovery failed for ${pId}:`, discErr);
        models = [];
      }

      // Step 2: Model candidate list for this provider
      let modelCandidates: ModelInfo[] = [];

      if (options.betterAnswer) {
        // Upgrade to next stronger model
        const currentModel = this.usageStats.currentModel;
        const upgrade = getNextStrongerModel(models, currentModel, pId);
        if (upgrade) {
          modelCandidates = [upgrade];
        }
      }

      if (modelCandidates.length === 0) {
        if (options.model) {
          const direct = models.find((m) => m.id === options.model) || {
            id: options.model,
            provider: pId,
            supportsVision: isVisionTask,
            supportsText: true
          };
          modelCandidates = [direct];
        } else if (pinned?.provider === pId && pinned?.model) {
          const directPinned = models.find((m) => m.id === pinned.model) || {
            id: pinned.model,
            provider: pId,
            supportsVision: isVisionTask,
            supportsText: true
          };
          modelCandidates = [directPinned];
        } else {
          // Pick best non-cooldown model
          const best = pickBestModel(models, pId, task, quality);
          if (best) {
            modelCandidates.push(best);
            // Also append remaining capable models as within-provider fallbacks
            for (const m of models) {
              if (m.id !== best.id && (isVisionTask ? m.supportsVision : m.supportsText)) {
                if (quotaManager.isModelAvailable(pId, m.id)) {
                  modelCandidates.push(m);
                }
              }
            }
          }
        }
      }

      if (modelCandidates.length === 0) {
        const defModel = (meta.adapter as any).config?.defaultVisionModel || (meta.adapter as any).config?.defaultModel || 'gemini-2.0-flash-lite';
        modelCandidates = [
          {
            id: defModel,
            provider: pId,
            supportsVision: true,
            supportsText: true
          }
        ];
      }

      // Inner model loop (Economy fallback within same provider on 429)
      for (const chosenModel of modelCandidates) {
        if (controller.signal.aborted) {
          throw new Error('अनुरोध रद्द कर दिया गया (Request aborted)');
        }

        // Check vision capability
        if (isVisionTask) {
          if (!chosenModel.supportsVision) continue;
          hadVisionCapableProvider = true;
        }

        lastModelUsed = chosenModel.id;

        try {
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

          // Success handling
          this.sessionCallCount++;
          this.usageStats.callsSession++;
          this.usageStats.callsToday++;
          this.usageStats.currentModel = chosenModel.id;
          this.usageStats.currentProvider = meta.name;

          // Extract token usage metadata if available
          let usage: any = undefined;
          if ((meta.adapter as any).lastUsage) {
            usage = (meta.adapter as any).lastUsage;
            this.usageStats.promptTokensToday += usage.promptTokens || 0;
            this.usageStats.completionTokensToday += usage.completionTokens || 0;
            this.usageStats.totalTokensToday += usage.totalTokens || 0;
          }
          this.saveUsageStats();

          // Store in response cache for chat
          if (!options.betterAnswer && task === 'chat') {
            const userQuestion = chatPayload.messages[chatPayload.messages.length - 1]?.content || '';
            const slideContext = options.slideTextContext || '';
            responseCache.computeKey(
              quality,
              slideContext,
              userQuestion,
              state.settings.language || 'hi',
              lengthSetting
            ).then((cacheKey) => {
              responseCache.set(cacheKey, {
                text: textResult,
                provider: meta.name,
                model: chosenModel.id
              });
            }).catch(() => {});
          }

          // Toast if fallback was used
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
            model: chosenModel.id,
            usage
          };
        } catch (err: any) {
          if (controller.signal.aborted) {
            throw new Error('अनुरोध रद्द कर दिया गया (Request aborted)');
          }

          attempts++;
          lastError = err;

          // Check if quota error (HTTP 429)
          const parsed = quotaManager.parseError(err);
          if (parsed.isQuota) {
            // Record cooldown
            const cooldown = quotaManager.recordQuotaError(pId, chosenModel.id, err);

            // If per-minute rate limit with short retry delay (<= 5s), attempt backoff once
            if (!parsed.isDaily && (cooldown.retryDelaySeconds || 0) <= 5 && attempts <= 1) {
              const backoffMs = Math.max(1000, (cooldown.retryDelaySeconds || 2) * 1000);
              await new Promise((res) => setTimeout(res, backoffMs));
              if (controller.signal.aborted) throw new Error('अनुरोध रद्द कर दिया गया (Request aborted)');
              continue; // Retry once
            }

            // Find next model in modelCandidates
            const nextCandidate = modelCandidates.find(
              (m) => m.id !== chosenModel.id && quotaManager.isModelAvailable(pId, m.id)
            );

            if (nextCandidate) {
              window.dispatchEvent(
                new CustomEvent('app-toast', {
                  detail: {
                    message: `⚡ कोटा ख़त्म — अब ${nextCandidate.id} पर चल रहा है`
                  }
                })
              );
              continue; // try next candidate within same provider
            }
          }

          console.warn(`AI Router: Model ${chosenModel.id} on ${pId} failed:`, err);
        }
      }
    }

    this.activeAbortController = null;

    if (isVisionTask && !hadVisionCapableProvider) {
      const friendly = quotaManager.formatFriendlyError(
        'कोई विज़न-सक्षम AI प्रदाता उपलब्ध नहीं है (No vision-capable AI provider configured).'
      );
      const err: any = new Error(friendly.friendlyHindi);
      err.friendly = friendly;
      throw err;
    }

    // Format friendly error card
    const friendly = quotaManager.formatFriendlyError(lastError, lastModelUsed);
    const finalErr: any = new Error(friendly.friendlyHindi);
    finalErr.friendly = friendly;
    finalErr.rawError = lastError;
    throw finalErr;
  }
}

export const aiRouter = new AIRouter();
