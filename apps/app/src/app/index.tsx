import { partOfDay } from '@daybrief/core';
import { setLanguage, supportedLanguages, useTranslation } from '@daybrief/i18n';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, View } from 'react-native';

// Placeholder screen for M0/T1: proves the app builds and consumes workspace packages.
// The real dashboard shell arrives in M0/T7.
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>daybrief</Text>
      <Text>{t(`settings.scenes.${partOfDay(new Date())}`)}</Text>
      {/* Temporary EN/RU switch to check language changes; the real one lands in Settings (M0/T8). */}
      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('settings.language')}
      >
        {supportedLanguages.map((lng) => {
          const selected = i18n.resolvedLanguage === lng;
          return (
            <Pressable
              key={lng}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => void setLanguage(lng)}
            >
              <Text style={selected ? styles.selected : undefined}>{lng.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 16 },
  selected: { fontWeight: '700', textDecorationLine: 'underline' },
});
