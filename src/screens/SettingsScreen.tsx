import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Switch, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Volume2, Vibrate, Moon, Info } from 'lucide-react-native';

export default function SettingsScreen() {
  const navigation = useNavigation();
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrationEnabled, setVibrationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(true);

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
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Volume2 size={20} color="#5a5a7a" />
            <Text style={styles.settingLabel}>Sound Effects</Text>
          </View>
          <Switch
            value={soundEnabled}
            onValueChange={setSoundEnabled}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor={soundEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Vibrate size={20} color="#5a5a7a" />
            <Text style={styles.settingLabel}>Vibration</Text>
          </View>
          <Switch
            value={vibrationEnabled}
            onValueChange={setVibrationEnabled}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor={vibrationEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <Moon size={20} color="#5a5a7a" />
            <Text style={styles.settingLabel}>Dark Mode</Text>
          </View>
          <Switch
            value={darkMode}
            onValueChange={setDarkMode}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor={darkMode ? '#ffffff' : '#f4f3f4'}
            disabled
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
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 16, color: '#ffffff' },
  aboutCard: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 24, marginTop: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)' },
  aboutTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff', marginTop: 8 },
  aboutVersion: { fontSize: 14, color: '#5a5a7a', marginTop: 4 },
  aboutText: { fontSize: 14, color: '#5a5a7a', marginTop: 4 },
});