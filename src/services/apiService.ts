import type { ApiConfig, BenchmarkRecord, EndpointType, ModelItem } from '../types';

export interface ApiCandidate {
  id: string;
  name: string;
  key: string;
  baseUrl: string;
}

/**
 * Returns an ordered list of active API candidates from the pool
 */
export function getActiveCandidates(config: ApiConfig): ApiCandidate[] {
  const candidates: ApiCandidate[] = [];

  if (config.apiKeysPool && Array.isArray(config.apiKeysPool)) {
    const enabled = config.apiKeysPool.filter(
      (k) => k.isEnabled && (k.key.trim().length > 0 || (k.baseUrl && k.baseUrl.trim().length > 0))
    );

    enabled.forEach((k) => {
      candidates.push({
        id: k.id,
        name: k.name || 'API Anahtarı',
        key: k.key.trim(),
        baseUrl: (k.baseUrl && k.baseUrl.trim().length > 0) ? k.baseUrl.trim() : config.baseUrl.trim(),
      });
    });
  }

  // If pool has no enabled candidates, fallback to root config
  if (candidates.length === 0) {
    candidates.push({
      id: 'default_primary',
      name: 'Birincil API',
      key: config.apiKey?.trim() || '',
      baseUrl: config.baseUrl?.trim() || 'https://api.openai.com/v1',
    });
  }

  return candidates;
}

export function detectModelType(id: string): ModelItem['detectedType'] {
  const lower = id.toLowerCase();
  if (lower.includes('embed') || lower.includes('bge') || lower.includes('e5') || lower.includes('text-embedding')) {
    return 'embedding';
  }
  if (lower.includes('rerank') || lower.includes('re-rank') || lower.includes('score')) {
    return 'rerank';
  }
  if (lower.includes('dall-e') || lower.includes('image') || lower.includes('flux') || lower.includes('sd-') || lower.includes('midjourney')) {
    return 'image';
  }
  if (lower.includes('whisper') || lower.includes('tts') || lower.includes('audio') || lower.includes('speech') || lower.includes('voice')) {
    return 'audio';
  }
  if (
    lower.includes('gpt') ||
    lower.includes('claude') ||
    lower.includes('llama') ||
    lower.includes('mistral') ||
    lower.includes('qwen') ||
    lower.includes('deepseek') ||
    lower.includes('gemini') ||
    lower.includes('phi') ||
    lower.includes('chat')
  ) {
    return 'chat';
  }
  return 'general';
}

/**
 * Scan available models with automatic multi-API failover
 */
export async function scanModels(
  config: ApiConfig,
  options?: {
    onFailover?: (failedKeyName: string, nextKeyName: string, error: string) => void;
  }
): Promise<ModelItem[]> {
  const candidates = getActiveCandidates(config);
  const errors: string[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    try {
      const rawData = await fetchModelsFromCandidate(config, candidate);

      // Normalize models list
      let modelsList: any[] = [];
      if (Array.isArray(rawData)) {
        modelsList = rawData;
      } else if (rawData.data && Array.isArray(rawData.data)) {
        modelsList = rawData.data;
      } else if (rawData.models && Array.isArray(rawData.models)) {
        modelsList = rawData.models;
      } else {
        throw new Error('Model listesi tanınabilir formatta değil (data veya models dizisi bulunamadı).');
      }

      return modelsList.map((item) => {
        const id = typeof item === 'string' ? item : item.id || item.name || 'Bilinmeyen Model';
        return {
          id,
          object: item.object || 'model',
          created: item.created,
          owned_by: item.owned_by || 'system',
          permission: item.permission,
          root: item.root,
          parent: item.parent,
          detectedType: detectModelType(id),
        };
      });
    } catch (err: any) {
      const errMsg = `[${candidate.name}]: ${err.message || 'Bağlantı hatası'}`;
      errors.push(errMsg);

      if (config.enableFailover !== false && i < candidates.length - 1) {
        options?.onFailover?.(candidate.name, candidates[i + 1].name, err.message);
        continue;
      } else {
        break;
      }
    }
  }

  throw new Error(`Model taraması başarısız oldu:\n${errors.join('\n')}`);
}

async function fetchModelsFromCandidate(config: ApiConfig, candidate: ApiCandidate): Promise<any> {
  const { baseUrl, key } = candidate;
  if (!baseUrl.trim()) {
    throw new Error('Lütfen geçerli bir Base URL belirtin.');
  }

  if (config.useProxy) {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl,
        endpoint: '/models',
        method: 'GET',
        apiKey: key,
        headers: config.customHeaders,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Sunucu hatası: HTTP ${res.status}`);
    }

    return await res.json();
  } else {
    let cleanUrl = baseUrl.replace(/\/+$/, '');
    const url = cleanUrl.endsWith('/models') ? cleanUrl : `${cleanUrl}/models`;

    const headers: Record<string, string> = { ...config.customHeaders };
    if (key) headers['Authorization'] = `Bearer ${key.trim()}`;

    const res = await fetch(url, { method: 'GET', headers });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Bağlantı hatası (${res.status}): ${err}`);
    }
    return await res.json();
  }
}

export type DebugLogLevel = 'DEBUG' | 'INFO' | 'WAIT' | 'SUCCESS' | 'WARN' | 'ERROR';

/**
 * Execute a test on any of the 10 endpoints with automatic multi-API failover
 */
export async function executeEndpointTest(
  config: ApiConfig,
  endpoint: EndpointType,
  payload: any,
  options?: {
    modelId?: string;
    audioBase64?: string;
    audioFileName?: string;
    onStreamChunk?: (accumulatedText: string, chunk: string) => void;
    onCandidateAttempt?: (candidateName: string, index: number, total: number) => void;
    onFailoverTriggered?: (fromCandidateName: string, toCandidateName: string, reason: string) => void;
    onDebugLog?: (level: DebugLogLevel, message: string, detail?: any) => void;
  }
): Promise<BenchmarkRecord> {
  const candidates = getActiveCandidates(config);
  const targetModel = options?.modelId || payload?.model || 'standart';
  const recordId = 'rec_' + Math.random().toString(36).substring(2, 9);
  const attempts: BenchmarkRecord['attemptedKeys'] = [];
  const overallStartTime = performance.now();

  options?.onDebugLog?.('DEBUG', `🎯 Test Başlatıldı: Model="${targetModel}", Uç Nokta="${endpoint}", Aday Sayısı=${candidates.length}`);

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    options?.onCandidateAttempt?.(candidate.name, i + 1, candidates.length);
    options?.onDebugLog?.(
      'INFO',
      `📡 [${i + 1}/${candidates.length}] API Deneniyor: "${candidate.name}" (${candidate.baseUrl})`
    );

    try {
      options?.onDebugLog?.(
        'DEBUG',
        `📤 İstek Paketi Gönderiliyor: POST ${candidate.baseUrl}${endpoint} (Model: ${targetModel})`
      );

      const singleResult = await executeSingleCandidateAttempt(
        config,
        candidate,
        endpoint,
        payload,
        options
      );

      attempts.push({
        keyName: candidate.name,
        status: 'success',
        httpStatus: singleResult.httpStatus,
        latencyMs: singleResult.latencyMs,
      });

      options?.onDebugLog?.(
        'SUCCESS',
        `✅ [${candidate.name}] Başarılı (HTTP ${singleResult.httpStatus}, Süre: ${singleResult.latencyMs}ms, Token: ${singleResult.totalTokens || 0}, Hız: ${singleResult.tokensPerSecond || 0} t/s)`
      );

      return {
        ...singleResult,
        id: recordId,
        successfulKeyName: candidate.name,
        failoverOccurred: i > 0,
        attemptedKeys: attempts,
      };
    } catch (err: any) {
      const failLatency = Math.round(performance.now() - overallStartTime);
      attempts.push({
        keyName: candidate.name,
        status: 'failed',
        httpStatus: err.status || 500,
        error: err.message || 'Bilinmeyen hata',
        latencyMs: failLatency,
      });

      options?.onDebugLog?.(
        'ERROR',
        `❌ [${candidate.name}] İstek Başarısız (${err.status || 500}): ${err.message}`
      );

      // If failover is enabled and there's another candidate, notify and continue
      if (config.enableFailover !== false && i < candidates.length - 1) {
        const nextCand = candidates[i + 1];
        options?.onDebugLog?.(
          'WARN',
          `⚠️ Failover Devrede: "${candidate.name}" başarısız oldu -> Sıradaki API: "${nextCand.name}"`
        );
        options?.onFailoverTriggered?.(candidate.name, nextCand.name, err.message);
        continue;
      }
      break;
    }
  }

  // All candidates failed
  const totalLatencyMs = Math.round(performance.now() - overallStartTime);
  const errorSummary = attempts
    .map((a) => `[${a.keyName}]: ${a.error || 'Hata'}`)
    .join(' | ');

  options?.onDebugLog?.(
    'ERROR',
    `💥 Tüm API adayları (${candidates.length}) tüketildi ve başarısız oldu.`
  );

  return {
    id: recordId,
    timestamp: Date.now(),
    modelId: targetModel,
    endpoint,
    status: 'error',
    httpStatus: 500,
    latencyMs: totalLatencyMs,
    requestPayload: payload,
    responsePayload: null,
    errorMessage: `Tüm (${candidates.length}) API anahtarları denendi ve başarısız oldu:\n${errorSummary}`,
    outputPreview: `HATA: Tüm API denemeleri başarısız oldu (${attempts.length} deneme yapıldı).`,
    attemptedKeys: attempts,
    failoverOccurred: attempts.length > 1,
  };
}

/**
 * Executes a single attempt against a specific candidate
 */
async function executeSingleCandidateAttempt(
  config: ApiConfig,
  candidate: ApiCandidate,
  endpoint: EndpointType,
  payload: any,
  options?: {
    modelId?: string;
    audioBase64?: string;
    audioFileName?: string;
    onStreamChunk?: (accumulatedText: string, chunk: string) => void;
    onDebugLog?: (level: DebugLogLevel, message: string, detail?: any) => void;
  }
): Promise<BenchmarkRecord> {
  const startTime = performance.now();
  let firstTokenTime: number | undefined;
  const targetModel = options?.modelId || payload?.model || 'standart';
  const targetBaseUrl = candidate.baseUrl;
  const targetApiKey = candidate.key;

  let responseData: any;
  let latencyMs = 0;
  let httpStatus = 200;

  options?.onDebugLog?.('WAIT', `⏳ Sunucu yanıtı bekleniyor... [${candidate.name}] -> ${targetBaseUrl}${endpoint}`);

  // 1. Streaming SSE for Chat / Completions
  if (payload?.stream && (endpoint === '/chat/completions' || endpoint === '/completions') && config.useProxy) {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: targetBaseUrl,
        endpoint,
        method: 'POST',
        apiKey: targetApiKey,
        headers: config.customHeaders,
        body: payload,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      const error: any = new Error(errJson.error || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let completionTokensCount = 0;

    if (reader) {
      let done = false;
      while (!done) {
        const result = await reader.read();
        done = result.done;
        if (result.value) {
          const rawChunk = decoder.decode(result.value);
          const lines = rawChunk.split('\n');

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              if (jsonStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(jsonStr);
                const delta =
                  parsed.choices?.[0]?.delta?.content ||
                  parsed.choices?.[0]?.text ||
                  '';
                if (delta) {
                  if (firstTokenTime === undefined) {
                    firstTokenTime = performance.now();
                  }
                  accumulatedText += delta;
                  completionTokensCount += 1;
                  options?.onStreamChunk?.(accumulatedText, delta);
                }
              } catch {
                // keepalive/partial chunk
              }
            }
          }
        }
      }
    }

    latencyMs = Math.round(performance.now() - startTime);
    const ttftMs = firstTokenTime ? Math.round(firstTokenTime - startTime) : undefined;
    const promptEstimatedTokens = Math.ceil((JSON.stringify(payload.messages || payload.prompt || '').length) / 4);
    const outputTokens = completionTokensCount || Math.ceil(accumulatedText.length / 4);
    const totalTokens = promptEstimatedTokens + outputTokens;
    const tokPerSec = latencyMs > 0 ? Number(((outputTokens / (latencyMs / 1000))).toFixed(1)) : 0;

    return {
      id: '',
      timestamp: Date.now(),
      modelId: targetModel,
      endpoint,
      status: 'success',
      httpStatus: 200,
      latencyMs,
      ttftMs,
      promptTokens: promptEstimatedTokens,
      completionTokens: outputTokens,
      totalTokens,
      tokensPerSecond: tokPerSec,
      requestPayload: payload,
      responsePayload: { content: accumulatedText, stream: true },
      outputPreview: accumulatedText.slice(0, 400),
    };
  }

  // 2. Audio Speech (TTS)
  if (endpoint === '/audio/speech') {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: targetBaseUrl,
        endpoint: '/audio/speech',
        method: 'POST',
        apiKey: targetApiKey,
        headers: config.customHeaders,
        body: payload,
        isAudioSpeech: true,
      }),
    });

    const json = await res.json();
    latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok || json.error) {
      const error: any = new Error(json.error || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    return {
      id: '',
      timestamp: Date.now(),
      modelId: targetModel,
      endpoint,
      status: 'success',
      httpStatus: res.status,
      latencyMs: json._meta?.latencyMs || latencyMs,
      requestPayload: payload,
      responsePayload: json,
      audioDataUrl: json.audioDataUrl,
      outputPreview: `Ses başarıyla oluşturuldu (${json.byteLength || 0} bayt, ${json.contentType})`,
    };
  }

  // 3. Audio Transcription (Whisper)
  if (endpoint === '/audio/transcriptions') {
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: targetBaseUrl,
        endpoint: '/audio/transcriptions',
        method: 'POST',
        apiKey: targetApiKey,
        headers: config.customHeaders,
        isAudioTranscription: true,
        audioBase64: options?.audioBase64,
        audioFileName: options?.audioFileName || 'audio.mp3',
        transcriptionModel: payload.model || 'whisper-1',
        transcriptionPrompt: payload.prompt,
        transcriptionLanguage: payload.language,
        transcriptionFormat: payload.response_format,
      }),
    });

    const json = await res.json();
    latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok || json.error) {
      const error: any = new Error(json.error || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    const transcriptionText = json.text || JSON.stringify(json);

    return {
      id: '',
      timestamp: Date.now(),
      modelId: targetModel,
      endpoint,
      status: 'success',
      httpStatus: res.status,
      latencyMs: json._meta?.latencyMs || latencyMs,
      requestPayload: payload,
      responsePayload: json,
      outputPreview: transcriptionText.slice(0, 400),
    };
  }

  // 4. Standard JSON Proxy or Direct Call
  if (config.useProxy) {
    const isGet = endpoint === '/models';
    const res = await fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: targetBaseUrl,
        endpoint,
        method: isGet ? 'GET' : 'POST',
        apiKey: targetApiKey,
        headers: config.customHeaders,
        body: isGet ? undefined : payload,
      }),
    });

    responseData = await res.json();
    httpStatus = res.status;
    latencyMs = responseData._meta?.latencyMs || Math.round(performance.now() - startTime);

    if (!res.ok || responseData.error) {
      const errorMsg =
        typeof responseData.error === 'string'
          ? responseData.error
          : responseData.error?.message || `HTTP ${res.status}`;
      const error: any = new Error(errorMsg);
      error.status = res.status;
      throw error;
    }
  } else {
    // Direct browser fetch
    const cleanBase = targetBaseUrl.replace(/\/+$/, '');
    const url = `${cleanBase}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.customHeaders,
    };
    if (targetApiKey) headers['Authorization'] = `Bearer ${targetApiKey.trim()}`;

    const res = await fetch(url, {
      method: endpoint === '/models' ? 'GET' : 'POST',
      headers,
      body: endpoint === '/models' ? undefined : JSON.stringify(payload),
    });

    httpStatus = res.status;
    responseData = await res.json();
    latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      const error: any = new Error(responseData?.error?.message || `HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }
  }

  // Extract preview and tokens
  let outputPreview = '';
  let promptTokens = responseData?.usage?.prompt_tokens;
  let completionTokens = responseData?.usage?.completion_tokens;
  let totalTokens = responseData?.usage?.total_tokens;
  let images: string[] | undefined;
  let embeddingsDim: number | undefined;
  let rerankResults: any[] | undefined;

  if (endpoint === '/chat/completions') {
    outputPreview = responseData.choices?.[0]?.message?.content || '';
  } else if (endpoint === '/completions') {
    outputPreview = responseData.choices?.[0]?.text || '';
  } else if (endpoint === '/messages') {
    if (Array.isArray(responseData.content)) {
      outputPreview = responseData.content.map((c: any) => c.text || '').join('\n');
    } else {
      outputPreview = responseData.content || JSON.stringify(responseData);
    }
    promptTokens = responseData.usage?.input_tokens;
    completionTokens = responseData.usage?.output_tokens;
    totalTokens = (promptTokens || 0) + (completionTokens || 0);
  } else if (endpoint === '/images/generations') {
    images = (responseData.data || []).map((img: any) => img.url || `data:image/png;base64,${img.b64_json}`);
    outputPreview = `${images?.length || 0} adet görsel üretildi.`;
  } else if (endpoint === '/embeddings') {
    const firstVec = responseData.data?.[0]?.embedding;
    embeddingsDim = Array.isArray(firstVec) ? firstVec.length : undefined;
    outputPreview = `${responseData.data?.length || 1} vektör üretildi. Boyut: ${embeddingsDim || 'Bilinmiyor'}`;
  } else if (endpoint === '/rerank') {
    const results = responseData.results || responseData.data || [];
    rerankResults = results.map((r: any) => ({
      index: r.index,
      relevance_score: Number((r.relevance_score || r.score || 0).toFixed(4)),
      document: r.document?.text || r.document || '',
    }));
    outputPreview = `${rerankResults?.length} adet döküman yeniden sıralandı. En yüksek alaka: ${rerankResults?.[0]?.relevance_score}`;
  } else if (endpoint === '/score') {
    outputPreview = `Skor yanıtı: ${JSON.stringify(responseData.scores || responseData.data || responseData).slice(0, 200)}`;
  } else if (endpoint === '/models') {
    const count = (responseData.data || responseData || []).length;
    outputPreview = `${count} adet model başarıyla listelendi.`;
  } else {
    outputPreview = JSON.stringify(responseData).slice(0, 300);
  }

  const tokPerSec =
    completionTokens && latencyMs > 0
      ? Number(((completionTokens / (latencyMs / 1000))).toFixed(1))
      : undefined;

  return {
    id: '',
    timestamp: Date.now(),
    modelId: targetModel,
    endpoint,
    status: 'success',
    httpStatus,
    latencyMs,
    promptTokens,
    completionTokens,
    totalTokens,
    tokensPerSecond: tokPerSec,
    requestPayload: payload,
    responsePayload: responseData,
    outputPreview: outputPreview.slice(0, 500),
    images,
    embeddingsDim,
    rerankResults,
  };
}

/**
 * Generate a tiny silent 1-second WAV audio file as base64 for fallback transcription test
 */
export function generateTestWavBase64(): string {
  const sampleRate = 8000;
  const numSamples = 4000;
  const buffer = new Uint8Array(44 + numSamples);

  buffer.set([0x52, 0x49, 0x46, 0x46], 0);
  const fileLen = 36 + numSamples;
  buffer[4] = fileLen & 0xff;
  buffer[5] = (fileLen >> 8) & 0xff;
  buffer[6] = (fileLen >> 16) & 0xff;
  buffer[7] = (fileLen >> 24) & 0xff;
  buffer.set([0x57, 0x41, 0x56, 0x45], 8);
  buffer.set([0x66, 0x6d, 0x74, 0x20, 16, 0, 0, 0, 1, 0, 1, 0], 12);
  buffer[24] = sampleRate & 0xff;
  buffer[25] = (sampleRate >> 8) & 0xff;
  buffer[28] = sampleRate & 0xff;
  buffer[29] = (sampleRate >> 8) & 0xff;
  buffer[32] = 1;
  buffer[34] = 8;
  buffer.set([0x64, 0x61, 0x74, 0x61], 36);
  buffer[40] = numSamples & 0xff;
  buffer[41] = (numSamples >> 8) & 0xff;

  for (let i = 0; i < numSamples; i++) {
    const val = Math.floor(128 + 60 * Math.sin((2 * Math.PI * 440 * i) / sampleRate));
    buffer[44 + i] = val;
  }

  let binary = '';
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}
