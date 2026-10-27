import { vars } from 'nativewind';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Platform, View, useColorScheme, type StyleProp, type ViewStyle } from 'react-native';
import { themeVars, type ThemeName, type ThemeVars } from '../tokens';
import { resolveTheme, type ThemePreference } from './resolve';

export interface Theme {
  name: ThemeName;
  /** Weaker blur and denser plates (Android / low power). */
  lite: boolean;
  /** Resolved token values, for props that cannot take a CSS variable (icon colors, native shadows). */
  vars: ThemeVars;
}

const ThemeContext = createContext<Theme>({
  name: 'light',
  lite: false,
  vars: themeVars('light'),
});

export const useTheme = () => useContext(ThemeContext);

/** Resolved color of a token, e.g. `useToken('ink-2')`. */
export function useToken(token: TokenName): string {
  return useTheme().vars[`--${token}`];
}

export type TokenName = keyof ThemeVars extends `--${infer Name}` ? Name : never;

export interface ThemeProviderProps {
  /** Defaults to `auto`: follows the OS scheme. */
  preference?: ThemePreference;
  /** Defaults to on for Android. */
  lite?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Theme root: sets the token variables with NativeWind `vars()` on a View, so every
 * `bg-*` / `text-*` class below it resolves to this theme. Can be nested to render a
 * subtree in the other theme (the dev showcase does that).
 */
export function ThemeProvider({
  preference = 'auto',
  lite = Platform.OS === 'android',
  className,
  style,
  children,
}: ThemeProviderProps) {
  const system = useColorScheme();
  const name = resolveTheme(preference, system);
  const theme = useMemo<Theme>(() => ({ name, lite, vars: themeVars(name, lite) }), [name, lite]);
  const cssVars = useMemo(() => vars(theme.vars), [theme]);

  return (
    <ThemeContext.Provider value={theme}>
      <View className={className ? `dbf-root ${className}` : 'dbf-root'} style={[cssVars, style]}>
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
