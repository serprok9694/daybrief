import { Card, Icon, IconButton, Text, cx } from '@daybrief/ui';
import type { LucideIcon } from 'lucide-react-native';
import { RefreshCw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface WidgetProps {
  icon: LucideIcon;
  title: string;
  refreshLabel: string;
  /** Spins the refresh button. Refresh does nothing until widgets get data. */
  loading?: boolean;
  className?: string;
  children: ReactNode;
}

/** Widget card: icon in a circle, title, refresh button, then the body. */
export function Widget({
  icon,
  title,
  refreshLabel,
  loading = false,
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
        <Text role="heading" aria-level={2} variant="title" numberOfLines={1} className="flex-1">
          {title}
        </Text>
        <IconButton
          icon={RefreshCw}
          accessibilityLabel={refreshLabel}
          spinning={loading}
          disabled={loading}
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
