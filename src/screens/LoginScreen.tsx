// src/screens/LoginScreen.tsx
//
// RPS Arena — email + password login (Chat 9, new).
//
// Used to sign into an existing account from a new device.
// On success:
//   1. signInWithEmail() — establishes the Supabase session.
//   2. userStore.bootstrapAuth() — reloads profile + store.
//   3. Reconnect socket with the fresh JWT (disconnect + reconnect).
//   4. Navigate home.
//
// Reachable from:
//   - SettingsScreen "Sign in" (anonymous users)
//   - App.tsx sessionReplaced handler (Option X)
//   - Home guest banner (optional)

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
import { useNavigation } from '@react-navigation/native';
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
  const { bootstrapAuth, username, avatar } = useUserStore();

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
      const s = getSocket();
      if (s) {
        // identify ensures the public.users row exists for this uid
        // (it may already from migration or previous use).
        try {
          await identifyOnServer({
            username: username || undefined,
            avatar: avatar || undefined,
          });
        } catch (e: any) {
          console.log('[LOGIN] identify after login failed:', e?.message);
        }
      }
    } catch (e: any) {
      console.log('[LOGIN] socket reconnect failed:', e?.message);
    }

    setLoading(false);
    showAlert('Welcome back', 'You are signed in.');
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
          <Text style={styles.headerTitle}>Sign In</Text>
          <View style={styles.placeholder} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <Text style={styles.headline}>Welcome back</Text>
          <Text style={styles.subhead}>
            Sign in with the email you linked to your account.
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
            onPress={() => navigation.navigate('SignupLink')}
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
    marginBottom: 28,
    lineHeight: 20,
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