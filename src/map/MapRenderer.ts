/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Map Renderer
   
   Renders OSM road data as styled polylines on a
   Pixi.js Graphics layer. Road widths and colors
   vary by highway classification.
   ═══════════════════════════════════════════════════════ */

import { Container, Graphics } from 'pixi.js';
import type { RoadSegment } from './GeoParser';
import type { Palette } from '../config/palettes';
import { ROAD_WIDTHS } from '../config/constants';

export class MapRenderer extends Container {
  private roadGraphics: Graphics;
  private roadOutlineGraphics: Graphics;
  private ghostRoadGraphics: Graphics;
  private segments: RoadSegment[] = [];
  private currentPalette: Palette | null = null;
  private explorationRadius = 0;
  private centerX = 0;
  private centerY = 0;

  constructor() {
    super();
    this.roadOutlineGraphics = new Graphics();
    this.roadGraphics = new Graphics();
    this.ghostRoadGraphics = new Graphics();
    this.ghostRoadGraphics.alpha = 0.12;

    this.addChild(this.ghostRoadGraphics);
    this.addChild(this.roadOutlineGraphics);
    this.addChild(this.roadGraphics);
  }

  setRoads(segments: RoadSegment[]) {
    this.segments = segments;
    this.redraw();
  }

  setExplorationBounds(centerX: number, centerY: number, radiusPixels: number) {
    this.centerX = centerX;
    this.centerY = centerY;
    this.explorationRadius = radiusPixels;
    this.redraw();
  }

  updatePalette(palette: Palette) {
    this.currentPalette = palette;
    this.redraw();
  }

  private redraw() {
    if (!this.currentPalette) return;

    this.roadGraphics.clear();
    this.roadOutlineGraphics.clear();
    this.ghostRoadGraphics.clear();

    const palette = this.currentPalette;

    for (const segment of this.segments) {
      const width = ROAD_WIDTHS[segment.highway] || ROAD_WIDTHS.default;
      const isPrimary = ['motorway', 'trunk', 'primary', 'secondary'].includes(segment.highway);
      const isFootway = ['footway', 'path', 'cycleway'].includes(segment.highway);
      const color = isPrimary ? palette.roadPrimary : palette.roadSecondary;
      const outlineColor = palette.roadOutline;

      // Determine if any part of the road is within exploration radius
      const withinRadius = this.isSegmentInRadius(segment);
      const target = withinRadius ? this.roadGraphics : this.ghostRoadGraphics;
      const outlineTarget = withinRadius ? this.roadOutlineGraphics : null;

      if (segment.points.length < 2) continue;

      // Outline drawing removed per user request

      // Draw road
      target.moveTo(segment.points[0].x, segment.points[0].y);
      for (let i = 1; i < segment.points.length; i++) {
        target.lineTo(segment.points[i].x, segment.points[i].y);
      }

      target.stroke({
        width,
        color,
        alpha: withinRadius ? 1.0 : 0.5,
        cap: 'round',
        join: 'round',
      });

      // Dashed style for footways (simulated with shorter segments)
      // Pixi v8 doesn't have native dash — we keep them as solid thin lines
    }
  }

  private isSegmentInRadius(segment: RoadSegment): boolean {
    if (this.explorationRadius <= 0) return true;
    const r2 = this.explorationRadius * this.explorationRadius;

    for (const p of segment.points) {
      const dx = p.x - this.centerX;
      const dy = p.y - this.centerY;
      if (dx * dx + dy * dy <= r2) {
        return true;
      }
    }
    return false;
  }
}
