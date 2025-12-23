import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('PDF Concurrency Config', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        vi.resetModules();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getPdfConcurrency', () => {
        it('should default to 1 when PDF_CONCURRENCY not set', async () => {
            delete process.env.PDF_CONCURRENCY;

            const { getPdfConcurrency } = await import('@/queue/concurrency-config.js');

            expect(getPdfConcurrency()).toBe(1);
        });

        it('should use PDF_CONCURRENCY from env', async () => {
            process.env.PDF_CONCURRENCY = '5';

            const { getPdfConcurrency } = await import('@/queue/concurrency-config.js');

            expect(getPdfConcurrency()).toBe(5);
        });

        it('should clamp to minimum 1', async () => {
            process.env.PDF_CONCURRENCY = '0';

            const { getPdfConcurrency } = await import('@/queue/concurrency-config.js');

            expect(getPdfConcurrency()).toBe(1);
        });

        it('should clamp negative values to 1', async () => {
            process.env.PDF_CONCURRENCY = '-5';

            const { getPdfConcurrency } = await import('@/queue/concurrency-config.js');

            expect(getPdfConcurrency()).toBe(1);
        });

        it('should handle invalid string as default 1', async () => {
            process.env.PDF_CONCURRENCY = 'invalid';

            const { getPdfConcurrency } = await import('@/queue/concurrency-config.js');

            expect(getPdfConcurrency()).toBe(1);
        });

        it('should allow high concurrency values', async () => {
            process.env.PDF_CONCURRENCY = '50';

            const { getPdfConcurrency } = await import('@/queue/concurrency-config.js');

            expect(getPdfConcurrency()).toBe(50);
        });
    });
});
