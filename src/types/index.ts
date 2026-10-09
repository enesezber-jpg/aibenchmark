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

export type BenchmarkCategory =
  | 'document_analysis'
  | 'coding'
  | 'reasoning'
  | 'speed'
  | 'json_instruction'
  | 'turkish_language';

export interface ApiKeyItem {
  id: string;
  name: string;
  key: string;
  baseUrl?: string;
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
  category?: BenchmarkCategory;
  categoryScore?: number; // 0 - 100
  status: 'success' | 'error';
  httpStatus?: number;
  latencyMs: number;
  ttftMs?: number;
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

export interface BenchmarkTestDefinition {
  id: string;
  name: string;
  category: BenchmarkCategory;
  categoryName: string;
  description: string;
  importance: 'Kritik (Ana Konu)' | 'Önemli' | 'Standart';
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  evaluationCriteria: string[];
  expectedKeywords?: string[];
  requiresJson?: boolean;
}

export interface ModelEvaluationProfile {
  modelId: string;
  overallScore: number;
  categoryScores: Record<BenchmarkCategory, number>;
  avgLatencyMs: number;
  avgTokensPerSec: number;
  topCapability: string;
  verdictTag: string; // e.g., 'Döküman Şampiyonu', 'Kodlama Lideri', 'Hız & Üretim Lideri'
  detailedAdvice: string;
  whereToUse: string;
  whereNotToUse: string;
  testCount: number;
}

export interface ModelGuideProfile {
  idPattern: string;
  displayName: string;
  provider: string;
  contextWindow: string;
  codingRating: number; // 1-5
  documentRating: number; // 1-5
  speedRating: number; // 1-5
  costTier: 'Ücretsiz / Yerel' | 'Düşük' | 'Orta' | 'Yüksek';
  bestFor: string;
  strengths: string[];
  weaknesses: string[];
  whereToUse: string;
  whereNotToUse: string;
  recommendedParams: {
    temperature: number;
    maxTokens: number;
    systemTip: string;
  };
}
