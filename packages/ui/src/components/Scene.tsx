import { vars } from 'nativewind';
import { Platform, View, type ViewProps } from 'react-native';
import { cx } from '../cx';
import { sceneLayers, scenes, type SceneName } from '../tokens';
import { usePartOfDay } from './usePartOfDay';

export interface SceneProps extends ViewProps {
  /** A fixed scene; by default it follows the local time of day. */
  scene?: SceneName;
  className?: string;
}

/** Background scene by time of day. CSS gradient stand-ins until the photos are chosen. */
export function Scene({ scene, className, style, ...rest }: SceneProps) {
  const current = usePartOfDay();
  const name = scene ?? current;

  if (Platform.OS === 'web') {
    return (
      <View className={cx('dbf-scn', className)} style={[vars(scenes[name]), style]} {...rest} />
    );
  }
  return <View className={className} style={[sceneLayers(name), style]} {...rest} />;
}
