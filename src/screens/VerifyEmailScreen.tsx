// src/screens/VerifyEmailScreen.tsx
//
// RPS Arena — "Check your inbox" (Chat 12b, new).
//
// Shown after signup when the user has a session but
// email_confirmed_at is null. Also shown after sign-in with an
// unconfirmed email, and on cold boot if the persisted session is
// unconfirmed.
//
// AppNavigator's key logic routes here whenever:
//   !isOnboarded && pendingConfirmation
//
// Actions:
//   - Resend confirmation email  → supabase.auth.updateUser({ email })
//     re-triggers the confirmation flow. Falls back to auth.resend
//     if updateUser fails.
//   - Back to Sign In             → navigation.navigate('Login').
//     Keeps pendingConfirmation set; the navigator key stays 'verify'
//     until either the user confirms (onAuthStateChange flips
//     isOnboarded) or signs in with a different account (which
//     overwrites the store).
//
// Auto-navigation: when the user clicks the confirmation link in
// their email, App.tsx's onAuthStateChange handler fires SIGNED_IN,
// flips isOnboarded true, and clears pendingConfirmation. The
// navigator remounts on Home. This screen does not need to poll or
// listen for anything — it just sits there until the remount.
//
// Native: the confirmation link is a web-only flow today (see TODO
// in supabase.ts). On native, this screen will show, but the
// "resend" action may not produce a deep link the app can open
// until the custom scheme is wired. The screen still renders and
// resends; the deep-link handling is deferred to the APK chat.
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
import { Mail, RefreshCw, ChevronLeft } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { supabase } from '../services/supabase';
import { useUserStore } from '../store/userStore';
import { showAlert } from '../utils/alert';

export default function VerifyEmailScreen() {
  const navigation = useNavigation<any>();
  const pendingEmail = useUserStore((s) => s.pendingEmail);
  const [resending, setResending] = useState(false);

  const handleResend = async () => {
    if (!pendingEmail) {
      showAlert(
        'No email on file',
        'Please go back and sign up again, or sign in to a confirmed account.'
      );
      return;
    }

    setResending(true);
    try {
      // updateUser with the same email re-triggers the confirmation
      // email. This matches the call used at signup (linkEmailPassword
      // → auth.updateUser), so the same confirmation flow runs.
      const { error: updateErr } = await supabase.auth.updateUser({
        email: pendingEmail,
      });

      if (updateErr) {
        // Fallback to resend API. This is designed for the signUp
        // flow but Supabase accepts it for any pending confirmation.
        try {
          const { error: resendErr } = await supabase.auth.resend({
            type: 'signup',
            email: pendingEmail,
          });
          if (resendErr) {
            console.log(
              '[VERIFY EMAIL] updateUser + resend both failed:',
              updateErr.message,
              '|',
              resendErr.message
            );
            setResending(false);
            showAlert(
              'Could not resend',
              resendErr.message || 'Please try again in a moment.'
            );
            return;
          }
        } catch (e: any) {
          console.log('[VERIFY EMAIL] resend exception:', e?.message);
          setResending(false);
          showAlert(
            'Could not resend',
            'Please try again in a moment.'
          );
          return;
        }
      }

      setResending(false);
      showAlert(
        'Email sent',
        `We sent a new confirmation link to ${pendingEmail}. Check your inbox (and spam).`
      );
    } catch (e: any) {
      console.log('[VERIFY EMAIL] resend error:', e?.message || e);
      setResending(false);
      showAlert('Could not resend', 'Please try again in a moment.');
    }
  };

  const handleBackToSignIn = () => {
    console.log('[VERIFY EMAIL] Back to Sign In');
    navigation.navigate('Login');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Login');
    }
  };

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

          <Text style={styles.subhead}>
            We sent a confirmation link to:
          </Text>

          <View style={styles.emailBox}>
            <Text style={styles.emailText} numberOfLines={1}>
              {pendingEmail || '(no email on file)'}
            </Text>
          </View>

          <Text style={styles.instructions}>
            Click the link in that email to finish setting up your
            account. Once confirmed, you'll be taken straight to the
            game.
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
              • Wait a minute, then try resending
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primary, resending && styles.primaryDisabled]}
            onPress={handleResend}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <RefreshCw size={18} color="#ffffff" />
                <Text style={styles.primaryText}>Resend confirmation</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={handleBackToSignIn}
            disabled={resending}
          >
            <Text style={styles.link}>Back to Sign In</Text>
          </TouchableOpacity>

          <Text style={styles.fine}>
            Already confirmed? Tap "Back to Sign In" and sign in with
            your email or username.
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
    paddingTop: 32,
    paddingBottom: 40,
  },

  iconWrap: {
    alignSelf: 'center',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(79, 172, 254, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(79, 172, 254, 0.3)',
  },

  headline: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },

  subhead: {
    fontSize: 14,
    color: '#8a8a9a',
    marginBottom: 12,
    textAlign: 'center',
  },

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
    marginBottom: 24,
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

  primary: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#4facfe',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  linkRow: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  link: { color: '#4facfe', fontSize: 14, fontWeight: '600' },

  fine: {
    fontSize: 12,
    color: '#3a3a4a',
    marginTop: 16,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
// src/screens/VerifyEmailScreen.tsx