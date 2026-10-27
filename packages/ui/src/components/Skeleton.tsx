import { Animated, Platform, View, type DimensionValue } from 'react-native';
import { cx } from '../cx';
import { motion } from '../tokens';
import { useTheme } from '../theme/ThemeProvider';
import { useLoop } from './useLoop';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: DimensionValue;
  /** Round placeholder (avatar, icon). */
  circle?: boolean;
  className?: string;
}

/**
 * Loading placeholder that repeats the content's shape. Web: shimmer `--sk-a → --sk-b`
 * (1.6 s); native: the same colors as a pulse. Static under reduced motion.
 */
export function Skeleton({ width, height = 14, circle = false, className }: SkeletonProps) {
  const theme = useTheme();
  const { value } = useLoop(motion.skeleton, { yoyo: true });
  // Animated components do not take className: web (CSS shimmer) renders a plain View,
  // native styles the Animated.View directly.
  if (Platform.OS === 'web') {
    return (
      <View
        aria-hidden
        className={cx('dbf-sk', circle ? 'rounded-pill' : 'rounded-lg', className)}
        style={{ width, height }}
      />
    );
  }
  return (
    <Animated.View
      aria-hidden
      style={{
        width,
        height,
        borderRadius: circle ? 999 : 8,
        backgroundColor: theme.vars['--sk-b'],
        opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
      }}
    />
  );
}
