/* DRIFTWORLD — HUD */
import type { Palette } from '../config/palettes';
import { colorToHex } from '../config/palettes';

export class HUD {
  private overlay: HTMLElement;
  private statsEl!: HTMLDivElement;
  private artifactEl!: HTMLSpanElement;
  private pointsEl!: HTMLSpanElement;
  private roadNameEl!: HTMLDivElement;

  constructor() {
    this.overlay = document.getElementById('hud-overlay')!;
    this.build();
  }

  private build() {
    // Stats (top-left)
    this.statsEl = document.createElement('div');
    this.statsEl.className = 'hud-stats';
    this.statsEl.innerHTML = `
      <div class="hud-stat"><span class="icon">◆</span><span id="hud-artifacts">0</span></div>
      <div class="hud-stat"><span class="icon">✦</span><span id="hud-points">0 pts</span></div>
    `;
    this.overlay.appendChild(this.statsEl);
    this.artifactEl = document.getElementById('hud-artifacts') as HTMLSpanElement;
    this.pointsEl = document.getElementById('hud-points') as HTMLSpanElement;

    // Road name indicator (top-center)
    this.roadNameEl = document.createElement('div');
    this.roadNameEl.className = 'hud-day-indicator';
    this.roadNameEl.style.cssText = `
      font-family: Outfit, sans-serif;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: rgba(255,245,230,0.6);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
      transition: opacity 0.4s ease;
      max-width: 300px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `;
    this.overlay.appendChild(this.roadNameEl);
  }

  updateStats(artifacts: number, points: number) {
    this.artifactEl.textContent = String(artifacts);
    this.pointsEl.textContent = `${points} pts`;
  }

  updateRoadName(name: string) {
    if (name && name.trim()) {
      this.roadNameEl.textContent = name;
      this.roadNameEl.style.opacity = '1';
    } else {
      this.roadNameEl.style.opacity = '0.3';
      this.roadNameEl.textContent = 'unnamed road';
    }
  }

  updatePalette(palette: Palette) {
    const color = colorToHex(palette.textColor);
    this.statsEl.style.color = color;
  }

  show() { this.overlay.style.opacity = '1'; }
  hide() { this.overlay.style.opacity = '0'; }
}
