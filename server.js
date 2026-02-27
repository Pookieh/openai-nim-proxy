const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = 7860; 

app.use(cors());
app.use(express.json());

const NIM_API_BASE = 'https://integrate.api.nvidia.com/v1';
const NIM_API_KEY = process.env.NIM_API_KEY;

const MODEL_MAPPING = {
  'gpt-3.5-turbo': 'nvidia/llama-3.1-nemotron-ultra-253b-v1',
  'gpt-4': 'qwen/qwen3-coder-480b-a35b-instruct',
  'gpt-4o': 'deepseek-ai/deepseek-v3.1'
};

// 1. SOPORTE PARA /v1 (GET y POST)
// Esto arregla el error "Cannot POST /v1"
app.all(['/v1', '/v1/chat/completions'], async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).json({
      object: 'list',
      data: Object.keys(MODEL_MAPPING).map(id => ({ id, object: 'model' }))
    });
  }

  if (req.method === 'POST') {
    try {
      const { model, messages, temperature, stream } = req.body;
      const nimModel = MODEL_MAPPING[model] || model;

      const response = await axios.post(`${NIM_API_BASE}/chat/completions`, {
        model: nimModel,
        messages,
        temperature: temperature || 0.6,
        stream: stream || false
      }, {
        headers: { 
          'Authorization': `Bearer ${NIM_API_KEY}`,
          'Content-Type': 'application/json'
        },
        responseType: stream ? 'stream' : 'json'
      });

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        response.data.pipe(res);
      } else {
        res.json(response.data);
      }
    } catch (error) {
      console.error('Error:', error.message);
      res.status(500).json({ error: { message: error.message } });
    }
  }
});

// 2. RUTA RAÍZ PARA HUGGING FACE
app.get('/', (req, res) => {
  res.status(200).json({ status: "online", message: "Proxy funcionando" });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor en puerto ${PORT}`);
});
