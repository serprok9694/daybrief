import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decrypt, encrypt, parseKey } from './crypto';

const key = randomBytes(32);
const token = '1//0refresh-token-example';

describe('encrypt/decrypt', () => {
  it('round-trips', () => {
    expect(decrypt(encrypt(token, key), key)).toBe(token);
  });

  it('uses a fresh IV per call', () => {
    expect(encrypt(token, key)).not.toBe(encrypt(token, key));
  });

  it('fails with the wrong key', () => {
    expect(() => decrypt(encrypt(token, key), randomBytes(32))).toThrow();
  });

  it('fails on tampered ciphertext', () => {
    const [version, iv, ciphertext, tag] = encrypt(token, key).split('.');
    const bytes = Buffer.from(ciphertext!, 'base64url');
    bytes[0] = bytes[0]! ^ 0x01;
    const tampered = [version, iv, bytes.toString('base64url'), tag].join('.');
    expect(() => decrypt(tampered, key)).toThrow();
  });

  it('fails on a tampered tag', () => {
    const parts = encrypt(token, key).split('.');
    parts[3] = Buffer.alloc(16).toString('base64url');
    expect(() => decrypt(parts.join('.'), key)).toThrow();
  });

  it('rejects malformed payloads', () => {
    expect(() => decrypt('not-a-payload', key)).toThrow('Malformed');
    expect(() => decrypt('v2.a.b.c', key)).toThrow('Malformed');
  });
});

describe('parseKey', () => {
  it('accepts 32 bytes in base64', () => {
    const raw = randomBytes(32).toString('base64');
    expect(parseKey(raw)).toHaveLength(32);
  });

  it('rejects a missing or short key', () => {
    expect(() => parseKey(undefined)).toThrow('not set');
    expect(() => parseKey(randomBytes(16).toString('base64'))).toThrow('32 bytes');
  });
});
