# Shard Runner

![Shard Runner game screen](public/game-screenshot.png)

Shard Runner is a browser-based 3D collection game built with Next.js, Three.js, and GSAP. Pilot a small signal ship through a neon meadow, collect all twelve golden shards, and avoid the red hazard rings before the timer runs out.

## How To Play

1. Start the mission from the opening screen.
2. Move the ship with `W`, `A`, `S`, `D` or the arrow keys.
3. Collect all `12` glowing shards to win.
4. Avoid red rings. Touching one ends the run.
5. Finish before the `60-second` timer reaches zero.
6. Use the pause button in the top-right corner to pause or resume.

On small screens, use the on-screen directional controls.

## Game Structure

- `app/page.tsx` contains the game state, HUD, controls, arena setup, player movement, collision detection, scoring, and win/loss states.
- `app/globals.css` contains the responsive game layout, HUD, overlays, buttons, and mobile controls.
- `app/layout.tsx` defines the page metadata and Google fonts.
- `public/game-screenshot.png` is a screenshot of the playable opening screen.

## Technology

- **Next.js 16** and **React 19** for the app shell and UI state.
- **Three.js** for the 3D arena, ship, shards, hazards, lights, grid, and star field.
- **GSAP** for the ship launch, arena entrance, and shard collection animation.
- **TypeScript** for typed game state and component logic.

## Run Locally

From this directory:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Production Build

```bash
npm run lint
npm run build
npm start
```

## Notes

The game is intentionally self-contained: it uses procedural Three.js geometry and does not require external image or model assets. The arena is responsive and caps the renderer pixel ratio to keep the experience smooth on high-density screens.
