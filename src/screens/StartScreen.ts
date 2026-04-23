/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Start Screen
   
   Cinematic intro inspired by Alto's Odyssey:
   - Gradient dawn sky
   - Parallax silhouette animations
   - Title + tagline fade-in
   - BEGIN button
   ═══════════════════════════════════════════════════════ */

import { Container, Graphics, Text, TextStyle, FillGradient, Application } from 'pixi.js';
import { getPalette, Palette } from '../config/palettes';

export class StartScreen extends Container {
  private silhouettes: { gfx: Graphics; vx: number; vy: number; }[] = [];
  private titleText!: Text;
  private taglineText!: Text;
  private levelText!: Text;
  private beginButton!: Container;
  private elapsed = 0;
  private appWidth: number;
  private appHeight: number;
  private started = false;
  private transitionAlpha = 0;
  private transitioning = false;
  private whiteOverlay!: Graphics;
  public onStart: (() => void) | null = null;
  public onChangeLocation: (() => void) | null = null;
  private changeLocationBtn!: Container;
  private level: number;
  private carColor: number;
  private timeOfDay: number;
  private currentPalette: Palette;

  constructor(app: Application, level: number = 1, carColor: number = 0x88FF44, timeOfDay: number = 0.02) {
    super();
    this.appWidth = app.screen.width;
    this.appHeight = app.screen.height;
    this.level = level;
    this.carColor = carColor;
    this.timeOfDay = timeOfDay;
    this.currentPalette = getPalette(timeOfDay);
    this.buildScene();
  }

  public getTimeOfDay(): number {
    return this.timeOfDay;
  }

  private buildScene() {
    // ─── Sky gradient background ───
    const sky = new Graphics();
    const gradient = new FillGradient(0, 0, 0, this.appHeight);
    gradient.addColorStop(0, this.currentPalette.sky);
    gradient.addColorStop(1, this.currentPalette.skyGradientEnd);
    sky.rect(0, 0, this.appWidth, this.appHeight);
    sky.fill(gradient);
    this.addChild(sky);

    // ─── Ground plane below horizon ───
    const horizonY = this.appHeight * 1;
    const ground = new Graphics();
    const groundGradient = new FillGradient(0, horizonY, 0, this.appHeight);
    groundGradient.addColorStop(0, this.currentPalette.ambient);
    groundGradient.addColorStop(1, this.currentPalette.fogColor);
    ground.rect(0, horizonY, this.appWidth, this.appHeight - horizonY);
    ground.fill(groundGradient);
    ground.alpha = 0.3;
    this.addChild(ground);

    // ─── Parallax silhouettes ───
    this.createSilhouettes();

    // ─── Level badge ───
    const levelStyle = new TextStyle({
      fontFamily: 'Outfit, sans-serif',
      fontSize: 12,
      fontWeight: '700',
      fill: this.currentPalette.textColor,
      letterSpacing: 3,
      dropShadow: {
        alpha: 0.6,
        angle: Math.PI / 2,
        blur: 6,
        color: 0x000000,
        distance: 2,
      }
    });
    this.levelText = new Text({ text: `LEVEL ${this.level}`, style: levelStyle });
    this.levelText.anchor.set(0.5);
    this.levelText.x = this.appWidth / 2;
    this.levelText.y = this.appHeight * 0.38 - 50;
    this.levelText.alpha = 0;
    this.addChild(this.levelText);

    // ─── Colored car preview ───
    const carPreview = new Graphics();
    carPreview.roundRect(-18, -9, 36, 18, 4);
    carPreview.fill({ color: this.carColor, alpha: 0.9 });
    carPreview.roundRect(-6, -7, 14, 14, 3);
    carPreview.fill({ color: 0x90C8E8, alpha: 0.4 });
    carPreview.x = this.appWidth / 2;
    carPreview.y = this.appHeight * 0.38 - 80;
    carPreview.alpha = 0;

    // Don't show cars for now. Make car good looking before showing it on start screen.
    // this.addChild(carPreview);
    // Store for fade-in
    (this as any)._carPreview = carPreview;

    // ─── Title ───
    const titleStyle = new TextStyle({
      fontFamily: 'Cormorant Garamond, Georgia, serif',
      fontSize: Math.min(72, this.appWidth * 0.1),
      fontWeight: '300',
      fill: this.currentPalette.textColor,
      letterSpacing: 12,
      dropShadow: {
        alpha: 0.5,
        angle: Math.PI / 2,
        blur: 20,
        color: 0x000000,
        distance: 4,
      }
    });
    this.titleText = new Text({ text: 'DRIFTWORLD', style: titleStyle });
    this.titleText.anchor.set(0.5);
    this.titleText.x = this.appWidth / 2;
    this.titleText.y = this.appHeight * 0.38;
    this.titleText.alpha = 0;
    this.addChild(this.titleText);

    // ─── Tagline ───
    const taglineStyle = new TextStyle({
      fontFamily: 'Outfit, sans-serif',
      fontSize: Math.min(16, this.appWidth * 0.025),
      fontWeight: '300',
      fill: this.currentPalette.textColor,
      letterSpacing: 6,
      dropShadow: {
        alpha: 0.6,
        angle: Math.PI / 2,
        blur: 10,
        color: 0x000000,
        distance: 2,
      }
    });
    this.taglineText = new Text({ text: 'DRIFT  ·  COLLECT  ·  EXPLORE', style: taglineStyle });
    this.taglineText.anchor.set(0.5);
    this.taglineText.x = this.appWidth / 2;
    this.taglineText.y = this.appHeight * 0.38 + 50;
    this.taglineText.alpha = 0;
    this.addChild(this.taglineText);

    // ─── BEGIN button ───
    this.beginButton = this.createBeginButton();
    this.beginButton.x = this.appWidth / 2;
    this.beginButton.y = this.appHeight * 0.56;
    this.beginButton.alpha = 0;
    this.addChild(this.beginButton);

    // ─── CHANGE LOCATION button ───
    this.changeLocationBtn = this.createChangeLocationButton();
    this.changeLocationBtn.x = this.appWidth / 2;
    this.changeLocationBtn.y = this.appHeight * 0.56 + 60;
    this.changeLocationBtn.alpha = 0;
    this.addChild(this.changeLocationBtn);

    // ─── White transition overlay ───
    this.whiteOverlay = new Graphics();
    this.whiteOverlay.rect(0, 0, this.appWidth, this.appHeight);
    this.whiteOverlay.fill(0xFFFFFF);
    this.whiteOverlay.alpha = 0;
    this.addChild(this.whiteOverlay);
  }

  private createSilhouettes() {
    const horizonY = this.appHeight * 0.70;
    const silhouetteData: { type: string, speed: number, y: number, scale: number, depth: number }[] = [];

    // depth 1: Far distant mountains (very slow)
    for (let i = 0; i < 4; i++) {
      silhouetteData.push({ type: 'mountain', speed: 0.08 + Math.random() * 0.05, y: horizonY - 40 - Math.random() * 40, scale: 1.0 + Math.random() * 0.5, depth: 0.2 });
      silhouetteData.push({ type: 'mountain2', speed: 0.06 + Math.random() * 0.04, y: horizonY - 30 - Math.random() * 30, scale: 0.8 + Math.random() * 0.4, depth: 0.25 });
    }

    // depth 2: Mid-ground vehicles, roads, and artifacts (medium speed)
    for (let i = 0; i < 9; i++) {
      // silhouetteData.push({ type: 'hovercraft', speed: 0.3 + Math.random() * 0.2, y: horizonY + 10 + Math.random() * 30, scale: 0.4 + Math.random() * 0.3, depth: 0.5 });
      silhouetteData.push({ type: 'road', speed: 0.25 + Math.random() * 0.1, y: horizonY + 5 + Math.random() * 20, scale: 0.4 + Math.random() * 0.2, depth: 0.5 });
      silhouetteData.push({ type: 'gem', speed: 0.35 + Math.random() * 0.15, y: horizonY - 20 - Math.random() * 60, scale: 0.3 + Math.random() * 0.2, depth: 0.5 });
      silhouetteData.push({ type: 'flower', speed: 0.35 + Math.random() * 0.15, y: horizonY - 10 - Math.random() * 50, scale: 0.3 + Math.random() * 0.2, depth: 0.5 });
    }

    // depth 3: Foreground large details (fast)
    for (let i = 0; i < 7; i++) {
      // silhouetteData.push({ type: 'hovercraft', speed: 0.6 + Math.random() * 0.3, y: horizonY + 40 + Math.random() * 40, scale: 0.7 + Math.random() * 0.4, depth: 0.85 });
      silhouetteData.push({ type: 'road2', speed: 0.5 + Math.random() * 0.2, y: horizonY + 30 + Math.random() * 30, scale: 0.6 + Math.random() * 0.3, depth: 0.85 });
      silhouetteData.push({ type: 'gem', speed: 0.7 + Math.random() * 0.2, y: horizonY + 20 + Math.random() * 40, scale: 0.5 + Math.random() * 0.3, depth: 0.85 });
      silhouetteData.push({ type: 'flower', speed: 0.65 + Math.random() * 0.25, y: horizonY + 10 + Math.random() * 50, scale: 0.45 + Math.random() * 0.3, depth: 0.85 });
    }

    for (const data of silhouetteData) {
      const gfx = new Graphics();
      this.drawSilhouetteShape(gfx, data.type, data.scale);
      gfx.alpha = data.depth * 0.25;
      
      // Spawn from anywhere on screen
      gfx.x = Math.random() * this.appWidth;
      gfx.y = Math.random() * this.appHeight;
      this.addChild(gfx);
      
      // Random angle (0 to 360 degrees)
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * data.speed;
      const vy = Math.sin(angle) * data.speed;

      this.silhouettes.push({
        gfx,
        vx,
        vy
      });
    }
  }

  private drawSilhouetteShape(gfx: Graphics, type: string, scale: number) {
    const color = this.currentPalette.fogColor;
    const s = scale * 100;

    switch (type) {
      case 'hovercraft':
        // Teardrop shape
        gfx.ellipse(0, 0, s * 0.8, s * 0.35);
        gfx.fill({ color, alpha: 0.9 });
        gfx.ellipse(s * 0.3, 0, s * 0.3, s * 0.2);
        gfx.fill({ color, alpha: 0.9 });
        break;
      case 'road':
      case 'road2':
        // Curved road segment
        gfx.moveTo(-s * 2, s * 0.1);
        gfx.quadraticCurveTo(-s, -s * 0.3, 0, 0);
        gfx.quadraticCurveTo(s, s * 0.3, s * 2, -s * 0.1);
        gfx.stroke({ width: 3 * scale, color, alpha: 0.7 });
        break;
      case 'gem':
        // Diamond shape
        gfx.moveTo(0, -s * 0.5);
        gfx.lineTo(s * 0.3, 0);
        gfx.lineTo(0, s * 0.5);
        gfx.lineTo(-s * 0.3, 0);
        gfx.closePath();
        gfx.fill({ color, alpha: 0.85 });
        break;
      case 'flower':
        // Simple flower: 5 petals
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const px = Math.cos(angle) * s * 0.25;
          const py = Math.sin(angle) * s * 0.25;
          gfx.circle(px, py, s * 0.15);
        }
        gfx.fill({ color, alpha: 0.8 });
        gfx.circle(0, 0, s * 0.1);
        gfx.fill({ color, alpha: 0.9 });
        break;
      case 'mountain':
        // Large distant mountain
        gfx.moveTo(-s * 2, s * 0.6);
        gfx.lineTo(-s * 0.5, -s * 0.8);
        gfx.lineTo(s * 0.3, -s * 0.3);
        gfx.lineTo(s * 1.2, -s * 0.9);
        gfx.lineTo(s * 2.5, s * 0.6);
        gfx.closePath();
        gfx.fill({ color, alpha: 0.15 });
        break;
      case 'mountain2':
        gfx.moveTo(-s * 1.5, s * 0.4);
        gfx.lineTo(0, -s * 0.6);
        gfx.lineTo(s * 1.8, s * 0.4);
        gfx.closePath();
        gfx.fill({ color, alpha: 0.1 });
        break;
    }
  }

  private createBeginButton(): Container {
    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';

    // Pill background
    const bg = new Graphics();
    bg.roundRect(-80, -22, 160, 44, 22);
    bg.fill({ color: this.currentPalette.textColor, alpha: 0.15 });
    bg.roundRect(-80, -22, 160, 44, 22);
    bg.stroke({ width: 1.5, color: this.currentPalette.textColor, alpha: 0.35 });
    container.addChild(bg);

    // Glow (hidden until hover)
    const glow = new Graphics();
    glow.roundRect(-84, -26, 168, 52, 26);
    glow.fill({ color: 0xFFE8A0, alpha: 0.2 });
    glow.alpha = 0;
    container.addChild(glow);

    const textStyle = new TextStyle({
      fontFamily: 'Outfit, sans-serif',
      fontSize: 14,
      fontWeight: '600',
      fill: this.currentPalette.textColor,
      letterSpacing: 4,
    });
    const label = new Text({ text: 'BEGIN', style: textStyle });
    label.anchor.set(0.5);
    container.addChild(label);

    // Hover effects
    container.on('pointerover', () => { glow.alpha = 1; });
    container.on('pointerout', () => { glow.alpha = 0; });
    container.on('pointertap', () => {
      if (!this.transitioning) {
        this.transitioning = true;
      }
    });

    return container;
  }

  private createChangeLocationButton(): Container {
    const container = new Container();
    container.eventMode = 'static';
    container.cursor = 'pointer';

    const textStyle = new TextStyle({
      fontFamily: 'Outfit, sans-serif',
      fontSize: 12,
      fontWeight: '500',
      fill: this.currentPalette.textColor,
      letterSpacing: 2,
    });
    const label = new Text({ text: 'CHANGE LOCATION', style: textStyle });
    label.anchor.set(0.5);
    container.addChild(label);

    const line = new Graphics();
    line.moveTo(-label.width / 2, 10);
    line.lineTo(label.width / 2, 10);
    line.stroke({ width: 1, color: this.currentPalette.textColor, alpha: 0.5 });
    container.addChild(line);

    container.on('pointerover', () => { line.alpha = 1; });
    container.on('pointerout', () => { line.alpha = 0.5; });
    container.on('pointertap', () => {
      if (!this.transitioning && this.onChangeLocation) {
        this.onChangeLocation();
      }
    });

    return container;
  }

  public update(delta: number) {
    this.elapsed += delta / 60; // Convert to seconds (at 60fps)

    // ─── Animate silhouettes (random floating) ───
    for (const s of this.silhouettes) {
      s.gfx.x += s.vx * delta;
      s.gfx.y += s.vy * delta;
      
      // Wrap around bounds with a margin
      const margin = 200;
      if (s.gfx.x < -margin) s.gfx.x = this.appWidth + margin;
      if (s.gfx.x > this.appWidth + margin) s.gfx.x = -margin;
      if (s.gfx.y < -margin) s.gfx.y = this.appHeight + margin;
      if (s.gfx.y > this.appHeight + margin) s.gfx.y = -margin;
      
      // Add slight rotation to objects like gems and flowers
      s.gfx.rotation += (s.vx + s.vy) * 0.005 * delta;
    }

    // ─── Fade in level badge + car preview after 0.8s ───
    const carPreview = (this as any)._carPreview as Graphics;
    if (this.elapsed > 0.8 && this.levelText.alpha < 1) {
      this.levelText.alpha = Math.min(1, this.levelText.alpha + 0.025 * delta);
      carPreview.alpha = Math.min(1, carPreview.alpha + 0.025 * delta);
    }

    // ─── Fade in title after 1.2s ───
    if (this.elapsed > 1.2 && this.titleText.alpha < 1) {
      this.titleText.alpha = Math.min(1, this.titleText.alpha + 0.02 * delta);
    }

    // ─── Fade in tagline after 1.8s ───
    if (this.elapsed > 1.8 && this.taglineText.alpha < 1) {
      this.taglineText.alpha = Math.min(1, this.taglineText.alpha + 0.02 * delta);
    }

    // ─── Fade in buttons after 2.5s ───
    if (this.elapsed > 2.5 && this.beginButton.alpha < 1) {
      this.beginButton.alpha = Math.min(1, this.beginButton.alpha + 0.025 * delta);
      this.changeLocationBtn.alpha = Math.min(1, this.changeLocationBtn.alpha + 0.025 * delta);
    }

    // ─── Transition animation ───
    if (this.transitioning) {
      this.transitionAlpha += 0.02 * delta;
      this.whiteOverlay.alpha = Math.min(1, this.transitionAlpha);

      // Fade everything else
      this.titleText.alpha = Math.max(0, 1 - this.transitionAlpha * 2);
      this.taglineText.alpha = Math.max(0, 1 - this.transitionAlpha * 2);
      this.beginButton.alpha = Math.max(0, 1 - this.transitionAlpha * 2);

      if (this.transitionAlpha >= 1.2 && !this.started) {
        this.started = true;
        this.onStart?.();
      }
    }
  }

  public resize(width: number, height: number) {
    this.appWidth = width;
    this.appHeight = height;
    // In a full implementation, rebuild the scene
  }
}
