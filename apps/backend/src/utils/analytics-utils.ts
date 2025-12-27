/**
 * Shared utility for analytics date range calculation.
 */

export type AnalyticsPeriod = '24h' | '7d' | '30d' | 'all';

/**
 * Calculate date range based on period string.
 */
export function getPeriodDateRange(period: string): { start: Date; end: Date } {
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
