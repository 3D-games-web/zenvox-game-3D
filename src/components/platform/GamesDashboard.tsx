"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { GameCard } from "@/src/components/platform/GameCard";
import { PlatformNav } from "@/src/components/platform/PlatformNav";
import { PlatformScene } from "@/src/components/platform/PlatformScene";
import { gamesService } from "@/src/services/games.service";
import { gameCategories, type GameCategory } from "@/src/types/game";

export function GamesDashboard() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<GameCategory | "All">("All");
  const { data: games = [], isLoading } = useQuery({ queryKey: ["games", search, category], queryFn: () => gamesService.list({ search, category }) });
  const featured = games.find((game) => game.featured);
  const popular = games.filter((game) => !game.featured);

  return <main className="platform-shell"><PlatformNav /><section className="platform-hero"><div className="hero-intro"><p className="platform-kicker">NEXORA / 01 <span>Live universe</span></p><h1>Play beyond<br /><em>the screen.</em></h1><p className="hero-description">A curated universe of worlds built to pull you in. Choose a game, make your mark, and stay a while.</p><div className="hero-actions"><a className="primary-cta" href="/play/zero-hour">Play now <b>↗</b></a><a className="text-cta" href="#catalog">Explore library <span>↓</span></a></div></div><PlatformScene /><div className="hero-stat"><strong>04</strong><span>worlds online</span></div></section>
  <section className="catalog" id="catalog"><div className="section-heading"><div><p className="platform-kicker">/ Game library</p><h2>Find your<br /><em>next world.</em></h2></div><p className="catalog-note">Fresh drops, strange places,<br />and a good reason to stay up late.</p></div><div className="catalog-tools"><label className="search-field"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search games" aria-label="Search games" /></label><div className="category-list"><button className={category === "All" ? "selected" : ""} onClick={() => setCategory("All")}>All games</button>{gameCategories.slice(0, 5).map((item) => <button className={category === item ? "selected" : ""} key={item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>{isLoading ? <div className="card-grid"><div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" /></div> : <><div className="featured-wrap">{featured && <GameCard game={featured} featured />}<div className="featured-copy"><p className="platform-kicker">Featured transmission</p><h3>{featured?.title ?? "No signal found"}</h3><p>{featured?.description}</p><div className="feature-details"><span>★★★★★ <small>4.9 rating</small></span><span>12+ <small>recommended</small></span></div></div></div><div className="library-head"><p className="platform-kicker">/ Popular this week</p><span>{popular.length} titles</span></div><div className="card-grid">{popular.map((game) => <GameCard game={game} key={game.id} />)}</div></>}</section><footer className="platform-footer"><span>NEXORA © 2026</span><span>Built for curious players</span><span>System status <i /></span></footer></main>;
}
