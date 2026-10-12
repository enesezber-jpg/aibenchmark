import React, { useState, useEffect, useCallback } from 'react';
import type { ApiConfig, BenchmarkRecord, ModelItem } from './types';
import { Header, type NavigationTab } from './components/Header';
import { ConfigModal } from './components/ConfigModal';
import { BenchmarkSuiteView } from './components/BenchmarkSuiteView';
import { ModelGuideView } from './components/ModelGuideView';
import { EndpointTester } from './components/EndpointTester';
import { ReportingDashboard } from './components/ReportingDashboard';
import { SpeedRadarView } from './components/SpeedRadarView';
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

export default function App() {
  const [activeTab, setActiveTab] = useState<NavigationTab>('benchmark');
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

  // Load cached models or empty (NO FAKE HARDCODED MODELS)
  const [models, setModels] = useState<ModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_models');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Selected models for comparison (only from real scanned models)
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_selected_models');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Real benchmark records history (NO DEMO DATA)
  const [records, setRecords] = useState<BenchmarkRecord[]>(() => {
    try {
      const saved = localStorage.getItem('openai_suite_benchmarks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [selectedModelForTest, setSelectedModelForTest] = useState<string>('');

  // Live running state tracking for persistent background execution feedback
  const [benchmarkRunningInfo, setBenchmarkRunningInfo] = useState<{
    isRunning: boolean;
    progressPercent: number;
    testName: string;
    modelName: string;
  }>({
    isRunning: false,
    progressPercent: 0,
    testName: '',
    modelName: '',
  });

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

  // Sync selected models
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_selected_models', JSON.stringify(selectedModelIds));
    } catch {}
  }, [selectedModelIds]);

  // Sync benchmark records
  useEffect(() => {
    try {
      localStorage.setItem('openai_suite_benchmarks', JSON.stringify(records));
    } catch {}
  }, [records]);

  // Model Scan handler with specific config
  const handleScanModelsWithConfig = useCallback(async (configToUse: ApiConfig) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const fetchedModels = await scanModels(configToUse);
      setModels(fetchedModels);

      // Select real chat models from the scanned list
      const chatModels = fetchedModels.filter(
        (m) => m.detectedType === 'chat' || m.detectedType === 'general'
      );

      const realToSelect =
        chatModels.length > 0
          ? chatModels.slice(0, 2).map((m) => m.id)
          : fetchedModels.slice(0, 2).map((m) => m.id);

      setSelectedModelIds(realToSelect);
      if (fetchedModels.length > 0) {
        setSelectedModelForTest(fetchedModels[0].id);
      }
    } catch (err: any) {
      setScanError(err.message || 'Model taraması sırasında bir hata oluştu.');
    } finally {
      setIsScanning(false);
    }
  }, []);

  const handleScanModels = useCallback(() => {
    handleScanModelsWithConfig(apiConfig);
  }, [apiConfig, handleScanModelsWithConfig]);

  // Automatically scan models only if an API key is provided OR it's a local endpoint without keys
  useEffect(() => {
    const hasKey =
      (apiConfig.apiKey && apiConfig.apiKey.trim().length > 0) ||
      (apiConfig.apiKeysPool && apiConfig.apiKeysPool.some((k) => k.isEnabled && k.key.trim().length > 0));
    const isLocal =
      apiConfig.baseUrl.includes('localhost') ||
      apiConfig.baseUrl.includes('127.0.0.1') ||
      apiConfig.baseUrl.includes('0.0.0.0');

    if ((hasKey || isLocal) && models.length === 0 && !isScanning && !scanError) {
      handleScanModels();
    }
  }, [apiConfig, models.length, handleScanModels, isScanning, scanError]);

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

  const handleBenchmarkCompleted = useCallback((record: BenchmarkRecord) => {
    setRecords((prev) => [record, ...prev]);
  }, []);

  const handleClearHistory = useCallback(() => {
    setRecords([]);
    localStorage.removeItem('openai_suite_benchmarks');
  }, []);

  const handleRunningStateChange = useCallback(
    (isRunning: boolean, progressPercent: number, testName: string, modelName: string) => {
      setBenchmarkRunningInfo((prev) => {
        if (
          prev.isRunning === isRunning &&
          prev.progressPercent === progressPercent &&
          prev.testName === testName &&
          prev.modelName === modelName
        ) {
          return prev;
        }
        return { isRunning, progressPercent, testName, modelName };
      });
    },
    []
  );

  const handleUpdateApiConfig = useCallback(
    (newCfg: ApiConfig) => {
      setApiConfig(newCfg);
      handleScanModelsWithConfig(newCfg);
    },
    [handleScanModelsWithConfig]
  );

  const handleSelectModelForBenchmark = useCallback((modelId: string) => {
    setSelectedModelIds((prev) => {
      if (!prev.includes(modelId)) {
        return [modelId, ...prev.slice(0, 2)];
      }
      return prev;
    });
  }, []);

  const handleGoToBenchmark = useCallback(() => {
    setActiveTab('benchmark');
  }, []);

  const handleGoToGuide = useCallback(() => {
    setActiveTab('guide');
  }, []);

  const handleOpenConfig = useCallback(() => {
    setIsConfigOpen(true);
  }, []);

  const handleCloseConfig = useCallback(() => {
    setIsConfigOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Universal Top Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiConfig={apiConfig}
        onOpenConfig={handleOpenConfig}
        modelsCount={models.length}
        testCount={records.length}
        benchmarkRunningInfo={benchmarkRunningInfo}
      />

      {/* Main Viewport Container (Persistent mounted views - tests never interrupt on tab switch) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className={activeTab === 'benchmark' ? 'block' : 'hidden'}>
          <BenchmarkSuiteView
            apiConfig={apiConfig}
            scannedModels={models}
            selectedModelIds={selectedModelIds}
            onBenchmarkCompleted={handleBenchmarkCompleted}
            onGoToModelGuide={handleGoToGuide}
            onTriggerScan={handleScanModels}
            isScanning={isScanning}
            scanError={scanError}
            onOpenConfig={handleOpenConfig}
            onUpdateSelectedModels={setSelectedModelIds}
            onUpdateApiConfig={handleUpdateApiConfig}
            onRunningStateChange={handleRunningStateChange}
          />
        </div>

        <div className={activeTab === 'ping' ? 'block' : 'hidden'}>
          <SpeedRadarView
            apiConfig={apiConfig}
            scannedModels={models}
            onTriggerScan={handleScanModels}
            isScanning={isScanning}
            onOpenConfig={handleOpenConfig}
            onBenchmarkRecordCreated={handleBenchmarkCompleted}
          />
        </div>

        <div className={activeTab === 'guide' ? 'block' : 'hidden'}>
          <ModelGuideView
            scannedModels={models}
            records={records}
            onSelectModelForBenchmark={handleSelectModelForBenchmark}
            onGoToBenchmark={handleGoToBenchmark}
            onTriggerScan={handleScanModels}
            isScanning={isScanning}
            onOpenConfig={handleOpenConfig}
          />
        </div>

        <div className={activeTab === 'endpoints' ? 'block' : 'hidden'}>
          <EndpointTester
            apiConfig={apiConfig}
            models={models}
            defaultSelectedModel={selectedModelForTest || models[0]?.id || ''}
            onBenchmarkCompleted={handleBenchmarkCompleted}
            onTriggerScan={handleScanModels}
          />
        </div>

        <div className={activeTab === 'reports' ? 'block' : 'hidden'}>
          <ReportingDashboard
            records={records}
            onClearHistory={handleClearHistory}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>Generic OpenAI Model Benchmark Suite</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-400">Gerçek API & Gerçek Modeller</span>
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
        onSave={(newCfg) => {
          setApiConfig(newCfg);
          handleScanModelsWithConfig(newCfg);
        }}
        onTestConnection={handleTestConnection}
      />
    </div>
  );
}
