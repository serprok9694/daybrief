import { I18nProvider } from '@daybrief/i18n';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <I18nProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </I18nProvider>
  );
}
