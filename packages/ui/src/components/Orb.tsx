import { Animated, Platform, View } from 'react-native';
import { cx } from '../cx';
import { useTheme } from '../theme/ThemeProvider';
import { motion, orbStops } from '../tokens';
import { useLoop } from './useLoop';

export interface OrbProps {
  size?: number;
  className?: string;
}

/** The AI orb: warm gradient that slowly breathes. Still under reduced motion. Decorative. */
export function Orb({ size = 32, className }: OrbProps) {
  const theme = useTheme();
  const { value } = useLoop(motion.orbBreathe, { yoyo: true });
  if (Platform.OS === 'web') {
    return (
      <View
        aria-hidden
        className={cx('dbf-orb rounded-pill', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  const [a, b, c] = orbStops;
  const accent = theme.vars['--accent'];
  return (
    <Animated.View
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundImage: `radial-gradient(circle at 30% 28%, ${a} 0%, ${b} 34%, ${accent} 66%, ${c} 100%)`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,.4), 0 4px 14px -4px ${accent}`,
        transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }],
      }}
    />
  );
}
