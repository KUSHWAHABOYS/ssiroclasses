// MIC-AI: Task Profiles, Provider Tier Rankings, and Best Model Selection Engine
// ECON: Economy Model Preference, Quota Cooldown Awareness, and Upgrades
import { AITask, ModelInfo, QualityPreference } from './providers/types';
import { quotaManager } from './quotaManager';

export type ModelTier = 'flagship' | 'balanced' | 'fast' | 'economy';

export interface TaskProfile {
  task: AITask;
  requiresVision: boolean;
  defaultTemperature: number;
  defaultMaxTokens: number;
  tierForQuality: Record<QualityPreference, ModelTier>;
}

export const TASK_PROFILES: Record<AITask, TaskProfile> = {
  chat: {
    task: 'chat',
    requiresVision: false,
    defaultTemperature: 0.7,
    defaultMaxTokens: 600, // ECON: default concise answers
    tierForQuality: {
      economy: 'economy',
      best: 'flagship',
      balanced: 'balanced',
      fast: 'fast'
    }
  },
  'slide-explain': {
    task: 'slide-explain',
    requiresVision: true,
    defaultTemperature: 0.3,
    defaultMaxTokens: 800,
    tierForQuality: {
      economy: 'economy',
      best: 'flagship',
      balanced: 'balanced',
      fast: 'fast'
    }
  },
  'handwriting-ocr': {
    task: 'handwriting-ocr',
    requiresVision: true,
    defaultTemperature: 0.0,
    defaultMaxTokens: 80, // ECON: tiny maxOutputTokens for handwriting
    tierForQuality: {
      economy: 'economy',
      best: 'balanced',
      balanced: 'fast',
      fast: 'fast'
    }
  },
  'text-fix': {
    task: 'text-fix',
    requiresVision: false,
    defaultTemperature: 0.0,
    defaultMaxTokens: 120,
    tierForQuality: {
      economy: 'economy',
      best: 'balanced',
      balanced: 'fast',
      fast: 'fast'
    }
  },
  'quick-answer': {
    task: 'quick-answer',
    requiresVision: false,
    defaultTemperature: 0.3,
    defaultMaxTokens: 250,
    tierForQuality: {
      economy: 'economy',
      best: 'balanced',
      balanced: 'fast',
      fast: 'fast'
    }
  },
  // INKFIX: Shape classification task profile
  'shape-classify': {
    task: 'shape-classify',
    requiresVision: true,
    defaultTemperature: 0.0,
    defaultMaxTokens: 40,
    tierForQuality: {
      economy: 'economy',
      best: 'fast',
      balanced: 'fast',
      fast: 'fast'
    }
  }
};

export const PROVIDER_TIER_RANKINGS: Record<string, Partial<Record<ModelTier, string[]>>> = {
  gemini: {
    // ECON: Economy tier prefers Flash-Lite, then Flash-8b, then standard Flash (highest free quota & lowest cost)
    economy: [
      'gemini-2.0-flash-lite',
      'gemini-2.0-flash-lite-preview',
      'gemini-1.5-flash-8b',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ],
    flagship: [
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest'
    ],
    balanced: [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-2.0-flash-lite'
    ],
    fast: [
      'gemini-2.0-flash-lite',
      'gemini-1.5-flash-8b',
      'gemini-1.5-flash'
    ]
  },
  openai: {
    flagship: [
      'gpt-4o',
      'chatgpt-4o-latest',
      'gpt-4-turbo'
    ],
    balanced: [
      'gpt-4o-mini'
    ],
    fast: [
      'gpt-4o-mini'
    ]
  },
  anthropic: {
    flagship: [
      'claude-3-5-sonnet-20241022',
      'claude-3-7-sonnet',
      'claude-3-5-sonnet-latest',
      'claude-3-opus-20240229'
    ],
    balanced: [
      'claude-3-5-haiku-20241022',
      'claude-3-5-haiku-latest'
    ],
    fast: [
      'claude-3-5-haiku-20241022',
      'claude-3-haiku-20240307'
    ]
  },
  grok: {
    flagship: [
      'grok-2-latest',
      'grok-2-vision-latest',
      'grok-2'
    ],
    balanced: [
      'grok-2-latest',
      'grok-beta'
    ],
    fast: [
      'grok-beta'
    ]
  },
  groq: {
    flagship: [
      'llama-3.3-70b-versatile',
      'llama3-70b-8192'
    ],
    balanced: [
      'llama-3.1-8b-instant',
      'llama-3.2-11b-vision-preview'
    ],
    fast: [
      'llama-3.1-8b-instant'
    ]
  },
  mistral: {
    flagship: [
      'pixtral-large-latest',
      'mistral-large-latest'
    ],
    balanced: [
      'pixtral-12b-2409',
      'mistral-small-latest'
    ],
    fast: [
      'mistral-small-latest',
      'open-mistral-7b'
    ]
  },
  deepseek: {
    flagship: [
      'deepseek-reasoner',
      'deepseek-chat'
    ],
    balanced: [
      'deepseek-chat'
    ],
    fast: [
      'deepseek-chat'
    ]
  },
  openrouter: {
    flagship: [
      'anthropic/claude-3.5-sonnet',
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o'
    ],
    balanced: [
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o-mini'
    ],
    fast: [
      'meta-llama/llama-3.1-8b-instruct',
      'openai/gpt-4o-mini'
    ]
  },
  perplexity: {
    flagship: [
      'sonar-pro',
      'sonar-reasoning'
    ],
    balanced: [
      'sonar'
    ],
    fast: [
      'sonar'
    ]
  }
};

/**
 * Normalizes model ID for comparison
 */
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/^(models\/)/, '');
}

/**
 * Selects the optimal model from available models matching the task requirements and quality preference.
 */
export function pickBestModel(
  availableModels: ModelInfo[],
  providerId: string,
  task: AITask,
  preference: QualityPreference = 'balanced'
): ModelInfo | null {
  const profile = TASK_PROFILES[task] || TASK_PROFILES.chat;

  // Filter 1: Capability match
  let candidates = availableModels.filter((m) => {
    if (m.deprecated) return false;
    const hasVision = m.supportsVision ?? (m as any).supportedTasks?.includes('vision') ?? true;
    const hasText = m.supportsText ?? (m as any).supportedTasks?.includes('chat') ?? true;
    if (profile.requiresVision && !hasVision) return false;
    if (!profile.requiresVision && !hasText) return false;
    return true;
  });

  // If all non-deprecated candidates failed, check if deprecated ones exist
  if (candidates.length === 0) {
    candidates = availableModels.filter((m) => {
      const hasVision = m.supportsVision ?? (m as any).supportedTasks?.includes('vision') ?? true;
      const hasText = m.supportsText ?? (m as any).supportedTasks?.includes('chat') ?? true;
      if (profile.requiresVision && !hasVision) return false;
      if (!profile.requiresVision && !hasText) return false;
      return true;
    });
  }

  if (candidates.length === 0) {
    return null; // No model supports the required capabilities
  }

  const targetTier = profile.tierForQuality[preference] || 'balanced';
  const tierRankings = PROVIDER_TIER_RANKINGS[providerId];

  if (!tierRankings) {
    // Custom or unknown provider: pick first matching candidate
    return candidates[0];
  }

  // Tier search order based on target
  let tierOrder: ModelTier[] = ['economy', 'fast', 'balanced', 'flagship'];
  if (targetTier === 'economy') {
    tierOrder = ['economy', 'fast', 'balanced', 'flagship'];
  } else if (targetTier === 'fast') {
    tierOrder = ['fast', 'economy', 'balanced', 'flagship'];
  } else if (targetTier === 'balanced') {
    tierOrder = ['balanced', 'flagship', 'economy', 'fast'];
  } else if (targetTier === 'flagship') {
    tierOrder = ['flagship', 'balanced', 'economy', 'fast'];
  }

  // ECON: Prefer models not currently in cooldown
  const nonCooldownCandidates = candidates.filter((m) => quotaManager.isModelAvailable(providerId, m.id));
  const activeCandidates = nonCooldownCandidates.length > 0 ? nonCooldownCandidates : candidates;

  // Look for ranked pattern matches in tier order
  for (const tier of tierOrder) {
    const patterns = tierRankings[tier] || [];
    for (const pat of patterns) {
      const patNorm = pat.toLowerCase();
      const matched = activeCandidates.find((m) => {
        const idNorm = normalizeId(m.id);
        return idNorm === patNorm || idNorm.includes(patNorm);
      });
      if (matched) {
        return matched;
      }
    }
  }

  // Fallback to first capable candidate
  return activeCandidates[0];
}

/**
 * ECON: Returns the next stronger model for the "बेहतर जवाब / Better answer" button (Part C1.4)
 */
export function getNextStrongerModel(
  availableModels: ModelInfo[],
  currentModelId: string,
  providerId = 'gemini'
): ModelInfo | null {
  const normCurrent = normalizeId(currentModelId);
  const tierRankings = PROVIDER_TIER_RANKINGS[providerId];
  if (!tierRankings) return null;

  // Progression: economy -> balanced -> flagship
  let upgradeOrder: string[] = [];
  if (normCurrent.includes('lite') || normCurrent.includes('8b')) {
    upgradeOrder = [
      ...(tierRankings.balanced || []),
      ...(tierRankings.flagship || [])
    ];
  } else {
    upgradeOrder = [
      ...(tierRankings.flagship || [])
    ];
  }

  for (const modelName of upgradeOrder) {
    const norm = normalizeId(modelName);
    if (norm !== normCurrent) {
      const found = availableModels.find((m) => {
        const idNorm = normalizeId(m.id);
        return idNorm === norm && quotaManager.isModelAvailable(providerId, m.id);
      });
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * ECON: Filters and ranks capable non-deprecated models for a task
 */
export function rankModels(
  availableModels: ModelInfo[],
  providerId: string,
  task: AITask = 'chat',
  _preference: QualityPreference = 'economy'
): ModelInfo[] {
  const profile = TASK_PROFILES[task] || TASK_PROFILES.chat;
  return availableModels.filter((m) => {
    if (m.deprecated || m.id.toLowerCase().includes('deprecated') || m.name?.toLowerCase().includes('deprecated')) return false;
    const hasVision = m.supportsVision ?? (m as any).supportedTasks?.includes('vision') ?? true;
    const hasText = m.supportsText ?? (m as any).supportedTasks?.includes('chat') ?? true;
    if (profile.requiresVision && !hasVision) return false;
    if (!profile.requiresVision && !hasText) return false;
    return true;
  });
}

// ECON: Grouped export for modelCatalog
export const modelCatalog = {
  pickBestModel: (
    providerOrModels: any,
    modelsOrProvider: any,
    taskOrPref: any,
    prefOrTask?: any
  ): any => {
    if (Array.isArray(providerOrModels)) {
      const res = pickBestModel(providerOrModels, modelsOrProvider, taskOrPref, prefOrTask);
      return res;
    } else {
      const res = pickBestModel(modelsOrProvider, providerOrModels, prefOrTask || 'chat', taskOrPref || 'economy');
      return res ? res.id : null;
    }
  },
  rankModels: (
    providerOrModels: any,
    modelsOrProvider: any,
    taskOrPref?: any,
    prefOrTask?: any
  ): any => {
    if (Array.isArray(providerOrModels)) {
      return rankModels(providerOrModels, modelsOrProvider, taskOrPref, prefOrTask);
    } else {
      return rankModels(modelsOrProvider, providerOrModels, prefOrTask || 'chat', taskOrPref || 'economy');
    }
  },
  getNextStrongerModel: (
    modelsOrProvider: any,
    currentOrModels: any,
    maybeProvider?: string
  ): any => {
    if (Array.isArray(modelsOrProvider)) {
      return getNextStrongerModel(modelsOrProvider, currentOrModels, maybeProvider);
    } else {
      const defaultGeminiModels = [
        { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', supportsText: true, supportsVision: true },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', supportsText: true, supportsVision: true },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', supportsText: true, supportsVision: true },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', supportsText: true, supportsVision: true },
        { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', supportsText: true, supportsVision: true }
      ] as ModelInfo[];
      const res = getNextStrongerModel(defaultGeminiModels, currentOrModels, modelsOrProvider);
      return res ? res.id : null;
    }
  },
  TASK_PROFILES,
  PROVIDER_TIER_RANKINGS
};

