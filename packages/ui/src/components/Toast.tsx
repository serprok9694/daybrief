import { Check, type LucideIcon } from 'lucide-react-native';
import { Platform, View } from 'react-native';
import { cx } from '../cx';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ToastProps {
  message: string;
  icon?: LucideIcon;
  className?: string;
}

/** Dark pill (light in the dark theme) confirming an action. Announced politely. */
export function Toast({ message, icon = Check, className }: ToastProps) {
  const theme = useTheme();
  return (
    <View
      role="status"
      accessibilityLiveRegion="polite"
      className={cx(
        'h-12 flex-row items-center gap-2.5 self-start rounded-pill bg-toast pl-3.5 pr-5',
        Platform.OS === 'web' && 'dbf-shadow-card',
        className,
      )}
      style={Platform.OS === 'web' ? undefined : { boxShadow: theme.vars['--shadow-card'] }}
    >
      <Icon icon={icon} size={20} tone="accent-solid" />
      <Text variant="label" tone="toast-ink">
        {message}
      </Text>
    </View>
  );
}
