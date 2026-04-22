/* DRIFTWORLD — Hovercraft (Car-shaped, free movement + drift detection) */
import { Container, Graphics } from 'pixi.js';
import {
  THRUST_FORCE, LINEAR_DRAG, TURN_FORCE,
  ANGULAR_DRAG, MAX_SPEED,
} from '../config/constants';
import type { Palette } from '../config/palettes';

export interface HovercraftInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  joyX: number;
  joyY: number;
}

export class Hovercraft extends Container {
  // Physics state
  public vx = 0;
  public vy = 0;
  public heading = -Math.PI / 2; // facing up
  public angularVel = 0;
  public speed = 0;
  public driftAmount = 0;
  public isDrifting = false;
  private carColor: number;

  private bodyGfx: Graphics;
  private shadowGfx: Graphics;
  private headlightGfx: Graphics;
  private driftTrailGfx: Graphics;
  private dustParticles: Array<{
    x: number; y: number; vx: number; vy: number;
    life: number; maxLife: number; size: number;
  }> = [];
  private dustGfx: Graphics;
  private currentPalette: Palette | null = null;

  constructor(carColor: number = 0x88FF44) {
    super();
    this.carColor = carColor;
    this.shadowGfx = new Graphics();
    this.addChild(this.shadowGfx);
    this.driftTrailGfx = new Graphics();
    this.addChild(this.driftTrailGfx);
    this.dustGfx = new Graphics();
    this.addChild(this.dustGfx);
    this.headlightGfx = new Graphics();
    this.addChild(this.headlightGfx);
    this.bodyGfx = new Graphics();
    this.addChild(this.bodyGfx);
    this.drawBody();
  }

  private drawBody() {
    // ─── Shadow ───
    this.shadowGfx.clear();
    this.shadowGfx.roundRect(-11, -5, 22, 12, 3);
    this.shadowGfx.fill({ color: 0x000000, alpha: 0.18 });
    this.shadowGfx.x = 2;
    this.shadowGfx.y = 3;

    // ─── Car body ───
    this.bodyGfx.clear();
    const c = this.carColor;
    // Darker shade for hood/trunk
    const r = (c >> 16) & 0xFF, g = (c >> 8) & 0xFF, b = c & 0xFF;
    const darker = ((Math.floor(r * 0.7)) << 16) | ((Math.floor(g * 0.7)) << 8) | Math.floor(b * 0.7);

    // Main body
    this.bodyGfx.roundRect(-12, -6, 24, 12, 3);
    this.bodyGfx.fill({ color: c, alpha: 0.95 });

    // Roof / cabin (glass)
    this.bodyGfx.roundRect(-4, -4.5, 10, 9, 2);
    this.bodyGfx.fill({ color: 0x90C8E8, alpha: 0.5 });

    // Hood
    this.bodyGfx.roundRect(6, -5, 7, 10, 2);
    this.bodyGfx.fill({ color: darker, alpha: 0.9 });

    // Trunk
    this.bodyGfx.roundRect(-13, -4.5, 6, 9, 1.5);
    this.bodyGfx.fill({ color: darker, alpha: 0.8 });

    // Headlights
    this.bodyGfx.roundRect(12, -4, 2, 3, 1);
    this.bodyGfx.fill({ color: 0xFFF8E0, alpha: 0.9 });
    this.bodyGfx.roundRect(12, 1, 2, 3, 1);
    this.bodyGfx.fill({ color: 0xFFF8E0, alpha: 0.9 });

    // Tail lights
    this.bodyGfx.roundRect(-14, -4, 2, 2.5, 0.5);
    this.bodyGfx.fill({ color: 0xFF4040, alpha: 0.7 });
    this.bodyGfx.roundRect(-14, 1.5, 2, 2.5, 0.5);
    this.bodyGfx.fill({ color: 0xFF4040, alpha: 0.7 });

    // Outline
    this.bodyGfx.roundRect(-13, -6, 27, 12, 3);
    this.bodyGfx.stroke({ width: 0.8, color: 0x908070, alpha: 0.5 });
  }

  setColor(color: number) {
    this.carColor = color;
    this.drawBody();
  }

  updatePalette(palette: Palette) {
    this.currentPalette = palette;
  }

  update(input: HovercraftInput, delta: number) {
    // ─── Determine input ───
    let turnInput = 0;
    let thrustInput = 0;

    if (input.left) turnInput -= 1;
    if (input.right) turnInput += 1;
    if (input.forward) thrustInput = 1;
    if (input.backward) thrustInput = -0.4;

    // Joystick overrides keyboard if active
    if (Math.abs(input.joyX) > 0.1 || Math.abs(input.joyY) > 0.1) {
      const joyAngle = Math.atan2(input.joyY, input.joyX);
      const joyMag = Math.min(1, Math.sqrt(input.joyX ** 2 + input.joyY ** 2));

      let angleDiff = joyAngle - this.heading;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      turnInput = Math.sign(angleDiff) * Math.min(1, Math.abs(angleDiff) * 2);
      thrustInput = joyMag;
    }

    // ─── Apply physics ───
    this.angularVel += turnInput * TURN_FORCE * delta;
    this.angularVel *= Math.pow(ANGULAR_DRAG, delta);
    this.heading += this.angularVel * delta;

    const thrust = thrustInput * THRUST_FORCE;
    this.vx += Math.cos(this.heading) * thrust * delta;
    this.vy += Math.sin(this.heading) * thrust * delta;

    // Apply drag
    this.vx *= Math.pow(LINEAR_DRAG, delta);
    this.vy *= Math.pow(LINEAR_DRAG, delta);

    // Clamp speed
    this.speed = Math.sqrt(this.vx ** 2 + this.vy ** 2);
    if (this.speed > MAX_SPEED) {
      const scale = MAX_SPEED / this.speed;
      this.vx *= scale;
      this.vy *= scale;
      this.speed = MAX_SPEED;
    }

    // ─── Drift detection ───
    // Drift = angle between velocity direction and heading direction
    if (this.speed > 0.5) {
      const velAngle = Math.atan2(this.vy, this.vx);
      let driftDiff = velAngle - this.heading;
      while (driftDiff > Math.PI) driftDiff -= Math.PI * 2;
      while (driftDiff < -Math.PI) driftDiff += Math.PI * 2;
      this.driftAmount = Math.abs(driftDiff) / (Math.PI / 2); // 0–1 (1 = 90° sideways)
      this.driftAmount = Math.min(1, this.driftAmount);
      this.isDrifting = this.driftAmount > 0.25 && this.speed > 1.5;
    } else {
      this.driftAmount = 0;
      this.isDrifting = false;
    }

    // Update position
    this.x += this.vx * delta;
    this.y += this.vy * delta;

    // Rotate body to match heading
    this.bodyGfx.rotation = this.heading;
    this.shadowGfx.rotation = this.heading;

    // ─── Headlight glow ───
    this.headlightGfx.clear();
    if (this.speed > 0.3) {
      this.headlightGfx.circle(
        Math.cos(this.heading) * 16,
        Math.sin(this.heading) * 16,
        5 + Math.random() * 2
      );
      this.headlightGfx.fill({
        color: this.currentPalette?.glowColor || 0xFFD080,
        alpha: 0.2,
      });
    }

    // ─── Drift trail effect ───
    this.driftTrailGfx.clear();
    if (this.isDrifting) {
      // Draw skid marks behind car
      const trailAlpha = Math.min(0.3, this.driftAmount * 0.4);
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const perpX = -Math.sin(this.heading) * 5 * side;
        const perpY = Math.cos(this.heading) * 5 * side;
        const backX = -Math.cos(this.heading) * 12;
        const backY = -Math.sin(this.heading) * 12;
        this.driftTrailGfx.circle(backX + perpX, backY + perpY, 2);
        this.driftTrailGfx.fill({ color: 0x000000, alpha: trailAlpha });
      }
    }

    // ─── Dust particles ───
    if (this.speed > 0.5) {
      this.spawnDust(delta);
    }
    this.updateDust(delta);
  }

  private spawnDust(delta: number) {
    // More dust when drifting
    const driftMultiplier = this.isDrifting ? 3 : 1;
    const spawnChance = this.speed * 0.25 * delta * driftMultiplier;
    if (Math.random() < spawnChance) {
      const spread = this.isDrifting ? 10 : 5;
      this.dustParticles.push({
        x: -Math.cos(this.heading) * 12 + (Math.random() - 0.5) * spread,
        y: -Math.sin(this.heading) * 12 + (Math.random() - 0.5) * spread,
        vx: -this.vx * 0.15 + (Math.random() - 0.5) * 0.5,
        vy: -this.vy * 0.15 + (Math.random() - 0.5) * 0.5,
        life: 0,
        maxLife: 25 + Math.random() * 15,
        size: (this.isDrifting ? 2.5 : 1.5) + Math.random() * 2.5,
      });
    }
  }

  private updateDust(delta: number) {
    this.dustGfx.clear();
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life += delta;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vx *= 0.97;
      p.vy *= 0.97;
      if (p.life >= p.maxLife) { this.dustParticles.splice(i, 1); continue; }
      const t = p.life / p.maxLife;
      this.dustGfx.circle(p.x, p.y, p.size * (1 + t * 0.4));
      this.dustGfx.fill({
        color: this.currentPalette?.particleColor || 0xFFE8C0,
        alpha: (1 - t) * 0.2,
      });
    }
  }

  applyForce(fx: number, fy: number) {
    this.vx += fx;
    this.vy += fy;
  }

  dampenToward(nx: number, ny: number) {
    const dot = this.vx * nx + this.vy * ny;
    if (dot > 0) {
      this.vx -= nx * dot;
      this.vy -= ny * dot;
    }
  }
}
