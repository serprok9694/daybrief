import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * True when the OS asks for reduced motion (iOS/Android Reduce Motion, web
 * `prefers-reduced-motion`). Loops (skeleton, orb, refresh spin) stop when it is on.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;
    const read = () =>
      AccessibilityInfo.isReduceMotionEnabled().then((value) => {
        if (active) setReduced(value);
      });
    void read();
    // On web the listener receives a media query event rather than a boolean, so re-read.
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', () => void read());
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);

  return reduced;
}
