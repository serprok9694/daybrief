import { Stack } from 'expo-router';

// Screens that need a session. The root layout guards this whole group, so new app
// screens (dashboard in T7, settings in T8) go here.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
