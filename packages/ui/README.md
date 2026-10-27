# @daybrief/ui

Design tokens, theme and primitives from `docs/design` (M0/T3). Showcase: `/dev/ui` in the app.

## Tokens

- `src/tokens/themes.ts`, `scenes.ts`: the CSS variables of `docs/design/tokens.css`, by the same names. `tokens.test.ts` fails if they drift from that file.
- `src/tokens/scale.ts`: radii, spacing, type roles, layout, motion.
- `src/tailwind.ts`: the NativeWind preset. Colors are `var(--…)` only and replace the default palette, so a color outside the tokens does not compile.

## Theme

`<ThemeProvider preference="auto | light | dark" lite?>` sets the variables with NativeWind `vars()` on a View. `auto` follows the OS. `lite` (default on Android) means weaker blur and denser plates. Providers nest: a subtree can render in the other theme.

Where a prop cannot take a CSS variable (icon colors, native shadows), read the resolved value with `useToken('ink-2')` or `useTheme().vars`.

## Conventions

- Text goes through `<Text variant tone weight>`. Manrope ships one family per weight, so `font-regular | font-medium | font-bold` set the family; Tailwind's `fontWeight` utilities are off (they would make the browser synthesize bold on top of bold).
- Don't combine a variant with an arbitrary `text-[Npx]` class: both set the font size and the winner depends on CSS order. Use `style` for one-off sizes.
- Web-only effects (backdrop blur, layered scene gradients, keyframe loops) live in `src/ui.css`, loaded through `styles.web.ts`. Native gets the same look from expo-blur and resolved styles.
- `Animated.View` does not take `className`: on web the animated primitives render a plain View with a CSS loop, on native they style the Animated.View directly.
- Loops (skeleton, orb, refresh spin) stop under `prefers-reduced-motion` / Reduce Motion.
- `darkMode: 'class'` in the preset only keeps NativeWind on web from throwing; themes never use `dark:` variants.
