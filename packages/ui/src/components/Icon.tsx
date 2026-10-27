import type { LucideIcon } from 'lucide-react-native';
import { useToken, type TokenName } from '../theme/ThemeProvider';

export interface IconProps {
  icon: LucideIcon;
  /** 13 in chips, 16 inline, 20 in buttons and widget headers, 28 in empty states. */
  size?: 13 | 16 | 20 | 28;
  tone?: TokenName;
}

const strokeFor = (size: number) => (size <= 13 ? 2 : size >= 28 ? 1.5 : 1.75);

/** Lucide icon at the design's sizes and stroke, colored by a theme token. Decorative. */
export function Icon({ icon: LucideComponent, size = 16, tone = 'ink-2' }: IconProps) {
  const color = useToken(tone);
  return (
    <LucideComponent
      size={size}
      color={color}
      strokeWidth={strokeFor(size)}
      // Only aria-hidden: react-native-svg forwards the RN accessibility props to the DOM on web.
      aria-hidden
    />
  );
}
