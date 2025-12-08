import Fastify, { FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import { analyzeRoute } from './routes/analyze.js';
import { healthRoute } from './routes/health.js';

export interface HealingConfig {
  ollamaEndpoint: string;
  llmModel: string;
  minConfidence: number;
  telemetryEnabled: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    healingConfig: HealingConfig;
  }
}

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
const LLM_MODEL = process.env.HEALING_LLM_MODEL || 'qwen2.5-coder:3b';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info'
  }
});

async function setupServer() {
  // Register CORS
  await fastify.register(cors, {
    origin: true
  });

  // Add context to all requests
  fastify.decorateRequest('healingConfig', null);
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.healingConfig = {
      ollamaEndpoint: OLLAMA_ENDPOINT,
      llmModel: LLM_MODEL,
      minConfidence: 0.6,
      telemetryEnabled: process.env.HEALING_TELEMETRY_ENABLED === 'true'
    };
  });

  // Register routes
  await fastify.register(healthRoute);
  await fastify.register(analyzeRoute, { prefix: '/api/healing' });

  // Error handler
  fastify.setErrorHandler((error: Error, request: FastifyRequest, reply) => {
    request.log.error(error);
    reply.status(500).send({
      error: 'Internal Server Error',
      message: error.message,
      statusCode: 500
    });
  });
}

// Start server
const start = async () => {
  try {
    await setupServer();
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`🚀 Healing Engine ready at http://${HOST}:${PORT}`);
    fastify.log.info(`📡 Ollama endpoint: ${OLLAMA_ENDPOINT}`);
    fastify.log.info(`🤖 LLM model: ${LLM_MODEL}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
