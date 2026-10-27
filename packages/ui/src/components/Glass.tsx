import { BlurView } from 'expo-blur';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { cx } from '../cx';
import { useTheme } from '../theme/ThemeProvider';
import { radius as radii } from '../tokens';

export interface GlassProps extends ViewProps {
  /** `sheet`: the big panel. `card`: widgets inside it. */
  kind: 'sheet' | 'card';
  /** Corner radius in px. Defaults to the kind's token: card 28, sheet 40 (32 on mobile). */
  radius?: number;
  className?: string;
}

const kinds = {
  sheet: {
    web: 'dbf-glass bg-plate-sheet border border-stroke',
    border: 'border border-stroke',
    plate: 'bg-plate-sheet',
    rounded: 'rounded-sheet-m wide:rounded-sheet',
    // Native screens are phone-sized, so the sheet uses the mobile radius there.
    nativeRadius: radii.sheetMobile,
  },
  card: {
    web: 'dbf-card bg-plate-card border border-stroke-card',
    border: 'border border-stroke-card',
    plate: 'bg-plate-card',
    rounded: 'rounded-card',
    nativeRadius: radii.card,
  },
} as const;

/**
 * visionOS-style glass. Web: `backdrop-filter` over the scene. Native: expo-blur under a
 * translucent plate with the same alpha; the theme's lite mode (Android) blurs less and
 * uses a denser plate.
 */
export function Glass({ kind, radius, className, style, children, ...rest }: GlassProps) {
  const theme = useTheme();
  const k = kinds[kind];

  if (Platform.OS === 'web') {
    return (
      <View
        className={cx(k.web, radius == null && k.rounded, className)}
        style={[radius != null && { borderRadius: radius }, style]}
        {...rest}
      >
        {children}
      </View>
    );
  }

  const r = radius ?? k.nativeRadius;
  const sheet = kind === 'sheet';
  const blurPx = Number.parseFloat(theme.vars[sheet ? '--blur' : '--blur-card']);
  const shadow = theme.vars[sheet ? '--shadow-sheet' : '--shadow-card'];
  return (
    <View
      className={cx(k.border, className)}
      style={[
        { borderRadius: r, boxShadow: `${shadow}, inset 0 1px 0 ${theme.vars['--hi']}` },
        style,
      ]}
      {...rest}
    >
      <View style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden' }]}>
        <BlurView
          intensity={Math.min(100, blurPx * 2)}
          tint={theme.name === 'dark' ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        <View className={k.plate} style={StyleSheet.absoluteFill} />
      </View>
      {children}
    </View>
  );
}
