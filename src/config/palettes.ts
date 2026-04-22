/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Color Palettes (Day/Night Cycle)
   
   Each palette defines the full color state of the world
   at a given time of day. The DayNight system lerps
   between adjacent palettes for smooth transitions.
   ═══════════════════════════════════════════════════════ */

export interface Palette {
  sky: number;            // Background fill
  skyGradientEnd: number; // Bottom of sky gradient
  roadPrimary: number;    // Major roads (motorway, trunk, primary)
  roadSecondary: number;  // Minor roads (residential, footway)
  roadOutline: number;    // Thin outline under roads for depth
  decoration: number;     // Base tint for procedural decorations
  decorationAlt: number;  // Secondary decoration color (buildings)
  waterTint: number;      // Water-like decoration tint
  ambient: number;        // Global scene tint
  fogColor: number;       // Beyond-boundary fog
  particleColor: number;  // Dust / sparkle particles
  glowColor: number;      // Boundary ring glow
  textColor: number;      // HUD text color
}

export const DAWN: Palette = {
  sky: 0xF4A97F,
  skyGradientEnd: 0xFFD580,
  roadPrimary: 0xFFEEDD,
  roadSecondary: 0xFFDAC0,
  roadOutline: 0xC08050,
  decoration: 0xDCB888,
  decorationAlt: 0xC49870,
  waterTint: 0xA0C8E0,
  ambient: 0xFFF0E0,
  fogColor: 0xCC8860,
  particleColor: 0xFFE8C0,
  glowColor: 0xFFD080,
  textColor: 0xFFF5E6,
};

export const NOON: Palette = {
  sky: 0xDFF0F7,
  skyGradientEnd: 0xE8F4FA,
  roadPrimary: 0xEBF4FA,
  roadSecondary: 0xDCEAF4,
  roadOutline: 0xB0B8C0,
  decoration: 0xC8E0C0,
  decorationAlt: 0xD0D0D0,
  waterTint: 0x88C8E8,
  ambient: 0xF8FCFF,
  fogColor: 0xA0C8E0,
  particleColor: 0xFFFFE0,
  glowColor: 0xFFE8A0,
  textColor: 0x304050,
};

export const DUSK: Palette = {
  sky: 0x2D1B4E,
  skyGradientEnd: 0x8B3A62,
  roadPrimary: 0xFFD8B0,
  roadSecondary: 0xD0A880,
  roadOutline: 0x905838,
  decoration: 0x503050,
  decorationAlt: 0x403040,
  waterTint: 0x405080,
  ambient: 0xE0A080,
  fogColor: 0x1A0E30,
  particleColor: 0xFFA060,
  glowColor: 0xFF9060,
  textColor: 0xFFE0C0,
};

export const NIGHT: Palette = {
  sky: 0x0A0E1A,
  skyGradientEnd: 0x101828,
  roadPrimary: 0xC8D8FF,
  roadSecondary: 0x6878A0,
  roadOutline: 0x303848,
  decoration: 0x182030,
  decorationAlt: 0x202838,
  waterTint: 0x102040,
  ambient: 0x4060A0,
  fogColor: 0x060810,
  particleColor: 0x80A0FF,
  glowColor: 0x6080FF,
  textColor: 0xC0D0FF,
};

export const PALETTE_SEQUENCE: Palette[] = [DAWN, NOON, DUSK, NIGHT];

/**
 * Linearly interpolate between two colors (as 0xRRGGBB numbers).
 */
export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xFF, ag = (a >> 8) & 0xFF, ab = a & 0xFF;
  const br = (b >> 16) & 0xFF, bg = (b >> 8) & 0xFF, bb = b & 0xFF;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const blue = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | blue;
}

/**
 * Get an interpolated palette for a given time-of-day (0–1).
 */
export function getPalette(timeOfDay: number): Palette {
  const t = ((timeOfDay % 1) + 1) % 1; // Normalize to [0,1)
  const segmentCount = PALETTE_SEQUENCE.length;
  const rawIndex = t * segmentCount;
  const index = Math.floor(rawIndex);
  const frac = rawIndex - index;
  const from = PALETTE_SEQUENCE[index % segmentCount];
  const to = PALETTE_SEQUENCE[(index + 1) % segmentCount];

  const result: Record<string, number> = {};
  for (const key of Object.keys(from)) {
    result[key] = lerpColor(
      (from as unknown as Record<string, number>)[key],
      (to as unknown as Record<string, number>)[key],
      frac
    );
  }
  return result as unknown as Palette;
}

/**
 * Convert a 0xRRGGBB color to a CSS hex string.
 */
export function colorToHex(color: number): string {
  return '#' + color.toString(16).padStart(6, '0');
}

/**
 * Convert a 0xRRGGBB color to CSS rgba string with alpha.
 */
export function colorToRgba(color: number, alpha: number): string {
  const r = (color >> 16) & 0xFF;
  const g = (color >> 8) & 0xFF;
  const b = color & 0xFF;
  return `rgba(${r},${g},${b},${alpha})`;
}
