import { Audio } from 'expo-av';

let backgroundSound: Audio.Sound | null = null;
let bgmVolume = 0.7;
let sfxVolume = 0.9;

const SOUNDS = {
  bgm1: require('../../assets/sounds/bgm1.wav'),
  bgm2: require('../../assets/sounds/bgm2.wav'),
  bgm3: require('../../assets/sounds/bgm3.wav'),
  success: require('../../assets/sounds/success.wav'),
  fail: require('../../assets/sounds/fail.wav'),
  tie: require('../../assets/sounds/tie.wav'),
  click: require('../../assets/sounds/click.mp3'),
};

const BGM_TRACKS = [SOUNDS.bgm1, SOUNDS.bgm2, SOUNDS.bgm3];

export function setBGMVolume(volume: number) {
  bgmVolume = Math.max(0, Math.min(1, volume));
  if (backgroundSound) {
    backgroundSound.setVolumeAsync(bgmVolume).catch(() => {});
  }
}

export function setSFXVolume(volume: number) {
  sfxVolume = Math.max(0, Math.min(1, volume));
}

export function getBGMVolume() {
  return bgmVolume;
}

export function getSFXVolume() {
  return sfxVolume;
}

export async function playBackground() {
  if (bgmVolume <= 0) return;

  try {
    if (backgroundSound) {
      await backgroundSound.stopAsync();
      await backgroundSound.unloadAsync();
      backgroundSound = null;
    }

    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    });

    const randomTrack = BGM_TRACKS[Math.floor(Math.random() * BGM_TRACKS.length)];

    const { sound } = await Audio.Sound.createAsync(randomTrack, {
      isLooping: true,
      volume: bgmVolume,
      shouldPlay: true,
    });

    backgroundSound = sound;
  } catch (error) {
    console.log('Background music error:', error);
  }
}

export async function stopBackground() {
  try {
    if (backgroundSound) {
      await backgroundSound.stopAsync();
      await backgroundSound.unloadAsync();
      backgroundSound = null;
    }
  } catch (error) {
    console.log('Stop background error:', error);
  }
}

export async function playSound(type: 'success' | 'fail' | 'tie' | 'click') {
  if (sfxVolume <= 0) return;

  try {
    const { sound } = await Audio.Sound.createAsync(SOUNDS[type], {
      shouldPlay: true,
      volume: sfxVolume,
    });

    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.log('Sound error:', error);
  }
}