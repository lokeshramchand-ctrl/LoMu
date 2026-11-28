'use client';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

type SleepState = {
  anchors: Record<string, number>;
  setAnchor: (runStart: number, playAt: number) => void;
  clearAnchor: (runStart: number) => void;
};

export const useSleep = create<SleepState>()(
  persist(
    (set) => ({
      anchors: {},
      setAnchor: (s, at) => set((st) => ({ anchors: { ...st.anchors, [String(s)]: at } })),
      clearAnchor: (s) =>
        set((st) => {
          const a = { ...st.anchors };
          delete a[String(s)];
          return { anchors: a };
        }),
    }),
    { name: 'lomu-sleep', version: 1, storage: createJSONStorage(() => localStorage) },
  ),
);
