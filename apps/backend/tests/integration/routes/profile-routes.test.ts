/**
 * Processing Profile Routes - Integration Tests
 * 
 * Tests all /api/profiles endpoints including:
 * - List profiles
 * - Get active profile
 * - Create profile
 * - Duplicate profile
 * - Activate/archive/unarchive
 * - Delete with confirmation
 */

import { closeTestApp, createTestApp } from '@tests/helpers/api.js';
import { cleanDatabase, ensureDefaultProfile, getPrisma, seedProcessingProfile, seedDocument } from '@tests/helpers/database.js';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

describe('Processing Profile Routes', () => {
  let app: any;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  beforeEach(async () => {
    await cleanDatabase();
    await ensureDefaultProfile();
  });

  // ============================================================
  // GET /api/profiles
  // ============================================================

  describe('GET /api/profiles', () => {
    it('returns all visible profiles with document count', async () => {
      await seedProcessingProfile({ name: 'Profile A' });
      await seedProcessingProfile({ name: 'Profile B' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/profiles',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profiles).toHaveLength(3); // Default + A + B
      expect(data.profiles[0]).toHaveProperty('documentCount');
    });

    it('excludes archived profiles by default', async () => {
      await seedProcessingProfile({ name: 'Visible' });
      await seedProcessingProfile({ name: 'Archived', isArchived: true });

      const response = await app.inject({
        method: 'GET',
        url: '/api/profiles',
      });

      const data = JSON.parse(response.body);
      expect(data.profiles.map((p: any) => p.name)).not.toContain('Archived');
    });

    it('includes archived when includeArchived=true', async () => {
      await seedProcessingProfile({ name: 'Visible' });
      await seedProcessingProfile({ name: 'Archived', isArchived: true });

      const response = await app.inject({
        method: 'GET',
        url: '/api/profiles?includeArchived=true',
      });

      const data = JSON.parse(response.body);
      expect(data.profiles.map((p: any) => p.name)).toContain('Archived');
    });

    it('includes all profile settings in response', async () => {
      await seedProcessingProfile({
        name: 'Full Settings',
        documentChunkSize: 500,
        pdfOcrMode: 'force',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/profiles',
      });

      const data = JSON.parse(response.body);
      const profile = data.profiles.find((p: any) => p.name === 'Full Settings');
      expect(profile.documentChunkSize).toBe(500);
      expect(profile.pdfOcrMode).toBe('force');
    });
  });

  // ============================================================
  // GET /api/profiles/active
  // ============================================================

  describe('GET /api/profiles/active', () => {
    it('returns the active profile', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/profiles/active',
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.isActive).toBe(true);
      expect(data.profile.name).toBe('Default');
    });
  });

  // ============================================================
  // POST /api/profiles
  // ============================================================

  describe('POST /api/profiles', () => {
    it('creates a new profile with custom values', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/profiles',
        payload: {
          name: 'Custom Profile',
          description: 'Test description',
          documentChunkSize: 500,
          pdfOcrMode: 'force',
        },
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.profile.name).toBe('Custom Profile');
      expect(data.profile.documentChunkSize).toBe(500);
      expect(data.profile.isActive).toBe(false);
      expect(data.profile.isDefault).toBe(false);
    });

    it('enforces unique name constraint', async () => {
      await seedProcessingProfile({ name: 'Existing' });

      const response = await app.inject({
        method: 'POST',
        url: '/api/profiles',
        payload: { name: 'Existing' },
      });

      expect(response.statusCode).toBe(409);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('CONFLICT');
    });

    it('validates required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/profiles',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('validates field constraints', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/profiles',
        payload: {
          name: 'Test',
          documentChunkSize: 50, // Below minimum of 100
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================
  // POST /api/profiles/:id/duplicate
  // ============================================================

  describe('POST /api/profiles/:id/duplicate', () => {
    it('creates copy with auto-versioned name', async () => {
      const source = await seedProcessingProfile({
        name: 'Source',
        documentChunkSize: 750,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/profiles/${source.id}/duplicate`,
        payload: {},
      });

      expect(response.statusCode).toBe(201);
      const data = JSON.parse(response.body);
      expect(data.profile.name).toBe('Source v2');
      expect(data.profile.documentChunkSize).toBe(750);
    });

    it('increments version number correctly', async () => {
      const source = await seedProcessingProfile({ name: 'Base v2' });

      const response = await app.inject({
        method: 'POST',
        url: `/api/profiles/${source.id}/duplicate`,
        payload: {},
      });

      const data = JSON.parse(response.body);
      expect(data.profile.name).toBe('Base v3');
    });

    it('uses provided name if given', async () => {
      const source = await seedProcessingProfile({ name: 'Original' });

      const response = await app.inject({
        method: 'POST',
        url: `/api/profiles/${source.id}/duplicate`,
        payload: { name: 'Custom Clone' },
      });

      const data = JSON.parse(response.body);
      expect(data.profile.name).toBe('Custom Clone');
    });

    it('copies all settings from source', async () => {
      const source = await seedProcessingProfile({
        name: 'Source Complete',
        documentChunkSize: 800,
        documentChunkOverlap: 80,
        pdfOcrMode: 'never',
        qualityMinChars: 100,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/profiles/${source.id}/duplicate`,
        payload: {},
      });

      const data = JSON.parse(response.body);
      expect(data.profile.documentChunkSize).toBe(800);
      expect(data.profile.documentChunkOverlap).toBe(80);
      expect(data.profile.pdfOcrMode).toBe('never');
      expect(data.profile.qualityMinChars).toBe(100);
    });

    it('returns 404 for non-existent profile', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/profiles/nonexistent-id/duplicate',
        payload: {},
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ============================================================
  // PUT /api/profiles/:id/activate
  // ============================================================

  describe('PUT /api/profiles/:id/activate', () => {
    it('activates profile and deactivates others', async () => {
      const prisma = getPrisma();
      const newProfile = await seedProcessingProfile({ name: 'New Active' });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${newProfile.id}/activate`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.isActive).toBe(true);

      // Verify only one is active
      const activeProfiles = await prisma.processingProfile.findMany({
        where: { isActive: true },
      });
      expect(activeProfiles).toHaveLength(1);
      expect(activeProfiles[0].id).toBe(newProfile.id);
    });

    it('blocks activating archived profile', async () => {
      const archived = await seedProcessingProfile({
        name: 'Archived',
        isArchived: true,
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${archived.id}/activate`,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('archived');
    });
  });

  // ============================================================
  // PUT /api/profiles/:id/archive
  // ============================================================

  describe('PUT /api/profiles/:id/archive', () => {
    it('archives a non-active non-default profile', async () => {
      const profile = await seedProcessingProfile({ name: 'To Archive' });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${profile.id}/archive`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.isArchived).toBe(true);
    });

    it('blocks archiving the default profile', async () => {
      const prisma = getPrisma();
      const defaultProfile = await prisma.processingProfile.findFirst({
        where: { isDefault: true },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${defaultProfile!.id}/archive`,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('default');
    });

    it('blocks archiving the active profile', async () => {
      // Create and activate a non-default profile to test the 'active' check
      const activeProfile = await seedProcessingProfile({ name: 'Active Test', isActive: true });
      // Deactivate default so our profile is the only active one
      const prisma = getPrisma();
      await prisma.processingProfile.updateMany({
        where: { isDefault: true },
        data: { isActive: false },
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${activeProfile.id}/archive`,
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('active');
    });
  });

  // ============================================================
  // PUT /api/profiles/:id/unarchive
  // ============================================================

  describe('PUT /api/profiles/:id/unarchive', () => {
    it('restores an archived profile', async () => {
      const profile = await seedProcessingProfile({
        name: 'Archived',
        isArchived: true,
      });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${profile.id}/unarchive`,
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.profile.isArchived).toBe(false);
    });

    it('returns error if profile not archived', async () => {
      const profile = await seedProcessingProfile({ name: 'Not Archived' });

      const response = await app.inject({
        method: 'PUT',
        url: `/api/profiles/${profile.id}/unarchive`,
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ============================================================
  // DELETE /api/profiles/:id
  // ============================================================

  describe('DELETE /api/profiles/:id', () => {
    it('blocks deleting the default profile', async () => {
      const prisma = getPrisma();
      const defaultProfile = await prisma.processingProfile.findFirst({
        where: { isDefault: true },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/profiles/${defaultProfile!.id}`,
        payload: { confirmed: true },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('default');
    });

    it('blocks deleting the active profile', async () => {
      // Create and activate a non-default profile to test the 'active' check
      const activeProfile = await seedProcessingProfile({ name: 'Active Delete Test', isActive: true, isArchived: true });
      // Deactivate default so our profile is the only active one
      const prisma = getPrisma();
      await prisma.processingProfile.updateMany({
        where: { isDefault: true },
        data: { isActive: false },
      });
      // Make our profile active (but still archived for testing)
      await prisma.processingProfile.update({
        where: { id: activeProfile.id },
        data: { isActive: true },
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/profiles/${activeProfile.id}`,
        payload: { confirmed: true },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('active');
    });

    it('requires profile to be archived before deletion', async () => {
      const profile = await seedProcessingProfile({ name: 'Not Archived' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/profiles/${profile.id}`,
        payload: { confirmed: true },
      });

      expect(response.statusCode).toBe(400);
      const data = JSON.parse(response.body);
      expect(data.message).toContain('archived');
    });

    it('returns confirmation prompt if has documents', async () => {
      const profile = await seedProcessingProfile({
        name: 'With Docs',
        isArchived: true,
      });
      await seedDocument({
        md5Hash: `del-test-${Date.now()}`,
        processingProfileId: profile.id,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/profiles/${profile.id}`,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.requireConfirmation).toBe(true);
      expect(data.documentCount).toBe(1);
    });

    it('deletes profile and documents when confirmed', async () => {
      const prisma = getPrisma();
      const profile = await seedProcessingProfile({
        name: 'To Delete',
        isArchived: true,
      });
      await seedDocument({
        md5Hash: `del-confirm-${Date.now()}`,
        processingProfileId: profile.id,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/profiles/${profile.id}`,
        payload: { confirmed: true },
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);

      // Verify profile is deleted
      const deleted = await prisma.processingProfile.findUnique({
        where: { id: profile.id },
      });
      expect(deleted).toBeNull();
    });

    it('deletes empty archived profile without confirmation', async () => {
      const profile = await seedProcessingProfile({
        name: 'Empty',
        isArchived: true,
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/profiles/${profile.id}`,
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      expect(data.success).toBe(true);
    });
  });
});
