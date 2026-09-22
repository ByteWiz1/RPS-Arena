import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Users, Swords } from 'lucide-react-native';
import ScreenContainer from '../components/ScreenContainer';
import { startMenuMusic } from '../services/audio';
import { useBattleStore } from '../store/battleStore';

export default function OnlineModeScreen() {
  const navigation = useNavigation<any>();
  const setMode = useBattleStore((s) => s.setMode);

  useEffect(() => {
    startMenuMusic();
  }, []);

  const goHuman = () => {
    setMode('human');
    navigation.navigate('OnlineLobby');
  };

  const goAvatar = () => {
    setMode('avatar');
    navigation.navigate('OnlineLobby');
  };

  return (
    <ScreenContainer>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
            <ChevronLeft size={26} color="#e94560" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>🌐 Online</Text>
          <View style={styles.headerBtn} />
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Choose Battle Mode</Text>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: 'rgba(79, 172, 254, 0.4)' }]}
            onPress={goHuman}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(79, 172, 254, 0.15)' }]}>
              <Users size={32} color="#4facfe" />
            </View>
            <Text style={styles.modeTitle}>Human vs Human</Text>
            <Text style={styles.modeDesc}>
              Play against real players. You pick, they pick, winner takes it.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { borderColor: 'rgba(167, 139, 250, 0.4)' }]}
            onPress={goAvatar}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, { backgroundColor: 'rgba(167, 139, 250, 0.15)' }]}>
              <Swords size={32} color="#a78bfa" />
            </View>
            <Text style={styles.modeTitle}>Avatar Arena</Text>
            <Text style={styles.modeDesc}>
              Watch your trained AI battle theirs. No buttons — just strategy.
            </Text>
          </TouchableOpacity>
        </View>
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 16,
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
});