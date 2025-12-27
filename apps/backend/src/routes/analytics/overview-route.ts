import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';
import { getPeriodDateRange } from '@/utils/analytics-utils.js';

// Query parameters schema
const PeriodQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
});

export async function overviewRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/overview
   * Returns summary statistics for the analytics dashboard.
   * Note: Overview returns ALL data (no period filter) as per Option C design.
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
      completedCount,
      failedCount,
      formatCounts,
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
      // Completed documents count
      prisma.document.count({
        where: {
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
      }),
      // Failed documents count
      prisma.document.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: start, lte: end },
        },
      }),
      // Format distribution
      prisma.document.groupBy({
        by: ['format'],
        where: {
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),
    ]);

    // Calculate success rate
    const totalProcessed = completedCount + failedCount;
    const successRate = totalProcessed > 0
      ? Number(((completedCount / totalProcessed) * 100).toFixed(2))
      : 0;

    // Build format distribution object
    const formatDistribution: Record<string, number> = {};
    for (const item of formatCounts) {
      formatDistribution[item.format] = item._count;
    }

    return reply.send({
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      totalDocuments,
      totalChunks,
      successRate,
      formatDistribution,
      avgProcessingTimeMs: Math.round(metricsAgg._avg.totalTimeMs || 0),
      avgQueueTimeMs: Math.round(metricsAgg._avg.queueTimeMs || 0),
      avgUserWaitTimeMs: Math.round(metricsAgg._avg.userWaitTimeMs || 0),
      avgQualityScore: Number((metricsAgg._avg.avgQualityScore || 0).toFixed(3)),
      totalTokens: metricsAgg._sum.totalTokens || 0,
    });
  });
}

