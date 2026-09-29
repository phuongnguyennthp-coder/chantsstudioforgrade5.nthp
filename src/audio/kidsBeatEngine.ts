export function parseAudioSource(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Google Drive Audio (direct download / stream link)
  const gDriveMatch = trimmed.match(
    /drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([\w-]+)/
  );
  if (gDriveMatch) {
    return `https://docs.google.com/uc?export=download&id=${gDriveMatch[1]}`;
  }

  // Dropbox Direct Audio Stream
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace('dl=0', 'raw=1');
  }

  return trimmed;
}

export type ChantBeatStyle = 'pop_chant' | 'hiphop_kids' | 'clap_march' | 'rocking';

export class KidsBeatEngine {
  private ctx: AudioContext | null = null;
  private isBeatPlaying: boolean = false;
  private bpm: number = 90;
  private animId: number | null = null;
  private lastBeatTime: number = 0;
  private beatCounter: number = 0;
  private beatStyle: ChantBeatStyle = 'pop_chant';

  // Audio nodes
  private masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  // Microphone recording & visualizer
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordedAudioBlob: Blob | null = null;
  private recordedAudioUrl: string | null = null;
  private playbackAudio: HTMLAudioElement | null = null;
  private isRecording: boolean = false;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  public micAnalyser: AnalyserNode | null = null;
  private beatVolume: number = 0.7;

  // Custom audio element for teacher's uploaded beat
  private customBeatAudio: HTMLAudioElement | null = null;

  // Callbacks
  private onBeatTickCallbacks: Set<(beat: number) => void> = new Set();
  private onBeatStateCallbacks: Set<(playing: boolean) => void> = new Set();

  constructor() {
    // Auto unlock on first user gesture for iOS Safari & Android Web Audio policy
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudioContext();
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('touchend', unlock);
        window.removeEventListener('click', unlock);
      };
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('touchend', unlock, { passive: true });
      window.addEventListener('click', unlock, { passive: true });
    }
  }

  private initContext() {
    if (this.ctx && this.ctx.state !== 'closed') return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  // iOS Safari / Android Web Audio unlocker helper
  public unlockAudioContext() {
    this.initContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    try {
      const buffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
    } catch {
      // ignore
    }
  }

  public setBpm(newBpm: number) {
    this.bpm = Math.max(60, Math.min(160, newBpm));
  }

  public getBpm(): number {
    return this.bpm;
  }

  public setChantBeatStyle(style: ChantBeatStyle) {
    this.beatStyle = style;
  }

  public getChantBeatStyle(): ChantBeatStyle {
    return this.beatStyle;
  }

  public setBeatVolume(vol: number) {
    this.beatVolume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.beatVolume, this.ctx.currentTime);
    }
    if (this.customBeatAudio) {
      this.customBeatAudio.volume = this.beatVolume;
    }
  }

  public setCustomBeatAudio(url: string | null) {
    if (this.customBeatAudio) {
      this.customBeatAudio.pause();
      this.customBeatAudio.src = '';
      this.customBeatAudio = null;
    }
    const resolvedUrl = parseAudioSource(url);
    if (resolvedUrl) {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = this.beatVolume;
        audio.loop = true;
        // If file fails (e.g. invalid blob on remote student device, 404, or network issue),
        // gracefully fall back to procedural Smart Kids Rhythm Synth so silence never happens!
        audio.addEventListener('error', (e) => {
          console.warn('Custom beat audio failed to load, falling back to smart beat synth:', e);
          if (this.customBeatAudio === audio) {
            this.customBeatAudio = null;
          }
        });
        audio.src = resolvedUrl;
        this.customBeatAudio = audio;
      } catch (err) {
        console.warn('Failed to init custom beat audio, using smart synth:', err);
        this.customBeatAudio = null;
      }
    }
  }

  public async startBeat() {
    this.initContext();
    this.unlockAudioContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    if (this.isBeatPlaying) return;

    this.isBeatPlaying = true;
    this.notifyBeatState(true);

    if (this.customBeatAudio) {
      try {
        this.customBeatAudio.currentTime = 0;
        await this.customBeatAudio.play();
      } catch (e) {
        console.warn('Custom beat play rejected, auto-fallback to smart synth:', e);
        this.customBeatAudio = null;
      }
    }

    this.lastBeatTime = performance.now();
    this.beatCounter = 0;
    this.runBeatLoop();
  }

  public playTingTing() {
    this.initContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    const chimes = [1046.5, 1318.5, 1567.98]; // C6, E6, G6
    chimes.forEach((freq, idx) => {
      const chimeTime = now + idx * 0.18;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, chimeTime);

      // Bell harmonics overtone
      const overtone = this.ctx!.createOscillator();
      const overGain = this.ctx!.createGain();
      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2.76, chimeTime);

      gain.gain.setValueAtTime(0.001, chimeTime);
      gain.gain.linearRampToValueAtTime(0.35, chimeTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, chimeTime + 0.9);

      overGain.gain.setValueAtTime(0.12, chimeTime);
      overGain.gain.exponentialRampToValueAtTime(0.0001, chimeTime + 0.5);

      osc.connect(gain);
      overtone.connect(overGain);
      gain.connect(this.ctx!.destination);
      overGain.connect(this.ctx!.destination);

      osc.start(chimeTime);
      overtone.start(chimeTime);
      osc.stop(chimeTime + 0.95);
      overtone.stop(chimeTime + 0.55);
    });
  }

  public playTickTick() {
    this.initContext();
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    const now = this.ctx.currentTime;
    const ticks = [680, 520]; // Gentle wooden clicks
    ticks.forEach((freq, idx) => {
      const tickTime = now + idx * 0.16;
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, tickTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, tickTime + 0.04);

      gain.gain.setValueAtTime(0.001, tickTime);
      gain.gain.linearRampToValueAtTime(0.28, tickTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, tickTime + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(tickTime);
      osc.stop(tickTime + 0.07);
    });
  }

  public stopBeat() {
    this.isBeatPlaying = false;
    if (this.animId !== null) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.customBeatAudio) {
      this.customBeatAudio.pause();
    }
    this.notifyBeatState(false);
  }

  private runBeatLoop = () => {
    if (!this.isBeatPlaying || !this.ctx) return;

    const now = performance.now();
    const intervalMs = (60 / this.bpm) * 1000;

    if (now - this.lastBeatTime >= intervalMs) {
      this.lastBeatTime = now;
      this.beatCounter = (this.beatCounter % 4) + 1;

      // Play joyful kid drum & chord rhythm
      if (!this.customBeatAudio) {
        this.playBeatSound(this.beatCounter);
      }

      this.onBeatTickCallbacks.forEach((cb) => cb(this.beatCounter));
    }

    this.animId = requestAnimationFrame(this.runBeatLoop);
  };

  private playBeatSound(beatNumber: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    switch (this.beatStyle) {
      case 'hiphop_kids': {
        // Deep punchy Sub 808 Kick on beat 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          const kickOsc = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kickOsc.frequency.setValueAtTime(180, now);
          kickOsc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
          kickGain.gain.setValueAtTime(0.48, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
          kickOsc.connect(kickGain);
          kickGain.connect(this.masterGain);
          kickOsc.start(now);
          kickOsc.stop(now + 0.26);
        }

        // Crisp snappy Rimshot / Snare on beat 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
          const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
          const whiteNoise = this.ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'highpass';
          filter.frequency.setValueAtTime(1800, now);
          const snareGain = this.ctx.createGain();
          snareGain.gain.setValueAtTime(0.35, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          whiteNoise.connect(filter);
          filter.connect(snareGain);
          snareGain.connect(this.masterGain);
          whiteNoise.start(now);
          whiteNoise.stop(now + 0.1);
        }

        // Rhythmic Hi-Hat tick on all beats
        const hatBufferSize = Math.floor(this.ctx.sampleRate * 0.035);
        const hatBuffer = this.ctx.createBuffer(1, hatBufferSize, this.ctx.sampleRate);
        const hatOut = hatBuffer.getChannelData(0);
        for (let i = 0; i < hatBufferSize; i++) hatOut[i] = Math.random() * 2 - 1;
        const hatSource = this.ctx.createBufferSource();
        hatSource.buffer = hatBuffer;
        const hatFilter = this.ctx.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.setValueAtTime(7500, now);
        const hatGain = this.ctx.createGain();
        hatGain.gain.setValueAtTime(0.12, now);
        hatGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        hatSource.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(this.masterGain);
        hatSource.start(now);
        hatSource.stop(now + 0.04);

        // Funky Kids Bass Tone
        const bassFreqs = [65.4, 73.4, 82.4, 98.0]; // C2, D2, E2, G2
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(bassFreqs[(beatNumber - 1) % bassFreqs.length], now);
        const bassFilter = this.ctx.createBiquadFilter();
        bassFilter.type = 'lowpass';
        bassFilter.frequency.setValueAtTime(320, now);
        bassGain.gain.setValueAtTime(0.2, now);
        bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        bassOsc.connect(bassFilter);
        bassFilter.connect(bassGain);
        bassGain.connect(this.masterGain);
        bassOsc.start(now);
        bassOsc.stop(now + 0.3);
        break;
      }

      case 'clap_march': {
        // Marching wooden click on all beats
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(beatNumber === 1 ? 820 : 640, now);
        clickOsc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
        clickGain.gain.setValueAtTime(0.32, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        clickOsc.connect(clickGain);
        clickGain.connect(this.masterGain);
        clickOsc.start(now);
        clickOsc.stop(now + 0.08);

        // Double-Handclap on beat 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          [0, 0.025].forEach((offset) => {
            const bufSize = Math.floor(this.ctx!.sampleRate * 0.09);
            const buf = this.ctx!.createBuffer(1, bufSize, this.ctx!.sampleRate);
            const data = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
            const src = this.ctx!.createBufferSource();
            src.buffer = buf;
            const flt = this.ctx!.createBiquadFilter();
            flt.type = 'bandpass';
            flt.frequency.setValueAtTime(1400, now + offset);
            const clpGain = this.ctx!.createGain();
            clpGain.gain.setValueAtTime(0.3, now + offset);
            clpGain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);
            src.connect(flt);
            flt.connect(clpGain);
            clpGain.connect(this.masterGain!);
            src.start(now + offset);
            src.stop(now + offset + 0.09);
          });
        }

        // Brass fanfare stab on beat 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          [261.63, 392.0].forEach((freq) => {
            const brassOsc = this.ctx!.createOscillator();
            const brassGain = this.ctx!.createGain();
            brassOsc.type = 'sawtooth';
            brassOsc.frequency.setValueAtTime(freq, now);
            brassGain.gain.setValueAtTime(0.12, now);
            brassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
            brassOsc.connect(brassGain);
            brassGain.connect(this.masterGain!);
            brassOsc.start(now);
            brassOsc.stop(now + 0.24);
          });
        }
        break;
      }

      case 'rocking': {
        // Rock Drum Kick on 1 & 3
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.frequency.setValueAtTime(200, now);
        kickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.16);
        kickGain.gain.setValueAtTime(0.45, now);
        kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
        kickOsc.connect(kickGain);
        kickGain.connect(this.masterGain);
        kickOsc.start(now);
        kickOsc.stop(now + 0.2);

        // Loud Rock Snare on 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          const bufSize = Math.floor(this.ctx.sampleRate * 0.14);
          const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
          const data = buf.getChannelData(0);
          for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
          const src = this.ctx.createBufferSource();
          src.buffer = buf;
          const flt = this.ctx.createBiquadFilter();
          flt.type = 'bandpass';
          flt.frequency.setValueAtTime(1050, now);
          const snareGain = this.ctx.createGain();
          snareGain.gain.setValueAtTime(0.35, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
          src.connect(flt);
          flt.connect(snareGain);
          snareGain.connect(this.masterGain);
          src.start(now);
          src.stop(now + 0.15);
        }

        // Power Fifth Chord Stabs (C, G, A, F)
        const powerRoots = [261.63, 329.63, 220.0, 349.23];
        const root = powerRoots[(beatNumber - 1) % powerRoots.length];
        [root, root * 1.5].forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now);
          osc.stop(now + 0.3);
        });
        break;
      }

      case 'pop_chant':
      default: {
        // Standard Joyful Pop Chant Drum Kick on 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          const kickOsc = this.ctx.createOscillator();
          const kickGain = this.ctx.createGain();
          kickOsc.frequency.setValueAtTime(160, now);
          kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.15);
          kickGain.gain.setValueAtTime(0.4, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
          kickOsc.connect(kickGain);
          kickGain.connect(this.masterGain);
          kickOsc.start(now);
          kickOsc.stop(now + 0.2);
        }

        // Handclap / Snare on beat 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
          const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
          const output = noiseBuffer.getChannelData(0);
          for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
          const whiteNoise = this.ctx.createBufferSource();
          whiteNoise.buffer = noiseBuffer;
          const filter = this.ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1200, now);
          filter.Q.setValueAtTime(1.5, now);
          const snareGain = this.ctx.createGain();
          snareGain.gain.setValueAtTime(0.28, now);
          snareGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          whiteNoise.connect(filter);
          filter.connect(snareGain);
          snareGain.connect(this.masterGain);
          whiteNoise.start(now);
          whiteNoise.stop(now + 0.13);
        }

        // Melodic Toy Piano chord progression
        const chordFrequencies = [
          [261.63, 329.63, 392.0], // C major
          [329.63, 392.0, 523.25], // E minor / G
          [220.0, 261.63, 329.63], // A minor
          [174.61, 220.0, 261.63], // F major
        ];
        const notes = chordFrequencies[(beatNumber - 1) % chordFrequencies.length];
        notes.forEach((freq, idx) => {
          const osc = this.ctx!.createOscillator();
          const gain = this.ctx!.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq * (idx === 0 ? 1 : 1.5), now);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.09, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc.connect(gain);
          gain.connect(this.masterGain!);
          osc.start(now);
          osc.stop(now + 0.38);
        });
        break;
      }
    }
  }

  // --- Real Microphone Voice Recording ---
  public async startRecording(): Promise<boolean> {
    try {
      this.initContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;

      // Connect mic to analyser for visual meter (do not connect to masterGain to prevent acoustic feedback!)
      if (this.ctx) {
        this.micSource = this.ctx.createMediaStreamSource(stream);
        this.micAnalyser = this.ctx.createAnalyser();
        this.micAnalyser.fftSize = 64;
        this.micSource.connect(this.micAnalyser);
      }

      this.mediaRecorder = new MediaRecorder(stream);
      this.recordedChunks = [];

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.recordedAudioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        if (this.recordedAudioUrl) {
          URL.revokeObjectURL(this.recordedAudioUrl);
        }
        this.recordedAudioUrl = URL.createObjectURL(this.recordedAudioBlob);
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      // Start the backing track beat simultaneously so the student sings with the rhythm!
      this.startBeat();
      return true;
    } catch (err) {
      console.warn('Microphone error:', err);
      this.isRecording = false;
      return false;
    }
  }

  public getMicVolume(): number {
    if (!this.micAnalyser || !this.isRecording) return 0;
    const data = new Uint8Array(this.micAnalyser.frequencyBinCount);
    this.micAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    const avg = sum / (data.length || 1);
    return Math.min(100, Math.round((avg / 128) * 100));
  }

  public stopRecording(): string | null {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }
    this.stopBeat();
    return this.recordedAudioUrl;
  }

  public playStudentRecording(onEnded?: () => void) {
    if (!this.recordedAudioUrl) return;
    if (this.playbackAudio) {
      this.playbackAudio.pause();
    }
    this.playbackAudio = new Audio(this.recordedAudioUrl);
    this.playbackAudio.play();
    if (onEnded) {
      this.playbackAudio.onended = onEnded;
    }
  }

  public stopStudentRecordingPlayback() {
    if (this.playbackAudio) {
      this.playbackAudio.pause();
      this.playbackAudio.currentTime = 0;
    }
  }

  public getRecordedUrl(): string | null {
    return this.recordedAudioUrl;
  }

  public getRecordedAudioBlob(): Blob | null {
    return this.recordedAudioBlob;
  }

  public getIsPlaying(): boolean {
    return this.isBeatPlaying;
  }

  public getIsRecording(): boolean {
    return this.isRecording;
  }

  public onBeatTick(cb: (beat: number) => void) {
    this.onBeatTickCallbacks.add(cb);
    return () => this.onBeatTickCallbacks.delete(cb);
  }

  public onBeatState(cb: (playing: boolean) => void) {
    this.onBeatStateCallbacks.add(cb);
    return () => this.onBeatStateCallbacks.delete(cb);
  }

  private notifyBeatState(state: boolean) {
    this.onBeatStateCallbacks.forEach((cb) => cb(state));
  }
}

export const kidsBeatEngine = new KidsBeatEngine();
