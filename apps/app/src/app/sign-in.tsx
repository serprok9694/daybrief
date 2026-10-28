import { setLanguage, supportedLanguages, useTranslation, type Language } from '@daybrief/i18n';
import {
  Button,
  GoogleMark,
  Icon,
  Orb,
  Scene,
  Segment,
  Sheet,
  Text,
  layout,
  type SegmentOption,
} from '@daybrief/ui';
import { useLocalSearchParams } from 'expo-router';
import { Check, Globe, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { signInWithGoogle } from '../auth/google';

/** Sign-in screen, docs/design/source/SignIn.dc.html. */
export default function SignIn() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ error?: string }>();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const wide = useWindowDimensions().width > layout.mobileBreakpoint;

  const language = (i18n.resolvedLanguage ?? 'en') as Language;
  const languages: SegmentOption<Language>[] = supportedLanguages.map((lng, i) => ({
    value: lng,
    label: lng.toUpperCase(),
    icon: i === 0 ? Globe : undefined,
  }));

  const onSignIn = async () => {
    setPending(true);
    setFailed(false);
    try {
      // Web navigates away on success; native resolves once the session is in.
      await signInWithGoogle();
    } catch (e) {
      console.warn('Sign-in failed:', e instanceof Error ? e.message : e);
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <Scene className="flex-1">
      <ScrollView contentContainerClassName="min-h-full px-4 py-4 wide:px-10 wide:py-6">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <Orb size={28} />
            <Text variant="title" style={{ fontSize: 20, lineHeight: 28 }}>
              {t('common.appName')}
            </Text>
          </View>
          <Segment
            glass
            accessibilityLabel={t('signIn.language')}
            options={languages}
            value={language}
            onChange={(lng) => void setLanguage(lng)}
          />
        </View>

        <View className="flex-1 items-center justify-center py-8">
          <Sheet
            role="main"
            className="w-full max-w-[520px] items-center gap-5 px-6 pb-8 pt-10 wide:px-12 wide:pb-10 wide:pt-[52px]"
          >
            <Orb size={64} />
            <Text
              role="heading"
              aria-level={1}
              variant="greeting"
              className="text-center"
              style={wide ? { fontSize: 36, lineHeight: 44 } : undefined}
            >
              {t('signIn.title')}
            </Text>
            <Text
              tone="ink-2"
              className="max-w-[380px] text-center"
              style={{ fontSize: 16, lineHeight: 25 }}
            >
              {t('signIn.body')}
            </Text>

            <Button
              size="large"
              className="mt-2 w-full"
              label={t('signIn.cta')}
              leading={<GoogleMark />}
              disabled={pending}
              onPress={() => void onSignIn()}
            />
            {(failed || params.error) && (
              <View role="alert" className="flex-row items-center gap-2">
                <Icon icon={TriangleAlert} size={16} tone="accent-ink" />
                <Text variant="secondary" tone="accent-ink">
                  {t('signIn.error')}
                </Text>
              </View>
            )}

            <View role="list" className="mt-2 w-full gap-3 border-t border-line pt-5">
              {t('signIn.points', { returnObjects: true }).map((point) => (
                <View key={point} role="listitem" className="flex-row items-start gap-3">
                  <View className="mt-0.5">
                    <Icon icon={Check} size={16} tone="ink" />
                  </View>
                  <Text tone="ink-2" className="flex-1" style={{ fontSize: 14, lineHeight: 20 }}>
                    {point}
                  </Text>
                </View>
              ))}
            </View>
          </Sheet>
        </View>
      </ScrollView>
    </Scene>
  );
}
