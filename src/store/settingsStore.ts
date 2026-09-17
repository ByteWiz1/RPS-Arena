import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setMusicVolume, setSFXVolume } from '../services/audio';

interface SettingsState {
  musicVolume: number;
  sfxVolume: number;
  vibrationEnabled: boolean;
  loaded: boolean;
  setMusicVolume: (v: number) => void;
  setSFXVolume: (v: number) => void;
  toggleVibration: () => void;
  loadSettings: () => Promise<void>;
}

const SETTINGS_KEY = '@rps_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  musicVolume: 0.3,
  sfxVolume: 0.9,
  vibrationEnabled: true,
  loaded: false,

  setMusicVolume: (v) => {
    set({ musicVolume: v });
    setMusicVolume(v);
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
        const music = data.musicVolume ?? 0.3;
        const sfx = data.sfxVolume ?? 0.9;
        const vib = data.vibrationEnabled ?? true;
        set({
          musicVolume: music,
          sfxVolume: sfx,
          vibrationEnabled: vib,
          loaded: true,
        });
        setMusicVolume(music);
        setSFXVolume(sfx);
      } else {
        set({ loaded: true });
        setMusicVolume(0.3);
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
    const { musicVolume, sfxVolume, vibrationEnabled } = useSettingsStore.getState();
    await AsyncStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ musicVolume, sfxVolume, vibrationEnabled })
    );
  } catch (error) {
    console.log('Save settings error:', error);
  }
}