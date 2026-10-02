// src/screens/OnboardingScreen.tsx
//
// RPS Arena — first-open gate.
//
// Chat 12a: rendered OUTSIDE the navigator by App.tsx's render-swap.
// Chat 12b: registered as a route, but the navigator key was derived
//           from `hasSession` — which flipped mid-flow on Sign Up /
//           Guest (silent session creation). That was the bug.
// Chat 12b (fix): the navigator key is now derived from
//           `isOnboarded`. This screen explicitly sets `isOnboarded`
//           on the Guest path so the navigator swaps to Home. The
//           Sign In and Sign Up paths do NOT set it here — Sign In
//           sets it from LoginScreen on success, Sign Up sets
//           `pendingConfirmation` from SignupLinkScreen and lets
//           VerifyEmail flip it when the email is confirmed.
//
// Reachability:
//   - Initial route when `isOnboarded` is false and no confirmation
//     is pending.
//   - After sessionReplaced / signOut, resetUser clears
//     `isOnboarded` and the navigator remounts here.
//
// APK: platform-agnostic. No web-only APIs used.

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LogIn, UserPlus, Play, Swords } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { signInAnonymously } from '../services/supabase';
import { useUserStore } from '../store/userStore';
import { showAlert } from '../utils/alert';

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();
  const { bootstrapAuth } = useUserStore();
  const [busy, setBusy] = useState<'signup' | 'guest' | null>(null);

  // startAnonymous
  //
  // Always creates the Supabase anonymous session.
  //
  // For 'guest'   → also calls bootstrapAuth() so the store sees
  //                 the session immediately, then explicitly sets
  //                 isOnboarded(true). The navigator key flips from
  //                 'onboarding' to 'app'; AppNavigator remounts on
  //                 Home.
  //
  // For 'signup'  → deliberately does NOT call bootstrapAuth() and
  //                 does NOT set isOnboarded. The navigator key
  //                 stays 'onboarding'. We navigate to SignupLink,
  //                 which will set pendingConfirmation after the
  //                 email is linked. Only when the user clicks the
  //                 confirmation email does onAuthStateChange flip
  //                 isOnboarded (from App.tsx).
  //
  //                 If bootstrapAuth ran here, it would see the
  //                 anonymous session and (correctly, for the guest
  //                 case) set isOnboarded true — which would land
  //                 the user on Home as a guest instead of on
  //                 SignupLink. Preserved from Chat 12a Fix B.
  const startAnonymous = async (
    kind: 'signup' | 'guest'
  ): Promise<boolean> => {
    setBusy(kind);
    try {
      const result = await signInAnonymously();
      if (!result.success || !result.session) {
        setBusy(null);
        showAlert(
          'Could not start',
          result.message || 'Please check your connection and try again.'
        );
        return false;
      }

      if (kind === 'guest') {
        try {
          await bootstrapAuth();
        } catch (e: any) {
          console.log(
            '[ONBOARDING] bootstrapAuth after anon (guest) failed:',
            e?.message
          );
        }
        // Explicit flip. bootstrapAuth's computeOnboarded already
        // sets isOnboarded true for an anonymous session, but
        // calling this here makes the intent obvious and covers any
        // edge where bootstrapAuth partially failed.
        try {
          useUserStore.getState().setOnboarded(true);
        } catch (e: any) {
          console.log('[ONBOARDING] setOnboarded(true) failed:', e?.message);
        }
      }
      // For 'signup': skip bootstrapAuth and skip setOnboarded.

      return true;
    } catch (e: any) {
      setBusy(null);
      console.log('[ONBOARDING] startAnonymous error:', e?.message || e);
      showAlert('Could not start', 'Something went wrong. Please try again.');
      return false;
    }
  };

  const handleSignIn = () => {
    console.log('[ONBOARDING] Sign In → Login');
    navigation.navigate('Login');
  };

  const handleSignUp = async () => {
    const ok = await startAnonymous('signup');
    setBusy(null);
    if (ok) {
      console.log('[ONBOARDING] Sign Up → SignupLink (session created)');
      navigation.navigate('SignupLink');
    }
  };

  const handleGuest = async () => {
    const ok = await startAnonymous('guest');
    setBusy(null);
    if (ok) {
      // Session created and isOnboarded flipped. The navigator key
      // changes and AppNavigator remounts on Home. No explicit
      // navigation needed here.
      console.log('[ONBOARDING] Guest — session created, navigator will swap');
    }
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={0}>
          <View style={styles.heroWrap}>
            <View style={styles.heroIcon}>
              <Swords size={44} color="#e94560" />
            </View>
            <Text style={styles.title}>RPS Arena</Text>
            <Text style={styles.subtitle}>
              Rock. Paper. Scissors. Multiplayer, tournaments, and adaptive
              AI.
            </Text>
          </View>

          <View style={styles.buttons}>
            <OnboardingButton
              icon={<LogIn size={20} color="#ffffff" />}
              label="Sign In"
              subtext="Already have an account"
              onPress={handleSignIn}
              disabled={busy !== null}
              variant="primary"
            />

            <OnboardingButton
              icon={<UserPlus size={20} color="#ffffff" />}
              label="Sign Up"
              subtext="Create a new account"
              onPress={handleSignUp}
              disabled={busy !== null}
              loading={busy === 'signup'}
              variant="accent"
            />

            <OnboardingButton
              icon={<Play size={20} color="#ffffff" />}
              label="Continue as Guest"
              subtext="Play now, save progress later"
              onPress={handleGuest}
              disabled={busy !== null}
              loading={busy === 'guest'}
              variant="ghost"
            />
          </View>

          <Text style={styles.fine}>
            Guests can play AI modes, training, and local matches. Online
            play and tournaments need an account.
          </Text>
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

// ────────────────────────────────────────────────────────────
// Button component — local to this file.
// ────────────────────────────────────────────────────────────
function OnboardingButton({
  icon,
  label,
  subtext,
  onPress,
  disabled,
  loading,
  variant,
}: {
  icon: React.ReactNode;
  label: string;
  subtext: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant: 'primary' | 'accent' | 'ghost';
}) {
  const bg =
    variant === 'primary'
      ? '#e94560'
      : variant === 'accent'
      ? '#4facfe'
      : 'rgba(255,255,255,0.06)';

  const border =
    variant === 'ghost' ? 'rgba(255,255,255,0.14)' : 'transparent';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: border },
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
    >
      <View style={styles.buttonIcon}>{icon}</View>
      <View style={styles.buttonTextWrap}>
        <Text style={styles.buttonLabel}>{label}</Text>
        <Text style={styles.buttonSubtext}>{subtext}</Text>
      </View>
      {loading ? (
        <ActivityIndicator color="#ffffff" size="small" />
      ) : (
        <View style={styles.buttonRightSpacer} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
    flexGrow: 1,
  },

  heroWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 40,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(233, 69, 96, 0.3)',
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a8a9a',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  buttons: {
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 68,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
  },
  buttonTextWrap: {
    flex: 1,
  },
  buttonLabel: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  buttonRightSpacer: {
    width: 20,
  },

  fine: {
    fontSize: 12,
    color: '#3a3a4a',
    marginTop: 28,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
// src/screens/OnboardingScreen.tsx