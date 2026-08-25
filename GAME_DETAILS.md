# ZENVOX: DRIVE

## Game Overview

ZENVOX: DRIVE is a browser-based 3D arcade driving game built with Next.js and Three.js.

The player drives a red sports car through a futuristic city freeway. The goal is to travel as far as possible, maintain speed, collect golden checkpoint rings, and avoid traffic.

## Core Gameplay

- Drive continuously along a procedural city road.
- Steer between three freeway lanes.
- Accelerate to increase speed and distance.
- Slow down when traffic blocks the road.
- Collect golden checkpoint rings for bonus points.
- Avoid other vehicles.
- A traffic collision ends the current run.

## Controls

| Input | Action |
| --- | --- |
| `W` or `Arrow Up` | Accelerate |
| `S` or `Arrow Down` | Brake or slow down |
| `A` or `Arrow Left` | Steer left |
| `D` or `Arrow Right` | Steer right |
| Pause button | Pause or resume the run |
| Touch buttons | Mobile steering controls |

## Scoring

### Distance Points

The game awards points continuously while the car is moving:

- Every kilometer contributes `10` points.
- Distance is displayed in kilometers.
- The current score is shown in the Points HUD.

### Checkpoint Bonus

Golden checkpoint rings are placed along the road.

- Driving through a checkpoint awards `+100` points.
- A collected checkpoint is recycled farther ahead on the freeway.
- Checkpoints keep the score active during longer runs.

## Game States

The game has four states:

- **Ready**: The opening screen is visible and the run has not started.
- **Playing**: The car, traffic, scenery, distance, and score are active.
- **Paused**: The scene remains visible while gameplay movement stops.
- **Crashed**: A traffic collision ends the run and shows the final distance and points.

## 3D World

The road, city, lamps, pedestrians, and traffic are created procedurally with Three.js geometry. The player car upgrades to a real Ferrari GLTF model loaded from the Three.js example asset CDN when the asset is available. A procedural car remains as a fallback so the game never becomes a blank screen if the network asset cannot load.

### Road

- Wide freeway surface
- Road shoulders
- Sidewalks
- Repeating lane markers
- Perspective camera positioned behind the car

### City

- Buildings with varied widths and heights
- Multiple facade colors
- Repeating blue window grids
- Rooftop structures
- Street lamps with glowing lights
- Atmospheric fog and sunlight

### Pedestrians

- Low-poly people are placed on both sidewalks.
- Pedestrians have heads, torsos, and legs.
- Leg movement is animated while the scene scrolls.
- Pedestrians recycle with the roadside scenery.

### Vehicles

- The player drives a red Ferrari GLTF sports-car model when the model asset loads.
- The game falls back to a procedural sports car if the GLTF request fails.
- The freeway contains eight traffic vehicles distributed across multiple lanes and distances.
- Traffic vehicles use cloned Ferrari GLTF models when the shared model asset loads.
- Traffic cars use varied paint colors and slight scale differences so the road does not feel duplicated.
- The procedural fallback traffic cars still have bodies, cabins, wheels, and headlights.
- Traffic moves at different speeds and recycles farther down the road to create overtaking and collision moments.

## Technical Architecture

The playable game is isolated as its own module:

```text
src/
└── games/
    └── drive/
        └── DriveGame.tsx
```

The route entry points are:

```text
app/
├── page.tsx
└── play/
    └── zero-hour/
        └── page.tsx
```

Both routes currently open the same single driving game.

## Main Game Systems

### Rendering

Three.js manages:

- Scene creation
- Camera perspective
- Lighting
- Procedural geometry
- Shadows
- Fog
- WebGL rendering

### Movement

The movement system:

- Reads keyboard input through a `Set` of active keys.
- Smooths acceleration with interpolation.
- Moves the player horizontally for steering.
- Clamps the car inside the road boundaries.
- Scrolls lane markers and scenery toward the camera.

### Traffic

Traffic cars are stored in an array and updated each animation frame.

Cars recycle to the far end of the road after passing the camera. A collision is detected using the distance between the player and each traffic car.

### Checkpoints

Checkpoint meshes are stored in an array and updated during gameplay. When the player reaches a checkpoint:

1. The score increases by `100`.
2. GSAP scales the checkpoint for feedback.
3. The checkpoint moves to a new position ahead of the player.

### Animation

GSAP is used for:

- Initial car drop-in animation
- Crash rotation feedback
- Checkpoint collection feedback

## Performance Considerations

The current prototype includes several production-minded choices:

- Renderer pixel ratio is capped at `2`.
- Geometry uses simple reusable primitives.
- The world recycles scenery instead of continuously creating objects.
- The animation frame is cancelled during cleanup.
- Keyboard and resize listeners are removed during cleanup.
- The renderer is disposed when the component unmounts.

## Responsive Support

Desktop users can play with a keyboard.

Mobile users receive visible touch controls for left, forward, and right movement. The HUD scales down and remains positioned above the scene without blocking the primary game view.

## Project Commands

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production validation:

```bash
npm run lint
npm run build
```

## Relevant Files

- [DriveGame.tsx](src/games/drive/DriveGame.tsx): Complete playable game module.
- [page.tsx](app/page.tsx): Homepage entry point.
- [page.tsx](app/play/zero-hour/page.tsx): Alternate play route.
- [globals.css](app/globals.css): Game HUD, overlays, responsive layout, and controls.
- [layout.tsx](app/layout.tsx): Metadata, fonts, and shared providers.
- [README.md](README.md): Quick-start project documentation.

## Future Expansion

The current game can grow into a larger driving platform with:

- Multiple city routes
- Lap and checkpoint races
- Opponent AI
- Police pursuit mode
- Car upgrades
- Garage and vehicle selection
- Weather and day/night cycles
- Sound effects and engine audio
- Leaderboards
- Persistent player records
- Real 3D car and city assets loaded from GLTF or GLB files
