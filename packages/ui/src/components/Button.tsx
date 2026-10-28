import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { cx } from '../cx';
import type { TokenName } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text, type TextTone } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

const variants: Record<ButtonVariant, { box: string; tone: TextTone & TokenName }> = {
  primary: { box: 'bg-btn-p border-transparent dbf-btn-p', tone: 'btn-p-ink' },
  secondary: { box: 'bg-btn-s border-btn-s-stroke hover:bg-fill-2', tone: 'btn-s-ink' },
  ghost: { box: 'bg-transparent border-transparent hover:bg-fill-2', tone: 'ink-2' },
};

export interface ButtonProps extends Omit<PressableProps, 'children'> {
  label: string;
  variant?: ButtonVariant;
  /** `small`: height 36 (still a 44 hit target through hitSlop). `large`: height 56, full-width CTAs. */
  size?: 'default' | 'small' | 'large';
  icon?: LucideIcon;
  /** Custom leading element instead of `icon` (e.g. the Google mark). */
  leading?: ReactNode;
  /** Icon after the label (e.g. chevron on "Show more"). */
  iconEnd?: LucideIcon;
  className?: string;
}

/** Pill button: primary (black, inverted in dark), secondary (glass with stroke), ghost. */
export function Button({
  label,
  variant = 'primary',
  size = 'default',
  icon,
  iconEnd,
  leading,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const v = variants[variant];
  const small = size === 'small';
  const large = size === 'large';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={small ? 4 : undefined}
      className={cx(
        'flex-row items-center justify-center rounded-pill border',
        large ? 'h-14 gap-3' : 'gap-2',
        small ? 'h-9 px-3.5' : !large && 'h-11',
        !small && (variant === 'ghost' ? 'px-3.5' : 'px-5'),
        v.box,
        disabled ? 'opacity-[.45] web:cursor-not-allowed' : 'web:cursor-pointer',
        className,
      )}
      {...rest}
    >
      {leading ?? (icon && <Icon icon={icon} size={16} tone={v.tone} />)}
      <Text
        variant={small ? 'label-sm' : large ? 'label-lg' : 'label'}
        tone={v.tone}
        numberOfLines={1}
      >
        {label}
      </Text>
      {iconEnd && <Icon icon={iconEnd} size={16} tone={v.tone} />}
    </Pressable>
  );
}
