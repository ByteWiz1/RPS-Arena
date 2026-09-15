import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Switch,
  ScrollView,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Music, Volume2, Vibrate, Info } from 'lucide-react-native';
import { useSettingsStore } from '../store/settingsStore';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const {
    bgmVolume,
    sfxVolume,
    vibrationEnabled,
    setBGMVolume,
    setSFXVolume,
    toggleVibration,
  } = useSettingsStore();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={28} color="#e94560" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <Music size={20} color="#e94560" />
            <Text style={styles.settingLabel}>Background Music</Text>
            <Text style={styles.settingValue}>{Math.round(bgmVolume * 100)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={bgmVolume}
            onValueChange={setBGMVolume}
            minimumTrackTintColor="#e94560"
            maximumTrackTintColor="rgba(255,255,255,0.1)"
            thumbTintColor="#e94560"
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingHeader}>
            <Volume2 size={20} color="#4facfe" />
            <Text style={styles.settingLabel}>Sound Effects</Text>
            <Text style={styles.settingValue}>{Math.round(sfxVolume * 100)}%</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={1}
            value={sfxVolume}
            onValueChange={setSFXVolume}
            minimumTrackTintColor="#4facfe"
            maximumTrackTintColor="rgba(255,255,255,0.1)"
            thumbTintColor="#4facfe"
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Vibrate size={20} color="#5a5a7a" />
            <Text style={styles.settingLabel}>Vibration</Text>
          </View>
          <Switch
            value={vibrationEnabled}
            onValueChange={toggleVibration}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor={vibrationEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.aboutCard}>
          <Info size={24} color="#5a5a7a" />
          <Text style={styles.aboutTitle}>RPS Arena</Text>
          <Text style={styles.aboutVersion}>Version 1.0.0</Text>
          <Text style={styles.aboutText}>Rock Paper Scissors</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#ffffff' },
  placeholder: { width: 44 },
  content: { padding: 16, paddingBottom: 40 },
  settingCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  settingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  settingLabel: { flex: 1, fontSize: 16, color: '#ffffff', fontWeight: '500' },
  settingValue: { fontSize: 14, color: '#5a5a7a', fontWeight: '600' },
  slider: { width: '100%', height: 40 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  aboutCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 24, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  aboutTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginTop: 8 },
  aboutVersion: { fontSize: 14, color: '#5a5a7a', marginTop: 4 },
  aboutText: { fontSize: 14, color: '#5a5a7a', marginTop: 4 },
});