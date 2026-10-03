// src/screens/SignupLinkScreen.tsx
//
// RPS Arena — link email + password to an anonymous account.
//
// Chat 9d:  username field with debounced availability check.
// Chat 12a: writes profiles.email + profiles.is_guest after link.
// Chat 12b: back works; username check race-guarded; uncertain
//           timeout handling.
// Chat 12c: Onboarding gate reverted.
//   - Removed all isOnboarded / pendingConfirmation handling.
//   - After successful link:
//       * If email is already confirmed (rare, Supabase project has
//         confirmation off) → alert + goBack.
//       * If unconfirmed → set submitted=true. The screen switches
//         to an inline "Check your email" view. Same screen, no
//         navigation, no VerifyEmail route.
//   - After the user clicks the confirmation link, App.tsx's
//     onAuthStateChange handler runs bootstrapAuth(). The store
//     updates with the new username + is_guest=false. Nothing else
//     needs to happen — the user is already on Home or wherever
//     they were.
//   - Back: goBack() to whatever pushed this screen.
//
// Reachable from:
//   - Home guest banner ("Save Progress")
//   - SettingsScreen account section ("Save Progress")
//   - LoginScreen ("Create Account")
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
  CheckCircle2,
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

type CheckState = 'idle' | 'checking' | 'available' | 'taken' | 'uncertain';

export default function SignupLinkScreen() {
  const navigation = useNavigation<any>();
  const { username: currentUsername, avatar, bootstrapAuth } = useUserStore();

  // ── Form state ──
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

  // ── Post-submit state ──
  // When true, we render the "Check your email" view instead of the
  // form. Reset by going back.
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string>('');

  // ── Availability check plumbing ──
  const checkTimerRef = useRef<any>(null);
  const checkSeqRef = useRef<number>(0);
  const lastCheckedRef = useRef<string>('');

  useEffect(() => {
    // Skip the check when we are showing the post-submit view.
    if (submitted) return;

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
  }, [username, submitted]);

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
    // does NOT touch profiles.email or profiles.is_guest, because
    // the handle_new_user trigger only fires on auth.users INSERT,
    // not on UPDATE.
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

    // Refresh the store from the current session so username/email
    // are populated for any subsequent screen. If the email is
    // already confirmed, this flips isGuest to false via the profile.
    try {
      await bootstrapAuth();
    } catch (e: any) {
      console.log('[SIGNUP] bootstrapAuth after link failed:', e?.message);
    }

    setLoading(false);

    // Determine whether confirmation is pending.
    if (result.needsConfirmation) {
      // Switch to inline "Check your email" view.
      setSubmittedEmail(trimmedEmail);
      setSubmitted(true);
      return;
    }

    // Already confirmed. Alert + go back.
    showAlert('Account linked', 'Your progress is now saved to this email.');
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
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

  // ── Post-submit view: "Check your email" ──
  if (submitted) {
    return (
      <ScreenContainer>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <ChevronLeft size={26} color="#e94560" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Confirm Email</Text>
            <View style={styles.placeholder} />
          </View>

          <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
            <View style={styles.iconWrap}>
              <Mail size={44} color="#4facfe" />
            </View>

            <Text style={styles.headline}>Check your inbox</Text>

            <Text style={styles.subhead}>We sent a confirmation link to:</Text>

            <View style={styles.emailBox}>
              <Text style={styles.emailText} numberOfLines={1}>
                {submittedEmail}
              </Text>
            </View>

            <Text style={styles.instructions}>
              Click the link in that email to finish setting up your
              account. Everything you've earned as a guest stays with
              you — same stats, same avatars, same name.
            </Text>

            <View style={styles.tipsBox}>
              <Text style={styles.tipsTitle}>Didn't get it?</Text>
              <Text style={styles.tipsLine}>
                • Check your spam or promotions folder
              </Text>
              <Text style={styles.tipsLine}>
                • Make sure the address above is correct
              </Text>
              <Text style={styles.tipsLine}>
                • You can close this screen and keep playing
              </Text>
            </View>

            <View style={styles.doneBox}>
              <CheckCircle2 size={18} color="#4ade80" />
              <Text style={styles.doneText}>
                You're all set. Continue playing as a guest until you
                confirm.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.primary}
              onPress={handleBack}
            >
              <Text style={styles.primaryText}>Back</Text>
            </TouchableOpacity>
          </ScreenScroll>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

  // ── Form view ──
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

          {usernameError && <Text style={styles.error}>{usernameError}</Text>}

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

  // ── Post-submit "Check your email" styles ──
  emailBox: {
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.3)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  emailText: {
    color: '#4facfe',
    fontSize: 15,
    fontWeight: '700',
  },
  instructions: {
    fontSize: 14,
    color: '#5a5a7a',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  tipsBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    color: '#8a8a9a',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  tipsLine: {
    color: '#5a5a7a',
    fontSize: 13,
    lineHeight: 20,
  },
  doneBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(74, 222, 128, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.25)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  doneText: {
    flex: 1,
    color: '#4ade80',
    fontSize: 13,
    lineHeight: 18,
  },

  primary: {
    backgroundColor: '#4facfe',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
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