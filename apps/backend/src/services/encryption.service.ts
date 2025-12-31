/**
 * AES-256-GCM Encryption Service
 * 
 * Used for encrypting sensitive data like Drive OAuth refresh tokens.
 * - Algorithm: AES-256-GCM (Authenticated Encryption with Associated Data)
 * - Key: 32 bytes from APP_ENCRYPTION_KEY env (64 hex chars)
 * - IV: 12 bytes, randomly generated per encryption
 * - Auth Tag: 16 bytes (GCM default)
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

export interface EncryptedPayload {
    ciphertext: string;  // Base64 encoded
    iv: string;          // Base64 encoded (12 bytes)
    authTag: string;     // Base64 encoded (16 bytes)
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;      // GCM recommended IV length
const AUTH_TAG_LENGTH = 16; // GCM default auth tag length
const KEY_LENGTH = 32;     // 256 bits = 32 bytes

export class EncryptionService {
    private key: Buffer;

    /**
     * @param keyHex - 32-byte key as hex string (64 chars)
     * @throws Error if key length is invalid
     */
    constructor(keyHex: string) {
        if (!keyHex || keyHex.length !== KEY_LENGTH * 2) {
            throw new Error(
                `Invalid encryption key: expected ${KEY_LENGTH * 2} hex characters, got ${keyHex?.length ?? 0}`
            );
        }
        this.key = Buffer.from(keyHex, 'hex');

        if (this.key.length !== KEY_LENGTH) {
            throw new Error(`Invalid hex encoding: key must be ${KEY_LENGTH} bytes`);
        }
    }

    /**
     * Encrypt plaintext using AES-256-GCM
     * @param plaintext - Text to encrypt
     * @returns EncryptedPayload with ciphertext, iv, and authTag (all base64)
     */
    encrypt(plaintext: string): EncryptedPayload {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, this.key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });

        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);

        const authTag = cipher.getAuthTag();

        return {
            ciphertext: encrypted.toString('base64'),
            iv: iv.toString('base64'),
            authTag: authTag.toString('base64'),
        };
    }

    /**
     * Decrypt an encrypted payload
     * @param payload - EncryptedPayload with ciphertext, iv, and authTag
     * @returns Original plaintext
     * @throws Error if authentication fails (tampered data)
     */
    decrypt(payload: EncryptedPayload): string {
        const iv = Buffer.from(payload.iv, 'base64');
        const ciphertext = Buffer.from(payload.ciphertext, 'base64');
        const authTag = Buffer.from(payload.authTag, 'base64');

        const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
            authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final(),
        ]);

        return decrypted.toString('utf8');
    }
}

// Singleton instance using environment variable
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get singleton EncryptionService instance
 * @throws Error if APP_ENCRYPTION_KEY is not set
 */
export function getEncryptionService(): EncryptionService {
    if (!encryptionServiceInstance) {
        const key = process.env.APP_ENCRYPTION_KEY;
        if (!key) {
            throw new Error('APP_ENCRYPTION_KEY environment variable is not set');
        }
        encryptionServiceInstance = new EncryptionService(key);
    }
    return encryptionServiceInstance;
}
