import { z } from "zod";

export const gameSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  rating: z.number().min(0).max(5),
  players: z.string().min(1),
});

export type GameRecord = z.infer<typeof gameSchema>;
