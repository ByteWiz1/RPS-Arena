// src/components/GuestBanner.tsx
//
// RPS Arena — "Save your progress" banner (Chat 9, new).
//
// Shown on HomeScreen when the current user is anonymous.
// Tapping it navigates to SignupLinkScreen to link an email + password.
//
// Renders nothing when:
//   - The user has an email (already linked).
//   - The user is not yet loaded (authReady false).

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Cloud, ChevronRight } from 'lucide-react-native';
import { useUserStore } from '../store/userStore';

export default function GuestBanner() {
  const navigation = useNavigation<any>();
  const { isAnonymous, email, authReady } = useUserStore();

  // Hide if booted but linked, or if not booted yet.
  if (!authReady) return null;
  if (!isAnonymous && email) return null;

  return (
    <TouchableOpacity
      style={styles.banner}
      activeOpacity={0.75}
      onPress={() => navigation.navigate('SignupLink')}
    >
      <View style={styles.iconWrap}>
        <Cloud size={20} color="#4facfe" />
      </View>

      <View style={styles.textWrap}>
        <Text style={styles.title}>Save your progress</Text>
        <Text style={styles.subtitle}>
          Link an email to keep your stats forever
        </Text>
      </View>

      <ChevronRight size={20} color="#4facfe" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textWrap: { flex: 1 },
  title: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: '#7a7a9a',
    fontSize: 12,
  },
});