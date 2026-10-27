import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { cx } from '../cx';
import { Icon } from './Icon';
import { Text, type TextTone } from './Text';

export type ChipVariant = 'neutral' | 'accent' | 'solid';

const variants: Record<ChipVariant, { box: string; tone: TextTone }> = {
  neutral: { box: 'bg-fill-2', tone: 'ink-2' },
  accent: { box: 'bg-accent-soft', tone: 'accent-ink' },
  solid: { box: 'bg-accent-solid', tone: 'on-accent' },
};

export interface ChipProps {
  label: string;
  /** neutral (fill), accent soft ("Needs reply"), solid ("in 18 min"). */
  variant?: ChipVariant;
  /** State is never color only: overdue and needs-reply chips carry an icon. */
  icon?: LucideIcon;
  className?: string;
}

/** Status chip, height 24. */
export function Chip({ label, variant = 'neutral', icon, className }: ChipProps) {
  const v = variants[variant];
  return (
    <View
      className={cx(
        'h-6 flex-row items-center gap-[5px] self-start rounded-pill px-[9px]',
        v.box,
        className,
      )}
    >
      {icon && <Icon icon={icon} size={13} tone={v.tone} />}
      <Text variant="caption" tone={v.tone} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
