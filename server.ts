import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

// Increase payload limits for audio/images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Generic OpenAI Proxy endpoint
app.post('/api/proxy', async (req: Request, res: Response): Promise<void> => {
  const startTime = performance.now();
  try {
    const {
      baseUrl,
      endpoint,
      method = 'POST',
      apiKey,
      headers: customHeaders = {},
      body: requestBody,
      isAudioSpeech = false,
      isAudioTranscription = false,
      audioBase64,
      audioFileName = 'audio.mp3',
      transcriptionModel = 'whisper-1',
      transcriptionPrompt,
      transcriptionLanguage,
      transcriptionFormat = 'json',
      stream = false,
    } = req.body;

    if (!baseUrl) {
      res.status(400).json({ error: 'Base URL gereklidir (Base URL is required)' });
      return;
    }

    // Clean up base URL and endpoint
    let cleanBaseUrl = baseUrl.trim().replace(/\/+$/, '');
    let cleanEndpoint = (endpoint || '').trim();
    if (!cleanEndpoint.startsWith('/')) {
      cleanEndpoint = '/' + cleanEndpoint;
    }

    // If endpoint starts with /v1 and baseUrl already ends with /v1, remove one
    if (cleanBaseUrl.endsWith('/v1') && cleanEndpoint.startsWith('/v1/')) {
      cleanEndpoint = cleanEndpoint.replace(/^\/v1/, '');
    }

    const targetUrl = `${cleanBaseUrl}${cleanEndpoint}`;

    // Prepare headers
    const requestHeaders: Record<string, string> = {
      ...customHeaders,
    };

    if (apiKey && apiKey.trim()) {
      requestHeaders['Authorization'] = `Bearer ${apiKey.trim()}`;
    }

    // Audio Transcription (Whisper) handling with FormData
    if (isAudioTranscription && audioBase64) {
      const buffer = Buffer.from(audioBase64, 'base64');
      const blob = new Blob([buffer], { type: 'audio/mpeg' });
      const formData = new FormData();
      formData.append('file', blob, audioFileName);
      formData.append('model', transcriptionModel);
      if (transcriptionPrompt) formData.append('prompt', transcriptionPrompt);
      if (transcriptionLanguage) formData.append('language', transcriptionLanguage);
      if (transcriptionFormat) formData.append('response_format', transcriptionFormat);

      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          ...(apiKey ? { Authorization: `Bearer ${apiKey.trim()}` } : {}),
          ...customHeaders,
        },
        body: formData,
      });

      const latencyMs = Math.round(performance.now() - startTime);
      const contentType = upstreamResponse.headers.get('content-type') || '';

      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        res.status(upstreamResponse.status).json({
          error: `Upstream error (${upstreamResponse.status}): ${errorText}`,
          latencyMs,
          status: upstreamResponse.status,
        });
        return;
      }

      if (contentType.includes('application/json')) {
        const data = await upstreamResponse.json();
        res.json({ ...data, _meta: { latencyMs, status: upstreamResponse.status } });
      } else {
        const text = await upstreamResponse.text();
        res.json({ text, _meta: { latencyMs, status: upstreamResponse.status } });
      }
      return;
    }

    // Audio Speech handling (returns binary audio, we convert to base64 Data URL)
    if (isAudioSpeech) {
      requestHeaders['Content-Type'] = 'application/json';
      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      const latencyMs = Math.round(performance.now() - startTime);

      if (!upstreamResponse.ok) {
        const errorText = await upstreamResponse.text();
        res.status(upstreamResponse.status).json({
          error: `Upstream error (${upstreamResponse.status}): ${errorText}`,
          latencyMs,
          status: upstreamResponse.status,
        });
        return;
      }

      const audioBuffer = await upstreamResponse.arrayBuffer();
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const mimeType = upstreamResponse.headers.get('content-type') || 'audio/mpeg';

      res.json({
        audioDataUrl: `data:${mimeType};base64,${base64Audio}`,
        byteLength: audioBuffer.byteLength,
        contentType: mimeType,
        _meta: { latencyMs, status: upstreamResponse.status },
      });
      return;
    }

    // Streaming SSE handling
    if (stream && (method.toUpperCase() === 'POST')) {
      requestHeaders['Content-Type'] = 'application/json';
      const upstreamResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!upstreamResponse.ok) {
        const latencyMs = Math.round(performance.now() - startTime);
        const errorText = await upstreamResponse.text();
        res.status(upstreamResponse.status).json({
          error: `Upstream error (${upstreamResponse.status}): ${errorText}`,
          latencyMs,
          status: upstreamResponse.status,
        });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      if (!upstreamResponse.body) {
        res.end();
        return;
      }

      // Read Web Streams API reader
      const reader = upstreamResponse.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
      }
      res.end();
      return;
    }

    // Standard JSON / GET / POST handling
    if (method.toUpperCase() !== 'GET' && requestBody) {
      if (!requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json';
      }
    }

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: requestHeaders,
    };

    if (method.toUpperCase() !== 'GET' && requestBody !== undefined) {
      fetchOptions.body = typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody);
    }

    const upstreamResponse = await fetch(targetUrl, fetchOptions);
    const latencyMs = Math.round(performance.now() - startTime);
    const contentType = upstreamResponse.headers.get('content-type') || '';

    let responseData: any;
    if (contentType.includes('application/json')) {
      responseData = await upstreamResponse.json();
    } else {
      const textData = await upstreamResponse.text();
      try {
        responseData = JSON.parse(textData);
      } catch {
        responseData = { text: textData };
      }
    }

    if (!upstreamResponse.ok) {
      res.status(upstreamResponse.status).json({
        error: responseData?.error || responseData?.message || responseData || `HTTP ${upstreamResponse.status}`,
        rawResponse: responseData,
        latencyMs,
        status: upstreamResponse.status,
      });
      return;
    }

    res.json({
      ...responseData,
      _meta: {
        latencyMs,
        status: upstreamResponse.status,
        headers: Object.fromEntries(upstreamResponse.headers.entries()),
      },
    });
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    res.status(500).json({
      error: err?.message || 'Proxy bağlantı hatası oluştu',
      latencyMs,
      status: 500,
    });
  }
});

// Mounting Vite in development or static in production
async function startServer() {
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
