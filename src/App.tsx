import React, { useState, useEffect } from 'react';
import type { ApiConfig, BenchmarkRecord, ModelItem } from './types';
import { Header } from './components/Header';
import { ConfigModal } from './components/ConfigModal';
import { ModelScanner } from './components/ModelScanner';
import { EndpointTester } from './components/EndpointTester';
import { CompareView } from './components/CompareView';
import { ReportingDashboard } from './components/ReportingDashboard';
import { scanModels } from './services/apiService';

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  apiKeysPool: [
    {
      id: 'key_1',
      name: 'Birincil API (Ana Hesap)',
      key: '',
      baseUrl: 'https://api.openai.com/v1',
      isEnabled: true,
    },
  ],
  enableFailover: true,
  failoverMaxRetries: 3,
  useProxy: true,
  customHeaders: {},
  selectedProvider: 'openai',
};

// Initial seed benchmark records for immediate graphical preview
const INITIAL_SEED_RECORDS: BenchmarkRecord[] = [
  {
    id: 'rec_seed_1',
    timestamp: Date.now() - 1000 * 60 * 18,
    modelId: 'gpt-4o',
    endpoint: '/chat/completions',
    status: 'success',
    httpStatus: 200,
    latencyMs: 720,
    ttftMs: 310,
    promptTokens: 48,
    completionTokens: 210,
    totalTokens: 258,
    tokensPerSecond: 82.4,
    requestPayload: { model: 'gpt-4o', max_tokens: 300 },
    responsePayload: { choices: [{ message: { content: 'Kuantum bilgisayarlar süperpozisyon ve dolanıklık ilkelerini kullanır...' } }] },
    outputPreview: 'Kuantum bilgisayarlar süperpozisyon ve dolanıklık ilkelerini kullanır...',
  },
  {
    id: 'rec_seed_2',
    timestamp: Date.now() - 1000 * 60 * 15,
    modelId: 'gpt-4o-mini',
    endpoint: '/chat/completions',
    status: 'success',
    httpStatus: 200,
    latencyMs: 380,
    ttftMs: 160,
    promptTokens: 48,
    completionTokens: 195,
    totalTokens: 243,
    tokensPerSecond: 135.2,
    requestPayload: { model: 'gpt-4o-mini', max_tokens: 300 },
    responsePayload: { choices: [{ message: { content: '1. Kübitler aynı anda 0 ve 1 olabilir. 2. Dolanıklık ile paralel işlem yapılır.' } }] },
    outputPreview: '1. Kübitler aynı anda 0 ve 1 olabilir. 2. Dolanıklık ile paralel işlem yapılır.',
  },
  {
    id: 'rec_seed_3',
    timestamp: Date.now() - 1000 * 60 * 10,
    modelId: 'text-embedding-3-small',
    endpoint: '/embeddings',
    status: 'success',
    httpStatus: 200,
    latencyMs: 145,
    promptTokens: 32,
    totalTokens: 32,
    requestPayload: { model: 'text-embedding-3-small' },
    responsePayload: { data: [{ embedding: [0.012, -0.045, 0.082] }] },
    embeddingsDim: 1536,
    outputPreview: '2 vektör üretildi. Boyut: 1536',
  },
  {
    id: 'rec_seed_4',
    timestamp: Date.now() - 1000 * 60 * 5,
    modelId: 'tts-1',
    endpoint: '/audio/speech',
    status: 'success',
    httpStatus: 200,
    latencyMs: 510,
    requestPayload: { model: 'tts-1', voice: 'alloy' },
    responsePayload: { byteLength: 14200 },
    outputPreview: 'Ses başarıyla oluşturuldu (14200 bayt, audio/mpeg)',
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'endpoints' | 'compare' | 'reports'>('scanner');
  const [isConfigOpen, setIsConfigOpen] = useState(false);

  // Load saved config or default
  const [apiConfig, setApiConfig] = useState<ApiConfig>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (!parsed.apiKeysPool || parsed.apiKeysPool.length === 0) {
          parsed.apiKeysPool = [
            {
              id: 'key_1',
              name: 'Birincil API (Ana Hesap)',
              key: parsed.apiKey || '',
              baseUrl: parsed.baseUrl || 'https://api.openai.com/v1',
              isEnabled: true,
            },
          ];
        }
        if (parsed.enableFailover === undefined) parsed.enableFailover = true;
        if (parsed.failoverMaxRetries === undefined) parsed.failoverMaxRetries = 3;
        return parsed;
      }
    } catch {}
    return DEFAULT_CONFIG;
  });

  // Load cached models or empty
  const [models, setModels] = useState<ModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_models');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Selected models for comparison
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(['gpt-4o', 'gpt-4o-mini']);

  // Benchmark records history
  const [records, setRecords] = useState<BenchmarkRecord[]>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_benchmarks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_SEED_RECORDS;
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedModelForTest, setSelectedModelForTest] = useState<string>('gpt-4o-mini');

  // Sync config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_config', JSON.stringify(apiConfig));
    } catch {}
  }, [apiConfig]);

  // Sync models to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_models', JSON.stringify(models));
    } catch {}
  }, [models]);

  // Sync benchmark records
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_benchmarks', JSON.stringify(records));
    } catch {}
  }, [records]);

  // Model Scan handler
  const handleScanModels = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const fetchedModels = await scanModels(apiConfig);
      setModels(fetchedModels);

      // Pre-select first 2 chat models if available
      const chatModels = fetchedModels.filter((m) => m.detectedType === 'chat');
      if (chatModels.length >= 2) {
        setSelectedModelIds(chatModels.slice(0, 3).map((m) => m.id));
      } else if (fetchedModels.length > 0) {
        setSelectedModelIds(fetchedModels.slice(0, 2).map((m) => m.id));
      }
    } catch (err: any) {
      setScanError(err.message || 'Model taraması sırasında bir hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  };

  // Test Connection Probe across candidate pool
  const handleTestConnection = async (testConfig: ApiConfig) => {
    try {
      const candidates = testConfig.apiKeysPool?.filter((k) => k.isEnabled) || [];
      if (candidates.length <= 1) {
        const res = await scanModels(testConfig);
        return {
          success: true,
          message: `Bağlantı başarılı! ${res.length} adet model başarıyla tespit edildi.`,
        };
      }

      // Test multiple candidates
      const results: string[] = [];
      let successCount = 0;

      for (const cand of candidates) {
        try {
          const singleCfg: ApiConfig = {
            ...testConfig,
            baseUrl: cand.baseUrl || testConfig.baseUrl,
            apiKey: cand.key,
            apiKeysPool: [],
            enableFailover: false,
          };
          const res = await scanModels(singleCfg);
          successCount++;
          results.push(`✓ ${cand.name}: Başarılı (${res.length} model)`);
        } catch (err: any) {
          results.push(`✗ ${cand.name}: Hata (${err.message || 'Bağlantı kesildi'})`);
        }
      }

      const allSuccess = successCount === candidates.length;
      return {
        success: successCount > 0,
        message: `${successCount}/${candidates.length} API aktif. ${allSuccess ? 'Tüm havuz çalışıyor!' : 'Bazı API anahtarları hata verdi, otomatik yedekleme devreye girecektir.'}\n${results.join(' · ')}`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Bağlantı başarısız: ${err.message}`,
      };
    }
  };

  const handleToggleSelectModel = (modelId: string) => {
    setSelectedModelIds((prev) => {
      if (prev.includes(modelId)) {
        return prev.filter((id) => id !== modelId);
      } else {
        if (prev.length >= 4) {
          alert('Karşılaştırma için aynı anda en fazla 4 model seçebilirsiniz.');
          return prev;
        }
        return [...prev, modelId];
      }
    });
  };

  const handleSelectAllVisible = (modelIds: string[]) => {
    const toSelect = modelIds.slice(0, 4);
    setSelectedModelIds(toSelect);
  };

  const handleClearSelection = () => {
    setSelectedModelIds([]);
  };

  const handleQuickTest = (modelId: string) => {
    setSelectedModelForTest(modelId);
    setActiveTab('endpoints');
  };

  const handleBenchmarkCompleted = (record: BenchmarkRecord) => {
    setRecords((prev) => [record, ...prev]);
  };

  const handleClearHistory = () => {
    setRecords([]);
    localStorage.removeItem('openai_suite_benchmarks');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConfig={apiConfig}
        onOpenConfig={() => setIsConfigOpen(true)}
        modelsCount={models.length}
        testCount={records.length}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'scanner' && (
          <ModelScanner
            models={models}
            isScanning={isScanning}
            scanError={scanError}
            onScan={handleScanModels}
            selectedModelIds={selectedModelIds}
            onToggleSelectModel={handleToggleSelectModel}
            onSelectAllVisible={handleSelectAllVisible}
            onClearSelection={handleClearSelection}
            onQuickTest={handleQuickTest}
            onGoToCompare={() => setActiveTab('compare')}
          />
        )}

        {activeTab === 'endpoints' && (
          <EndpointTester
            apiConfig={apiConfig}
            models={models}
            defaultSelectedModel={selectedModelForTest}
            onBenchmarkCompleted={handleBenchmarkCompleted}
          />
        )}

        {activeTab === 'compare' && (
          <CompareView
            apiConfig={apiConfig}
            scannedModels={models}
            selectedModelIds={selectedModelIds}
            onBenchmarkCompleted={handleBenchmarkCompleted}
            onGoToReports={() => setActiveTab('reports')}
          />
        )}

        {activeTab === 'reports' && (
          <ReportingDashboard
            records={records}
            onClearHistory={handleClearHistory}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Generic OpenAI Model Benchmark Suite</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-400">10 Desteklenen Uç Nokta</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
            <span>/models</span>
            <span>/completions</span>
            <span>/chat/completions</span>
            <span>/images/generations</span>
            <span>/audio/*</span>
            <span>/embeddings</span>
            <span>/messages</span>
            <span>/score</span>
            <span>/rerank</span>
          </div>
        </div>
      </footer>

      {/* API Config Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={apiConfig}
        onSave={(newCfg) => setApiConfig(newCfg)}
        onTestConnection={handleTestConnection}
      />
    </div>
  );
}
