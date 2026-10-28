import type { ScenePreference } from '@daybrief/core';
import { useTranslation } from '@daybrief/i18n';
import { Icon, Scene, Text, cx, type SceneName } from '@daybrief/ui';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { gridColumns } from '../dashboard/format';

const fixedScenes: readonly SceneName[] = ['morning', 'day', 'evening', 'night'];
const options: readonly ScenePreference[] = ['auto', ...fixedScenes];

// `.bgpick`: repeat(auto-fill, minmax(110px, 1fr)), gap 12.
const MIN_COLUMN = 110;
const GAP = 12;

export interface ScenePickerProps {
  value: ScenePreference;
  onChange: (value: ScenePreference) => void;
}

/** Background picker: Auto (all four scenes in a row) and each scene, with a preview. */
export function ScenePicker({ value, onChange }: ScenePickerProps) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const { itemWidth } = gridColumns(width, MIN_COLUMN, GAP);

  return (
    <View
      role="group"
      aria-label={t('settings.background')}
      className="flex-row flex-wrap"
      style={{ gap: GAP }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            aria-pressed={selected}
            onPress={() => onChange(option)}
            className={cx(
              'rounded-picker border-2 web:cursor-pointer',
              selected ? 'border-ink' : 'border-transparent',
            )}
            style={{ width: Math.floor(itemWidth) || '100%' }}
          >
            <View aria-hidden className="h-[72px] flex-row overflow-hidden rounded-row">
              {option === 'auto' ? (
                fixedScenes.map((s) => <Scene key={s} scene={s} className="flex-1" />)
              ) : (
                <Scene scene={option} className="flex-1" />
              )}
            </View>
            <View className="flex-row items-center gap-1.5 px-2.5 pb-1.5 pt-2">
              {selected && <Icon icon={Check} size={13} tone="ink" />}
              <Text variant="label-sm" numberOfLines={1} className="shrink">
                {t(`settings.scenes.${option}`)}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
