import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scenes, themes, liteOverrides, themeVars, sceneLayers } from './index';

// The design's tokens.css is the reference; these tests keep the TS copy in sync with it.
const css = readFileSync(
  resolve(import.meta.dirname, '../../../../docs/design/tokens.css'),
  'utf8',
);

function block(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`No ${selector} block in tokens.css`);
  const vars: Record<string, string> = {};
  for (const decl of match[1].split(';')) {
    const [name, ...value] = decl.split(':');
    if (name?.trim().startsWith('--')) vars[name.trim()] = value.join(':').trim();
  }
  return vars;
}

const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase();
const normAll = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, norm(v)]));

describe('theme tokens', () => {
  it.each(['light', 'dark'] as const)('%s matches .th-%s in tokens.css', (name) => {
    expect(normAll(themes[name])).toEqual(normAll(block(`.th-${name}`)));
  });

  it.each(['light', 'dark'] as const)('%s lite matches .th-%s.lite', (name) => {
    expect(normAll(liteOverrides[name])).toEqual(normAll(block(`.th-${name}.lite`)));
  });

  it('light and dark define the same variables', () => {
    expect(Object.keys(themes.dark).sort()).toEqual(Object.keys(themes.light).sort());
  });

  it('themeVars applies lite on top of the theme', () => {
    expect(themeVars('dark', true)['--card-bg']).toBe(liteOverrides.dark['--card-bg']);
    expect(themeVars('dark', true)['--ink']).toBe(themes.dark['--ink']);
    expect(themeVars('dark')['--card-bg']).toBe(themes.dark['--card-bg']);
  });
});

describe('scenes', () => {
  it.each(['morning', 'day', 'evening', 'night'] as const)('%s matches .sc-%s', (name) => {
    expect(normAll(scenes[name])).toEqual(normAll(block(`.sc-${name}`)));
  });

  it('resolves scene colors into the native layers', () => {
    const layers = sceneLayers('night');
    expect(layers.backgroundImage).toContain(scenes.night['--wall-a']);
    expect(layers.backgroundImage).not.toContain('var(');
    expect(layers.backgroundSize.split(',')).toHaveLength(7);
  });
});
