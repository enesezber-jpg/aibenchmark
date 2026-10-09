import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  FileText,
  Code2,
  Zap,
  Star,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Sliders,
  DollarSign,
  Cpu,
} from 'lucide-react';
import { MODEL_GUIDE_DATABASE } from '../utils/benchmarkSuites';
import type { ModelItem } from '../types';

interface ModelGuideViewProps {
  scannedModels: ModelItem[];
  onSelectModelForBenchmark: (modelId: string) => void;
  onGoToBenchmark: () => void;
}

export const ModelGuideView: React.FC<ModelGuideViewProps> = ({
  scannedModels,
  onSelectModelForBenchmark,
  onGoToBenchmark,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'all' | 'doc' | 'code' | 'speed'>('all');

  const filteredGuides = useMemo(() => {
    return MODEL_GUIDE_DATABASE.filter((guide) => {
      const matchSearch =
        guide.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.idPattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.bestFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
        guide.provider.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (filterCategory === 'doc') return guide.documentRating >= 4;
      if (filterCategory === 'code') return guide.codingRating >= 4;
      if (filterCategory === 'speed') return guide.speedRating >= 4;

      return true;
    });
  }, [searchQuery, filterCategory]);

  const renderStars = (rating: number, color: string) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3 h-3 ${
              s <= rating ? `${color} fill-current` : 'text-slate-700'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
              Model Kullanım Kılavuzu
            </span>
            <span className="text-xs text-slate-400">· Hangi Model Nerede Kullanılır?</span>
          </div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            AI Model Seçim & Strateji Rehberi
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">
            Her yapay zeka modelinin güçlü/zayıf yönleri, döküman ve kodlama yetenekleri ile bütçenize göre nerede kullanmanız gerektiğinin detaylı analizi.
          </p>
        </div>

        <button
          onClick={onGoToBenchmark}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap self-start md:self-auto"
        >
          <span>Benchmark Laboratuvarına Git</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
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
            Tüm Modeller
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
            <span>Döküman Analizi Şampiyonları</span>
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
            <span>Kod Yazma Şampiyonları</span>
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
            <span>Hızlı & Ekonomik</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Model adı veya sağlayıcı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Models Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredGuides.map((guide) => (
          <div
            key={guide.idPattern}
            className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
          >
            <div>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">
                      {guide.displayName}
                    </h3>
                    <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                      {guide.provider}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>Bağlam: <span className="text-slate-200 font-mono">{guide.contextWindow}</span></span>
                    <span aria-hidden="true">·</span>
                    <span>Maliyet: <span className="text-slate-200 font-mono">{guide.costTier}</span></span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onSelectModelForBenchmark(guide.idPattern);
                    onGoToBenchmark();
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors whitespace-nowrap shadow-sm"
                >
                  Test Et
                </button>
              </div>

              {/* Rating Strip (Döküman & Kod) */}
              <div className="grid grid-cols-3 gap-2 py-3 border-b border-slate-800 text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                    <FileText className="w-3 h-3 text-blue-400" />
                    <span>Döküman</span>
                  </div>
                  {renderStars(guide.documentRating, 'text-blue-400')}
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                    <Code2 className="w-3 h-3 text-emerald-400" />
                    <span>Kodlama</span>
                  </div>
                  {renderStars(guide.codingRating, 'text-emerald-400')}
                </div>

                <div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Hız</span>
                  </div>
                  {renderStars(guide.speedRating, 'text-amber-400')}
                </div>
              </div>

              {/* Highlights & Best For */}
              <div className="py-2.5 space-y-2 text-xs">
                <div>
                  <span className="font-semibold text-slate-300 block mb-0.5">En Uygun Olduğu Görev:</span>
                  <p className="text-emerald-400 font-medium leading-relaxed">
                    {guide.bestFor}
                  </p>
                </div>

                {/* Where to use & Where not to use */}
                <div className="space-y-2 pt-1">
                  <div className="p-3 rounded-lg bg-emerald-950/25 border border-emerald-500/25">
                    <span className="font-semibold text-emerald-300 flex items-center gap-1.5 mb-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Nasıl ve Nerede Kullanılmalı?</span>
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {guide.whereToUse}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/20">
                    <span className="font-semibold text-rose-300 flex items-center gap-1.5 mb-1 text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Nerede Kullanılmamalı?</span>
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
              💡 <span className="text-slate-300">Önerilen Sıcaklık:</span> {guide.recommendedParams.temperature} · {guide.recommendedParams.systemTip}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
