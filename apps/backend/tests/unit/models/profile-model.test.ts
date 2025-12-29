/**
 * ProcessingProfile Model Tests
 * 
 * Tests for the ProcessingProfile model including:
 * - CRUD operations
 * - Unique name constraint
 * - Document relationship
 * - Cascade delete behavior
 */

import { cleanDatabase, ensureDefaultProfile, getPrisma, seedDocument, seedProcessingProfile } from '@tests/helpers/database.js';
import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('ProcessingProfile Model', () => {
    beforeAll(async () => {
        await createTestApp();
    });

    afterAll(async () => {
        await closeTestApp();
    });

    beforeEach(async () => {
        await cleanDatabase();
        await ensureDefaultProfile();
    });

    describe('Create Profile', () => {
        it('creates profile with default values', async () => {
            const prisma = getPrisma();
            const profile = await prisma.processingProfile.create({
                data: { name: 'Test Profile' },
            });

            expect(profile.name).toBe('Test Profile');
            expect(profile.isActive).toBe(false);
            expect(profile.isDefault).toBe(false);
            expect(profile.isArchived).toBe(false);

            // Verify defaults were applied (behavior check, not value check)
            // This allows tuning schema defaults without breaking tests

            // Conversion settings: verify reasonable defaults exist
            expect(['pymupdf', 'docling']).toContain(profile.pdfConverter);
            expect(['auto', 'force', 'never']).toContain(profile.pdfOcrMode);
            expect(profile.pdfOcrLanguages).toBeTruthy();
            expect(profile.conversionTableRows).toBeGreaterThan(0);
            expect(profile.conversionTableCols).toBeGreaterThan(0);

            // Chunking settings: verify reasonable ranges
            expect(profile.documentChunkSize).toBeGreaterThanOrEqual(500);
            expect(profile.documentChunkSize).toBeLessThanOrEqual(3000);
            expect(profile.documentChunkOverlap).toBeGreaterThanOrEqual(50);
            expect(profile.documentChunkOverlap).toBeLessThan(profile.documentChunkSize);
            expect(profile.documentHeaderLevels).toBeGreaterThanOrEqual(1);
            expect(profile.documentHeaderLevels).toBeLessThanOrEqual(6);
            expect(profile.presentationMinChunk).toBeGreaterThan(0);
            expect(profile.tabularRowsPerChunk).toBeGreaterThan(0);

            // Quality settings: verify reasonable ranges
            expect(profile.qualityMinChars).toBeGreaterThan(0);
            expect(profile.qualityMaxChars).toBeGreaterThan(profile.qualityMinChars);
            expect(profile.qualityPenaltyPerFlag).toBeGreaterThanOrEqual(0);
            expect(profile.qualityPenaltyPerFlag).toBeLessThanOrEqual(1);
            expect(typeof profile.autoFixEnabled).toBe('boolean');
            expect(profile.autoFixMaxPasses).toBeGreaterThanOrEqual(0);

            // Embedding settings: verify defaults exist
            expect(profile.embeddingModel).toBeTruthy();
            expect(profile.embeddingDimension).toBeGreaterThan(0);
            expect(profile.embeddingMaxTokens).toBeGreaterThan(0);
        });

        it('creates profile with custom values', async () => {
            const profile = await seedProcessingProfile({
                name: 'Custom Profile',
                documentChunkSize: 500,
                documentChunkOverlap: 50,
                pdfOcrMode: 'force',
                pdfOcrLanguages: 'en,vi',
                qualityMinChars: 100,
            });

            expect(profile.name).toBe('Custom Profile');
            expect(profile.documentChunkSize).toBe(500);
            expect(profile.documentChunkOverlap).toBe(50);
            expect(profile.pdfOcrMode).toBe('force');
            expect(profile.pdfOcrLanguages).toBe('en,vi');
            expect(profile.qualityMinChars).toBe(100);
        });

        it('enforces unique name constraint', async () => {
            await seedProcessingProfile({ name: 'Unique Name' });

            await expect(
                seedProcessingProfile({ name: 'Unique Name' })
            ).rejects.toThrow();
        });
    });

    describe('Profile-Document Relationship', () => {
        it('links documents to profile', async () => {
            const prisma = getPrisma();
            const profile = await seedProcessingProfile({ name: 'Link Test' });

            const doc = await seedDocument({
                md5Hash: `doc-link-${Date.now()}`,
                processingProfileId: profile.id,
            });

            const fetchedDoc = await prisma.document.findUnique({
                where: { id: doc.id },
                include: { processingProfile: true },
            });

            expect(fetchedDoc?.processingProfileId).toBe(profile.id);
            expect(fetchedDoc?.processingProfile?.name).toBe('Link Test');
        });

        it('fetches profile with document count', async () => {
            const prisma = getPrisma();
            const profile = await seedProcessingProfile({ name: 'Count Test' });

            await seedDocument({ md5Hash: `doc-1-${Date.now()}`, processingProfileId: profile.id });
            await seedDocument({ md5Hash: `doc-2-${Date.now()}`, processingProfileId: profile.id });
            await seedDocument({ md5Hash: `doc-3-${Date.now()}`, processingProfileId: profile.id });

            const profileWithCount = await prisma.processingProfile.findUnique({
                where: { id: profile.id },
                include: { _count: { select: { documents: true } } },
            });

            expect(profileWithCount?._count.documents).toBe(3);
        });

        it('allows null processingProfileId on document', async () => {
            const doc = await seedDocument({
                md5Hash: `orphan-${Date.now()}`,
                processingProfileId: null,
            });

            expect(doc.processingProfileId).toBeNull();
        });
    });

    describe('Cascade Delete', () => {
        it('sets document processingProfileId to null when profile deleted', async () => {
            const prisma = getPrisma();
            const profile = await seedProcessingProfile({ name: 'Delete Test' });

            const doc = await seedDocument({
                md5Hash: `cascade-${Date.now()}`,
                processingProfileId: profile.id,
            });

            // Delete the profile
            await prisma.processingProfile.delete({ where: { id: profile.id } });

            // Document should still exist with null profileId (onDelete: SetNull)
            const fetchedDoc = await prisma.document.findUnique({
                where: { id: doc.id },
            });

            expect(fetchedDoc).not.toBeNull();
            expect(fetchedDoc?.processingProfileId).toBeNull();
        });
    });

    describe('Profile Activation', () => {
        it('only one profile can be active at a time', async () => {
            const prisma = getPrisma();

            // Deactivate default
            await prisma.processingProfile.updateMany({
                data: { isActive: false },
            });

            const profile1 = await seedProcessingProfile({ name: 'Profile 1', isActive: true });
            const profile2 = await seedProcessingProfile({ name: 'Profile 2', isActive: false });

            // Activate profile2 and deactivate profile1
            await prisma.processingProfile.update({
                where: { id: profile1.id },
                data: { isActive: false },
            });
            await prisma.processingProfile.update({
                where: { id: profile2.id },
                data: { isActive: true },
            });

            const activeProfiles = await prisma.processingProfile.findMany({
                where: { isActive: true },
            });

            expect(activeProfiles).toHaveLength(1);
            expect(activeProfiles[0].name).toBe('Profile 2');
        });
    });

    describe('Archive Behavior', () => {
        it('can archive a profile', async () => {
            const prisma = getPrisma();
            const profile = await seedProcessingProfile({ name: 'Archive Test' });

            await prisma.processingProfile.update({
                where: { id: profile.id },
                data: { isArchived: true },
            });

            const archived = await prisma.processingProfile.findUnique({
                where: { id: profile.id },
            });

            expect(archived?.isArchived).toBe(true);
        });

        it('excludes archived profiles from visible list', async () => {
            const prisma = getPrisma();
            await seedProcessingProfile({ name: 'Visible 1' });
            await seedProcessingProfile({ name: 'Visible 2' });
            await seedProcessingProfile({ name: 'Archived', isArchived: true });

            const visibleProfiles = await prisma.processingProfile.findMany({
                where: { isArchived: false },
            });

            // Default + Visible 1 + Visible 2 = 3
            expect(visibleProfiles).toHaveLength(3);
            expect(visibleProfiles.map(p => p.name)).not.toContain('Archived');
        });
    });
});
