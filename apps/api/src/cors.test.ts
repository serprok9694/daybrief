import { describe, expect, it } from 'vitest';
import { allowedOrigin } from './cors';

describe('allowedOrigin', () => {
  it.each([
    'https://daybrief-web.vercel.app',
    'http://localhost:8081',
    'https://daybrief-web-abc123def-serprok9694-1239s-projects.vercel.app',
    'https://daybrief-web-git-m0-t6-signin-serprok9694-1239s-projects.vercel.app',
  ])('allows %s', (origin) => {
    expect(allowedOrigin(origin)).toBe(origin);
  });

  it.each([
    'https://evil.example',
    'http://daybrief-web.vercel.app',
    'https://daybrief-web.vercel.app.evil.example',
    'https://daybrief-web-x-someone-else.vercel.app',
    'http://localhost:3000',
    '',
  ])('refuses %s', (origin) => {
    expect(allowedOrigin(origin)).toBeNull();
  });
});
