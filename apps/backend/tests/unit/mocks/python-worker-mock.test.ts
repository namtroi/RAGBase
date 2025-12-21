import { ERRORS, failureCallback, successCallback } from '@tests/mocks/python-worker-mock.js';
import { describe, expect, it } from 'vitest';

describe('Python Worker Mock', () => {
  describe('successCallback', () => {
    it('should create success callback payload', () => {
      const payload = successCallback('doc-123');
      
      expect(payload.documentId).toBe('doc-123');
      expect(payload.success).toBe(true);
      expect(payload.result).toBeDefined();
      expect(payload.result?.markdown).toContain('Test Document');
      expect(payload.result?.pageCount).toBe(1);
      expect(payload.result?.ocrApplied).toBe(false);
      expect(payload.result?.processingTimeMs).toBeGreaterThan(0);
    });

    it('should allow custom result options', () => {
      const payload = successCallback('doc-123', {
        pageCount: 5,
        ocrApplied: true,
        processingTimeMs: 500,
      });
      
      expect(payload.result?.pageCount).toBe(5);
      expect(payload.result?.ocrApplied).toBe(true);
      expect(payload.result?.processingTimeMs).toBe(500);
    });
  });

  describe('failureCallback', () => {
    it('should create failure callback payload', () => {
      const payload = failureCallback('doc-123', 'TEST_ERROR', 'Test error message');
      
      expect(payload.documentId).toBe('doc-123');
      expect(payload.success).toBe(false);
      expect(payload.error).toBeDefined();
      expect(payload.error?.code).toBe('TEST_ERROR');
      expect(payload.error?.message).toBe('Test error message');
    });
  });

  describe('ERRORS', () => {
    it('should have password protected error', () => {
      const payload = ERRORS.passwordProtected('doc-123');
      
      expect(payload.success).toBe(false);
      expect(payload.error?.code).toBe('PASSWORD_PROTECTED');
    });

    it('should have corrupt file error', () => {
      const payload = ERRORS.corrupt('doc-123');
      
      expect(payload.success).toBe(false);
      expect(payload.error?.code).toBe('CORRUPT_FILE');
    });

    it('should have timeout error', () => {
      const payload = ERRORS.timeout('doc-123');
      
      expect(payload.success).toBe(false);
      expect(payload.error?.code).toBe('TIMEOUT');
    });

    it('should have OCR failed error', () => {
      const payload = ERRORS.ocrFailed('doc-123');
      
      expect(payload.success).toBe(false);
      expect(payload.error?.code).toBe('OCR_FAILED');
    });
  });
});
