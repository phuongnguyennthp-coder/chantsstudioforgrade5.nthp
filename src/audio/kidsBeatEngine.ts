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

  // Helper synthesizer voices for punchy elementary chant drums
  private playKick(time: number, startFreq = 220, endFreq = 42, gainVal = 0.65, duration = 0.22) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + duration * 0.75);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    } catch {}
  }

  private playSnare(time: number, filterFreq = 1600, gainVal = 0.42, duration = 0.14) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const bufSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(filterFreq, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      // Add a resonant body tone to snare
      const bodyOsc = this.ctx.createOscillator();
      const bodyGain = this.ctx.createGain();
      bodyOsc.frequency.setValueAtTime(190, time);
      bodyOsc.frequency.exponentialRampToValueAtTime(80, time + 0.08);
      bodyGain.gain.setValueAtTime(gainVal * 0.6, time);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(this.masterGain);

      noise.start(time);
      noise.stop(time + duration);
      bodyOsc.start(time);
      bodyOsc.stop(time + 0.09);
    } catch {}
  }

  private playClap(time: number, gainVal = 0.45) {
    if (!this.ctx || !this.masterGain) return;
    try {
      // Layered double-clap simulating kids clapping together
      [0, 0.022].forEach((offset) => {
        const t = time + offset;
        const bufSize = Math.floor(this.ctx!.sampleRate * 0.1);
        const buf = this.ctx!.createBuffer(1, bufSize, this.ctx!.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

        const src = this.ctx!.createBufferSource();
        src.buffer = buf;
        const flt = this.ctx!.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.setValueAtTime(1400, t);
        flt.Q.setValueAtTime(2, t);

        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(gainVal, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

        src.connect(flt);
        flt.connect(gain);
        gain.connect(this.masterGain!);
        src.start(t);
        src.stop(t + 0.1);
      });
    } catch {}
  }

  private playHiHat(time: number, gainVal = 0.15, isOpen = false) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const dur = isOpen ? 0.12 : 0.035;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7800, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      source.start(time);
      source.stop(time + dur + 0.01);
    } catch {}
  }

  private playShaker(time: number, gainVal = 0.12) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const dur = 0.04;
      const bufSize = Math.floor(this.ctx.sampleRate * dur);
      const buffer = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(6200, time);
      flt.Q.setValueAtTime(1.8, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      src.connect(flt);
      flt.connect(gain);
      gain.connect(this.masterGain);
      src.start(time);
      src.stop(time + dur + 0.01);
    } catch {}
  }

  private playBass(time: number, freq: number, gainVal = 0.22, duration = 0.26) {
    if (!this.ctx || !this.masterGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, time);
      filter.frequency.exponentialRampToValueAtTime(150, time + duration);

      gain.gain.setValueAtTime(gainVal, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    } catch {}
  }

  private playChords(time: number, freqs: number[], gainVal = 0.08, duration = 0.3) {
    if (!this.ctx || !this.masterGain) return;
    try {
      freqs.forEach((f) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, time);
        gain.gain.setValueAtTime(0.001, time);
        gain.gain.linearRampToValueAtTime(gainVal, time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

        osc.connect(gain);
        gain.connect(this.masterGain!);
        osc.start(time);
        osc.stop(time + duration + 0.02);
      });
    } catch {}
  }

  private playBeatSound(beatNumber: number) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const halfBeat = 60 / this.bpm / 2;

    switch (this.beatStyle) {
      case 'hiphop_kids': {
        // Deep punchy 808 Kick on beat 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          this.playKick(now, 240, 36, 0.75, 0.28);
        }
        // Ghost bounce kick on the "&" of beat 3
        if (beatNumber === 3) {
          this.playKick(now + halfBeat, 140, 38, 0.38, 0.16);
        }

        // Crisp snappy Rimshot / Snare on beat 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          this.playSnare(now, 1900, 0.48, 0.12);
          this.playClap(now, 0.3);
        }

        // Hi-Hat groove on all 8th notes (onbeat & offbeat)
        this.playHiHat(now, 0.18, false);
        this.playHiHat(now + halfBeat, 0.14, false);

        // Bouncy Hip-hop Bassline (C2, Eb2, F2, G2)
        const hiphopBassNotes = [65.41, 77.78, 87.31, 98.0];
        const bassNote = hiphopBassNotes[(beatNumber - 1) % hiphopBassNotes.length];
        this.playBass(now, bassNote, 0.28, 0.32);
        break;
      }

      case 'clap_march': {
        // Marching wooden click on all beats
        const clickOsc = this.ctx.createOscillator();
        const clickGain = this.ctx.createGain();
        clickOsc.type = 'triangle';
        clickOsc.frequency.setValueAtTime(beatNumber === 1 ? 880 : 660, now);
        clickOsc.frequency.exponentialRampToValueAtTime(140, now + 0.05);
        clickGain.gain.setValueAtTime(0.35, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        clickOsc.connect(clickGain);
        clickGain.connect(this.masterGain);
        clickOsc.start(now);
        clickOsc.stop(now + 0.07);

        // Bass drum stomp on 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          this.playKick(now, 170, 38, 0.68, 0.22);
          // Fanfare brass stabs
          this.playChords(now, [261.63, 392.0, 523.25], 0.14, 0.24);
        }

        // Realistic double-clap on beat 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          this.playClap(now, 0.55);
          this.playSnare(now, 1500, 0.35, 0.1);
        }

        // Offbeat shaker
        this.playShaker(now + halfBeat, 0.14);
        break;
      }

      case 'rocking': {
        // Heavy Rock Kick on 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          this.playKick(now, 220, 42, 0.72, 0.22);
        }

        // Powerful Rock Snare on 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          this.playSnare(now, 1200, 0.52, 0.16);
        }

        // Rock Hi-Hat: closed on beat, open sizzle on offbeat
        this.playHiHat(now, 0.18, false);
        this.playHiHat(now + halfBeat, 0.15, beatNumber === 2 || beatNumber === 4);

        // Power 5th Chords (C5, G5, A5, F5)
        const rockRoots = [261.63, 392.0, 220.0, 349.23];
        const root = rockRoots[(beatNumber - 1) % rockRoots.length];
        this.playChords(now, [root, root * 1.5], 0.12, 0.28);
        this.playBass(now, root / 2, 0.25, 0.26);
        break;
      }

      case 'pop_chant':
      default: {
        // Joyful, punchy Pop Chant Kick on 1 & 3
        if (beatNumber === 1 || beatNumber === 3) {
          this.playKick(now, 200, 45, 0.65, 0.2);
        }

        // Crisp Handclap & Snare on 2 & 4
        if (beatNumber === 2 || beatNumber === 4) {
          this.playClap(now, 0.48);
          this.playSnare(now, 1400, 0.38, 0.12);
        }

        // Energetic 8th-note shaker on every offbeat
        this.playShaker(now + halfBeat, 0.15);
        this.playHiHat(now, 0.12, false);

        // Cheerful toy piano synth chords (C, Em, Am, F)
        const popChords = [
          [261.63, 329.63, 392.0],  // C
          [329.63, 392.0, 493.88],  // Em
          [220.0, 261.63, 329.63],  // Am
          [174.61, 220.0, 261.63],  // F
        ];
        const chord = popChords[(beatNumber - 1) % popChords.length];
        this.playChords(now, chord, 0.1, 0.32);
        this.playBass(now, chord[0] / 2, 0.22, 0.24);
        break;
      }
    }
  }

  // --- Real Microphone Voice Recording ---
  public async startRecording(withBeat: boolean = false): Promise<boolean> {
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
        try {
          this.recordedAudioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          if (this.recordedAudioUrl) {
            URL.revokeObjectURL(this.recordedAudioUrl);
          }
          this.recordedAudioUrl = URL.createObjectURL(this.recordedAudioBlob);
        } catch (e) {
          console.warn('Error creating audio blob:', e);
        }
      };

      this.mediaRecorder.start();
      this.isRecording = true;

      // ONLY start the backing beat if explicitly requested (e.g. for Challenge Beat)
      if (withBeat) {
        this.startBeat();
      }
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

  public async stopRecording(): Promise<string | null> {
    return new Promise((resolve) => {
      if (this.mediaRecorder && this.isRecording) {
        this.mediaRecorder.onstop = () => {
          try {
            this.recordedAudioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
            if (this.recordedAudioUrl) {
              URL.revokeObjectURL(this.recordedAudioUrl);
            }
            this.recordedAudioUrl = URL.createObjectURL(this.recordedAudioBlob);
          } catch (e) {
            console.warn('Error creating audio blob:', e);
          }
          resolve(this.recordedAudioUrl);
        };
        try {
          this.mediaRecorder.stop();
        } catch (e) {
          console.warn('Error stopping mediaRecorder:', e);
          resolve(this.recordedAudioUrl);
        }
        this.isRecording = false;
      } else {
        resolve(this.recordedAudioUrl);
      }

      if (this.micStream) {
        try {
          this.micStream.getTracks().forEach((track) => track.stop());
        } catch {}
        this.micStream = null;
      }
      if (this.micSource) {
        try {
          this.micSource.disconnect();
        } catch {}
        this.micSource = null;
      }
      this.stopBeat();
    });
  }

  public playStudentRecording(onEnded?: () => void, customUrl?: string) {
    const urlToPlay = customUrl || this.recordedAudioUrl;
    if (!urlToPlay) return;
    if (this.playbackAudio) {
      this.playbackAudio.pause();
    }
    this.playbackAudio = new Audio(urlToPlay);
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
