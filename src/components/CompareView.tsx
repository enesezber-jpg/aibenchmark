import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  Zap,
  Clock,
  Layers,
  Check,
  AlertTriangle,
  ArrowRight,
  Plus,
  Trash2,
  Cpu,
} from 'lucide-react';
import type { ApiConfig, BenchmarkRecord, ModelItem } from '../types';
import { executeEndpointTest } from '../services/apiService';

interface CompareViewProps {
  apiConfig: ApiConfig;
  scannedModels: ModelItem[];
  selectedModelIds: string[];
  onBenchmarkCompleted: (record: BenchmarkRecord) => void;
  onGoToReports: () => void;
}

const COMPARISON_PRESETS = [
  {
    name: 'Mantık & Muhakeme (Logic Reasoning)',
    system: 'Sen tarafsız ve analitik bir yapay zeka asistanısın. Adım adım düşün (Chain of thought).',
    prompt:
      'Ali, Veli ve Can bir yarışa katıldı. Ali birinci olmadı. Veli, Can\'dan hemen sonra bitirdi. Her birinin sıralamasını kesin kanıtlarıyla açıkla.',
  },
  {
    name: 'Kod Üretimi (TypeScript Algoritma)',
    system: 'Sen kıdemli bir TypeScript mühendisisin. Temiz, tür güvenli ve optimize kod yaz.',
    prompt:
      'TypeScript ile bir LRU (Least Recently Used) Cache sınıfı yaz. get(key) ve put(key, value) metotları O(1) zaman karmaşıklığında çalışmalıdır.',
  },
  {
    name: 'Sistem Mimarisi (Mimari Analiz)',
    system: 'Sen yüksek ölçekli sistemler tasarlayan bir baş mimarsın (Principal Architect).',
    prompt:
      'Günde 1 milyar olayı işleyen bir dağıtık veri akışı için Kafka ile Apache Pulsar arasındaki mimari farkları ve seçim kriterlerini maddeler halinde analiz et.',
  },
  {
    name: 'Türkçe Çeviri & Edebi Düzeltme',
    system: 'Sen profesyonel bir çevirmen ve Türkçe editörüsün.',
    prompt:
      'Şu cümleyi doğal, akıcı ve kurumsal bir Türkçe ile çevir: "Our cutting-edge autonomous inference engine dynamically allocates computational clusters to mitigate peak-load latency spikes with zero operational downtime."',
  },
];

export const CompareView: React.FC<CompareViewProps> = ({
  apiConfig,
  scannedModels,
  selectedModelIds,
  onBenchmarkCompleted,
  onGoToReports,
}) => {
  // Models to compare (defaults to selected or common defaults)
  const [modelList, setModelList] = useState<string[]>(
    selectedModelIds.length >= 2
      ? selectedModelIds.slice(0, 4)
      : ['gpt-4o-mini', 'gpt-4o']
  );

  const [newModelInput, setNewModelInput] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(COMPARISON_PRESETS[0].system);
  const [userPrompt, setUserPrompt] = useState(COMPARISON_PRESETS[0].prompt);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(450);

  // Results state mapped by modelId
  const [results, setResults] = useState<Record<string, {
    status: 'idle' | 'running' | 'success' | 'error';
    record?: BenchmarkRecord;
    text?: string;
    error?: string;
  }>>({});

  const [isComparing, setIsComparing] = useState(false);

  const handleApplyPreset = (preset: typeof COMPARISON_PRESETS[0]) => {
    setSystemPrompt(preset.system);
    setUserPrompt(preset.prompt);
  };

  const handleAddModel = (id: string) => {
    const clean = id.trim();
    if (!clean || modelList.includes(clean)) return;
    if (modelList.length >= 4) {
      alert('En fazla 4 modeli aynı anda karşılaştırabilirsiniz.');
      return;
    }
    setModelList([...modelList, clean]);
    setNewModelInput('');
  };

  const handleRemoveModel = (idToRemove: string) => {
    if (modelList.length <= 1) {
      alert('En az 1 model listelenmelidir.');
      return;
    }
    setModelList(modelList.filter((m) => m !== idToRemove));
    setResults((prev) => {
      const next = { ...prev };
      delete next[idToRemove];
      return next;
    });
  };

  const handleRunComparison = async () => {
    if (modelList.length === 0) return;

    setIsComparing(true);
    const initialMap: typeof results = {};
    modelList.forEach((m) => {
      initialMap[m] = { status: 'running' };
    });
    setResults(initialMap);

    // Execute concurrently across all selected models
    const promises = modelList.map(async (modelId) => {
      const payload = {
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      try {
        const record = await executeEndpointTest(
          apiConfig,
          '/chat/completions',
          payload,
          { modelId }
        );

        onBenchmarkCompleted(record);

        if (record.status === 'success') {
          setResults((prev) => ({
            ...prev,
            [modelId]: {
              status: 'success',
              record,
              text: record.responsePayload?.choices?.[0]?.message?.content || record.outputPreview || '',
            },
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [modelId]: {
              status: 'error',
              record,
              error: record.errorMessage || 'Bilinmeyen hata',
            },
          }));
        }
      } catch (err: any) {
        setResults((prev) => ({
          ...prev,
          [modelId]: {
            status: 'error',
            error: err.message || 'İstek başarısız oldu',
          },
        }));
      }
    });

    await Promise.all(promises);
    setIsComparing(false);
  };

  // Find winner metrics among completed success records
  const successfulRecords = Object.values(results)
    .filter((r) => r.status === 'success' && r.record)
    .map((r) => r.record!);

  const lowestLatencyRecord =
    successfulRecords.length > 1
      ? [...successfulRecords].sort((a, b) => a.latencyMs - b.latencyMs)[0]
      : null;

  const highestSpeedRecord =
    successfulRecords.length > 1
      ? [...successfulRecords]
          .filter((r) => r.tokensPerSecond)
          .sort((a, b) => (b.tokensPerSecond || 0) - (a.tokensPerSecond || 0))[0]
      : null;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <span>Çoklu Model Karşılaştırmalı Analiz (Benchmark)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Aynı istemi seçtiğiniz modellere aynı anda gönderip gecikme, hız ve yanıt kalitesini yan yana kıyaslayın.
          </p>
        </div>

        {successfulRecords.length > 0 && (
          <button
            onClick={onGoToReports}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shadow-sm"
          >
            <span>Raporlama Paneline Git</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Model Selection Tags & Presets */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Selected Models Pill Bar */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Karşılaştırılacak Modeller (En az 2, en fazla 4)
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {modelList.map((m) => (
              <div
                key={m}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200"
              >
                <span>{m}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveModel(m)}
                  className="text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}

            {modelList.length < 4 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Model adı yazın..."
                  value={newModelInput}
                  onChange={(e) => setNewModelInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddModel(newModelInput);
                  }}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleAddModel(newModelInput)}
                  className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Ekle</span>
                </button>

                {scannedModels.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) handleAddModel(e.target.value);
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Taranan Modellerden Ekle...</option>
                    {scannedModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.id}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Test Prompt Presets */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Örnek Kıyaslama Görevleri (Presets)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {COMPARISON_PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(p)}
                className="p-2.5 text-left rounded-lg bg-slate-950/70 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 transition-colors"
              >
                <div className="text-xs font-semibold text-slate-200">{p.name}</div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">{p.prompt}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-1">
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Sistem Mesajı (System)</label>
            <textarea
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            />
          </div>

          <div className="md:col-span-8 space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Ortak Test İstemi (User Prompt)</label>
            <textarea
              rows={3}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200"
            />
          </div>
        </div>

        {/* Parameters & Run Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Sıcaklık:</span>
              <span className="font-mono text-slate-200">{temperature}</span>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-24 accent-emerald-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span>Maks. Token:</span>
              <input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 100)}
                className="w-20 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-slate-200 font-mono text-xs"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRunComparison}
            disabled={isComparing || modelList.length === 0}
            className="flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isComparing ? 'animate-pulse' : ''}`} />
            <span>{isComparing ? 'Modeller Kıyaslanıyor...' : `${modelList.length} Modeli Yan Yana Karşılaştır`}</span>
          </button>
        </div>
      </div>

      {/* Side-by-Side Comparison Columns */}
      <div
        className={`grid grid-cols-1 gap-4 ${
          modelList.length === 2
            ? 'md:grid-cols-2'
            : modelList.length === 3
            ? 'md:grid-cols-3'
            : 'md:grid-cols-2 lg:grid-cols-4'
        }`}
      >
        {modelList.map((modelId) => {
          const res = results[modelId];
          const isWinnerLatency = lowestLatencyRecord && res?.record?.id === lowestLatencyRecord.id;
          const isWinnerSpeed = highestSpeedRecord && res?.record?.id === highestSpeedRecord.id;

          return (
            <div
              key={modelId}
              className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                res?.status === 'running'
                  ? 'bg-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/20'
                  : res?.status === 'success'
                  ? 'bg-slate-900 border-slate-800'
                  : res?.status === 'error'
                  ? 'bg-slate-900 border-rose-500/40'
                  : 'bg-slate-900/60 border-slate-800/80'
              }`}
            >
              <div>
                {/* Header with Badges */}
                <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-800">
                  <div className="truncate">
                    <h3 className="text-xs font-mono font-bold text-white truncate" title={modelId}>
                      {modelId}
                    </h3>
                  </div>

                  {/* Winner or status tags */}
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    {res?.record?.failoverOccurred && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-950 text-amber-300 border border-amber-500/40">
                        <span>Yedek: {res.record.successfulKeyName}</span>
                      </span>
                    )}
                    {isWinnerLatency && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-500/40">
                        <Clock className="w-2.5 h-2.5" />
                        <span>En Hızlı Yanıt</span>
                      </span>
                    )}
                    {isWinnerSpeed && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                        <Zap className="w-2.5 h-2.5" />
                        <span>En Yüksek t/s</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Scorecards */}
                {res?.record && (
                  <div className="grid grid-cols-3 gap-1.5 mb-3 text-center">
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[9px] text-slate-400">Gecikme</div>
                      <div className="text-xs font-mono font-bold text-white tabular-nums">
                        {res.record.latencyMs}ms
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[9px] text-slate-400">Hız</div>
                      <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums">
                        {res.record.tokensPerSecond ? `${res.record.tokensPerSecond} t/s` : '-'}
                      </div>
                    </div>
                    <div className="p-1.5 rounded bg-slate-950 border border-slate-800">
                      <div className="text-[9px] text-slate-400">Token</div>
                      <div className="text-xs font-mono font-bold text-white tabular-nums">
                        {res.record.completionTokens || res.record.totalTokens || '-'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Body State */}
                {res?.status === 'running' ? (
                  <div className="py-12 flex flex-col items-center justify-center text-xs text-slate-400 space-y-2">
                    <div className="w-6 h-6 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <span>Çıkarım Yapılıyor...</span>
                  </div>
                ) : res?.status === 'error' ? (
                  <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
                    <div className="font-semibold mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Hata Oluştu</span>
                    </div>
                    <div className="font-mono text-[11px] break-all">{res.error}</div>
                  </div>
                ) : res?.status === 'success' ? (
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-200 leading-relaxed max-h-80 overflow-y-auto whitespace-pre-wrap font-sans">
                    {res.text}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-500">
                    Kıyaslamayı başlatmak için &apos;Modelleri Yan Yana Karşılaştır&apos; butonuna basın.
                  </div>
                )}
              </div>

                {res?.record && (
                <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                  <span className="font-mono">Girdi: {res.record.promptTokens || 0} tok</span>
                  <span className="font-mono">Çıktı: {res.record.completionTokens || 0} tok</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
