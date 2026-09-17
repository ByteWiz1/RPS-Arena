import { Audio } from 'expo-av';

let currentMusic: Audio.Sound | null = null;
let currentSection: 'menu' | 'game' | null = null;
let musicVolume = 0.3;
let sfxVolume = 0.9;
let isTransitioning = false;
let currentSfx: Audio.Sound | null = null;

const MENU_TRACKS = [
  require('../../assets/music/track1.mp3'),
  require('../../assets/music/track2.mp3'),
  require('../../assets/music/track3.mp3'),
  require('../../assets/music/track4.mp3'),
  require('../../assets/music/track5.mp3'),
];

const GAME_TRACKS = [
  require('../../assets/sounds/bgm1.wav'),
  require('../../assets/sounds/bgm2.wav'),
  require('../../assets/sounds/bgm3.wav'),
];

const SFX = {
  success: require('../../assets/sounds/success.wav'),
  fail: require('../../assets/sounds/fail.wav'),
  tie: require('../../assets/sounds/tie.wav'),
  click: require('../../assets/sounds/click.mp3'),
  winApplause: require('../../assets/sounds/win_applause.mp3'),
  winCelebration: require('../../assets/sounds/win_celebration.mp3'),
  loseTrumpet: require('../../assets/sounds/lose_trumpet.mp3'),
  gameOver: require('../../assets/sounds/game_over.mp3'),
};

let lastMenuIndex = -1;
let lastGameIndex = -1;

function pickRandom(total: number, lastIndex: number): number {
  if (total <= 1) return 0;
  let next = Math.floor(Math.random() * total);
  if (next === lastIndex) next = (next + 1) % total;
  return next;
}

export function setMusicVolume(volume: number) {
  musicVolume = Math.max(0, Math.min(1, volume));
  if (currentMusic) currentMusic.setVolumeAsync(musicVolume).catch(() => {});
}

export function setSFXVolume(volume: number) {
  sfxVolume = Math.max(0, Math.min(1, volume));
}

export function getMusicVolume() {
  return musicVolume;
}

export function getSFXVolume() {
  return sfxVolume;
}

export function getCurrentSection() {
  return currentSection;
}

async function playNextTrack(section: 'menu' | 'game') {
  if (isTransitioning) return;
  if (musicVolume <= 0) return;

  isTransitioning = true;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const tracks = section === 'menu' ? MENU_TRACKS : GAME_TRACKS;
    const lastIndex = section === 'menu' ? lastMenuIndex : lastGameIndex;
    const nextIndex = pickRandom(tracks.length, lastIndex);

    if (section === 'menu') lastMenuIndex = nextIndex;
    else lastGameIndex = nextIndex;

    const { sound } = await Audio.Sound.createAsync(tracks[nextIndex], {
      isLooping: false,
      volume: 0,
      shouldPlay: true,
    });

    currentMusic = sound;
    isTransitioning = false;

    let vol = 0;
    const fadeIn = setInterval(async () => {
      if (!currentMusic || currentSection !== section) {
        clearInterval(fadeIn);
        return;
      }
      vol = Math.min(vol + 0.05, musicVolume);
      await currentMusic.setVolumeAsync(vol).catch(() => {});
      if (vol >= musicVolume) clearInterval(fadeIn);
    }, 50);

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        if (currentSection === section) {
          try {
            await sound.unloadAsync();
          } catch {}
          currentMusic = null;
          playNextTrack(section);
        }
      }
    });
  } catch (error) {
    console.log('Music error:', error);
    isTransitioning = false;
  }
}

export async function startMenuMusic() {
  if (currentSection === 'menu' && currentMusic) return;
  await stopMusic();
  currentSection = 'menu';
  playNextTrack('menu');
}

export async function startGameMusic() {
  if (currentSection === 'game' && currentMusic) return;
  await stopMusic();
  currentSection = 'game';
  playNextTrack('game');
}

export async function stopMusic() {
  if (currentMusic) {
    try {
      const sound = currentMusic;
      currentMusic = null;
      let vol = musicVolume;
      const fadeOut = setInterval(async () => {
        vol = Math.max(vol - 0.1, 0);
        await sound.setVolumeAsync(vol).catch(() => {});
        if (vol <= 0) {
          clearInterval(fadeOut);
          await sound.stopAsync().catch(() => {});
          await sound.unloadAsync().catch(() => {});
        }
      }, 40);
    } catch (error) {
      console.log('Stop music error:', error);
    }
  }
  currentSection = null;
}

export async function playSound(
  type:
    | 'success'
    | 'fail'
    | 'tie'
    | 'click'
    | 'winApplause'
    | 'winCelebration'
    | 'loseTrumpet'
    | 'gameOver'
) {
  if (sfxVolume <= 0) return;

  try {
    const { sound } = await Audio.Sound.createAsync(SFX[type], {
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

export async function playCelebrationSequence(
  isWinner: boolean,
  onComplete?: () => void
) {
  try {
    if (currentSfx) {
      await currentSfx.stopAsync().catch(() => {});
      await currentSfx.unloadAsync().catch(() => {});
      currentSfx = null;
    }

    const firstSound = isWinner ? SFX.winApplause : SFX.loseTrumpet;
    const secondSound = isWinner ? SFX.winCelebration : SFX.gameOver;

    const { sound: sound1 } = await Audio.Sound.createAsync(firstSound, {
      shouldPlay: true,
      volume: sfxVolume,
    });
    currentSfx = sound1;

    sound1.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        await sound1.unloadAsync().catch(() => {});

        const { sound: sound2 } = await Audio.Sound.createAsync(secondSound, {
          shouldPlay: true,
          volume: sfxVolume,
        });
        currentSfx = sound2;

        sound2.setOnPlaybackStatusUpdate(async (s2) => {
          if (s2.isLoaded && s2.didJustFinish) {
            await sound2.unloadAsync().catch(() => {});
            currentSfx = null;
            if (onComplete) onComplete();
          }
        });
      }
    });
  } catch (error) {
    console.log('Celebration error:', error);
    if (onComplete) onComplete();
  }
}

export async function stopCelebration() {
  if (currentSfx) {
    try {
      await currentSfx.stopAsync();
      await currentSfx.unloadAsync();
      currentSfx = null;
    } catch (error) {
      console.log('Stop celebration error:', error);
    }
  }
}

export async function stopAllAudio() {
  await stopMusic();
  await stopCelebration();
  currentSection = null;
}