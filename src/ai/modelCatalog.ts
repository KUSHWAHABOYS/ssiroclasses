// MIC-AI: Task Profiles, Provider Tier Rankings, and Best Model Selection Engine
import { AITask, ModelInfo, QualityPreference } from './providers/types';

export type ModelTier = 'flagship' | 'balanced' | 'fast';

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
    defaultMaxTokens: 2048,
    tierForQuality: {
      best: 'flagship',
      balanced: 'flagship',
      fast: 'balanced'
    }
  },
  'slide-explain': {
    task: 'slide-explain',
    requiresVision: true,
    defaultTemperature: 0.4,
    defaultMaxTokens: 1500,
    tierForQuality: {
      best: 'flagship',
      balanced: 'flagship',
      fast: 'balanced'
    }
  },
  'handwriting-ocr': {
    task: 'handwriting-ocr',
    requiresVision: true,
    defaultTemperature: 0.0,
    defaultMaxTokens: 100,
    tierForQuality: {
      best: 'balanced',
      balanced: 'balanced', // Balanced/fast prioritized for low latency in frequent classroom ink actions
      fast: 'fast'
    }
  },
  'text-fix': {
    task: 'text-fix',
    requiresVision: false,
    defaultTemperature: 0.1,
    defaultMaxTokens: 500,
    tierForQuality: {
      best: 'balanced',
      balanced: 'fast',
      fast: 'fast'
    }
  },
  'quick-answer': {
    task: 'quick-answer',
    requiresVision: false,
    defaultTemperature: 0.3,
    defaultMaxTokens: 300,
    tierForQuality: {
      best: 'balanced',
      balanced: 'fast',
      fast: 'fast'
    }
  }
};

export const PROVIDER_TIER_RANKINGS: Record<string, Record<ModelTier, string[]>> = {
  gemini: {
    flagship: [
      'gemini-2.0-flash',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro',
      'gemini-1.5-pro-latest',
      'gemini-exp-1206'
    ],
    balanced: [
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest'
    ],
    fast: [
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
    if (profile.requiresVision && !m.supportsVision) return false;
    if (!profile.requiresVision && !m.supportsText) return false;
    return true;
  });

  // If all non-deprecated candidates failed, check if deprecated ones exist
  if (candidates.length === 0) {
    candidates = availableModels.filter((m) => {
      if (profile.requiresVision && !m.supportsVision) return false;
      if (!profile.requiresVision && !m.supportsText) return false;
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
  let tierOrder: ModelTier[] = ['flagship', 'balanced', 'fast'];
  if (targetTier === 'fast') {
    tierOrder = ['fast', 'balanced', 'flagship'];
  } else if (targetTier === 'balanced') {
    tierOrder = ['balanced', 'flagship', 'fast'];
  }

  // Look for ranked pattern matches in tier order
  for (const tier of tierOrder) {
    const patterns = tierRankings[tier] || [];
    for (const pat of patterns) {
      const patNorm = pat.toLowerCase();
      const matched = candidates.find((m) => {
        const idNorm = normalizeId(m.id);
        return idNorm === patNorm || idNorm.includes(patNorm);
      });
      if (matched) {
        return matched;
      }
    }
  }

  // Fallback to first capable candidate
  return candidates[0];
}
