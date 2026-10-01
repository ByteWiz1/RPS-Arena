// src/screens/LoginScreen.tsx
//
// RPS Arena — email + password login (Chat 9, new).
//
// Used to sign into an existing account from a new device.
// On success:
//   1. signInWithEmail() — establishes the Supabase session.
//   2. userStore.bootstrapAuth() — reloads profile + store.
//   3. Reconnect socket with the fresh JWT (disconnect + reconnect).
//   4. Navigate to returnTo (if provided) or Home.
//
// Reachable from:
//   - SettingsScreen "Sign in" (anonymous users)
//   - App.tsx sessionReplaced handler (Option X)
//   - Home guest banner
//   - Deep-link routing when a guest opens a tournament link:
//     params.returnTo = 'TournamentJoin', params.returnParams = { code }
//   - AuthGate redirects from gated routes
//
// APK: platform-agnostic. No web-only APIs used here.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Mail, Lock } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { signInWithEmail } from '../services/supabase';
import { useUserStore } from '../store/userStore';
import { getSocket, disconnectFromServer, connectToServer, identifyOnServer } from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';
import { showAlert } from '../utils/alert';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { bootstrapAuth } = useUserStore();

  // Chat 11 — return path.
  // { returnTo: 'TournamentJoin', returnParams: { code: 'ABCDEF' } }
  const returnTo: string | undefined = route.params?.returnTo;
  const returnParams: any = route.params?.returnParams;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    const trimmed = email.trim();
    if (!trimmed) return 'Enter your email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email';
    if (!password) return 'Enter your password';
    return null;
  };

  const handleLogin = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await signInWithEmail(email.trim(), password);
    if (!result.success) {
      setLoading(false);
      setError(result.message || 'Login failed');
      return;
    }

    // Reload userStore (profile, premium, identity cache).
    try {
      await bootstrapAuth();
    } catch (e: any) {
      console.log('[LOGIN] bootstrapAuth after login failed:', e?.message);
    }

    // Reconnect socket so the new JWT is used.
    try {
      disconnectFromServer();
      await connectToServer(getAccessToken);

      // Read the FRESH identity from the store — bootstrapAuth just
      // updated it. The destructured values at render time are stale.
      const fresh = useUserStore.getState();
      const freshUsername = fresh.username || undefined;
      const freshAvatar = fresh.avatar || undefined;

      const s = getSocket();
      if (s) {
        try {
          await identifyOnServer({
            username: freshUsername,
            avatar: freshAvatar,
          });
        } catch (e: any) {
          console.log('[LOGIN] identify after login failed:', e?.message);
        }
      }
    } catch (e: any) {
      console.log('[LOGIN] socket reconnect failed:', e?.message);
    }

    setLoading(false);

    // Navigation: prefer returnTo, fall back to Home.
    if (returnTo) {
      console.log('[LOGIN] success — returning to', returnTo, returnParams);
      try {
        // Replace Login with the destination so back doesn't land
        // back here. The `as any` escape hatch matches App.tsx's
        // pattern while RootStackParamList is still narrow.
        (navigation.replace as any)(returnTo, returnParams || undefined);
        return;
      } catch (e: any) {
        console.log('[LOGIN] returnTo navigation failed:', e?.message);
      }
    }

    showAlert('Welcome back', 'You are signed in.');
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const goToSignup = () => {
    // Carry the same return path so the sign-up flow can also route
    // the new user back to wherever they were headed.
    if (returnTo) {
      (navigation.navigate as any)('SignupLink', {
        returnTo,
        returnParams,
      });
    } else {
      navigation.navigate('SignupLink');
    }
  };

  const showTournamentHint = returnTo === 'TournamentJoin';

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
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.subhead}>
            Sign in with the email you linked to your account.
          </Text>

          {showTournamentHint ? (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                🏆 Sign in to join the tournament.
              </Text>
            </View>
          ) : null}

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
              placeholder="Password"
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

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primary, loading && styles.primaryDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('ForgotPassword')}
            disabled={loading}
          >
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.secondary}
            onPress={goToSignup}
            disabled={loading}
          >
            <Text style={styles.secondaryText}>
              Create or link an account instead
            </Text>
          </TouchableOpacity>
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
    paddingTop: 32,
    paddingBottom: 40,
  },

  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 8,
  },
  subhead: {
    fontSize: 14,
    color: '#5a5a7a',
    marginBottom: 20,
    lineHeight: 20,
  },

  hintBox: {
    backgroundColor: 'rgba(250, 204, 21, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.28)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  hintText: {
    color: '#facc15',
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: '#e94560',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  linkRow: { alignItems: 'center', marginTop: 16 },
  link: { color: '#4facfe', fontSize: 14, fontWeight: '600' },

  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 28,
  },

  secondary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});