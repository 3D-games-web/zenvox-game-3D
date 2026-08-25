import { create } from "zustand";
import { persist } from "zustand/middleware";

export type GraphicsQuality = "Low" | "Medium" | "High" | "Ultra";

type SettingsStore = {
  graphicsQuality: GraphicsQuality;
  masterVolume: number;
  reduceMotion: boolean;
  setGraphicsQuality: (quality: GraphicsQuality) => void;
  setMasterVolume: (volume: number) => void;
  setReduceMotion: (reduced: boolean) => void;
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      graphicsQuality: "High",
      masterVolume: 80,
      reduceMotion: false,
      setGraphicsQuality: (graphicsQuality) => set({ graphicsQuality }),
      setMasterVolume: (masterVolume) => set({ masterVolume }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
    }),
    { name: "nexora-settings" },
  ),
);
