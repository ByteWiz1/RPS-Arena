// src/screens/SignupLinkScreen.tsx
//
// RPS Arena — link email + password to an anonymous account (Chat 9, new).
//
// Flow:
//   1. User is anonymous (Supabase auth.users has no email).
//   2. Fills email + password here.
//   3. linkEmailPassword() upgrades the SAME auth user — same UID,
//      same stats, same history, same achievements.
//   4. The handle_new_user trigger does NOT fire here (the user
//      already existed), so username/avatar are merged into
//      user_metadata and profiles is updated from the server side
//      on the next identify() if needed.
//   5. If email confirmation is enabled in Supabase, the upgrade
//      may not take effect until the user clicks the email link.
//      We surface that in the success message.
//
// Reachable from:
//   - HomeScreen "Save your progress" (guest banner tap)
//   - SettingsScreen Account section (anonymous users)

import React, { useState } from 'react';
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
import { ChevronLeft, Mail, Lock, ShieldCheck } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { linkEmailPassword } from '../services/supabase';
import { useUserStore } from '../store/userStore';
import { showAlert } from '../utils/alert';

export default function SignupLinkScreen() {
  const navigation = useNavigation<any>();
  const { username, avatar, updateUser } = useUserStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    const trimmed = email.trim();
    if (!trimmed) return 'Enter your email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email';
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (password !== confirm) return 'Passwords do not match';
    return null;
  };

  const handleLink = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await linkEmailPassword(
      email.trim(),
      password,
      username || undefined,
      avatar || undefined
    );

    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Could not link account');
      return;
    }

    // Refresh the identity cache so the store knows we're no longer
    // anonymous. We don't have the new email in the store yet —
    // bootstrapAuth() will pick it up on next App.tsx boot, but we
    // can proactively re-load the profile.
    try {
      await useUserStore.getState().bootstrapAuth();
    } catch (e: any) {
      console.log('[SIGNUP] refresh after link failed:', e?.message);
    }

    if (result.needsConfirmation) {
      showAlert(
        'Confirm your email',
        `We sent a confirmation link to ${email.trim()}. Click it to finish linking your account.`
      );
    } else {
      showAlert('Account linked', 'Your progress is now saved to this email.');
    }

    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Save Progress</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.iconWrap}>
            <ShieldCheck size={40} color="#4facfe" />
          </View>

          <Text style={styles.headline}>Save your progress</Text>
          <Text style={styles.subhead}>
            Add an email and password to your guest account. Everything stays
            exactly as it is — same stats, same history, same achievements.
            Sign in from any device with this email.
          </Text>

          <View style={styles.field}>
            <Mail size={18} color="#5a5a7a" style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#3a3a4a"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              editable={!loading}
            />
          </View>

          <View style={styles.field}>
            <Lock size={18} color="#5a5a7a" style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password (min 8 characters)"
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
              placeholder="Confirm password"
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
            onPress={handleLink}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryText}>Link Account</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.fine}>
            You can still play as a guest if you close this screen. Your
            progress stays on this device only.
          </Text>
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  backButton: { padding: 6 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  placeholder: { width: 36 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
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

  fine: {
    fontSize: 12,
    color: '#3a3a4a',
    marginTop: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
});