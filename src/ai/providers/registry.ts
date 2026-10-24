// MIC-AI: Central Provider Registry & Auto-Detection Engine
import { AIProvider } from './types';
import { geminiProvider } from './gemini';
import { anthropicProvider } from './anthropic';
import { OpenAICompatProvider } from './openaiCompat';

export interface ProviderMetadata {
  id: string;
  name: string;
  baseUrl: string;
  expectedHost: string;
  keyPrefixes: string[];
  keyHint: string;
  allowsBrowserCors: boolean;
  docUrl: string;
  adapter: AIProvider;
}

// Built-in OpenAI-compatible adapters
const openaiProvider = new OpenAICompatProvider({
  id: 'openai',
  name: 'OpenAI',
  baseUrl: 'https://api.openai.com/v1',
  expectedHost: 'api.openai.com',
  defaultModel: 'gpt-4o',
  defaultVisionModel: 'gpt-4o'
});

const grokProvider = new OpenAICompatProvider({
  id: 'grok',
  name: 'xAI Grok',
  baseUrl: 'https://api.x.ai/v1',
  expectedHost: 'api.x.ai',
  defaultModel: 'grok-2-latest',
  defaultVisionModel: 'grok-2-vision-latest'
});

const groqProvider = new OpenAICompatProvider({
  id: 'groq',
  name: 'Groq',
  baseUrl: 'https://api.groq.com/openai/v1',
  expectedHost: 'api.groq.com',
  defaultModel: 'llama-3.3-70b-versatile',
  defaultVisionModel: 'llama-3.2-11b-vision-preview'
});

const mistralProvider = new OpenAICompatProvider({
  id: 'mistral',
  name: 'Mistral AI',
  baseUrl: 'https://api.mistral.ai/v1',
  expectedHost: 'api.mistral.ai',
  defaultModel: 'mistral-large-latest',
  defaultVisionModel: 'pixtral-12b-2409'
});

const deepseekProvider = new OpenAICompatProvider({
  id: 'deepseek',
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  expectedHost: 'api.deepseek.com',
  defaultModel: 'deepseek-chat'
});

const openrouterProvider = new OpenAICompatProvider({
  id: 'openrouter',
  name: 'OpenRouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  expectedHost: 'openrouter.ai',
  defaultModel: 'google/gemini-2.0-flash-001',
  defaultVisionModel: 'google/gemini-2.0-flash-001',
  extraHeaders: {
    'HTTP-Referer': 'https://decodingindology.com',
    'X-Title': 'Smart Studio Presenter Pro'
  }
});

const perplexityProvider = new OpenAICompatProvider({
  id: 'perplexity',
  name: 'Perplexity',
  baseUrl: 'https://api.perplexity.ai',
  expectedHost: 'api.perplexity.ai',
  defaultModel: 'sonar-pro'
});

export const PROVIDERS_REGISTRY: Record<string, ProviderMetadata> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    expectedHost: 'generativelanguage.googleapis.com',
    keyPrefixes: ['AIza'],
    keyHint: 'AIzaSy...',
    allowsBrowserCors: true,
    docUrl: 'https://aistudio.google.com/app/apikey',
    adapter: geminiProvider
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    expectedHost: 'api.anthropic.com',
    keyPrefixes: ['sk-ant-'],
    keyHint: 'sk-ant-api...',
    allowsBrowserCors: true, // With anthropic-dangerous-direct-browser-access: true
    docUrl: 'https://console.anthropic.com/settings/keys',
    adapter: anthropicProvider
  },
  grok: {
    id: 'grok',
    name: 'xAI Grok',
    baseUrl: 'https://api.x.ai/v1',
    expectedHost: 'api.x.ai',
    keyPrefixes: ['xai-'],
    keyHint: 'xai-...',
    allowsBrowserCors: false,
    docUrl: 'https://console.x.ai/',
    adapter: grokProvider
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    expectedHost: 'api.groq.com',
    keyPrefixes: ['gsk_'],
    keyHint: 'gsk_...',
    allowsBrowserCors: false,
    docUrl: 'https://console.groq.com/keys',
    adapter: groqProvider
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    expectedHost: 'openrouter.ai',
    keyPrefixes: ['sk-or-'],
    keyHint: 'sk-or-v1-...',
    allowsBrowserCors: true,
    docUrl: 'https://openrouter.ai/keys',
    adapter: openrouterProvider
  },
  perplexity: {
    id: 'perplexity',
    name: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    expectedHost: 'api.perplexity.ai',
    keyPrefixes: ['pplx-'],
    keyHint: 'pplx-...',
    allowsBrowserCors: false,
    docUrl: 'https://www.perplexity.ai/settings/api',
    adapter: perplexityProvider
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    expectedHost: 'api.openai.com',
    keyPrefixes: ['sk-proj-', 'sk-admin-'],
    keyHint: 'sk-proj-...',
    allowsBrowserCors: false,
    docUrl: 'https://platform.openai.com/api-keys',
    adapter: openaiProvider
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    expectedHost: 'api.mistral.ai',
    keyPrefixes: [],
    keyHint: '32-character key',
    allowsBrowserCors: false,
    docUrl: 'https://console.mistral.ai/api-keys/',
    adapter: mistralProvider
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    expectedHost: 'api.deepseek.com',
    keyPrefixes: [],
    keyHint: 'sk-...',
    allowsBrowserCors: false,
    docUrl: 'https://platform.deepseek.com/api_keys',
    adapter: deepseekProvider
  }
};

/**
 * Creates or gets custom provider instance
 */
export function getCustomProvider(baseUrl: string, modelName = 'default'): AIProvider {
  let host = 'localhost';
  try {
    host = new URL(baseUrl).hostname;
  } catch {}

  return new OpenAICompatProvider({
    id: 'custom',
    name: 'Custom Endpoint',
    baseUrl,
    expectedHost: host,
    defaultModel: modelName,
    defaultVisionModel: modelName
  });
}

/**
 * Step 1: Detect provider from key shape
 */
export function detectProviderFromKeyShape(rawKey: string): string | null {
  const key = rawKey.trim();
  if (!key) return null;

  for (const [id, meta] of Object.entries(PROVIDERS_REGISTRY)) {
    for (const prefix of meta.keyPrefixes) {
      if (key.startsWith(prefix)) {
        return id;
      }
    }
  }

  return null;
}

/**
 * Step 2: Parallel candidate probe for ambiguous keys (e.g. plain 'sk-...' or hex keys)
 */
export async function probeCandidateProviders(rawKey: string): Promise<string | null> {
  const key = rawKey.trim();
  if (!key) return null;

  // Candidates for ambiguous keys
  const candidates: string[] = ['openai', 'deepseek', 'mistral', 'groq', 'perplexity'];

  // Test in parallel, first success wins
  const promises = candidates.map(async (pId) => {
    const meta = PROVIDERS_REGISTRY[pId];
    if (!meta) return null;
    try {
      const valid = await meta.adapter.validateKey(key);
      if (valid) return pId;
    } catch {}
    return null;
  });

  const results = await Promise.all(promises);
  return results.find((r) => r !== null) || null;
}
