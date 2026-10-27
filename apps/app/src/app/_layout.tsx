import '../global.css';

import { fonts, ThemeProvider } from '@daybrief/ui';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

export default function RootLayout() {
  const [loaded, error] = useFonts(fonts);
  // Hold the first frame until Manrope is in, so text does not reflow from the fallback font.
  if (!loaded && !error) return null;

  return (
    <ThemeProvider className="flex-1">
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
}
