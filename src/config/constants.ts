/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Game Constants
   ═══════════════════════════════════════════════════════ */

// ─── Starting Location (Dhaka, Bangladesh) ───
export const START_LAT = 23.8103;
export const START_LNG = 90.4125;

// ─── Radius Expansion Thresholds ───
export interface RadiusStep {
  artifacts: number;
  radius: number; // in meters
}

export const RADIUS_STEPS: RadiusStep[] = [
  { artifacts: 0,  radius: 300  },
  { artifacts: 5,  radius: 500  },
  { artifacts: 12, radius: 800  },
  { artifacts: 22, radius: 1200 },
  { artifacts: 35, radius: 2000 },
];

// ─── Map / Projection ───
export const PIXELS_PER_METER = 3;       // Scale factor for Mercator → pixel
export const TILE_SIZE_METERS = 500;     // OSM tile grid size
export const PREFETCH_DISTANCE = 150;    // Pre-fetch adjacent tiles at this distance (m)

// ─── Hovercraft Physics ───
export const THRUST_FORCE = 0.12;
export const LINEAR_DRAG = 0.965;
export const TURN_FORCE = 0.0035;
export const ANGULAR_DRAG = 0.88;
export const MAX_SPEED = 5;

// ─── Boundary ───
export const BOUNDARY_PUSH_FORCE = 0.3;
export const BOUNDARY_LABEL_DISTANCE = 120; // px — show labels when within this distance

// ─── Artifacts ───
export const GEM_POINTS = 20;
export const FLOWER_POINTS = 10;
export const RARE_POINTS = 50;
export const COLLECT_RADIUS = 22;  // px
export const ARTIFACT_DENSITY = 0.4; // artifacts per road intersection

// ─── Day/Night Cycle ───
export const DAY_CYCLE_DURATION = 180; // seconds for full day cycle (~3 real minutes)

// ─── Overpass API ───
export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const OVERPASS_TIMEOUT = 25;

// ─── Camera ───
export const CAMERA_LERP = 0.08;

// ─── Road widths by highway type (in pixels) ───
export const ROAD_WIDTHS: Record<string, number> = {
  motorway: 22,
  trunk: 20,
  primary: 16,
  secondary: 14,
  tertiary: 11,
  residential: 9,
  unclassified: 9,
  service: 7,
  footway: 4,
  path: 4,
  cycleway: 5,
  pedestrian: 7,
  living_street: 8,
  default: 7,
};
