// src/screens/ResetPasswordScreen.tsx
//
// RPS Arena — set a new password after recovery (Chat 9, new).
//
// Reached two ways:
//   1. Web: user clicks the reset email link. Supabase parses the
//      URL fragment, fires PASSWORD_RECOVERY, App.tsx navigates here.
//   2. (Future) Native: deep link with recovery token — not wired.
//
// The user must have a valid recovery session for this screen to work.
// If they navigate here without one (e.g. typed the route), we show
// an error and offer a link back to ForgotPasswordScreen.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Lock, ShieldCheck } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { completePasswordReset, onAuthStateChange, supabase } from '../services/supabase';
import { showAlert } from '../utils/alert';

export default function ResetPasswordScreen() {
  const navigation = useNavigation<any>();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(
    null
  );

  // Verify we have a recovery session. If not, show an error.
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setHasRecoverySession(!!data?.session);
    })();

    // Also subscribe — if the event fires after mount (shouldn't, but
    // possible on a slow boot), flip the flag.
    const sub = onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setHasRecoverySession(true);
      }
    });

    return () => {
      mounted = false;
      sub?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const validate = (): string | null => {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleSave = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await completePasswordReset(password);
    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Could not update password');
      return;
    }

    showAlert(
      'Password updated',
      'You can now sign in with your new password.'
    );
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  // ─── No recovery session ───
  if (hasRecoverySession === false) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
            <Text style={styles.headline}>Link expired</Text>
            <Text style={styles.subhead}>
              This password reset link is no longer valid. Request a new one
              to continue.
            </Text>

            <TouchableOpacity
              style={styles.primary}
              onPress={() => navigation.replace('ForgotPassword')}
            >
              <Text style={styles.primaryText}>Request New Link</Text>
            </TouchableOpacity>
          </ScreenScroll>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  if (hasRecoverySession === null) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#e94560" />
          </View>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={40} color="#4facfe" />
          </View>

          <Text style={styles.headline}>Set a new password</Text>
          <Text style={styles.subhead}>
            Choose a strong password you haven't used before.
          </Text>

          <View style={styles.field}>
            <Lock size={18} color="#5a5a7a" style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="New password (min 8 characters)"
              placeholderTextColor="#3a3a4a"
              secureTextEntry
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Lock size={18} color="#5a5a7a" style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Confirm new password"
              placeholderTextColor="#3a3a4a"
              secureTextEntry
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                if (error) setError(null);
              }}
              editable={!loading}
            />
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primary, loading && styles.primaryDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryText}>Update Password</Text>
            )}
          </TouchableOpacity>
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },

  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrap: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
  },

  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subhead: {
    fontSize: 14,
    color: '#5a5a7a',
    marginBottom: 28,
    lineHeight: 20,
    textAlign: 'center',
  },

  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fieldIcon: { marginRight: 10 },
  input: {
    flex: 1,
    paddingVertical: 14,
    color: '#ffffff',
    fontSize: 15,
  },

  error: {
    color: '#f87171',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
  },

  primary: {
    backgroundColor: '#4facfe',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});