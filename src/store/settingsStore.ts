import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBGMVolume, setSFXVolume } from '../services/audio';

interface SettingsState {
  bgmVolume: number;
  sfxVolume: number;
  vibrationEnabled: boolean;
  loaded: boolean;
  setBGMVolume: (v: number) => void;
  setSFXVolume: (v: number) => void;
  toggleVibration: () => void;
  loadSettings: () => Promise<void>;
}

const SETTINGS_KEY = '@rps_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  bgmVolume: 0.7,
  sfxVolume: 0.9,
  vibrationEnabled: true,
  loaded: false,

  setBGMVolume: (v) => {
    set({ bgmVolume: v });
    setBGMVolume(v);
    saveSettings();
  },

  setSFXVolume: (v) => {
    set({ sfxVolume: v });
    setSFXVolume(v);
    saveSettings();
  },

  toggleVibration: () => {
    set({ vibrationEnabled: !get().vibrationEnabled });
    saveSettings();
  },

  loadSettings: async () => {
    try {
      const json = await AsyncStorage.getItem(SETTINGS_KEY);
      if (json) {
        const data = JSON.parse(json);
        const bgm = data.bgmVolume ?? 0.7;
        const sfx = data.sfxVolume ?? 0.9;
        const vib = data.vibrationEnabled ?? true;
        set({
          bgmVolume: bgm,
          sfxVolume: sfx,
          vibrationEnabled: vib,
          loaded: true,
        });
        setBGMVolume(bgm);
        setSFXVolume(sfx);
      } else {
        set({ loaded: true });
        setBGMVolume(0.7);
        setSFXVolume(0.9);
      }
    } catch (error) {
      console.log('Load settings error:', error);
      set({ loaded: true });
    }
  },
}));

async function saveSettings() {
  try {
    const { bgmVolume, sfxVolume, vibrationEnabled } = useSettingsStore.getState();
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ bgmVolume, sfxVolume, vibrationEnabled })
    );
  } catch (error) {
    console.log('Save settings error:', error);
  }
}