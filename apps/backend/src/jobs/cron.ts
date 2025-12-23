/**
 * Cron Job Service
 * 
 * Manages scheduled tasks using node-cron.
 * Currently handles scheduled Drive folder syncs.
 */

import { getPrismaClient } from '@/services/database.js';
import { getSyncService } from '@/services/sync-service.js';
import cron, { ScheduledTask } from 'node-cron';

const scheduledTasks: Map<string, ScheduledTask> = new Map();

/**
 * Initialize cron jobs for all enabled DriveConfigs
 */
export async function initializeCronJobs(): Promise<void> {
    const prisma = getPrismaClient();

    // Get all enabled configs
    const configs = await prisma.driveConfig.findMany({
        where: { enabled: true },
        select: { id: true, syncCron: true },
    });

    console.log(`📅 Initializing ${configs.length} Drive sync cron jobs`);

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
        console.error(`❌ Invalid cron expression for config ${configId}: ${cronExpression}`);
        return;
    }

    // Remove existing schedule if any
    unscheduleSync(configId);

    // Create new scheduled task
    const task = cron.schedule(cronExpression, async () => {
        console.log(`⏰ Running scheduled sync for config ${configId}`);
        try {
            const syncService = getSyncService();
            const result = await syncService.syncConfig(configId);
            console.log(`✅ Sync complete for ${configId}: +${result.added} ✎${result.updated} -${result.removed}`);
        } catch (error: any) {
            console.error(`❌ Sync failed for ${configId}:`, error.message);
        }
    });

    scheduledTasks.set(configId, task);
    console.log(`📅 Scheduled sync for config ${configId} with cron: ${cronExpression}`);
}

/**
 * Unschedule sync for a specific config
 */
export function unscheduleSync(configId: string): void {
    const existing = scheduledTasks.get(configId);
    if (existing) {
        existing.stop();
        scheduledTasks.delete(configId);
        console.log(`🛑 Unscheduled sync for config ${configId}`);
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
    console.log(`🛑 Stopping ${scheduledTasks.size} cron jobs`);
    for (const [configId, task] of scheduledTasks) {
        task.stop();
        console.log(`🛑 Stopped cron job for config ${configId}`);
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
