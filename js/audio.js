// =========================================================
// PROCEDURELE WEB AUDIO ENGINE (INCL. KALKOEN-GOBBLE!)
// =========================================================
export class CozySoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.initialized = false;
    this.lastGobble = 0;
  }

  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);

    const bufSize = this.ctx.sampleRate * 2;
    this.noiseBuffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    this.engFilter = this.ctx.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 260;

    this.engGain = this.ctx.createGain();
    this.engGain.gain.value = 0.15;

    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = 48;

    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 96;

    this.osc1.connect(this.engFilter);
    this.osc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.osc1.start();
    this.osc2.start();

    this.skidNoise = this.ctx.createBufferSource();
    this.skidNoise.buffer = this.noiseBuffer;
    this.skidNoise.loop = true;

    this.skidFilter = this.ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1350;
    this.skidFilter.Q.value = 4.5;

    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.value = 0;

    this.skidNoise.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.master);
    this.skidNoise.start();

    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 650;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();

    this.initialized = true;
  }

  toggleMute() {
    this.init();
    this.muted = !this.muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
    return !this.muted;
  }

  updateContinuous(speedAbs, maxSpeed, throttleHold, isDrifting, onAsphalt, sirenProximity, elapsed) {
    if (!this.initialized || this.muted) return null;
    const now = this.ctx.currentTime;

    const speedRatio = Math.min(1.15, speedAbs / Math.max(1, maxSpeed));
    const gearFloat = speedRatio * 4.6;
    const gearIdx = Math.min(5, Math.floor(gearFloat) + 1);
    const gearRpm = speedAbs < 0.8 ? 0.12 : 0.32 + (gearFloat % 1) * 0.68;
    const rpmCombined = Math.min(1.0, gearRpm * 0.72 + throttleHold * 0.35);

    const baseFreq = 38 + rpmCombined * 95 + gearIdx * 9;
    this.osc1.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.osc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
    this.engFilter.frequency.setTargetAtTime(190 + rpmCombined * 780, now, 0.05);
    this.engGain.gain.setTargetAtTime(0.11 + throttleHold * 0.13 + speedRatio * 0.06, now, 0.06);

    if (isDrifting) {
      this.skidFilter.frequency.setTargetAtTime(onAsphalt ? 1420 : 520, now, 0.04);
      this.skidFilter.Q.setTargetAtTime(onAsphalt ? 5.5 : 1.2, now, 0.04);
      this.skidGain.gain.setTargetAtTime(onAsphalt ? 0.17 : 0.21, now, 0.04);
    } else {
      this.skidGain.gain.setTargetAtTime(0, now, 0.06);
    }

    if (sirenProximity > 0.01) {
      const wail = 860 + Math.sin(elapsed * 4.2) * 310;
      this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
      this.sirenGain.gain.setTargetAtTime(Math.min(0.17, sirenProximity * 0.17), now, 0.08);
    } else {
      this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
    }

    return { gear: speedAbs < 0.6 ? 'N' : `${gearIdx}`, rpmPct: Math.round(rpmCombined * 100) };
  }

  playImpact(kind = 'small') {
    if (!this.initialized || this.muted) return;
    const now = this.ctx.currentTime;

    if (kind === 'shrub') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.value = 1800;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.14, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(now); src.stop(now + 0.17);
    } else if (kind === 'tree') {
      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(125, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.36);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.42, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(g); g.connect(this.master);
      osc.start(now); osc.stop(now + 0.4);
    } else if (kind === 'splash') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 900;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.10, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      src.connect(flt); flt.connect(g); g.connect(this.master);
      src.start(now); src.stop(now + 0.16);
    } else {
      const osc = this.ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.2);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.25, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(g); g.connect(this.master);
      osc.start(now); osc.stop(now + 0.23);
    }
  }

  // Grappig kalkoen-gekakel ("Gobble-gobble-gobble!") wanneer een kalkoen opschrikt!
  playTurkeyGobble() {
    if (!this.initialized || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastGobble < 1.2) return;
    this.lastGobble = now;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 22;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 110;

    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(360, now + 0.32);
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass';
    flt.frequency.value = 900;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);

    osc.connect(flt); flt.connect(g); g.connect(this.master);
    osc.start(now); lfo.start(now);
    osc.stop(now + 0.35); lfo.stop(now + 0.35);
  }

  playHorn() {
    if (!this.initialized || this.muted) return;
    const now = this.ctx.currentTime;
    [340, 425].forEach((freq) => {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'lowpass';
      flt.frequency.value = 1100;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.17, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      osc.connect(flt); flt.connect(g); g.connect(this.master);
      osc.start(now); osc.stop(now + 0.34);
    });
  }
}

export const sound = new CozySoundEngine();
