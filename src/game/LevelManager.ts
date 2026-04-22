/* DRIFTWORLD — Level Manager
   Handles home location, level progression, spawn placement, and win detection. */

export interface LevelState {
  level: number;
  homeLat: number;
  homeLng: number;
  homeLabel: string;
  carColor: number;
  lastTimeOfDay?: number;
}

// Car colors per level — cycling through these (muted/pastel to match aesthetics)
export const LEVEL_COLORS: number[] = [
  0x9CB380, // Level 1: Muted lime
  0x7CA9B4, // Level 2: Muted cyan
  0xC18C6A, // Level 3: Muted orange
  0xB87C9E, // Level 4: Muted pink
  0xCFB770, // Level 5: Muted gold
  0x8BB097, // Level 6: Muted mint
  0x9D8EAF, // Level 7: Muted purple
  0xBB8275, // Level 8: Muted coral
  0x80B3B3, // Level 9: Muted turquoise
  0xB57B89, // Level 10: Muted rose
];

const SAVE_KEY = 'dw_level_state';

/**
 * Calculate spawn distance from home based on level.
 * Level 1: needs 3 radius expansions (starts ~800m away, must reach 800m radius)
 * Level 2: needs 4 expansions  
 * Level 3: needs 5 expansions, etc.
 */
export function getSpawnDistanceMeters(level: number): number {
  // Radius steps: 300, 500, 800, 1200, 2000
  // Level 1: spawn at ~800m (need 3rd expansion: 800m radius)
  // Level 2: spawn at ~1200m (need 4th expansion)
  // Level 3: spawn at ~2000m (need 5th expansion)
  const distances = [750, 1100, 1800, 2500, 3500];
  const idx = Math.min(level - 1, distances.length - 1);
  return distances[idx];
}

/**
 * Calculate the required radius to reach home.
 */
export function getRequiredRadius(level: number): number {
  const radii = [800, 1200, 2000, 2000, 2000];
  const idx = Math.min(level - 1, radii.length - 1);
  return radii[idx];
}

/**
 * Get the car color for a given level.
 */
export function getCarColor(level: number): number {
  return LEVEL_COLORS[(level - 1) % LEVEL_COLORS.length];
}

/**
 * Calculate spawn position: offset from home in a random direction.
 */
export function calculateSpawnPosition(
  homeLat: number, homeLng: number, distanceMeters: number
): { lat: number; lng: number } {
  const angle = Math.random() * Math.PI * 2;
  const latOffset = (Math.cos(angle) * distanceMeters) / 111320;
  const lngOffset = (Math.sin(angle) * distanceMeters) /
    (111320 * Math.cos(homeLat * Math.PI / 180));
  return {
    lat: homeLat + latOffset,
    lng: homeLng + lngOffset,
  };
}

/**
 * Save level state to localStorage.
 */
export function saveLevelState(state: LevelState) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

/**
 * Load level state from localStorage.
 */
export function loadLevelState(): LevelState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LevelState;
  } catch {
    return null;
  }
}

/**
 * Check if player has reached home.
 */
export function checkWin(
  playerPixelX: number, playerPixelY: number,
  homePixelX: number, homePixelY: number,
  thresholdPixels: number
): boolean {
  const dx = playerPixelX - homePixelX;
  const dy = playerPixelY - homePixelY;
  return Math.sqrt(dx * dx + dy * dy) < thresholdPixels;
}
