import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useReducedMotion } from '../theme/useReducedMotion';

/**
 * A native 0 → 1 loop (`yoyo` goes back to 0), for skeleton, orb and spin. Web runs the same
 * loops in CSS (ui.css), so this stays idle there. Stops under reduced motion.
 */
export function useLoop(duration: number, { yoyo = false, enabled = true } = {}) {
  const value = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const run = enabled && !reduced && Platform.OS !== 'web';

  useEffect(() => {
    if (!run) {
      value.setValue(0);
      return;
    }
    const easing = yoyo ? Easing.inOut(Easing.ease) : Easing.linear;
    const animation = Animated.loop(
      yoyo
        ? Animated.sequence([
            Animated.timing(value, {
              toValue: 1,
              duration: duration / 2,
              easing,
              useNativeDriver: true,
            }),
            Animated.timing(value, {
              toValue: 0,
              duration: duration / 2,
              easing,
              useNativeDriver: true,
            }),
          ])
        : Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
    );
    animation.start();
    return () => animation.stop();
  }, [run, value, duration, yoyo]);

  return { value, reduced };
}
