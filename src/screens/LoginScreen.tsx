// src/screens/LoginScreen.tsx
//
// RPS Arena — email OR username login.
//
// Chat 9: email + password login.
// Chat 12a: single "Email or username" field, resolve username → email.
// Chat 12b: back works, no manual nav on plain login.
// Chat 12b (fix): unconfirmed-email routing to VerifyEmail.
// Chat 12c: Onboarding gate reverted.
//   - Removed all isOnboarded / pendingConfirmation references.
//   - On success: just bootstrapAuth() + socket reconnect, then
//     navigation.goBack() to wherever we came from (Home banner,
//     Settings, AuthGate redirect). If nothing to go back to
//     (deep-link entry, no prior screen), fall back to reset to Home.
//   - Unconfirmed email: Supabase signs the user in anyway. We let
//     them in (Option A1). Email confirmation is a soft gate in
//     this chat — the confirm link still updates profiles via the
//     onAuthStateChange handler in App.tsx.
//   - Kept: returnTo routing for deep links (AuthGate + tournament).
//
// Reachable from:
//   - Home guest banner ("Sign In")
//   - SettingsScreen account section ("Sign In")
//   - App.tsx sessionReplaced handler (Option X)
//   - Deep-link routing when a guest opens a tournament link.
//   - AuthGate redirects from gated routes
//
// APK: platform-agnostic. No web-only APIs used.

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
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Mail, Lock } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import {
  signInWithEmail,
  getAccessToken,
} from '../services/supabase';
import {
  getSocket,
  disconnectFromServer,
  connectToServer,
  identifyOnServer,
  resolveEmailFromUsernameOnServer,
} from '../services/multiplayer';
import { useUserStore } from '../store/userStore';
import { navigationRef } from '../navigation/navigationRef';
import { showAlert } from '../utils/alert';

const INVALID_CREDENTIALS = 'Invalid credentials';

export default function LoginScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { bootstrapAuth } = useUserStore();

  // Chat 11 — return path for deep links and AuthGate redirects.
  const returnTo: string | undefined = route?.params?.returnTo;
  const returnParams: any = route?.params?.returnParams;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validate = (): string | null => {
    const trimmed = identifier.trim();
    if (!trimmed) return 'Enter your email or username';
    if (!password) return 'Enter your password';
    if (trimmed.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return 'Enter a valid email';
      }
    }
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

    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');

    // 1. Resolve email if the user typed a username.
    let emailToUse = trimmed;
    if (!isEmail) {
      const resolved = await resolveEmailFromUsernameOnServer(trimmed);
      if (!resolved.ok || !resolved.email) {
        setLoading(false);
        setError(INVALID_CREDENTIALS);
        return;
      }
      emailToUse = resolved.email;
    }

    // 2. Sign in with Supabase.
    const result = await signInWithEmail(emailToUse, password);
    if (!result.success) {
      setLoading(false);
      setError(INVALID_CREDENTIALS);
      return;
    }

    // 3. Reload the store from the fresh session.
    try {
      await bootstrapAuth();
    } catch (e: any) {
      console.log('[LOGIN] bootstrapAuth after login failed:', e?.message);
    }

    // 4. Reconnect socket + identify.
    try {
      disconnectFromServer();
      await connectToServer(getAccessToken);

      const fresh = useUserStore.getState();
      const freshUsername = fresh.username || undefined;
      const freshAvatar = fresh.avatar || undefined;

      const s = getSocket();
      if (s) {
        try {
          const reg = await identifyOnServer({
            username: freshUsername,
            avatar: freshAvatar,
          });
          useUserStore.getState().setFromIdentify({
            username: reg.username,
            avatar: reg.avatar,
            isPremium: reg.isPremium,
            premiumSince: reg.premiumSince || null,
            email: reg.email || null,
            isGuest: reg.isGuest,
          });
        } catch (e: any) {
          console.log('[LOGIN] identify after login failed:', e?.message);
        }
      }
    } catch (e: any) {
      console.log('[LOGIN] socket reconnect failed:', e?.message);
    }

    setLoading(false);

    // 5. Navigation.
    //
    // If returnTo was set (deep link / AuthGate), navigate there.
    // Otherwise goBack() to whatever opened this screen (Home banner,
    // Settings). If there is no history (deep-link entry), reset to
    // Home.
    if (returnTo) {
      console.log('[LOGIN] success — returning to', returnTo, returnParams);
      try {
        if (navigationRef.isReady()) {
          (navigationRef.navigate as any)(
            returnTo,
            returnParams || undefined
          );
        } else if (navigation?.isReady?.()) {
          (navigation.replace as any)(
            returnTo,
            returnParams || undefined
          );
        }
      } catch (e: any) {
        console.log('[LOGIN] returnTo navigation failed:', e?.message);
      }
      return;
    }

    if (navigation.canGoBack()) {
      console.log('[LOGIN] success — goBack');
      showAlert('Welcome back', 'You are signed in.');
      navigation.goBack();
      return;
    }

    console.log('[LOGIN] success — reset to Home');
    showAlert('Welcome back', 'You are signed in.');
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  };

  const goToSignup = () => {
    navigation.navigate('SignupLink');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  const showTournamentHint = returnTo === 'TournamentJoin';

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.subhead}>
            Sign in with your email or username.
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
              placeholder="Email or username"
              placeholderTextColor="#3a3a4a"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={identifier}
              onChangeText={(t) => {
                setIdentifier(t);
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
              onSubmitEditing={handleLogin}
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

          <Text style={styles.noAccountText}>Don't have an account?</Text>

          <TouchableOpacity
            style={[styles.secondary, styles.createAccountButton]}
            onPress={goToSignup}
            disabled={loading}
          >
            <Text style={styles.createAccountText}>Create Account</Text>
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

  noAccountText: {
    color: '#8a8a9a',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },

  secondary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  createAccountButton: {
    backgroundColor: 'rgba(79, 172, 254, 0.12)',
    borderColor: 'rgba(79, 172, 254, 0.4)',
  },
  createAccountText: {
    color: '#4facfe',
    fontSize: 15,
    fontWeight: '700',
  },
});
// src/screens/LoginScreen.tsx