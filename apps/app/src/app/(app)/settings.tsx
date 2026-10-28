import { useTranslation } from '@daybrief/i18n';
import { Button, Scene, Sheet, Text } from '@daybrief/ui';
import { router } from 'expo-router';
import { ArrowLeft, LogOut } from 'lucide-react-native';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut } from '../../auth/google';

// Stub until the settings screen (M0/T8): keeps sign-out reachable from the avatar.
export default function Settings() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Scene className="flex-1">
      <ScrollView
        contentContainerClassName="grow px-3 wide:px-10"
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
      >
        <Sheet
          role="main"
          className="w-full max-w-[720px] items-start gap-3.5 self-center p-4 wide:gap-6 wide:p-11"
        >
          <Button
            variant="ghost"
            size="small"
            icon={ArrowLeft}
            label={t('settings.back')}
            onPress={back}
          />
          <Text role="heading" aria-level={1} variant="greeting">
            {t('settings.title')}
          </Text>
          {/* Signing out flips the root guard, which sends the user to /sign-in. */}
          <Button
            variant="secondary"
            icon={LogOut}
            label={t('common.signOut')}
            onPress={() => void signOut()}
          />
        </Sheet>
      </ScrollView>
    </Scene>
  );
}
