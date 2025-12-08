import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'healing-engine',
      version: '1.0.0',
      ollama: request.healingConfig?.ollamaEndpoint,
      model: request.healingConfig?.llmModel
    };
  });

  fastify.get('/api/version', async () => {
    return {
      version: '1.0.0',
      engine: 'shifty-heal',
      capabilities: ['selector-healing', 'timeout-healing', 'wait-strategy', 'async-healing']
    };
  });
}
