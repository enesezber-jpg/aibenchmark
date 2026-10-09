import React, { useState } from 'react';
import {
  X,
  Check,
  Eye,
  EyeOff,
  Server,
  Key,
  Globe,
  Shield,
  RefreshCw,
  AlertCircle,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { ApiConfig, ApiKeyItem } from '../types';
import { PRESET_PROVIDERS } from '../utils/constants';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ApiConfig;
  onSave: (newConfig: ApiConfig) => void;
  onTestConnection: (testConfig: ApiConfig) => Promise<{ success: boolean; message: string }>;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  onTestConnection,
}) => {
  // Ensure apiKeysPool is initialized
  const [formData, setFormData] = useState<ApiConfig>(() => {
    const initialPool: ApiKeyItem[] =
      config.apiKeysPool && config.apiKeysPool.length > 0
        ? [...config.apiKeysPool]
        : [
            {
              id: 'key_1',
              name: 'Birincil API (Ana Hesap)',
              key: config.apiKey || '',
              baseUrl: config.baseUrl || 'https://api.openai.com/v1',
              isEnabled: true,
            },
          ];

    return {
      ...config,
      enableFailover: config.enableFailover !== undefined ? config.enableFailover : true,
      failoverMaxRetries: config.failoverMaxRetries || 3,
      apiKeysPool: initialPool,
    };
  });

  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [headerKey, setHeaderKey] = useState('');
  const [headerVal, setHeaderVal] = useState('');

  if (!isOpen) return null;

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleProviderSelect = (providerId: string) => {
    const preset = PRESET_PROVIDERS.find((p) => p.id === providerId);
    if (!preset) return;

    setFormData((prev) => {
      // Also update primary key's baseUrl if it matches default
      const updatedPool = prev.apiKeysPool.map((k, idx) => {
        if (idx === 0) {
          return { ...k, baseUrl: preset.defaultBaseUrl };
        }
        return k;
      });

      return {
        ...prev,
        selectedProvider: preset.id,
        baseUrl: preset.defaultBaseUrl,
        apiKeysPool: updatedPool,
      };
    });
    setTestResult(null);
  };

  const handleAddNewApiKey = () => {
    const newIndex = formData.apiKeysPool.length + 1;
    const newItem: ApiKeyItem = {
      id: 'key_' + Math.random().toString(36).substring(2, 8),
      name: `Yedek API #${newIndex}`,
      key: '',
      baseUrl: formData.baseUrl,
      isEnabled: true,
    };

    setFormData((prev) => ({
      ...prev,
      apiKeysPool: [...prev.apiKeysPool, newItem],
    }));
  };

  const handleUpdateApiKeyItem = (id: string, updates: Partial<ApiKeyItem>) => {
    setFormData((prev) => {
      const nextPool = prev.apiKeysPool.map((k) => (k.id === id ? { ...k, ...updates } : k));
      // Sync primary key to root apiKey if first item was edited
      const rootKey = nextPool[0]?.key || prev.apiKey;
      return {
        ...prev,
        apiKey: rootKey,
        apiKeysPool: nextPool,
      };
    });
  };

  const handleRemoveApiKeyItem = (id: string) => {
    if (formData.apiKeysPool.length <= 1) {
      alert('En az 1 adet API anahtarı bulunmalıdır.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      apiKeysPool: prev.apiKeysPool.filter((k) => k.id !== id),
    }));
  };

  const handleMoveKey = (index: number, direction: 'up' | 'down') => {
    const newPool = [...formData.apiKeysPool];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newPool.length) return;

    const temp = newPool[index];
    newPool[index] = newPool[targetIdx];
    newPool[targetIdx] = temp;

    setFormData((prev) => ({
      ...prev,
      apiKey: newPool[0]?.key || prev.apiKey,
      apiKeysPool: newPool,
    }));
  };

  const handleAddHeader = () => {
    if (!headerKey.trim()) return;
    setFormData((prev) => ({
      ...prev,
      customHeaders: {
        ...prev.customHeaders,
        [headerKey.trim()]: headerVal.trim(),
      },
    }));
    setHeaderKey('');
    setHeaderVal('');
  };

  const handleRemoveHeader = (keyToRemove: string) => {
    setFormData((prev) => {
      const nextHeaders = { ...prev.customHeaders };
      delete nextHeaders[keyToRemove];
      return { ...prev, customHeaders: nextHeaders };
    });
  };

  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(formData);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Bağlantı hatası',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndClose = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">API & Yedekleme (Failover) Yapılandırması</h2>
              <p className="text-xs text-slate-400">Çoklu API anahtarı havuzu ve hata durumunda otomatik geçiş</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Quick Provider Picker */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Hazır Sağlayıcı Şablonu (Preset)
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_PROVIDERS.map((provider) => {
                const isSelected = formData.selectedProvider === provider.id;
                return (
                  <button
                    key={provider.id}
                    type="button"
                    onClick={() => handleProviderSelect(provider.id)}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300 ring-1 ring-emerald-500/40'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="font-semibold truncate">{provider.name}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {provider.id === 'ollama' || provider.id === 'lmstudio' ? 'Yerel Sunucu' : 'Bulut API'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Global Default Base URL */}
          <div>
            <label className="flex items-center justify-between text-xs font-medium text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                Varsayılan Base URL
              </span>
              <span className="text-[11px] text-slate-400">Örn: https://api.openai.com/v1</span>
            </label>
            <input
              type="text"
              value={formData.baseUrl}
              onChange={(e) => {
                const val = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  baseUrl: val,
                  // Also update pool items that don't have custom baseUrl
                  apiKeysPool: prev.apiKeysPool.map((k) =>
                    !k.baseUrl || k.baseUrl === prev.baseUrl ? { ...k, baseUrl: val } : k
                  ),
                }));
              }}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          {/* MULTI-API KEY POOL & FAILOVER SECTION */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Çoklu API & Hata Yedekleme Havuzu (Failover Pool)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  İlk API hata aldığında (429 Rate Limit, 401 veya sunucu hatası), sistem otomatik olarak sıradaki API anahtarına geçer.
                </p>
              </div>

              {/* Failover master toggle */}
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-2 cursor-pointer">
                  <span>Otomatik Geçiş Aktif</span>
                  <input
                    type="checkbox"
                    checked={formData.enableFailover}
                    onChange={(e) => setFormData({ ...formData, enableFailover: e.target.checked })}
                    className="rounded accent-emerald-500 w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* List of configured API Keys */}
            <div className="space-y-3">
              {formData.apiKeysPool.map((item, index) => {
                const isKeyVisible = visibleKeyIds[item.id] || false;
                const isFirst = index === 0;
                const isLast = index === formData.apiKeysPool.length - 1;

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg border transition-all ${
                      item.isEnabled
                        ? 'bg-slate-900/90 border-slate-800'
                        : 'bg-slate-900/40 border-slate-800/50 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono font-bold text-slate-300 flex items-center justify-center">
                          {index + 1}
                        </span>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleUpdateApiKeyItem(item.id, { name: e.target.value })}
                          placeholder="API Tanımı (örn: Ana Hesap, Yedek Groq)"
                          className="px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs font-semibold text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-48"
                        />
                        {isFirst && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                            Öncelikli (Birincil)
                          </span>
                        )}
                      </div>

                      {/* Controls: Reorder, Active toggle, Delete */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <label className="text-[11px] text-slate-400 flex items-center gap-1 mr-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={item.isEnabled}
                            onChange={(e) => handleUpdateApiKeyItem(item.id, { isEnabled: e.target.checked })}
                            className="rounded accent-emerald-500"
                          />
                          <span>{item.isEnabled ? 'Aktif' : 'Pasif'}</span>
                        </label>

                        <button
                          type="button"
                          onClick={() => handleMoveKey(index, 'up')}
                          disabled={isFirst}
                          title="Önceliği Artır"
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded hover:bg-slate-800"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleMoveKey(index, 'down')}
                          disabled={isLast}
                          title="Önceliği Düşür"
                          className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 rounded hover:bg-slate-800"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleRemoveApiKeyItem(item.id)}
                          disabled={formData.apiKeysPool.length <= 1}
                          title="API'yi Sil"
                          className="p-1 text-slate-400 hover:text-rose-400 disabled:opacity-30 rounded hover:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-xs">
                      {/* API Key Input */}
                      <div className="md:col-span-7 relative flex items-center">
                        <input
                          type={isKeyVisible ? 'text' : 'password'}
                          value={item.key}
                          onChange={(e) => handleUpdateApiKeyItem(item.id, { key: e.target.value })}
                          placeholder="API Anahtarı (sk-...)"
                          className="w-full pr-8 pl-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-200 placeholder-slate-600 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <button
                          type="button"
                          onClick={() => toggleKeyVisibility(item.id)}
                          className="absolute right-2.5 text-slate-500 hover:text-slate-300"
                        >
                          {isKeyVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Custom Base URL (Optional per key) */}
                      <div className="md:col-span-5">
                        <input
                          type="text"
                          value={item.baseUrl || ''}
                          onChange={(e) => handleUpdateApiKeyItem(item.id, { baseUrl: e.target.value })}
                          placeholder={`Özel Base URL (varsayılan: ${formData.baseUrl})`}
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded text-slate-300 placeholder-slate-600 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add new API button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleAddNewApiKey}
                className="w-full py-2 px-3 border border-dashed border-slate-700 hover:border-emerald-500/60 rounded-lg text-xs font-semibold text-slate-300 hover:text-emerald-300 bg-slate-900/40 hover:bg-slate-900 flex items-center justify-center gap-1.5 transition-colors"
              >
                <Plus className="w-4 h-4 text-emerald-400" />
                <span>Yeni Yedek API / Anahtar Ekle</span>
              </button>
            </div>
          </div>

          {/* Proxy Mode Toggle */}
          <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-start gap-3">
            <div className="mt-0.5">
              <Shield className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Sunucu Proxy Modu (Önerilen)
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.useProxy}
                    onChange={(e) => setFormData({ ...formData, useProxy: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Tarayıcıların CORS (Cross-Origin) kısıtlamalarını aşar. Ses (TTS / Whisper) ve SSE veri akışlarını güvenli şekilde iletir.
              </p>
            </div>
          </div>

          {/* Custom Headers */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Özel HTTP Başlıkları (Headers - Opsiyonel)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="Başlık (örn: HTTP-Referer)"
                value={headerKey}
                onChange={(e) => setHeaderKey(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <input
                type="text"
                placeholder="Değer"
                value={headerVal}
                onChange={(e) => setHeaderVal(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={handleAddHeader}
                className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Ekle
              </button>
            </div>

            {Object.keys(formData.customHeaders).length > 0 && (
              <div className="space-y-1.5 mt-2">
                {Object.entries(formData.customHeaders).map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-950/80 border border-slate-800/80 rounded text-xs font-mono text-slate-300"
                  >
                    <span>
                      <span className="text-emerald-400">{k}:</span> {v}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveHeader(k)}
                      className="text-slate-500 hover:text-rose-400 text-xs"
                    >
                      Kaldır
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Test Connection Output */}
          {testResult && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-center gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span className="leading-snug">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/70">
          <button
            type="button"
            onClick={handleRunTest}
            disabled={isTesting}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
            <span>{isTesting ? 'Kontrol Ediliyor...' : 'Havuz Bağlantısını Test Et'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
            >
              Vazgeç
            </button>
            <button
              type="button"
              onClick={handleSaveAndClose}
              className="px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg transition-colors"
            >
              Kaydet ve Uygula
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
