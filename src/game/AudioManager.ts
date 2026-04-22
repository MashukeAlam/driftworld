/* ═══════════════════════════════════════════════════════
   DRIFTWORLD — Audio Manager
   
   Meditative generative audio inspired by Alto's Odyssey.
   Uses Web Audio API to create:
   - Warm ambient drone that shifts with day/night
   - Soft wind noise layered with filtered harmonics
   - Sparkle chimes on artifact collection
   - Drift bonus sound (rising tone)
   - Gentle expansion whoosh
   ═══════════════════════════════════════════════════════ */

export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain!: GainNode;
  private droneOsc1!: OscillatorNode;
  private droneOsc2!: OscillatorNode;
  private droneGain!: GainNode;
  private windNode!: AudioBufferSourceNode;
  private windGain!: GainNode;
  private windFilter!: BiquadFilterNode;
  private started = false;
  private currentTimeOfDay = 0;

  /**
   * Must be called from a user gesture (click/tap) due to autoplay policy.
   */
  async init() {
    if (this.started) return;
    try {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);

      this.startDrone();
      this.startWind();
      this.startRain();
      this.startBGM();
      this.scheduleThunder();
      this.started = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  private startRain() {
    if (!this.ctx) return;
    // Gentle rain: pink noise through a high-pass filter
    const bufferSize = this.ctx.sampleRate * 6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Pink noise approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
      b6 = white * 0.115926;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;
    filter.Q.value = 0.3;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0.04; // Very gentle

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);
    source.start();
  }

  private scheduleThunder() {
    if (!this.ctx) return;
    // Schedule soft, distant thunder at random intervals
    const playThunder = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Very low rumble
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(40 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(20, now + 2);

      const gain = this.ctx.createGain();
      const vol = 0.04 + Math.random() * 0.03; // Very soft
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.3);
      gain.gain.setValueAtTime(vol * 0.8, now + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);

      // Noise component for texture
      const nBuf = this.ctx.createBuffer(1, this.ctx.sampleRate * 3, this.ctx.sampleRate);
      const nData = nBuf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < nData.length; i++) {
        last = (last + 0.03 * (Math.random() * 2 - 1)) / 1.03;
        nData[i] = last * 4;
      }
      const nSrc = this.ctx.createBufferSource();
      nSrc.buffer = nBuf;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'lowpass';
      nFilter.frequency.value = 150;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0, now);
      nGain.gain.linearRampToValueAtTime(0.03, now + 0.2);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 2);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 3);

      nSrc.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.masterGain);
      nSrc.start(now);
      nSrc.stop(now + 3);

      // Schedule next thunder
      const nextDelay = 15000 + Math.random() * 30000; // 15-45 seconds
      setTimeout(playThunder, nextDelay);
    };

    // First thunder after 10-20 seconds
    setTimeout(playThunder, 10000 + Math.random() * 10000);
  }

  private startBGM() {
    if (!this.ctx) return;
    // Generative BGM: slow pentatonic melody played by a soft sine pad
    const bgmGain = this.ctx.createGain();
    bgmGain.gain.value = 0.06;
    bgmGain.connect(this.masterGain);

    // Pentatonic notes (C major pentatonic across octaves)
    const notes = [262, 294, 330, 392, 440, 523, 587, 659, 784];

    const playNote = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = notes[Math.floor(Math.random() * notes.length)];
      const duration = 2 + Math.random() * 3;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      // Second oscillator slightly detuned for warmth
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 1.002;

      const noteGain = this.ctx.createGain();
      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(0.08, now + 0.4);
      noteGain.gain.setValueAtTime(0.06, now + duration * 0.6);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      const noteGain2 = this.ctx.createGain();
      noteGain2.gain.setValueAtTime(0, now);
      noteGain2.gain.linearRampToValueAtTime(0.03, now + 0.5);
      noteGain2.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.8);

      osc.connect(noteGain);
      osc2.connect(noteGain2);
      noteGain.connect(bgmGain);
      noteGain2.connect(bgmGain);

      osc.start(now);
      osc.stop(now + duration + 0.1);
      osc2.start(now);
      osc2.stop(now + duration + 0.1);

      // Schedule next note
      const nextDelay = (1.5 + Math.random() * 3) * 1000;
      setTimeout(playNote, nextDelay);
    };

    // Start BGM after a short delay
    setTimeout(playNote, 2000);
  }

  private startDrone() {
    if (!this.ctx) return;

    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.value = 0.12;
    this.droneGain.connect(this.masterGain);

    // Warm low drone — two detuned oscillators for thickness
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sine';
    this.droneOsc1.frequency.value = 65; // Low C

    const droneFilter1 = this.ctx.createBiquadFilter();
    droneFilter1.type = 'lowpass';
    droneFilter1.frequency.value = 200;
    droneFilter1.Q.value = 1;

    this.droneOsc1.connect(droneFilter1);
    droneFilter1.connect(this.droneGain);
    this.droneOsc1.start();

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = 'sine';
    this.droneOsc2.frequency.value = 65.5; // Slightly detuned for warmth

    const droneFilter2 = this.ctx.createBiquadFilter();
    droneFilter2.type = 'lowpass';
    droneFilter2.frequency.value = 180;
    droneFilter2.Q.value = 0.8;

    this.droneOsc2.connect(droneFilter2);
    droneFilter2.connect(this.droneGain);
    this.droneOsc2.start();

    // Sub-harmonic for depth
    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.value = 32.5;
    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.06;
    subOsc.connect(subGain);
    subGain.connect(this.masterGain);
    subOsc.start();
  }

  private startWind() {
    if (!this.ctx) return;

    // Generate wind noise buffer
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Brownian noise (smoother than white) for a wind-like texture
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + (0.02 * white)) / 1.02;
      data[i] = lastOut * 3.5;
    }

    this.windNode = this.ctx.createBufferSource();
    this.windNode.buffer = buffer;
    this.windNode.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 600;
    this.windFilter.Q.value = 0.5;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.08;

    this.windNode.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windNode.start();
  }

  /**
   * Update ambient sound based on time-of-day (0–1).
   * Dawn/noon = warmer, brighter. Dusk/night = darker, lower.
   */
  updateTimeOfDay(t: number) {
    if (!this.ctx || !this.started) return;
    this.currentTimeOfDay = t;

    // Shift drone pitch subtly with time
    // Dawn (0): C2, Noon (0.25): D2, Dusk (0.5): Bb1, Night (0.75): G1
    const pitchMap = [65, 73, 58, 49]; // C2, D2, Bb1, G1
    const idx = Math.floor(t * 4) % 4;
    const frac = (t * 4) % 1;
    const nextIdx = (idx + 1) % 4;
    const freq = pitchMap[idx] + (pitchMap[nextIdx] - pitchMap[idx]) * frac;

    const now = this.ctx.currentTime;
    this.droneOsc1.frequency.setTargetAtTime(freq, now, 2);
    this.droneOsc2.frequency.setTargetAtTime(freq + 0.5, now, 2);

    // Wind intensity: higher at dawn/dusk, lower at noon/night
    const windIntensity = 0.05 + Math.sin(t * Math.PI * 2) * 0.04;
    this.windGain.gain.setTargetAtTime(Math.max(0.02, windIntensity), now, 1);

    // Wind pitch: higher during day
    const windFreq = 400 + Math.sin(t * Math.PI * 2 + 0.5) * 200;
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 2);
  }

  /**
   * Play a sparkle chime on artifact collection.
   */
  playCollect(type: 'gem' | 'flower' | 'rare') {
    if (!this.ctx || !this.started) return;

    const now = this.ctx.currentTime;

    // Pentatonic chime notes (different per type)
    const notes: Record<string, number[]> = {
      flower: [523, 659],           // C5, E5
      gem: [659, 784, 988],         // E5, G5, B5
      rare: [784, 988, 1175, 1318], // G5, B5, D6, E6
    };

    const freqs = notes[type] || notes.gem;

    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freqs[i];

      const gain = this.ctx.createGain();
      const startTime = now + i * 0.08;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

      // Slight shimmer with second detuned oscillator
      const osc2 = this.ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = freqs[i] * 2.01; // octave + slight detune

      const gain2 = this.ctx.createGain();
      gain2.gain.setValueAtTime(0, startTime);
      gain2.gain.linearRampToValueAtTime(0.05, startTime + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      osc2.connect(gain2);
      gain.connect(this.masterGain);
      gain2.connect(this.masterGain);

      osc.start(startTime);
      osc.stop(startTime + 0.7);
      osc2.start(startTime);
      osc2.stop(startTime + 0.5);
    }
  }

  /**
   * Play a rising "drift bonus!" tone.
   */
  playDriftBonus() {
    if (!this.ctx || !this.started) return;

    const now = this.ctx.currentTime;

    // Rising arpeggio: quick ascending notes
    const freqs = [523, 659, 784, 1047]; // C5 → E5 → G5 → C6
    for (let i = 0; i < freqs.length; i++) {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freqs[i];

      const gain = this.ctx.createGain();
      const t = now + i * 0.06;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    }

    // Shimmering high pad
    const pad = this.ctx.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = 1568; // G6
    const padGain = this.ctx.createGain();
    padGain.gain.setValueAtTime(0, now);
    padGain.gain.linearRampToValueAtTime(0.06, now + 0.15);
    padGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    pad.connect(padGain);
    padGain.connect(this.masterGain);
    pad.start(now);
    pad.stop(now + 0.9);
  }

  /**
   * Play a gentle expansion whoosh.
   */
  playExpand() {
    if (!this.ctx || !this.started) return;

    const now = this.ctx.currentTime;

    // Rising filtered noise whoosh
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      last = (last + (0.04 * (Math.random() * 2 - 1))) / 1.04;
      data[i] = last * 5;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.linearRampToValueAtTime(1200, now + 0.5);
    filter.frequency.linearRampToValueAtTime(400, now + 1.5);
    filter.Q.value = 2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);
    source.stop(now + 2);

    // Low boom
    const boom = this.ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(80, now);
    boom.frequency.exponentialRampToValueAtTime(40, now + 0.8);
    const boomGain = this.ctx.createGain();
    boomGain.gain.setValueAtTime(0.15, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    boom.connect(boomGain);
    boomGain.connect(this.masterGain);
    boom.start(now);
    boom.stop(now + 1);
  }

  isStarted(): boolean {
    return this.started;
  }
}
