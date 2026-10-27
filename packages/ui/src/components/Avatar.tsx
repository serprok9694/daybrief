import { View } from 'react-native';
import { cx } from '../cx';
import { Text } from './Text';
import { avatarTone, initials, type AvatarTone } from './initials';

const tones: Record<AvatarTone, string> = {
  1: 'bg-av-1',
  2: 'bg-av-2',
  3: 'bg-av-3',
  4: 'bg-av-4',
};

export interface AvatarProps {
  name: string;
  /** 40 in lists, 44 for the signed-in user in the top bar. */
  size?: 40 | 44;
  /** Defaults to a stable tone derived from the name. */
  tone?: AvatarTone;
  /** Text shown instead of initials computed from `name`. */
  label?: string;
  className?: string;
}

/** Round avatar with initials on one of four warm tones. Decorative: the name is shown next to it. */
export function Avatar({ name, size = 40, tone, label, className }: AvatarProps) {
  return (
    <View
      aria-hidden
      className={cx(
        'items-center justify-center rounded-pill',
        size === 44 ? 'h-11 w-11' : 'h-10 w-10',
        tones[tone ?? avatarTone(name)],
        className,
      )}
    >
      <Text variant={size === 44 ? 'label-lg' : 'label'}>{label ?? initials(name)}</Text>
    </View>
  );
}
