import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { cx } from '../cx';
import { Icon } from './Icon';
import { Text } from './Text';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export interface SegmentProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers (e.g. "Language"). */
  accessibilityLabel?: string;
  /** `glass`: on the bare scene (sign-in), with the sheet plate behind it. */
  glass?: boolean;
  className?: string;
}

/** Segmented control (`.seg`): pill group, the selected option is a primary pill. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  glass = false,
  className,
}: SegmentProps<T>) {
  return (
    <View
      role="group"
      aria-label={accessibilityLabel}
      className={cx(
        'flex-row gap-1 self-start rounded-pill p-1',
        glass ? 'dbf-glass border border-stroke bg-plate-sheet' : 'bg-fill',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const tone = active ? 'btn-p-ink' : 'ink-2';
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            aria-pressed={active}
            onPress={() => onChange(o.value)}
            className={cx(
              'h-9 flex-row items-center gap-1.5 rounded-pill px-4 web:cursor-pointer',
              active && 'bg-btn-p',
            )}
          >
            {o.icon && <Icon icon={o.icon} size={16} tone={tone} />}
            <Text variant="label" tone={tone}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
