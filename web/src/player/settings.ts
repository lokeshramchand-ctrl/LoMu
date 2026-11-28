'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark' | 'blue';

export const HOME_SECTIONS = [
  { id: 'quick', label: 'Featured mix', hint: 'The featured mix at the top' },
  { id: 'stats', label: 'Your week', hint: 'Minutes listened, streak, top artist' },
  { id: 'mixes', label: 'Made for you', hint: 'Mixes built from what you play and like' },
  { id: 'artists', label: 'Your artists', hint: 'The artists you play most' },
  { id: 'moods', label: 'Moods', hint: 'Mood playlists from YouTube Music' },
  { id: 'trending', label: 'Trending', hint: 'The YouTube Music chart' },
  { id: 'newReleases', label: 'New releases', hint: 'New albums and singles on YouTube Music' },
  { id: 'youtube', label: 'From YouTube Music', hint: 'The rest of the YouTube Music feed' },
] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number]['id'];

type Settings = {
  theme: Theme;
  home: Record<HomeSectionId, boolean>;
  dev: { explore: boolean; streamInfo: boolean; artistEnrichment: boolean };
  setTheme: (t: Theme) => void;
  setHome: (id: HomeSectionId, v: boolean) => void;
  setDev: (k: keyof Settings['dev'], v: boolean) => void;
};

const defaultHome = Object.fromEntries(HOME_SECTIONS.map((s) => [s.id, s.id !== 'youtube'])) as Record<HomeSectionId, boolean>;

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'dark',
      home: defaultHome,
      dev: { explore: true, streamInfo: false, artistEnrichment: true },
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setHome: (id, v) => set((s) => ({ home: { ...s.home, [id]: v } })),
      setDev: (k, v) => set((s) => ({ dev: { ...s.dev, [k]: v } })),
    }),
    {
      name: 'lomu-settings',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (old: unknown) => ({ ...(old as object), home: defaultHome }) as Settings,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<Settings>;
        return { ...current, ...p, home: { ...defaultHome, ...(p.home ?? {}) } };
      },
      onRehydrateStorage: () => (s) => s && applyTheme(s.theme),
    },
  ),
);

export function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
