import type { BenchmarkCategory, BenchmarkTestDefinition, ModelGuideProfile } from '../types';

export const BENCHMARK_TESTS: BenchmarkTestDefinition[] = [
  {
    id: 'doc_analysis_sla',
    name: 'Döküman Analizi: Karmaşık Sözleşme & RAG İğne Arama',
    category: 'document_analysis',
    categoryName: 'Döküman Analizi (Öncelikli)',
    importance: 'Kritik (Ana Konu)',
    description: 'Uzun metinli kurumsal SLA sözleşmesinden çapraz şartları, cezai hükümleri ve gizli istisnaları hatasız çıkarma testi.',
    maxTokens: 600,
    temperature: 0.2,
    systemPrompt: 'Sen kurumsal hukuk ve teknik sözleşmeler konusunda uzman, sıfır halüsinasyonla çalışan titiz bir analistsin. Sadece verilen metne sadık kal.',
    userPrompt: `Aşağıdaki Bulut Hizmet Seviyesi Sözleşmesi (SLA) metnini dikkatle analiz et ve altındaki 3 soruyu maddeler halinde kesin verilerle yanıtla:

[METİN]:
"MADDE 4 - HİZMET KESİNTİSİ VE KREDİ TAAHHÜTLERİ:
4.1. Sağlayıcı, takvim ayı boyunca %99.95 çalışma süresi (Uptime) garanti eder. Planlı bakım çalışmaları her ayın ilk Pazar günü 02:00-05:00 UTC arasında yapılabilir ve kesinti süresine dahil edilmez.
4.2. Uptime %99.90 ile %99.94 arasına düşerse aylık fatura bedelinin %10'u; %95.00 ile %99.89 arasına düşerse %25'i; %95.00 altına düşerse %50'si Hizmet Kredisi olarak iade edilir.
4.3. İSTİSNA: Müşterinin DNS sağlayıcısından veya üçüncü taraf DDoS saldırılarından kaynaklanan kesintiler kredi kapsamı dışındadır.
4.4. VERİ SAKLAMA VE İMHA: Sözleşme feshini takiben Müşteri verileri 45 gün boyunca 'salt-okunur' arşivde tutulur, 46. gün geri döndürülemez biçimde kriptografik olarak imha edilir. Ancak adli soruşturma bildirimi varsa bu süre 180 güne uzatılır.
4.5. CEZAİ ŞART: Veri sızıntısının Sağlayıcının ağır kusurundan kaynaklanması halinde Sağlayıcı, son 12 ayda tahsil ettiği toplam lisans bedelinin 3 katı tutarında tazminat ödemeyi peşinen kabul eder."

[SORULAR]:
1. Bir ayda Uptime %98.40 olarak gerçekleşirse müşteriye ne oranda hizmet kredisi iade edilir ve hangi kesintiler istisna tutulur?
2. Sözleşme feshedildikten sonra adli soruşturma yoksa veriler kaçıncı gün imha edilir, soruşturma varsa süre ne kadardır?
3. Sağlayıcının ağır kusurlu veri sızıntısında ödeyeceği azami tazminat formülü nedir?`,
    evaluationCriteria: [
      '%25 kredi oranı doğru tespit edildi mi?',
      'DNS ve 3. taraf DDoS istisnası belirtildi mi?',
      '46. gün normal imha, 180 gün adli süre doğru verildi mi?',
      'Son 12 ayın lisans bedelinin 3 katı cezai şartı doğru yazıldı mı?',
    ],
    expectedKeywords: ['%25', 'DDoS', '46', '180', '3 katı'],
  },
  {
    id: 'coding_concurrency',
    name: 'Kod Yazma: TypeScript Concurrency & Race Condition Çözümü',
    category: 'coding',
    categoryName: 'Kod Yazma & Mühendislik (Öncelikli)',
    importance: 'Kritik (Ana Konu)',
    description: 'Eşzamanlı istekleri yöneten, hata durumunda exponential backoff ile tekrar deneyen ve tip güvenli TaskQueue sınıfı yazma testi.',
    maxTokens: 800,
    temperature: 0.2,
    systemPrompt: 'Sen kıdemli bir TypeScript yazılım mimarısın. Üretim ortamına hazır (production-grade), bellek sızıntısız ve temiz kod yazarsın.',
    userPrompt: `TypeScript ile üretim standardında bir 'ConcurrentTaskQueue<T>' sınıfı yaz.
Gereksinimler:
1. 'concurrency: number' (aynı anda en fazla çalışan görev sayısı) ve 'maxRetries: number' parametrelerini alsın.
2. 'add(task: () => Promise<T>): Promise<T>' metodu olsun ve her görevin sonucunu orijinal Promise ile dönsün.
3. Bir görev hata verirse 'maxRetries' adedine kadar exponential backoff (örn: 100ms * 2^retry) ile tekrar denensin.
4. Sıra bittiğinde veya tüm görevler tamamlandığında 'onIdle()' event/promise desteği olsun.
5. Tip güvenli (Generic <T>) ve bellek sızıntısını engelleyen temiz kod olmalıdır. Sadece kodu ve kritik notları açıkla.`,
    evaluationCriteria: [
      'Generic <T> tür güvenliği sağlandı mı?',
      'Eşzamanlılık (concurrency) havuz mantığı doğru kuruldu mu?',
      'Exponential backoff tekrar deneme mantığı yazıldı mı?',
      'Her task için Promise çözümlemesi (resolve/reject) hatasız mı?',
    ],
    expectedKeywords: ['class ConcurrentTaskQueue', 'Promise', 'concurrency', 'retry', 'resolve'],
  },
  {
    id: 'reasoning_math',
    name: 'Mantık & Muhakeme: Çok Adımlı Çıkarım & Optimizasyon',
    category: 'reasoning',
    categoryName: 'Mantık & Muhakeme',
    importance: 'Önemli',
    description: 'Adım adım düşünme (Chain-of-thought) gerektiren, yanıltıcı öncüller içeren karmaşık optimizasyon problemi.',
    maxTokens: 500,
    temperature: 0.3,
    systemPrompt: 'Sen analitik ve mantıksal çıkarım uzmanısın. Her adımı kanıtlayarak açıkla.',
    userPrompt: `Bir yazılım şirketinde 3 sunucu kümesi (A, B, C) var.
- A kümesi saatte 1200 istek işliyor ve saatlik maliyeti 4$.
- B kümesi saatte 1800 istek işliyor ve saatlik maliyeti 5.5$.
- C kümesi saatte 3000 istek işliyor ve saatlik maliyeti 8.5$.

Sistem saatte ortalama 7000 istek alıyor ve isteklerin kesintisiz karşılanması gerekiyor.
Her kümeden en fazla 2 adet açabilirsiniz.
1. 7000 isteği tam veya fazlasıyla karşılayacak en ucuz sunucu kombinasyonunu bulunuz.
2. Bu kombinasyonun toplam saatlik maliyetini ve toplam işleme kapasitesini hesaplayınız.
3. Neden diğer olası kombinasyonlardan (örn: 2x C + 1x A gibi) daha ucuz olduğunu maliyet/istek verimliliğiyle kanıtlayınız.`,
    evaluationCriteria: [
      'Tüm kombinasyonlar incelendi mi?',
      'En ucuz kombinasyon doğru bulundu mu (B + C veya benzeri kapasite/maliyet optimizasyonu)?',
      'Toplam saatlik maliyet ve kapasite doğru toplandı mı?',
    ],
    expectedKeywords: ['maliyet', 'kapasite', 'saat'],
  },
  {
    id: 'json_schema_extraction',
    name: 'Yapılandırılmış Çıktı & Sıkı JSON Schema Uyumu',
    category: 'json_instruction',
    categoryName: 'JSON & Talimat Takibi',
    importance: 'Önemli',
    description: 'Markdown ön eki veya selamlama olmadan, doğrudan doğrulanabilir JSON şemasına uyum testi.',
    maxTokens: 400,
    temperature: 0.1,
    requiresJson: true,
    systemPrompt: 'YALNIZCA geçerli JSON formatında çıktı ver. Yanıtında hiçbir markdown (```json gibi bloklar dahil), selamlama veya açıklama yazma. Sadece saf JSON stringi üret.',
    userPrompt: `Aşağıdaki profili belirtilen JSON şemasına dönüştür:
"Mehmet Yılmaz, 34 yaşında, Kıdemli Bulut Mimarı (10 yıl tecrübe). Yetenekleri: Kubernetes, Go, Terraform. İngilizce (İleri) ve Almanca (Orta) biliyor. Mevcut durumu: Açık kaynak projelere katkı sağlıyor, uzaktan çalışmaya uygun."

JSON Şeması:
{
  "full_name": string,
  "age": number,
  "role": string,
  "experience_years": number,
  "skills": string[],
  "languages": [{"lang": string, "level": string}],
  "remote_available": boolean
}`,
    evaluationCriteria: [
      'Çıktı JSON.parse ile hatasız ayrıştırılabiliyor mu?',
      'Şema anahtarları ve tipleri (number, array, object) tam uyumlu mu?',
      'Markdown veya ekstra metin içermiyor mu?',
    ],
    expectedKeywords: ['full_name', 'experience_years', 'remote_available'],
  },
  {
    id: 'speed_latency_test',
    name: 'Hız & Çıkarım Verimliliği: Canlı Akış & TTFT Testi',
    category: 'speed',
    categoryName: 'Hız & Çıkarım Performansı',
    importance: 'Standart',
    description: 'Modelin ilk tokena ulaşma süresi (TTFT) ve saniyedeki token üretim hızını (tok/s) ölçen akıcı üretim testi.',
    maxTokens: 350,
    temperature: 0.7,
    systemPrompt: 'Sen hızlı, net ve özlü konuşan bir yapay zekasın.',
    userPrompt: 'Yapay zeka modellerinin çıkarım hızını (inference latency) doğrudan etkileyen 5 donanımsal ve yazılımsal faktörü maddeler halinde yaz.',
    evaluationCriteria: [
      'Gecikme süresi 1000ms altında mı?',
      'Token hızı 50 tok/s üzerinde mi?',
    ],
  },
  {
    id: 'turkish_language_fidelity',
    name: 'Türkçe Dil Yetkinliği: Deyim & Teknik Çeviri Kalitesi',
    category: 'turkish_language',
    categoryName: 'Türkçe Dil Kalitesi',
    importance: 'Önemli',
    description: 'Mekanik çeviri tuzaklarına düşmeden akıcı, doğal ve kurumsal Türkçe dil hakimiyeti testi.',
    maxTokens: 450,
    temperature: 0.3,
    systemPrompt: 'Sen usta bir Türk dili uzmanı ve teknik çevirmensin. Dilbilgisi, anlatım bozuklukları ve doğal Türkçe akıcılığına azami özen gösterirsin.',
    userPrompt: `1. Şu İngilizce cümleyi kulağa çeviri gibi gelmeyen, doğal ve kurumsal bir Türkçe ile çevir:
"By deprecating legacy monolithic endpoints in favor of event-driven asynchronous microservices, we eliminated downstream cascading bottlenecks."

2. Şu Türkçe cümleyi anlatım bozukluğundan arındırıp profesyonel hale getir:
"Sistemdeki mevcut olan açıkların kapatılması amacıyla personellere gereken zorunlu bilgilendirmeler yapılması sağlandı."

3. "İğneyle kuyu kazmak" ve "Tereciye tere satmak" deyimlerinin yazılım mühendisliğindeki karşılıklarını birer cümleyle açıkla.`,
    evaluationCriteria: [
      'Teknik terimler Türkçeye akıcı uyarlandı mı?',
      'Gereksiz sözcük kullanımı (mevcut olan, gereken zorunlu) temizlendi mi?',
      'Deyimler yazılım bağlamında doğru benzetmeyle açıklandı mı?',
    ],
    expectedKeywords: ['darboğaz', 'olay güdümlü', 'bilgilendirme'],
  },
];

/**
 * Curated knowledge base of known models with practical "how and where to use" advice
 */
export const MODEL_GUIDE_DATABASE: ModelGuideProfile[] = [
  {
    idPattern: 'gpt-4o',
    displayName: 'GPT-4o (Omni)',
    provider: 'OpenAI',
    contextWindow: '128K Token',
    codingRating: 5,
    documentRating: 5,
    speedRating: 4,
    costTier: 'Orta',
    bestFor: 'Kapsamlı Döküman Analizi, Karmaşık Kod Mimarisi, Görsel/Ses Anlama',
    strengths: [
      'Uzun hukuki ve teknik sözleşmelerde sıfıra yakın halüsinasyon',
      'Çok dilli kodlama (TypeScript, Python, Rust, SQL)',
      'Görsel tabloları ve şemaları metne dönüştürmede çok üstün',
      'Geniş 128k bağlam penceresi',
    ],
    weaknesses: [
      'Hafif chatbot görevleri için maliyeti gpt-4o-mini\'ye göre daha yüksek',
    ],
    whereToUse: 'Büyük PDF/RAG sözleşme analizi, tam kapsamlı backend/frontend kod yazımı, mimari tasarım ve doğrudan karar verici kurumsal sistemler.',
    whereNotToUse: 'Tek satırlık veri sınıflandırma, basit veri etiketleme veya bütçe odaklı yüksek trafikli basit botlar.',
    recommendedParams: {
      temperature: 0.2,
      maxTokens: 2000,
      systemTip: 'Döküman analizinde: "Yalnızca verilen metne dayan ve alıntı yap." kuralı koyun.',
    },
  },
  {
    idPattern: 'gpt-4o-mini',
    displayName: 'GPT-4o-mini',
    provider: 'OpenAI',
    contextWindow: '128K Token',
    codingRating: 4,
    documentRating: 4,
    speedRating: 5,
    costTier: 'Düşük',
    bestFor: 'Yüksek Hızlı API İstekleri, Orta Düzey Döküman Özeti, Maliyet Odaklı Kodlama',
    strengths: [
      'İnanılmaz yüksek hız (genelde 100+ tok/s)',
      'Çok düşük API maliyeti (GPT-4o\'dan ~15 kat daha ekonomik)',
      '128k context desteği sayesinde uzun metinleri rahatça okur',
      'Günlük kodlama ve script yazımında çok başarılı',
    ],
    weaknesses: [
      'Çok katmanlı, 5+ aşamalı soyut mantık bulmacalarında GPT-4o kadar derinleşemeyebilir',
    ],
    whereToUse: 'Müşteri destek botları, toplu döküman sınıflandırma ve filtreleme, CRUD kod yazımı, veri dönüşümleri ve yüksek trafikli backend akışları.',
    whereNotToUse: 'Karmaşık yasal davaların ince elenip sık dokunduğu sözleşme analizleri veya devasa mimari refactor işlemleri.',
    recommendedParams: {
      temperature: 0.3,
      maxTokens: 1000,
      systemTip: 'JSON çıktısı alırken JSON Mode (response_format: json_object) aktif edin.',
    },
  },
  {
    idPattern: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'Anthropic / OpenRouter / Bedrock',
    contextWindow: '200K Token',
    codingRating: 5,
    documentRating: 5,
    speedRating: 4,
    costTier: 'Orta',
    bestFor: 'Zirve Kod Yazma Kalitesi, 200K Uzun Döküman Analizi, Doğal Dil & Yazım',
    strengths: [
      'Yazılım mühendisliğinde ve karmaşık kod refactoringinde endüstri lideri',
      '200K token bağlamıyla devasa teknik şartnameleri ve kitapları tek seferde işler',
      'İnsansı, son derece doğal ve akıcı Türkçe anlatım kalitesi',
    ],
    weaknesses: [
      'API erişimi Anthropic veya OpenRouter üzerinden yapılandırılmalıdır',
    ],
    whereToUse: 'Tam kod tabanı revizyonları, hata ayıklama (debugging), yüzlerce sayfalık rapor analizi ve akademik makale sentezi.',
    whereNotToUse: 'Gecikme süresinin <200ms olması gereken ultra düşük gecikmeli basit çağrılar.',
    recommendedParams: {
      temperature: 0.2,
      maxTokens: 3000,
      systemTip: 'Kod yazarken sistem yönergesine "Adım adım açıkla ve TypeScript strict mode kurallarına uy" ekleyin.',
    },
  },
  {
    idPattern: 'deepseek-chat',
    displayName: 'DeepSeek-V3',
    provider: 'DeepSeek / OpenRouter',
    contextWindow: '64K Token',
    codingRating: 5,
    documentRating: 4,
    speedRating: 4,
    costTier: 'Düşük',
    bestFor: 'Fiyat/Performans Şampiyonu, Yazılım Geliştirme, Matematik & Mantık',
    strengths: [
      'GPT-4o kalitesinde kod yazma yeteneğini çok cüzi bir fiyata sunar',
      'Algoritma, veri yapıları ve SQL optimizasyonunda olağanüstü başarılı',
      'Türkçe dil desteği oldukça güçlü',
    ],
    weaknesses: [
      'Çok yoğun saatlerde resmi API gecikmesi dalgalanabilir (yedek API önerilir)',
    ],
    whereToUse: 'Bütçe dostu kodlama asistanları, otomatik test yazımı, RAG ve doküman soru-cevap sistemleri.',
    whereNotToUse: 'Görsel girdi gerektiren multimodal analizler (DeepSeek-V3 metin odaklıdır).',
    recommendedParams: {
      temperature: 0.3,
      maxTokens: 1500,
      systemTip: 'Kod isteklerinde beklenen dili ve kütüphane versiyonlarını açıkça belirtin.',
    },
  },
  {
    idPattern: 'deepseek-r1',
    displayName: 'DeepSeek-R1 (Reasoning)',
    provider: 'DeepSeek / OpenRouter / Groq',
    contextWindow: '64K Token',
    codingRating: 5,
    documentRating: 4,
    speedRating: 3,
    costTier: 'Düşük',
    bestFor: 'Derin Akıl Yürütme (Chain of Thought), Zorlu Matematik & Karmaşık Kod Hataları',
    strengths: [
      'Cevap vermeden önce <think> etiketleri arasında derin mantık zinciri kurar',
      'Yarışma düzeyinde algoritma ve matematik problemlerini çözer',
      'Karmaşık mantık tuzaklarını ve gizli kod açıklarını tespit eder',
    ],
    weaknesses: [
      'Düşünme süreci nedeniyle ilk token gecikmesi (TTFT) daha yüksektir',
    ],
    whereToUse: 'Zorlu bug avcılığı, mimari optimizasyon, yasal mantık sentezi ve matematiksel modelleme.',
    whereNotToUse: 'Anlık yanıt gerektiren canlı sohbet botları veya basit format dönüşümleri.',
    recommendedParams: {
      temperature: 0.6,
      maxTokens: 4000,
      systemTip: 'Düşünme alanını serbest bırakmak için max_tokens değerini yüksek tutun.',
    },
  },
  {
    idPattern: 'llama-3',
    displayName: 'Meta Llama 3 / 3.3 (70B)',
    provider: 'Groq / Ollama / Together',
    contextWindow: '128K Token',
    codingRating: 4,
    documentRating: 4,
    speedRating: 5,
    costTier: 'Ücretsiz / Yerel',
    bestFor: 'Groq ile 300+ tok/s Ultra Hız, Yerel Gizlilik (Ollama), Açık Kaynak Gücü',
    strengths: [
      'Groq LPU donanımında saniyede 300+ token ile anında yanıt üretir',
      'Kendi sunucunuzda (Ollama/vLLM) sıfır veri sızıntısıyla çalıştırılabilir',
      'Genel amaçlı kodlama ve doküman özetlemede dengeli performans',
    ],
    weaknesses: [
      'Küçük 8B modelleri çok uzun ve karmaşık hukuki sözleşmelerde 70B kadar keskin değildir',
    ],
    whereToUse: 'Şirket içi hassas verilerin yerel analizi, ultra hızlı canlı arayüzler ve açık kaynak entegrasyonları.',
    whereNotToUse: 'Aşırı niş ve egzotik programlama dilleri veya çok nadir kütüphaneler.',
    recommendedParams: {
      temperature: 0.4,
      maxTokens: 1000,
      systemTip: 'Talimatları madde imleriyle ve net sınırlarla verin.',
    },
  },
  {
    idPattern: 'qwen',
    displayName: 'Qwen 2.5 Coder',
    provider: 'Alibaba / OpenRouter / Ollama',
    contextWindow: '128K Token',
    codingRating: 5,
    documentRating: 4,
    speedRating: 4,
    costTier: 'Düşük',
    bestFor: 'Uzmanlaşmış Kod Yazma, Hata Düzeltme, 128K Kod Tabanı İncelemesi',
    strengths: [
      'Kodlama benchmarklarında GPT-4o ile başa baş veya önde çıkan açık model',
      'Büyük kod depolarını ve dokümanlarını anlama yeteneği',
    ],
    weaknesses: [
      'Salt edebi ve felsefi yazılarda genel modeller kadar zengin olmayabilir',
    ],
    whereToUse: 'Yazılım IDE eklentileri, otomatik PR inceleme araçları ve kod refactoring.',
    whereNotToUse: 'Duygu yüklü pazarlama metinleri veya yaratıcı edebi yazarlık.',
    recommendedParams: {
      temperature: 0.2,
      maxTokens: 2000,
      systemTip: 'Kod yazarken "Unit testleri ve Edge-case senaryolarını da dahil et" deyin.',
    },
  },
];

/**
 * Match a model ID to the best matching profile or generate an intelligent profile
 */
export function findMatchingModelGuide(modelId: string): ModelGuideProfile {
  const lower = modelId.toLowerCase();

  for (const guide of MODEL_GUIDE_DATABASE) {
    if (lower.includes(guide.idPattern)) {
      return guide;
    }
  }

  // Fallback intelligent profile
  const isCoding = lower.includes('coder') || lower.includes('code');
  const isMini = lower.includes('mini') || lower.includes('flash') || lower.includes('small') || lower.includes('8b');

  return {
    idPattern: modelId,
    displayName: modelId,
    provider: 'OpenAI Uyumlu Sağlayıcı',
    contextWindow: isMini ? '32K - 64K' : '128K Token',
    codingRating: isCoding ? 4 : 3,
    documentRating: 3,
    speedRating: isMini ? 5 : 4,
    costTier: isMini ? 'Düşük' : 'Orta',
    bestFor: isCoding ? 'Kod Geliştirme ve Scriptler' : 'Genel Metin ve Soru-Cevap',
    strengths: [
      'OpenAI API uyumluluğu ile tüm standart istemleri destekler',
      'Hızlı entegrasyon ve esnek çıkarım',
    ],
    weaknesses: [
      'Spesifik test sonuçları benchmark laboratuvarından ölçülmelidir',
    ],
    whereToUse: 'Genel amaçlı diyalog, API sorguları ve otomatik veri işleme.',
    whereNotToUse: 'Hatasızlık gerektiren kritik kurumsal sözleşmeler öncesinde benchmark yapılması önerilir.',
    recommendedParams: {
      temperature: 0.3,
      maxTokens: 1000,
      systemTip: 'Rolü net tanımlayın ve girdi verilerini açık sınırlayıcılarla (örneğin [METİN]) ayırın.',
    },
  };
}

/**
 * Automated scoring rubric for a benchmark test
 */
export function evaluateTestOutput(
  testDef: BenchmarkTestDefinition,
  rawOutput: string,
  latencyMs: number,
  tokensPerSec?: number
): { score: number; critique: string; matchedKeywords: string[] } {
  if (!rawOutput || rawOutput.trim().length === 0) {
    return { score: 0, critique: 'Model hiçbir yanıt üretmedi (Boş yanıt veya API hatası).', matchedKeywords: [] };
  }

  let score = 45; // Temel yanıt üretme taban puanı
  const matchedKeywords: string[] = [];
  const lowerOutput = rawOutput.toLowerCase();

  // Teste özel zenginleştirilmiş anahtar kontrol
  if (testDef.id === 'doc_analysis_sla') {
    // 1. Soru: %25 veya yüzde 25
    const hasRate = lowerOutput.includes('%25') || lowerOutput.includes('yüzde 25') || lowerOutput.includes('25%');
    if (hasRate) { score += 15; matchedKeywords.push('%25 Kredi'); }

    // 2. Soru: DNS veya DDoS istisnası
    const hasExemption = lowerOutput.includes('ddos') || lowerOutput.includes('dns');
    if (hasExemption) { score += 10; matchedKeywords.push('DDoS/DNS İstisnası'); }

    // 3. Soru: 46 gün / 45 gün imha, 180 gün adli süre
    const hasDestruction = lowerOutput.includes('46') || lowerOutput.includes('45');
    const hasInvestigation = lowerOutput.includes('180');
    if (hasDestruction && hasInvestigation) { score += 15; matchedKeywords.push('46/180 Gün Süre'); }
    else if (hasDestruction || hasInvestigation) { score += 8; matchedKeywords.push('Kısmi Süre'); }

    // 4. Soru: 3 katı veya üç katı cezai şart
    const hasPenalty = lowerOutput.includes('3 kat') || lowerOutput.includes('üç kat') || lowerOutput.includes('3x');
    if (hasPenalty) { score += 15; matchedKeywords.push('3 Katı Tazminat'); }
  } else if (testDef.id === 'coding_concurrency') {
    // ConcurrentTaskQueue, Class
    const hasClass = lowerOutput.includes('class') || lowerOutput.includes('taskqueue') || lowerOutput.includes('queue');
    if (hasClass) { score += 10; matchedKeywords.push('Sınıf Mimarisi'); }

    // Concurrency kontrolü
    const hasConcurrency = lowerOutput.includes('concurrency') || lowerOutput.includes('active') || lowerOutput.includes('running');
    if (hasConcurrency) { score += 12; matchedKeywords.push('Eşzamanlılık Limiti'); }

    // Retry / Exponential Backoff
    const hasRetry = lowerOutput.includes('retry') || lowerOutput.includes('backoff') || lowerOutput.includes('pow') || lowerOutput.includes('maxretries');
    if (hasRetry) { score += 15; matchedKeywords.push('Exponential Backoff Tekrarı'); }

    // Promise / Generic / Resolve / Reject
    const hasPromise = lowerOutput.includes('promise') && (lowerOutput.includes('resolve') || lowerOutput.includes('reject'));
    if (hasPromise) { score += 13; matchedKeywords.push('Promise & Tip Güvenliği'); }
  } else if (testDef.id === 'json_schema_extraction') {
    // Saf JSON parse kontrolü
    const cleanJson = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
    let parsed: any = null;
    try {
      parsed = JSON.parse(cleanJson);
      score += 25;
      matchedKeywords.push('Geçerli JSON Formatı');
    } catch {
      score -= 25;
    }

    if (parsed && typeof parsed === 'object') {
      if (parsed.full_name) { score += 7; matchedKeywords.push('full_name'); }
      if (parsed.experience_years !== undefined) { score += 7; matchedKeywords.push('experience_years'); }
      if (Array.isArray(parsed.skills)) { score += 8; matchedKeywords.push('skills dizisi'); }
      if (parsed.remote_available !== undefined) { score += 8; matchedKeywords.push('remote_available'); }
    }

    // Markdown içermeme şartı
    if (rawOutput.includes('```')) {
      score -= 10; // Saf JSON istenmişti, markdown koymuş
    }
  } else if (testDef.id === 'reasoning_math') {
    // 7000 istek, maliyet optimizasyonu
    const has7000 = lowerOutput.includes('7000') || lowerOutput.includes('istek');
    const hasCost = lowerOutput.includes('maliyet') || lowerOutput.includes('dolar') || lowerOutput.includes('$');
    const hasCapacity = lowerOutput.includes('kapasite') || lowerOutput.includes('saat');

    if (has7000) { score += 15; matchedKeywords.push('7000 İstek Analizi'); }
    if (hasCost) { score += 15; matchedKeywords.push('Maliyet Hesaplaması'); }
    if (hasCapacity) { score += 15; matchedKeywords.push('Kapasite Çıkarımı'); }
  } else if (testDef.id === 'turkish_language_fidelity') {
    const hasDarboğaz = lowerOutput.includes('darboğaz') || lowerOutput.includes('bottleneck');
    const hasOlayGüdümlü = lowerOutput.includes('olay') || lowerOutput.includes('asenkron') || lowerOutput.includes('mikroservis');
    const hasDeyim = lowerOutput.includes('iğne') || lowerOutput.includes('tere');

    if (hasDarboğaz) { score += 15; matchedKeywords.push('Teknik Terim Türkçeleştirme'); }
    if (hasOlayGüdümlü) { score += 15; matchedKeywords.push('Akıcı Cümle Yapısı'); }
    if (hasDeyim) { score += 15; matchedKeywords.push('Yazılım Deyim Analojisi'); }
  } else {
    // Genel anahtar kontrolü
    if (testDef.expectedKeywords && testDef.expectedKeywords.length > 0) {
      let found = 0;
      testDef.expectedKeywords.forEach((kw) => {
        if (lowerOutput.includes(kw.toLowerCase())) {
          found++;
          matchedKeywords.push(kw);
        }
      });
      score += (found / testDef.expectedKeywords.length) * 35;
    } else {
      score += 25;
    }
  }

  // Hız ve gecikme etkisi
  if (tokensPerSec && tokensPerSec > 60) {
    score += 5;
  }
  if (latencyMs < 1200) {
    score += 5;
  } else if (latencyMs > 6000) {
    score -= 5;
  }

  const finalScore = Math.max(15, Math.min(100, Math.round(score)));

  let critique = '';
  if (finalScore >= 85) {
    critique = `Mükemmel Başarı (%${finalScore}): Model beklenen tüm kritik verileri ve yapıları (${matchedKeywords.join(', ') || 'tüm kriterler'}) eksiksiz sundu. Bu alanda üstün performansa sahiptir.`;
  } else if (finalScore >= 65) {
    critique = `İyi Düzey (%${finalScore}): Temel gereksinimler (${matchedKeywords.join(', ') || 'kısmi veriler'}) karşılandı, ancak bazı ince ayrıntılar veya kısıtlar tam eksiksiz yakalanamadı.`;
  } else {
    critique = `Geliştirilmeli (%${finalScore}): Kritik kriterlerin bir kısmı (${matchedKeywords.length > 0 ? matchedKeywords.join(', ') + ' yakalandı, gerisi eksik' : 'kriterler eksik'}) karşılanamadı. Bu görev türü için daha yetkin bir model tercih edilmesi tavsiye edilir.`;
  }

  return { score: finalScore, critique, matchedKeywords };
}
