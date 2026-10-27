/**
 * Theme tokens, transferred 1:1 from docs/design/tokens.css (`.th-light`, `.th-dark`, `.lite`).
 * Keys are the CSS variable names: the theme root sets them with NativeWind `vars()` and the
 * Tailwind preset refers to them as `var(--name)`. tokens.test.ts checks them against tokens.css.
 */

export type ThemeName = 'light' | 'dark';

export const themes = {
  light: {
    '--ink': '#1F1B18',
    '--ink-2': '#4A423B',
    '--ink-3': '#5A5149',
    '--accent': '#E4572A',
    '--accent-ink': '#8F2A06',
    '--accent-soft': 'rgba(228,87,42,.12)',
    '--accent-solid': '#B93A12',
    '--on-accent': '#FFFFFF',
    '--sheet-bg': 'rgba(255,250,244,.56)',
    '--card-bg': 'rgba(255,252,248,.62)',
    '--stroke': 'rgba(255,255,255,.70)',
    '--stroke-card': 'rgba(255,255,255,.80)',
    '--hi': 'rgba(255,255,255,.85)',
    '--blur': '40px',
    '--blur-card': '24px',
    '--sat': '1.5',
    '--shadow-sheet': '0 40px 80px -36px rgba(45,28,12,.50)',
    '--shadow-card': '0 14px 32px -18px rgba(60,38,18,.35)',
    '--fill': 'rgba(31,27,24,.06)',
    '--fill-2': 'rgba(31,27,24,.10)',
    '--line': 'rgba(31,27,24,.18)',
    '--btn-p-bg': '#17130F',
    '--btn-p-ink': '#FFFFFF',
    '--btn-s-bg': 'rgba(255,255,255,.75)',
    '--btn-s-ink': '#1F1B18',
    '--btn-s-stroke': 'rgba(31,27,24,.14)',
    '--field-bg': 'rgba(255,255,255,.72)',
    '--field-stroke': 'rgba(31,27,24,.12)',
    '--sk-a': 'rgba(31,27,24,.07)',
    '--sk-b': 'rgba(31,27,24,.14)',
    '--av1': '#E9D5BC',
    '--av2': '#D5DBC6',
    '--av3': '#DAD5CE',
    '--av4': '#EBCFC4',
    '--toast-bg': '#17130F',
    '--toast-ink': '#FFFFFF',
  },
  dark: {
    '--ink': '#F6F0E9',
    '--ink-2': '#DDD3C8',
    '--ink-3': '#C4B9AD',
    '--accent': '#FF8A57',
    '--accent-ink': '#FFB08A',
    '--accent-soft': 'rgba(255,138,87,.14)',
    '--accent-solid': '#FF9A6A',
    '--on-accent': '#17130F',
    '--sheet-bg': 'rgba(34,28,24,.72)',
    '--card-bg': 'rgba(52,44,38,.60)',
    '--stroke': 'rgba(255,255,255,.14)',
    '--stroke-card': 'rgba(255,255,255,.12)',
    '--hi': 'rgba(255,255,255,.14)',
    '--blur': '40px',
    '--blur-card': '24px',
    '--sat': '1.4',
    '--shadow-sheet': '0 40px 90px -30px rgba(0,0,0,.70)',
    '--shadow-card': '0 16px 36px -18px rgba(0,0,0,.60)',
    '--fill': 'rgba(255,255,255,.07)',
    '--fill-2': 'rgba(255,255,255,.12)',
    '--line': 'rgba(255,255,255,.22)',
    '--btn-p-bg': '#F6F0E9',
    '--btn-p-ink': '#17130F',
    '--btn-s-bg': 'rgba(255,255,255,.10)',
    '--btn-s-ink': '#F6F0E9',
    '--btn-s-stroke': 'rgba(255,255,255,.20)',
    '--field-bg': 'rgba(255,255,255,.08)',
    '--field-stroke': 'rgba(255,255,255,.16)',
    '--sk-a': 'rgba(255,255,255,.07)',
    '--sk-b': 'rgba(255,255,255,.16)',
    '--av1': '#5A4A3C',
    '--av2': '#44503F',
    '--av3': '#4B4741',
    '--av4': '#5C4038',
    '--toast-bg': '#F6F0E9',
    '--toast-ink': '#17130F',
  },
} as const satisfies Record<ThemeName, Record<`--${string}`, string>>;

export type ThemeVar = keyof (typeof themes)['light'];
export type ThemeVars = Record<ThemeVar, string>;

/** Android / low-power glass: weaker blur, denser plate. */
export const liteOverrides = {
  light: {
    '--blur': '10px',
    '--blur-card': '6px',
    '--sheet-bg': 'rgba(255,250,244,.84)',
    '--card-bg': 'rgba(255,252,248,.88)',
  },
  dark: {
    '--blur': '10px',
    '--blur-card': '6px',
    '--sheet-bg': 'rgba(34,28,24,.88)',
    '--card-bg': 'rgba(52,44,38,.82)',
  },
} as const satisfies Record<ThemeName, Partial<ThemeVars>>;

/** Variables for one theme, with the lite glass applied on top when requested. */
export function themeVars(theme: ThemeName, lite = false): ThemeVars {
  return lite ? { ...themes[theme], ...liteOverrides[theme] } : { ...themes[theme] };
}
