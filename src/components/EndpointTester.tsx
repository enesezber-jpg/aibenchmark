import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Copy,
  Check,
  Code2,
  ListFilter,
  FileAudio,
  Volume2,
  Clock,
  Zap,
  Layers,
  Sparkles,
  Download,
  AlertCircle,
  Eye,
  Sliders,
} from 'lucide-react';
import type { ApiConfig, BenchmarkRecord, EndpointType, ModelItem } from '../types';
import { ENDPOINT_DESCRIPTIONS } from '../utils/constants';
import { executeEndpointTest, generateTestWavBase64 } from '../services/apiService';

interface EndpointTesterProps {
  apiConfig: ApiConfig;
  models: ModelItem[];
  defaultSelectedModel?: string;
  onBenchmarkCompleted: (record: BenchmarkRecord) => void;
  onTriggerScan?: () => void;
}

export const EndpointTester: React.FC<EndpointTesterProps> = ({
  apiConfig,
  models,
  defaultSelectedModel,
  onBenchmarkCompleted,
  onTriggerScan,
}) => {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointType>('/chat/completions');
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');
  const [selectedModel, setSelectedModel] = useState<string>(
    defaultSelectedModel || models[0]?.id || ''
  );
  const [jsonPayload, setJsonPayload] = useState<string>('');
  const [isRunning, setIsRunning] = useState(false);
  const [streamOutput, setStreamOutput] = useState<string>('');
  const [lastRecord, setLastRecord] = useState<BenchmarkRecord | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [failoverNotice, setFailoverNotice] = useState<{ from: string; to: string; reason: string } | null>(null);

  // Form states for endpoints
  const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([
    { role: 'system', content: 'Sen son derece analitik, tarafsız ve özlü bir yapay zeka asistanısın.' },
    { role: 'user', content: 'Kuantum bilgisayarlar ile klasik bilgisayarlar arasındaki 3 temel farkı maddeler halinde açıkla.' },
  ]);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(500);
  const [enableStream, setEnableStream] = useState(true);

  // Completions state
  const [rawPrompt, setRawPrompt] = useState('Yapay zeka modellerinin performans analizi şu kriterlerle yapılır:\n1.');

  // Image state
  const [imagePrompt, setImagePrompt] = useState('A sleek futuristic data center with glowing green fiber optics, isometric 3D render');
  const [imageSize, setImageSize] = useState('1024x1024');

  // Audio Speech state
  const [speechText, setSpeechText] = useState('Generic OpenAI uyumlu model test ve analiz sistemine hoş geldiniz. Performans ölçümü başarıyla tamamlandı.');
  const [speechVoice, setSpeechVoice] = useState('alloy');
  const [speechSpeed, setSpeechSpeed] = useState(1.0);

  // Audio Transcription state
  const [audioBase64, setAudioBase64] = useState<string>('');
  const [audioFileName, setAudioFileName] = useState<string>('sample-sine.wav');
  const [audioLanguage, setAudioLanguage] = useState('tr');

  // Embeddings state
  const [embeddingsInput, setEmbeddingsInput] = useState<string>(
    'Yapay zeka modellerinin gecikme süresi ve hız testi\nVektör veritabanları ile anlamsal belge araması'
  );

  // Messages (Anthropic style)
  const [anthropicSystem, setAnthropicSystem] = useState('Sen kıdemli bir sistem mimarısın.');
  const [anthropicUserMsg, setAnthropicUserMsg] = useState('Mikroservis mimarisinde API Gateway kullanımının avantajlarını özetle.');

  // Score state
  const [scoreQuery, setScoreQuery] = useState('OpenAI uyumlu API test aracı');
  const [scoreCandidates, setScoreCandidates] = useState<string>(
    'API uç noktalarına test istekleri gönderip gecikmeyi ölçer.\nBugün hava durumu oldukça yağmurlu.\nModeller arası token üretim hızını karşılaştırır.'
  );

  // Rerank state
  const [rerankQuery, setRerankQuery] = useState('Derin öğrenme modellerinde gecikme süresini (latency) düşürme yöntemleri');
  const [rerankDocs, setRerankDocs] = useState<string>(
    'Model kuantizasyonu (INT8/FP4) ve KV-cache optimizasyonları gecikmeyi önemli ölçüde azaltır.\nVeritabanı indeksleme algoritmaları B-Tree ve Hash temelli yapılandırılır.\nSpeculative decoding ve vLLM PagedAttention yüksek verimlilik sağlar.\nCSS animasyonları GPU hızlandırması ile 60 fps akıcılık sunar.'
  );

  // Update selected model when prop changes or models are scanned
  useEffect(() => {
    if (defaultSelectedModel) {
      setSelectedModel(defaultSelectedModel);
    } else if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id);
    }
  }, [defaultSelectedModel, models, selectedModel]);

  // Sync JSON payload on endpoint or form change
  useEffect(() => {
    const meta = ENDPOINT_DESCRIPTIONS[selectedEndpoint];
    let payload: any = {};

    switch (selectedEndpoint) {
      case '/models':
        payload = {};
        break;
      case '/chat/completions':
        payload = {
          model: selectedModel || meta.typicalModel,
          messages: chatMessages,
          temperature,
          max_tokens: maxTokens,
          stream: enableStream,
        };
        break;
      case '/completions':
        payload = {
          model: selectedModel || meta.typicalModel,
          prompt: rawPrompt,
          temperature,
          max_tokens: maxTokens,
        };
        break;
      case '/images/generations':
        payload = {
          model: selectedModel || meta.typicalModel,
          prompt: imagePrompt,
          n: 1,
          size: imageSize,
        };
        break;
      case '/audio/speech':
        payload = {
          model: selectedModel || meta.typicalModel,
          input: speechText,
          voice: speechVoice,
          response_format: 'mp3',
          speed: speechSpeed,
        };
        break;
      case '/audio/transcriptions':
        payload = {
          model: selectedModel || meta.typicalModel,
          language: audioLanguage,
          response_format: 'json',
        };
        break;
      case '/embeddings':
        payload = {
          model: selectedModel || meta.typicalModel,
          input: embeddingsInput.split('\n').filter((l) => l.trim().length > 0),
          encoding_format: 'float',
        };
        break;
      case '/messages':
        payload = {
          model: selectedModel || meta.typicalModel,
          max_tokens: maxTokens,
          system: anthropicSystem,
          messages: [{ role: 'user', content: anthropicUserMsg }],
        };
        break;
      case '/score':
        payload = {
          model: selectedModel || meta.typicalModel,
          query: scoreQuery,
          candidates: scoreCandidates.split('\n').filter((l) => l.trim().length > 0),
        };
        break;
      case '/rerank':
        payload = {
          model: selectedModel || meta.typicalModel,
          query: rerankQuery,
          documents: rerankDocs.split('\n').filter((l) => l.trim().length > 0),
          top_n: 3,
          return_documents: true,
        };
        break;
    }

    setJsonPayload(JSON.stringify(payload, null, 2));
  }, [
    selectedEndpoint,
    selectedModel,
    chatMessages,
    temperature,
    maxTokens,
    enableStream,
    rawPrompt,
    imagePrompt,
    imageSize,
    speechText,
    speechVoice,
    speechSpeed,
    audioLanguage,
    embeddingsInput,
    anthropicSystem,
    anthropicUserMsg,
    scoreQuery,
    scoreCandidates,
    rerankQuery,
    rerankDocs,
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      setAudioBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateSampleAudio = () => {
    const wavBase64 = generateTestWavBase64();
    setAudioBase64(wavBase64);
    setAudioFileName('sample-440hz.wav');
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setStreamOutput('');
    setLastRecord(null);
    setFailoverNotice(null);

    let parsedPayload: any = {};
    try {
      parsedPayload = JSON.parse(jsonPayload);
    } catch {
      alert('JSON sözdizimi geçersiz! Lütfen JSON alanını kontrol edin.');
      setIsRunning(false);
      return;
    }

    try {
      const record = await executeEndpointTest(
        apiConfig,
        selectedEndpoint,
        parsedPayload,
        {
          modelId: selectedModel,
          audioBase64: selectedEndpoint === '/audio/transcriptions' ? audioBase64 || generateTestWavBase64() : undefined,
          audioFileName: selectedEndpoint === '/audio/transcriptions' ? audioFileName : undefined,
          onStreamChunk: (accumulated) => {
            setStreamOutput(accumulated);
          },
          onFailoverTriggered: (fromKey, toKey, reason) => {
            setFailoverNotice({ from: fromKey, to: toKey, reason });
          },
        }
      );

      setLastRecord(record);
      onBenchmarkCompleted(record);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const endpointMeta = ENDPOINT_DESCRIPTIONS[selectedEndpoint];

  return (
    <div className="space-y-6">
      {/* Top Endpoint Selector Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-300">
            Test Edilecek Uç Noktayı Seçin (10 OpenAI Standardı)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Aktif Uç Nokta: {selectedEndpoint}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.keys(ENDPOINT_DESCRIPTIONS) as EndpointType[]).map((ep) => {
            const isSelected = selectedEndpoint === ep;
            const meta = ENDPOINT_DESCRIPTIONS[ep];

            return (
              <button
                key={ep}
                onClick={() => {
                  setSelectedEndpoint(ep);
                  setLastRecord(null);
                  setStreamOutput('');
                  // If typical model exists and current model is empty, set typical
                  if (meta.typicalModel) {
                    setSelectedModel(meta.typicalModel);
                  }
                }}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-emerald-950/40 border-emerald-500/60 text-white ring-1 ring-emerald-500/40'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold ${
                      meta.method === 'GET' ? 'bg-blue-900/60 text-blue-300' : 'bg-amber-900/60 text-amber-300'
                    }`}
                  >
                    {meta.method}
                  </span>
                  <span className="text-[10px] text-slate-500">{meta.category}</span>
                </div>
                <div className="text-xs font-mono font-medium truncate text-slate-200">{ep}</div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{meta.name}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Two-Column Bench: Request Config | Live Response & Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Request Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            {/* Header with Mode Toggle */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>{endpointMeta.name}</span>
                  <span className="text-xs font-mono text-slate-400">({selectedEndpoint})</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{endpointMeta.description}</p>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs">
                <button
                  onClick={() => setEditorMode('form')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                    editorMode === 'form' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-3 h-3" />
                  <span>Form</span>
                </button>
                <button
                  onClick={() => setEditorMode('json')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors ${
                    editorMode === 'json' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Model Selection Row (for endpoints that take a model) */}
            {selectedEndpoint !== '/models' && (
              <div className="space-y-1.5">
                <label className="flex items-center justify-between text-xs font-medium text-slate-300">
                  <span>Model Tanımlayıcısı (model)</span>
                  <span className="text-[11px] text-slate-400">Taranan listeden seçin veya yazın</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    placeholder={endpointMeta.typicalModel || 'gpt-4o-mini'}
                    className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {models.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) setSelectedModel(e.target.value);
                      }}
                      className="px-2.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">Taranan Modellerden Seç...</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} ({m.detectedType || 'genel'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}

            {/* Form Editor or Raw JSON */}
            {editorMode === 'json' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Ham JSON İstek Gövdesi</label>
                <textarea
                  rows={13}
                  value={jsonPayload}
                  onChange={(e) => setJsonPayload(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-400/90 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                />
              </div>
            ) : (
              <div className="space-y-3.5 pt-1">
                {/* Specific Form inputs for each endpoint */}
                {selectedEndpoint === '/chat/completions' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Sistem Mesajı (System)</label>
                      <input
                        type="text"
                        value={chatMessages[0]?.content || ''}
                        onChange={(e) =>
                          setChatMessages([
                            { role: 'system', content: e.target.value },
                            chatMessages[1] || { role: 'user', content: '' },
                          ])
                        }
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Kullanıcı İstemi (User Prompt)</label>
                      <textarea
                        rows={3}
                        value={chatMessages[1]?.content || ''}
                        onChange={(e) =>
                          setChatMessages([
                            chatMessages[0] || { role: 'system', content: '' },
                            { role: 'user', content: e.target.value },
                          ])
                        }
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Sıcaklık: {temperature}</label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Maksimum Token</label>
                        <input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 100)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-4">
                        <label className="text-[11px] text-slate-300 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enableStream}
                            onChange={(e) => setEnableStream(e.target.checked)}
                            className="rounded accent-emerald-500"
                          />
                          <span>Canlı Akış (Stream)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/completions' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Ham Metin İstemi (Prompt)</label>
                      <textarea
                        rows={4}
                        value={rawPrompt}
                        onChange={(e) => setRawPrompt(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Sıcaklık: {temperature}</label>
                        <input
                          type="range"
                          min="0"
                          max="2"
                          step="0.1"
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Maksimum Token</label>
                        <input
                          type="number"
                          value={maxTokens}
                          onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 100)}
                          className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/images/generations' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Görsel İstemi (Prompt)</label>
                      <textarea
                        rows={3}
                        value={imagePrompt}
                        onChange={(e) => setImagePrompt(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Boyut (Size)</label>
                        <select
                          value={imageSize}
                          onChange={(e) => setImageSize(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        >
                          <option value="1024x1024">1024x1024 (Kare)</option>
                          <option value="1792x1024">1792x1024 (Geniş 16:9)</option>
                          <option value="1024x1792">1024x1792 (Dikey 9:16)</option>
                          <option value="512x512">512x512 (Hızlı)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/audio/speech' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Okunacak Metin (Input Text)</label>
                      <textarea
                        rows={3}
                        value={speechText}
                        onChange={(e) => setSpeechText(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Ses Karakteri (Voice)</label>
                        <select
                          value={speechVoice}
                          onChange={(e) => setSpeechVoice(e.target.value)}
                          className="w-full px-2.5 py-2 bg-slate-950 border border-slate-800 rounded text-slate-200"
                        >
                          <option value="alloy">Alloy (Dengeli)</option>
                          <option value="echo">Echo (Net, Canlı)</option>
                          <option value="fable">Fable (Anlatıcı)</option>
                          <option value="onyx">Onyx (Derin, Tok)</option>
                          <option value="nova">Nova (Enerjik)</option>
                          <option value="shimmer">Shimmer (Sıcak)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-400 mb-1">Hız (Speed): {speechSpeed}x</label>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={speechSpeed}
                          onChange={(e) => setSpeechSpeed(parseFloat(e.target.value))}
                          className="w-full accent-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/audio/transcriptions' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Ses Kaynağı</label>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-950 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg cursor-pointer text-slate-300 transition-colors">
                          <FileAudio className="w-4 h-4 text-emerald-400" />
                          <span>{audioFileName ? audioFileName : 'Ses Dosyası Yükle (.mp3, .wav, .m4a)'}</span>
                          <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
                        </label>
                        <button
                          type="button"
                          onClick={handleGenerateSampleAudio}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-200 font-medium whitespace-nowrap"
                        >
                          Örnek Test Sesi Oluştur
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Dil Kodu (Language)</label>
                      <input
                        type="text"
                        value={audioLanguage}
                        onChange={(e) => setAudioLanguage(e.target.value)}
                        placeholder="tr"
                        className="w-32 px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/embeddings' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Vektörlenecek Metinler (Her satır ayrı girdi)</label>
                      <textarea
                        rows={4}
                        value={embeddingsInput}
                        onChange={(e) => setEmbeddingsInput(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/messages' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Sistem Yönergesi (System)</label>
                      <input
                        type="text"
                        value={anthropicSystem}
                        onChange={(e) => setAnthropicSystem(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Kullanıcı Mesajı (User Message)</label>
                      <textarea
                        rows={3}
                        value={anthropicUserMsg}
                        onChange={(e) => setAnthropicUserMsg(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/score' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Referans Sorgu (Query)</label>
                      <input
                        type="text"
                        value={scoreQuery}
                        onChange={(e) => setScoreQuery(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Aday Metinler (Her satır ayrı bir aday)</label>
                      <textarea
                        rows={3}
                        value={scoreCandidates}
                        onChange={(e) => setScoreCandidates(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/rerank' && (
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Sıralama Sorgusu (Query)</label>
                      <input
                        type="text"
                        value={rerankQuery}
                        onChange={(e) => setRerankQuery(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-300 mb-1">Sıralanacak Belgeler (Documents - Her satır 1 belge)</label>
                      <textarea
                        rows={4}
                        value={rerankDocs}
                        onChange={(e) => setRerankDocs(e.target.value)}
                        className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                      />
                    </div>
                  </div>
                )}

                {selectedEndpoint === '/models' && (
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg text-xs text-slate-400">
                    /models uç noktası GET isteği ile çalışır ve parametre gerektirmez.
                  </div>
                )}
              </div>
            )}

            {/* Run Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunTest}
                disabled={isRunning}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
                <span>{isRunning ? 'Test İstemi Gönderiliyor & Ölçülüyor...' : `Testi Çalıştır (${selectedEndpoint})`}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Output & Performance Diagnostics (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Performans & Yanıt Analizi</span>
              </h3>

              {lastRecord && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(lastRecord.responsePayload, null, 2));
                    setCopiedResponse(true);
                    setTimeout(() => setCopiedResponse(false), 2000);
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {copiedResponse ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedResponse ? 'Kopyalandı' : 'JSON Kopyala'}</span>
                </button>
              )}
            </div>

            {/* Live failover alert during execution */}
            {failoverNotice && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs flex items-start gap-2.5 animate-pulse">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Otomatik Geçiş (Failover) Tetiklendi</span>
                  <span>
                    &apos;{failoverNotice.from}&apos; hata verdi ({failoverNotice.reason || 'Bağlantı hatası'}), sıradaki &apos;{failoverNotice.to}&apos; API deneniyor...
                  </span>
                </div>
              </div>
            )}

            {/* KPI Metrics Strip */}
            {lastRecord && (
              <>
                {/* Successful Failover notification if happened */}
                {lastRecord.failoverOccurred && lastRecord.status === 'success' && (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Yedekleme Devrede: İlk API hata verdi, istek başarıyla &apos;{lastRecord.successfulKeyName}&apos; üzerinden tamamlandı!
                      </span>
                    </div>
                    <span className="text-[10px] font-mono bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
                      {lastRecord.attemptedKeys?.length} Deneme
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      <span>Gecikme</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-1 tabular-nums">
                      {lastRecord.latencyMs} ms
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>Hız</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                      {lastRecord.tokensPerSecond ? `${lastRecord.tokensPerSecond} t/s` : (lastRecord.ttftMs ? `${lastRecord.ttftMs}ms TTFT` : '-')}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-purple-400" />
                      <span>Token</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-white mt-1 tabular-nums">
                      {lastRecord.totalTokens || lastRecord.completionTokens || '-'}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 truncate">
                      {lastRecord.successfulKeyName ? lastRecord.successfulKeyName : 'Durum'}
                    </div>
                    <div
                      className={`text-xs font-bold font-mono mt-1 ${
                        lastRecord.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {lastRecord.httpStatus || 200} {lastRecord.status === 'success' ? 'OK' : 'ERR'}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Streaming or Static Output Area */}
            {isRunning && streamOutput && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-medium text-emerald-400 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>Akış Geliyor (Streaming SSE)...</span>
                </div>
                <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-lg text-xs font-mono text-slate-200 max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {streamOutput}
                </div>
              </div>
            )}

            {/* Result Displays */}
            {lastRecord ? (
              <div className="space-y-3">
                {lastRecord.status === 'error' && (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                    <div className="font-semibold flex items-center gap-1.5 mb-1">
                      <AlertCircle className="w-4 h-4 text-rose-400" />
                      <span>Hata Yanıtı ({lastRecord.httpStatus || 500})</span>
                    </div>
                    <div className="font-mono text-[11px] break-all">{lastRecord.errorMessage}</div>
                  </div>
                )}

                {/* Audio Player for /audio/speech */}
                {lastRecord.audioDataUrl && (
                  <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                    <div className="text-xs font-medium text-slate-200 flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-amber-400" />
                      <span>Üretilen Ses Çıktısı</span>
                    </div>
                    <audio controls className="w-full h-9" src={lastRecord.audioDataUrl} autoPlay />
                    <div className="pt-1">
                      <a
                        href={lastRecord.audioDataUrl}
                        download="speech.mp3"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Sesi İndir (.mp3)</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Image Gallery for /images/generations */}
                {lastRecord.images && lastRecord.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-200">Üretilen Görsel</div>
                    <div className="grid grid-cols-1 gap-2">
                      {lastRecord.images.map((imgUrl, i) => (
                        <div key={i} className="relative rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                          <img
                            src={imgUrl}
                            alt="Generated"
                            referrerPolicy="no-referrer"
                            className="w-full h-auto object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rerank Results Table */}
                {lastRecord.rerankResults && lastRecord.rerankResults.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-200">Sıralama Sonuçları (Yüksekten Düşüğe)</div>
                    <div className="space-y-1.5">
                      {lastRecord.rerankResults.map((r, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 truncate">
                            <span className="font-mono text-slate-500 mr-2">#{i + 1}</span>
                            <span className="text-slate-300">{r.document || `Döküman indeksi: ${r.index}`}</span>
                          </div>
                          <span className="px-2 py-0.5 rounded font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 text-[11px] shrink-0">
                            Skor: {r.relevance_score}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Text/Content Preview */}
                {lastRecord.outputPreview && !lastRecord.audioDataUrl && (
                  <div className="space-y-1.5">
                    <div className="text-xs font-medium text-slate-300">İçerik Özeti</div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 whitespace-pre-wrap max-h-56 overflow-y-auto font-sans leading-relaxed">
                      {lastRecord.outputPreview}
                    </div>
                  </div>
                )}

                {/* Raw JSON Accordion */}
                <details className="text-xs border border-slate-800/80 rounded-lg bg-slate-950/60 p-2.5">
                  <summary className="font-medium text-slate-400 cursor-pointer hover:text-slate-200">
                    Ham Yanıt Ağacını Gör (JSON Payload)
                  </summary>
                  <pre className="mt-2 p-2 bg-slate-950 rounded text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto whitespace-pre-wrap border border-slate-800">
                    {JSON.stringify(lastRecord.responsePayload, null, 2)}
                  </pre>
                </details>
              </div>
            ) : !isRunning ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                Test çalıştırmak için sol paneldeki parametreleri belirleyip &apos;Testi Çalıştır&apos; butonuna basın.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
