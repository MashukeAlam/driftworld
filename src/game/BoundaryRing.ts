/* DRIFTWORLD — Boundary Ring */
import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import { BOUNDARY_PUSH_FORCE, BOUNDARY_LABEL_DISTANCE, RADIUS_STEPS } from '../config/constants';
import type { Palette } from '../config/palettes';

export class BoundaryRing extends Container {
  private ringGfx: Graphics;
  private glowGfx: Graphics;
  private fogGfx: Graphics;
  private labelContainer: Container;
  private radiusPixels = 900;
  private currentPalette: Palette | null = null;
  private expandAnimProgress = -1;

  constructor() {
    super();
    this.fogGfx = new Graphics();
    this.glowGfx = new Graphics();
    this.ringGfx = new Graphics();
    this.labelContainer = new Container();
    this.addChild(this.fogGfx);
    this.addChild(this.glowGfx);
    this.addChild(this.ringGfx);
    this.addChild(this.labelContainer);
  }

  setRadius(radiusPixels: number, animate = false) {
    if (animate && this.radiusPixels !== radiusPixels) {
      this.expandAnimProgress = 0;
    }
    this.radiusPixels = radiusPixels;
  }

  getRadiusPixels(): number {
    return this.radiusPixels;
  }

  updatePalette(palette: Palette) {
    this.currentPalette = palette;
  }

  update(elapsed: number, playerX: number, playerY: number, screenW: number, screenH: number) {
    if (!this.currentPalette) return;
    const p = this.currentPalette;
    const r = this.radiusPixels;

    // ─── Expand animation ───
    if (this.expandAnimProgress >= 0) {
      this.expandAnimProgress += 0.02;
      if (this.expandAnimProgress >= 1) this.expandAnimProgress = -1;
    }

    // ─── Fog overlay ───
    this.fogGfx.clear();
    const fogSize = 100000; // Massive so player never sees the rect edge
    // Draw a large dark rect, then cut a circle out by drawing a lighter circle
    this.fogGfx.rect(-fogSize / 2, -fogSize / 2, fogSize, fogSize);
    this.fogGfx.fill({ color: p.fogColor, alpha: 0.6 });
    this.fogGfx.circle(0, 0, r + 30);
    this.fogGfx.cut();

    // ─── Glow ring (pulsing red) ───
    this.glowGfx.clear();
    const pulse = Math.sin(elapsed * 3) * 0.15 + 0.85;
    const glowWidth = 12 * pulse;
    this.glowGfx.circle(0, 0, r);
    this.glowGfx.stroke({ width: glowWidth, color: 0xF13333, alpha: 0.25 * pulse });
    this.glowGfx.circle(0, 0, r);
    this.glowGfx.stroke({ width: 6, color: 0xF13333, alpha: 0.15 });

    // Flash on expand
    if (this.expandAnimProgress >= 0 && this.expandAnimProgress < 0.3) {
      const flashAlpha = (1 - this.expandAnimProgress / 0.3) * 0.5;
      this.glowGfx.circle(0, 0, r);
      this.glowGfx.stroke({ width: 20, color: 0xF1FFFF, alpha: flashAlpha });
    }

    // ─── Main ring ───
    this.ringGfx.clear();
    this.ringGfx.circle(0, 0, r);
    this.ringGfx.stroke({ width: 2, color: 0xF15555, alpha: 0.75 });

    // ─── Labels ───
    this.labelContainer.removeChildren();
    const dist = Math.sqrt(playerX * playerX + playerY * playerY);
    if (dist > r - BOUNDARY_LABEL_DISTANCE) {
      const angle = Math.atan2(playerY, playerX);
      const labelX = Math.cos(angle) * r;
      const labelY = Math.sin(angle) * r;
      const labelText = this.expandAnimProgress >= 0 ? 'AREA EXPANDED!' : 'COLLECT TO EXPAND →';
      const style = new TextStyle({
        fontFamily: 'Outfit, sans-serif', fontSize: 11, fontWeight: '500',
        fill: 0xFFE8A0, letterSpacing: 1.5,
      });
      const txt = new Text({ text: labelText, style });
      txt.anchor.set(0.5);
      txt.x = labelX;
      txt.y = labelY - 18;
      txt.alpha = Math.min(1, (dist - (r - BOUNDARY_LABEL_DISTANCE)) / 40);
      this.labelContainer.addChild(txt);
    }
  }

  checkBoundary(px: number, py: number, hovercraft: { applyForce: (x: number, y: number) => void; dampenToward: (x: number, y: number) => void }) {
    const dist = Math.sqrt(px * px + py * py);
    const r = this.radiusPixels;
    if (dist > r - 20) {
      const penetration = Math.max(0, dist - r + 20) / 20;
      const nx = px / dist;
      const ny = py / dist;
      hovercraft.applyForce(-nx * BOUNDARY_PUSH_FORCE * penetration, -ny * BOUNDARY_PUSH_FORCE * penetration);
      if (dist > r) {
        hovercraft.dampenToward(nx, ny);
      }
    }
  }

  static getRadiusForArtifacts(count: number): number {
    let radius = RADIUS_STEPS[0].radius;
    for (const step of RADIUS_STEPS) {
      if (count >= step.artifacts) radius = step.radius;
    }
    return radius;
  }
}
