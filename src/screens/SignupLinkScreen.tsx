// src/screens/SignupLinkScreen.tsx
//
// RPS Arena — link email + password to an anonymous account.
//
// Chat 9d:  username field with debounced availability check.
// Chat 12a: writes profiles.email + profiles.is_guest after link.
// Chat 12b: back works; username check race-guarded; uncertain
//           timeout handling.
// Chat 12b (fix):
//   - After linkEmailPassword succeeds, inspects the session's
//     email_confirmed_at. If null (typical — a confirmation email
//     was just sent), sets pendingConfirmation(email). The navigator
//     key flips to 'verify'; AppNavigator remounts on VerifyEmail.
//     Does NOT set isOnboarded.
//   - If already confirmed (rare — Supabase's email confirmation may
//     be disabled in the project), sets isOnboarded(true). The
//     navigator remounts on Home.
//   - Two entry paths now branch explicitly:
//       * From Onboarding → Sign Up (isOnboarded === false):
//           needsConfirmation → setPendingConfirmation; remount on
//                                VerifyEmail.
//           no confirmation   → setOnboarded(true); remount on Home.
//       * From Settings → Save Progress (isOnboarded === true):
//           needsConfirmation → setPendingConfirmation + alert +
//                                navigation.goBack().
//           no confirmation   → alert + navigation.goBack().
//     The SignupLinkScreen is reached from both paths; branching at
//     success lets the navigator handle the onboarding path and
//     goBack handle the Settings path.
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
  // Race guard. Incremented on each request.
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

    if (
      trimmed === lastCheckedRef.current &&
      usernameCheckState === 'available'
    ) {
      return;
    }

    if (checkTimerRef.current) clearTimeout(checkTimerRef.current);

    checkTimerRef.current = setTimeout(async () => {
      const seq = ++checkSeqRef.current;
      setUsernameCheckState('checking');
      setUsernameHint(null);

      let result: { available: boolean; message?: string; uncertain?: boolean };
      try {
        result = await checkUsernameAvailabilityOnServer(trimmed);
      } catch (e: any) {
        result = { available: false, uncertain: true, message: 'Check failed' };
      }

      if (seq !== checkSeqRef.current) return;

      if (result.uncertain) {
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

    // Capture whether the user was already onboarded BEFORE any
    // session/profile changes happen. This tells us which entry
    // path we came in on:
    //   wasOnboarded === false → Onboarding → Sign Up
    //   wasOnboarded === true  → Settings → Save Progress
    const wasOnboarded = useUserStore.getState().isOnboarded;

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

    // Mark the profile as a member. linkEmailPassword's updateUser
    // does NOT touch profiles.email or profiles.is_guest.
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
      }
    } catch (e: any) {
      console.log('[SIGNUP] profile mark exception:', e?.message || e);
    }

    // Reconnect the socket with the fresh (now-linked) JWT.
    try {
      await reconnectWithFreshJWT(getAccessToken);
      await identifyOnServer({
        username: trimmedUsername,
        avatar: avatar || undefined,
      });
    } catch (e: any) {
      console.log('[SIGNUP] reconnect/identify failed:', e?.message);
    }

    // Determine confirmation state.
    let isConfirmed = false;
    let confirmedEmail: string | null = trimmedEmail;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const u = sessionData?.session?.user;
      confirmedEmail = u?.email || trimmedEmail;
      isConfirmed = !!u?.email_confirmed_at;
    } catch (e: any) {
      console.log('[SIGNUP] session inspect failed:', e?.message);
    }

    // Refresh the store from the current session so username/email
    // are populated for any subsequent screen. Do NOT let this flip
    // isOnboarded for the signup path — see below.
    try {
      await bootstrapAuth();
    } catch (e: any) {
      console.log('[SIGNUP] bootstrapAuth after link failed:', e?.message);
    }

    // ── Branch by entry path + confirmation state ──
    //
    // The unconfirmed case is the common one (Supabase sends a
    // confirmation email). The confirmed case only happens if the
    // Supabase project has email confirmation disabled, or if the
    // user was already confirmed by some other route.
    //
    // bootstrapAuth may have set isOnboarded true (it treats an
    // unconfirmed session as isOnboarded false, so for the signup
    // path with unconfirmed email, isOnboarded stays false — good).
    // But to be safe, explicitly control the flags here.

    if (!isConfirmed) {
      // Record the pending confirmation.
      useUserStore.getState().setPendingConfirmation(confirmedEmail);
      // Ensure isOnboarded is false for the signup path (the
      // Settings path is already onboarded and we leave it alone).
      if (!wasOnboarded) {
        useUserStore.getState().setOnboarded(false);
      }

      if (wasOnboarded) {
        // Settings → Save Progress path. The user is already using
        // the app. Do not remount the navigator to VerifyEmail.
        // Just alert and go back.
        showAlert(
          'Confirm your email',
          `We sent a confirmation link to ${confirmedEmail}. Click it to finish linking your account.`
        );
        setLoading(false);
        try {
          navigation.goBack();
        } catch {}
        return;
      }

      // Signup path. The navigator key flips to 'verify'. The
      // remount handles navigation to VerifyEmail. No alert needed
      // — the VerifyEmail screen is the message.
      setLoading(false);
      console.log(
        '[SIGNUP] success — pending confirmation, VerifyEmail will render'
      );
      return;
    }

    // Confirmed email (rare).
    if (wasOnboarded) {
      // Settings path, already confirmed (Supabase confirmation off).
      showAlert('Account linked', 'Your progress is now saved to this email.');
      setLoading(false);
      try {
        navigation.goBack();
      } catch {}
      return;
    }

    // Signup path, already confirmed. Flip the gate. Navigator
    // remounts on Home.
    showAlert('Account linked', 'Your progress is now saved to this email.');
    useUserStore.getState().setPendingConfirmation(null);
    useUserStore.getState().setOnboarded(true);
    setLoading(false);
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
// src/screens/SignupLinkScreen.tsx