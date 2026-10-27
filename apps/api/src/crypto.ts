import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM for Google refresh tokens at rest (PRD 6.4).
// Payload: `v1.<iv>.<ciphertext>.<tag>`, each part base64url. The version prefix leaves
// room for key rotation.
const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

/** Parses `TOKEN_ENCRYPTION_KEY`: 32 random bytes, base64 (`openssl rand -base64 32`). */
export function parseKey(raw: string | undefined): Buffer {
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new Error(`TOKEN_ENCRYPTION_KEY must be ${KEY_BYTES} bytes, base64-encoded`);
  }
  return key;
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, ciphertext, tag]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/** Throws if the payload is malformed, was tampered with or was encrypted with another key. */
export function decrypt(payload: string, key: Buffer): string {
  const [version, iv, ciphertext, tag, ...rest] = payload.split('.');
  if (version !== VERSION || !iv || ciphertext === undefined || !tag || rest.length > 0) {
    throw new Error('Malformed encrypted payload');
  }
  const ivBytes = Buffer.from(iv, 'base64url');
  const tagBytes = Buffer.from(tag, 'base64url');
  if (ivBytes.length !== IV_BYTES || tagBytes.length !== TAG_BYTES) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = createDecipheriv(ALGORITHM, key, ivBytes, { authTagLength: TAG_BYTES });
  decipher.setAuthTag(tagBytes);
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
