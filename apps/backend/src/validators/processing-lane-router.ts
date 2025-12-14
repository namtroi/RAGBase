import type { FileFormat, ProcessingLane } from '@prisma/client';

export const LANE_CONFIG = {
  fast: ['json', 'txt', 'md'] as FileFormat[],
  heavy: ['pdf'] as FileFormat[],
} as const;

const FORMAT_TO_LANE = new Map<FileFormat, ProcessingLane>();

// Build lookup map
for (const format of LANE_CONFIG.fast) {
  FORMAT_TO_LANE.set(format, 'fast');
}
for (const format of LANE_CONFIG.heavy) {
  FORMAT_TO_LANE.set(format, 'heavy');
}

export function getProcessingLane(format: FileFormat): ProcessingLane {
  const lane = FORMAT_TO_LANE.get(format);
  if (!lane) {
    // Default to heavy for unknown (should never happen with proper validation)
    return 'heavy';
  }
  return lane;
}
