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
import { Sparkles, ArrowRight } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import { useUserStore } from '../store/userStore';

export default function UsernameScreen() {
  const { createUser } = useUserStore();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    setError('');
    const trimmed = name.trim();

    if (trimmed.length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }
    if (trimmed.length > 15) {
      setError('Name must be under 15 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError('Only letters, numbers, and underscore allowed');
      return;
    }

    setLoading(true);
    await createUser(trimmed);
    setLoading(false);
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <View style={styles.content}>
            <View style={styles.heroIcon}>
              <Sparkles size={40} color="#e94560" />
            </View>

            <Text style={styles.title}>Welcome to RPS Arena</Text>
            <Text style={styles.subtitle}>
              Pick a name to get started. You'll appear online and can play with friends.
            </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, error ? styles.inputError : null]}
                placeholder="Enter your name"
                placeholderTextColor="#5a5a7a"
                value={name}
                onChangeText={(t) => {
                  setName(t);
                  if (error) setError('');
                }}
                maxLength={15}
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
              {error ? <Text style={styles.errorText}>⚠️ {error}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <>
                  <Text style={styles.buttonText}>Continue</Text>
                  <ArrowRight size={20} color="#ffffff" />
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.hint}>
              This name is saved on this device. You can change it later in Settings.
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  heroIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(233, 69, 96, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(233, 69, 96, 0.3)',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8a8a9a',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 12,
  },
  inputWrapper: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    color: '#ffffff',
    fontSize: 17,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    textAlign: 'center',
    fontWeight: '600',
  },
  inputError: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    color: '#5a5a7a',
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
});