import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Bot,
  Users,
  Wifi,
  Brain,
  Sparkles,
  Settings,
  Swords,
  Trophy,
  Lock,
  Crown,
} from 'lucide-react-native';
import SpaceBackground from '../components/SpaceBackground';
import FloatingPanel from '../components/FloatingPanel';
import ScreenContainer from '../components/ScreenContainer';
import ScreenScroll from '../components/ScreenScroll';
import { SPACE_ACCENTS, COSMIC_THEME } from '../theme/spaceColors';
import { startMenuMusic } from '../services/audio';
import { useAvatarStore } from '../store/avatarStore';
import { usePremiumStore } from '../store/premiumStore';
import { getRatingTier } from '../engine/AvatarEngine';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { getSelectedAvatar, getRecentMatches, loaded } = useAvatarStore();
  const { isPremium } = usePremiumStore();
  const avatar = getSelectedAvatar();
  const recentMatches = getRecentMatches(3);
  const premium = isPremium();

  useEffect(() => {
    startMenuMusic();
  }, []);

  const menuItems = [
    {
      id: 'pvc',
      accent: SPACE_ACCENTS.pvc,
      icon: <Bot size={22} color={SPACE_ACCENTS.pvc.glow} />,
      title: 'Player vs AI',
      subtitle: 'Challenge the adaptive computer',
      mode: 'pvc',
      premiumOnly: false,
    },
    {
      id: 'pvp',
      accent: SPACE_ACCENTS.pvp,
      icon: <Users size={22} color={SPACE_ACCENTS.pvp.glow} />,
      title: 'Local Multiplayer',
      subtitle: 'Play on the same device',
      mode: 'pvp',
      premiumOnly: false,
    },
    {
      id: 'online',
      accent: SPACE_ACCENTS.online,
      icon: <Wifi size={22} color={SPACE_ACCENTS.online.glow} />,
      title: 'Online Multiplayer',
      subtitle: 'Challenge players worldwide',
      screen: 'OnlineLobby',
      premiumOnly: true,
    },
    {
      id: 'profile',
      accent: SPACE_ACCENTS.profile,
      icon: <Brain size={22} color={SPACE_ACCENTS.profile.glow} />,
      title: 'My Avatar',
      subtitle: 'Customize your AI champion',
      screen: 'Profile',
      premiumOnly: false,
    },
    {
      id: 'training',
      accent: SPACE_ACCENTS.training,
      icon: <Sparkles size={22} color={SPACE_ACCENTS.training.glow} />,
      title: 'Training Lab',
      subtitle: 'Tune your AI personality',
      screen: 'Training',
      premiumOnly: false,
    },
    {
      id: 'dojo',
      accent: SPACE_ACCENTS.dojo,
      icon: <Swords size={22} color={SPACE_ACCENTS.dojo.glow} />,
      title: 'AI Dojo',
      subtitle: 'Face the 4 masters',
      screen: 'AIDojo',
      premiumOnly: false,
    },
    {
      id: 'leaderboard',
      accent: {
        name: 'Leaderboard',
        base: '#1a1408',
        gradientStart: '#3a2800',
        gradientEnd: '#100a02',
        glow: '#fbbf24',
        text: '#ffffff',
        nebula: ['#fbbf24', '#e94560', '#a78bfa'] as [string, string, string],
      },
      icon: <Trophy size={22} color="#fbbf24" />,
      title: 'Leaderboard',
      subtitle: 'Rankings & match history',
      screen: 'Leaderboard',
      premiumOnly: true,
    },
  ];

  const handlePress = (item: typeof menuItems[0]) => {
    if (item.premiumOnly && !premium) {
      navigation.navigate('Premium');
      return;
    }

    if (item.id === 'pvc') {
      navigation.navigate('ChooseOpponent');
    } else if (item.id === 'online') {
      navigation.navigate('OnlineMode');
    } else if (item.mode) {
      navigation.navigate('Game', { mode: item.mode });
    } else if (item.screen) {
      navigation.navigate(item.screen);
    }
  };

  const tier = avatar ? getRatingTier(avatar.rating) : null;

  const content = (
    <>
      {loaded && avatar && (
        <TouchableOpacity
          style={styles.streakBar}
          onPress={() => navigation.navigate('Profile')}
          activeOpacity={0.7}
        >
          {avatar.image?.type === 'custom' ? (
            <Image source={{ uri: avatar.image.value }} style={styles.streakImage} />
          ) : (
            <Text style={styles.streakEmoji}>{avatar.emoji}</Text>
          )}
          <View style={styles.streakInfo}>
            <Text style={styles.streakName} numberOfLines={1}>
              {avatar.name}
            </Text>
            <View style={styles.streakMetaRow}>
              <Text style={[styles.streakTier, { color: tier?.color }]}>
                {tier?.emoji} {tier?.name}
              </Text>
              <Text style={styles.streakDot}>·</Text>
              <Text style={styles.streakMetaText}>L{avatar.level}</Text>
              {avatar.winStreak >= 2 && (
                <>
                  <Text style={styles.streakDot}>·</Text>
                  <Text style={styles.streakFire}>🔥 {avatar.winStreak}W</Text>
                </>
              )}
            </View>
          </View>
          <View style={styles.recentDots}>
            {recentMatches.length === 0 ? (
              <Text style={styles.noGamesText}>No games</Text>
            ) : (
              recentMatches.map((m) => (
                <View
                  key={m.id}
                  style={[
                    styles.recentDot,
                    {
                      backgroundColor:
                        m.result === 'win'
                          ? '#4ade80'
                          : m.result === 'lose'
                          ? '#f87171'
                          : '#fbbf24',
                    },
                  ]}
                />
              ))
            )}
          </View>
        </TouchableOpacity>
      )}

      {!premium && (
        <TouchableOpacity
          style={styles.upgradeBanner}
          onPress={() => navigation.navigate('Premium')}
          activeOpacity={0.8}
        >
          <Crown size={16} color="#fbbf24" />
          <Text style={styles.upgradeText}>Unlock Online Play & Leaderboard</Text>
          <Text style={styles.upgradeArrow}>→</Text>
        </TouchableOpacity>
      )}

      <View style={styles.grid}>
        {menuItems.map((item, index) => {
          const locked = item.premiumOnly && !premium;
          return (
            <View key={item.id} style={styles.panelWrap}>
              <FloatingPanel
                accent={item.accent}
                icon={item.icon}
                title={item.title}
                subtitle={item.subtitle}
                index={index}
                onPress={() => handlePress(item)}
              />
              {locked && (
                <View style={styles.lockOverlay} pointerEvents="none">
                  <Lock size={14} color="#fbbf24" />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </>
  );

  return (
    <ScreenContainer>
      <SpaceBackground nebulaColors={['#a78bfa', '#e94560', '#4facfe']} />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.title}>🎮 RPS Arena</Text>
            <Text style={styles.subtitle}>Cosmic Arena</Text>
          </View>
          <View style={styles.headerRight}>
            {premium && (
              <View style={styles.premiumBadge}>
                <Crown size={12} color="#fbbf24" />
                <Text style={styles.premiumBadgeText}>PRO</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.settingsButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <Settings size={20} color="#8a8a9a" />
            </TouchableOpacity>
          </View>
        </View>

        <ScreenScroll contentStyle={styles.scrollContent} headerHeight={70}>
          {content}
        </ScreenScroll>
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 6,
    height: 70,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(167, 139, 250, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 10,
    color: '#a78bfa',
    marginTop: 1,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#fbbf24',
    letterSpacing: 0.5,
  },
  settingsButton: {
    padding: 7,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 40,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
  },
  upgradeText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#fbbf24' },
  upgradeArrow: { fontSize: 16, color: '#fbbf24' },
  streakBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    backgroundColor: 'rgba(167, 139, 250, 0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.2)',
    gap: 10,
  },
  streakEmoji: { fontSize: 22 },
  streakImage: { width: 30, height: 30, borderRadius: 15 },
  streakInfo: { flex: 1 },
  streakName: { fontSize: 13, fontWeight: '700', color: '#ffffff' },
  streakMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  streakTier: { fontSize: 10, fontWeight: '700' },
  streakDot: { fontSize: 10, color: '#3a3a4a' },
  streakMetaText: { fontSize: 10, color: '#8a8a9a', fontWeight: '600' },
  streakFire: { fontSize: 10, color: '#fbbf24', fontWeight: '700' },
  recentDots: { flexDirection: 'row', gap: 4 },
  recentDot: { width: 8, height: 8, borderRadius: 4 },
  noGamesText: { fontSize: 9, color: '#5a5a7a', fontStyle: 'italic' },
  grid: { gap: 12 },
  panelWrap: { position: 'relative' },
  lockOverlay: {
    position: 'absolute',
    top: 10,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});