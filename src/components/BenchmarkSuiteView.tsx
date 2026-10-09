import React, { useState } from 'react';
import {
  Play,
  RotateCcw,
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
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type {
  ApiConfig,
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
import { executeEndpointTest } from '../services/apiService';

interface BenchmarkSuiteViewProps {
  apiConfig: ApiConfig;
  scannedModels: ModelItem[];
  selectedModelIds: string[];
  onBenchmarkCompleted: (record: BenchmarkRecord) => void;
  onGoToModelGuide: () => void;
}

export const BenchmarkSuiteView: React.FC<BenchmarkSuiteViewProps> = ({
  apiConfig,
  scannedModels,
  selectedModelIds,
  onBenchmarkCompleted,
  onGoToModelGuide,
}) => {
  // Models to benchmark
  const [modelList, setModelList] = useState<string[]>(
    selectedModelIds.length > 0 ? selectedModelIds.slice(0, 3) : ['gpt-4o-mini', 'gpt-4o']
  );
  const [newModelInput, setNewModelInput] = useState('');

  // Selected test scope: 'all' (All 6 comprehensive tests) or specific category
  const [selectedScope, setSelectedScope] = useState<string>('all');

  // Benchmark execution state
  const [isRunning, setIsRunning] = useState(false);
  const [currentTestName, setCurrentTestName] = useState('');
  const [currentModelName, setCurrentModelName] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);

  // Model evaluations mapped by modelId
  const [evaluations, setEvaluations] = useState<Record<string, ModelEvaluationProfile>>({});
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
      critique: string;
    }>
  >([]);

  const [expandedOutputId, setExpandedOutputId] = useState<string | null>(null);

  const handleAddModel = (id: string) => {
    const clean = id.trim();
    if (!clean || modelList.includes(clean)) return;
    if (modelList.length >= 4) {
      alert('Aynı anda en fazla 4 modeli benchmark testine alabilirsiniz.');
      return;
    }
    setModelList([...modelList, clean]);
    setNewModelInput('');
  };

  const handleRemoveModel = (idToRemove: string) => {
    if (modelList.length <= 1) {
      alert('En az 1 model seçili olmalıdır.');
      return;
    }
    setModelList(modelList.filter((m) => m !== idToRemove));
  };

  // Run Benchmark Engine
  const handleRunBenchmark = async () => {
    if (modelList.length === 0) return;

    setIsRunning(true);
    setProgressPercent(0);
    setDetailedOutputs([]);

    // Determine tests to run
    const testsToRun: BenchmarkTestDefinition[] =
      selectedScope === 'all'
        ? BENCHMARK_TESTS
        : BENCHMARK_TESTS.filter((t) => t.category === selectedScope);

    const totalSteps = modelList.length * testsToRun.length;
    let completedSteps = 0;

    const tempOutputs: typeof detailedOutputs = [];
    const modelScoresAccumulator: Record<
      string,
      {
        categoryScores: Record<BenchmarkCategory, { total: number; count: number }>;
        latencies: number[];
        speeds: number[];
      }
    > = {};

    modelList.forEach((m) => {
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
      };
    });

    for (const test of testsToRun) {
      setCurrentTestName(test.name);

      for (const modelId of modelList) {
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
          const record = await executeEndpointTest(
            apiConfig,
            '/chat/completions',
            payload,
            { modelId }
          );

          onBenchmarkCompleted({
            ...record,
            category: test.category,
          });

          const rawOutput =
            record.responsePayload?.choices?.[0]?.message?.content ||
            record.outputPreview ||
            '';

          const evaluation = evaluateTestOutput(
            test,
            rawOutput,
            record.latencyMs,
            record.tokensPerSecond
          );

          tempOutputs.push({
            modelId,
            testId: test.id,
            testName: test.name,
            category: test.category,
            output: rawOutput,
            score: evaluation.score,
            latencyMs: record.latencyMs,
            tokPerSec: record.tokensPerSecond,
            critique: evaluation.critique,
          });

          // Accumulate scores
          const acc = modelScoresAccumulator[modelId];
          if (acc) {
            acc.categoryScores[test.category].total += evaluation.score;
            acc.categoryScores[test.category].count += 1;
            acc.latencies.push(record.latencyMs);
            if (record.tokensPerSecond) acc.speeds.push(record.tokensPerSecond);
          }
        } catch (err: any) {
          console.error(err);
        }

        completedSteps++;
        setProgressPercent(Math.round((completedSteps / totalSteps) * 100));
      }
    }

    setDetailedOutputs(tempOutputs);

    // Compute final profiles
    const finalProfiles: Record<string, ModelEvaluationProfile> = {};

    modelList.forEach((modelId) => {
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
        const val = item.count > 0 ? Math.round(item.total / item.count) : guide ? guide.codingRating * 18 : 70;
        catScores[cat] = val;
        overallSum += val;
        overallCount++;
      });

      const overallScore = Math.round(overallSum / overallCount);
      const avgLatencyMs =
        acc.latencies.length > 0
          ? Math.round(acc.latencies.reduce((a, b) => a + b, 0) / acc.latencies.length)
          : 500;
      const avgTokensPerSec =
        acc.speeds.length > 0
          ? Math.round(acc.speeds.reduce((a, b) => a + b, 0) / acc.speeds.length)
          : 60;

      // Determine top capability tag and where to use
      let verdictTag = 'Dengeli Genel Model';
      if (catScores.document_analysis >= 85 && catScores.document_analysis >= catScores.coding) {
        verdictTag = 'Döküman Analizi Şampiyonu';
      } else if (catScores.coding >= 85 && catScores.coding >= catScores.document_analysis) {
        verdictTag = 'Kodlama & Mühendislik Uzmanı';
      } else if (avgTokensPerSec >= 90) {
        verdictTag = 'Yüksek Hız & Akış Lideri';
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
        whereToUse: guide.whereToUse,
        whereNotToUse: guide.whereNotToUse,
        testCount: testsToRun.length,
      };
    });

    setEvaluations(finalProfiles);
    setIsRunning(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Simplified & Focused */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              Kapsamlı AI Benchmark
            </span>
            <span className="text-xs text-slate-400">· Döküman Analizi & Kodlama Odaklı</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Model Yetkinlik & Karşılaştırmalı Test Laboratuvarı
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Modellerin hangi görevde ne kadar başarılı olduğunu (Döküman, Kod, Mantık, Hız) bilimsel kriterlerle ölçün ve nerede kullanmanız gerektiğini hemen öğrenin.
          </p>
        </div>

        <button
          onClick={onGoToModelGuide}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap self-start md:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-emerald-400" />
          <span>Model Kullanım Rehberi</span>
        </button>
      </div>

      {/* 2-Step Configuration Bar (Simplified) */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Step 1: Model Selection (7 cols) */}
          <div className="md:col-span-7 space-y-2">
            <label className="flex items-center justify-between text-xs font-semibold text-slate-200">
              <span>1. Test Edilecek Modeller</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {modelList.length} model seçili (en fazla 4)
              </span>
            </label>

            <div className="flex flex-wrap items-center gap-2">
              {modelList.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono font-medium text-slate-200"
                >
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{m}</span>
                  {modelList.length > 1 && (
                    <button
                      onClick={() => handleRemoveModel(m)}
                      className="ml-1 text-slate-500 hover:text-rose-400 text-xs"
                      title="Kaldır"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}

              {modelList.length < 4 && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Model ID yazın..."
                    value={newModelInput}
                    onChange={(e) => setNewModelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddModel(newModelInput);
                    }}
                    className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 w-36 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  {scannedModels.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleAddModel(e.target.value);
                      }}
                      className="px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">+ Tarananlardan Seç...</option>
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

          {/* Step 2: Test Scope Selector (5 cols) */}
          <div className="md:col-span-5 space-y-2">
            <label className="block text-xs font-semibold text-slate-200">
              2. Test Kapsamı & Kategori
            </label>
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
            >
              <option value="all">★ Kapsamlı Tüm Test Paketi (Döküman + Kod + Mantık + Hız)</option>
              <option value="document_analysis">📄 Yalnızca Döküman Analizi & RAG Testi</option>
              <option value="coding">💻 Yalnızca Kod Yazma & Concurrency Testi</option>
              <option value="reasoning">🧠 Yalnızca Mantık & Muhakeme Testi</option>
              <option value="speed">⚡ Yalnızca Hız & Çıkarım Gecikmesi</option>
              <option value="json_instruction">📋 Yalnızca JSON & Şema Uyumu</option>
              <option value="turkish_language">🇹🇷 Yalnızca Türkçe Dil & Çeviri Kalitesi</option>
            </select>
          </div>
        </div>

        {/* Big Action Button */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Otomatik Failover aktif: Herhangi bir API hata verirse yedek API denenir.</span>
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunning || modelList.length === 0}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50 whitespace-nowrap"
          >
            <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-pulse' : ''}`} />
            <span>
              {isRunning
                ? `Test Ediliyor: ${currentModelName} (${progressPercent}%)`
                : 'Kapsamlı Benchmark Testini Başlat'}
            </span>
          </button>
        </div>

        {/* Progress Bar when running */}
        {isRunning && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <span>Şu anki test: <span className="text-emerald-400 font-semibold">{currentTestName}</span></span>
              <span>%{progressPercent} Tamamlandı</span>
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

      {/* Model Competency Scorecards (The Core User Need) */}
      {Object.keys(evaluations).length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-400" />
              <span>Model Yetkinlik Karnesi & Kullanım Rehberi</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              Ölçülen Performans ve Doğruluk Puanları
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.values(evaluations).map((evalItem) => {
              const guide = findMatchingModelGuide(evalItem.modelId);

              return (
                <div
                  key={evalItem.modelId}
                  className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-mono font-bold text-white">
                          {evalItem.modelId}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
                          {evalItem.verdictTag}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{guide.displayName} · {guide.contextWindow}</p>
                    </div>

                    {/* Overall Score Circle */}
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-emerald-400 tabular-nums">
                        {evalItem.overallScore}<span className="text-xs text-slate-400 font-normal">/100</span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">Genel Puan</div>
                    </div>
                  </div>

                  {/* Competency Bars: Document Analysis & Coding in the spotlight */}
                  <div className="space-y-2.5">
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

                    {/* Secondary Metrics Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Mantık/Akıl</div>
                        <div className="text-xs font-mono font-bold text-white tabular-nums mt-0.5">
                          %{evalItem.categoryScores.reasoning}
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Ort. Hız</div>
                        <div className="text-xs font-mono font-bold text-emerald-400 tabular-nums mt-0.5">
                          {evalItem.avgTokensPerSec} t/s
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-[10px] text-slate-400">Gecikme</div>
                        <div className="text-xs font-mono font-bold text-slate-200 tabular-nums mt-0.5">
                          {evalItem.avgLatencyMs} ms
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ACTIONABLE ADVICE: Where and How to Use */}
                  <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
                    <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30">
                      <div className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Nerede ve Nasıl Kullanılmalı?</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {evalItem.whereToUse}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20">
                      <div className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Nerede Kullanılmamalı? (Kaçınılması Gereken Durumlar)</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-[11px]">
                        {evalItem.whereNotToUse}
                      </p>
                    </div>

                    <div className="text-[11px] text-slate-400 font-mono pt-1">
                      💡 <span className="text-slate-300">İpucu:</span> {guide.recommendedParams.systemTip}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Test Run Logs & Prompts Accordion */}
      {detailedOutputs.length > 0 && (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white">
              Çalıştırılan Testler & Yanıt Analizleri
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Modellerin test istemlerine verdiği gerçek yanıtları ve kriter puanlamalarını inceleyin.
            </p>
          </div>

          <div className="space-y-3">
            {detailedOutputs.map((item, idx) => {
              const itemId = `${item.modelId}_${item.testId}_${idx}`;
              const isExpanded = expandedOutputId === itemId;

              return (
                <div
                  key={itemId}
                  className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden"
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
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-emerald-400">
                        Puan: %{item.score}
                      </span>
                      <span className="font-mono text-xs text-slate-400">
                        {item.latencyMs}ms
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
                        <span className="text-emerald-400 font-semibold block mb-0.5">Analist Değerlendirmesi:</span>
                        {item.critique}
                      </div>

                      <div>
                        <span className="font-semibold text-slate-300 block mb-1">Modelin Ürettiği Çıktı:</span>
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
