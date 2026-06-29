const tintColorLight = '#f97316';
const tintColorDark = '#fff';

export const appPalettes = {
  light: {
    background: '#f8fafc',
    card: '#ffffff',
    elevated: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    muted: '#64748b',
    softText: '#475569',
    inverseText: '#ffffff',
  },
  dark: {
    background: '#0f172a',
    card: '#1e293b',
    elevated: '#0f172a',
    border: '#334155',
    text: '#ffffff',
    muted: '#9ca3af',
    softText: '#d1d5db',
    inverseText: '#ffffff',
  },
} as const;

export default {
  light: {
    text: '#000',
    background: '#fff',
    tint: tintColorLight,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#fff',
    background: '#000',
    tint: tintColorDark,
    tabIconDefault: '#ccc',
    tabIconSelected: tintColorDark,
  },
  
  // Ekstra Tasarım Renkleri
  orange: '#f97316',
  gray300: '#d1d5db',
  textMuted: '#9ca3af',
  white: '#ffffff',
  navyMain: '#0f172a',
  navyCard: '#1e293b',
  navyBorder: '#334155',
  appPalettes,
};
