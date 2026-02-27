// server.js - OpenAI to NVIDIA NIM API Proxy
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// NVIDIA NIM API configuration
// Usamos .trim() para evitar errores de espacios invisibles al pegar en Replit
const NIM_API_BASE = (process.env.NIM_API_BASE || 'https://integrate.api.nvidia.com/v1').trim();
const NIM_API_KEY = process.env.NIM_API_KEY ? process.env.NIM_API_KEY.trim() : null;

// Diagnóstico de inicio
console.log("--- INICIANDO PROXY NVIDIA NIM ---");
console.log(`URL Base: ${NIM_API_BASE}`);
if (!NIM_API_KEY) {
  console.error("❌ ERROR: No se encontró NIM_API_KEY en los Secrets de Replit.");
} else {
  console.log(`✅ API Key detectada (Longitud: ${NIM_API_KEY.length} caracteres)`);
}

const SHOW_REASONING = false;
const ENABLE_THINKING_MODE = false;

const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'gpt-4': 'qwen/qwen3-coder-480b-a35b-instruct',
  'gpt-4-turbo': 'moonshotai/kimi-k2-instruct-0905',
  'gpt-4o': 'deepseek-ai/deepseek-v3.1',
  'claude-3-opus': 'openai/gpt-oss-120b',
  'claude-3-sonnet': 'openai/gpt-oss-20b',
  'gemini-pro': 'qwen/qwen3-next-80b-a3b-thinking' 
};

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    key_loaded: !!NIM_API_KEY,
    reasoning_display: SHOW_REASONING 
  });
});

// List models
app.get('/v1/models', (req, res) => {
  const models = Object.keys(MODEL_MAPPING).map(model => ({
    id: model,
    object: 'model',
    created: Date.now(),
    owned_by: 'nvidia-nim-proxy'
  }));
  res.json({ object: 'list', data: models });
});

// Main Chat completions endpoint
app.post(['/v1/chat/completions', '/chat/completions'], async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens, stream } = req.body;
    
    // Mapeo de modelo
    let nimModel = MODEL_MAPPING[model] || model;

    const nimRequest = {
      model: nimModel,
      messages: messages,
      temperature: temperature || 0.6,
      max_tokens: max_tokens || 4096, // Ajustado para evitar errores de contexto
      extra_body: ENABLE_THINKING_MODE ? { chat_template_kwargs: { thinking: true } } : undefined,
      stream: stream || false
    };

    const response = await axios.post(`${NIM_API_BASE}/chat/completions`, nimRequest, {
      headers: {
        'Authorization': `Bearer ${NIM_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Replit-Proxy-v1' // Header extra para mayor compatibilidad
      },
      responseType: stream ? 'stream' : 'json'
    });

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      response.data.pipe(res); // En streaming simple, pasamos el chorro directo
    } else {
      // Formateo compatible con OpenAI
      const openaiResponse = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: response.data.choices,
        usage: response.data.usage
      };
      res.json(openaiResponse);
    }
    
  } catch (error) {
    const status = error.response?.status || 500;
    const errorData = error.response?.data || error.message;
    
    console.error(`❌ Error ${status}:`, JSON.stringify(errorData));
    
    res.status(status).json({
      error: {
        message: status === 401 ? "Error de Autenticación: Revisa tu API Key en los Secrets" : error.message,
        type: 'proxy_error',
        code: status
      }
    });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Proxy corriendo en puerto ${PORT}`);
  console.log(`🔗 URL para JanitorAI: https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/v1`);
});
