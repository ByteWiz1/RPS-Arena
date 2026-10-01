// src/screens/TournamentConfigScreen.tsx
//
// RPS Arena — host configuration form for a tournament.
//
// Wrapped in ScreenScroll so the Create button is always reachable.
//
// Chat 11b (debug pass):
//   - Subscribes to onTournamentError and surfaces it in the error box.
//   - [TOURNAMENT CONFIG] logs at each step: mount, connect, emit,
//     receive, navigate.
//
// APK: platform-agnostic.

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  Minus,
  Plus,
  Users,
  Swords,
  Trophy,
} from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { startMenuMusic, playSound } from '../services/audio';
import {
  connectToServer,
  getSocket,
  createTournamentOnServer,
  onTournamentError,
} from '../services/multiplayer';
import { getAccessToken } from '../services/supabase';

type TournamentType = 'human' | 'avatar';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 32;
const MIN_WIN_TARGET = 15;
const MAX_WIN_TARGET = 30;
const DEFAULT_PLAYERS = 8;
const DEFAULT_WIN_TARGET = 21;

export default function TournamentConfigScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const type: TournamentType =
    route.params?.type === 'avatar' ? 'avatar' : 'human';

  const [maxPlayers, setMaxPlayers] = useState<number>(DEFAULT_PLAYERS);
  const [winTarget, setWinTarget] = useState<number>(DEFAULT_WIN_TARGET);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('[TOURNAMENT CONFIG] mounted | type:', type);
    startMenuMusic();
  }, [type]);

  // Subscribe to structured tournament errors from the server. Any
  // failure during create surfaces here immediately.
  useEffect(() => {
    const off = onTournamentError((err) => {
      if (err.action === 'create') {
        console.log('[TOURNAMENT CONFIG] server error:', err.message);
        setError(err.message);
        setCreating(false);
      }
    });
    return off;
  }, []);

  const ensureConnected = async (): Promise<boolean> => {
    if (getSocket()?.connected) {
      console.log('[TOURNAMENT CONFIG] socket already connected');
      return true;
    }
    console.log('[TOURNAMENT CONFIG] connecting…');
    try {
      const socket = await connectToServer(getAccessToken);
      console.log('[TOURNAMENT CONFIG] connected | socket:', socket?.id);
      return !!socket;
    } catch (e: any) {
      console.log('[TOURNAMENT CONFIG] connect failed:', e?.message || e);
      return false;
    }
  };

  const clampInt = (v: number, min: number, max: number) =>
    Math.max(min, Math.min(max, v));

  const adjustPlayers = (delta: number) => {
    playSound('click');
    setMaxPlayers((p) => clampInt(p + delta, MIN_PLAYERS, MAX_PLAYERS));
  };

  const adjustWinTarget = (delta: number) => {
    playSound('click');
    setWinTarget((w) => clampInt(w + delta, MIN_WIN_TARGET, MAX_WIN_TARGET));
  };

  const onPlayersInput = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    if (!digits) {
      setMaxPlayers(MIN_PLAYERS);
      return;
    }
    setMaxPlayers(clampInt(parseInt(digits, 10), MIN_PLAYERS, MAX_PLAYERS));
  };

  const onWinTargetInput = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
    if (!digits) {
      setWinTarget(MIN_WIN_TARGET);
      return;
    }
    setWinTarget(clampInt(parseInt(digits, 10), MIN_WIN_TARGET, MAX_WIN_TARGET));
  };

  const handleCreate = async () => {
    console.log('[TOURNAMENT CONFIG] handleCreate — enter');
    setError('');
    setCreating(true);

    const connected = await ensureConnected();
    if (!connected) {
      setError('Could not connect to server');
      setCreating(false);
      return;
    }

    const cfg = {
      type,
      maxPlayers,
      winTarget,
      autoAdvance,
      name: name.trim() || null,
      isPrivate,
    };

    console.log('[TOURNAMENT CONFIG] emitting createTournament | cfg:',
      JSON.stringify(cfg));

    if (
      cfg.maxPlayers < MIN_PLAYERS ||
      cfg.maxPlayers > MAX_PLAYERS ||
      cfg.winTarget < MIN_WIN_TARGET ||
      cfg.winTarget > MAX_WIN_TARGET
    ) {
      console.log('[TOURNAMENT CONFIG] client validation failed');
      setError('Invalid configuration');
      setCreating(false);
      return;
    }

    try {
      const res = await createTournamentOnServer(cfg);
      if (!res.success || !res.tournamentId || !res.code) {
        console.log('[TOURNAMENT CONFIG] server rejected:', res.message);
        setError(res.message || 'Could not create tournament');
        setCreating(false);
        return;
      }

      console.log(
        '[TOURNAMENT CONFIG] success →',
        res.tournamentId, res.code
      );
      playSound('success');

      navigation.replace('TournamentLobby', {
        tournamentId: res.tournamentId,
        code: res.code,
        isHost: true,
      });
    } catch (e: any) {
      console.error('[TOURNAMENT CONFIG] create error:', e?.message);
      setError('Could not create tournament');
      setCreating(false);
    }
  };

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
          <Text style={styles.headerTitle}>🏆 Configure</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <View style={styles.typeBadge}>
            {type === 'avatar' ? (
              <Swords size={16} color="#a78bfa" />
            ) : (
              <Users size={16} color="#4facfe" />
            )}
            <Text
              style={[
                styles.typeBadgeText,
                { color: type === 'avatar' ? '#a78bfa' : '#4facfe' },
              ]}
            >
              {type === 'avatar' ? 'Avatar vs Avatar' : 'Human vs Human'}
            </Text>
          </View>

          <Text style={styles.intro}>
            Configure your tournament. These settings are locked once it
            starts.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Tournament name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Untitled Tournament"
              placeholderTextColor="#3a3a4a"
              value={name}
              onChangeText={(t) => setName(t.slice(0, 40))}
              maxLength={40}
              autoCapitalize="sentences"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Max players</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustPlayers(-1)}
                disabled={maxPlayers <= MIN_PLAYERS}
              >
                <Minus size={18} color="#ffffff" />
              </TouchableOpacity>
              <TextInput
                style={styles.stepperInput}
                value={String(maxPlayers)}
                onChangeText={onPlayersInput}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustPlayers(1)}
                disabled={maxPlayers >= MAX_PLAYERS}
              >
                <Plus size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Between {MIN_PLAYERS} and {MAX_PLAYERS}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Win target</Text>
            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustWinTarget(-1)}
                disabled={winTarget <= MIN_WIN_TARGET}
              >
                <Minus size={18} color="#ffffff" />
              </TouchableOpacity>
              <TextInput
                style={styles.stepperInput}
                value={String(winTarget)}
                onChangeText={onWinTargetInput}
                keyboardType="number-pad"
                maxLength={2}
              />
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => adjustWinTarget(1)}
                disabled={winTarget >= MAX_WIN_TARGET}
              >
                <Plus size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              First to {winTarget} wins each match · between {MIN_WIN_TARGET} and {MAX_WIN_TARGET}
            </Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Auto-advance rounds</Text>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                playSound('click');
                setAutoAdvance((v) => !v);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleTitle}>
                  {autoAdvance ? 'On' : 'Off'}
                </Text>
                <Text style={styles.toggleDesc}>
                  {autoAdvance
                    ? 'Next round begins automatically'
                    : 'Host presses “Begin Round” each round'}
                </Text>
              </View>
              <View
                style={[
                  styles.pill,
                  autoAdvance ? styles.pillOn : styles.pillOff,
                ]}
              >
                <View
                  style={[
                    styles.pillKnob,
                    autoAdvance ? styles.pillKnobOn : styles.pillKnobOff,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Privacy</Text>
            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => {
                playSound('click');
                setIsPrivate((v) => !v);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.toggleLeft}>
                <Text style={styles.toggleTitle}>
                  {isPrivate ? 'Private' : 'Public'}
                </Text>
                <Text style={styles.toggleDesc}>
                  {isPrivate
                    ? 'Joinable only via code or link'
                    : 'Appears in the public list (list UI deferred)'}
                </Text>
              </View>
              <View
                style={[
                  styles.pill,
                  isPrivate ? styles.pillOn : styles.pillOff,
                ]}
              >
                <View
                  style={[
                    styles.pillKnob,
                    isPrivate ? styles.pillKnobOn : styles.pillKnobOff,
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreate}
            disabled={creating}
            activeOpacity={0.85}
          >
            {creating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Trophy size={20} color="#ffffff" />
                <Text style={styles.createBtnText}>Create Tournament</Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeBadgeText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.4 },
  intro: {
    fontSize: 12,
    color: '#8a8a9a',
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  field: {
    gap: 8,
    alignItems: 'stretch',
    overflow: 'hidden',
  },
  label: {
    fontSize: 11,
    color: '#5a5a7a',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    paddingHorizontal: 4,
  },
  hint: {
    fontSize: 11,
    color: '#5a5a7a',
    paddingHorizontal: 4,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minWidth: 0,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  stepperInput: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  toggleLeft: { flex: 1, minWidth: 0 },
  toggleTitle: {
    fontSize: 15,
    color: '#ffffff',
    fontWeight: '700',
  },
  toggleDesc: {
    fontSize: 11,
    color: '#8a8a9a',
    marginTop: 2,
  },
  pill: {
    width: 46,
    height: 26,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
    flexShrink: 0,
  },
  pillOn: { backgroundColor: 'rgba(74, 222, 128, 0.35)' },
  pillOff: { backgroundColor: 'rgba(255,255,255,0.08)' },
  pillKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  pillKnobOn: { alignSelf: 'flex-end' },
  pillKnobOff: { alignSelf: 'flex-start' },
  errorBox: {
    padding: 10,
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
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e94560',
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  createBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});