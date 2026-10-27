import { describe, expect, it } from 'vitest';
import { resolveTheme } from './resolve';

describe('resolveTheme', () => {
  it('uses an explicit preference regardless of the OS', () => {
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('follows the OS on auto', () => {
    expect(resolveTheme('auto', 'dark')).toBe('dark');
    expect(resolveTheme('auto', 'light')).toBe('light');
  });

  it('falls back to light when the OS scheme is unknown', () => {
    expect(resolveTheme('auto', null)).toBe('light');
    expect(resolveTheme('auto', 'unspecified')).toBe('light');
  });
});
