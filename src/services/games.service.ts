import { games } from "@/src/data/games";
import type { Game, GameCategory } from "@/src/types/game";

export type GameQuery = { search?: string; category?: GameCategory | "All" };

export const gamesService = {
  async list(query: GameQuery = {}): Promise<Game[]> {
    const search = query.search?.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory = !query.category || query.category === "All" || game.category === query.category;
      const matchesSearch = !search || `${game.title} ${game.subtitle} ${game.category}`.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  },
  async getById(id: string): Promise<Game | undefined> {
    return games.find((game) => game.id === id);
  },
};
