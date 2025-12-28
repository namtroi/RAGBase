/**
 * Prisma Seed Script
 * 
 * Seeds the database with essential data like default processing profile.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create default processing profile
    const defaultProfile = await prisma.processingProfile.upsert({
        where: { name: 'Default' },
        create: {
            name: 'Default',
            description: 'System default profile with balanced settings',
            isActive: true,
            isDefault: true,
            // All other fields use schema defaults
        },
        update: {
            // Don't update if exists - preserve isDefault and isActive settings
        },
    });

    console.log(`✅ Default profile created/verified: ${defaultProfile.id}`);

    // Link orphan documents to default profile (migration helper)
    const orphanDocs = await prisma.document.updateMany({
        where: { processingProfileId: null },
        data: { processingProfileId: defaultProfile.id },
    });

    if (orphanDocs.count > 0) {
        console.log(`📄 Linked ${orphanDocs.count} documents to default profile`);
    }

    // Link orphan drive configs to default profile
    const orphanConfigs = await prisma.driveConfig.updateMany({
        where: { processingProfileId: null },
        data: { processingProfileId: defaultProfile.id },
    });

    if (orphanConfigs.count > 0) {
        console.log(`📁 Linked ${orphanConfigs.count} drive configs to default profile`);
    }

    console.log('🎉 Seeding complete!');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
