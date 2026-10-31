import { describe, expect, it } from 'vitest';
import { apiTokenLast4, isApiTokenLike, parseApiToken, parseApiTokenName } from './api-tokens';

const token = `dbf_${'A1b2_-'.repeat(7)}x`;

describe('parseApiToken', () => {
  it('accepts dbf_ + 43 base64url characters', () => {
    expect(token).toHaveLength(47);
    expect(parseApiToken(token)).toBe(token);
  });

  it('rejects anything else', () => {
    for (const value of [
      '',
      'dbf_',
      token.slice(0, -1),
      `${token}x`,
      token.replace('dbf_', 'dbx_'),
      token.replace('A', '+'),
      `${token.slice(0, -1)}=`,
      ` ${token}`,
    ]) {
      expect(parseApiToken(value)).toBeNull();
    }
  });
});

describe('isApiTokenLike', () => {
  it('tells API tokens from JWTs by the prefix', () => {
    expect(isApiTokenLike(token)).toBe(true);
    expect(isApiTokenLike('dbf_garbage')).toBe(true);
    expect(isApiTokenLike('eyJhbGciOiJFUzI1NiJ9.e30.sig')).toBe(false);
  });
});

describe('apiTokenLast4', () => {
  it('is the last four characters', () => {
    expect(apiTokenLast4(token)).toBe('2_-x');
    expect(apiTokenLast4('dbf_abcdwxyz')).toBe('wxyz');
  });
});

describe('parseApiTokenName', () => {
  it('trims the name', () => {
    expect(parseApiTokenName({ name: '  iPhone · Send to daybrief ' })).toBe(
      'iPhone · Send to daybrief',
    );
  });

  it('rejects empty, long and malformed names', () => {
    for (const body of [null, 'x', {}, { name: 1 }, { name: '  ' }, { name: 'n'.repeat(101) }]) {
      expect(parseApiTokenName(body)).toBeNull();
    }
    expect(parseApiTokenName({ name: 'n'.repeat(100) })).toBe('n'.repeat(100));
  });
});
