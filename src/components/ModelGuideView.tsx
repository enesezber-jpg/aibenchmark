import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  FileText,
  Code2,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Sliders,
  DollarSign,
  Cpu,
  Scan,
  SlidersHorizontal,
  Check,
} from 'lucide-react';
import { findMatchingModelGuide, MODEL_GUIDE_DATABASE } from '../utils/benchmarkSuites';
import type { BenchmarkRecord, ModelItem } from '../types';

interface ModelGuideViewProps {
  scannedModels: ModelItem[];
  records: BenchmarkRecord[];
  onSelectModelForBenchmark: (modelId: string) => void;
  onGoToBenchmark: () => void;
  onTriggerScan: () => void;
  isScanning: boolean;
  onOpenConfig: () => void;
}

export const ModelGuideView: React.FC<ModelGuideViewProps> = ({
  scannedModels,
  records,
  onSelectModelForBenchmark,
  onGoToBenchmark,
  onTriggerScan,
  isScanning,
  onOpenConfig,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'doc' | 'code' | 'speed' | 'embedding' | 'audio'>('all');

  // Compute real benchmark stats per model from real test records and localStorage evaluations
  const realModelStats = useMemo(() => {
    let savedEvals: Record<string, any> = {};
    try {
      const raw = localStorage.getItem('openai_suite_evaluations');
      if (raw) savedEvals = JSON.parse(raw);
    } catch {}

    const map: Record<
      string,
      {
        docScore?: number;
        codeScore?: number;
        reasoningScore?: number;
        overallScore?: number;
        avgLatencyMs?: number;
        avgTokPerSec?: number;
        testCount: number;
        verdictTag?: string;
      }
    > = {};

    // Incorporate saved benchmark evaluations
    Object.entries(savedEvals).forEach(([modelId, profile]: [string, any]) => {
      map[modelId] = {
        docScore: profile.categoryScores?.document_analysis,
        codeScore: profile.categoryScores?.coding,
        reasoningScore: profile.categoryScores?.reasoning,
        overallScore: profile.overallScore,
        avgLatencyMs: profile.avgLatencyMs,
        avgTokPerSec: profile.avgTokensPerSec,
        testCount: 6,
        verdictTag: profile.verdictTag,
      };
    });

    // Also fold in individual test records
    records.forEach((r) => {
      if (!map[r.modelId]) {
        map[r.modelId] = { testCount: 0 };
      }
      map[r.modelId].testCount += 1;

      if (r.category === 'document_analysis' && r.categoryScore !== undefined) {
        map[r.modelId].docScore = r.categoryScore;
      }
      if (r.category === 'coding' && r.categoryScore !== undefined) {
        map[r.modelId].codeScore = r.categoryScore;
      }
      if (r.latencyMs && !map[r.modelId].avgLatencyMs) {
        map[r.modelId].avgLatencyMs = r.latencyMs;
      }
      if (r.tokensPerSecond && !map[r.modelId].avgTokPerSec) {
        map[r.modelId].avgTokPerSec = r.tokensPerSecond;
      }
    });

    return map;
  }, [records]);

  // Show ONLY user's real scanned models if available.
  const displayItems = useMemo(() => {
    if (scannedModels.length === 0) return [];

    return scannedModels.map((m) => {
      const guide = findMatchingModelGuide(m.id);
      const stats = realModelStats[m.id];
      return {
        modelId: m.id,
        displayName: m.id,
        detectedType: m.detectedType || 'general',
        ownedBy: m.owned_by || 'system',
        guide,
        stats,
        isScanned: true,
      };
    });
  }, [scannedModels, realModelStats]);

  const filteredItems = useMemo(() => {
    return displayItems.filter((item) => {
      const matchSearch =
        item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.guide.bestFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.guide.provider.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterCategory === 'doc') {
        return (
          (item.stats?.docScore !== undefined && item.stats.docScore >= 60) ||
          item.guide.bestFor.toLowerCase().includes('döküman') ||
          item.guide.bestFor.toLowerCase().includes('pdf') ||
          item.guide.bestFor.toLowerCase().includes('rag')
        );
      }
      if (filterCategory === 'code') {
        return (
          (item.stats?.codeScore !== undefined && item.stats.codeScore >= 60) ||
          item.guide.bestFor.toLowerCase().includes('kod') ||
          item.guide.bestFor.toLowerCase().includes('yazılım') ||
          item.guide.bestFor.toLowerCase().includes('mimari')
        );
      }
      if (filterCategory === 'speed') {
        return (
          (item.stats?.avgTokPerSec !== undefined && item.stats.avgTokPerSec >= 60) ||
          item.guide.costTier === 'Düşük' ||
          item.modelId.includes('mini') ||
          item.modelId.includes('flash') ||
          item.modelId.includes('turbo')
        );
      }
      if (filterCategory === 'embedding') {
        return item.detectedType === 'embedding' || item.modelId.includes('embed');
      }
      if (filterCategory === 'audio') {
        return item.detectedType === 'audio' || item.modelId.includes('whisper') || item.modelId.includes('tts');
      }

      return true;
    });
  }, [displayItems, searchQuery, filterCategory]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              Model Kullanım Kılavuzu
            </span>
            <span className="text-xs text-slate-400">
              {scannedModels.length > 0
                ? `· Sunucunuzdaki ${scannedModels.length} Gerçek Model Analizi`
                : '· Genel Model Referans Rehberi'}
            </span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            Modellerin Özellikleri ve Kullanım Alanları
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            API&apos;nizdeki modellerin hangi görevlerde iyi olduğunu (Döküman Analizi, Kod Yazma, Hız) öğrenin ve işinize en uygun modeli seçin.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          {scannedModels.length === 0 && (
            <button
              onClick={onTriggerScan}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shadow-sm disabled:opacity-50"
            >
              <Scan className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Modeller Taranıyor...' : 'Modelleri Tara (/models)'}</span>
            </button>
          )}

          <button
            onClick={onGoToBenchmark}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
          >
            <span>Benchmark Laboratuvarına Git</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg text-xs overflow-x-auto">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
              filterCategory === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tüm Modeller ({displayItems.length})
          </button>
          <button
            onClick={() => setFilterCategory('doc')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
              filterCategory === 'doc'
                ? 'bg-blue-950/70 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3 h-3 text-blue-400" />
            <span>Döküman Analizi İçin En İyiler</span>
          </button>
          <button
            onClick={() => setFilterCategory('code')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
              filterCategory === 'code'
                ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3 h-3 text-emerald-400" />
            <span>Kod Yazma İçin En İyiler</span>
          </button>
          <button
            onClick={() => setFilterCategory('speed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
              filterCategory === 'speed'
                ? 'bg-amber-950/70 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Hızlı & Hafif</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Model adı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Models Grid or Empty State */}
      {displayItems.length === 0 ? (
        <div className="p-8 rounded-xl border border-dashed border-slate-800 bg-slate-900/40 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 mx-auto">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Henüz API Modelleri Taranmadı</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Generic OpenAI API bilgilerinizi yapılandırıp modelleri taradıktan sonra, yalnızca sunucunuzda gerçekten bulunan modeller analiz edilecek ve özellikleri listelenecektir.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={onTriggerScan}
              disabled={isScanning}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <Scan className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Modeller Taranıyor...' : 'Modelleri Şimdi Tara (/models)'}</span>
            </button>

            <button
              onClick={onOpenConfig}
              className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>API Ayarlarını Aç</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
          const { modelId, guide, stats, isScanned } = item;

          return (
            <div
              key={modelId}
              className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold font-mono text-white truncate max-w-[260px]" title={modelId}>
                        {modelId}
                      </h3>
                      {isScanned && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          Aktif API
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                      <span>Bağlam: <span className="text-slate-200 font-mono">{guide.contextWindow}</span></span>
                      <span aria-hidden="true">·</span>
                      <span>Maliyet: <span className="text-slate-200 font-mono">{guide.costTier}</span></span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      onSelectModelForBenchmark(modelId);
                      onGoToBenchmark();
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors whitespace-nowrap shadow-sm"
                  >
                    Test Et
                  </button>
                </div>

                {/* Real Test Stats Badge if Tested */}
                {stats && stats.testCount > 0 ? (
                  <div className="my-2 p-3 rounded-lg bg-slate-950 border border-emerald-500/40 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>GERÇEK ÖLÇÜLEN PUANLAR ({stats.testCount} Test Yapıldı)</span>
                      </span>
                      {stats.verdictTag && (
                        <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-500/30">
                          {stats.verdictTag}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center pt-1 border-t border-slate-800/80">
                      <div className="p-1.5 rounded bg-slate-900/60">
                        <div className="text-[10px] text-slate-400">Döküman</div>
                        <div className="font-mono font-bold text-sm text-blue-400">
                          {stats.docScore !== undefined ? `%${stats.docScore}` : '-'}
                        </div>
                      </div>
                      <div className="p-1.5 rounded bg-slate-900/60">
                        <div className="text-[10px] text-slate-400">Kodlama</div>
                        <div className="font-mono font-bold text-sm text-emerald-400">
                          {stats.codeScore !== undefined ? `%${stats.codeScore}` : '-'}
                        </div>
                      </div>
                      <div className="p-1.5 rounded bg-slate-900/60">
                        <div className="text-[10px] text-slate-400">Genel Skor</div>
                        <div className="font-mono font-bold text-sm text-amber-300">
                          {stats.overallScore !== undefined ? `%${stats.overallScore}` : '-'}
                        </div>
                      </div>
                      <div className="p-1.5 rounded bg-slate-900/60">
                        <div className="text-[10px] text-slate-400">Ölçülen Hız</div>
                        <div className="font-mono font-bold text-xs text-white mt-0.5">
                          {stats.avgTokPerSec ? `${stats.avgTokPerSec} t/s` : (stats.avgLatencyMs ? `${stats.avgLatencyMs}ms` : '-')}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="my-2 p-3 rounded-lg bg-slate-950/90 border border-dashed border-slate-800 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-slate-300">
                          Henüz Test Edilmedi (Puan Bekleniyor)
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          onSelectModelForBenchmark(modelId);
                          onGoToBenchmark();
                        }}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold underline flex items-center gap-1"
                      >
                        <span>▶ Benchmark Yap & Puanla</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                      Sallama veya tahmini puan gösterilmez. Bu modelin gerçek döküman ve kodlama puanı API üzerinden Benchmark testi çalıştırıldığında ölçülür.
                    </p>
                  </div>
                )}

                {/* Highlights & Best For */}
                <div className="py-2.5 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-300 block mb-0.5">Hangi Özellikleri Var?</span>
                    <p className="text-emerald-400 font-medium leading-relaxed">
                      {guide.bestFor}
                    </p>
                  </div>

                  {/* Practical Guidance: Where to use & Where not to use */}
                  <div className="space-y-2 pt-1">
                    <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/25">
                      <span className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Nasıl ve Nerede Kullanmalısınız?</span>
                      </span>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {guide.whereToUse}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20">
                      <span className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Nerede Kullanmamalısınız?</span>
                      </span>
                      <p className="text-slate-300 text-[11px] leading-relaxed">
                        {guide.whereNotToUse}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Tip */}
              <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
                💡 <span className="text-slate-300">Önerilen Ayarlar:</span> Sıcaklık: {guide.recommendedParams.temperature} · {guide.recommendedParams.systemTip}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
