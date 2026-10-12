import React, { useState, useEffect, useMemo } from 'react';
import {
  Play,
  Sparkles,
  Trophy,
  FileText,
  Code2,
  Brain,
  Zap,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  ShieldCheck,
  Check,
  Search,
  Scan,
  SlidersHorizontal,
  Key,
  Globe,
  Plus,
  Eye,
  EyeOff,
  Server,
  Terminal,
} from 'lucide-react';
import type {
  ApiConfig,
  ApiKeyItem,
  BenchmarkCategory,
  BenchmarkRecord,
  BenchmarkTestDefinition,
  ModelItem,
  ModelEvaluationProfile,
} from '../types';
import {
  BENCHMARK_TESTS,
  findMatchingModelGuide,
  evaluateTestOutput,
} from '../utils/benchmarkSuites';
import { PRESET_PROVIDERS } from '../utils/constants';
import { executeEndpointTest, scanModels } from '../services/apiService';

interface BenchmarkSuiteViewProps {
  apiConfig: ApiConfig;
  scannedModels: ModelItem[];
  selectedModelIds: string[];
  onBenchmarkCompleted: (record: BenchmarkRecord) => void;
  onGoToModelGuide: () => void;
  onTriggerScan: () => void;
  isScanning: boolean;
  scanError: string | null;
  onOpenConfig: () => void;
  onUpdateSelectedModels: (modelIds: string[]) => void;
  onUpdateApiConfig?: (newConfig: ApiConfig) => void;
  onRunningStateChange?: (
    isRunning: boolean,
    progressPercent: number,
    testName: string,
    modelName: string
  ) => void;
}

export const BenchmarkSuiteView: React.FC<BenchmarkSuiteViewProps> = ({
  apiConfig,
  scannedModels,
  selectedModelIds,
  onBenchmarkCompleted,
  onGoToModelGuide,
  onTriggerScan,
  isScanning,
  scanError,
  onOpenConfig,
  onUpdateSelectedModels,
  onUpdateApiConfig,
  onRunningStateChange,
}) => {
  // Quick Setup States (Inline for fast setup)
  const [quickBaseUrl, setQuickBaseUrl] = useState(apiConfig.baseUrl || 'https://api.openai.com/v1');
  const [quickApiKey, setQuickApiKey] = useState(apiConfig.apiKey || '');
  const [quickBackupKey, setQuickBackupKey] = useState(
    apiConfig.apiKeysPool && apiConfig.apiKeysPool.length > 1 ? apiConfig.apiKeysPool[1].key : ''
  );
  const [showQuickBackup, setShowQuickBackup] = useState(
    apiConfig.apiKeysPool && apiConfig.apiKeysPool.length > 1
  );
  const [showKeyVisible, setShowKeyVisible] = useState(false);
  const [showBackupKeyVisible, setShowBackupKeyVisible] = useState(false);

  // Model search / filter inside the real scanned list
  const [modelSearch, setModelSearch] = useState('');
  const [modelFilterType, setModelFilterType] = useState<'all' | 'chat'>('chat');

  // Selected test scope: 'all' (All 6 comprehensive tests) or specific category
  const [selectedScope, setSelectedScope] = useState<string>('all');

  // Benchmark execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentTestName, setCurrentTestName] = useState('');
  const [currentModelName, setCurrentModelName] = useState('');
  const [currentCandidateName, setCurrentCandidateName] = useState('');
  const [failoverNotification, setFailoverNotification] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState(0);

  // Model evaluations mapped by modelId (persisted across tab switches and reloads)
  const [evaluations, setEvaluations] = useState<Record<string, ModelEvaluationProfile>>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_evaluations');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [detailedOutputs, setDetailedOutputs] = useState<
    Array<{
      modelId: string;
      testId: string;
      testName: string;
      category: BenchmarkCategory;
      output: string;
      score: number;
      latencyMs: number;
      tokPerSec?: number;
      status: 'success' | 'error';
      critique: string;
      errorMessage?: string;
      usedKeyName?: string;
    }>
  >(() => {
    try {
      const saved = localStorage.getItem('openai_suite_detailed_outputs');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Persist evaluations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_evaluations', JSON.stringify(evaluations));
    } catch {}
  }, [evaluations]);

  // Persist detailedOutputs to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_detailed_outputs', JSON.stringify(detailedOutputs));
    } catch {}
  }, [detailedOutputs]);

  // Report running state to parent (Header live badge)
  useEffect(() => {
    onRunningStateChange?.(isRunning, progressPercent, currentTestName, currentModelName);
  }, [isRunning, progressPercent, currentTestName, currentModelName, onRunningStateChange]);

  const [expandedOutputId, setExpandedOutputId] = useState<string | null>(null);

  // Filter scanned models strictly by real models returned from the API
  const filteredScannedModels = useMemo(() => {
    return scannedModels.filter((m) => {
      const matchSearch = m.id.toLowerCase().includes(modelSearch.toLowerCase());
      if (!matchSearch) return false;
      if (modelFilterType === 'chat') {
        return m.detectedType === 'chat' || m.detectedType === 'general';
      }
      return true;
    });
  }, [scannedModels, modelSearch, modelFilterType]);

  // Valid selected models that ACTUALLY exist in the user's scannedModels
  const validSelectedModels = useMemo(() => {
    const scannedSet = new Set(scannedModels.map((m) => m.id));
    return selectedModelIds.filter((id) => scannedSet.has(id));
  }, [scannedModels, selectedModelIds]);

  // If valid selected models is empty and we have scanned models, auto-select first available real model
  useEffect(() => {
    if (scannedModels.length > 0 && validSelectedModels.length === 0) {
      const chatModel = scannedModels.find((m) => m.detectedType === 'chat' || m.detectedType === 'general');
      const fallback = chatModel ? chatModel.id : scannedModels[0].id;
      onUpdateSelectedModels([fallback]);
    }
  }, [scannedModels, validSelectedModels.length, onUpdateSelectedModels]);

  const handleToggleModel = (modelId: string) => {
    if (validSelectedModels.includes(modelId)) {
      if (validSelectedModels.length <= 1) {
        alert('Testi başlatmak için en az 1 model seçili olmalıdır.');
        return;
      }
      onUpdateSelectedModels(validSelectedModels.filter((id) => id !== modelId));
    } else {
      if (validSelectedModels.length >= 4) {
        alert('Aynı anda en fazla 4 modeli karşılaştırmalı olarak test edebilirsiniz.');
        return;
      }
      onUpdateSelectedModels([...validSelectedModels, modelId]);
    }
  };

  const handleQuickPresetSelect = (presetId: string) => {
    const preset = PRESET_PROVIDERS.find((p) => p.id === presetId);
    if (!preset) return;
    setQuickBaseUrl(preset.defaultBaseUrl);
  };

  const handleQuickSaveAndScan = () => {
    const pool: ApiKeyItem[] = [
      {
        id: 'key_1',
        name: 'Birincil API',
        key: quickApiKey.trim(),
        baseUrl: quickBaseUrl.trim(),
        isEnabled: true,
      },
    ];

    if (showQuickBackup && quickBackupKey.trim().length > 0) {
      pool.push({
        id: 'key_2',
        name: 'Yedek API (Failover)',
        key: quickBackupKey.trim(),
        baseUrl: quickBaseUrl.trim(),
        isEnabled: true,
      });
    }

    const newCfg: ApiConfig = {
      ...apiConfig,
      baseUrl: quickBaseUrl.trim(),
      apiKey: quickApiKey.trim(),
      apiKeysPool: pool,
      enableFailover: true,
    };

    if (onUpdateApiConfig) {
      onUpdateApiConfig(newCfg);
    } else {
      onTriggerScan();
    }
  };

  // Run REAL Benchmark Engine
  const handleRunBenchmark = async () => {
    if (validSelectedModels.length === 0) {
      alert('Lütfen sunucunuzda bulunan modellerden en az birini seçin.');
      return;
    }

    setIsRunning(true);
    setProgressPercent(0);
    setDetailedOutputs([]);
    setFailoverNotification(null);

    const testsToRun: BenchmarkTestDefinition[] =
      selectedScope === 'all'
        ? BENCHMARK_TESTS
        : BENCHMARK_TESTS.filter((t) => t.category === selectedScope);

    const totalSteps = validSelectedModels.length * testsToRun.length;
    let completedSteps = 0;

    const tempOutputs: typeof detailedOutputs = [];
    const modelScoresAccumulator: Record<
      string,
      {
        categoryScores: Record<BenchmarkCategory, { total: number; count: number }>;
        latencies: number[];
        speeds: number[];
        successCount: number;
        totalCount: number;
      }
    > = {};

    validSelectedModels.forEach((m) => {
      modelScoresAccumulator[m] = {
        categoryScores: {
          document_analysis: { total: 0, count: 0 },
          coding: { total: 0, count: 0 },
          reasoning: { total: 0, count: 0 },
          speed: { total: 0, count: 0 },
          json_instruction: { total: 0, count: 0 },
          turkish_language: { total: 0, count: 0 },
        },
        latencies: [],
        speeds: [],
        successCount: 0,
        totalCount: 0,
      };
    });

    for (const test of testsToRun) {
      setCurrentTestName(`${test.categoryName}: ${test.name}`);

      for (const modelId of validSelectedModels) {
        setCurrentModelName(modelId);

        const payload = {
          model: modelId,
          messages: [
            { role: 'system', content: test.systemPrompt },
            { role: 'user', content: test.userPrompt },
          ],
          temperature: test.temperature,
          max_tokens: test.maxTokens,
          stream: false,
        };

        try {
          // REAL HTTP API call to user's real model!
          const record = await executeEndpointTest(
            apiConfig,
            '/chat/completions',
            payload,
            {
              modelId,
              onCandidateAttempt: (candidateName) => {
                setCurrentCandidateName(candidateName);
              },
              onFailoverTriggered: (fromCand, toCand, reason) => {
                setFailoverNotification(
                  `⚠️ [${fromCand}] API hata verdi (${reason}). Otomatik olarak [${toCand}] API'sine geçildi!`
                );
              },
            }
          );

          onBenchmarkCompleted({
            ...record,
            category: test.category,
          });

          const isSuccess = record.status === 'success';
          const rawOutput = isSuccess
            ? record.responsePayload?.choices?.[0]?.message?.content || record.outputPreview || ''
            : '';

          // Real evaluation based on model's real output
          const evaluation = isSuccess
            ? evaluateTestOutput(
                test,
                rawOutput,
                record.latencyMs,
                record.tokensPerSecond
              )
            : {
                score: 0,
                critique: `Hata: API model yanıtı veremedi (${record.errorMessage || 'HTTP Hatası'}).`,
                matchedKeywords: [],
              };

          tempOutputs.push({
            modelId,
            testId: test.id,
            testName: test.name,
            category: test.category,
            output: isSuccess ? rawOutput : `[HATA] ${record.errorMessage}`,
            score: evaluation.score,
            latencyMs: record.latencyMs,
            tokPerSec: record.tokensPerSecond,
            status: record.status,
            critique: evaluation.critique,
            errorMessage: record.errorMessage,
            usedKeyName: record.successfulKeyName,
          });

          const acc = modelScoresAccumulator[modelId];
          if (acc) {
            acc.totalCount += 1;
            if (isSuccess) {
              acc.successCount += 1;
              acc.categoryScores[test.category].total += evaluation.score;
              acc.categoryScores[test.category].count += 1;
              acc.latencies.push(record.latencyMs);
              if (record.tokensPerSecond) acc.speeds.push(record.tokensPerSecond);
            }
          }
        } catch (err: any) {
          tempOutputs.push({
            modelId,
            testId: test.id,
            testName: test.name,
            category: test.category,
            output: `[Bağlantı Hatası] ${err.message}`,
            score: 0,
            latencyMs: 0,
            status: 'error',
            critique: 'Bağlantı sağlanamadı veya model isteği reddetti.',
            errorMessage: err.message,
          });
        }

        completedSteps++;
        setProgressPercent(Math.round((completedSteps / totalSteps) * 100));
      }
    }

    setDetailedOutputs(tempOutputs);

    // Compute REAL final profiles
    const finalProfiles: Record<string, ModelEvaluationProfile> = {};

    validSelectedModels.forEach((modelId) => {
      const acc = modelScoresAccumulator[modelId];
      const guide = findMatchingModelGuide(modelId);

      const catScores: Record<BenchmarkCategory, number> = {
        document_analysis: 0,
        coding: 0,
        reasoning: 0,
        speed: 0,
        json_instruction: 0,
        turkish_language: 0,
      };

      let overallSum = 0;
      let overallCount = 0;

      (Object.keys(catScores) as BenchmarkCategory[]).forEach((cat) => {
        const item = acc.categoryScores[cat];
        const val = item.count > 0 ? Math.round(item.total / item.count) : 0;
        catScores[cat] = val;
        if (item.count > 0) {
          overallSum += val;
          overallCount++;
        }
      });

      const overallScore = overallCount > 0 ? Math.round(overallSum / overallCount) : 0;
      const avgLatencyMs =
        acc.latencies.length > 0
          ? Math.round(acc.latencies.reduce((a, b) => a + b, 0) / acc.latencies.length)
          : 0;
      const avgTokensPerSec =
        acc.speeds.length > 0
          ? Math.round(acc.speeds.reduce((a, b) => a + b, 0) / acc.speeds.length)
          : 0;

      // Real verdict determination based on real benchmark measurements
      let verdictTag = 'Genel Model';
      if (catScores.document_analysis >= 80 && catScores.document_analysis >= catScores.coding) {
        verdictTag = 'Döküman Analizi Şampiyonu';
      } else if (catScores.coding >= 80 && catScores.coding >= catScores.document_analysis) {
        verdictTag = 'Kodlama & Mühendislik Uzmanı';
      } else if (avgTokensPerSec >= 90) {
        verdictTag = 'Yüksek Hız & Akış Lideri';
      } else if (overallScore >= 75) {
        verdictTag = 'Dengeli Güçlü Model';
      } else {
        verdictTag = 'Hafif / Giriş Seviyesi';
      }

      // Dynamic real advice in Turkish
      let realWhereToUse = '';
      if (catScores.document_analysis >= 80) {
        realWhereToUse = `Gerçek testte Döküman Analizinde %${catScores.document_analysis} puan aldı. Şirket içi sözleşme analizi, RAG ve uzun metin filtrelemede güvenle kullanabilirsiniz.`;
      } else if (catScores.coding >= 80) {
        realWhereToUse = `Gerçek testte Kod Yazımında %${catScores.coding} puan aldı. Concurrency, tip güvenliği ve algoritma tasarımında oldukça yeteneklidir.`;
      } else {
        realWhereToUse = guide.whereToUse;
      }

      let realWhereNotToUse = '';
      if (avgLatencyMs > 4000) {
        realWhereNotToUse = `Ölçülen ortalama gecikme süresi ${avgLatencyMs}ms. Anlık canlı sohbet yerine arka plan asenkron analizlerde tercih edilmelidir.`;
      } else {
        realWhereNotToUse = guide.whereNotToUse;
      }

      finalProfiles[modelId] = {
        modelId,
        overallScore,
        categoryScores: catScores,
        avgLatencyMs,
        avgTokensPerSec,
        topCapability: verdictTag,
        verdictTag,
        detailedAdvice: guide.bestFor,
        whereToUse: realWhereToUse,
        whereNotToUse: realWhereNotToUse,
        testCount: testsToRun.length,
      };
    });

    setEvaluations(finalProfiles);
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              Gerçek API Benchmark
            </span>
            <span className="text-xs text-slate-400">· Yalnızca Sunucunuzdaki Modeller Test Edilir</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Gerçek Model Yetkinlik & Karşılaştırma Laboratuvarı
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Generic OpenAI API uç noktanızdaki modelleri tarayın. Sadece sunucunuzda var olan ve seçtiğiniz modeller gerçek istemlerle test edilir.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {scannedModels.length > 0 && (
            <button
              onClick={onTriggerScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              <Scan className={`w-3.5 h-3.5 text-emerald-400 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Taranıyor...' : 'Modelleri Yeniden Tara'}</span>
            </button>
          )}

          <button
            onClick={onOpenConfig}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span>API Ayarları</span>
          </button>

          <button
            onClick={onGoToModelGuide}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <Info className="w-3.5 h-3.5 text-blue-400" />
            <span>Model Rehberi</span>
          </button>
        </div>
      </div>

      {/* Model Scanning or Quick Setup if No Models Scanned */}
      {scannedModels.length === 0 ? (
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/90 shadow-xl space-y-6">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Generic OpenAI Bağlantısı & Modelleri Ara (/models)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Base URL ve API anahtarınızı girin. Sistem otomatik olarak var olan modelleri listeleyecektir.
                  </p>
                </div>
              </div>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
              Gerçek API Doğrulama
            </span>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              Hazır Sağlayıcı Şablonu:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
              {PRESET_PROVIDERS.slice(0, 7).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleQuickPresetSelect(p.id)}
                  className={`px-2.5 py-1.5 text-xs rounded-lg border text-left font-medium transition-all ${
                    quickBaseUrl === p.defaultBaseUrl
                      ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/40'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="truncate font-semibold">{p.name.split(' ')[0]}</div>
                  <div className="text-[10px] text-slate-500 truncate">{p.id === 'ollama' ? 'Yerel' : 'Bulut'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Base URL and API Key Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span>Base URL</span>
              </label>
              <input
                type="text"
                value={quickBaseUrl}
                onChange={(e) => setQuickBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                  <Key className="w-3.5 h-3.5 text-emerald-400" />
                  <span>1. API Anahtarı (Ana Hesap)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowKeyVisible(!showKeyVisible)}
                  className="text-slate-400 hover:text-white text-xs flex items-center gap-1"
                >
                  {showKeyVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showKeyVisible ? 'Gizle' : 'Göster'}</span>
                </button>
              </div>
              <input
                type={showKeyVisible ? 'text' : 'password'}
                value={quickApiKey}
                onChange={(e) => setQuickApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Backup Key (Multi-API Failover Support) */}
          <div className="border-t border-slate-800 pt-3">
            {!showQuickBackup ? (
              <button
                type="button"
                onClick={() => setShowQuickBackup(true)}
                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Yedek API Anahtarı Ekle (Hata durumunda otomatik failover)</span>
              </button>
            ) : (
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>2. Yedek API Anahtarı (Failover Havuzu)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickBackup(false)}
                    className="text-[11px] text-slate-400 hover:text-rose-400"
                  >
                    Kaldır
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showBackupKeyVisible ? 'text' : 'password'}
                    value={quickBackupKey}
                    onChange={(e) => setQuickBackupKey(e.target.value)}
                    placeholder="sk-backup-..."
                    className="w-full pr-16 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded text-xs font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowBackupKeyVisible(!showBackupKeyVisible)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-[11px]"
                  >
                    {showBackupKeyVisible ? 'Gizle' : 'Göster'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Birincil API rate-limit (429) veya bağlantı hatası verirse, sistem otomatik olarak bu yedek anahtara geçiş yapar.
                </p>
              </div>
            )}
          </div>

          {/* Scan Error Message if any */}
          {scanError && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs">
              <span className="font-semibold block mb-0.5">Tarama Hatası Oluştu:</span>
              <span className="font-mono text-[11px] break-all">{scanError}</span>
              <p className="mt-1 text-[11px] text-rose-400">
                Lütfen Base URL ve API anahtarınızın doğru olduğundan emin olun.
              </p>
            </div>
          )}

          {/* Trigger Scan Button */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              ✓ Yalnızca API&apos;de bulunan gerçek modeller taranır. Demo/sahte veri bulunmaz.
            </span>
            <button
              onClick={handleQuickSaveAndScan}
              disabled={isScanning || !quickBaseUrl.trim()}
              className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Scan className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Modeller Taranıyor...' : 'Modelleri Şimdi Ara (/models)'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Real Model Selection & Test Configuration */
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-5">
          {/* Active Connection Summary Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>API Bağlantısı Aktif</span>
              </div>
              <span className="text-slate-500">|</span>
              <span className="font-mono text-slate-300 truncate max-w-[280px]">
                {apiConfig.baseUrl}
              </span>
              <span className="text-slate-500">|</span>
              <span className="font-mono text-emerald-400 font-bold">
                {scannedModels.length} Gerçek Model
              </span>
            </div>

            <div className="flex items-center gap-2">
              {apiConfig.apiKeysPool && apiConfig.apiKeysPool.length > 1 && (
                <span className="font-mono text-[11px] text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded">
                  {apiConfig.apiKeysPool.filter((k) => k.isEnabled).length} API Havuzda (Failover Aktif)
                </span>
              )}
              <button
                onClick={onOpenConfig}
                className="text-xs text-slate-400 hover:text-white underline font-medium"
              >
                API&apos;yi Değiştir
              </button>
            </div>
          </div>

          {/* Step 1: Real Scanned Models Selection */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-[11px] font-mono">1</span>
                  <span>Sunucunuzda Tespit Edilen Modeller ({scannedModels.length} Model Bulundu)</span>
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Yalnızca API uç noktanızda mevcut olan modeller listelenir. Test etmek istediklerinizi işaretleyin (1-4 model).
                </p>
              </div>

              {/* Filter controls */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="flex items-center gap-1 p-0.5 bg-slate-950 border border-slate-800 rounded text-xs">
                  <button
                    onClick={() => setModelFilterType('chat')}
                    className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                      modelFilterType === 'chat' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Chat & Kod Modelleri
                  </button>
                  <button
                    onClick={() => setModelFilterType('all')}
                    className={`px-2.5 py-0.5 rounded font-medium transition-colors ${
                      modelFilterType === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tümü ({scannedModels.length})
                  </button>
                </div>

                {scannedModels.length > 5 && (
                  <div className="relative w-44">
                    <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Model ara..."
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      className="w-full pl-7 pr-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* REAL MODELS CHIPS GRID */}
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1 bg-slate-950/40 rounded-lg border border-slate-800/60 p-2">
              {filteredScannedModels.map((m) => {
                const isSelected = validSelectedModels.includes(m.id);

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleToggleModel(m.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all text-left ${
                      isSelected
                        ? 'bg-emerald-950/70 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500/50 shadow-sm font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                          : 'border-slate-600 bg-slate-900'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>{m.id}</span>
                  </button>
                );
              })}
            </div>

            <div className="text-[11px] text-slate-400 flex items-center gap-2 font-mono">
              <span>Seçilen Gerçek Modeller:</span>
              <span className="text-emerald-400 font-bold">
                {validSelectedModels.join(', ') || 'Hiçbiri (Lütfen yukarıdan seçin)'}
              </span>
            </div>
          </div>

          {/* Step 2: What is being tested (Clear Transparency of Benchmark Areas) */}
          <div className="pt-2 border-t border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center text-[11px] font-mono">2</span>
                <span>Test Edilecek Yetenekler ve Kapsam</span>
              </span>
              <span className="text-[11px] text-slate-400">
                Aşağıdaki alanlar model yanıtları üzerinden canlı olarak ölçülür:
              </span>
            </div>

            {/* Test Cards Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-950 border border-blue-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Döküman Analizi</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Kurumsal SLA sözleşmesi, çapraz şartlar, iğne arama, cezai şartlar.
                </p>
                <span className="inline-block mt-1 text-[9px] font-bold text-blue-300 bg-blue-950/80 px-1 py-0.5 rounded">
                  Öncelikli Konu
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-emerald-500/30 text-xs">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                  <Code2 className="w-3.5 h-3.5" />
                  <span>Kod Yazma</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  TypeScript ConcurrentTaskQueue, backoff, tip güvenliği & concurrency.
                </p>
                <span className="inline-block mt-1 text-[9px] font-bold text-emerald-300 bg-emerald-950/80 px-1 py-0.5 rounded">
                  Öncelikli Konu
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold mb-1">
                  <Brain className="w-3.5 h-3.5" />
                  <span>Mantık & Akıl</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  7000 istek sunucu kümesi optimizasyonu & maliyet çıkarımı.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-purple-400 font-bold mb-1">
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Sıkı JSON Şeması</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Markdown içermeyen saf JSON şema doğrulaması.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-yellow-400 font-bold mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Hız & Gecikme</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  TTFT (ilk token gecikmesi) ve token/sn üretim hızı.
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-rose-400 font-bold mb-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Türkçe Kalitesi</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-tight">
                  Doğal teknik çeviri, anlatım bozukluğu ve deyim analojisi.
                </p>
              </div>
            </div>

            {/* Scope Selection & Run Button */}
            <div className="pt-2 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-7 space-y-1">
                <label className="text-xs font-semibold text-slate-200 block">
                  Test Kapsamını Seçin:
                </label>
                <select
                  value={selectedScope}
                  onChange={(e) => setSelectedScope(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                >
                  <option value="all">★ Kapsamlı Tüm Benchmark Paketi (Döküman + Kod + Mantık + Hız + JSON + Dil)</option>
                  <option value="document_analysis">📄 Yalnızca Döküman Analizi & RAG Testi (Öncelikli)</option>
                  <option value="coding">💻 Yalnızca Kod Yazma & Concurrency Testi (Öncelikli)</option>
                  <option value="reasoning">🧠 Yalnızca Mantık & Muhakeme Testi</option>
                  <option value="speed">⚡ Yalnızca Hız & Çıkarım Gecikmesi</option>
                  <option value="json_instruction">📋 Yalnızca JSON & Şema Uyumu</option>
                  <option value="turkish_language">🇹🇷 Yalnızca Türkçe Dil Kalitesi</option>
                </select>
              </div>

              <div className="md:col-span-5 flex flex-col justify-end pt-3 md:pt-0">
                <button
                  onClick={handleRunBenchmark}
                  disabled={isRunning || validSelectedModels.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
                  <span>
                    {isRunning
                      ? `Test Ediliyor: ${currentModelName} (%${progressPercent})`
                      : `${validSelectedModels.length} Gerçek Modeli Test Et`}
                  </span>
                </button>
              </div>
            </div>

            {/* Failover Real-time Banner when multiple APIs failover */}
            {failoverNotification && (
              <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{failoverNotification}</span>
              </div>
            )}

            {/* Progress Bar when running */}
            {isRunning && (
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                  <span>
                    Aktif İstek: <span className="text-emerald-400 font-semibold">{currentTestName}</span>
                    {currentCandidateName && <span className="text-slate-500"> ({currentCandidateName})</span>}
                  </span>
                  <span>Model: <span className="text-white font-semibold">{currentModelName}</span> (%{progressPercent})</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Competency Scorecards (REAL RESULTS ONLY) */}
      {Object.keys(evaluations).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                <span>Gerçek Test Karnesi & Yetkinlik Raporu</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Modellerin API yanıtları doğrultusunda hangi alanda ne kadar iyi oldukları ve nasıl kullanılmaları gerektiği
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono bg-slate-900 px-3 py-1 rounded border border-slate-800">
              Gerçek API Çıktılarından Ölçüldü
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.values(evaluations).map((evalItem) => {
              const guide = findMatchingModelGuide(evalItem.modelId);

              return (
                <div
                  key={evalItem.modelId}
                  className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 shadow-lg"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-mono font-bold text-white truncate max-w-[260px]" title={evalItem.modelId}>
                          {evalItem.modelId}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          {evalItem.verdictTag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {guide.displayName} · {guide.contextWindow}
                      </p>
                    </div>

                    {/* Overall Score */}
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                        {evalItem.overallScore}<span className="text-xs text-slate-400 font-normal">/100</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Genel Başarı</div>
                    </div>
                  </div>

                  {/* Competency Bars: Document Analysis & Coding (PRIMARY TWO AREAS) */}
                  <div className="space-y-3">
                    {/* 1. Döküman Analizi */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-blue-400" />
                          <span>Döküman Analizi & RAG (Ana Konu)</span>
                        </span>
                        <span className="font-mono font-bold text-blue-400 tabular-nums">
                          %{evalItem.categoryScores.document_analysis}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full transition-all duration-500"
                          style={{ width: `${evalItem.categoryScores.document_analysis}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Kod Yazma */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Kod Yazma & Concurrency (Ana Konu)</span>
                        </span>
                        <span className="font-mono font-bold text-emerald-400 tabular-nums">
                          %{evalItem.categoryScores.coding}
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                          style={{ width: `${evalItem.categoryScores.coding}%` }}
                        />
                      </div>
                    </div>

                    {/* Secondary Measured Metrics */}
                    <div className="grid grid-cols-4 gap-2 pt-1 text-center">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Mantık</div>
                        <div className="text-xs font-mono font-bold text-white tabular-nums mt-0.5">
                          %{evalItem.categoryScores.reasoning}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">JSON/Şema</div>
                        <div className="text-xs font-mono font-bold text-purple-400 tabular-nums mt-0.5">
                          %{evalItem.categoryScores.json_instruction}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Gerçek Hız</div>
                        <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                          {evalItem.avgTokensPerSec > 0 ? `${evalItem.avgTokensPerSec} t/s` : '-'}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Gecikme</div>
                        <div className="text-xs font-mono font-bold text-slate-200 tabular-nums mt-0.5">
                          {evalItem.avgLatencyMs > 0 ? `${evalItem.avgLatencyMs} ms` : '-'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONABLE ADVICE: Where and How to Use */}
                  <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                      <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Nasıl ve Nerede Kullanmalısınız?</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {evalItem.whereToUse}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20">
                      <div className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Nerede Kullanmamalısınız?</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {evalItem.whereNotToUse}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono pt-1">
                      💡 <span className="text-slate-300">Önerilen İpucu:</span> {guide.recommendedParams.systemTip}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Real Test Logs & Prompts Accordion */}
      {detailedOutputs.length > 0 && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">
                Gerçek İstek Çıktıları & Ham Yanıtlar
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Modellerin API üzerinden ürettiği gerçek metinler, kriter puanlamaları ve gecikme detayları
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Toplam {detailedOutputs.length} Yanıt
            </span>
          </div>

          <div className="space-y-3">
            {detailedOutputs.map((item, idx) => {
              const itemId = `${item.modelId}_${item.testId}_${idx}`;
              const isExpanded = expandedOutputId === itemId;

              return (
                <div
                  key={itemId}
                  className={`rounded-lg border bg-slate-950 overflow-hidden ${
                    item.status === 'error' ? 'border-rose-500/40' : 'border-slate-800'
                  }`}
                >
                  <button
                    onClick={() => setExpandedOutputId(isExpanded ? null : itemId)}
                    className="w-full p-3.5 flex items-center justify-between text-left hover:bg-slate-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded">
                        {item.modelId}
                      </span>
                      <span className="text-xs font-medium text-slate-200">
                        {item.testName}
                      </span>
                      {item.usedKeyName && (
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {item.usedKeyName}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-xs font-bold ${
                          item.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.status === 'success' ? `Puan: %${item.score}` : 'HATA'}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {item.latencyMs}ms {item.tokPerSec ? `· ${item.tokPerSec} t/s` : ''}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="p-4 border-t border-slate-800 space-y-3 text-xs bg-slate-950/80">
                      <div className="p-2.5 rounded bg-slate-900 text-slate-300 font-mono text-[11px] leading-relaxed">
                        <span className="text-emerald-400 font-semibold block mb-0.5">Değerlendirme Analizi:</span>
                        {item.critique}
                      </div>

                      <div>
                        <span className="font-semibold text-slate-300 block mb-1">Modelin Ürettiği Gerçek Yanıt:</span>
                        <pre className="p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-slate-200 max-h-64 overflow-y-auto whitespace-pre-wrap text-[11px]">
                          {item.output}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
