/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Main Entry Point
   
   Flow: Location Picker → Start Screen → Game → Win → Next Level
   ═══════════════════════════════════════════════════════ */

import { Application } from 'pixi.js';
import { StartScreen } from './screens/StartScreen';
import { GameScreen } from './screens/GameScreen';
import { LocationPicker } from './ui/LocationPicker';
import {
  loadLevelState, saveLevelState, getCarColor,
  getSpawnDistanceMeters, calculateSpawnPosition,
  type LevelState,
} from './game/LevelManager';

async function main() {
  // ─── Create Pixi Application ───
  const app = new Application();
  await app.init({
    background: 0x0A0E1A,
    resizeTo: window,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
  });

  const container = document.getElementById('game-container')!;
  container.appendChild(app.canvas);

  // ─── Level State ───
  let state: LevelState = loadLevelState() || {
    level: 1,
    homeLat: 0,
    homeLng: 0,
    homeLabel: '',
    carColor: getCarColor(1),
  };

  async function startLevel() {
    const level = state.level;
    const carColor = getCarColor(level);
    state.carColor = carColor;
    const carColorHex = '#' + carColor.toString(16).padStart(6, '0');

    // ─── Location Picker (only if no home set) ───
    if (!state.homeLat && !state.homeLng) {
      const picker = new LocationPicker();
      const location = await picker.show(level, carColorHex);
      state.homeLat = location.lat;
      state.homeLng = location.lng;
      state.homeLabel = location.label;
      saveLevelState(state);
    }

    // ─── Calculate spawn position ───
    const spawnDist = getSpawnDistanceMeters(level);
    const spawn = calculateSpawnPosition(state.homeLat, state.homeLng, spawnDist);

    // ─── Start Screen ───
    const startScreen = new StartScreen(app, level, carColor);
    app.stage.addChild(startScreen);

    await new Promise<void>((resolve) => {
      // Animate start screen
      const startTicker = (ticker: { deltaTime: number }) => {
        startScreen.update(ticker.deltaTime);
      };
      app.ticker.add(startTicker);

      startScreen.onStart = () => {
        app.ticker.remove(startTicker);

        const loadingEl = document.createElement('div');
        loadingEl.className = 'loading-screen';
        loadingEl.innerHTML = `
          <div class="loading-text">MAPPING THE WORLD</div>
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        `;
        document.body.appendChild(loadingEl);

        setTimeout(() => {
          app.stage.removeChild(startScreen);
          resolve();
        }, 400);
      };
    });

    // ─── Game Screen ───
    const gameScreen = new GameScreen(app, {
      spawnLat: spawn.lat,
      spawnLng: spawn.lng,
      homeLat: state.homeLat,
      homeLng: state.homeLng,
      homeLabel: state.homeLabel,
      level: level,
      carColor: carColor,
    });
    app.stage.addChild(gameScreen);

    const gameTicker = (ticker: { deltaTime: number }) => {
      gameScreen.update(ticker.deltaTime);
    };
    app.ticker.add(gameTicker);

    // Wait for win
    await new Promise<void>((resolve) => {
      gameScreen.onWin = () => {
        app.ticker.remove(gameTicker);

        // Show win overlay
        const winOverlay = document.createElement('div');
        winOverlay.className = 'win-overlay';
        const nextColor = getCarColor(level + 1);
        const nextHex = '#' + nextColor.toString(16).padStart(6, '0');
        winOverlay.innerHTML = `
          <div class="win-title">HOME!</div>
          <div class="win-subtitle">Level ${level} complete — ${state.homeLabel}</div>
          <div class="win-subtitle" style="color:${nextHex}; margin-top: 8px;">🚗 New car color unlocked!</div>
          <button class="win-btn" id="next-level-btn">NEXT LEVEL</button>
        `;
        document.body.appendChild(winOverlay);

        document.getElementById('next-level-btn')!.addEventListener('click', () => {
          winOverlay.remove();
          app.stage.removeChild(gameScreen);
          resolve();
        });
      };
    });

    // ─── Next Level ───
    state.level++;
    state.carColor = getCarColor(state.level);
    saveLevelState(state);
    startLevel(); // Recursive — start next level
  }

  startLevel();
}

main().catch(console.error);
