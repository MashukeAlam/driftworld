/* DRIFTWORLD — Game Screen */
import { Container, Graphics, FillGradient, Application, Text, TextStyle } from 'pixi.js';
import { Hovercraft, type HovercraftInput } from '../game/Hovercraft';
import { DayNight } from '../game/DayNight';
import { Artifacts } from '../game/Artifacts';
import { BoundaryRing } from '../game/BoundaryRing';
import { AudioManager } from '../game/AudioManager';
import { MapRenderer } from '../map/MapRenderer';
import { DecorationLayer } from '../map/DecorationLayer';
import { GeoProjection, parseRoads, findIntersections, findRoadMidpoints, type RoadSegment } from '../map/GeoParser';
import { fetchOSMData, computeBBox } from '../map/OSMFetcher';
import { ToastManager } from '../ui/ToastManager';
import { HUD } from '../ui/HUD';
import { Joystick } from '../ui/Joystick';
import { PIXELS_PER_METER, CAMERA_LERP, RADIUS_STEPS } from '../config/constants';
import type { Palette } from '../config/palettes';
import { checkWin } from '../game/LevelManager';

export interface GameConfig {
  spawnLat: number;
  spawnLng: number;
  homeLat: number;
  homeLng: number;
  homeLabel: string;
  level: number;
  carColor: number;
}

export class GameScreen extends Container {
  private app: Application;
  private config: GameConfig;
  private worldContainer: Container;
  private skyBg: Graphics;
  private hovercraft: Hovercraft;
  private dayNight: DayNight;
  private artifacts: Artifacts;
  private boundaryRing: BoundaryRing;
  private audioManager: AudioManager;
  private mapRenderer: MapRenderer;
  private decorationLayer: DecorationLayer;
  private homeBeacon: Container;
  private toastManager: ToastManager;
  private hud: HUD;
  private joystick: Joystick;
  private projection: GeoProjection;
  private roadSegments: RoadSegment[] = [];
  private homeArrow: Container;
  private homeArrowGfx: Graphics;
  private homeDistLabel: Text;

  private keys: Record<string, boolean> = {};
  private elapsed = 0;
  private totalPoints = 0;
  private currentRadiusMeters: number;
  private loaded = false;
  private cameraX = 0;
  private cameraY = 0;
  private boundaryWarningCooldown = 0;
  private driftBonusCooldown = 0;
  private lastMapPaletteUpdate = 0;
  private lastRoadCheck = 0;
  private currentRoadName = '';
  private currentGlowColor = 0xFFE8A0;
  private homePixelX = 0;
  private homePixelY = 0;
  private won = false;
  public onWin: (() => void) | null = null;

  public getTimeOfDay(): number {
    return this.dayNight?.getTime() || 0.02;
  }

  constructor(app: Application, config: GameConfig) {
    super();
    this.app = app;
    this.config = config;
    // Projection centered on spawn point
    this.projection = new GeoProjection(config.spawnLat, config.spawnLng);
    this.currentRadiusMeters = RADIUS_STEPS[0].radius;

    // Calculate home position in pixel space
    const homePos = this.projection.toPixel(config.homeLat, config.homeLng);
    this.homePixelX = homePos.x;
    this.homePixelY = homePos.y;

    // Sky background
    this.skyBg = new Graphics();
    this.addChild(this.skyBg);

    // World container
    this.worldContainer = new Container();
    this.addChild(this.worldContainer);

    this.decorationLayer = new DecorationLayer();
    this.worldContainer.addChild(this.decorationLayer);

    this.mapRenderer = new MapRenderer();
    this.worldContainer.addChild(this.mapRenderer);

    this.artifacts = new Artifacts();
    this.worldContainer.addChild(this.artifacts);

    // Home beacon
    this.homeBeacon = this.createHomeBeacon();
    this.worldContainer.addChild(this.homeBeacon);

    this.boundaryRing = new BoundaryRing();
    this.worldContainer.addChild(this.boundaryRing);

    this.hovercraft = new Hovercraft(config.carColor);
    this.worldContainer.addChild(this.hovercraft);

    // Home direction arrow (screen-space, drawn on top)
    this.homeArrow = new Container();
    this.homeArrowGfx = new Graphics();
    this.homeArrow.addChild(this.homeArrowGfx);
    const arrowLabelStyle = new TextStyle({
      fontFamily: 'Outfit, sans-serif',
      fontSize: 12,
      fontWeight: '700',
      fill: 0xFFE8A0,
      letterSpacing: 1,
    });
    this.homeDistLabel = new Text({ text: '', style: arrowLabelStyle });
    this.homeDistLabel.anchor.set(0.5);
    this.homeDistLabel.y = 24;
    this.homeArrow.addChild(this.homeDistLabel);
    this.addChild(this.homeArrow);

    // Systems
    this.dayNight = new DayNight();
    this.audioManager = new AudioManager();
    this.toastManager = new ToastManager();
    this.hud = new HUD();
    this.joystick = new Joystick();

    // Init audio on first user interaction
    const initAudio = () => {
      this.audioManager.init();
      window.removeEventListener('keydown', initAudio);
      window.removeEventListener('pointerdown', initAudio);
    };
    window.addEventListener('keydown', initAudio);
    window.addEventListener('pointerdown', initAudio);

    // Keyboard
    window.addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });

    const radiusPixels = this.currentRadiusMeters * PIXELS_PER_METER;
    this.boundaryRing.setRadius(radiusPixels);

    this.loadMapData();
  }

  private createHomeBeacon(): Container {
    const beacon = new Container();
    beacon.x = this.homePixelX;
    beacon.y = this.homePixelY;

    // Pulsing ring
    const ring = new Graphics();
    beacon.addChild(ring);
    (beacon as any)._ring = ring;

    // House icon (simple)
    const house = new Graphics();
    // Roof
    house.moveTo(0, -12);
    house.lineTo(10, -4);
    house.lineTo(-10, -4);
    house.closePath();
    house.fill({ color: 0xFFFFFF, alpha: 0.8 });
    // Body
    house.rect(-7, -4, 14, 10);
    house.fill({ color: 0xFFFFFF, alpha: 0.6 });
    // Door
    house.rect(-2, 0, 4, 6);
    house.fill({ color: 0xFFE8A0, alpha: 0.5 });
    beacon.addChild(house);

    // Label
    const labelStyle = new TextStyle({
      fontFamily: 'Outfit, sans-serif',
      fontSize: 10,
      fontWeight: '600',
      fill: 0xFFFFFF,
      letterSpacing: 1,
    });
    const label = new Text({ text: 'HOME', style: labelStyle });
    label.anchor.set(0.5);
    label.y = 14;
    beacon.addChild(label);

    return beacon;
  }

  private async loadMapData() {
    try {
      // Fetch roads around spawn point with enough radius to cover home
      const homeDistMeters = Math.sqrt(this.homePixelX ** 2 + this.homePixelY ** 2) / PIXELS_PER_METER;
      const fetchRadius = Math.max(this.currentRadiusMeters + 200, homeDistMeters + 500);
      const bbox = computeBBox(this.config.spawnLat, this.config.spawnLng, fetchRadius);
      const osmData = await fetchOSMData(bbox.south, bbox.west, bbox.north, bbox.east);
      const segments = parseRoads(osmData, this.projection);
      const intersections = findIntersections(osmData, this.projection);
      const midpoints = findRoadMidpoints(segments);

      this.roadSegments = segments;

      this.mapRenderer.setRoads(segments);
      this.mapRenderer.setExplorationBounds(0, 0, this.currentRadiusMeters * PIXELS_PER_METER);

      this.decorationLayer.generate(0, 0, fetchRadius * PIXELS_PER_METER);
      this.artifacts.spawnInRing(0, this.currentRadiusMeters * PIXELS_PER_METER, 13);

      this.loaded = true;
      this.hud.show();

      // Show home direction toast
      this.toastManager.show('zone', `🏠 Home: ${this.config.homeLabel} — expand your radius to reach it!`);

      const loadingEl = document.querySelector('.loading-screen');
      if (loadingEl) {
        loadingEl.classList.add('fade-out');
        setTimeout(() => loadingEl.remove(), 800);
      }
    } catch (err) {
      console.error('Failed to load map data:', err);
      const loadingEl = document.querySelector('.loading-screen');
      if (loadingEl) {
        const textEl = loadingEl.querySelector('.loading-text');
        if (textEl) textEl.textContent = 'FAILED TO LOAD MAP — RETRYING...';
        setTimeout(() => this.loadMapData(), 3000);
      }
    }
  }

  private findNearestRoadName(): string {
    let bestDist = Infinity;
    let bestName = '';
    for (const seg of this.roadSegments) {
      for (const p of seg.points) {
        const dx = p.x - this.hovercraft.x;
        const dy = p.y - this.hovercraft.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) {
          bestDist = d;
          if (seg.name) bestName = seg.name;
        }
      }
    }
    return bestName;
  }

  update(delta: number) {
    this.elapsed += delta / 60;

    this.dayNight.update(delta);
    const palette = this.dayNight.getPalette();
    this.updatePalette(palette);
    this.audioManager.updateTimeOfDay(this.dayNight.getTime());

    if (!this.loaded || this.won) return;

    // Input
    const joyInput = this.joystick.getInput();
    const input: HovercraftInput = {
      forward: this.keys['w'] || this.keys['arrowup'] || false,
      backward: this.keys['s'] || this.keys['arrowdown'] || false,
      left: this.keys['a'] || this.keys['arrowleft'] || false,
      right: this.keys['d'] || this.keys['arrowright'] || false,
      joyX: joyInput.joyX,
      joyY: joyInput.joyY,
    };

    this.hovercraft.update(input, delta);

    // Boundary
    this.boundaryRing.checkBoundary(this.hovercraft.x, this.hovercraft.y, this.hovercraft);
    const distFromCenter = Math.sqrt(this.hovercraft.x ** 2 + this.hovercraft.y ** 2);
    const radiusPx = this.currentRadiusMeters * PIXELS_PER_METER;
    if (distFromCenter > radiusPx - 100 && this.boundaryWarningCooldown <= 0) {
      this.toastManager.showBoundary();
      this.boundaryWarningCooldown = 300;
    }
    this.boundaryWarningCooldown -= delta;
    this.driftBonusCooldown -= delta;

    // Artifact collection
    const collected = this.artifacts.checkCollection(this.hovercraft.x, this.hovercraft.y);
    if (collected) {
      let bonusPoints = 0;
      let bonusText = '';

      if (this.hovercraft.isDrifting && this.driftBonusCooldown <= 0) {
        bonusPoints = collected.points;
        const praises = ['✨ Smooth Drift!', '🌊 Drift Boss!', '⚡ Slick Moves!'];
        bonusText = praises[Math.floor(Math.random() * praises.length)];
        this.driftBonusCooldown = 30;
      }

      const totalPts = collected.points + bonusPoints;
      this.totalPoints += totalPts;

      this.audioManager.playCollect(collected.type);
      this.toastManager.showCollect(collected.type, collected.points);

      if (bonusText) {
        this.audioManager.playDriftBonus();
        this.toastManager.show('rare', `${bonusText} +${bonusPoints} bonus!`);
      }

      // Radius expansion
      const count = this.artifacts.getCollectedCount();
      const newRadius = BoundaryRing.getRadiusForArtifacts(count);
      if (newRadius > this.currentRadiusMeters) {
        this.currentRadiusMeters = newRadius;
        const newRadiusPx = newRadius * PIXELS_PER_METER;
        this.boundaryRing.setRadius(newRadiusPx, true);
        this.mapRenderer.setExplorationBounds(0, 0, newRadiusPx);
        this.toastManager.showExpand();
        this.audioManager.playExpand();
        this.artifacts.spawnInRing(radiusPx, newRadiusPx, 50);
      }

      this.hud.updateStats(count, this.totalPoints);
    }

    // Artifacts animation
    this.artifacts.update(this.elapsed);

    // Boundary ring
    this.boundaryRing.update(this.elapsed, this.hovercraft.x, this.hovercraft.y, this.app.screen.width, this.app.screen.height);

    // Home beacon pulse
    const beaconRing = (this.homeBeacon as any)._ring as Graphics;
    beaconRing.clear();
    const pulseR = 15 + Math.sin(this.elapsed * 3) * 5;
    beaconRing.circle(0, 0, pulseR);
    beaconRing.stroke({ width: 2, color: 0xFFE8A0, alpha: 0.3 + Math.sin(this.elapsed * 3) * 0.15 });
    beaconRing.circle(0, 0, pulseR + 8);
    beaconRing.stroke({ width: 1, color: 0xFFE8A0, alpha: 0.1 });

    // Check if home beacon is within radius (visible or not)
    const homeDistFromCenter = Math.sqrt(this.homePixelX ** 2 + this.homePixelY ** 2);
    this.homeBeacon.alpha = homeDistFromCenter <= this.currentRadiusMeters * PIXELS_PER_METER ? 1 : 0.15;

    // Win check
    if (checkWin(this.hovercraft.x, this.hovercraft.y, this.homePixelX, this.homePixelY, 30)) {
      if (homeDistFromCenter <= this.currentRadiusMeters * PIXELS_PER_METER) {
        this.won = true;
        this.toastManager.show('expand', '🏠 YOU MADE IT HOME!');
        this.audioManager.playExpand();
        setTimeout(() => this.onWin?.(), 2000);
      }
    }

    // HUD Road Name (throttled)
    if (this.elapsed - this.lastRoadCheck > 0.5) {
      this.currentRoadName = this.findNearestRoadName();
      this.lastRoadCheck = this.elapsed;
    }
    this.hud.updateRoadName(this.currentRoadName);

    // Camera
    const targetCamX = -this.hovercraft.x + this.app.screen.width / 2;
    const targetCamY = -this.hovercraft.y + this.app.screen.height / 2;
    this.cameraX += (targetCamX - this.cameraX) * CAMERA_LERP * delta;
    this.cameraY += (targetCamY - this.cameraY) * CAMERA_LERP * delta;
    this.worldContainer.x = this.cameraX;
    this.worldContainer.y = this.cameraY;

    // ─── Home direction arrow (screen-space) ───
    this.updateHomeArrow();
  }

  private updateHomeArrow() {
    const dx = this.homePixelX - this.hovercraft.x;
    const dy = this.homePixelY - this.hovercraft.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // Distance in meters
    const distMeters = dist / PIXELS_PER_METER;
    if (distMeters < 20) {
      this.homeArrow.alpha = 0;
      return;
    }
    this.homeArrow.alpha = 1;

    // Place arrow at edge of screen pointing toward home
    const screenCx = this.app.screen.width / 2;
    const screenCy = this.app.screen.height / 2;
    const margin = 50;
    const maxX = screenCx - margin;
    const maxY = screenCy - margin;

    // Clamp to screen edge ellipse
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const scale = Math.min(
      maxX / (Math.abs(cosA) || 0.001),
      maxY / (Math.abs(sinA) || 0.001)
    );
    const arrowDist = Math.min(scale, dist * 0.3); // don't go too far if home is close
    this.homeArrow.x = screenCx + cosA * arrowDist;
    this.homeArrow.y = screenCy + sinA * arrowDist;

    // Draw arrow shape
    this.homeArrowGfx.clear();
    this.homeArrowGfx.rotation = angle;

    // Arrow triangle (scaled up for visibility)
    this.homeArrowGfx.moveTo(20, 0);
    this.homeArrowGfx.lineTo(-10, -12);
    this.homeArrowGfx.lineTo(-5, 0);
    this.homeArrowGfx.lineTo(-10, 12);
    this.homeArrowGfx.closePath();

    // Pulse effect
    const pulse = 0.6 + Math.sin(this.elapsed * 4) * 0.3;
    this.homeArrowGfx.fill({ color: this.currentGlowColor, alpha: pulse });
    this.homeArrowGfx.stroke({ width: 1, color: 0xFFFFFF, alpha: pulse * 0.5 });

    // Distance label
    if (distMeters >= 1000) {
      this.homeDistLabel.text = `${(distMeters / 1000).toFixed(1)}km`;
    } else {
      this.homeDistLabel.text = `${Math.round(distMeters)}m`;
    }
    this.homeDistLabel.rotation = -angle; // Keep text upright
  }
  private updatePalette(palette: Palette) {
    this.skyBg.clear();
    const gradient = new FillGradient(0, 0, 0, this.app.screen.height);
    gradient.addColorStop(0, palette.sky);
    gradient.addColorStop(1, palette.skyGradientEnd);
    this.skyBg.rect(0, 0, this.app.screen.width, this.app.screen.height);
    this.skyBg.fill(gradient);

    // Throttle complex vector redrawing to twice a second
    if (this.elapsed - this.lastMapPaletteUpdate > 0.5) {
      this.mapRenderer.updatePalette(palette);
      this.decorationLayer.updatePalette(palette);
      this.lastMapPaletteUpdate = this.elapsed;
    }

    this.boundaryRing.updatePalette(palette);
    this.hovercraft.updatePalette(palette);
    this.hud.updatePalette(palette);
    this.currentGlowColor = palette.glowColor;
  }
}
