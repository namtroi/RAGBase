/**
 * Cron Job Service
 * 
 * Manages scheduled tasks using node-cron.
 * Currently handles scheduled Drive folder syncs.
 */

import { getPrismaClient } from '@/services/database.js';
import { getSyncService } from '@/services/sync-service.js';
import { logger } from '@/logging/logger.js';
import cron, { ScheduledTask } from 'node-cron';

const scheduledTasks: Map<string, ScheduledTask> = new Map();

/**
 * Initialize cron jobs for all enabled DriveFolders
 */
export async function initializeCronJobs(): Promise<void> {
    const prisma = getPrismaClient();

    // Get all enabled configs
    const configs = await prisma.driveFolder.findMany({
        where: { enabled: true },
        select: { id: true, syncCron: true },
    });

    logger.info({ count: configs.length }, 'cron_initializing');

    for (const config of configs) {
        scheduleSync(config.id, config.syncCron);
    }
}

/**
 * Schedule sync for a specific config
 */
export function scheduleSync(configId: string, cronExpression: string): void {
    // Validate cron expression
    if (!cron.validate(cronExpression)) {
        logger.error({ configId, cronExpression }, 'cron_invalid_expression');
        return;
    }

    // Remove existing schedule if any
    unscheduleSync(configId);

    // Create new scheduled task
    const task = cron.schedule(cronExpression, async () => {
        logger.info({ configId }, 'cron_sync_running');
        try {
            const syncService = getSyncService();
            const result = await syncService.syncConfig(configId);
            logger.info({ configId, added: result.added, updated: result.updated, removed: result.removed }, 'cron_sync_complete');
        } catch (error: any) {
            logger.error({ configId, err: error }, 'cron_sync_failed');
        }
    });

    scheduledTasks.set(configId, task);
    logger.info({ configId, cronExpression }, 'cron_scheduled');
}

/**
 * Unschedule sync for a specific config
 */
export function unscheduleSync(configId: string): void {
    const existing = scheduledTasks.get(configId);
    if (existing) {
        existing.stop();
        scheduledTasks.delete(configId);
        logger.info({ configId }, 'cron_unscheduled');
    }
}

/**
 * Update schedule for a config
 */
export function updateSchedule(configId: string, cronExpression: string, enabled: boolean): void {
    if (enabled) {
        scheduleSync(configId, cronExpression);
    } else {
        unscheduleSync(configId);
    }
}

/**
 * Stop all cron jobs
 */
export function stopAllCronJobs(): void {
    logger.info({ count: scheduledTasks.size }, 'cron_stopping_all');
    for (const [configId, task] of scheduledTasks) {
        task.stop();
        logger.debug({ configId }, 'cron_stopped');
    }
    scheduledTasks.clear();
}

/**
 * Get status of all scheduled tasks
 */
export function getCronStatus(): { configId: string; scheduled: boolean }[] {
    return Array.from(scheduledTasks.entries()).map(([configId]) => ({
        configId,
        scheduled: true,
    }));
}

