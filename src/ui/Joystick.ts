/* DRIFTWORLD — Mobile Joystick */
import type { HovercraftInput } from '../game/Hovercraft';

export class Joystick {
  private zone: HTMLDivElement;
  private base: HTMLDivElement;
  private thumb: HTMLDivElement;
  private active = false;
  private originX = 0;
  private originY = 0;
  public joyX = 0;
  public joyY = 0;
  private isMobile: boolean;

  constructor() {
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    this.zone = document.createElement('div');
    this.zone.className = 'joystick-zone';

    this.base = document.createElement('div');
    this.base.className = 'joystick-base';

    this.thumb = document.createElement('div');
    this.thumb.className = 'joystick-thumb';

    this.zone.appendChild(this.base);
    this.zone.appendChild(this.thumb);
    document.body.appendChild(this.zone);

    if (!this.isMobile) {
      this.zone.style.display = 'none';
      return;
    }

    this.zone.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    this.zone.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.zone.addEventListener('touchend', this.onTouchEnd.bind(this));
    this.zone.addEventListener('touchcancel', this.onTouchEnd.bind(this));
  }

  private onTouchStart(e: TouchEvent) {
    e.preventDefault();
    const touch = e.touches[0];
    this.active = true;
    this.originX = touch.clientX;
    this.originY = touch.clientY;

    this.base.style.display = 'block';
    this.thumb.style.display = 'block';
    this.base.style.left = (this.originX - 60) + 'px';
    this.base.style.top = (this.originY - 60) + 'px';
    this.thumb.style.left = (this.originX - 22) + 'px';
    this.thumb.style.top = (this.originY - 22) + 'px';
  }

  private onTouchMove(e: TouchEvent) {
    e.preventDefault();
    if (!this.active) return;
    const touch = e.touches[0];
    const dx = touch.clientX - this.originX;
    const dy = touch.clientY - this.originY;
    const maxDist = 50;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);

    this.joyX = (Math.cos(angle) * clampedDist) / maxDist;
    this.joyY = (Math.sin(angle) * clampedDist) / maxDist;

    const thumbX = this.originX + Math.cos(angle) * clampedDist;
    const thumbY = this.originY + Math.sin(angle) * clampedDist;
    this.thumb.style.left = (thumbX - 22) + 'px';
    this.thumb.style.top = (thumbY - 22) + 'px';
  }

  private onTouchEnd() {
    this.active = false;
    this.joyX = 0;
    this.joyY = 0;
    this.base.style.display = 'none';
    this.thumb.style.display = 'none';
  }

  getInput(): Pick<HovercraftInput, 'joyX' | 'joyY'> {
    return { joyX: this.joyX, joyY: this.joyY };
  }
}
