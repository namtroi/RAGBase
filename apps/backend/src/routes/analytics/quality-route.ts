import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';

const QualityQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
});

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
      start.setFullYear(2000);
      break;
  }
  
  return { start, end };
}

export async function qualityRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/quality
   * Returns quality score distribution and flags breakdown.
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
    ]);
    
    // Get flag breakdown by aggregating from ProcessingMetrics
    const flagsResult = await prisma.processingMetrics.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        qualityFlags: true,
      },
    });
    
    // Aggregate flags across all documents
    const flagCounts: Record<string, number> = {};
    for (const metric of flagsResult) {
      const flags = metric.qualityFlags as Record<string, number> | null;
      if (flags) {
        for (const [flag, count] of Object.entries(flags)) {
          flagCounts[flag] = (flagCounts[flag] || 0) + count;
        }
      }
    }
    
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
    });
  });
}
