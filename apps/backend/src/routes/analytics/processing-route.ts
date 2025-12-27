import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getPrismaClient } from '@/services/database.js';
import { FileFormat, Prisma } from '@prisma/client';
import { getPeriodDateRange } from '@/utils/analytics-utils.js';

const ProcessingQuerySchema = z.object({
  period: z.enum(['24h', '7d', '30d', 'all']).default('7d'),
  format: z.enum(['pdf', 'docx', 'pptx', 'epub', 'md', 'txt', 'html', 'xlsx', 'csv', 'json']).optional(),
});

export async function processingRoute(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/analytics/processing
   * Returns processing time breakdown and trends.
   * Supports format filter for format-specific metrics.
   */
  fastify.get('/api/analytics/processing', async (request, reply) => {
    const queryResult = ProcessingQuerySchema.safeParse(request.query);

    if (!queryResult.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: queryResult.error.message,
      });
    }

    const { period, format } = queryResult.data;
    const { start, end } = getPeriodDateRange(period);
    const prisma = getPrismaClient();

    // Build where clause with optional format filter
    const metricsWhere: Prisma.ProcessingMetricsWhereInput = {
      createdAt: { gte: start, lte: end },
    };

    if (format) {
      metricsWhere.document = { format: format as FileFormat };
    }

    // Get time breakdown averages
    const breakdown = await prisma.processingMetrics.aggregate({
      where: metricsWhere,
      _avg: {
        conversionTimeMs: true,
        chunkingTimeMs: true,
        embeddingTimeMs: true,
        totalTimeMs: true,
        queueTimeMs: true,
        userWaitTimeMs: true,
        pageCount: true,
      },
      _sum: {
        conversionTimeMs: true,
        pageCount: true,
      },
      _count: true,
    });

    // Get OCR usage stats (PDF-specific)
    const [ocrCount, totalWithOcr] = await Promise.all([
      prisma.processingMetrics.count({
        where: {
          ...metricsWhere,
          ocrApplied: true,
        },
      }),
      prisma.processingMetrics.count({
        where: metricsWhere,
      }),
    ]);

    // Calculate OCR usage percentage
    const ocrUsagePercent = totalWithOcr > 0
      ? Math.round((ocrCount / totalWithOcr) * 100)
      : 0;

    // Calculate avg conversion time per page
    const totalConversionTime = breakdown._sum.conversionTimeMs || 0;
    const totalPages = breakdown._sum.pageCount || 0;
    const avgConversionTimePerPage = totalPages > 0
      ? Math.round(totalConversionTime / totalPages)
      : 0;

    // Get trends over time (group by date)
    const truncInterval = period === '24h' ? 'hour' : 'day';
    const formatFilter = format ? Prisma.sql`AND d.format = ${format}` : Prisma.empty;
    const trends = await prisma.$queryRaw<Array<{
      date: Date;
      count: bigint;
      avg_total_time: number;
      avg_queue_time: number;
    }>>(
      Prisma.sql`
        SELECT 
          DATE_TRUNC(${Prisma.raw(`'${truncInterval}'`)}, pm.created_at) as date,
          COUNT(*) as count,
          AVG(pm.total_time_ms) as avg_total_time,
          AVG(pm.queue_time_ms) as avg_queue_time
        FROM processing_metrics pm
        JOIN documents d ON pm.document_id = d.id
        WHERE pm.created_at >= ${start} AND pm.created_at <= ${end}
        ${formatFilter}
        GROUP BY DATE_TRUNC(${Prisma.raw(`'${truncInterval}'`)}, pm.created_at)
        ORDER BY date ASC
      `
    );

    // Get count of documents processed
    const count = await prisma.processingMetrics.count({
      where: metricsWhere,
    });

    return reply.send({
      period,
      format: format || 'all',
      periodStart: start.toISOString(),
      periodEnd: end.toISOString(),
      documentsProcessed: count,
      ocrUsagePercent,
      avgConversionTimePerPage,
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

