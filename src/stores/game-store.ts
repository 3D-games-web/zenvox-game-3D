import { create } from "zustand";
import { persist } from "zustand/middleware";

type GameStore = {
  favoriteIds: string[];
  recentlyPlayedIds: string[];
  toggleFavorite: (gameId: string) => void;
  recordPlayed: (gameId: string) => void;
};

export const useGameStore = create<GameStore>()(
  persist(
    (set) => ({
      favoriteIds: [],
      recentlyPlayedIds: [],
      toggleFavorite: (gameId) => set((state) => ({
        favoriteIds: state.favoriteIds.includes(gameId)
          ? state.favoriteIds.filter((id) => id !== gameId)
          : [...state.favoriteIds, gameId],
      })),
      recordPlayed: (gameId) => set((state) => ({
        recentlyPlayedIds: [gameId, ...state.recentlyPlayedIds.filter((id) => id !== gameId)].slice(0, 6),
      })),
    }),
    { name: "nexora-games" },
  ),
);
