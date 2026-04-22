/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Start Screen
   
   Cinematic intro inspired by Alto's Odyssey:
   - Gradient dawn sky
   - Parallax silhouette animations
   - Title + tagline fade-in
   - BEGIN button
   ═══════════════════════════════════════════════════════ */

import { Container, Graphics, Text, TextStyle, FillGradient, Application } from 'pixi.js';

export class StartScreen extends Container {
  private silhouettes: { gfx: Graphics; speed: number; startX: number; y: number }[] = [];
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
  private level: number;
  private carColor: number;

  constructor(app: Application, level: number = 1, carColor: number = 0x88FF44) {
    super();
    this.appWidth = app.screen.width;
    this.appHeight = app.screen.height;
    this.level = level;
    this.carColor = carColor;
    this.buildScene();
  }

  private buildScene() {
    // ─── Sky gradient background ───
    const sky = new Graphics();
    const gradient = new FillGradient(0, 0, 0, this.appHeight);
    gradient.addColorStop(0, 0xF4A97F);   // Dawn coral
    gradient.addColorStop(0.5, 0xFFC87A); // Warm mid
    gradient.addColorStop(1, 0xFFD580);   // Golden bottom
    sky.rect(0, 0, this.appWidth, this.appHeight);
    sky.fill(gradient);
    this.addChild(sky);

    // ─── Subtle horizon line ───
    const horizon = new Graphics();
    const horizonY = this.appHeight * 0.65;
    horizon.moveTo(0, horizonY);
    horizon.lineTo(this.appWidth, horizonY);
    horizon.stroke({ width: 1, color: 0x000000, alpha: 0.06 });
    this.addChild(horizon);

    // ─── Ground plane below horizon ───
    const ground = new Graphics();
    const groundGradient = new FillGradient(0, horizonY, 0, this.appHeight);
    groundGradient.addColorStop(0, 0xE89060);
    groundGradient.addColorStop(1, 0xD07848);
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
      fill: 0x2A1810,
      letterSpacing: 3,
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
    this.addChild(carPreview);
    // Store for fade-in
    (this as any)._carPreview = carPreview;

    // ─── Title ───
    const titleStyle = new TextStyle({
      fontFamily: 'Cormorant Garamond, Georgia, serif',
      fontSize: Math.min(72, this.appWidth * 0.1),
      fontWeight: '300',
      fill: 0x2A1810,
      letterSpacing: 12,
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
      fill: 0x3D2518,
      letterSpacing: 6,
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

    // ─── White transition overlay ───
    this.whiteOverlay = new Graphics();
    this.whiteOverlay.rect(0, 0, this.appWidth, this.appHeight);
    this.whiteOverlay.fill(0xFFFFFF);
    this.whiteOverlay.alpha = 0;
    this.addChild(this.whiteOverlay);
  }

  private createSilhouettes() {
    const horizonY = this.appHeight * 0.65;
    const silhouetteData = [
      // depth 1 (far, slow)
      { type: 'mountain', speed: 0.15, y: horizonY - 60, scale: 1.2, depth: 0.3 },
      { type: 'mountain2', speed: 0.1, y: horizonY - 40, scale: 0.8, depth: 0.3 },
      // depth 2 (mid)
      { type: 'hovercraft', speed: 0.4, y: horizonY + 20, scale: 0.6, depth: 0.6 },
      { type: 'road', speed: 0.35, y: horizonY + 10, scale: 0.5, depth: 0.6 },
      { type: 'gem', speed: 0.45, y: horizonY - 80, scale: 0.4, depth: 0.6 },
      // depth 3 (close, fast)
      { type: 'flower', speed: 0.7, y: horizonY + 50, scale: 0.5, depth: 0.9 },
      { type: 'road2', speed: 0.6, y: horizonY + 30, scale: 0.7, depth: 0.9 },
    ];

    for (const data of silhouetteData) {
      const gfx = new Graphics();
      this.drawSilhouetteShape(gfx, data.type, data.scale);
      gfx.alpha = data.depth * 0.25;
      gfx.x = this.appWidth + Math.random() * this.appWidth;
      gfx.y = data.y + (Math.random() - 0.5) * 20;
      this.addChild(gfx);
      this.silhouettes.push({
        gfx,
        speed: data.speed,
        startX: gfx.x,
        y: gfx.y,
      });
    }
  }

  private drawSilhouetteShape(gfx: Graphics, type: string, scale: number) {
    const color = 0x1A0E08;
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
    bg.fill({ color: 0x2A1810, alpha: 0.15 });
    bg.roundRect(-80, -22, 160, 44, 22);
    bg.stroke({ width: 1.5, color: 0x2A1810, alpha: 0.35 });
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
      fill: 0x2A1810,
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

  public update(delta: number) {
    this.elapsed += delta / 60; // Convert to seconds (at 60fps)

    // ─── Animate silhouettes (right to left) ───
    for (const s of this.silhouettes) {
      s.gfx.x -= s.speed * delta;
      // Gentle vertical bobbing
      s.gfx.y = s.y + Math.sin(this.elapsed * 0.5 + s.startX * 0.01) * 3;
      // Wrap around
      if (s.gfx.x < -300) {
        s.gfx.x = this.appWidth + 200 + Math.random() * 200;
      }
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

    // ─── Fade in button after 2.5s ───
    if (this.elapsed > 2.5 && this.beginButton.alpha < 1) {
      this.beginButton.alpha = Math.min(1, this.beginButton.alpha + 0.025 * delta);
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
