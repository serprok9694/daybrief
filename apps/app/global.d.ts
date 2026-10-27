// Side-effect CSS imports (global.css, NativeWind input) on web.
declare module '*.css';

// nativewind ships an empty .d.ts for its Tailwind preset.
declare module 'nativewind/preset' {
  import type { Config } from 'tailwindcss';
  const preset: Partial<Config>;
  export default preset;
}
