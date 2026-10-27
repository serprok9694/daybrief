import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { cx } from '../cx';
import type { TokenName } from '../theme/ThemeProvider';

/** Type roles from the design; mobile sizes apply below the 700 px breakpoint. */
const variants = {
  greeting: 'text-greeting-m wide:text-greeting font-bold',
  summary: 'text-summary-m wide:text-summary font-medium',
  idea: 'text-idea-m wide:text-idea font-bold',
  title: 'text-title font-bold',
  body: 'text-body font-medium',
  secondary: 'text-secondary font-medium',
  caption: 'text-caption font-bold',
  /** Button labels and avatar initials: 14, small buttons 13, the user's avatar 16. */
  label: 'text-label font-bold',
  'label-lg': 'text-label-lg font-bold',
  'label-sm': 'text-label-sm font-bold',
} as const;

export type TextVariant = keyof typeof variants;
export type TextTone = Extract<
  TokenName,
  'ink' | 'ink-2' | 'ink-3' | 'accent-ink' | 'on-accent' | 'btn-p-ink' | 'btn-s-ink' | 'toast-ink'
>;

const tones: Record<TextTone, string> = {
  ink: 'text-ink',
  'ink-2': 'text-ink-2',
  'ink-3': 'text-ink-3',
  'accent-ink': 'text-accent-ink',
  'on-accent': 'text-on-accent',
  'btn-p-ink': 'text-btn-p-ink',
  'btn-s-ink': 'text-btn-s-ink',
  'toast-ink': 'text-toast-ink',
};

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides the variant's weight. */
  weight?: 'regular' | 'medium' | 'bold';
  /** System monospace (token values, code). Only for dev and technical screens. */
  mono?: boolean;
  className?: string;
}

const weightClass = { regular: 'font-regular', medium: 'font-medium', bold: 'font-bold' } as const;
const monoWeight = { regular: '400', medium: '500', bold: '700' } as const;

/** Manrope text in a design type role. Color comes from `tone`, never from raw values. */
export function Text({
  variant = 'body',
  tone = 'ink',
  weight,
  mono = false,
  className,
  style,
  ...rest
}: TextProps) {
  const family = mono ? 'font-mono' : weight ? weightClass[weight] : undefined;
  const base = family ? variants[variant].replace(/font-\w+/, family) : variants[variant];
  // Manrope picks the weight by family; the system monospace needs a real font-weight.
  const monoStyle = mono ? { fontWeight: monoWeight[weight ?? 'medium'] } : undefined;
  return (
    <RNText className={cx(base, tones[tone], className)} style={[monoStyle, style]} {...rest} />
  );
}
