import type { LucideIcon } from 'lucide-react-native';
import { Animated, Platform, Pressable, View, type PressableProps } from 'react-native';
import { cx } from '../cx';
import { motion } from '../tokens';
import { Icon } from './Icon';
import { useLoop } from './useLoop';

export interface IconButtonProps extends Omit<PressableProps, 'children'> {
  icon: LucideIcon;
  /** Required: the button has no visible text. */
  accessibilityLabel: string;
  /** Spins the icon (refresh while loading). Off under reduced motion. */
  spinning?: boolean;
  className?: string;
}

/** Round 36 px icon button with a 44 px hit target. */
export function IconButton({ icon, spinning = false, className, ...rest }: IconButtonProps) {
  const { value } = useLoop(motion.refreshSpin, { enabled: spinning });
  const rotate = value.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={4}
      className={cx(
        'h-9 w-9 items-center justify-center rounded-pill bg-fill hover:bg-fill-2 web:cursor-pointer',
        className,
      )}
      {...rest}
    >
      {Platform.OS === 'web' ? (
        <View className={spinning ? 'dbf-spin' : undefined}>
          <Icon icon={icon} size={16} tone="ink-2" />
        </View>
      ) : (
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Icon icon={icon} size={16} tone="ink-2" />
        </Animated.View>
      )}
    </Pressable>
  );
}
