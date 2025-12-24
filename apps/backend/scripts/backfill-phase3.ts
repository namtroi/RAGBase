/**
 * Phase 3A: Backfill Script
 * 
 * Updates connectionState for existing Drive-synced documents.
 * Run after applying the Prisma migration.
 * 
 * Usage: npx tsx scripts/backfill-phase3.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🔄 Phase 3A: Backfilling connectionState...');

    // Count documents that need updating
    const driveDocsCount = await prisma.document.count({
        where: {
            sourceType: 'DRIVE',
            driveConfigId: { not: null },
            connectionState: 'STANDALONE', // Only update if not already LINKED
        },
    });

    console.log(`📊 Found ${driveDocsCount} Drive documents to update`);

    if (driveDocsCount === 0) {
        console.log('✅ No documents need updating');
        return;
    }

    // Update connectionState to LINKED for Drive-synced documents
    const result = await prisma.document.updateMany({
        where: {
            sourceType: 'DRIVE',
            driveConfigId: { not: null },
            connectionState: 'STANDALONE',
        },
        data: {
            connectionState: 'LINKED',
        },
    });

    console.log(`✅ Updated ${result.count} documents to connectionState = LINKED`);

    // Verify
    const linkedCount = await prisma.document.count({
        where: { connectionState: 'LINKED' },
    });
    const standaloneCount = await prisma.document.count({
        where: { connectionState: 'STANDALONE' },
    });

    console.log(`📊 Final counts: LINKED=${linkedCount}, STANDALONE=${standaloneCount}`);
}

main()
    .catch((e) => {
        console.error('❌ Backfill failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
