/**
 * Default Profile Service
 * 
 * Ensures the system default profile always exists.
 * Called on application startup.
 */

import { getPrismaClient } from './database.js';
import { logger } from '../logging/logger.js';

/**
 * Ensure the system default profile exists.
 * Creates it if not found. This is the "isDefault: true" profile
 * that cannot be deleted or archived by users.
 */
export async function ensureDefaultProfile(): Promise<void> {
  const prisma = getPrismaClient();

  const existing = await prisma.processingProfile.findFirst({
    where: { isDefault: true },
  });

  if (existing) {
    logger.info({ profileId: existing.id }, 'Default profile exists');
    return;
  }

  // Create default profile with all standard settings
  const defaultProfile = await prisma.processingProfile.create({
    data: {
      name: 'Default',
      description: 'System default profile with balanced settings',
      isActive: true,
      isDefault: true,
      // All other fields use schema defaults
    },
  });

  logger.info({ profileId: defaultProfile.id }, 'Created default profile');
}
