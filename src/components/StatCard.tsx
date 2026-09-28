import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  label: string;
  value: string | number;
  accent?: string;
}

export default function StatCard({
  label,
  value,
  accent = '#e94560',
}: StatCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: accent }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  value: {
    fontSize: 26,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    color: '#8a8a9a',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
});