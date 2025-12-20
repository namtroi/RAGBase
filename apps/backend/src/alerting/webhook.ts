import { logger } from '../logging/logger.js';

interface AlertPayload {
  level: 'error' | 'critical';
  message: string;
  context: Record<string, unknown>;
  timestamp: string;
}

const ALERT_WEBHOOK_URL = process.env.ALERT_WEBHOOK_URL;
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '5', 10);

// Track error counts for threshold alerting
const errorCounts = new Map<string, { count: number; lastReset: number }>();

export async function sendAlert(payload: AlertPayload): Promise<void> {
  if (!ALERT_WEBHOOK_URL) {
    logger.warn({ payload }, 'Alert webhook not configured');
    return;
  }

  try {
    await fetch(ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `[${payload.level.toUpperCase()}] ${payload.message}`,
        ...payload,
      }),
    });
  } catch (error) {
    logger.error({ error, payload }, 'Failed to send alert');
  }
}

export function trackError(errorType: string, context: Record<string, unknown>): void {
  const now = Date.now();
  const hourAgo = now - 3600000;

  let entry = errorCounts.get(errorType);

  // Reset if older than 1 hour
  if (!entry || entry.lastReset < hourAgo) {
    entry = { count: 0, lastReset: now };
    errorCounts.set(errorType, entry);
  }

  entry.count++;

  // Alert if threshold exceeded
  if (entry.count === ALERT_THRESHOLD) {
    sendAlert({
      level: 'error',
      message: `Error threshold exceeded: ${errorType} (${entry.count} in last hour)`,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}
