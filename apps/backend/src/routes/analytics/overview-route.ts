import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';

// Query parameters schema
const PeriodQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
});

/**
 * Calculate date range based on period string.
 */
function getPeriodDateRange(period: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case '24h':
      start.setHours(start.getHours() - 24);
      break;
    case '7d':
      start.setDate(start.getDate() - 7);
      break;
    case '30d':
      start.setDate(start.getDate() - 30);
      break;
    case 'all':
      start.setFullYear(2000); // Effectively no lower bound
      break;
  }
  
  return { start, end };
}

export async function overviewRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/overview
   * Returns summary statistics for the analytics dashboard.
   */
  fastify.get('/api/analytics/overview', async (request, reply) => {
    const queryResult = PeriodQuerySchema.safeParse(request.query);
    
    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }
    
    const { period } = queryResult.data;
    const { start, end } = getPeriodDateRange(period);
    const prisma = getPrismaClient();
    
    // Query metrics within the period
    const [
      metricsAgg,
      totalDocuments,
      totalChunks,
    ] = await Promise.all([
      // Aggregate processing metrics
      prisma.processingMetrics.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
        },
        _avg: {
          totalTimeMs: true,
          queueTimeMs: true,
          userWaitTimeMs: true,
          avgQualityScore: true,
        },
        _sum: {
          totalChunks: true,
          totalTokens: true,
        },
        _count: true,
      }),
      // Total documents in period
      prisma.document.count({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
      }),
      // Total chunks in period
      prisma.chunk.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);
    
    return reply.send({
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      totalDocuments,
      totalChunks,
      avgProcessingTimeMs: Math.round(metricsAgg._avg.totalTimeMs || 0),
      avgQueueTimeMs: Math.round(metricsAgg._avg.queueTimeMs || 0),
      avgUserWaitTimeMs: Math.round(metricsAgg._avg.userWaitTimeMs || 0),
      avgQualityScore: Number((metricsAgg._avg.avgQualityScore || 0).toFixed(3)),
      totalTokens: metricsAgg._sum.totalTokens || 0,
    });
  });
}
