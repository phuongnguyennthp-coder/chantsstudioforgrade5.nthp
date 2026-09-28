import { PitchData } from '../types';

const NOTE_NAMES = [
  'C',
  'C#',
  'D',
  'D#',
  'E',
  'F',
  'F#',
  'G',
  'G#',
  'A',
  'A#',
  'B',
];

export class PitchDetector {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isListening: boolean = false;
  private animFrameId: number | null = null;

  // Buffer
  private buffer: Float32Array<ArrayBuffer> = new Float32Array(new ArrayBuffer(2048 * 4));

  // Pitch history for vibrato & contour tracking
  private recentPitches: Array<{ hz: number; cents: number; time: number }> = [];
  private onPitchCallbacks: Set<(pitch: PitchData | null) => void> = new Set();

  public async start(): Promise<boolean> {
    if (this.isListening) return true;

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;

      this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
      this.sourceNode.connect(this.analyser);

      this.isListening = true;
      this.detectLoop();
      return true;
    } catch (err) {
      console.warn('Microphone permission not granted or error:', err);
      this.isListening = false;
      return false;
    }
  }

  public stop() {
    this.isListening = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.recentPitches = [];
    this.notifyCallbacks(null);
  }

  public getIsListening(): boolean {
    return this.isListening;
  }

  public onPitch(cb: (pitch: PitchData | null) => void) {
    this.onPitchCallbacks.add(cb);
    return () => this.onPitchCallbacks.delete(cb);
  }

  private notifyCallbacks(pitch: PitchData | null) {
    this.onPitchCallbacks.forEach((cb) => cb(pitch));
  }

  private detectLoop = () => {
    if (!this.isListening || !this.analyser || !this.audioCtx) return;

    this.analyser.getFloatTimeDomainData(this.buffer);

    // 1. Calculate RMS Amplitude
    let sumSquares = 0;
    for (let i = 0; i < this.buffer.length; i++) {
      sumSquares += this.buffer[i] * this.buffer[i];
    }
    const rms = Math.sqrt(sumSquares / this.buffer.length);

    // Noise gate threshold
    if (rms < 0.015) {
      this.notifyCallbacks(null);
      this.animFrameId = requestAnimationFrame(this.detectLoop);
      return;
    }

    // 2. Autocorrelation Pitch Detection
    const sampleRate = this.audioCtx.sampleRate;
    const pitchHz = this.autoCorrelate(this.buffer, sampleRate);

    if (pitchHz > 50 && pitchHz < 1500) {
      // Valid musical frequency range (e.g. G1 to G6)
      const { noteName, midi, cents } = this.hzToNote(pitchHz);
      const now = performance.now();

      this.recentPitches.push({ hz: pitchHz, cents, time: now });
      if (this.recentPitches.length > 30) {
        this.recentPitches.shift();
      }

      const pitchData: PitchData = {
        hz: Math.round(pitchHz * 10) / 10,
        midi,
        noteName,
        cents: Math.round(cents),
        amplitude: Math.min(1, rms * 4),
        clarity: Math.min(1, rms * 5),
        timestamp: now,
      };

      this.notifyCallbacks(pitchData);
    } else {
      this.notifyCallbacks(null);
    }

    this.animFrameId = requestAnimationFrame(this.detectLoop);
  };

  /**
   * Normalized square difference function (NSDF) / autocorrelation
   */
  private autoCorrelate(buf: Float32Array<ArrayBuffer>, sampleRate: number): number {
    const SIZE = buf.length;
    let r1 = 0;
    let r2 = SIZE - 1;
    const thres = 0.2;

    for (let i = 0; i < SIZE / 2; i++) {
      if (Math.abs(buf[i]) < thres) {
        r1 = i;
        break;
      }
    }
    for (let i = 1; i < SIZE / 2; i++) {
      if (Math.abs(buf[SIZE - i]) < thres) {
        r2 = SIZE - i;
        break;
      }
    }

    buf = buf.slice(r1, r2);
    const newSize = buf.length;

    const c = new Float32Array(newSize);
    for (let i = 0; i < newSize; i++) {
      for (let j = 0; j < newSize - i; j++) {
        c[i] = c[i] + buf[j] * buf[j + i];
      }
    }

    let d = 0;
    while (c[d] > c[d + 1]) d++;
    let maxval = -1;
    let maxpos = -1;
    for (let i = d; i < newSize; i++) {
      if (c[i] > maxval) {
        maxval = c[i];
        maxpos = i;
      }
    }
    let T0 = maxpos;

    // Parabolic interpolation for fine tuning
    const x1 = c[T0 - 1];
    const x2 = c[T0];
    const x3 = c[T0 + 1];
    const a = (x1 + x3 - 2 * x2) / 2;
    const b = (x3 - x1) / 2;
    if (a) T0 = T0 - b / (2 * a);

    return sampleRate / T0;
  }

  private hzToNote(freq: number): { noteName: string; midi: number; cents: number } {
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;
    const noteName = `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
    const targetFreq = 440 * Math.pow(2, (midi - 69) / 12);
    const cents = 1200 * (Math.log(freq / targetFreq) / Math.log(2));

    return { noteName, midi, cents };
  }

  public getVibratoMetrics(): { rateHz: number; depthCents: number } {
    if (this.recentPitches.length < 15) {
      return { rateHz: 5.5, depthCents: 28 };
    }

    // Estimate peak-to-peak cents depth and cycle rate
    const centsList = this.recentPitches.map((p) => p.cents);
    const minCents = Math.min(...centsList);
    const maxCents = Math.max(...centsList);
    const depth = Math.abs(maxCents - minCents);

    // Approximate rate by zero-crossings
    const mean = centsList.reduce((a, b) => a + b, 0) / centsList.length;
    let zeroCrossings = 0;
    for (let i = 1; i < centsList.length; i++) {
      if (
        (centsList[i - 1] - mean > 0 && centsList[i] - mean <= 0) ||
        (centsList[i - 1] - mean < 0 && centsList[i] - mean >= 0)
      ) {
        zeroCrossings++;
      }
    }

    const durationSec =
      (this.recentPitches[this.recentPitches.length - 1].time -
        this.recentPitches[0].time) /
      1000;
    const rate = durationSec > 0 ? zeroCrossings / (2 * durationSec) : 5.8;

    return {
      rateHz: Math.round(Math.min(10, Math.max(2, rate)) * 10) / 10,
      depthCents: Math.round(Math.min(100, Math.max(5, depth))),
    };
  }
}

export const pitchDetector = new PitchDetector();
