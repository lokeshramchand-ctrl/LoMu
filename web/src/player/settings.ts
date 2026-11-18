'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'system' | 'light' | 'dark';

type Settings = {
  theme: Theme;
  /** Developer flags: features that are off by default. */
  dev: { explore: boolean; streamInfo: boolean; artistEnrichment: boolean };
  setTheme: (t: Theme) => void;
  setDev: (k: keyof Settings['dev'], v: boolean) => void;
};

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'system',
      dev: { explore: false, streamInfo: false, artistEnrichment: true },
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setDev: (k, v) => set((s) => ({ dev: { ...s.dev, [k]: v } })),
    }),
    {
      name: 'lomu-settings',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (s) => s && applyTheme(s.theme),
    },
  ),
);

export function applyTheme(t: Theme) {
  if (typeof document === 'undefined') return;
  if (t === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}
