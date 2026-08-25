export const gameCategories = [
  "Action",
  "Adventure",
  "Racing",
  "Shooter",
  "Survival",
  "Strategy",
  "Simulation",
  "Arcade",
  "Puzzle",
  "Sports",
] as const;

export type GameCategory = (typeof gameCategories)[number];
export type GameDifficulty = "Easy" | "Medium" | "Hard";

export type Game = {
  id: string;
  title: string;
  subtitle: string;
  category: GameCategory;
  rating: number;
  players: string;
  difficulty: GameDifficulty;
  accent: string;
  accentSoft: string;
  description: string;
  featured?: boolean;
  tags: string[];
};
