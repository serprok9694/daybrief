import type { PartOfDay } from '@daybrief/core';

/**
 * Background scenes: CSS stand-ins for the interior photos (docs/design/tokens.css, `.sc-*`).
 * A photo replaces them later through `--scene-photo` without code changes.
 */
export type SceneName = PartOfDay;

export const sceneNames = ['morning', 'day', 'evening', 'night'] as const satisfies SceneName[];

export const scenes = {
  morning: {
    '--wall-a': '#EAD9C2',
    '--wall-b': '#D8BF9E',
    '--glow': 'rgba(255,244,222,.95)',
    '--wood': '#B58659',
    '--wood-2': '#A47549',
    '--floor': '#B48A62',
    '--floor-2': '#9B7249',
    '--obj': 'rgba(120,92,66,.45)',
  },
  day: {
    '--wall-a': '#F2EADF',
    '--wall-b': '#E3D5C2',
    '--glow': 'rgba(255,255,255,.95)',
    '--wood': '#C9A478',
    '--wood-2': '#B99266',
    '--floor': '#CBA77D',
    '--floor-2': '#B58F66',
    '--obj': 'rgba(130,105,80,.35)',
  },
  evening: {
    '--wall-a': '#D9A57C',
    '--wall-b': '#8E5F48',
    '--glow': 'rgba(255,176,112,.85)',
    '--wood': '#6F4630',
    '--wood-2': '#5E3A27',
    '--floor': '#6A4430',
    '--floor-2': '#4A2D20',
    '--obj': 'rgba(40,24,16,.55)',
  },
  night: {
    '--wall-a': '#2E2723',
    '--wall-b': '#171311',
    '--glow': 'rgba(255,181,102,.28)',
    '--wood': '#2B1E17',
    '--wood-2': '#231813',
    '--floor': '#1E1511',
    '--floor-2': '#120D0A',
    '--obj': 'rgba(0,0,0,.50)',
  },
} as const satisfies Record<SceneName, Record<`--${string}`, string>>;

export type SceneVars = (typeof scenes)[SceneName];

/** Hours each scene covers, for labels (matches `partOfDay` in @daybrief/core). */
export const sceneHours: Record<SceneName, readonly [string, string]> = {
  morning: ['05:00', '11:00'],
  day: ['11:00', '17:00'],
  evening: ['17:00', '22:00'],
  night: ['22:00', '05:00'],
};

/**
 * The `.scn` background as separate layer lists, with the scene colors resolved. Web uses the
 * same layers from CSS (ui.css, via the variables); native has no CSS variables inside
 * gradients, so it gets these resolved strings.
 */
export function sceneLayers(name: SceneName) {
  const s = scenes[name];
  const wood = `repeating-linear-gradient(90deg, ${s['--wood']} 0px 22px, ${s['--wood-2']} 22px 24px)`;
  return {
    backgroundImage: [
      `radial-gradient(48% 42% at 72% 18%, ${s['--glow']}, transparent 72%)`,
      `radial-gradient(34% 22% at 10% 96%, ${s['--obj']}, transparent 72%)`,
      `radial-gradient(26% 16% at 94% 98%, ${s['--obj']}, transparent 72%)`,
      wood,
      wood,
      `linear-gradient(0deg, ${s['--floor-2']}, ${s['--floor']})`,
      `linear-gradient(180deg, ${s['--wall-a']}, ${s['--wall-b']})`,
    ].join(', '),
    backgroundPosition: 'center, center, center, left top, right top, left bottom, center',
    backgroundSize: 'auto, auto, auto, 9% 520px, 9% 520px, 100% 20%, auto',
    backgroundRepeat: 'no-repeat',
  };
}
