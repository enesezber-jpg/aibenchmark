export type EndpointType =
  | '/models'
  | '/chat/completions'
  | '/completions'
  | '/images/generations'
  | '/audio/transcriptions'
  | '/embeddings'
  | '/audio/speech'
  | '/messages'
  | '/score'
  | '/rerank';

export interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  baseUrl?: string; // Optional custom base URL for this specific key
  isEnabled: boolean;
  successCount?: number;
  failCount?: number;
  lastStatus?: 'idle' | 'success' | 'error' | 'rate_limited';
  lastError?: string;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
  apiKeysPool: ApiKeyItem[];
  enableFailover: boolean;
  failoverMaxRetries: number;
  useProxy: boolean;
  customHeaders: Record<string, string>;
  selectedProvider: string;
}

export interface ModelItem {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
  permission?: any[];
  root?: string;
  parent?: string | null;
  detectedType?: 'chat' | 'embedding' | 'audio' | 'image' | 'rerank' | 'general';
}

export interface BenchmarkRecord {
  id: string;
  timestamp: number;
  modelId: string;
  endpoint: EndpointType;
  status: 'success' | 'error';
  httpStatus?: number;
  latencyMs: number;
  ttftMs?: number; // Time to first token
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
  requestPayload: any;
  responsePayload: any;
  errorMessage?: string;
  outputPreview?: string;
  audioDataUrl?: string;
  images?: string[];
  embeddingsDim?: number;
  rerankResults?: Array<{ index: number; relevance_score: number; document?: string }>;
  successfulKeyName?: string;
  failoverOccurred?: boolean;
  attemptedKeys?: Array<{
    keyName: string;
    status: 'success' | 'failed';
    httpStatus?: number;
    error?: string;
    latencyMs?: number;
  }>;
}

export interface PresetProvider {
  name: string;
  id: string;
  defaultBaseUrl: string;
  placeholderKey: string;
  description: string;
  supportsStreaming: boolean;
}
