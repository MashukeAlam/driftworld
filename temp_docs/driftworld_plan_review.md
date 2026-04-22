# 🔍 Driftworld — Plan Review

## Overall Impression

This is an **exceptionally well-written** game design document. The vision is clear, the phasing is logical, the technical choices are sound, and the emotional pacing table at the end shows genuine design thinking. A few areas deserve attention before implementation begins.

---

## ✅ Strengths

| Area | Notes |
|---|---|
| **Vision clarity** | "Roads are the only real gameplay ingredient" — this single sentence prevents scope creep. Every decision flows from it. |
| **Phase ordering** | Starting with the start screen (Phase 0) before gameplay is a bold, correct call. First impressions anchor the player's emotional expectations. |
| **Tech stack** | Pixi.js v8 + Vite + TypeScript is the right combination — no over-engineering, no under-building. Custom physics for ~150 lines is appropriate for a top-down hovercraft. |
| **Decoration strategy** | Generating visuals with seeded simplex noise instead of fetching from OSM is a smart architectural decision: smaller queries, faster load, deterministic visuals. |
| **Boundary ring design** | Treating the boundary as a "character" with labels, glow, push-back, and celebration animations is excellent UX design. |
| **Emotional pacing table** | Mapping artifact counts to emotional stages (intimate → open) shows mature game design thinking. |

---

## ⚠️ Issues & Risks

### 1. Overpass API Rate Limiting & Reliability

> [!WARNING]
> The plan has no fallback strategy if the Overpass API is slow, rate-limited, or down. Public Overpass endpoints enforce rate limits and can timeout during peak load.

**Recommendations:**
- Add a retry/backoff strategy in `OSMFetcher.ts`
- Consider bundling a small default dataset (e.g., a few tiles around Dhaka) as a hardcoded fallback so the game is always playable
- Consider using a third-party Overpass mirror or self-hosted instance for production

---

### 2. `sessionStorage` Caching is Fragile

> [!NOTE]
> `sessionStorage` is cleared on tab close and has a ~5MB limit per origin. A single dense urban area could produce a large road JSON response.

**Recommendations:**
- Switch to `localStorage` or **IndexedDB** for persistence across sessions
- Implement cache eviction (LRU by tile) to stay within storage limits
- Compress cached data with a lightweight codec (e.g., LZ-string)

---

### 3. Coordinate Projection (Mercator) at Scale

The plan mentions a "Mercator projection helper" but doesn't address the **non-linear distortion** problem. At small radii (300m–2000m) this is manageable, but:

- The plan includes Phase 7 (multi-region / infinite exploration) — at that scale, naive equirectangular math breaks visibly
- Turf.js uses WGS84 geodesic calculations, but Pixi renders in pixel space — the bridge between them needs explicit handling

**Recommendation:** Define a `GeoProjection` utility early (Phase 1) that handles lat/lng ↔ pixel conversion with a chosen projection center, and route all coordinate math through it.

---

### 4. Mobile Performance Concerns

> [!IMPORTANT]
> The plan targets mobile (touch joystick), but multiple simultaneous Pixi.Graphics redraws — road layer, decoration layer, boundary ring glow, particles — could be expensive on mid-range phones.

**Recommendations:**
- Render roads and decorations to `RenderTexture` and only re-render when tiles change or palette shifts
- Decoration layer should have a quality toggle (fewer blobs on mobile)
- Consider sprite batching for artifacts instead of individual Graphics objects

---

### 5. Phase 7 (Multi-Map) Is Under-specified

Phase 7 describes tile-based region loading in 3 sentences. This is actually one of the hardest engineering problems in the plan:

- **Tile seam handling**: roads that span two tiles need to be stitched
- **Concurrent fetches**: what happens if the player moves fast and triggers multiple pre-fetches?
- **Memory management**: keeping all tiles in memory will eventually crash the tab
- **Decoration continuity**: seeded noise must produce identical values at tile borders

**Recommendation:** Expand Phase 7 into a sub-plan before implementation reaches it. Consider a chunked world manager with load/unload lifecycle.

---

### 6. Missing: Save / Persistence System

> [!IMPORTANT]
> There is no mention of saving player progress (artifacts collected, radius unlocked, position). If the player closes the tab, all progress is lost.

**Recommendation:** Add a `SaveManager.ts` to the architecture that persists game state to `localStorage` or IndexedDB. Auto-save on artifact collection and radius expansion. Load on game start.

---

### 7. Missing: Error / Loading UX

The plan has no mention of:
- What the player sees while OSM data is loading (could be several seconds on slow connections)
- What happens if the fetch fails
- What the player sees if geolocation is denied (Phase 8 mentions a city picker, but Phases 0–7 hardcode Dhaka)

**Recommendation:** Add a loading state between the start screen transition and gameplay — a brief "Mapping the world..." animation that holds until road data is ready.

---

### 8. Artifact Spawning Could Feel Static

Artifacts spawn near road intersections and midpoints — but the plan doesn't describe **respawning** or a spawn budget. If a player collects all 35 artifacts and the radius is maxed, is the game over?

**Recommendation:** Define a spawn lifecycle:
- Artifacts respawn in newly unlocked areas
- Rare artifacts spawn on a timer in already-explored zones
- Consider a "discovery journal" or collectible catalog to give long-term engagement

---

### 9. HUD Implementation Choice

> [!NOTE]
> Line 265: *"HTML/CSS layer above the Pixi canvas, **or** a dedicated Pixi container"* — this should be decided upfront.

**Recommendation:** Use an **HTML/CSS overlay** for the HUD. It's simpler to style, accessible, and doesn't consume the WebGL draw budget. Reserve Pixi containers for in-world UI only (boundary labels, toast stack if it needs world-space positioning).

---

### 10. Sound Design (Phase 8)

The plan mentions "ambient generative drone" but categorizes it as polish. Sound dramatically affects the meditative tone the game aims for.

**Recommendation:** Move basic ambient sound to Phase 3 (alongside palette cycle) — even a simple low-pass filtered noise drone that shifts pitch with the palette would enormously boost the atmosphere.

---

## 🧩 Minor Suggestions

| Item | Suggestion |
|---|---|
| **Font choice** | The plan says "tall, elegant serif or geometric sans" — pick one. Recommendation: **Outfit** (Google Fonts) for a clean geometric look that matches the minimal aesthetic. |
| **Artifact point values** | Gems = 10, Flowers = 5, Rare = 50 — consider whether these values are balanced against the radius thresholds. 35 artifacts × average ~8 pts = 280 pts. What does the points number *mean* to the player? |
| **Zone names** | The toast `"You've reached [zone name]"` — where do zone names come from? The plan doesn't fetch place names from OSM. Either add `place=*` to the Overpass query, or generate poetic procedural names. |
| **Overpass query** | The query fetches `node["amenity"]` but the plan never explains how amenity data is used. If it's for "artifact context," define what that means or remove the query to keep things clean. |
| **Start screen silhouettes** | 4–6 shapes at 3 depths — define whether these are procedurally generated or pre-drawn SVG paths. SVG paths imported as Pixi graphics would look sharper. |

---

## 📋 Recommended Phase Adjustments

```diff
  Phase 0 — Start Screen               ✓ (no changes)
  Phase 1 — Scaffolding & Road Rendering ✓ (add GeoProjection utility)
  Phase 2 — Hovercraft Physics & Input   ✓ (no changes)
- Phase 3 — Day/Night Palette Cycle
+ Phase 3 — Day/Night Palette Cycle + Basic Ambient Sound
  Phase 4 — Glowing Radius Boundary      ✓ (no changes)
  Phase 5 — Artifacts & Toasts           ✓ (add respawn lifecycle)
  Phase 6 — HUD                          ✓ (commit to HTML/CSS overlay)
+ Phase 6.5 — Save/Load System (NEW)
  Phase 7 — Multi-Map / Region Expansion  ✓ (needs sub-plan expansion)
  Phase 8 — Polish & Atmosphere           ✓ (no changes)
```

---

## Verdict

> [!TIP]
> **This plan is ready for implementation with the adjustments above.** The core design is strong, the phasing is logical, and the vision is compelling. The main risks are around network reliability (Overpass API), mobile performance, and the under-specified Phase 7. Address the persistence gap (save system) and loading UX before shipping, and this will be a genuinely beautiful project.

*The hardcoded starting location of Dhaka is a nice touch — building for a specific place first will keep the visuals grounded during development.*
