export type RaffleThemePreset = {
  name: string;
  label: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  textColor: string;
  cardColor: string;
};

export const RAFFLE_THEME_PRESETS: RaffleThemePreset[] = [
  {
    name: 'classic',
    label: 'Clásico',
    primaryColor: '#fff159',
    secondaryColor: '#3483fa',
    accentColor: '#00a650',
    textColor: '#0f172a',
    cardColor: '#ffffff',
  },
  {
    name: 'night',
    label: 'Noche',
    primaryColor: '#0f172a',
    secondaryColor: '#1d4ed8',
    accentColor: '#22c55e',
    textColor: '#ffffff',
    cardColor: '#111827',
  },
  {
    name: 'sunset',
    label: 'Atardecer',
    primaryColor: '#fdba74',
    secondaryColor: '#f97316',
    accentColor: '#7c3aed',
    textColor: '#1f2937',
    cardColor: '#fff7ed',
  },
  {
    name: 'candy',
    label: 'Candy',
    primaryColor: '#f9a8d4',
    secondaryColor: '#ec4899',
    accentColor: '#8b5cf6',
    textColor: '#1f2937',
    cardColor: '#ffffff',
  },
  {
    name: 'forest',
    label: 'Bosque',
    primaryColor: '#bbf7d0',
    secondaryColor: '#16a34a',
    accentColor: '#0ea5e9',
    textColor: '#064e3b',
    cardColor: '#f0fdf4',
  },
];

export function getThemeByName(name?: string): RaffleThemePreset {
  return (
    RAFFLE_THEME_PRESETS.find((theme) => theme.name === name) ||
    RAFFLE_THEME_PRESETS[0]
  );
}

export function getRaffleTheme(raffle?: any): RaffleThemePreset {
  const base = getThemeByName(raffle?.themeName);

  return {
    ...base,
    primaryColor: raffle?.themePrimaryColor || base.primaryColor,
    secondaryColor: raffle?.themeSecondaryColor || base.secondaryColor,
    accentColor: raffle?.themeAccentColor || base.accentColor,
    textColor: raffle?.themeTextColor || base.textColor,
    cardColor: raffle?.themeCardColor || base.cardColor,
  };
}