import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

const base = {
  light: {
    background: '#FBF6F1',
    card: '#FFFFFF',
    cardAlt: '#F1E7E2',
    border: '#EFE3DD',
    line: '#F3EAE5',
    text: '#2A1A22',
    textSecondary: '#7D6870',
    onPrimary: '#FFFFFF',
    onFeature: '#FBF6F1',
    success: '#1F6B3A',
    successSoft: '#E4F1E8',
    danger: '#B3261E',
    shadow: '#3B1F2D',
  },
  dark: {
    background: '#160E12',
    card: '#22171C',
    cardAlt: '#2C1F25',
    border: '#36262D',
    line: '#2F2228',
    text: '#F6ECEE',
    textSecondary: '#B9A3AB',
    onPrimary: '#160E12',
    onFeature: '#FBF6F1',
    success: '#7FD39C',
    successSoft: '#1C3326',
    danger: '#FF8A80',
    shadow: '#000000',
  },
};

type Accent = {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  /** Carte « vedette » (compteur, tirage au sort). */
  feature: string;
  onFeatureMuted: string;
  featureAccent: string;
};

/** Thèmes de couleur proposés dans l'onglet Nous. */
export const AccentThemes: Record<string, { name: string; light: Accent; dark: Accent }> = {
  framboise: {
    name: 'Framboise',
    light: { primary: '#C8385A', primaryDark: '#9E2443', primarySoft: '#F7E3E7', feature: '#3B1F2D', onFeatureMuted: '#E2C9D0', featureAccent: '#FF8FA8' },
    dark: { primary: '#F06C8B', primaryDark: '#FF97AE', primarySoft: '#3A1E28', feature: '#4A2537', onFeatureMuted: '#E2C9D0', featureAccent: '#FF8FA8' },
  },
  nuit: {
    name: 'Bleu nuit',
    light: { primary: '#3557A8', primaryDark: '#22407F', primarySoft: '#E2E9F7', feature: '#1C2541', onFeatureMuted: '#C5CEE6', featureAccent: '#8FB0FF' },
    dark: { primary: '#7D9CF0', primaryDark: '#A9BFFA', primarySoft: '#1E2740', feature: '#26314F', onFeatureMuted: '#C5CEE6', featureAccent: '#8FB0FF' },
  },
  sauge: {
    name: 'Sauge',
    light: { primary: '#3F7A57', primaryDark: '#2B5A3F', primarySoft: '#E1EEE5', feature: '#1F3328', onFeatureMuted: '#C6DACD', featureAccent: '#9BD8AF' },
    dark: { primary: '#77C094', primaryDark: '#A2DBB8', primarySoft: '#1B2E23', feature: '#28402F', onFeatureMuted: '#C6DACD', featureAccent: '#9BD8AF' },
  },
  terracotta: {
    name: 'Terracotta',
    light: { primary: '#B4532F', primaryDark: '#8C3D20', primarySoft: '#F6E3D9', feature: '#3A2218', onFeatureMuted: '#E5CDBF', featureAccent: '#FFB08A' },
    dark: { primary: '#E88A62', primaryDark: '#F5AE8E', primarySoft: '#3A2219', feature: '#4A2C20', onFeatureMuted: '#E5CDBF', featureAccent: '#FFB08A' },
  },
};

export type AccentId = keyof typeof AccentThemes;
export type Palette = typeof base.light & Accent;

const PrefsContext = createContext<{ accent: AccentId; setAccent: (a: AccentId) => void }>({
  accent: 'framboise',
  setAccent: () => {},
});

/** Préférences propres à ce téléphone (thème de couleur). */
export function PrefsProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState<AccentId>('framboise');
  const chosen = useRef(false);
  const mounted = useRef(true);
  const saves = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    mounted.current = true;
    void Promise.resolve().then(() => AsyncStorage.getItem('prefs:accent')).then((v) => {
      if (active && !chosen.current && typeof v === 'string' && Object.hasOwn(AccentThemes, v)) setAccentState(v);
    }).catch(() => {
      // A cosmetic preference must not prevent startup if local storage fails.
    });
    return () => { active = false; mounted.current = false; };
  }, []);

  const setAccent = useCallback((a: AccentId) => {
    if (!mounted.current || !Object.hasOwn(AccentThemes, a)) return;
    chosen.current = true;
    setAccentState(a);
    // Preserve selection order within this provider. A failed save keeps the
    // in-memory choice usable, without promising persistence after a restart.
    saves.current = saves.current.then(() => AsyncStorage.setItem('prefs:accent', a)).catch(() => {});
  }, []);

  return <PrefsContext.Provider value={{ accent, setAccent }}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  return useContext(PrefsContext);
}

export function useTheme(): Palette {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const { accent } = useContext(PrefsContext);
  return { ...base[scheme], ...AccentThemes[accent][scheme] };
}

export const Fonts = {
  display: 'Fraunces_600SemiBold',
  displayMedium: 'Fraunces_500Medium',
  displayItalic: 'Fraunces_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
};

/** Couleurs proposées pour chaque membre du couple (agenda, messages…). */
export const MemberColors = ['#C8385A', '#2F5D9E', '#1F7A55', '#C26A1B', '#6D4AB0', '#B03C8C', '#1D7C86'];

/** Couleur des événements « nous deux ». */
export const BothColor = '#E07B39';

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const Radius = 22;

/** Ombre douce des cartes. */
export const cardShadow = (color: string) => ({
  shadowColor: color,
  shadowOpacity: 0.07,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
});
