import '../global.css';

import { I18nProvider } from '@daybrief/i18n';
import { fonts, ThemeProvider } from '@daybrief/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../auth/AuthProvider';

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  // Hold the first frame until Manrope is in, so text does not reflow from the fallback font.
  if (!loaded && !error) return null;

  return (
    <I18nProvider>
      <ThemeProvider className="flex-1">
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}

function RootStack() {
  const { session, loading } = useAuth();
  // Until the stored session is read, any guard would bounce a signed-in user to sign-in.
  if (loading) return null;
  const signedIn = session !== null;

  // Routes not listed here stay open: auth/callback (finishes sign-in) and dev/ui.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/sign-in">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
