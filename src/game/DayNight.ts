/* DRIFTWORLD — Day/Night Cycle */
import { DAY_CYCLE_DURATION } from '../config/constants';
import { getPalette, type Palette } from '../config/palettes';

export class DayNight {
  private time = 0.02;
  private speed: number;

  constructor() {
    this.speed = 1 / DAY_CYCLE_DURATION;
  }

  update(deltaTicks: number) {
    const deltaSeconds = deltaTicks / 60;
    this.time = (this.time + this.speed * deltaSeconds) % 1;
  }

  getPalette(): Palette {
    return getPalette(this.time);
  }

  getTime(): number {
    return this.time;
  }

  getPhaseName(): string {
    if (this.time < 0.2) return 'Dawn';
    if (this.time < 0.45) return 'Day';
    if (this.time < 0.65) return 'Dusk';
    return 'Night';
  }
}
