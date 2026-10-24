// MIC-AI: Multi-Provider AI Common Interfaces and Task Types

export type AITask = 'chat' | 'slide-explain' | 'handwriting-ocr' | 'text-fix' | 'quick-answer' | 'shape-classify';

export type AICapability = 'text' | 'vision' | 'streaming';

export type QualityPreference = 'best' | 'balanced' | 'fast';

export interface ModelInfo {
  id: string;
  provider: string;
  name?: string;
  family?: string;
  contextWindow?: number;
  supportsVision: boolean;
  supportsText: boolean;
  deprecated?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatPayload {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  onStreamChunk?: (chunk: string) => void;
}

export interface VisionPayload {
  image: string; // base64 string or data URL
  prompt: string;
  mimeType?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface AIProvider {
  readonly id: string;
  readonly name: string;
  validateKey(apiKey: string): Promise<boolean>;
  listModels(apiKey: string): Promise<ModelInfo[]>;
  chat(apiKey: string, payload: ChatPayload): Promise<string>;
  vision(apiKey: string, payload: VisionPayload): Promise<string>;
  probeCapability?(apiKey: string, model: string): Promise<{ supportsVision: boolean }>;
}
