import { useTranslation } from '@daybrief/i18n';
import { Orb, Text, cx, useToken } from '@daybrief/ui';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

export interface CommandBarProps {
  /** Inside the mobile dock: no plate or border of its own, fills the dock's height. */
  docked?: boolean;
}

/**
 * The command bar (orb + input). Idea capture is wired up in M2: until then the field takes
 * text but Enter saves nothing, and the text stays in the field.
 */
export function CommandBar({ docked = false }: CommandBarProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [focused, setFocused] = useState(false);
  const accent = useToken('accent');
  const placeholderColor = useToken('ink-3');

  return (
    <View
      className={cx(
        'min-w-0 flex-row items-center gap-3 rounded-pill',
        docked ? 'h-full flex-1' : 'h-12 border border-stroke-card bg-fill pl-2 pr-4',
      )}
      style={focused ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}
    >
      <Orb />
      <TextInput
        accessibilityLabel={t('command.label')}
        placeholder={t('command.placeholder')}
        placeholderTextColor={placeholderColor}
        value={value}
        onChangeText={setValue}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        returnKeyType="done"
        submitBehavior="submit"
        className="h-full min-w-0 flex-1 font-medium text-body text-ink web:outline-none"
      />
      {!docked && (
        <View aria-hidden className="rounded-lg border border-line px-[7px] py-1">
          <Text variant="caption" tone="ink-3" className="leading-3">
            ↵
          </Text>
        </View>
      )}
    </View>
  );
}
