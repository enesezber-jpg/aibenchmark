import type { EndpointType, PresetProvider } from '../types';

export const PRESET_PROVIDERS: PresetProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI (Official)',
    defaultBaseUrl: 'https://api.openai.com/v1',
    placeholderKey: 'sk-proj-...',
    description: 'Resmi OpenAI API uç noktası (GPT-4o, DALL-E, Whisper, Embeddings vb.)',
    supportsStreaming: true,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    placeholderKey: 'sk-or-v1-...',
    description: 'Tüm sağlayıcıları (Claude, Llama, Gemini, Mistral) tek API altında birleştiren ağ geçidi',
    supportsStreaming: true,
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    placeholderKey: 'gsk_...',
    description: 'LPU çipleriyle ultra yüksek hızlı çıkarım (Llama 3, Mixtral, Whisper)',
    supportsStreaming: true,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    placeholderKey: 'sk-...',
    description: 'DeepSeek-V3 ve DeepSeek-R1 modelleri için doğrudan OpenAI uyumlu uç nokta',
    supportsStreaming: true,
  },
  {
    id: 'ollama',
    name: 'Ollama (Yerel)',
    defaultBaseUrl: 'http://localhost:11434/v1',
    placeholderKey: 'Gerekli değil (boş bırakabilirsiniz)',
    description: 'Kendi makinenizde çalışan yerel modeller (Llama, Mistral, Qwen, Phi)',
    supportsStreaming: true,
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Yerel)',
    defaultBaseUrl: 'http://localhost:1234/v1',
    placeholderKey: 'Gerekli değil',
    description: 'LM Studio Local Server üzerinden OpenAI uyumlu API',
    supportsStreaming: true,
  },
  {
    id: 'together',
    name: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    placeholderKey: '...',
    description: 'Açık kaynak modeller ve hızlı çıkarım kümesi',
    supportsStreaming: true,
  },
  {
    id: 'custom',
    name: 'Özel API / vLLM / LiteLLM',
    defaultBaseUrl: 'https://your-custom-proxy.com/v1',
    placeholderKey: 'Özel API Anahtarı',
    description: 'Kendi kurduğunuz vLLM, TGI, LiteLLM veya kurumsal proxy adresiniz',
    supportsStreaming: true,
  },
];

export const ENDPOINT_DESCRIPTIONS: Record<
  EndpointType,
  {
    name: string;
    method: 'GET' | 'POST';
    category: 'Model' | 'Metin' | 'Görsel' | 'Ses' | 'Vektör' | 'Sıralama';
    description: string;
    typicalModel: string;
    defaultPayload: any;
  }
> = {
  '/models': {
    name: 'Modelleri Listele',
    method: 'GET',
    category: 'Model',
    description: 'Sağlayıcıda kullanılabilir olan tüm modelleri ve yetenekleri tarar.',
    typicalModel: '',
    defaultPayload: {},
  },
  '/chat/completions': {
    name: 'Sohbet Tamamlama',
    method: 'POST',
    category: 'Metin',
    description: 'Çok turlu diyalog, sistem yönergesi ve talimat tamamlama uç noktası.',
    typicalModel: 'gpt-4o-mini',
    defaultPayload: {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Sen son derece analitik, tarafsız ve özlü bir yapay zeka asistanısın.' },
        { role: 'user', content: 'Kuantum bilgisayarlar ile klasik bilgisayarlar arasındaki 3 temel farkı maddeler halinde açıkla.' },
      ],
      temperature: 0.7,
      max_tokens: 400,
      stream: false,
    },
  },
  '/completions': {
    name: 'Metin Tamamlama (Legacy)',
    method: 'POST',
    category: 'Metin',
    description: 'Tekli girdi metnini devam ettiren ham tamamlama uç noktası.',
    typicalModel: 'gpt-3.5-turbo-instruct',
    defaultPayload: {
      model: 'gpt-3.5-turbo-instruct',
      prompt: 'Güneş enerjisi panellerinin verimliliğini artıran yeni nesil teknolojiler şunlardır:\n1.',
      temperature: 0.6,
      max_tokens: 300,
    },
  },
  '/images/generations': {
    name: 'Görsel Üretimi',
    method: 'POST',
    category: 'Görsel',
    description: 'Metin açıklamasından görsel üreten uç nokta (DALL-E 3, Stable Diffusion vb.).',
    typicalModel: 'dall-e-3',
    defaultPayload: {
      model: 'dall-e-3',
      prompt: 'Minimalist neon lines glowing in deep space, hyper-detailed cyberpunk prism aesthetic, 8k render',
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    },
  },
  '/audio/transcriptions': {
    name: 'Ses Deşifresi (Whisper)',
    method: 'POST',
    category: 'Ses',
    description: 'Ses dosyasını metne dönüştüren konuşma tanıma uç noktası.',
    typicalModel: 'whisper-1',
    defaultPayload: {
      model: 'whisper-1',
      language: 'tr',
      response_format: 'json',
      prompt: 'Teknik ve yazılım terimleri içeren konuşma',
    },
  },
  '/audio/speech': {
    name: 'Metinden Sese (TTS)',
    method: 'POST',
    category: 'Ses',
    description: 'Yazılı metni gerçekçi sese (MP3/Opus/AAC) dönüştüren uç nokta.',
    typicalModel: 'tts-1',
    defaultPayload: {
      model: 'tts-1',
      input: 'Merhaba! Generic OpenAI uyumlu model test ve analiz sistemine hoş geldiniz. Performans ölçümleri tamamlandı.',
      voice: 'alloy',
      response_format: 'mp3',
      speed: 1.0,
    },
  },
  '/embeddings': {
    name: 'Vektör Temsili (Embeddings)',
    method: 'POST',
    category: 'Vektör',
    description: 'Metinleri anlamsal arama ve RAG için yüksek boyutlu sayısal vektörlere dönüştürür.',
    typicalModel: 'text-embedding-3-small',
    defaultPayload: {
      model: 'text-embedding-3-small',
      input: [
        'Yapay zeka modellerinin gecikme süresi ve hız testi',
        'Vektör veritabanları ile anlamsal belge araması',
      ],
      encoding_format: 'float',
    },
  },
  '/messages': {
    name: 'Messages API (Anthropic/Generic)',
    method: 'POST',
    category: 'Metin',
    description: 'Anthropic Claude veya AWS Bedrock uyumlu mesajlaşma uç noktası.',
    typicalModel: 'claude-3-5-sonnet-20241022',
    defaultPayload: {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      system: 'Sen sistem mimarı ve kıdemli yazılım mühendisisin.',
      messages: [
        { role: 'user', content: 'Mikroservis mimarisinde API Gateway kullanımının avantaj ve dezavantajlarını özetle.' },
      ],
    },
  },
  '/score': {
    name: 'Skorlama / Sınıflandırma (Score)',
    method: 'POST',
    category: 'Sıralama',
    description: 'Ödül modelleri veya aday metin alaka düzeyi skorlama uç noktası.',
    typicalModel: 'bge-reranker-large',
    defaultPayload: {
      model: 'bge-reranker-large',
      query: 'OpenAI uyumlu API test aracı nasıl çalışır?',
      candidates: [
        'Sistem HTTP isteklerini yönlendirip gecikme ve token hızını analiz eder.',
        'Hava durumu yarın İstanbul genelinde parçalı bulutlu olacak.',
        'Uç noktalara doğrudan ve proxy üzerinden test istekleri gönderilir.',
      ],
    },
  },
  '/rerank': {
    name: 'Yeniden Sıralama (Rerank)',
    method: 'POST',
    category: 'Sıralama',
    description: 'Cohere / Jina / BGE uyumlu RAG yeniden sıralama uç noktası.',
    typicalModel: 'rerank-english-v3.0',
    defaultPayload: {
      model: 'rerank-english-v3.0',
      query: 'Derin öğrenme modellerinde gecikme süresini (latency) düşürme yöntemleri',
      documents: [
        'Model kuantizasyonu (INT8/FP4) ve KV-cache optimizasyonları gecikmeyi önemli ölçüde azaltır.',
        'Veritabanı indeksleme algoritmaları B-Tree ve Hash temelli yapılandırılır.',
        'Speculative decoding ve vLLM PagedAttention yüksek verimlilik sağlar.',
        'CSS animasyonları GPU hızlandırması ile 60 fps akıcılık sunar.',
      ],
      top_n: 3,
      return_documents: true,
    },
  },
};
