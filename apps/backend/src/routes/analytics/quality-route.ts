import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';
import { Prisma } from '@prisma/client';
import { getPeriodDateRange } from '@/utils/analytics-utils.js';

const QualityQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
});

export async function qualityRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/quality
   * Returns quality score distribution, flags breakdown, and rate calculations.
   */
  fastify.get('/api/analytics/quality', async (request, reply) => {
    const queryResult = QualityQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }

    const { period } = queryResult.data;
    const { start, end } = getPeriodDateRange(period);
    const prisma = getPrismaClient();

    // Get quality distribution from chunks
    const [
      qualityStats,
      excellentCount,
      goodCount,
      lowCount,
      metricsAgg,
      chunksWithBreadcrumbs,
      totalChunksCount,
    ] = await Promise.all([
      prisma.chunk.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
          qualityScore: { not: null },
        },
        _avg: { qualityScore: true },
        _count: true,
      }),
      prisma.chunk.count({
        where: {
          createdAt: { gte: start, lte: end },
          qualityScore: { gte: 0.85 },
        },
      }),
      prisma.chunk.count({
        where: {
          createdAt: { gte: start, lte: end },
          qualityScore: { gte: 0.70, lt: 0.85 },
        },
      }),
      prisma.chunk.count({
        where: {
          createdAt: { gte: start, lte: end },
          qualityScore: { lt: 0.70 },
        },
      }),
      // Get aggregated metrics for rate calculations
      prisma.processingMetrics.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
        },
        _sum: {
          totalChunks: true,
          totalTokens: true,
        },
      }),
      // Count chunks with breadcrumbs (context injection)
      prisma.$queryRaw<[{ count: bigint }]>(
        Prisma.sql`
          SELECT COUNT(*) as count
          FROM chunks
          WHERE created_at >= ${start} AND created_at <= ${end}
          AND array_length(breadcrumbs, 1) > 0
        `
      ),
      prisma.chunk.count({
        where: {
          createdAt: { gte: start, lte: end },
        },
      }),
    ]);

    // Get flag breakdown by aggregating from ProcessingMetrics
    const flagsResult = await prisma.processingMetrics.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        qualityFlags: true,
        totalChunks: true,
      },
    });

    // Aggregate flags across all documents
    const flagCounts: Record<string, number> = {};
    let totalChunksFromMetrics = 0;
    for (const metric of flagsResult) {
      const flags = metric.qualityFlags as Record<string, number> | null;
      totalChunksFromMetrics += metric.totalChunks;
      if (flags) {
        for (const [flag, count] of Object.entries(flags)) {
          flagCounts[flag] = (flagCounts[flag] || 0) + count;
        }
      }
    }

    // Calculate rates as percentages
    const fragmentRate = totalChunksFromMetrics > 0
      ? Math.round(((flagCounts['FRAGMENT'] || 0) / totalChunksFromMetrics) * 100)
      : 0;
    const noContextRate = totalChunksFromMetrics > 0
      ? Math.round(((flagCounts['NO_CONTEXT'] || 0) / totalChunksFromMetrics) * 100)
      : 0;
    const tooShortRate = totalChunksFromMetrics > 0
      ? Math.round(((flagCounts['TOO_SHORT'] || 0) / totalChunksFromMetrics) * 100)
      : 0;

    // Calculate context injection rate
    const breadcrumbsCount = Number(chunksWithBreadcrumbs[0]?.count || 0);
    const contextInjectionRate = totalChunksCount > 0
      ? Math.round((breadcrumbsCount / totalChunksCount) * 100)
      : 0;

    // Calculate avg tokens per chunk
    const totalTokens = metricsAgg._sum.totalTokens || 0;
    const totalChunks = metricsAgg._sum.totalChunks || 0;
    const avgTokensPerChunk = totalChunks > 0
      ? Math.round(totalTokens / totalChunks)
      : 0;

    return reply.send({
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      totalChunks: qualityStats._count,
      avgQualityScore: Number((qualityStats._avg.qualityScore || 0).toFixed(3)),
      distribution: {
        excellent: excellentCount,
        good: goodCount,
        low: lowCount,
      },
      flags: flagCounts,
      // New rate metrics
      fragmentRate,
      noContextRate,
      tooShortRate,
      contextInjectionRate,
      avgTokensPerChunk,
    });
  });
}

