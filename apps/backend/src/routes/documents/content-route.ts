import { getPrismaClient } from '@/services/database.js';
import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const ParamsSchema = z.object({
    id: z.string().uuid(),
});

const QuerySchema = z.object({
    format: z.enum(['markdown', 'json']).default('markdown'),
});

export async function contentRoute(fastify: FastifyInstance): Promise<void> {
    fastify.get('/api/documents/:id/content', async (request, reply) => {
        // Validate params
        const params = ParamsSchema.safeParse(request.params);
        if (!params.success) {
            return reply.status(400).send({
                error: 'INVALID_ID',
                message: 'Invalid document ID format',
            });
        }

        // Validate query
        const query = QuerySchema.safeParse(request.query);
        if (!query.success) {
            return reply.status(400).send({
                error: 'INVALID_FORMAT',
                message: 'Format must be "markdown" or "json"',
            });
        }

        const prisma = getPrismaClient();
        const document = await prisma.document.findUnique({
            where: { id: params.data.id },
            include: {
                chunks: {
                    orderBy: { chunkIndex: 'asc' },
                    select: {
                        id: true,
                        content: true,
                        chunkIndex: true,
                        heading: true,
                        // Phase 4: Quality metadata
                        qualityScore: true,
                        qualityFlags: true,
                        chunkType: true,
                        breadcrumbs: true,
                        tokenCount: true,
                        completeness: true,
                        hasTitle: true,
                    },
                },
            },
        });

        // 404 if not found
        if (!document) {
            return reply.status(404).send({
                error: 'NOT_FOUND',
                message: 'Document not found',
            });
        }

        // 409 if not completed
        if (document.status !== 'COMPLETED') {
            return reply.status(409).send({
                error: 'NOT_READY',
                message: `Document is not ready for export. Current status: ${document.status}`,
            });
        }

        // 409 if no processed content
        if (!document.processedContent) {
            return reply.status(409).send({
                error: 'NO_CONTENT',
                message: 'Document has no processed content available',
            });
        }

        const { format } = query.data;

        if (format === 'markdown') {
            // Return raw markdown
            reply.header('Content-Type', 'text/markdown; charset=utf-8');
            reply.header('Content-Disposition', `attachment; filename="${document.filename}.md"`);
            return reply.send(document.processedContent);
        }

        // JSON format - include chunks with quality metadata
        return reply.send({
            id: document.id,
            filename: document.filename,
            format: document.format,
            formatCategory: document.formatCategory,
            driveWebViewLink: document.driveWebViewLink || undefined,
            processedContent: document.processedContent,
            chunks: document.chunks.map(chunk => ({
                id: chunk.id,
                content: chunk.content,
                index: chunk.chunkIndex,
                metadata: {
                    heading: chunk.heading || undefined,
                    // Phase 4: Quality metadata
                    qualityScore: chunk.qualityScore,
                    qualityFlags: chunk.qualityFlags,
                    chunkType: chunk.chunkType,
                    breadcrumbs: chunk.breadcrumbs,
                    tokenCount: chunk.tokenCount,
                    completeness: chunk.completeness,
                    hasTitle: chunk.hasTitle,
                },
            })),
            processingMetadata: document.processingMetadata,
        });
    });
}
