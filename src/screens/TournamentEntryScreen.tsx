// src/screens/TournamentEntryScreen.tsx
//
// RPS Arena — Tournament Mode entry.
//
// Wrapped in ScreenScroll so the three actions (Human / Avatar /
// Join with Code) are always reachable on short phones.

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Users, Swords, LogIn, Trophy } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { startMenuMusic } from '../services/audio';

export default function TournamentEntryScreen() {
  const navigation = useNavigation<any>();

  useEffect(() => {
    startMenuMusic();
  }, []);

  const goHumanTournament = () => {
    navigation.navigate('TournamentConfig', { type: 'human' });
  };

  const goAvatarTournament = () => {
    navigation.navigate('TournamentConfig', { type: 'avatar' });
  };

  const goJoin = () => {
    navigation.navigate('TournamentJoin');
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
          <Text style={styles.headerTitle}>🏆 Tournament</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          <Text style={styles.title}>Choose Tournament Type</Text>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: 'rgba(79, 172, 254, 0.4)' }]}
            onPress={goHumanTournament}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: 'rgba(79, 172, 254, 0.15)' },
              ]}
            >
              <Users size={32} color="#4facfe" />
            </View>
            <View style={styles.titleRow}>
              <Trophy size={14} color="#4facfe" />
              <Text style={styles.modeTitle}>Human vs Human</Text>
            </View>
            <Text style={styles.modeDesc}>
              Bracket of real players. Random re-pairing each round.
              First to the win target advances.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: 'rgba(167, 139, 250, 0.4)' }]}
            onPress={goAvatarTournament}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: 'rgba(167, 139, 250, 0.15)' },
              ]}
            >
              <Swords size={32} color="#a78bfa" />
            </View>
            <View style={styles.titleRow}>
              <Trophy size={14} color="#a78bfa" />
              <Text style={styles.modeTitle}>Avatar vs Avatar</Text>
            </View>
            <Text style={styles.modeDesc}>
              Your trained AI battles theirs. Watch the bracket unfold
              — no buttons, just strategy.
            </Text>
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={goJoin}
            activeOpacity={0.8}
          >
            <LogIn size={20} color="#facc15" />
            <Text style={styles.secondaryActionText}>Join with Code</Text>
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
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modeCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 2,
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  modeDesc: {
    fontSize: 13,
    color: '#8a8a9a',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dividerText: {
    color: '#5a5a7a',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(250, 204, 21, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(250, 204, 21, 0.3)',
    padding: 14,
    borderRadius: 12,
  },
  secondaryActionText: {
    color: '#facc15',
    fontSize: 15,
    fontWeight: '700',
  },
});