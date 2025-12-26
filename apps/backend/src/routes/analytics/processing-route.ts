import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';
import { Prisma } from '@prisma/client';

const ProcessingQuerySchema = z.object({
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

export async function processingRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/processing
   * Returns processing time breakdown and trends.
   */
  fastify.get('/api/analytics/processing', async (request, reply) => {
    const queryResult = ProcessingQuerySchema.safeParse(request.query);
    
    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }
    
    const { period } = queryResult.data;
    const { start, end } = getPeriodDateRange(period);
    const prisma = getPrismaClient();
    
    // Get time breakdown averages
    const breakdown = await prisma.processingMetrics.aggregate({
      where: {
        createdAt: { gte: start, lte: end },
      },
      _avg: {
        conversionTimeMs: true,
        chunkingTimeMs: true,
        embeddingTimeMs: true,
        totalTimeMs: true,
        queueTimeMs: true,
        userWaitTimeMs: true,
      },
      _count: true,
    });
    
    // Get trends over time (group by date)
    // For 24h period, we'd ideally group by hour, but Prisma doesn't support this directly
    // We'll use raw query for this
    const truncInterval = period === '24h' ? 'hour' : 'day';
    const trends = await prisma.$queryRaw<Array<{
      date: Date;
      count: bigint;
      avg_total_time: number;
      avg_queue_time: number;
    }>>(
      Prisma.sql`
        SELECT 
          DATE_TRUNC(${Prisma.raw(`'${truncInterval}'`)}, created_at) as date,
          COUNT(*) as count,
          AVG(total_time_ms) as avg_total_time,
          AVG(queue_time_ms) as avg_queue_time
        FROM processing_metrics
        WHERE created_at >= ${start} AND created_at <= ${end}
        GROUP BY DATE_TRUNC(${Prisma.raw(`'${truncInterval}'`)}, created_at)
        ORDER BY date ASC
      `
    );
    
    // Get count of documents processed separately
    const count = await prisma.processingMetrics.count({
      where: {
        createdAt: { gte: start, lte: end },
      },
    });
    
    return reply.send({
      period,
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      documentsProcessed: count,
      breakdown: {
        avgConversionTimeMs: Math.round(breakdown._avg.conversionTimeMs || 0),
        avgChunkingTimeMs: Math.round(breakdown._avg.chunkingTimeMs || 0),
        avgEmbeddingTimeMs: Math.round(breakdown._avg.embeddingTimeMs || 0),
        avgTotalTimeMs: Math.round(breakdown._avg.totalTimeMs || 0),
        avgQueueTimeMs: Math.round(breakdown._avg.queueTimeMs || 0),
        avgUserWaitTimeMs: Math.round(breakdown._avg.userWaitTimeMs || 0),
      },
      trends: trends.map(t => ({
        date: t.date.toISOString(),
        count: Number(t.count),
        avgTotalTimeMs: Math.round(t.avg_total_time || 0),
        avgQueueTimeMs: Math.round(t.avg_queue_time || 0),
      })),
    });
  });
}
