"use client";

import Link from "next/link";
import type { Game } from "@/src/types/game";
import { useGameStore } from "@/src/stores/game-store";

export function GameCard({ game, featured = false }: { game: Game; featured?: boolean }) {
  const favoriteIds = useGameStore((state) => state.favoriteIds);
  const toggleFavorite = useGameStore((state) => state.toggleFavorite);
  const isFavorite = favoriteIds.includes(game.id);
  return (
    <article className={`game-card ${featured ? "featured-card" : ""}`} style={{ "--card-accent": game.accent, "--card-soft": game.accentSoft } as React.CSSProperties}>
      <div className="card-art"><div className="art-orb" /><span className="card-index">0{game.id === "zero-hour" ? "1" : "2"}</span><button className={`favorite-button ${isFavorite ? "saved" : ""}`} onClick={() => toggleFavorite(game.id)} aria-label={`${isFavorite ? "Remove" : "Add"} ${game.title} ${isFavorite ? "from" : "to"} favorites`}>{isFavorite ? "★" : "☆"}</button></div>
      <div className="card-content"><div className="card-meta"><span>{game.category}</span><span>★ {game.rating}</span></div><h3>{game.title}</h3><p>{game.subtitle}</p><div className="card-foot"><span>{game.players} playing</span><Link href={`/play/${game.id}`} className="card-play">Play <b>↗</b></Link></div></div>
    </article>
  );
}
