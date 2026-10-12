import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Zap,
  Activity,
  Clock,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Send,
  Timer,
  SlidersHorizontal,
  Flame,
  ArrowDownUp,
  Search,
  Check,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react';
import type { ApiConfig, ModelItem, BenchmarkRecord } from '../types';
import { executeEndpointTest } from '../services/apiService';

export interface PingResultItem {
  modelId: string;
  latencyMs: number;
  ttftMs?: number;
  tokensPerSecond?: number;
  status: 'success' | 'error';
  replyPreview: string;
  timestamp: number;
  errorMessage?: string;
  httpStatus?: number;
  failoverKey?: string;
  diffFromPreviousMs?: number; // difference from previous test
}

interface SpeedRadarViewProps {
  apiConfig: ApiConfig;
  scannedModels: ModelItem[];
  onTriggerScan?: () => void;
  isScanning?: boolean;
  onOpenConfig: () => void;
  onBenchmarkRecordCreated?: (record: BenchmarkRecord) => void;
}

export const SpeedRadarView: React.FC<SpeedRadarViewProps> = ({
  apiConfig,
  scannedModels,
  onTriggerScan,
  isScanning = false,
  onOpenConfig,
  onBenchmarkRecordCreated,
}) => {
  // Test prompt - simple greeting like user requested ("sadece chatten selam yazdığın")
  const [pingPrompt, setPingPrompt] = useState<string>('Selam');
  
  // Stored Ping Results mapped by modelId
  const [pingResults, setPingResults] = useState<Record<string, PingResultItem>>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_speed_radar_results');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  // Last run timestamp
  const [lastRunTimestamp, setLastRunTimestamp] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_speed_radar_last_run');
      if (saved) return Number(saved);
    } catch {}
    return null;
  });

  // Auto-ping interval in minutes (default 60 min as requested: "saatte bir arka planda test etsin")
  const [autoIntervalMinutes, setAutoIntervalMinutes] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_speed_radar_interval');
      if (saved) return Number(saved);
    } catch {}
    return 60; // 60 minutes default
  });

  // Next run countdown in seconds
  const [secondsUntilNextAuto, setSecondsUntilNextAuto] = useState<number>(() => {
    return autoIntervalMinutes * 60;
  });

  // Execution states
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runningModelId, setRunningModelId] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [modelSearch, setModelSearch] = useState('');
  const [onlyChatModels, setOnlyChatModels] = useState(true);
  const [sortBy, setSortBy] = useState<'speed' | 'name' | 'time'>('speed');

  // Cancel ref for ongoing batch
  const cancelBatchRef = useRef(false);

  // Sync results to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_speed_radar_results', JSON.stringify(pingResults));
    } catch {}
  }, [pingResults]);

  // Sync last run timestamp
  useEffect(() => {
    if (lastRunTimestamp) {
      try {
        localStorage.setItem('openai_suite_speed_radar_last_run', String(lastRunTimestamp));
      } catch {}
    }
  }, [lastRunTimestamp]);

  // Sync interval
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_speed_radar_interval', String(autoIntervalMinutes));
    } catch {}
  }, [autoIntervalMinutes]);

  // Filter models to ping
  const targetModels = useMemo(() => {
    let list = scannedModels;
    if (onlyChatModels) {
      list = list.filter((m) => m.detectedType === 'chat' || m.detectedType === 'general');
      // If no chat models identified, fallback to all scanned
      if (list.length === 0) list = scannedModels;
    }
    return list;
  }, [scannedModels, onlyChatModels]);

  const filteredDisplayModels = useMemo(() => {
    let list = targetModels;
    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase();
      list = list.filter((m) => m.id.toLowerCase().includes(q));
    }

    return [...list].sort((a, b) => {
      const resA = pingResults[a.id];
      const resB = pingResults[b.id];

      if (sortBy === 'speed') {
        if (!resA && !resB) return 0;
        if (!resA) return 1;
        if (!resB) return -1;
        if (resA.status === 'error' && resB.status !== 'error') return 1;
        if (resB.status === 'error' && resA.status !== 'error') return -1;
        return resA.latencyMs - resB.latencyMs;
      }
      if (sortBy === 'time') {
        const timeA = resA?.timestamp || 0;
        const timeB = resB?.timestamp || 0;
        return timeB - timeA;
      }
      return a.id.localeCompare(b.id);
    });
  }, [targetModels, modelSearch, sortBy, pingResults]);

  // Single Model Ping Runner
  const runSinglePing = useCallback(
    async (modelId: string, currentPrompt: string): Promise<PingResultItem> => {
      const startTime = performance.now();
      const payload = {
        model: modelId,
        messages: [{ role: 'user', content: currentPrompt }],
        temperature: 0.2,
        max_tokens: 40,
        stream: true, // Use stream to accurately measure Time to First Token (TTFT)
      };

      try {
        const record = await executeEndpointTest(apiConfig, '/chat/completions', payload, {
          modelId,
        });

        if (onBenchmarkRecordCreated) {
          onBenchmarkRecordCreated(record);
        }

        const prev = pingResults[modelId];
        const diff = prev && prev.status === 'success' ? record.latencyMs - prev.latencyMs : undefined;

        const item: PingResultItem = {
          modelId,
          latencyMs: record.latencyMs,
          ttftMs: record.ttftMs,
          tokensPerSecond: record.tokensPerSecond,
          status: record.status,
          replyPreview: record.outputPreview || (record.status === 'success' ? 'Yanıt alındı' : 'Hata'),
          timestamp: Date.now(),
          errorMessage: record.errorMessage,
          httpStatus: record.httpStatus,
          failoverKey: record.successfulKeyName,
          diffFromPreviousMs: diff,
        };

        setPingResults((prevMap) => ({
          ...prevMap,
          [modelId]: item,
        }));

        return item;
      } catch (err: any) {
        const latencyMs = Math.round(performance.now() - startTime);
        const item: PingResultItem = {
          modelId,
          latencyMs,
          status: 'error',
          replyPreview: '',
          timestamp: Date.now(),
          errorMessage: err.message || 'Bağlantı hatası',
        };

        setPingResults((prevMap) => ({
          ...prevMap,
          [modelId]: item,
        }));

        return item;
      }
    },
    [apiConfig, pingResults, onBenchmarkRecordCreated]
  );

  // Batch Ping Runner across all target models
  const runAllPings = useCallback(
    async (modelsToRun?: ModelItem[]) => {
      const list = modelsToRun || targetModels;
      if (list.length === 0) return;

      setIsRunningAll(true);
      cancelBatchRef.current = false;
      setCurrentProgress({ current: 0, total: list.length });

      for (let i = 0; i < list.length; i++) {
        if (cancelBatchRef.current) break;

        const m = list[i];
        setRunningModelId(m.id);
        setCurrentProgress({ current: i + 1, total: list.length });

        await runSinglePing(m.id, pingPrompt);
        // Small 150ms breathe between requests to prevent aggressive rate limits
        await new Promise((r) => setTimeout(r, 150));
      }

      setRunningModelId(null);
      setIsRunningAll(false);
      setLastRunTimestamp(Date.now());
      setSecondsUntilNextAuto(autoIntervalMinutes * 60);
    },
    [targetModels, runSinglePing, pingPrompt, autoIntervalMinutes]
  );

  // Handle single test trigger
  const handleTestSingle = async (modelId: string) => {
    if (isRunningAll || runningModelId) return;
    setRunningModelId(modelId);
    try {
      await runSinglePing(modelId, pingPrompt);
      setLastRunTimestamp(Date.now());
    } finally {
      setRunningModelId(null);
    }
  };

  // Background Periodic Auto-Ping Countdown & Trigger
  useEffect(() => {
    if (autoIntervalMinutes <= 0) return; // disabled

    const timer = setInterval(() => {
      setSecondsUntilNextAuto((prev) => {
        if (prev <= 1) {
          // Trigger periodic ping if not currently busy and we have models
          if (!isRunningAll && !runningModelId && targetModels.length > 0) {
            runAllPings();
          }
          return autoIntervalMinutes * 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoIntervalMinutes, isRunningAll, runningModelId, targetModels.length, runAllPings]);

  // Fastest model calculation
  const fastestModel = useMemo(() => {
    const successful = Object.values(pingResults).filter((r) => r.status === 'success');
    if (successful.length === 0) return null;
    return [...successful].sort((a, b) => a.latencyMs - b.latencyMs)[0];
  }, [pingResults]);

  // Average response time
  const averageLatency = useMemo(() => {
    const successful = Object.values(pingResults).filter((r) => r.status === 'success');
    if (successful.length === 0) return 0;
    const sum = successful.reduce((acc, curr) => acc + curr.latencyMs, 0);
    return Math.round(sum / successful.length);
  }, [pingResults]);

  // Helper format seconds into MM:SS
  const formatCountdown = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Time elapsed since last run text
  const formatTimeAgo = (ts: number | null) => {
    if (!ts) return 'Henüz test yapılmadı';
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return `${diffSec} saniye önce`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} dakika önce`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour} saat önce`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Hero / Quick Ping Header Card */}
      <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                <span>Hızlı Yanıt & Hız Radarı</span>
              </span>
              <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                <span>Son Test: {formatTimeAgo(lastRunTimestamp)}</span>
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <span>Model Yanıt Süresi & Anlık Hız Radarı</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
              Basit bir selamlama mesajı ile API'deki tüm modellerin yanıt sürelerini (gecikme / ping) ve token hızlarını saniyeler içinde ölçün. Arka planda saatte bir otomatik test ederek her an en hızlı modeli güncel takip edin.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
            {/* Fastest Model Card */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-emerald-500/30 shadow-sm flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>En Hızlı Model</span>
              </span>
              <div className="mt-1">
                <div className="text-base font-bold font-mono text-emerald-300 truncate max-w-[130px]" title={fastestModel?.modelId || '-'}>
                  {fastestModel ? fastestModel.modelId : '-'}
                </div>
                <div className="text-[11px] text-emerald-400/80 font-mono mt-0.5">
                  {fastestModel ? `${fastestModel.latencyMs} ms` : 'Veri yok'}
                </div>
              </div>
            </div>

            {/* Average Latency */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-blue-400" />
                <span>Ortalama Hız</span>
              </span>
              <div className="mt-1">
                <div className="text-base font-bold font-mono text-white">
                  {averageLatency > 0 ? `${averageLatency} ms` : '-'}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {Object.keys(pingResults).length} model ölçüldü
                </div>
              </div>
            </div>

            {/* Auto Schedule Indicator */}
            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Oto Radar</span>
              </span>
              <div className="mt-1">
                <div className="text-xs font-bold text-slate-200">
                  {autoIntervalMinutes > 0 ? `${autoIntervalMinutes} dk'da bir` : 'Kapalı'}
                </div>
                <div className="text-[11px] font-mono text-purple-300 mt-0.5">
                  {autoIntervalMinutes > 0 ? `Sıradaki: ${formatCountdown(secondsUntilNextAuto)}` : 'Manuel mod'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action & Prompt Bar */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Simple Prompt Input */}
          <div className="flex-1 flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-emerald-500/60 transition-colors">
            <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
            <input
              type="text"
              value={pingPrompt}
              onChange={(e) => setPingPrompt(e.target.value)}
              placeholder="Test mesajı (ör: Selam)"
              className="bg-transparent text-xs sm:text-sm text-slate-200 placeholder-slate-500 w-full focus:outline-none"
            />
            {pingPrompt !== 'Selam' && (
              <button
                type="button"
                onClick={() => setPingPrompt('Selam')}
                className="text-[11px] text-slate-500 hover:text-slate-300 underline shrink-0"
              >
                "Selam" yap
              </button>
            )}
          </div>

          {/* Test Buttons & Interval Control */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Auto-test interval select */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-400">Oto Test:</span>
              <select
                value={autoIntervalMinutes}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAutoIntervalMinutes(val);
                  setSecondsUntilNextAuto(val * 60);
                }}
                className="bg-transparent text-emerald-300 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value={60} className="bg-slate-900 text-slate-200">Saatte 1 (60 dk)</option>
                <option value={30} className="bg-slate-900 text-slate-200">30 dk'da bir</option>
                <option value={15} className="bg-slate-900 text-slate-200">15 dk'da bir</option>
                <option value={5} className="bg-slate-900 text-slate-200">5 dk'da bir</option>
                <option value={0} className="bg-slate-900 text-slate-200">Kapalı (Manuel)</option>
              </select>
            </div>

            {/* Run All Pings button */}
            <button
              type="button"
              onClick={() => runAllPings()}
              disabled={isRunningAll || targetModels.length === 0}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all shadow-md ${
                isRunningAll
                  ? 'bg-amber-600/80 text-white cursor-wait'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold active:scale-[0.98]'
              } disabled:opacity-50`}
            >
              {isRunningAll ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    Test Ediliyor ({currentProgress.current}/{currentProgress.total})
                  </span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Tüm Modelleri Şimdi Test Et ⚡</span>
                </>
              )}
            </button>

            {isRunningAll && (
              <button
                type="button"
                onClick={() => {
                  cancelBatchRef.current = true;
                  setIsRunningAll(false);
                }}
                className="px-3 py-2 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Durdur
              </button>
            )}
          </div>
        </div>

        {/* Live Running Status Banner */}
        {isRunningAll && runningModelId && (
          <div className="mt-4 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-2 text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Ping gönderiliyor:</span>
              <span className="font-mono font-bold text-white">{runningModelId}</span>
              <span className="text-slate-400 font-mono">("{pingPrompt}")</span>
            </div>
            <div className="font-mono text-emerald-400 font-semibold">
              %{Math.round((currentProgress.current / currentProgress.total) * 100)}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              placeholder="Model ara..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Chat only filter */}
          <button
            type="button"
            onClick={() => setOnlyChatModels(!onlyChatModels)}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              onlyChatModels
                ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Sadece Chat / Sohbet Modelleri</span>
            {onlyChatModels && <Check className="w-3 h-3" />}
          </button>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-400">
          <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
          <span>Sırala:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500"
          >
            <option value="speed">En Hızlıdan En Yavaşa (Gecikme ms)</option>
            <option value="time">En Son Test Edilen</option>
            <option value="name">Model Adı (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Models Grid & Speed Cards */}
      {targetModels.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-200">Henüz Taranmış Model Bulunamadı</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              API uç noktanızdaki modelleri tarayarak hız testi ve anlık ping radarına dahil edebilirsiniz.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            {onTriggerScan && (
              <button
                type="button"
                onClick={onTriggerScan}
                disabled={isScanning}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-xs transition-colors flex items-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                <span>Modelleri Tara (/models)</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenConfig}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition-colors"
            >
              API Ayarları
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDisplayModels.map((model, idx) => {
            const result = pingResults[model.id];
            const isCurrentlyRunning = runningModelId === model.id;
            const isFastest = fastestModel?.modelId === model.id && result?.status === 'success';

            // Latency color code
            let badgeBg = 'bg-slate-800 text-slate-300 border-slate-700';
            if (result && result.status === 'success') {
              if (result.latencyMs < 400) {
                badgeBg = 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';
              } else if (result.latencyMs < 900) {
                badgeBg = 'bg-blue-950/80 text-blue-300 border-blue-500/50';
              } else if (result.latencyMs < 1800) {
                badgeBg = 'bg-amber-950/80 text-amber-300 border-amber-500/50';
              } else {
                badgeBg = 'bg-rose-950/80 text-rose-300 border-rose-500/50';
              }
            } else if (result && result.status === 'error') {
              badgeBg = 'bg-rose-950 text-rose-300 border-rose-500/50';
            }

            return (
              <div
                key={model.id}
                className={`p-4 rounded-xl bg-slate-900 border transition-all duration-200 flex flex-col justify-between relative ${
                  isFastest
                    ? 'border-emerald-500/60 ring-1 ring-emerald-500/30 bg-gradient-to-b from-slate-900 to-emerald-950/20'
                    : isCurrentlyRunning
                    ? 'border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header row: Model Name and Fastest Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold font-mono text-slate-100 truncate" title={model.id}>
                          {model.id}
                        </span>
                        {model.detectedType && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {model.detectedType}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                        Sağlayıcı: {model.owned_by || 'openai / custom'}
                      </div>
                    </div>

                    {isFastest && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>1. EN HIZLI</span>
                      </span>
                    )}
                  </div>

                  {/* Latency and Speed Metrics Display */}
                  <div className="my-3 p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Yanıt Süresi (Ping):</span>
                      {isCurrentlyRunning ? (
                        <span className="text-xs font-mono text-amber-400 flex items-center gap-1 animate-pulse">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Ölçülüyor...</span>
                        </span>
                      ) : result ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${badgeBg}`}>
                            {result.status === 'success' ? `${result.latencyMs} ms` : 'Hata'}
                          </span>
                          {result.diffFromPreviousMs !== undefined && (
                            <span
                              className={`text-[10px] font-mono ${
                                result.diffFromPreviousMs <= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                              title="Önceki teste göre değişim"
                            >
                              {result.diffFromPreviousMs > 0 ? `+${result.diffFromPreviousMs}ms` : `${result.diffFromPreviousMs}ms`}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-500 font-mono">Test edilmedi</span>
                      )}
                    </div>

                    {/* Secondary Metrics: TTFT and Speed */}
                    {result && result.status === 'success' && (
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-900 text-[11px]">
                        <div>
                          <span className="text-slate-500 block">İlk Token (TTFT):</span>
                          <span className="font-mono text-slate-300 font-semibold">
                            {result.ttftMs ? `${result.ttftMs} ms` : '-'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Üretim Hızı:</span>
                          <span className="font-mono text-emerald-400 font-semibold">
                            {result.tokensPerSecond ? `${result.tokensPerSecond} tok/s` : '-'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Response Preview */}
                    {result && (
                      <div className="pt-1.5 border-t border-slate-900">
                        <span className="text-[10px] text-slate-500 block mb-0.5">Yanıt Çıktısı:</span>
                        {result.status === 'success' ? (
                          <div className="text-[11px] text-slate-300 font-mono bg-slate-900/60 p-1.5 rounded border border-slate-800 truncate" title={result.replyPreview}>
                            "{result.replyPreview}"
                          </div>
                        ) : (
                          <div className="text-[11px] text-rose-400 font-mono bg-rose-950/20 p-1.5 rounded border border-rose-900/40 truncate" title={result.errorMessage}>
                            ✗ {result.errorMessage || 'Bağlantı hatası'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/60 text-xs">
                  <span className="text-[10px] text-slate-500">
                    {result ? formatTimeAgo(result.timestamp) : 'Bekliyor'}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTestSingle(model.id)}
                    disabled={isCurrentlyRunning || isRunningAll}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium text-[11px] transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    {isCurrentlyRunning ? (
                      <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                    ) : (
                      <Play className="w-3 h-3 text-emerald-400" />
                    )}
                    <span>Tekrar Ping At</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Card */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex items-start gap-3">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-slate-300">Hız Radarı Nasıl Çalışır?</span>
          <p className="leading-relaxed">
            Hız Radarı, belirlenen aralıklarla (varsayılan saatte bir) arka planda tüm modellere hızlı bir <code className="text-emerald-400 font-mono">"{pingPrompt}"</code> istemi gönderir. Stream (SSE) kullanarak hem sunucu soket açılış gecikmesini hem de ilk kelimenin üretilme süresini (TTFT) milisaniye hassasiyetinde ölçer. Sekmeler arası geçiş yapsanız dahi periyodik testler kesilmeden çalışmaya devam eder ve sonuçlar tarayıcınızda saklanır.
          </p>
        </div>
      </div>
    </div>
  );
};
