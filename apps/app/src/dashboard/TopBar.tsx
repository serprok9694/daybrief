import { useTranslation } from '@daybrief/i18n';
import { Avatar, Glass, Text } from '@daybrief/ui';
import { Link } from 'expo-router';
import { Pressable, View } from 'react-native';
import { CommandBar } from './CommandBar';

export interface TopBarProps {
  name: string;
  avatarUri?: string;
  /** Desktop: the command bar sits in the middle. Mobile: it is docked at the bottom instead. */
  wide: boolean;
}

/**
 * Glass pill on top of the dashboard: avatar and name (→ settings) | command bar | a slot on
 * the right kept for notifications, which v1 does not show.
 */
export function TopBar({ name, avatarUri, wide }: TopBarProps) {
  const { t } = useTranslation();
  return (
    <Glass
      kind="sheet"
      radius={999}
      role="banner"
      className="h-[60px] flex-row items-center gap-4 px-2 wide:h-16 wide:px-2.5"
    >
      <View className="min-w-0 flex-1 basis-0 flex-row">
        <Link href="/settings" asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('common.openSettings')}
            className="min-w-0 shrink flex-row items-center gap-3 rounded-pill web:cursor-pointer"
          >
            <Avatar name={name} uri={avatarUri} size={44} />
            <Text weight="bold" numberOfLines={1} className="shrink">
              {name}
            </Text>
          </Pressable>
        </Link>
      </View>
      {wide && (
        <>
          <View className="w-[560px] min-w-0 shrink">
            <CommandBar />
          </View>
          <View className="flex-1 basis-0" />
        </>
      )}
    </Glass>
  );
}
