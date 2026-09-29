// src/components/PremiumGate.tsx
//
// RPS Arena — premium feature gate (Chat 9, new).
//
// Wrap any UI that should only be shown to premium users. When the
// user is not premium, renders a fallback with an upgrade CTA.
//
// Usage:
//   <PremiumGate>
//     <AdvancedAISettings />
//   </PremiumGate>
//
//   <PremiumGate fallback={<Text>Custom fallback</Text>}>
//     <AdvancedAISettings />
//   </PremiumGate>
//
// Sources of truth (checked in order):
//   1. userStore.isPremium — populated at boot from profiles.is_premium
//   2. (refresh) call refreshPremium() to re-read from server
//
// Premium is set SERVER-SIDE (future payment webhook → db.setPremium).
// The client can only READ the flag.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Crown } from 'lucide-react-native';
import { useUserStore } from '../store/userStore';

interface Props {
  children: React.ReactNode;
  // Optional custom fallback. If absent, a default upgrade card is shown.
  fallback?: React.ReactNode;
  // Optional: also gate by premium-but-also-requires-login (skip for now).
  silent?: boolean;
}

export default function PremiumGate({ children, fallback, silent }: Props) {
  const navigation = useNavigation<any>();
  const { isPremium, authReady } = useUserStore();

  // Before boot completes, render nothing — avoids a flash of the
  // upgrade prompt for a premium user on a slow connection.
  if (!authReady) return null;

  if (isPremium) return <>{children}</>;

  if (fallback !== undefined) return <>{fallback}</>;

  if (silent) return null;

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Crown size={22} color="#fbbf24" />
      </View>

      <Text style={styles.title}>Premium feature</Text>
      <Text style={styles.body}>
        Unlock this and more with a Premium subscription.
      </Text>

      <TouchableOpacity
        style={styles.cta}
        onPress={() => navigation.navigate('Premium')}
      >
        <Text style={styles.ctaText}>Upgrade</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(251, 191, 36, 0.06)',
    borderRadius: 14,
    padding: 20,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.25)',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  body: {
    color: '#7a7a9a',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  cta: {
    backgroundColor: '#fbbf24',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  ctaText: {
    color: '#0a0a0f',
    fontSize: 14,
    fontWeight: '800',
  },
});