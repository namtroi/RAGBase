/**
 * PDF Processing Concurrency Configuration
 * 
 * Controls how many PDF documents can be processed in parallel.
 * Default: 1 (sequential processing for thread-safety)
 */

const DEFAULT_CONCURRENCY = 1;
const MIN_CONCURRENCY = 1;

/**
 * Get PDF processing concurrency from environment.
 * 
 * @returns Number of concurrent PDF processing jobs allowed
 */
export function getPdfConcurrency(): number {
    const envValue = process.env.PDF_CONCURRENCY;

    if (!envValue) {
        return DEFAULT_CONCURRENCY;
    }

    const parsed = parseInt(envValue, 10);

    if (isNaN(parsed) || parsed < MIN_CONCURRENCY) {
        return DEFAULT_CONCURRENCY;
    }

    return parsed;
}
