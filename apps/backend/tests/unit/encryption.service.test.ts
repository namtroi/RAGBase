import { describe, test, expect, beforeAll } from 'vitest';
import { EncryptionService, EncryptedPayload } from '../../src/services/encryption.service.js';

// Valid 32-byte hex key (64 chars) for testing
const TEST_KEY = 'd62522e5e88d8c9255cf5d81d27c1d26bd14adf24a205a21ce32918aef5f4ee7';

describe('EncryptionService', () => {
    let service: EncryptionService;

    beforeAll(() => {
        service = new EncryptionService(TEST_KEY);
    });

    test('should encrypt and decrypt plaintext correctly', () => {
        const plaintext = 'my-secret-refresh-token-12345';

        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
    });

    test('should produce different ciphertext for same plaintext (random IV)', () => {
        const plaintext = 'same-text-different-output';

        const encrypted1 = service.encrypt(plaintext);
        const encrypted2 = service.encrypt(plaintext);

        // Ciphertext should differ (due to random IV)
        expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
        expect(encrypted1.iv).not.toBe(encrypted2.iv);

        // Both should decrypt correctly
        expect(service.decrypt(encrypted1)).toBe(plaintext);
        expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    test('should fail with invalid auth tag (tamper detection)', () => {
        const plaintext = 'tamper-test-data';
        const encrypted = service.encrypt(plaintext);

        // Tamper with the auth tag
        const tampered: EncryptedPayload = {
            ...encrypted,
            authTag: Buffer.from('bad-auth-tag-1234').toString('base64'),
        };

        expect(() => service.decrypt(tampered)).toThrow();
    });

    test('should fail with invalid key length', () => {
        expect(() => new EncryptionService('')).toThrow(/Invalid encryption key/);
        expect(() => new EncryptionService('too-short')).toThrow(/Invalid encryption key/);
        expect(() => new EncryptionService('a'.repeat(63))).toThrow(/Invalid encryption key/);
        expect(() => new EncryptionService('a'.repeat(65))).toThrow(/Invalid encryption key/);
    });

    test('should handle empty string', () => {
        const encrypted = service.encrypt('');
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe('');
    });

    test('should handle unicode characters', () => {
        const plaintext = '日本語テスト🔐émojis-and-ąccénts';

        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
    });

    test('should handle long strings', () => {
        const plaintext = 'x'.repeat(10000);  // 10KB string

        const encrypted = service.encrypt(plaintext);
        const decrypted = service.decrypt(encrypted);

        expect(decrypted).toBe(plaintext);
    });

    test('should fail with tampered ciphertext', () => {
        const plaintext = 'ciphertext-tamper-test';
        const encrypted = service.encrypt(plaintext);

        // Modify ciphertext bytes
        const tamperedCiphertext = Buffer.from(encrypted.ciphertext, 'base64');
        tamperedCiphertext[0] ^= 0xff;  // Flip bits in first byte

        const tampered: EncryptedPayload = {
            ...encrypted,
            ciphertext: tamperedCiphertext.toString('base64'),
        };

        expect(() => service.decrypt(tampered)).toThrow();
    });

    test('encrypted payload should have expected structure', () => {
        const encrypted = service.encrypt('test-structure');

        expect(encrypted).toHaveProperty('ciphertext');
        expect(encrypted).toHaveProperty('iv');
        expect(encrypted).toHaveProperty('authTag');

        // IV should decode to 12 bytes
        expect(Buffer.from(encrypted.iv, 'base64').length).toBe(12);

        // Auth tag should decode to 16 bytes
        expect(Buffer.from(encrypted.authTag, 'base64').length).toBe(16);
    });
});
