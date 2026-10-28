import { Card, Icon, Text, cx } from '@daybrief/ui';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export interface SettingsCardProps {
  icon: LucideIcon;
  title: string;
  /** Line under the title (`.li-s`). */
  hint?: string;
  className?: string;
  children: ReactNode;
}

/** A settings section: the widget card (`.card.w`) with icon, title and an optional hint. */
export function SettingsCard({ icon, title, hint, className, children }: SettingsCardProps) {
  return (
    <Card
      role="region"
      aria-label={title}
      className={cx('min-w-0 flex-1 gap-3.5 p-[18px] wide:p-[22px]', className)}
    >
      <View className="min-h-9 flex-row items-center gap-2.5">
        <View className="h-9 w-9 items-center justify-center rounded-pill bg-fill">
          <Icon icon={icon} size={20} />
        </View>
        <Text role="heading" aria-level={2} variant="title" numberOfLines={1} className="flex-1">
          {title}
        </Text>
      </View>
      {hint && (
        <Text variant="secondary" tone="ink-2">
          {hint}
        </Text>
      )}
      {children}
    </Card>
  );
}
