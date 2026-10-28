import { getLanguage, useTranslation } from '@daybrief/i18n';
import { Glass, Scene, Sheet, Text, layout, usePartOfDay } from '@daybrief/ui';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { CommandBar } from '../../dashboard/CommandBar';
import {
  avatarUrl,
  displayName,
  firstName,
  formatToday,
  greetingKey,
  gridColumns,
  type GoogleMetadata,
} from '../../dashboard/format';
import { TopBar } from '../../dashboard/TopBar';
import {
  EventsWidget,
  IdeaWidget,
  MailWidget,
  SummaryWidget,
  TasksWidget,
} from '../../dashboard/widgets';
import { useMe } from '../../lib/useMe';

// Mobile dock: 60 tall, 12 above the bottom edge, 4 below the content.
const DOCK_HEIGHT = 60;
const DOCK_OFFSET = 12;

/** The dashboard, docs/design/source/Main.dc.html (desktop) and MobileLight.dc.html. */
export default function Dashboard() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const profile = useMe();
  const part = usePartOfDay();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width > layout.mobileBreakpoint;

  const metadata = session?.user.user_metadata as GoogleMetadata | undefined;
  const name = displayName(profile?.displayName, metadata, session?.user.email);
  // useTranslation re-renders on language change, so this follows the UI language.
  const today = formatToday(new Date(), getLanguage());
  const scene = profile && profile.scene !== 'auto' ? profile.scene : undefined;
  const dockSpace = DOCK_HEIGHT + DOCK_OFFSET + 4 + insets.bottom;

  return (
    <Scene scene={scene} className="flex-1">
      <ScrollView
        contentContainerClassName="grow flex-row px-3 wide:px-10"
        contentContainerStyle={{
          paddingTop: insets.top + (wide ? 24 : 12),
          paddingBottom: wide ? 24 + insets.bottom : dockSpace,
        }}
      >
        {/* Reserved column for a navigation rail (--rail-w); 0 in v1. */}
        <View style={{ width: layout.railWidth }} />
        <View className="min-w-0 flex-1 gap-3 wide:gap-6">
          <TopBar name={name} avatarUri={avatarUrl(metadata)} wide={wide} />
          <Sheet role="main" className="gap-3.5 p-4 wide:gap-6 wide:p-11">
            <View>
              <Text role="heading" aria-level={1} variant="greeting">
                {t(greetingKey(part), { name: firstName(name) })}
              </Text>
              <Text
                tone="ink-2"
                className="mt-1.5"
                style={{ fontSize: wide ? 16 : 15, lineHeight: 24 }}
              >
                {today}
              </Text>
            </View>
            <SummaryWidget />
            <WidgetGrid gap={wide ? 20 : 14}>
              <EventsWidget className="flex-1" />
              <TasksWidget className="flex-1" />
              <MailWidget className="flex-1" />
            </WidgetGrid>
            <IdeaWidget />
          </Sheet>
        </View>
      </ScrollView>
      {!wide && (
        <Glass
          kind="sheet"
          radius={999}
          className="absolute left-3 right-3 flex-row items-center pl-2.5 pr-3.5"
          style={{ height: DOCK_HEIGHT, bottom: DOCK_OFFSET + insets.bottom }}
        >
          <CommandBar docked />
        </Glass>
      )}
      <StatusBar style="auto" />
    </Scene>
  );
}

/** `repeat(auto-fit, minmax(min(340px, 100%), 1fr))`, with cards of one row at equal height. */
function WidgetGrid({ gap, children }: { gap: number; children: ReactNode[] }) {
  const [width, setWidth] = useState(0);
  const { itemWidth } = gridColumns(width, layout.gridMinColumn, gap);
  return (
    <View
      className="flex-row flex-wrap"
      style={{ gap }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {children.map((child, i) => (
        // Floored so sub-pixel widths never push the last card to the next row.
        <View key={i} className="flex-row" style={{ width: Math.floor(itemWidth) || '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}
