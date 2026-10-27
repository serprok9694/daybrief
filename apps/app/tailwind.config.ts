import ui from '@daybrief/ui/tailwind';
import nativewind from 'nativewind/preset';
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  presets: [nativewind, ui],
} satisfies Config;
