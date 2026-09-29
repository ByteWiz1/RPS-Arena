// src/screens/ForgotPasswordScreen.tsx
//
// RPS Arena — password reset request (Chat 9, new).
//
// Sends a Supabase password-reset email. The user clicks the link,
// lands back on the web app with a #access_token=...&type=recovery
// fragment, Supabase fires PASSWORD_RECOVERY, App.tsx navigates to
// ResetPasswordScreen.
//
// Native deep-linking is NOT set up in this chat (requires app.json
// URL scheme config). On web, the reset link returns to whatever
// origin the request came from.

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
import { ChevronLeft, Mail, CheckCircle } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { sendPasswordReset } from '../services/supabase';

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<any>();

  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = (): string | null => {
    const trimmed = email.trim();
    if (!trimmed) return 'Enter your email';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return 'Enter a valid email';
    return null;
  };

  const handleSend = async () => {
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    const result = await sendPasswordReset(email.trim());
    setLoading(false);

    if (!result.success) {
      setError(result.message || 'Could not send reset email');
      return;
    }

    setSent(true);
  };

  if (sent) {
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
            <Text style={styles.headerTitle}>Check Your Email</Text>
            <View style={styles.placeholder} />
          </View>

          <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
            <View style={styles.iconWrap}>
              <CheckCircle size={40} color="#4ade80" />
            </View>

            <Text style={styles.headline}>Check your email</Text>
            <Text style={styles.subhead}>
              If an account exists for {email.trim()}, we sent a link to
              reset your password. The link expires in about an hour.
            </Text>

            <TouchableOpacity
              style={styles.secondary}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.secondaryText}>Back to sign in</Text>
            </TouchableOpacity>
          </ScreenScroll>
        </SafeAreaView>
      </ScreenContainer>
    );
  }

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
          <Text style={styles.headerTitle}>Reset Password</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <Text style={styles.headline}>Forgot password?</Text>
          <Text style={styles.subhead}>
            Enter the email you used to sign up. We'll send you a link to set
            a new password.
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

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.primary, loading && styles.primaryDisabled]}
            onPress={handleSend}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Text style={styles.primaryText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.fine}>
            For security, we don't say whether the email is registered.
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
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.25)',
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
    backgroundColor: '#e94560',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryDisabled: { opacity: 0.6 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },

  secondary: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  secondaryText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },

  fine: {
    fontSize: 12,
    color: '#3a3a4a',
    marginTop: 20,
    lineHeight: 18,
    textAlign: 'center',
  },
});