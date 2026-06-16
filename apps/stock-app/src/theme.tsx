import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const colors = {
  primary: '#00D4FF',
  secondary: '#A855F7',
  accent: '#00D4FF',

  // A-share screens currently render red for up and green for down by choosing
  // colors.down/colors.up at call sites. Keep these names stable for now.
  up: '#22C55E',
  down: '#EF4444',
  flat: '#94A3B8',

  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    card: '#FFFFFF',
    text: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    inputBackground: '#F1F5F9',
    tabBar: '#FFFFFF',
    tabBarBorder: '#E2E8F0',
    headerBackground: '#FFFFFF',
    headerText: '#0F172A',
    overlay: 'rgba(0,0,0,0.4)',
    skeleton: '#E2E8F0',
    skeletonHighlight: '#F1F5F9',
  },

  dark: {
    background: '#0D0D0F',
    surface: '#1A1A1E',
    elevated: '#242428',
    card: '#1A1A1E',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#2A2A2E',
    borderLight: '#1E1E22',
    inputBackground: '#1A1A1E',
    tabBar: '#111114',
    tabBarBorder: '#2A2A2E',
    headerBackground: '#111114',
    headerText: '#F1F5F9',
    overlay: 'rgba(0,0,0,0.6)',
    skeleton: '#1E1E22',
    skeletonHighlight: '#2A2A2E',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
} as const;

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
};

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  theme: typeof colors.dark;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    AsyncStorage.getItem('theme_mode').then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const isDark = mode === 'system' ? systemScheme === 'dark' : mode === 'dark';

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem('theme_mode', newMode);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(isDark ? 'light' : 'dark');
  }, [isDark, setMode]);

  const value: ThemeContextType = {
    mode,
    isDark,
    theme: isDark ? colors.dark : colors.light,
    setMode,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
