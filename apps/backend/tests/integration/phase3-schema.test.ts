import { cleanDatabase, getPrisma, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

/**
 * Phase 3A: Schema Migration Tests
 * 
 * Tests for new isActive and connectionState fields on Document model.
 */
describe('Phase 3A: Document Schema Fields', () => {
    let prisma: any;

    beforeAll(async () => {
        prisma = getPrisma();
    });

    beforeEach(async () => {
        await cleanDatabase();
    });

    describe('isActive field', () => {
        it('should default to true for new documents', async () => {
            const doc = await seedDocument({ filename: 'test.pdf' });

            const fetched = await prisma.document.findUnique({
                where: { id: doc.id },
                select: { isActive: true },
            });

            expect(fetched.isActive).toBe(true);
        });

        it('should allow creating document with isActive = false', async () => {
            const doc = await seedDocument({
                filename: 'inactive.pdf',
                isActive: false,
            });

            const fetched = await prisma.document.findUnique({
                where: { id: doc.id },
                select: { isActive: true },
            });

            expect(fetched.isActive).toBe(false);
        });

        it('should allow updating isActive', async () => {
            const doc = await seedDocument({ filename: 'test.pdf' });

            await prisma.document.update({
                where: { id: doc.id },
                data: { isActive: false },
            });

            const fetched = await prisma.document.findUnique({
                where: { id: doc.id },
                select: { isActive: true },
            });

            expect(fetched.isActive).toBe(false);
        });

        it('should allow filtering by isActive', async () => {
            await seedDocument({ filename: 'active1.pdf', md5Hash: 'h1', isActive: true });
            await seedDocument({ filename: 'active2.pdf', md5Hash: 'h2', isActive: true });
            await seedDocument({ filename: 'inactive.pdf', md5Hash: 'h3', isActive: false });

            const activeOnly = await prisma.document.findMany({
                where: { isActive: true },
            });
            const inactiveOnly = await prisma.document.findMany({
                where: { isActive: false },
            });

            expect(activeOnly).toHaveLength(2);
            expect(inactiveOnly).toHaveLength(1);
        });
    });

    describe('connectionState field', () => {
        it('should default to STANDALONE for new documents', async () => {
            const doc = await seedDocument({ filename: 'test.pdf' });

            const fetched = await prisma.document.findUnique({
                where: { id: doc.id },
                select: { connectionState: true },
            });

            expect(fetched.connectionState).toBe('STANDALONE');
        });

        it('should allow creating document with connectionState = LINKED', async () => {
            const doc = await seedDocument({
                filename: 'linked.pdf',
                connectionState: 'LINKED',
            });

            const fetched = await prisma.document.findUnique({
                where: { id: doc.id },
                select: { connectionState: true },
            });

            expect(fetched.connectionState).toBe('LINKED');
        });

        it('should allow updating connectionState', async () => {
            const doc = await seedDocument({ filename: 'test.pdf' });

            await prisma.document.update({
                where: { id: doc.id },
                data: { connectionState: 'LINKED' },
            });

            const fetched = await prisma.document.findUnique({
                where: { id: doc.id },
                select: { connectionState: true },
            });

            expect(fetched.connectionState).toBe('LINKED');
        });

        it('should allow filtering by connectionState', async () => {
            await seedDocument({ filename: 'standalone1.pdf', md5Hash: 'h1', connectionState: 'STANDALONE' });
            await seedDocument({ filename: 'linked1.pdf', md5Hash: 'h2', connectionState: 'LINKED' });
            await seedDocument({ filename: 'linked2.pdf', md5Hash: 'h3', connectionState: 'LINKED' });

            const standalone = await prisma.document.findMany({
                where: { connectionState: 'STANDALONE' },
            });
            const linked = await prisma.document.findMany({
                where: { connectionState: 'LINKED' },
            });

            expect(standalone).toHaveLength(1);
            expect(linked).toHaveLength(2);
        });
    });

    describe('combined filtering', () => {
        it('should allow filtering by both isActive and connectionState', async () => {
            await seedDocument({
                filename: 'active-standalone.pdf',
                md5Hash: 'h1',
                isActive: true,
                connectionState: 'STANDALONE'
            });
            await seedDocument({
                filename: 'active-linked.pdf',
                md5Hash: 'h2',
                isActive: true,
                connectionState: 'LINKED'
            });
            await seedDocument({
                filename: 'inactive-linked.pdf',
                md5Hash: 'h3',
                isActive: false,
                connectionState: 'LINKED'
            });

            const activeLinked = await prisma.document.findMany({
                where: { isActive: true, connectionState: 'LINKED' },
            });

            expect(activeLinked).toHaveLength(1);
            expect(activeLinked[0].filename).toBe('active-linked.pdf');
        });
    });
});
