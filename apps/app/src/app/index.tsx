import { partOfDay } from '@daybrief/core';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

// Placeholder screen for M0/T1: proves the app builds and consumes workspace packages.
// The real dashboard shell arrives in M0/T7.
export default function Dashboard() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>daybrief</Text>
      <Text>{partOfDay(new Date())}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  title: { fontSize: 32, fontWeight: '700' },
});
