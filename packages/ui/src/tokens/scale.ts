/** Non-color tokens from docs/design/tokens.json: radii, spacing, type, layout, motion. */

export const radius = { sheet: 40, sheetMobile: 32, card: 28, row: 16, pill: 999 } as const;

export const space = [4, 8, 12, 16, 20, 24, 32, 44] as const;

/** Manrope faces as registered by `@expo-google-fonts/manrope` (one family per weight). */
export const fontFamily = {
  400: 'Manrope_400Regular',
  500: 'Manrope_500Medium',
  700: 'Manrope_700Bold',
} as const;

export type FontWeight = keyof typeof fontFamily;

export interface TypeRole {
  size: number;
  lineHeight: number;
  weight: FontWeight;
  /** In px, converted from the design's em value (RN has no em). */
  letterSpacing: number;
  mobile?: { size: number; lineHeight: number };
}

const em = (value: number, size: number) => Math.round(value * size * 100) / 100;

export const type = {
  greeting: {
    size: 44,
    lineHeight: 52,
    weight: 700,
    letterSpacing: em(-0.02, 44),
    mobile: { size: 30, lineHeight: 36 },
  },
  summary: {
    size: 26,
    lineHeight: 38,
    weight: 500,
    letterSpacing: em(-0.01, 26),
    mobile: { size: 20, lineHeight: 29 },
  },
  idea: {
    size: 22,
    lineHeight: 30,
    weight: 700,
    letterSpacing: em(-0.01, 22),
    mobile: { size: 19, lineHeight: 27 },
  },
  widgetTitle: { size: 17, lineHeight: 24, weight: 700, letterSpacing: 0 },
  body: { size: 15, lineHeight: 22, weight: 500, letterSpacing: 0 },
  secondary: { size: 13, lineHeight: 18, weight: 500, letterSpacing: 0 },
  caption: { size: 12, lineHeight: 16, weight: 700, letterSpacing: 0 },
} as const satisfies Record<string, TypeRole>;

export type TypeRoleName = keyof typeof type;

export const layout = {
  mobileBreakpoint: 700,
  railWidth: 0,
  gridMinColumn: 340,
  hitTarget: 44,
} as const;

/** Durations in ms. All loops stop when the OS asks for reduced motion. */
export const motion = { skeleton: 1600, orbBreathe: 5000, refreshSpin: 1000 } as const;

/** AI orb gradient (tokens.css `.orb`): fixed warm stops around the theme accent. */
export const orbStops = ['#FFEBDD', '#FFB48A', '#9A3412'] as const;
