# 🌄 Driftworld — Implementation Plan v2
### A meditative real-world hovercraft exploration game for the web

---

## Prompt (for LLM Implementation)

> Build a browser-based 2D top-down exploration game called **Driftworld** using **Pixi.js v8** and **vanilla TypeScript** (bundled with Vite). The game pulls real road data from the **OpenStreetMap Overpass API** and renders it as the primary game surface — roads are the world the player navigates. Non-road geography (buildings, water bodies, empty fields, parks) is procedurally decorated for visual atmosphere only and has zero gameplay influence. The player controls a **hovercraft** that glides smoothly along and around roads. The world starts with a small explorable **radius** marked by a glowing boundary ring; collecting scattered **artifacts** (gems and flowers) expands the radius, unlocking new roads and regions. The tone is calm, beautiful, and exploratory — no enemies, no timers, just drift and discover.
>
> The game must include:
> - A canvas renderer using Pixi.js where **roads are the primary geometry** — all other map features are cosmetic decorations generated algorithmically
> - Hovercraft with smooth physics (velocity, drag, rotational inertia, no snapping)
> - A glowing radial boundary ring at the exploration limit with a readable label — the player can approach but not pass through
> - A **start screen** in the style of Alto's Odyssey: cinematic transition animation of drifting silhouette objects, the game title, and a start button
> - **Toast notifications** for game events: artifact collected, points gained, area expanded, new zone unlocked
> - Artifacts (gems, flowers) spawned near roads and intersections
> - A day/night cycle with 4 palette phases (dawn, noon, dusk, night) that smoothly lerp every few in-game minutes
> - A HUD showing artifact count and current points
> - OSM data fetched once per region, cached in sessionStorage, parsed from GeoJSON
> - Mobile-friendly: touch joystick on the left for steering

---

## Core Design Clarification: Roads First

> **Roads are the only real gameplay ingredient. Everything else is set dressing.**

- OSM road data (`highway=*`) is fetched, parsed, and rendered as the navigable surface
- Buildings, water bodies, parks, and empty fields are **algorithmically generated decorations** — their shapes, positions, and sizes are invented by the renderer for visual richness
- They respond to the day/night palette but are never queried from OSM and never affect movement, artifact spawning, or any game logic
- This simplifies the Overpass query, reduces data load, and keeps the gameplay surface clean

**What this means in practice:**
- `OSMFetcher.ts` only queries `highway=*` ways and `amenity` nodes (for artifact context)
- `MapRenderer.ts` has a `DecorationLayer` that generates random-but-plausible shapes (soft blobs for fields, angular clusters for buildings, wavy fills for water) using seeded noise tied to the map tile — so decorations are stable across sessions but never from real data
- Artifact spawning uses road intersection nodes and road proximity only — no park or building data involved

---

## Tech Stack

| Concern | Choice | Reason |
|---|---|---|
| Renderer | **Pixi.js v8** | WebGL-accelerated 2D, excellent for flat poly rendering |
| Language | **TypeScript** | Type safety for game state, map data structures |
| Bundler | **Vite** | Fast HMR, zero config TS support |
| Map Data | **Overpass API (OSM)** | Roads + POI nodes only |
| Noise/Decoration | **simplex-noise** | Seeded decoration generation for stable visual terrain |
| Physics | **Custom** (~150 lines) | Simple top-down hovercraft; no need for a full lib |
| Geo Math | **Turf.js** | Distance, buffer, point-on-road calculations |
| State | **Vanilla JS store** | No framework overhead needed |

---

## Architecture Overview

```
src/
├── main.ts                  # Entry point, Pixi app init, screen manager
├── screens/
│   ├── StartScreen.ts       # Cinematic intro + start button
│   └── GameScreen.ts        # Main game container
├── game/
│   ├── Game.ts              # Main game loop, state machine
│   ├── World.ts             # Road graph, artifact registry, radius state
│   ├── Hovercraft.ts        # Player physics + input
│   ├── DayNight.ts          # Palette system, time progression
│   ├── Radius.ts            # Boundary logic, glow ring, push-back force
│   └── Artifacts.ts         # Artifact spawning, collection logic
├── map/
│   ├── OSMFetcher.ts        # Overpass API calls (roads only), caching
│   ├── GeoParser.ts         # GeoJSON → Pixi polygon conversion
│   ├── MapRenderer.ts       # Road layer rendering
│   └── DecorationLayer.ts   # Procedural visual decoration (no OSM data)
├── ui/
│   ├── HUD.ts               # Artifact counter, points display, sun/moon
│   ├── BoundaryRing.ts      # Glowing radius boundary with label
│   ├── ToastManager.ts      # Event notification toasts
│   └── Joystick.ts          # Mobile touch input
└── config/
    ├── palettes.ts           # Day/night color palette definitions
    └── constants.ts          # Radius steps, artifact thresholds, speeds
```

---

## Phase-by-Phase Implementation Plan

### Phase 0 — Start Screen
**Goal:** The game begins with a cinematic moment, not a blank canvas.

Implement `StartScreen.ts` as a standalone Pixi scene:

1. **Background:** Full-screen gradient sky matching the DAWN palette — soft coral to pale gold
2. **Silhouette animation:** 4–6 simple dark silhouette shapes (a hovercraft, a few abstract road curves, a flower, a floating gem) drift slowly across the screen from right to left at different depths and speeds — parallax layering at 3 depths
3. **Title text:** `DRIFTWORLD` rendered in a tall, elegant serif or geometric sans font, centered, fading in with a slow opacity tween after 1.2s
4. **Tagline:** `"drift. collect. explore."` in small caps below the title, delayed 0.3s after title
5. **Start button:** A minimal pill-shaped button — `BEGIN` — appears 0.8s after tagline. On hover: subtle glow. On click: transition animation
6. **Transition out:** On `BEGIN` click — sky brightens to white, silhouettes fade, screen dissolves into the game world zooming in from high altitude
7. The `ScreenManager` in `main.ts` handles the swap between `StartScreen` → `GameScreen`

**Visual reference:** Alto's Odyssey title screen — dark, moving silhouettes against a gradient sky, elegant minimal typography.

**Deliverable:** A beautiful cinematic first impression before the player touches anything.

---

### Phase 1 — Scaffolding & Road Rendering
**Goal:** See real roads rendered as the clean primary game surface.

1. Init Vite + TypeScript project, install Pixi.js v8, Turf.js, simplex-noise
2. Write `OSMFetcher.ts`:
   - Query Overpass API for **roads only** (`highway=*`) and amenity nodes within a bounding box
   - Cache raw response in `sessionStorage` keyed by bbox hash
   - No water, park, or building queries
3. Write `GeoParser.ts`:
   - Convert OSM way coordinates (lat/lng) → screen pixels via Mercator projection helper
   - Output typed `RoadSegment[]` with highway tag preserved (for width/color variation)
4. Write `MapRenderer.ts`:
   - Background fill layer (sky color from current palette)
   - Road layer: `Pixi.Graphics` polylines, width varies by highway type:
     - `motorway/trunk` → 10px
     - `primary/secondary` → 7px
     - `residential/tertiary` → 4px
     - `footway/path` → 1.5px, dashed
5. Write `DecorationLayer.ts`:
   - Uses simplex noise seeded by tile coordinates to place:
     - Soft organic blob shapes (fields, vegetation patches) as light filled polygons
     - Angular clustered rectangles (building footprints) as slightly darker fills
     - Wavy irregular polygons (water-like areas) near low-elevation noise zones
   - All shapes are purely visual — rendered below the road layer, never interacted with
   - Decoration colors are driven entirely by the current day/night palette

**Deliverable:** Real roads over algorithmically decorated terrain — looks like a stylized map, roads clearly dominant.

---

### Phase 2 — Hovercraft Physics & Input
**Goal:** A gliding hovercraft that feels satisfying to control.

1. Write `Hovercraft.ts` with state: `{ x, y, vx, vy, angle, angularVel }`
2. Physics tick (called each frame):
   ```
   angularVel += input.turn * TURN_FORCE
   angularVel *= ANGULAR_DRAG          // ~0.88
   angle += angularVel

   thrust = input.forward ? THRUST : 0
   vx += cos(angle) * thrust
   vy += sin(angle) * thrust
   vx *= LINEAR_DRAG                   // ~0.96
   vy *= LINEAR_DRAG
   x += vx; y += vy
   ```
3. Render as a small teardrop / ellipse Pixi shape with a soft drop shadow
4. Camera follows hovercraft with lerp smoothing
5. Write `Joystick.ts` for mobile touch; keyboard WASD/arrows for desktop

**Note:** Hovercraft moves freely — it is not road-snapped. Roads are visual guides, not rails. The player drifts over them naturally.

**Deliverable:** Hovercraft glides over the map with pleasant drift physics.

---

### Phase 3 — Day/Night Palette Cycle
**Goal:** The world breathes with shifting light — the heart of the Alto aesthetic.

1. Define 4 palette snapshots in `palettes.ts`:
   ```ts
   type Palette = {
     sky: string           // background + start screen sky
     roadPrimary: string   // major roads
     roadSecondary: string // minor roads
     decoration: string    // base tint for decorative elements
     ambient: number       // global Pixi tint (0xRRGGBB)
     fogColor: string      // boundary fog/darkness color
   }

   export const DAWN:  Palette = { sky: '#f4a97f', roadPrimary: '#fff5e6', ... }
   export const NOON:  Palette = { sky: '#dff0f7', roadPrimary: '#ffffff',  ... }
   export const DUSK:  Palette = { sky: '#2d1b4e', roadPrimary: '#f0c4a0', ... }
   export const NIGHT: Palette = { sky: '#0a0e1a', roadPrimary: '#c8d8ff', ... }
   ```
2. `DayNight.ts` maintains a `timeOfDay` (0–1, full cycle over ~10 real minutes)
3. Each frame, lerp all palette values between the two adjacent phases
4. Apply to road layer, decoration layer, background, boundary ring, and HUD tint
5. Subtle sun/moon arc drawn in HUD

**Deliverable:** World transitions through beautiful atmospheric palettes automatically.

---

### Phase 4 — Glowing Radius Boundary
**Goal:** The limit of the world is visible, beautiful, and communicative — not a hard wall.

Implement `BoundaryRing.ts`:

1. `Radius.ts` tracks `explorationRadius` in meters (starts ~300m), converted to screen pixels
2. Draw the boundary as a **glowing ring** on each frame:
   - Outer soft fog: a radial gradient overlay from transparent (inside) to `palette.fogColor` (outside), covering the full screen
   - The ring itself: a circle stroke at exactly `explorationRadius` with:
     - Base color: warm golden-white (`#ffe8a0`) at ~60% opacity
     - Animated outer glow: a wider, lower-opacity stroke pulsing with a sine wave (period ~2s)
     - The glow color shifts with the day/night palette (warmer at dawn/dusk, cooler at night)
3. At intervals along the ring (every ~80px of arc), render a small **label chip**:
   - A pill-shaped tag reading `"EXPLORE MORE →"` or `"COLLECT TO EXPAND"`
   - Only 1–2 visible at a time, positioned nearest to the player's current heading
   - Fade in when player is within 120px of the ring; fade out otherwise
4. **Hard boundary enforcement:** when hovercraft reaches the ring edge:
   - Apply an opposing force proportional to penetration depth (soft spring push-back)
   - The ring flashes briefly bright white on contact
   - Hovercraft velocity component toward boundary is dampened to zero
5. Beyond the ring: roads are visible as faint ghost lines (15% opacity) to tease what's out there
6. On unlock: ring expands with a ripple animation outward, label briefly reads `"AREA EXPANDED!"`, then returns to `"COLLECT TO EXPAND"`

**Thresholds (in `constants.ts`):**
```ts
export const RADIUS_STEPS = [
  { artifacts: 0,  radius: 300  },
  { artifacts: 5,  radius: 500  },
  { artifacts: 12, radius: 800  },
  { artifacts: 22, radius: 1200 },
  { artifacts: 35, radius: 2000 },
]
```

**Deliverable:** The boundary feels alive — a glowing horizon, not a brick wall. Players always know what it is and how to push past it.

---

### Phase 5 — Artifacts & Toast Notifications
**Goal:** Collecting artifacts feels tactile and the world acknowledges every action.

**Artifact system (`Artifacts.ts`):**
1. Spawn artifacts near road intersections (high-connectivity OSM nodes) and road midpoints
2. Two types:
   - **Gems** → near intersections, shimmer with alpha pulse and a subtle rotate
   - **Flowers** → along quieter roads, petals gently animate open/closed
3. Collection trigger: hovercraft within 20px → collect animation (scale up + fade out in 0.3s) → points + artifact count increment
4. After collection, check radius thresholds and trigger expansion if met
5. New artifacts spawn just inside the newly expanded radius area on unlock

**Toast notification system (`ToastManager.ts`):**

All game events emit a toast — a small animated notification chip that slides in from the top-right, holds for 2s, then fades out. Multiple toasts stack vertically with 8px gap.

| Event | Toast text | Icon |
|---|---|---|
| Gem collected | `+10 pts — Gem found!` | 💎 |
| Flower collected | `+5 pts — Flower!` | 🌸 |
| Rare artifact | `+50 pts — Rare find!` | ✨ |
| Area expanded | `🌍 Area expanded! New roads unlocked` | — |
| New zone | `You've reached [zone name]` | — |
| Near boundary | `Collect more to expand your world` | — |

Toast visual style: pill-shaped, semi-transparent, uses current palette accent color. Entrance animation: slide in from right + fade. Exit: fade only.

**Deliverable:** Every meaningful moment is acknowledged; collection feels rewarding and legible.

---

### Phase 6 — HUD
**Goal:** Minimal but always informative.

`HUD.ts` renders a fixed overlay (HTML/CSS layer above the Pixi canvas, or a dedicated Pixi container):

- **Top-left:** artifact count `◆ 12` and current points `✦ 340 pts`
- **Top-center:** day/night indicator — a small arc showing sun or moon position along a horizon line
- **Top-right:** toast stack (managed by `ToastManager.ts`)
- **Bottom-left:** mobile joystick (when touch detected)
- No health bars, no timers, no maps — only what the player needs to feel oriented

---

### Phase 7 — Multi-Map / Region Expansion
**Goal:** Crossing into a new region loads fresh OSM data seamlessly.

1. Divide world into ~500m × 500m road tiles keyed by grid coordinates
2. When player moves within 150m of tile edge, pre-fetch adjacent tile's roads in background
3. New road data merged into `World.ts`; decoration layer regenerates for new tiles using seeded noise
4. Tile seams hidden by road continuity
5. Only tiles within `explorationRadius` rendered; distant tiles cached but invisible

**Deliverable:** Infinite real-world road exploration as radius grows.

---

### Phase 8 — Polish & Atmosphere
**Goal:** Make it feel like a piece of art, not just a game.

- [ ] Particle effects: small dust puffs behind hovercraft
- [ ] Hovercraft casts a soft shadow ellipse below it
- [ ] Sound: ambient generative drone shifting pitch with time-of-day (Web Audio API)
- [ ] Smooth camera shake on radius expansion
- [ ] Start screen: camera zooms in from high altitude as the `BEGIN` transition completes
- [ ] Settings panel (accessible from HUD): choose starting city via Nominatim geocoding
- [ ] Decoration layer: rare animated elements (a spinning windmill shape, a blinking tower light at night) generated by seeded noise at low frequency

---

## Key Design Constraints

- **Roads are real. Everything else is invented.** Only highway data comes from OSM.
- **No enemies. No timers. No failure state.** Pure exploration.
- **The boundary ring is a character.** It communicates, glows, pushes back gently, and celebrates when broken.
- **Every event gets a toast.** The player is never left wondering what just happened.
- **The start screen sets the tone.** First impression is cinematic, not functional.
- **Palette is the mood.** Every visual element defers to the current time-of-day palette.
- **The hovercraft is a camera.** Its movement is the primary UI — it should always feel delightful.

---

## Artifact Count → Emotional Pacing

| Stage | Radius | Feeling |
|---|---|---|
| 0–5 artifacts | 300m | Intimate. You know every road. |
| 5–12 | 500m | Neighbourhood. Familiar but stretching. |
| 12–22 | 800m | Town-scale. Real landmarks appear. |
| 22–35 | 1200m | City quarter. You're truly exploring. |
| 35+ | 2000m+ | Open. The world feels endless. |

---

## OSM Overpass Query (Roads + POI nodes only)

```
[out:json][timeout:25];
(
  way["highway"]({{bbox}});
  node["amenity"]({{bbox}});
);
out body;
>;
out skel qt;
```

No building, water, or park queries. Decorations are generated, not fetched.

---

## Suggested First Prompt to LLM

> "Implement Phase 0 and Phase 1 of Driftworld. Use Vite + TypeScript + Pixi.js v8. Phase 0: Build a `StartScreen` class with a DAWN gradient sky (`#f4a97f` → `#ffd580`), 5 drifting dark silhouette shapes (hovercraft ellipse, two road curve lines, a small gem diamond, a flower circle) animating slowly from right to left at 3 parallax depths. After 1.2s fade in the title `DRIFTWORLD` (large, centered, elegant font). After 2s show a `BEGIN` pill button. On click, fade to white and call `onStart()`. Phase 1: After transition, hardcode start to Dhaka, Bangladesh (lat: 23.8103, lng: 90.4125). Fetch only `highway=*` ways from Overpass API, cache in sessionStorage, render as polylines on a Pixi canvas (road widths by highway type). Below roads, use simplex-noise seeded by tile coords to draw soft decoration blobs (fields, buildings) in muted palette colors. Use DAWN palette: sky `#f4a97f`, roads `#fff5e6`, decorations `#e8c9a0`."

---

*Build phase by phase. Phase 0 exists so the very first thing anyone sees is beautiful. Phase 1 exists so roads feel like the soul of the world. Everything else follows from those two truths.*
