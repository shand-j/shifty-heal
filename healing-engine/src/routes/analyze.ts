import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { HealingService } from '../services/healing-service.js';

const AnalyzeRequestSchema = z.object({
  testFile: z.string(),
  testTitle: z.string(),
  errorMessage: z.string(),
  errorStack: z.string().optional(),
  failedSelector: z.string().nullable(),
  failureType: z.enum(['timeout', 'selector', 'detached-element', 'race-condition', 'network', 'unknown']),
  testCode: z.string(),
  healingStrategies: z.array(z.string()).optional()
});

type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;

export async function analyzeRoute(fastify: FastifyInstance) {
  const healingService = new HealingService();

  fastify.post('/analyze', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate request body
      const validationResult = AnalyzeRequestSchema.safeParse(request.body);
      
      if (!validationResult.success) {
        return reply.status(400).send({
          error: 'Invalid request',
          details: validationResult.error.issues
        });
      }

      const data = validationResult.data as AnalyzeRequest;
      const config = request.healingConfig;

      request.log.info({
        testFile: data.testFile,
        testTitle: data.testTitle,
        failureType: data.failureType
      }, 'Analyzing test failure');

      // Perform healing
      const result = await healingService.heal({
        testFile: data.testFile,
        testTitle: data.testTitle,
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
        failedSelector: data.failedSelector,
        failureType: data.failureType,
        testCode: data.testCode,
        healingStrategies: data.healingStrategies || ['selector-healing', 'timeout-healing', 'wait-strategy', 'async-healing'],
        ollamaEndpoint: config.ollamaEndpoint,
        llmModel: config.llmModel,
        minConfidence: config.minConfidence
      });

      request.log.info({
        confidence: result.confidence,
        strategy: result.strategy
      }, 'Healing complete');

      return result;
    } catch (error: any) {
      request.log.error(error, 'Healing failed');
      return reply.status(500).send({
        error: 'Healing failed',
        message: error.message
      });
    }
  });
}
