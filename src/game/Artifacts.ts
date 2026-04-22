/* DRIFTWORLD — Artifacts System */
import { Container, Graphics } from 'pixi.js';
import { COLLECT_RADIUS, GEM_POINTS, FLOWER_POINTS, RARE_POINTS } from '../config/constants';
import type { Palette } from '../config/palettes';
import type { Point } from '../map/GeoParser';

export type ArtifactType = 'gem' | 'flower' | 'rare';

interface Artifact {
  x: number;
  y: number;
  type: ArtifactType;
  collected: boolean;
  gfx: Graphics;
  animPhase: number;
}

export class Artifacts extends Container {
  private artifacts: Artifact[] = [];
  private currentPalette: Palette | null = null;

  constructor() {
    super();
  }

  spawnAtPoints(intersections: Point[], midpoints: Point[], radiusPixels: number) {
    // Spawn gems at intersections (on road)
    for (const p of intersections) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      if (dist > radiusPixels) continue;
      if (Math.random() > 0.4) continue;

      const isRare = Math.random() < 0.08;
      this.addArtifact(p.x, p.y, isRare ? 'rare' : 'gem');
    }
    // Spawn flowers along road midpoints (on road, no offset)
    for (const p of midpoints) {
      const dist = Math.sqrt(p.x * p.x + p.y * p.y);
      if (dist > radiusPixels) continue;
      if (Math.random() > 0.3) continue;

      this.addArtifact(p.x, p.y, 'flower');
    }
  }

  spawnInRing(innerRadius: number, outerRadius: number, count: number) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = innerRadius + Math.random() * (outerRadius - innerRadius);
      const type: ArtifactType = Math.random() < 0.5 ? 'gem' : 'flower';
      this.addArtifact(Math.cos(angle) * r, Math.sin(angle) * r, type);
    }
  }

  private addArtifact(x: number, y: number, type: ArtifactType) {
    const gfx = new Graphics();
    this.drawArtifact(gfx, type);
    gfx.x = x;
    gfx.y = y;
    this.addChild(gfx);
    this.artifacts.push({ x, y, type, collected: false, gfx, animPhase: Math.random() * Math.PI * 2 });
  }

  private drawArtifact(gfx: Graphics, type: ArtifactType) {
    switch (type) {
      case 'gem':
        // Diamond
        gfx.moveTo(0, -8); gfx.lineTo(6, 0); gfx.lineTo(0, 8); gfx.lineTo(-6, 0); gfx.closePath();
        gfx.fill({ color: 0x60D0FF, alpha: 0.8 });
        gfx.moveTo(0, -8); gfx.lineTo(6, 0); gfx.lineTo(0, 8); gfx.lineTo(-6, 0); gfx.closePath();
        gfx.stroke({ width: 1, color: 0xA0E8FF, alpha: 0.9 });
        // Inner shine
        gfx.moveTo(0, -4); gfx.lineTo(3, 0); gfx.lineTo(0, 4); gfx.lineTo(-3, 0); gfx.closePath();
        gfx.fill({ color: 0xFFFFFF, alpha: 0.3 });
        break;
      case 'flower':
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          gfx.circle(Math.cos(a) * 5, Math.sin(a) * 5, 3.5);
        }
        gfx.fill({ color: 0xFF90B0, alpha: 0.75 });
        gfx.circle(0, 0, 2.5);
        gfx.fill({ color: 0xFFE060, alpha: 0.9 });
        break;
      case 'rare':
        // Star shape
        for (let i = 0; i < 5; i++) {
          const outerA = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const innerA = ((i + 0.5) / 5) * Math.PI * 2 - Math.PI / 2;
          const method = i === 0 ? 'moveTo' : 'lineTo';
          gfx[method](Math.cos(outerA) * 10, Math.sin(outerA) * 10);
          gfx.lineTo(Math.cos(innerA) * 4, Math.sin(innerA) * 4);
        }
        gfx.closePath();
        gfx.fill({ color: 0xFFD700, alpha: 0.85 });
        gfx.circle(0, 0, 3);
        gfx.fill({ color: 0xFFFFFF, alpha: 0.5 });
        break;
    }
  }

  update(elapsed: number) {
    for (const a of this.artifacts) {
      if (a.collected) continue;
      a.gfx.alpha = 0.7 + Math.sin(elapsed * 2 + a.animPhase) * 0.3;
      a.gfx.scale.set(0.9 + Math.sin(elapsed * 1.5 + a.animPhase) * 0.1);
      if (a.type === 'gem' || a.type === 'rare') {
        a.gfx.rotation = Math.sin(elapsed * 0.8 + a.animPhase) * 0.15;
      }
    }
  }

  checkCollection(px: number, py: number): { type: ArtifactType; points: number } | null {
    for (const a of this.artifacts) {
      if (a.collected) continue;
      const dx = px - a.x;
      const dy = py - a.y;
      if (dx * dx + dy * dy < COLLECT_RADIUS * COLLECT_RADIUS) {
        a.collected = true;
        this.playCollectAnimation(a);
        const pts = a.type === 'gem' ? GEM_POINTS : a.type === 'flower' ? FLOWER_POINTS : RARE_POINTS;
        return { type: a.type, points: pts };
      }
    }
    return null;
  }

  private playCollectAnimation(a: Artifact) {
    let frame = 0;
    const animate = () => {
      frame++;
      const t = frame / 15;
      a.gfx.scale.set(1 + t * 0.8);
      a.gfx.alpha = 1 - t;
      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        this.removeChild(a.gfx);
      }
    };
    requestAnimationFrame(animate);
  }

  getCollectedCount(): number {
    return this.artifacts.filter(a => a.collected).length;
  }
}
