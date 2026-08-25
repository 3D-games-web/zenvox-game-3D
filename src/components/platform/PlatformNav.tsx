"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { label: "Discover", href: "/" },
  { label: "Games", href: "/games" },
  { label: "Favorites", href: "/favorites" },
  { label: "Leaderboard", href: "/leaderboard" },
];

export function PlatformNav() {
  const pathname = usePathname();
  return (
    <header className="platform-nav">
      <Link className="nexora-logo" href="/"><span className="nexora-orbit" />NEXORA</Link>
      <nav aria-label="Primary navigation">{links.map((link) => <Link className={pathname === link.href ? "active" : ""} href={link.href} key={link.href}>{link.label}</Link>)}</nav>
      <Link className="profile-chip" href="/profile"><span>AB</span><strong>Abdul Basit</strong><i>⌄</i></Link>
    </header>
  );
}
