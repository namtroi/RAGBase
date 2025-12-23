import type { FileFormat, ProcessingLane } from '@prisma/client';

// All file formats now go through the heavy (queue) processing lane
// Fast lane has been removed - AI Worker handles all processing
export const LANE_CONFIG = {
  heavy: ['pdf', 'json', 'txt', 'md'] as FileFormat[],
} as const;

/**
 * Get processing lane for a file format.
 * All formats now use 'heavy' lane (processed through AI Worker queue)
 */
export function getProcessingLane(_format: FileFormat): ProcessingLane {
  // All formats go to heavy lane (queue -> AI Worker)
  return 'heavy';
}
