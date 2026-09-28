import { SongTrack, StemTrack } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private currentTrack: SongTrack | null = null;

  // Master Gain & Analyser
  private masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;

  // EQ Nodes
  private lowEqNode: BiquadFilterNode | null = null;
  private midEqNode: BiquadFilterNode | null = null;
  private highEqNode: BiquadFilterNode | null = null;

  // Reverb Nodes
  private reverbConvolver: ConvolverNode | null = null;
  private reverbWetGain: GainNode | null = null;
  private reverbDryGain: GainNode | null = null;

  // Stem node routing: stemId -> { gain, pan, type }
  private stemNodes: Map<
    string,
    {
      gainNode: GainNode;
      pannerNode: StereoPannerNode;
      stemData: StemTrack;
    }
  > = new Map();

  // Playback state
  private playbackRate: number = 1.0;
  private pitchShiftSemitones: number = 0;
  private currentTime: number = 0;
  private startTime: number = 0;
  private pausedAtTime: number = 0;
  private animationFrameId: number | null = null;

  // Loop settings
  private isLooping: boolean = false;
  private loopStart: number = 0;
  private loopEnd: number = 5;

  // Metronome
  private metronomeEnabled: boolean = false;
  private lastBeatScheduled: number = -1;

  // Listeners
  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  private onPlayStateChangeCallbacks: Set<(isPlaying: boolean) => void> = new Set();

  constructor() {
    // AudioContext will be initialized on first user interaction
  }

  public init() {
    if (this.ctx && this.ctx.state !== 'closed') return;

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // 1. Analyser Node for Spectral Analysis & Waveform
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;

    // 2. Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

    // 3. 3-Band Equalizer (Low 100Hz, Mid 1000Hz, High 8000Hz)
    this.lowEqNode = this.ctx.createBiquadFilter();
    this.lowEqNode.type = 'lowshelf';
    this.lowEqNode.frequency.setValueAtTime(120, this.ctx.currentTime);
    this.lowEqNode.gain.setValueAtTime(0, this.ctx.currentTime);

    this.midEqNode = this.ctx.createBiquadFilter();
    this.midEqNode.type = 'peaking';
    this.midEqNode.frequency.setValueAtTime(1000, this.ctx.currentTime);
    this.midEqNode.Q.setValueAtTime(1.0, this.ctx.currentTime);
    this.midEqNode.gain.setValueAtTime(0, this.ctx.currentTime);

    this.highEqNode = this.ctx.createBiquadFilter();
    this.highEqNode.type = 'highshelf';
    this.highEqNode.frequency.setValueAtTime(8000, this.ctx.currentTime);
    this.highEqNode.gain.setValueAtTime(0, this.ctx.currentTime);

    // 4. Studio Reverb (algorithmic impulse response)
    this.reverbConvolver = this.ctx.createConvolver();
    this.reverbConvolver.buffer = this.createImpulseResponse(2.2, 2.0);

    this.reverbWetGain = this.ctx.createGain();
    this.reverbWetGain.gain.setValueAtTime(0.2, this.ctx.currentTime);

    this.reverbDryGain = this.ctx.createGain();
    this.reverbDryGain.gain.setValueAtTime(0.8, this.ctx.currentTime);

    // Routing Graph:
    // StemOutputs -> EQ Chain (Low -> Mid -> High)
    // -> Reverb Dry / Wet split -> MasterGain -> Analyser -> Destination
    this.lowEqNode.connect(this.midEqNode);
    this.midEqNode.connect(this.highEqNode);

    // Dry path
    this.highEqNode.connect(this.reverbDryGain);
    this.reverbDryGain.connect(this.masterGain);

    // Wet path (Convolver)
    this.highEqNode.connect(this.reverbConvolver);
    this.reverbConvolver.connect(this.reverbWetGain);
    this.reverbWetGain.connect(this.masterGain);

    // Master to Analyser & Speakers
    this.masterGain.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  private createImpulseResponse(duration: number, decay: number): AudioBuffer {
    if (!this.ctx) throw new Error('No audio context');
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = length - i;
      const factor = Math.pow(n / length, decay);
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }
    return impulse;
  }

  public loadTrack(track: SongTrack) {
    this.init();
    this.currentTrack = track;
    this.currentTime = 0;
    this.pausedAtTime = 0;
    this.loopStart = track.defaultLoop.start;
    this.loopEnd = track.defaultLoop.end;
    this.setupStemNodes(track.stems);
  }

  public setupStemNodes(stems: StemTrack[]) {
    if (!this.ctx || !this.lowEqNode) return;

    // Disconnect old stem nodes
    this.stemNodes.forEach((node) => {
      node.gainNode.disconnect();
      node.pannerNode.disconnect();
    });
    this.stemNodes.clear();

    const anySolo = stems.some((s) => s.solo);

    stems.forEach((stem) => {
      const gainNode = this.ctx!.createGain();
      const pannerNode = this.ctx!.createStereoPanner();

      let effectiveGain = stem.volume;
      if (stem.muted) {
        effectiveGain = 0;
      } else if (anySolo) {
        effectiveGain = stem.solo ? stem.volume : 0;
      }

      gainNode.gain.setValueAtTime(effectiveGain, this.ctx!.currentTime);
      pannerNode.pan.setValueAtTime(stem.pan, this.ctx!.currentTime);

      gainNode.connect(pannerNode);
      pannerNode.connect(this.lowEqNode!);

      this.stemNodes.set(stem.id, {
        gainNode,
        pannerNode,
        stemData: { ...stem },
      });
    });
  }

  public updateStem(stemId: string, updates: Partial<StemTrack>) {
    const node = this.stemNodes.get(stemId);
    if (!node || !this.currentTrack || !this.ctx) return;

    // Update track model
    const stemInTrack = this.currentTrack.stems.find((s) => s.id === stemId);
    if (stemInTrack) {
      Object.assign(stemInTrack, updates);
    }
    Object.assign(node.stemData, updates);

    // Recalculate mute / solo across all stems
    const anySolo = this.currentTrack.stems.some((s) => s.solo);
    this.currentTrack.stems.forEach((s) => {
      const sNode = this.stemNodes.get(s.id);
      if (!sNode) return;
      let effectiveGain = s.volume;
      if (s.muted) {
        effectiveGain = 0;
      } else if (anySolo) {
        effectiveGain = s.solo ? s.volume : 0;
      }
      sNode.gainNode.gain.setTargetAtTime(effectiveGain, this.ctx!.currentTime, 0.03);
      if (s.pan !== undefined) {
        sNode.pannerNode.pan.setTargetAtTime(s.pan, this.ctx!.currentTime, 0.03);
      }
    });
  }

  public setMasterVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        Math.max(0, Math.min(1.2, val)),
        this.ctx.currentTime,
        0.02,
      );
    }
  }

  public setLowEq(db: number) {
    if (this.lowEqNode && this.ctx) {
      this.lowEqNode.gain.setTargetAtTime(db, this.ctx.currentTime, 0.03);
    }
  }

  public setMidEq(db: number) {
    if (this.midEqNode && this.ctx) {
      this.midEqNode.gain.setTargetAtTime(db, this.ctx.currentTime, 0.03);
    }
  }

  public setHighEq(db: number) {
    if (this.highEqNode && this.ctx) {
      this.highEqNode.gain.setTargetAtTime(db, this.ctx.currentTime, 0.03);
    }
  }

  public setReverbWet(amount: number) {
    if (this.reverbWetGain && this.reverbDryGain && this.ctx) {
      const wet = Math.max(0, Math.min(1, amount));
      this.reverbWetGain.gain.setTargetAtTime(wet, this.ctx.currentTime, 0.03);
      this.reverbDryGain.gain.setTargetAtTime(1 - wet * 0.5, this.ctx.currentTime, 0.03);
    }
  }

  public setPlaybackRate(rate: number) {
    this.playbackRate = Math.max(0.5, Math.min(1.5, rate));
  }

  public setPitchShift(semitones: number) {
    this.pitchShiftSemitones = semitones;
  }

  public setLoop(enabled: boolean, start?: number, end?: number) {
    this.isLooping = enabled;
    if (start !== undefined) this.loopStart = Math.max(0, start);
    if (end !== undefined) this.loopEnd = Math.max(this.loopStart + 0.5, end);
  }

  public setMetronome(enabled: boolean) {
    this.metronomeEnabled = enabled;
  }

  public seek(targetSec: number) {
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.pause();
    }
    this.currentTime = Math.max(0, targetSec);
    this.pausedAtTime = this.currentTime;
    this.notifyTimeUpdate();
    if (wasPlaying) {
      this.play();
    }
  }

  public async play() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.startTime = this.ctx!.currentTime - this.pausedAtTime / this.playbackRate;
    this.notifyPlayStateChange(true);
    this.startEngineLoop();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.pausedAtTime = this.currentTime;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.notifyPlayStateChange(false);
  }

  public stop() {
    this.pause();
    this.currentTime = 0;
    this.pausedAtTime = 0;
    this.notifyTimeUpdate();
  }

  private startEngineLoop() {
    let lastTickTime = performance.now();

    const loop = () => {
      if (!this.isPlaying || !this.ctx || !this.currentTrack) return;

      const now = performance.now();
      const delta = (now - lastTickTime) / 1000;
      lastTickTime = now;

      // Update current playhead based on playback rate (Time-stretching)
      this.currentTime += delta * this.playbackRate;

      // Check A-B loop boundary
      if (this.isLooping) {
        if (this.currentTime >= this.loopEnd || this.currentTime < this.loopStart) {
          this.currentTime = this.loopStart;
        }
      } else if (this.currentTime >= this.currentTrack.duration) {
        this.currentTime = 0;
      }

      // Schedule real audio synthesis for the currently sounding notes and stems
      this.renderSyntheticNotes(this.currentTime);

      // Metronome check
      if (this.metronomeEnabled && this.currentTrack) {
        const beatInterval = 60 / this.currentTrack.bpm;
        const currentBeat = Math.floor(this.currentTime / beatInterval);
        if (currentBeat !== this.lastBeatScheduled) {
          this.lastBeatScheduled = currentBeat;
          this.playMetronomeClick(currentBeat % 4 === 0);
        }
      }

      this.notifyTimeUpdate();
      this.animationFrameId = requestAnimationFrame(loop);
    };

    lastTickTime = performance.now();
    this.animationFrameId = requestAnimationFrame(loop);
  }

  // Generate synthesizer voices for active stems (Vocals, Harmony, Bass, Drums)
  private lastTriggeredNotes: Map<string, number> = new Map();

  private renderSyntheticNotes(time: number) {
    if (!this.ctx || !this.currentTrack) return;

    // Synthesize notes around current playhead window (time +- 0.08s)
    const window = 0.08;
    this.currentTrack.notes.forEach((noteEvent, idx) => {
      const noteKey = `${idx}-${Math.floor(time / (this.currentTrack?.duration || 30))}`;
      if (
        time >= noteEvent.time &&
        time <= noteEvent.time + window &&
        !this.lastTriggeredNotes.has(noteKey)
      ) {
        this.lastTriggeredNotes.set(noteKey, time);
        // Clean up old entries
        if (this.lastTriggeredNotes.size > 200) {
          this.lastTriggeredNotes.clear();
        }

        // Trigger notes for vocal/lead stem
        const vocStem = this.stemNodes.get('stem-voc') || this.stemNodes.get('stem-sax') || this.stemNodes.get('stem-vln');
        if (vocStem) {
          this.playVoice(
            vocStem.gainNode,
            noteEvent.midi + this.pitchShiftSemitones,
            noteEvent.duration,
            'lead',
          );
        }

        // Trigger accompaniment for harmony stem
        const harmStem = this.stemNodes.get('stem-harm') || this.stemNodes.get('stem-pno') || this.stemNodes.get('stem-gtr');
        if (harmStem) {
          // Play a triad chord based on the lead note
          this.playVoice(
            harmStem.gainNode,
            noteEvent.midi - 12 + this.pitchShiftSemitones,
            noteEvent.duration * 1.2,
            'chord',
          );
          this.playVoice(
            harmStem.gainNode,
            noteEvent.midi - 8 + this.pitchShiftSemitones,
            noteEvent.duration * 1.2,
            'chord',
          );
        }

        // Trigger bass stem
        const bassStem = this.stemNodes.get('stem-bass') || this.stemNodes.get('stem-wbass') || this.stemNodes.get('stem-vc');
        if (bassStem) {
          this.playVoice(
            bassStem.gainNode,
            noteEvent.midi - 24 + this.pitchShiftSemitones,
            noteEvent.duration * 0.9,
            'bass',
          );
        }

        // Trigger drums stem
        const drumStem = this.stemNodes.get('stem-drum') || this.stemNodes.get('stem-ride');
        if (drumStem) {
          this.playDrumHit(drumStem.gainNode, idx % 2 === 0 ? 'kick' : 'snare');
        }
      }
    });
  }

  private playVoice(
    destinationNode: AudioNode,
    midiNote: number,
    duration: number,
    timbreType: 'lead' | 'chord' | 'bass',
  ) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);

    const osc = this.ctx.createOscillator();
    const envGain = this.ctx.createGain();

    if (timbreType === 'lead') {
      // Warm sawtooth filtered lead with expressive vibrato LFO
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      // Add vibrato LFO (5.8 Hz)
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(5.8, now); // 5.8Hz ideal vocal vibrato
      lfoGain.gain.setValueAtTime(freq * 0.015, now); // ~25 cents vibrato depth
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start(now + 0.3); // delay vibrato onset for natural phrase
      lfo.stop(now + duration);

      // Filter for warm vocal formant
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(freq * 3.5, now);

      // Envelope: gentle attack, sustain, smooth release
      envGain.gain.setValueAtTime(0.001, now);
      envGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
      envGain.gain.setValueAtTime(0.18, now + duration - 0.05);
      envGain.gain.linearRampToValueAtTime(0.001, now + duration);

      osc.connect(filter);
      filter.connect(envGain);
    } else if (timbreType === 'chord') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      envGain.gain.setValueAtTime(0.001, now);
      envGain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

      osc.connect(envGain);
    } else {
      // Bass: Sub-sine + triangle punch
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      envGain.gain.setValueAtTime(0.001, now);
      envGain.gain.linearRampToValueAtTime(0.25, now + 0.03);
      envGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(envGain);
    }

    envGain.connect(destinationNode);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  private playDrumHit(destinationNode: AudioNode, type: 'kick' | 'snare') {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (type === 'kick') {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.12);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(destinationNode);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Noise burst for snare
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000, now);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(destinationNode);
      noise.start(now);
      noise.stop(now + 0.15);
    }
  }

  private playMetronomeClick(accent: boolean) {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.frequency.setValueAtTime(accent ? 1600 : 880, now);
    gain.gain.setValueAtTime(accent ? 0.35 : 0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Subscribe to time updates
  public onTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallbacks.add(callback);
    return () => this.onTimeUpdateCallbacks.delete(callback);
  }

  private notifyTimeUpdate() {
    this.onTimeUpdateCallbacks.forEach((cb) => cb(this.currentTime));
  }

  public onPlayStateChange(callback: (isPlaying: boolean) => void) {
    this.onPlayStateChangeCallbacks.add(callback);
    return () => this.onPlayStateChangeCallbacks.delete(callback);
  }

  private notifyPlayStateChange(state: boolean) {
    this.onPlayStateChangeCallbacks.forEach((cb) => cb(state));
  }

  public getCurrentTime(): number {
    return this.currentTime;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getLoopSettings() {
    return {
      enabled: this.isLooping,
      start: this.loopStart,
      end: this.loopEnd,
    };
  }
}

export const audioEngine = new AudioEngine();
