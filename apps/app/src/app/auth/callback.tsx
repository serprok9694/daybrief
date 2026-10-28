import { Scene, Sheet, Text } from '@daybrief/ui';
import { useTranslation } from '@daybrief/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { completeSignIn } from '../../auth/google';

/**
 * Web redirect target of Google sign-in: `/auth/callback?code=…` (PKCE). Native finishes the
 * flow inside signInWithGoogle(), so a deep link that lands here just goes home.
 */
export default function AuthCallback() {
  const { t } = useTranslation();
  const { code, error } = useLocalSearchParams<{ code?: string; error?: string }>();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/');
      return;
    }
    if (typeof code !== 'string') {
      // `access_denied` = the user cancelled on Google's screen: not an error worth showing.
      router.replace(
        error && error !== 'access_denied'
          ? { pathname: '/sign-in', params: { error: '1' } }
          : '/sign-in',
      );
      return;
    }
    completeSignIn(code).then(
      () => router.replace('/'),
      (e: unknown) => {
        // Only the message: never log the session or tokens.
        console.warn('Sign-in failed:', e instanceof Error ? e.message : e);
        router.replace({ pathname: '/sign-in', params: { error: '1' } });
      },
    );
  }, [code, error]);

  return (
    <Scene className="flex-1 items-center justify-center p-4">
      <Sheet className="px-8 py-6">
        <Text tone="ink-2" accessibilityLiveRegion="polite">
          {t('signIn.signingIn')}
        </Text>
      </Sheet>
    </Scene>
  );
}
