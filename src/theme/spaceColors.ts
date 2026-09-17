export interface SpaceAccent {
  name: string;
  base: string;
  gradientStart: string;
  gradientEnd: string;
  glow: string;
  text: string;
  nebula: [string, string, string];
}

export const SPACE_ACCENTS: Record<string, SpaceAccent> = {
  pvc: {
    name: 'Player vs AI',
    base: '#1a0a0f',
    gradientStart: '#4a0e1a',
    gradientEnd: '#1a0510',
    glow: '#e94560',
    text: '#ffffff',
    nebula: ['#e94560', '#a78bfa', '#4facfe'],
  },
  pvp: {
    name: 'Local Multiplayer',
    base: '#0a1525',
    gradientStart: '#0f2a4a',
    gradientEnd: '#051020',
    glow: '#4facfe',
    text: '#ffffff',
    nebula: ['#4facfe', '#a78bfa', '#4ade80'],
  },
  online: {
    name: 'Online Multiplayer',
    base: '#0a1a14',
    gradientStart: '#0a3a2a',
    gradientEnd: '#051a10',
    glow: '#4ade80',
    text: '#ffffff',
    nebula: ['#4ade80', '#4facfe', '#a78bfa'],
  },
  profile: {
    name: 'My Avatar',
    base: '#1a1408',
    gradientStart: '#3a2800',
    gradientEnd: '#100a02',
    glow: '#fbbf24',
    text: '#ffffff',
    nebula: ['#fbbf24', '#e94560', '#a78bfa'],
  },
  training: {
    name: 'Training Lab',
    base: '#150a20',
    gradientStart: '#2a1050',
    gradientEnd: '#0a0515',
    glow: '#a78bfa',
    text: '#ffffff',
    nebula: ['#a78bfa', '#4facfe', '#f472b6'],
  },
  dojo: {
    name: 'AI Dojo',
    base: '#1a0a15',
    gradientStart: '#3a0a2a',
    gradientEnd: '#100510',
    glow: '#f472b6',
    text: '#ffffff',
    nebula: ['#f472b6', '#a78bfa', '#e94560'],
  },
};

export const COSMIC_THEME = {
  background: '#0a0a0f',
  card: 'rgba(255,255,255,0.03)',
  border: 'rgba(255,255,255,0.06)',
  textPrimary: '#ffffff',
  textSecondary: '#8a8a9a',
  textMuted: '#5a5a7a',
  textDim: '#3a3a4a',
  glowIntensity: 0.4,
  nebulaOpacity: 0.15,
  starCount: 150,
  floatingAmplitude: 6,
  floatingDurationMin: 3500,
  floatingDurationMax: 5500,
  glowPulseDurationMin: 2500,
  glowPulseDurationMax: 4000,
};

export const NEBULA_BLUR = 80;

export function getRandomOffset(max: number): number {
  return Math.random() * max;
}

export function getRandomDuration(min: number, max: number): number {
  return min + Math.random() * (max - min);
}