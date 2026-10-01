// src/screens/TournamentJoinScreen.tsx
//
// RPS Arena — tournament join by code.
//
// Wrapped in ScreenScroll so the code input + paste + join
// button are always reachable on short phones.
//
// Chat 11 — deep link:
//   Accepts an optional `code` param. When present (from a deep link
//   or from Login's returnTo), pre-fills the input and auto-submits
//   after a short beat so the user lands in the tournament without
//   a second tap.
//
// Guests are redirected to Login with a returnTo back to this screen
// and the code preserved, as defense in depth. AuthGate in the
// navigator is expected to intercept first.
//
// APK: paste button is web-only (Platform.OS guard). On APK the user
// types the code. Everything else is platform-agnostic.

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, LogIn, Link as LinkIcon } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { startMenuMusic, playSound } from '../services/audio';
import {
  connectToServer,
  getSocket,
  joinTournamentOnServer,
} from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';
import { useUserStore } from '../store/userStore';

const win = globalThis as any;
const CODE_LEN = 6;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export default function TournamentJoinScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const { identity, isAnonymous } = useUserStore();
  const myUserId = identity?.userId || '';

  // Chat 11: optional code from a deep link or a Login returnTo.
  const initialCode: string = route.params?.code || '';

  const [code, setCode] = useState(initialCode);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [invalidFormat, setInvalidFormat] = useState(false);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    startMenuMusic();
  }, []);

  // ─── AUTH GUARD (defense in depth) ───
  // Should never fire once AuthGate is live, but if a guest lands here
  // for any reason, send them through Login and preserve the code.
  useEffect(() => {
    if (isAnonymous) {
      console.log('[TOURNAMENT JOIN] guest — routing via Login');
      (navigation.replace as any)('Login', {
        returnTo: 'TournamentJoin',
        returnParams: initialCode ? { code: initialCode } : undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnonymous]);

  const sanitizeCodeInput = (raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (trimmed.includes('?tournament=') || trimmed.includes('/join/')) {
      const match =
        trimmed.match(/[?&]tournament=([A-Z0-9]+)/i) ||
        trimmed.match(/\/join\/([A-Z0-9]+)/i);
      if (match && match[1]) {
        return match[1].toUpperCase().slice(0, CODE_LEN);
      }
    }
    const upper = trimmed.toUpperCase();
    let out = '';
    for (const ch of upper) {
      if (CODE_CHARS.includes(ch)) out += ch;
      if (out.length >= CODE_LEN) break;
    }
    return out;
  };

  const onChangeCode = (text: string) => {
    const next = sanitizeCodeInput(text);
    setCode(next);
    if (invalidFormat) setInvalidFormat(false);
    if (error) setError('');
  };

  const ensureConnected = async (): Promise<boolean> => {
    if (getSocket()?.connected) return true;
    try {
      const socket = await connectToServer(getAccessToken);
      return !!socket;
    } catch {
      return false;
    }
  };

  const handlePasteFromClipboard = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    try {
      const text = await win.navigator?.clipboard?.readText?.();
      if (typeof text === 'string' && text.length > 0) {
        onChangeCode(text);
        playSound('click');
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidFormat, error]);

  const handleJoin = useCallback(
    async (overrideCode?: string) => {
      const effectiveCode = (overrideCode || code).toUpperCase();
      setError('');
      setInvalidFormat(false);

      if (effectiveCode.length !== CODE_LEN) {
        setInvalidFormat(true);
        setError(`Enter a ${CODE_LEN}-character code`);
        return;
      }

      if (!myUserId) {
        setError('Not signed in');
        return;
      }

      setJoining(true);
      console.log('[TOURNAMENT JOIN] attempting', effectiveCode);

      const connected = await ensureConnected();
      if (!connected) {
        setError('Could not connect to server');
        setJoining(false);
        return;
      }

      try {
        const res = await joinTournamentOnServer(effectiveCode);
        if (!res.success || !res.tournamentId || !res.code) {
          console.log('[TOURNAMENT JOIN] server rejected:', res.message);
          setError(res.message || 'Could not join tournament');
          setJoining(false);
          return;
        }

        console.log(
          '[TOURNAMENT JOIN] success →',
          res.tournamentId,
          res.code
        );
        playSound('success');

        navigation.replace('TournamentLobby', {
          tournamentId: res.tournamentId,
          code: res.code,
          isHost: false,
        });
      } catch (e: any) {
        console.error('[TOURNAMENT JOIN] error:', e?.message);
        setError('Could not join tournament');
        setJoining(false);
      }
    },
    [code, myUserId, navigation]
  );

  // ─── AUTO-SUBMIT on deep-link arrival ───
  // If the screen mounted with a code from a param, join once
  // automatically. Guarded by a ref so a re-render never double-fires.
  useEffect(() => {
    if (!initialCode) return;
    if (autoSubmittedRef.current) return;
    if (isAnonymous) return; // wait for the auth guard to run first
    if (initialCode.length !== CODE_LEN) return;
    autoSubmittedRef.current = true;

    // Small delay so the screen paints first and the user sees what
    // happened. Prevents a "flash and gone" experience on the deep
    // link.
    const t = setTimeout(() => {
      handleJoin(initialCode);
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCode, isAnonymous]);

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerBtn}
          >
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🏆 Join Tournament</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.identityCard}>
            <Text style={styles.identityLabel}>Joining as</Text>
            <Text style={styles.identityName}>
              {identity?.username || 'Player'}
            </Text>
          </View>

          <Text style={styles.label}>TOURNAMENT CODE</Text>

          <TextInput
            style={[styles.codeInput, invalidFormat && styles.inputError]}
            placeholder="------"
            placeholderTextColor="#3a3a4a"
            value={code}
            onChangeText={onChangeCode}
            maxLength={CODE_LEN}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            editable={!joining}
          />

          {Platform.OS === 'web' && (
            <TouchableOpacity
              style={styles.pasteBtn}
              onPress={handlePasteFromClipboard}
              activeOpacity={0.7}
              disabled={joining}
            >
              <LinkIcon size={14} color="#4facfe" />
              <Text style={styles.pasteBtnText}>
                Paste code or link from clipboard
              </Text>
            </TouchableOpacity>
          )}

          <Text style={styles.hint}>
            Paste a code ({CODE_LEN} characters) or a share link.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.joinBtn,
              (joining || code.length !== CODE_LEN) && styles.joinBtnDisabled,
            ]}
            onPress={() => handleJoin()}
            disabled={joining || code.length !== CODE_LEN}
            activeOpacity={0.85}
          >
            {joining ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <LogIn size={20} color="#ffffff" />
                <Text style={styles.joinBtnText}>Join Tournament</Text>
              </>
            )}
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  headerBtn: { padding: 6, width: 36 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#ffffff' },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  identityCard: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(233, 69, 96, 0.08)',
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(233, 69, 96, 0.2)',
  },
  identityLabel: {
    fontSize: 10,
    color: '#8a8a9a',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  identityName: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 4,
  },
  label: {
    fontSize: 11,
    color: '#5a5a7a',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 4,
  },
  codeInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#ffffff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minWidth: 0,
  },
  inputError: {
    borderColor: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.08)',
  },
  pasteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(79, 172, 254, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(79, 172, 254, 0.25)',
  },
  pasteBtnText: {
    color: '#4facfe',
    fontSize: 12,
    fontWeight: '700',
  },
  hint: {
    fontSize: 11,
    color: '#5a5a7a',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  errorBox: {
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  joinBtnDisabled: {
    opacity: 0.5,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});