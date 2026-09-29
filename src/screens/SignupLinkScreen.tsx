// src/screens/SignupLinkScreen.tsx
//
// RPS Arena — link email + password to an anonymous account.
//
// Chat 9d:
//   - Username field with debounced availability check.
//   - Username is passed to supabase.auth.updateUser AND to
//     profiles.username via linkEmailPassword.
//   - After a successful link, the socket reconnects with a fresh
//     JWT and re-identifies so the server sees the current auth
//     state (belt-and-braces after Supabase rotates the session).

import React, { useState, useEffect, useRef } from 'react';
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
import {
  ChevronLeft,
  Mail,
  Lock,
  User,
  ShieldCheck,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { linkEmailPassword, getAccessToken } from '../services/supabase';
import {
  checkUsernameAvailabilityOnServer,
  reconnectWithFreshJWT,
  identifyOnServer,
} from '../services/multiplayer';
import { useUserStore } from '../store/userStore';
import { showAlert } from '../utils/alert';

export default function SignupLinkScreen() {
  const navigation = useNavigation<any>();
  const { username: currentUsername, avatar, bootstrapAuth } = useUserStore();

  const [username, setUsername] = useState(currentUsername || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounced availability check.
  const checkTimerRef = useRef<any>(null);
  const lastCheckedRef = useRef<string>('');

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    setUsernameError(null);
    setUsernameAvailable(null);

    if (!trimmed) return;
    if (trimmed.length < 3) {
      setUsernameError('Must be at least 3 characters');
      return;
    }
    if (trimmed.length > 15) {
      setUsernameError('Must be 15 characters or less');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameError('Only letters, numbers, and underscores');
      return;
    }

    // Skip the check if it's the same as what we already checked
    // and it came back available.
    if (trimmed === lastCheckedRef.current && usernameAvailable) return;

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    checkTimerRef.current = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const res = await checkUsernameAvailabilityOnServer(trimmed);
        lastCheckedRef.current = trimmed;
        setUsernameAvailable(res.available);
        setUsernameChecking(false);
        if (!res.available) {
          setUsernameError(res.message || 'That username is already taken');
        } else {
          setUsernameError(null);
        }
      } catch (e: any) {
        setUsernameChecking(false);
        setUsernameAvailable(null);
        // Do not surface a hard error on transient check failure —
        // the server re-validates on submit anyway.
      }
    }, 400);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, [username, usernameAvailable]);

  const validate = (): string | null => {
    const trimmedEmail = email.trim();
    if (!username.trim()) return 'Pick a username';
    if (usernameError) return usernameError;
    if (usernameChecking) return 'Checking username…';
    if (!trimmedEmail) return 'Enter your email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail))
      return 'Enter a valid email';
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

    const trimmedUsername = username.trim().toLowerCase();

    const result = await linkEmailPassword(
      email.trim(),
      password,
      trimmedUsername,
      avatar || undefined
    );

    if (!result.success) {
      setLoading(false);
      setError(result.message || 'Could not link account');
      return;
    }

    // Reconnect the socket with the fresh (now-linked) JWT so the
    // server's view of our auth state matches Supabase's.
    try {
      await reconnectWithFreshJWT(getAccessToken);
      await identifyOnServer({
        username: trimmedUsername,
        avatar: avatar || undefined,
      });
    } catch (e: any) {
      console.log('[SIGNUP] reconnect/identify failed:', e?.message);
      // Non-fatal. The next page load will pick up the new session.
    }

    // Refresh the store so isAnonymous flips false and email is set.
    try {
      await bootstrapAuth();
    } catch (e: any) {
      console.log('[SIGNUP] refresh after link failed:', e?.message);
    }

    setLoading(false);

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

  const usernameStatus = (() => {
    if (usernameChecking) {
      return <ActivityIndicator size="small" color="#5a5a7a" />;
    }
    if (usernameAvailable === true && !usernameError) {
      return <CheckCircle size={18} color="#4ade80" />;
    }
    if (usernameAvailable === false) {
      return <XCircle size={18} color="#f87171" />;
    }
    return null;
  })();

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
            Pick a username and add an email + password. Everything stays
            exactly as it is — same stats, same avatars, same achievements.
            Sign in from any device with this email.
          </Text>

          <View style={styles.field}>
            <User size={18} color="#5a5a7a" style={styles.fieldIcon} />
            <TextInput
              style={styles.input}
              placeholder="Pick a username"
              placeholderTextColor="#3a3a4a"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={15}
              value={username}
              onChangeText={setUsername}
              editable={!loading}
            />
            {usernameStatus}
          </View>

          {usernameError && (
            <Text style={styles.error}>{usernameError}</Text>
          )}

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