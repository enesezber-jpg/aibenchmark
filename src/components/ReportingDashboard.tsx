import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Layers,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Search,
  Filter,
  Eye,
  X,
  Copy,
  Check,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import type { BenchmarkRecord } from '../types';

interface ReportingDashboardProps {
  records: BenchmarkRecord[];
  onClearHistory: () => void;
  onSelectRecordForInspection?: (record: BenchmarkRecord) => void;
}

export const ReportingDashboard: React.FC<ReportingDashboardProps> = ({
  records,
  onClearHistory,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEndpointFilter, setSelectedEndpointFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'timestamp' | 'latency' | 'tokens' | 'speed'>('timestamp');
  const [inspectRecord, setInspectRecord] = useState<BenchmarkRecord | null>(null);
  const [copiedInspect, setCopiedInspect] = useState(false);

  // High-level KPI aggregations
  const stats = useMemo(() => {
    const total = records.length;
    if (total === 0) {
      return {
        total: 0,
        avgLatency: 0,
        successRate: 100,
        maxSpeed: 0,
        fastestModel: '-',
        totalTokens: 0,
      };
    }

    const successful = records.filter((r) => r.status === 'success');
    const totalLatency = successful.reduce((acc, curr) => acc + curr.latencyMs, 0);
    const avgLatency = successful.length > 0 ? Math.round(totalLatency / successful.length) : 0;
    const successRate = Math.round((successful.length / total) * 100);

    const withSpeed = successful.filter((r) => r.tokensPerSecond && r.tokensPerSecond > 0);
    const maxSpeedRecord = withSpeed.sort((a, b) => (b.tokensPerSecond || 0) - (a.tokensPerSecond || 0))[0];
    const maxSpeed = maxSpeedRecord?.tokensPerSecond || 0;
    const fastestModel = maxSpeedRecord?.modelId || '-';

    const totalTokens = successful.reduce((acc, curr) => acc + (curr.totalTokens || 0), 0);

    return {
      total,
      avgLatency,
      successRate,
      maxSpeed,
      fastestModel,
      totalTokens,
    };
  }, [records]);

  // Model-based average latency aggregation for Bar Chart
  const modelLatencyData = useMemo(() => {
    const map: Record<string, { totalMs: number; count: number; maxSpeed: number }> = {};
    records
      .filter((r) => r.status === 'success')
      .forEach((r) => {
        const id = r.modelId || 'standart';
        if (!map[id]) map[id] = { totalMs: 0, count: 0, maxSpeed: 0 };
        map[id].totalMs += r.latencyMs;
        map[id].count += 1;
        if (r.tokensPerSecond && r.tokensPerSecond > map[id].maxSpeed) {
          map[id].maxSpeed = r.tokensPerSecond;
        }
      });

    return Object.entries(map).map(([model, data]) => ({
      model,
      avgLatency: Math.round(data.totalMs / data.count),
      count: data.count,
      maxSpeed: data.maxSpeed,
    })).sort((a, b) => a.avgLatency - b.avgLatency);
  }, [records]);

  // Endpoint distribution
  const endpointDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach((r) => {
      counts[r.endpoint] = (counts[r.endpoint] || 0) + 1;
    });
    return Object.entries(counts).map(([endpoint, count]) => ({ endpoint, count }));
  }, [records]);

  // Filtered & sorted records list
  const filteredRecords = useMemo(() => {
    return records
      .filter((r) => {
        const matchSearch =
          r.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (r.outputPreview && r.outputPreview.toLowerCase().includes(searchQuery.toLowerCase()));

        if (!matchSearch) return false;
        if (selectedEndpointFilter !== 'all' && r.endpoint !== selectedEndpointFilter) return false;
        if (selectedStatusFilter !== 'all' && r.status !== selectedStatusFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'timestamp') return b.timestamp - a.timestamp;
        if (sortBy === 'latency') return a.latencyMs - b.latencyMs;
        if (sortBy === 'tokens') return (b.totalTokens || 0) - (a.totalTokens || 0);
        if (sortBy === 'speed') return (b.tokensPerSecond || 0) - (a.tokensPerSecond || 0);
        return 0;
      });
  }, [records, searchQuery, selectedEndpointFilter, selectedStatusFilter, sortBy]);

  // Export handlers
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = [
      'Zaman',
      'Model',
      'Endpoint',
      'Kullanılan API',
      'Yedekleme Yapıldı mı',
      'Durum',
      'HTTP Kodu',
      'Gecikme (ms)',
      'Hız (tok/s)',
      'Girdi Token',
      'Çıktı Token',
      'Toplam Token',
    ];
    const rows = records.map((r) => [
      new Date(r.timestamp).toISOString(),
      `"${r.modelId}"`,
      r.endpoint,
      `"${r.successfulKeyName || 'Birincil'}"`,
      r.failoverOccurred ? 'Evet' : 'Hayır',
      r.status,
      r.httpStatus || 200,
      r.latencyMs,
      r.tokensPerSecond || '',
      r.promptTokens || '',
      r.completionTokens || '',
      r.totalTokens || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `openai_benchmark_raporu_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (records.length === 0) return;
    const jsonStr = JSON.stringify(records, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `openai_benchmark_raporu_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            <span>Grafiksel Performans & Raporlama Paneli</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Test edilen tüm modellerin gecikme, çıkarım hızı (tok/s) ve token tüketim grafik analizleri.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>CSV İndir</span>
          </button>

          <button
            onClick={handleExportJSON}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <FileCode className="w-3.5 h-3.5 text-blue-400" />
            <span>JSON İndir</span>
          </button>

          {records.length > 0 && (
            <button
              onClick={() => {
                if (confirm('Tüm test geçmişini silmek istediğinize emin misiniz?')) {
                  onClearHistory();
                }
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Geçmişi Temizle"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Toplam Test Sayısı</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            10 Uç Nokta Kapsamında
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Ortalama Gecikme</span>
            <Clock className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {stats.avgLatency} <span className="text-sm font-normal text-slate-400">ms</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Başarılı isteklerin ortalaması
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Maksimum Çıkarım Hızı</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {stats.maxSpeed} <span className="text-sm font-normal text-slate-400">t/s</span>
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5" title={stats.fastestModel}>
            En hızlı: <span className="text-slate-200 font-mono">{stats.fastestModel}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Başarı Oranı</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            %{stats.successRate}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            HTTP 200 Yanıt Oranı
          </div>
        </div>
      </div>

      {/* Graphical Charts Section */}
      {records.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Chart 1: Latency Comparison (7 cols) */}
          <div className="lg:col-span-7 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Model Gecikme Süreleri (Ortalama Latency)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Düşük gecikme süresi daha yüksek yanıt performansı demektir.</p>
              </div>
              <span className="text-xs font-mono text-slate-500">Milisaniye (ms)</span>
            </div>

            {modelLatencyData.length > 0 ? (
              <div className="space-y-3 pt-2">
                {(() => {
                  const maxLat = Math.max(...modelLatencyData.map((d) => d.avgLatency), 1);

                  return modelLatencyData.map((item, idx) => {
                    const widthPercent = Math.max(6, Math.min(100, Math.round((item.avgLatency / maxLat) * 100)));
                    const isLowest = idx === 0;

                    return (
                      <div key={item.model} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 truncate max-w-[240px]">
                            <span className="font-mono text-slate-200 truncate">{item.model}</span>
                            {isLowest && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                                En Hızlı
                              </span>
                            )}
                          </div>
                          <span className="font-mono font-bold text-slate-200 tabular-nums">
                            {item.avgLatency} ms
                          </span>
                        </div>

                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isLowest ? 'bg-emerald-400' : 'bg-blue-500/80'
                            }`}
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">Başarılı gecikme verisi yok</div>
            )}
          </div>

          {/* Chart 2: Speed / Throughput Comparison (5 cols) */}
          <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">Çıkarım Hızı (Tokens / Saniye)</h3>
                <p className="text-xs text-slate-400 mt-0.5">Yüksek token/s değeri daha akıcı üretim demektir.</p>
              </div>
              <span className="text-xs font-mono text-slate-500">t/s</span>
            </div>

            {modelLatencyData.filter((d) => d.maxSpeed > 0).length > 0 ? (
              <div className="space-y-3 pt-2">
                {(() => {
                  const speedData = modelLatencyData.filter((d) => d.maxSpeed > 0);
                  const maxSpd = Math.max(...speedData.map((d) => d.maxSpeed), 1);

                  return speedData.map((item) => {
                    const widthPercent = Math.max(8, Math.min(100, Math.round((item.maxSpeed / maxSpd) * 100)));

                    return (
                      <div key={item.model} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-slate-200 truncate max-w-[200px]">{item.model}</span>
                          <span className="font-mono font-bold text-emerald-400 tabular-nums">
                            {item.maxSpeed} tok/s
                          </span>
                        </div>

                        <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden p-0.5">
                          <div
                            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                            style={{ width: `${widthPercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                Ölçülen token hız verisi henüz yok. Sohbet tamamlama testleri çalıştırıldığında burada belirecektir.
              </div>
            )}
          </div>

          {/* Chart 3: Endpoint Distribution & Success Ratio (Full 12 cols) */}
          <div className="lg:col-span-12 p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-sm font-semibold text-white">Uç Nokta Dağılımı ve İstek Hacmi</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hangi OpenAI uyumlu uç noktaların ne sıklıkla test edildiğini gösterir.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              {endpointDistribution.map((item) => (
                <div key={item.endpoint} className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] font-mono text-emerald-400 truncate">{item.endpoint}</div>
                  <div className="text-lg font-bold font-mono text-white mt-1 tabular-nums">
                    {item.count} <span className="text-xs font-normal text-slate-500">test</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="py-16 text-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <BarChart3 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-white mb-1">Raporlama İçin Henüz Veri Yok</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Endpoint Testi veya Çoklu Model Karşılaştırma sekmesinden test çalıştırdığınızda grafikler otomatik olarak burada oluşacaktır.
          </p>
        </div>
      )}

      {/* Test History Table */}
      <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
        {/* Table Filters & Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Ayrıntılı Test Çalıştırma Günlüğü</h3>
            <p className="text-xs text-slate-400 mt-0.5">Kaydedilen tüm kıyaslama ve istek kayıtları</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 md:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filtrele veya ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={selectedEndpointFilter}
              onChange={(e) => setSelectedEndpointFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">Tüm Endpointler</option>
              {Array.from(new Set(records.map((r) => r.endpoint))).map((ep) => (
                <option key={ep} value={ep}>
                  {ep}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="timestamp">Zamana Göre (Yeni)</option>
              <option value="latency">Gecikmeye Göre (Hızlı)</option>
              <option value="tokens">Token Sayısına Göre</option>
              <option value="speed">Çıkarım Hızına Göre</option>
            </select>
          </div>
        </div>

        {/* Table Rows */}
        {filteredRecords.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-medium">
                  <th className="py-2.5 px-3">Zaman</th>
                  <th className="py-2.5 px-3">Model</th>
                  <th className="py-2.5 px-3">Endpoint</th>
                  <th className="py-2.5 px-3">API Kaynağı</th>
                  <th className="py-2.5 px-3">Gecikme</th>
                  <th className="py-2.5 px-3">Hız (t/s)</th>
                  <th className="py-2.5 px-3">Tokenlar</th>
                  <th className="py-2.5 px-3">Durum</th>
                  <th className="py-2.5 px-3 text-right">Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition-colors group">
                    <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {new Date(r.timestamp).toLocaleTimeString('tr-TR')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-medium text-slate-200 max-w-[180px] truncate">
                      {r.modelId}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 whitespace-nowrap">
                      {r.endpoint}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300">
                        <span>{r.successfulKeyName || 'Birincil'}</span>
                        {r.failoverOccurred && (
                          <span className="px-1 py-0.2 rounded text-[9px] bg-amber-950 text-amber-300 border border-amber-500/40 font-semibold">
                            Yedek
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-200 tabular-nums whitespace-nowrap">
                      {r.latencyMs} ms
                    </td>
                    <td className="py-2.5 px-3 font-mono text-emerald-400 tabular-nums whitespace-nowrap">
                      {r.tokensPerSecond ? `${r.tokensPerSecond} t/s` : '-'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-400 tabular-nums whitespace-nowrap">
                      {r.totalTokens ? `${r.totalTokens} tok` : '-'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[11px] font-semibold ${
                          r.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {r.status === 'success' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <AlertCircle className="w-3 h-3" />
                        )}
                        <span>{r.httpStatus || 200}</span>
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setInspectRecord(r)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        <span>İncele</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            Filtreye uygun kayıt bulunamadı.
          </div>
        )}
      </div>

      {/* Inspect Modal */}
      {inspectRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>Test Detayı: {inspectRecord.modelId}</span>
                  <span className="text-xs font-mono text-emerald-400">({inspectRecord.endpoint})</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {new Date(inspectRecord.timestamp).toLocaleString('tr-TR')} · Gecikme: {inspectRecord.latencyMs}ms
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectRecord, null, 2));
                    setCopiedInspect(true);
                    setTimeout(() => setCopiedInspect(false), 2000);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                  title="Tüm Kaydı Kopyala"
                >
                  {copiedInspect ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>

                <button
                  onClick={() => setInspectRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {/* Failover Attempt Trail if available */}
              {inspectRecord.attemptedKeys && inspectRecord.attemptedKeys.length > 1 && (
                <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-500/30 space-y-2">
                  <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                    <span>Yedekleme & Deneme Geçmişi (Failover Trail)</span>
                  </div>
                  <div className="space-y-1.5">
                    {inspectRecord.attemptedKeys.map((att, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded flex items-center justify-between text-xs font-mono ${
                          att.status === 'success'
                            ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="opacity-75">#{i + 1} {att.keyName}:</span>
                          <span>{att.status === 'success' ? 'Başarılı (İstek Yanıtlandı)' : `Başarısız: ${att.error || 'Hata'}`}</span>
                        </div>
                        {att.latencyMs !== undefined && (
                          <span className="text-[11px] opacity-80">{att.latencyMs}ms</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Request Payload */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Gönderilen İstek (Request Payload)</label>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-slate-300 max-h-56 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(inspectRecord.requestPayload, null, 2)}
                </pre>
              </div>

              {/* Response Payload */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Alınan Yanıt (Response Payload)</label>
                <pre className="p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-emerald-400/90 max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(inspectRecord.responsePayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
