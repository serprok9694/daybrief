import type { ProfilePatch, ThemePreference } from '@daybrief/core';
import { getLanguage, useTranslation, type Language } from '@daybrief/i18n';
import { Button, Glass, Icon, Scene, Segment, Sheet, Text, Toast, layout } from '@daybrief/ui';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle, ArrowLeft, Globe, ImageIcon, LogOut, SunMoon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../auth/AuthProvider';
import { signOut } from '../../auth/google';
import { CardGrid } from '../../dashboard/CardGrid';
import { displayName, type GoogleMetadata } from '../../dashboard/format';
import { useProfile } from '../../lib/profile';
import { Accounts } from '../../settings/Accounts';
import { ScenePicker } from '../../settings/ScenePicker';
import { SettingsCard } from '../../settings/SettingsCard';

// Settings cards: minmax(min(560px, 100%), 1fr).
const MIN_COLUMN = 560;
const TOAST_MS = 4000;

const languages: readonly { value: Language; label: string }[] = [
  // Each language is named in itself, so it reads the same in either UI language.
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
];

/**
 * Settings, docs/design/source/Settings.dc.html: language, theme, background, connected
 * accounts and sign-out. Every choice applies at once and is saved to the profile.
 * API tokens are hidden until M2.
 */
export default function Settings() {
  const { t } = useTranslation();
  const { session } = useAuth();
  const { profile, update } = useProfile();
  const insets = useSafeAreaInsets();
  const wide = useWindowDimensions().width > layout.mobileBreakpoint;
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    if (!saveFailed) return;
    const timer = setTimeout(() => setSaveFailed(false), TOAST_MS);
    return () => clearTimeout(timer);
  }, [saveFailed]);

  const change = (patch: ProfilePatch) => {
    setSaveFailed(false);
    // The store rolls the choice back on failure; the toast says why it jumped back.
    update(patch).catch(() => setSaveFailed(true));
  };

  const metadata = session?.user.user_metadata as GoogleMetadata | undefined;
  const name = displayName(profile?.displayName, metadata, session?.user.email);
  const scene = profile && profile.scene !== 'auto' ? profile.scene : undefined;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const themes: readonly { value: ThemePreference; label: string }[] = [
    { value: 'auto', label: t('settings.theme.auto') },
    { value: 'light', label: t('settings.theme.light') },
    { value: 'dark', label: t('settings.theme.dark') },
  ];

  return (
    <Scene scene={scene} className="flex-1">
      <ScrollView
        contentContainerClassName="grow px-3 wide:px-10"
        contentContainerStyle={{
          paddingTop: insets.top + (wide ? 24 : 12),
          paddingBottom: insets.bottom + 24,
        }}
      >
        <View className="gap-3 wide:gap-6">
          <Glass
            kind="sheet"
            radius={999}
            role="banner"
            className="h-[60px] flex-row items-center gap-3 px-2 wide:h-16 wide:px-2.5"
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.back')}
              onPress={back}
              className="h-11 w-11 items-center justify-center rounded-pill bg-btn-s web:cursor-pointer"
            >
              <Icon icon={ArrowLeft} size={20} tone="btn-s-ink" />
            </Pressable>
            <Text weight="bold" numberOfLines={1} className="shrink">
              {name}
            </Text>
          </Glass>

          <Sheet role="main" className="gap-3.5 p-4 wide:gap-6 wide:p-11">
            <View>
              <Text role="heading" aria-level={1} variant="greeting">
                {t('settings.title')}
              </Text>
              <Text
                tone="ink-2"
                className="mt-1.5"
                style={{ fontSize: wide ? 16 : 15, lineHeight: 24 }}
              >
                {t('settings.subtitle')}
              </Text>
            </View>

            <CardGrid min={MIN_COLUMN} gap={wide ? 20 : 14}>
              <SettingsCard
                icon={Globe}
                title={t('settings.language')}
                hint={t('settings.languageHint')}
              >
                <Segment
                  accessibilityLabel={t('settings.language')}
                  options={languages}
                  value={profile?.locale ?? getLanguage()}
                  onChange={(locale) => change({ locale })}
                />
              </SettingsCard>
              <SettingsCard
                icon={SunMoon}
                title={t('settings.theme.title')}
                hint={t('settings.theme.hint')}
              >
                <Segment
                  accessibilityLabel={t('settings.theme.title')}
                  options={themes}
                  value={profile?.theme ?? 'auto'}
                  onChange={(theme) => change({ theme })}
                />
              </SettingsCard>
              <SettingsCard
                icon={ImageIcon}
                title={t('settings.background')}
                hint={t('settings.backgroundHint')}
              >
                <ScenePicker
                  value={profile?.scene ?? 'auto'}
                  onChange={(value) => change({ scene: value })}
                />
              </SettingsCard>
              <Accounts />
            </CardGrid>

            {/* Signing out flips the root guard, which sends the user to /sign-in. */}
            <Button
              variant="secondary"
              icon={LogOut}
              label={t('common.signOut')}
              onPress={() => void signOut()}
              className="self-start"
            />
          </Sheet>
        </View>
      </ScrollView>
      {saveFailed && (
        <View
          pointerEvents="box-none"
          className="absolute left-3 right-3 items-center"
          style={{ bottom: insets.bottom + 24 }}
        >
          <Toast icon={AlertCircle} message={t('settings.saveError')} />
        </View>
      )}
      <StatusBar style="auto" />
    </Scene>
  );
}
