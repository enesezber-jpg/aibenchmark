import React from 'react';
import { SlidersHorizontal, ShieldCheck, Zap } from 'lucide-react';
import type { ApiConfig } from '../types';

export type NavigationTab = 'benchmark' | 'ping' | 'guide' | 'endpoints' | 'reports';

interface HeaderProps {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  apiConfig: ApiConfig;
  onOpenConfig: () => void;
  modelsCount: number;
  testCount: number;
  benchmarkRunningInfo?: {
    isRunning: boolean;
    progressPercent: number;
    testName: string;
    modelName: string;
  };
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  apiConfig,
  onOpenConfig,
  modelsCount,
  testCount,
  benchmarkRunningInfo,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Zap className="w-4 h-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            OpenAI Benchmark Suite
          </span>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('benchmark')}
            className={`whitespace-nowrap transition-colors py-1 ${
              activeTab === 'benchmark'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Benchmark Laboratuvarı
          </button>

          <button
            onClick={() => setActiveTab('ping')}
            className={`whitespace-nowrap transition-colors py-1 flex items-center gap-1.5 ${
              activeTab === 'ping'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Tüm modellerin anlık yanıt süreleri (ping) ve saatlik otomatik hız radarı"
          >
            <span>Hızlı Ping Radarı</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono font-semibold">
              ⚡ Hız
            </span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`whitespace-nowrap transition-colors py-1 ${
              activeTab === 'guide'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Model Rehberi
          </button>

          <button
            onClick={() => setActiveTab('endpoints')}
            className={`whitespace-nowrap transition-colors py-1 ${
              activeTab === 'endpoints'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            10 Uç Nokta Testi
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`whitespace-nowrap transition-colors py-1 ${
              activeTab === 'reports'
                ? 'text-emerald-400 border-b-2 border-emerald-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Grafik & Raporlama {testCount > 0 && <span className="ml-1 text-xs opacity-75 font-mono">({testCount})</span>}
          </button>
        </nav>

        {/* Zone 3: Primary Action / API Config Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          {benchmarkRunningInfo?.isRunning && (
            <button
              type="button"
              onClick={() => setActiveTab('benchmark')}
              className="flex items-center gap-2 px-2.5 py-1 text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 rounded-lg animate-pulse hover:bg-emerald-900/60 transition-colors shadow-sm"
              title={`Benchmark testi arka planda kesintisiz çalışıyor (%${benchmarkRunningInfo.progressPercent}). Tıklayarak laboratuvara dönün.`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="font-mono">Test Sürüyor (%{benchmarkRunningInfo.progressPercent})</span>
            </button>
          )}

          <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
            {apiConfig.apiKeysPool && apiConfig.apiKeysPool.length > 1 ? (
              <span className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {apiConfig.apiKeysPool.filter((k) => k.isEnabled).length} API Havuzda {apiConfig.enableFailover ? '(Yedekli)' : ''}
              </span>
            ) : (
              <span className="font-mono text-slate-300 truncate max-w-[140px]">
                {apiConfig.selectedProvider === 'custom' ? apiConfig.baseUrl.replace(/^https?:\/\//, '') : apiConfig.selectedProvider}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-1 text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              {apiConfig.useProxy ? 'Proxy' : 'Direkt'}
            </span>
          </div>

          <button
            onClick={onOpenConfig}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-300" />
            <span>API Havuzu ({apiConfig.apiKeysPool?.length || 1})</span>
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-800/80 bg-slate-950 px-2 py-2 text-xs">
        <button
          onClick={() => setActiveTab('benchmark')}
          className={`px-2 py-1 rounded ${activeTab === 'benchmark' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Benchmark
        </button>
        <button
          onClick={() => setActiveTab('guide')}
          className={`px-2 py-1 rounded ${activeTab === 'guide' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Rehber
        </button>
        <button
          onClick={() => setActiveTab('endpoints')}
          className={`px-2 py-1 rounded ${activeTab === 'endpoints' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Endpointler
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-2 py-1 rounded ${activeTab === 'reports' ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}
        >
          Raporlar
        </button>
      </div>
    </header>
  );
};
