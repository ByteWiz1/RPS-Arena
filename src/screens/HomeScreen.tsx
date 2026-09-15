import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Bot,
  Users,
  Wifi,
  Brain,
  Settings,
  ArrowRight,
} from 'lucide-react-native';

type Navigation = { navigate: (screen: string, params?: any) => void };

export default function HomeScreen() {
  const navigation = useNavigation<Navigation>();

  const menuItems = [
    {
      id: 'pvc',
      title: 'Player vs AI',
      subtitle: 'Challenge the adaptive computer',
      icon: Bot,
      color: '#e94560',
      screen: 'Game',
      params: { mode: 'pvc' },
    },
    {
      id: 'pvp',
      title: 'Local Multiplayer',
      subtitle: 'Play on the same device',
      icon: Users,
      color: '#4facfe',
      screen: 'Game',
      params: { mode: 'pvp' },
    },
    {
      id: 'online',
      title: 'Online Multiplayer',
      subtitle: 'Challenge players worldwide',
      icon: Wifi,
      color: '#4ade80',
      screen: 'OnlineLobby',
      params: {},
    },
    {
      id: 'profile',
      title: 'My Avatar',
      subtitle: 'Customize your AI champion',
      icon: Brain,
      color: '#fbbf24',
      screen: 'Profile',
      params: {},
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🎮 RPS Arena</Text>
          <Text style={styles.subtitle}>Rock Paper Scissors</Text>
        </View>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => navigation.navigate('Settings')}
        >
          <Settings size={24} color="#5a5a7a" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.menuContainer}
        showsVerticalScrollIndicator={false}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              onPress={() => navigation.navigate(item.screen, item.params)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <Icon size={24} color={item.color} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ArrowRight size={20} color="#5a5a7a" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#5a5a7a', marginTop: 2, letterSpacing: 0.5 },
  settingsButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  menuContainer: { padding: 16, paddingBottom: 40, gap: 12 },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    gap: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: { flex: 1 },
  menuTitle: { fontSize: 16, fontWeight: '600', color: '#ffffff', letterSpacing: -0.2 },
  menuSubtitle: { fontSize: 13, color: '#5a5a7a', marginTop: 1 },
});