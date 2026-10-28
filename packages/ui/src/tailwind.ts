import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';
import { fontFamily, radius, type, type TypeRole } from './tokens';

/**
 * Tailwind / NativeWind preset. Colors are CSS variables only (the theme root sets them with
 * `vars()`), so one class works in both themes. The default palette is replaced, not extended:
 * a color outside the tokens does not compile.
 */
const v = (name: string) => `var(--${name})`;

const colors = {
  transparent: 'transparent',
  current: 'currentColor',
  ink: { DEFAULT: v('ink'), 2: v('ink-2'), 3: v('ink-3') },
  accent: {
    DEFAULT: v('accent'),
    ink: v('accent-ink'),
    soft: v('accent-soft'),
    solid: v('accent-solid'),
  },
  'on-accent': v('on-accent'),
  plate: { sheet: v('sheet-bg'), card: v('card-bg') },
  stroke: { DEFAULT: v('stroke'), card: v('stroke-card') },
  hi: v('hi'),
  fill: { DEFAULT: v('fill'), 2: v('fill-2') },
  line: v('line'),
  'btn-p': { DEFAULT: v('btn-p-bg'), ink: v('btn-p-ink') },
  'btn-s': { DEFAULT: v('btn-s-bg'), ink: v('btn-s-ink'), stroke: v('btn-s-stroke') },
  field: { DEFAULT: v('field-bg'), stroke: v('field-stroke') },
  sk: { a: v('sk-a'), b: v('sk-b') },
  av: { 1: v('av1'), 2: v('av2'), 3: v('av3'), 4: v('av4') },
  toast: { DEFAULT: v('toast-bg'), ink: v('toast-ink') },
};

const px = (n: number) => `${n}px`;
const size = (
  role: TypeRole,
  mobile = false,
): [string, { lineHeight: string; letterSpacing: string }] => {
  const s = mobile && role.mobile ? role.mobile : role;
  return [px(s.size), { lineHeight: px(s.lineHeight), letterSpacing: px(role.letterSpacing) }];
};

const preset = {
  content: [],
  // Themes switch through vars() on the theme root, not `dark:` variants. `class` keeps
  // NativeWind on web from fighting the media query when something touches <html> class.
  darkMode: 'class',
  theme: {
    colors,
    extend: {
      screens: { wide: px(701) },
      borderRadius: {
        sheet: px(radius.sheet),
        'sheet-m': px(radius.sheetMobile),
        card: px(radius.card),
        row: px(radius.row),
        picker: px(radius.picker),
        pill: px(radius.pill),
      },
      fontSize: {
        greeting: size(type.greeting),
        'greeting-m': size(type.greeting, true),
        summary: size(type.summary),
        'summary-m': size(type.summary, true),
        idea: size(type.idea),
        'idea-m': size(type.idea, true),
        title: size(type.widgetTitle),
        body: size(type.body),
        secondary: size(type.secondary),
        caption: size(type.caption),
        'label-lg': [px(16), { lineHeight: px(20), letterSpacing: '0px' }],
        label: [px(14), { lineHeight: px(18), letterSpacing: '0px' }],
        'label-sm': [px(13), { lineHeight: px(18), letterSpacing: '0px' }],
      },
    },
  },
  // Manrope ships one family per weight, so weight utilities pick the family instead of
  // setting font-weight (which would make the browser synthesize bold on top of bold).
  corePlugins: { fontWeight: false },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.font-regular': { fontFamily: fontFamily[400] },
        '.font-medium': { fontFamily: fontFamily[500] },
        '.font-bold': { fontFamily: fontFamily[700] },
      });
    }),
  ],
} satisfies Config;

export default preset;
