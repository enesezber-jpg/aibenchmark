import React, { useState, useMemo } from 'react';
import {
  Search,
  Scan,
  CheckSquare,
  Square,
  ArrowRight,
  Sparkles,
  Bot,
  Database,
  Mic,
  Image as ImageIcon,
  ArrowUpDown,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import type { ModelItem } from '../types';

interface ModelScannerProps {
  models: ModelItem[];
  isScanning: boolean;
  scanError: string | null;
  onScan: () => void;
  selectedModelIds: string[];
  onToggleSelectModel: (modelId: string) => void;
  onSelectAllVisible: (modelIds: string[]) => void;
  onClearSelection: () => void;
  onQuickTest: (modelId: string) => void;
  onGoToCompare: () => void;
}

export const ModelScanner: React.FC<ModelScannerProps> = ({
  models,
  isScanning,
  scanError,
  onScan,
  selectedModelIds,
  onToggleSelectModel,
  onSelectAllVisible,
  onClearSelection,
  onQuickTest,
  onGoToCompare,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const matchSearch =
        m.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.owned_by && m.owned_by.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchSearch) return false;
      if (filterType === 'all') return true;
      return m.detectedType === filterType;
    });
  }, [models, searchQuery, filterType]);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getModalityIcon = (type?: ModelItem['detectedType']) => {
    switch (type) {
      case 'chat':
        return <Bot className="w-3.5 h-3.5 text-blue-400" />;
      case 'embedding':
        return <Database className="w-3.5 h-3.5 text-emerald-400" />;
      case 'audio':
        return <Mic className="w-3.5 h-3.5 text-amber-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      case 'rerank':
        return <ArrowUpDown className="w-3.5 h-3.5 text-pink-400" />;
      default:
        return <Sparkles className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const countsByType = useMemo(() => {
    const counts: Record<string, number> = { all: models.length };
    models.forEach((m) => {
      const t = m.detectedType || 'general';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [models]);

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-slate-900 border border-slate-800">
        <div>
          <h1 className="text-lg font-bold text-white tracking-tight">
            OpenAI Uyumlu Model Tarayıcısı (/models)
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Bağlı olduğunuz Base URL üzerinden tüm aktif modelleri tarayın ve çoklu karşılaştırma için seçin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {selectedModelIds.length > 0 && (
            <button
              onClick={onGoToCompare}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm"
            >
              <span>{selectedModelIds.length} Modeli Karşılaştır</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={onScan}
            disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Scan className={`w-3.5 h-3.5 text-emerald-400 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Taranıyor...' : 'Modelleri Tara'}</span>
          </button>
        </div>
      </div>

      {scanError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="flex-1">
            <span className="font-semibold block mb-0.5">Model Tarama Hatası</span>
            <span>{scanError}</span>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      {models.length > 0 && (
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-900/90 border border-slate-800 rounded-lg text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === 'all'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tümü ({countsByType.all || 0})
            </button>
            <button
              onClick={() => setFilterType('chat')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === 'chat'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              LLM & Chat ({countsByType.chat || 0})
            </button>
            <button
              onClick={() => setFilterType('embedding')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === 'embedding'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Embedding ({countsByType.embedding || 0})
            </button>
            <button
              onClick={() => setFilterType('audio')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === 'audio'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Ses & TTS ({countsByType.audio || 0})
            </button>
            <button
              onClick={() => setFilterType('image')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === 'image'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Görsel ({countsByType.image || 0})
            </button>
            <button
              onClick={() => setFilterType('rerank')}
              className={`px-3 py-1.5 font-medium rounded-md transition-colors whitespace-nowrap ${
                filterType === 'rerank'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Rerank / Score ({countsByType.rerank || 0})
            </button>
          </div>

          {/* Search + Bulk Selection */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Model adı veya sahip ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <button
              onClick={() => {
                if (selectedModelIds.length > 0) {
                  onClearSelection();
                } else {
                  onSelectAllVisible(filteredModels.map((m) => m.id));
                }
              }}
              title={selectedModelIds.length > 0 ? 'Seçimi Temizle' : 'Tümünü Seç'}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg whitespace-nowrap transition-colors"
            >
              {selectedModelIds.length > 0 ? 'Seçimi Bırak' : 'Görünenleri Seç'}
            </button>
          </div>
        </div>
      )}

      {/* Model Grid or Empty State */}
      {models.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
          <div className="w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 mx-auto mb-4">
            <Scan className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Henüz Model Taranmadı</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
            API uç noktasından desteklenen modelleri listelemek için aşağıdaki butona tıklayın.
          </p>
          <button
            onClick={onScan}
            disabled={isScanning}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
          >
            <Scan className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Modeller Getiriliyor...' : 'Modelleri Şimdi Tara (/models)'}</span>
          </button>
        </div>
      ) : filteredModels.length === 0 ? (
        <div className="text-center py-12 rounded-xl border border-slate-800 bg-slate-900/40 text-xs text-slate-400">
          Arama kriterine uygun model bulunamadı.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredModels.map((model) => {
            const isSelected = selectedModelIds.includes(model.id);

            return (
              <div
                key={model.id}
                onClick={() => onToggleSelectModel(model.id)}
                className={`group relative p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900/90 border-emerald-500/60 ring-1 ring-emerald-500/40 shadow-sm'
                    : 'bg-slate-900/50 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-slate-800/80">
                        {getModalityIcon(model.detectedType)}
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 capitalize">
                        {model.detectedType || 'Genel'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => handleCopy(model.id, e)}
                        className="p-1 text-slate-500 hover:text-slate-300 rounded transition-colors"
                        title="Model Kimliğini Kopyala"
                      >
                        {copiedId === model.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleSelectModel(model.id);
                        }}
                        className="text-slate-400 hover:text-white"
                        title="Karşılaştırmaya Ekle"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600 group-hover:text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <h4 className="text-xs font-mono font-semibold text-slate-100 break-all mb-2 leading-relaxed">
                    {model.id}
                  </h4>

                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Sahip: <span className="text-slate-300 font-mono">{model.owned_by || 'bilinmiyor'}</span></span>
                    {model.created && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(model.created * 1000).toLocaleDateString('tr-TR')}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {isSelected ? 'Karşılaştırma için seçildi' : 'Seçmek için tıkla'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickTest(model.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
                  >
                    <span>Test Et</span>
                    <ArrowRight className="w-3 h-3 text-emerald-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
