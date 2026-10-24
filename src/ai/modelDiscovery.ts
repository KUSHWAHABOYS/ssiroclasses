// MIC-AI: Model Discovery, 24-hour Caching, and Capability Probing
import { ModelInfo } from './providers/types';
import { PROVIDERS_REGISTRY } from './providers/registry';

const CACHE_KEY = 'smart_studio_cached_models';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CachedStore {
  [providerId: string]: {
    timestamp: number;
    models: ModelInfo[];
  };
}

function getCache(): CachedStore {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(store: CachedStore): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Failed to save model discovery cache:', e);
  }
}

/**
 * Discovers and returns available models for a provider, using 24h cache when available.
 */
export async function discoverModels(
  providerId: string,
  apiKey: string,
  forceRefresh = false
): Promise<ModelInfo[]> {
  const meta = PROVIDERS_REGISTRY[providerId];
  if (!meta) {
    throw new Error(`अज्ञात प्रदाता (Unknown provider: ${providerId})`);
  }

  const cache = getCache();
  const entry = cache[providerId];

  if (!forceRefresh && entry && Array.isArray(entry.models) && entry.models.length > 0) {
    const age = Date.now() - entry.timestamp;
    if (age < CACHE_TTL_MS) {
      return entry.models;
    }
  }

  // Fetch fresh model list from adapter
  const models = await meta.adapter.listModels(apiKey);

  // Store in cache
  cache[providerId] = {
    timestamp: Date.now(),
    models
  };
  saveCache(cache);

  return models;
}

/**
 * Returns cached models synchronously if available, otherwise null.
 */
export function getCachedModels(providerId: string): ModelInfo[] | null {
  const cache = getCache();
  const entry = cache[providerId];
  if (entry && Array.isArray(entry.models) && entry.models.length > 0) {
    return entry.models;
  }
  return null;
}

/**
 * Clears discovery cache for one or all providers.
 */
export function clearModelCache(providerId?: string): void {
  if (!providerId) {
    localStorage.removeItem(CACHE_KEY);
    return;
  }
  const cache = getCache();
  delete cache[providerId];
  saveCache(cache);
}
