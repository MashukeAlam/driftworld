/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Decoration Layer
   
   Procedurally generates decorative terrain elements
   using seeded simplex noise. No OSM data involved.
   All shapes are purely visual atmosphere:
   - Soft organic blobs (vegetation/fields)
   - Angular clusters (buildings)
   - Wavy irregular shapes (water-like areas)
   ═══════════════════════════════════════════════════════ */

import { Container, Graphics } from 'pixi.js';
import { createNoise2D } from 'simplex-noise';
import type { Palette } from '../config/palettes';

// Seeded PRNG for deterministic decoration placement
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DecorationShape {
  x: number;
  y: number;
  type: 'vegetation' | 'building' | 'water';
  scale: number;
  rotation: number;
  seed: number;
}

export class DecorationLayer extends Container {
  private decorationGraphics: Graphics;
  private shapes: DecorationShape[] = [];
  private currentPalette: Palette | null = null;
  private noise2D: (x: number, y: number) => number;
  private generated = false;

  constructor() {
    super();
    this.decorationGraphics = new Graphics();
    this.addChild(this.decorationGraphics);
    this.noise2D = createNoise2D();
  }

  /**
   * Generate decorations for a given area.
   * Uses seeded noise so decorations are deterministic per area.
   */
  generate(centerX: number, centerY: number, radiusPixels: number) {
    this.shapes = [];
    const tileSize = 80; // Grid cell size for decoration placement
    const extent = radiusPixels + 200; // Generate slightly beyond visible area

    const startX = centerX - extent;
    const startY = centerY - extent;
    const endX = centerX + extent;
    const endY = centerY + extent;

    for (let x = startX; x < endX; x += tileSize) {
      for (let y = startY; y < endY; y += tileSize) {
        // Use noise to determine if this cell gets a decoration
        const n = this.noise2D(x * 0.003, y * 0.003);
        const n2 = this.noise2D(x * 0.008 + 100, y * 0.008 + 100);

        if (n > 0.1) {
          // Determine type based on secondary noise
          let type: DecorationShape['type'];
          if (n2 > 0.3) {
            type = 'vegetation';
          } else if (n2 > -0.1) {
            type = 'building';
          } else {
            type = 'water';
          }

          // Seeded random for this cell
          const cellSeed = Math.abs(Math.floor(x * 7919 + y * 104729));
          const rng = mulberry32(cellSeed);

          this.shapes.push({
            x: x + (rng() - 0.5) * tileSize * 0.8,
            y: y + (rng() - 0.5) * tileSize * 0.8,
            type,
            scale: 0.5 + rng() * 1.5,
            rotation: rng() * Math.PI * 2,
            seed: cellSeed,
          });
        }
      }
    }

    this.generated = true;
    this.redraw();
  }

  updatePalette(palette: Palette) {
    this.currentPalette = palette;
    if (this.generated) {
      this.redraw();
    }
  }

  private redraw() {
    if (!this.currentPalette) return;
    this.decorationGraphics.clear();

    const p = this.currentPalette;

    for (const shape of this.shapes) {
      const rng = mulberry32(shape.seed);
      // Consume first values to match generation
      rng(); rng();

      switch (shape.type) {
        case 'vegetation':
          this.drawVegetation(shape, p.decoration, rng);
          break;
        case 'building':
          this.drawBuilding(shape, p.decorationAlt, rng);
          break;
        case 'water':
          this.drawWater(shape, p.waterTint, rng);
          break;
      }
    }
  }

  private drawVegetation(
    shape: DecorationShape, color: number, rng: () => number
  ) {
    const g = this.decorationGraphics;
    const s = shape.scale * 25;
    const cx = shape.x;
    const cy = shape.y;

    // Soft organic blob — use overlapping circles
    const numCircles = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < numCircles; i++) {
      const angle = rng() * Math.PI * 2;
      const dist = rng() * s * 0.5;
      const radius = s * (0.3 + rng() * 0.5);
      g.circle(
        cx + Math.cos(angle) * dist,
        cy + Math.sin(angle) * dist,
        radius
      );
      g.fill({ color, alpha: 0.15 + rng() * 0.1 });
    }
  }

  private drawBuilding(
    shape: DecorationShape, color: number, rng: () => number
  ) {
    const g = this.decorationGraphics;
    const s = shape.scale * 18;

    // Angular rectangles clustered together
    const numRects = 1 + Math.floor(rng() * 3);
    for (let i = 0; i < numRects; i++) {
      const w = s * (0.4 + rng() * 0.8);
      const h = s * (0.4 + rng() * 0.8);
      const offsetX = (rng() - 0.5) * s * 0.5;
      const offsetY = (rng() - 0.5) * s * 0.5;

      g.rect(
        shape.x + offsetX - w / 2,
        shape.y + offsetY - h / 2,
        w,
        h,
      );
      g.fill({ color, alpha: 0.18 + rng() * 0.08 });
    }
  }

  private drawWater(
    shape: DecorationShape, color: number, rng: () => number
  ) {
    const g = this.decorationGraphics;
    const s = shape.scale * 30;
    const cx = shape.x;
    const cy = shape.y;

    // Wavy irregular polygon
    const numPoints = 6 + Math.floor(rng() * 4);
    const points: number[] = [];
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const r = s * (0.5 + rng() * 0.5);
      points.push(cx + Math.cos(angle) * r);
      points.push(cy + Math.sin(angle) * r);
    }

    g.poly(points);
    g.fill({ color, alpha: 0.12 + rng() * 0.08 });
  }
}
