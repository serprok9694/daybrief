import { ArrowUpRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { cx } from '../cx';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ListRowProps extends Omit<PressableProps, 'children'> {
  title: string;
  /** Second line (13/18, ink-2). */
  subtitle?: string;
  /** Lines the subtitle may take before it ellipsizes. */
  subtitleLines?: 1 | 2;
  /** Marker, avatar or time column on the left. */
  leading?: ReactNode;
  /** Text on the title line, right-aligned (e.g. a time). */
  meta?: string;
  /** Extra content under the text (chips). */
  children?: ReactNode;
  /**
   * When set, the row is a link to Google: shows `arrow-up-right` with this label,
   * e.g. "Open in Google Tasks".
   */
  openLabel?: string;
  /** Highlighted row (the next event): accent-soft background. */
  highlighted?: boolean;
  className?: string;
}

/** List row: radius 16, min height 44, `--fill` on hover. */
export function ListRow({
  title,
  subtitle,
  subtitleLines = 1,
  leading,
  meta,
  children,
  openLabel,
  highlighted = false,
  className,
  ...rest
}: ListRowProps) {
  return (
    <Pressable
      accessibilityRole={openLabel ? 'link' : 'button'}
      className={cx(
        'min-h-11 flex-row items-start gap-3 rounded-row px-3 py-2.5',
        highlighted ? 'bg-accent-soft' : 'hover:bg-fill',
        'web:cursor-pointer',
        className,
      )}
      {...rest}
    >
      {leading}
      <View className="min-w-0 flex-1">
        <View className="flex-row items-baseline gap-2">
          <Text variant="body" weight="bold" numberOfLines={1} className="min-w-0 flex-1">
            {title}
          </Text>
          {meta && (
            <Text variant="caption" weight="medium" tone="ink-3" numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>
        {subtitle && (
          <Text variant="secondary" tone="ink-2" numberOfLines={subtitleLines}>
            {subtitle}
          </Text>
        )}
        {children}
      </View>
      {openLabel && (
        <View className="mt-[3px]" accessibilityLabel={openLabel} accessible>
          <Icon icon={ArrowUpRight} tone="ink-3" />
        </View>
      )}
    </Pressable>
  );
}
