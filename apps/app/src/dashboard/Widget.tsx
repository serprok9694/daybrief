import { Card, Icon, IconButton, Text, cx } from '@daybrief/ui';
import type { LucideIcon } from 'lucide-react-native';
import { RefreshCw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface WidgetProps {
  icon: LucideIcon;
  title: string;
  refreshLabel: string;
  /** Spins and disables the refresh button. */
  loading?: boolean;
  /** Called by the refresh button; widgets without data yet leave it out. */
  onRefresh?: () => void;
  /** Small text before the refresh button, e.g. "Updated 2 min ago". */
  meta?: string;
  className?: string;
  children: ReactNode;
}

/** Widget card: icon in a circle, title, refresh button, then the body. */
export function Widget({
  icon,
  title,
  refreshLabel,
  loading = false,
  onRefresh,
  meta,
  className,
  children,
}: WidgetProps) {
  return (
    <Card
      role="region"
      aria-label={title}
      className={cx('min-w-0 gap-3.5 p-[18px] wide:p-[22px]', className)}
    >
      <View className="min-h-9 flex-row items-center gap-2.5">
        <View className="h-9 w-9 items-center justify-center rounded-pill bg-fill">
          <Icon icon={icon} size={20} />
        </View>
        {/* Mobile: the meta sits under the title. Desktop: inline, wrapping to two
            right-aligned lines in narrow cards so the title keeps its width. */}
        <View className="min-w-0 flex-1 wide:flex-row wide:items-center wide:gap-2.5">
          <Text
            role="heading"
            aria-level={2}
            variant="title"
            numberOfLines={1}
            className={meta ? 'wide:shrink-0' : undefined}
          >
            {title}
          </Text>
          {meta && (
            <Text
              variant="caption"
              weight="medium"
              tone="ink-3"
              numberOfLines={2}
              className="wide:min-w-0 wide:flex-1 wide:text-right"
            >
              {meta}
            </Text>
          )}
        </View>
        <IconButton
          icon={RefreshCw}
          accessibilityLabel={refreshLabel}
          spinning={loading}
          disabled={loading}
          onPress={onRefresh}
        />
      </View>
      {children}
    </Card>
  );
}

/** Container of a widget's loading skeleton, announced as busy with what is loading. */
export function Loading({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View aria-busy aria-label={label} className={className}>
      {children}
    </View>
  );
}

/** Empty and error states: an icon in a 52 circle, a title, an optional hint and action. */
export function EmptyState({
  icon,
  title,
  hint,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2.5 px-3 py-7">
      <View className="h-[52px] w-[52px] items-center justify-center rounded-pill bg-fill">
        <Icon icon={icon} size={28} />
      </View>
      <Text variant="body" weight="bold" className="text-center">
        {title}
      </Text>
      {hint && (
        <Text variant="secondary" tone="ink-2" className="max-w-[290px] text-center leading-[19px]">
          {hint}
        </Text>
      )}
      {children}
    </View>
  );
}
