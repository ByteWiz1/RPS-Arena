// src/screens/SignupLinkScreen.tsx
//
// RPS Arena — link email + password to an anonymous account.
//
// Chat 9d:
//   - Username field with debounced availability check.
//   - Username is passed to supabase.auth.updateUser AND to
//     profiles.username via linkEmailPassword.
//   - After a successful link, the socket reconnects with a fresh
//     JWT and re-identifies.
//
// Chat 12a:
//   - After linkEmailPassword succeeds, writes profiles.email = the
//     new email and profiles.is_guest = false directly via the
//     Supabase client (RLS allows self-update of those fields).
//   - Can be rendered two ways: inside AppNavigator (Settings or
//     LoginScreen) or as a bare screen from Onboarding. Both call
//     bootstrapAuth() after the link.
//
// Chat 12b:
//   - Bug B fix: Onboarding is a route now, so back works. Removed
//     the `isReady()` guards on navigation.
//   - Bug C fix (part 1): username availability check is now
//     race-guarded. Each keystroke increments a ref counter; a
//     response is only applied if its request is still the latest.
//     Without this, a slow response for keystroke N-2 can overwrite
//     a fast response for keystroke N, showing the wrong status.
//   - Bug C fix (part 2): debounce reduced from 400ms to 300ms.
//   - Bug C fix (part 3): on timeout or transport failure, the
//     client-side helper resolves with `{ available: false,
//     uncertain: true, message: 'Couldn't check — try again' }`.
//     The screen now renders that as a neutral/amber hint, NOT a red
//     "taken" error, and does not block submit.
//   - Bug C fix (part 4): on submit, if the check is uncertain or
//     still in flight, we skip the client-side availability gate and
//     let the server's `changeUsername` path re-validate. The server
//     is authoritative.
//   - Back button uses canGoBack()/goBack() with a fallback.
//
// APK: platform-agnostic. No web-only APIs used.

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
import {
  linkEmailPassword,
  getAccessToken,
  supabase,
} from '../services/supabase';
import {
  checkUsernameAvailabilityOnServer,
  reconnectWithFreshJWT,
  identifyOnServer,
} from '../services/multiplayer';
import { useUserStore } from '../store/userStore';
import { showAlert } from '../utils/alert';

// Username check states.
type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'uncertain';

export default function SignupLinkScreen() {
  const navigation = useNavigation<any>();
  const { username: currentUsername, avatar, bootstrapAuth } = useUserStore();

  const [username, setUsername] = useState(currentUsername || '');
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameCheckState, setUsernameCheckState] =
    useState<CheckState>('idle');
  const [usernameHint, setUsernameHint] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Debounce timer for the availability check.
  const checkTimerRef = useRef<any>(null);
  // Race guard. Incremented on each request. A response is only
  // applied if its captured sequence equals the current value.
  const checkSeqRef = useRef<number>(0);
  // Last username we successfully checked (for cache skip).
  const lastCheckedRef = useRef<string>('');

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    setUsernameError(null);
    setUsernameHint(null);

    if (!trimmed) {
      setUsernameCheckState('idle');
      return;
    }
    if (trimmed.length < 3) {
      setUsernameError('Must be at least 3 characters');
      setUsernameCheckState('idle');
      return;
    }
    if (trimmed.length > 15) {
      setUsernameError('Must be 15 characters or less');
      setUsernameCheckState('idle');
      return;
    }
    if (!/^[a-z0-9_]+$/.test(trimmed)) {
      setUsernameError('Only letters, numbers, and underscores');
      setUsernameCheckState('idle');
      return;
    }

    // Skip if we already know this exact name is available.
    if (
      trimmed === lastCheckedRef.current &&
      usernameCheckState === 'available'
    ) {
      return;
    }

    // Debounce. Cancel any pending check.
    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    checkTimerRef.current = setTimeout(async () => {
      // Bump sequence so any in-flight response is ignored.
      const seq = ++checkSeqRef.current;
      setUsernameCheckState('checking');
      setUsernameHint(null);

      let result: { available: boolean; message?: string; uncertain?: boolean };
      try {
        result = await checkUsernameAvailabilityOnServer(trimmed);
      } catch (e: any) {
        // The helper should never throw, but be defensive.
        result = { available: false, uncertain: true, message: 'Check failed' };
      }

      // Only apply if we are still the latest request.
      if (seq !== checkSeqRef.current) return;

      if (result.uncertain) {
        // Timeout or transport failure. Neutral state — do NOT block
        // submit. The server re-validates on the actual link call.
        lastCheckedRef.current = '';
        setUsernameCheckState('uncertain');
        setUsernameHint(result.message || "Couldn't check — try again");
        setUsernameError(null);
        return;
      }

      if (result.available) {
        lastCheckedRef.current = trimmed;
        setUsernameCheckState('available');
        setUsernameHint(null);
        setUsernameError(null);
      } else {
        lastCheckedRef.current = '';
        setUsernameCheckState('taken');
        setUsernameHint(null);
        setUsernameError(result.message || 'That username is already taken');
      }
    }, 300);

    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const validate = (): string | null => {
    const trimmedEmail = email.trim();
    if (!username.trim()) return 'Pick a username';
    if (usernameError) return usernameError;
    // Block on 'checking' so we do not submit a name we have not
    // verified. But allow 'uncertain' — server is authoritative.
    if (usernameCheckState === 'checking') return 'Checking username…';
    if (usernameCheckState === 'taken') {
      return usernameError || 'That username is already taken';
    }
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
    const trimmedEmail = email.trim();

    const result = await linkEmailPassword(
      trimmedEmail,
      password,
      trimmedUsername,
      avatar || undefined
    );

    if (!result.success) {
      setLoading(false);
      setError(result.message || 'Could not link account');
      return;
    }

    // Chat 12a — mark the profile as a member.
    //
    // linkEmailPassword calls auth.updateUser, which does NOT touch
    // profiles.email or profiles.is_guest. We write those here.
    //
    // RLS: "profiles update own" allows self-update of email and
    // is_guest (only is_premium and premium_since are pinned by
    // WITH CHECK).
    //
    // Non-fatal on failure — but this is the primary path for
    // setting email/is_guest, so we log clearly.
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (uid) {
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            email: trimmedEmail,
            is_guest: false,
          })
          .eq('id', uid);
        if (profileErr) {
          console.log(
            '[SIGNUP] profiles.email/is_guest update failed:',
            profileErr.message
          );
        }
      } else {
        console.log(
          '[SIGNUP] no uid after linkEmailPassword — skipping profile mark'
        );
      }
    } catch (e: any) {
      console.log('[SIGNUP] profile mark exception:', e?.message || e);
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
    }

    // Refresh the store. bootstrapAuth reads the fresh session and
    // flips hasSession → true. The navigator key changes; AppNavigator
    // remounts on Home.
    try {
      await bootstrapAuth();
    } catch (e: any) {
      console.log('[SIGNUP] refresh after link failed:', e?.message);
    }

    setLoading(false);

    if (result.needsConfirmation) {
      showAlert(
        'Confirm your email',
        `We sent a confirmation link to ${trimmedEmail}. Click it to finish linking your account.`
      );
    } else {
      showAlert('Account linked', 'Your progress is now saved to this email.');
    }

    // No manual navigation. AppNavigator remounts on Home via the key.
    console.log('[SIGNUP] success — AppNavigator will remount on Home');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Onboarding');
    }
  };

  const usernameStatus = (() => {
    if (usernameCheckState === 'checking') {
      return <ActivityIndicator size="small" color="#5a5a7a" />;
    }
    if (usernameCheckState === 'available') {
      return <CheckCircle size={18} color="#4ade80" />;
    }
    if (usernameCheckState === 'taken') {
      return <XCircle size={18} color="#f87171" />;
    }
    // idle and uncertain show no icon.
    return null;
  })();

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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

          {!usernameError && usernameHint && (
            <Text style={styles.hintText}>{usernameHint}</Text>
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
              onSubmitEditing={handleLink}
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
  hintText: {
    color: '#facc15',
    fontSize: 12,
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