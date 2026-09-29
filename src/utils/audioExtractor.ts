/**
 * Audio Extraction and Processing Utilities for chantsstudioforgrade5
 * Native browser Web Audio API - 100% client-side, zero backend dependencies.
 */

export interface ExtractedAudioResult {
  blob: Blob;
  url: string;
  duration: number;
  sampleRate: number;
  numberOfChannels: number;
  mode: 'original' | 'vocal_reduced';
}

/**
 * Converts an AudioBuffer to a standard 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const numSamples = buffer.length;
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const arrayBuffer = new ArrayBuffer(totalSize);
  const view = new DataView(arrayBuffer);

  // Write RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // Write fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
  view.setUint16(32, blockAlign, true); // BlockAlign
  view.setUint16(34, bitDepth, true); // BitsPerSample

  // Write data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channels and convert float (-1.0 to 1.0) to 16-bit signed PCM
  const channels: Float32Array[] = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(buffer.getChannelData(c));
  }

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = channels[c][i];
      // Clamp between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer (-32768 to 32767)
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Apply Center-Channel Vocal Reduction & Bass Preservation to create an instrumental/karaoke backing beat.
 * In stereo songs, vocals are center-panned (L == R). Subtracting center while preserving low frequencies (<150Hz)
 * retains punchy kicks and basslines while attenuating singing vocals.
 */
export function applyVocalReduction(
  buffer: AudioBuffer,
  audioCtx: AudioContext
): AudioBuffer {
  if (buffer.numberOfChannels < 2) {
    // Mono track fallback: return original or slight mid-frequency notch
    return buffer;
  }

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;

  const outBuffer = audioCtx.createBuffer(2, length, sampleRate);
  const outLeft = outBuffer.getChannelData(0);
  const outRight = outBuffer.getChannelData(1);

  // 1-pole low-pass filter to isolate bass (< 140 Hz)
  const f0 = 140;
  const rc = 1 / (2 * Math.PI * f0);
  const dt = 1 / sampleRate;
  const alpha = dt / (rc + dt);

  let bassL = 0;
  let bassR = 0;

  for (let i = 0; i < length; i++) {
    const l = left[i];
    const r = right[i];

    // Low-pass filter for bass kick
    bassL += alpha * (l - bassL);
    bassR += alpha * (r - bassR);

    // Vocal cancellation side difference
    const side = (l - r) * 0.75;

    // Preserve kick & bass in center while removing vocal center
    outLeft[i] = side + bassL * 0.7;
    outRight[i] = -side + bassR * 0.7;
  }

  return outBuffer;
}

/**
 * Extract audio track from any video or audio source (File, Blob, or URL)
 * Supports MP4, WebM, MOV, MKV, MP3, WAV, M4A, OGG
 */
export async function extractAudioFromMedia(
  source: File | Blob | string,
  mode: 'original' | 'vocal_reduced' = 'original'
): Promise<ExtractedAudioResult> {
  let arrayBuffer: ArrayBuffer;

  if (source instanceof Blob) {
    arrayBuffer = await source.arrayBuffer();
  } else {
    // Fetch URL
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to load video from URL (Error code: ${response.status})`);
    }
    arrayBuffer = await response.arrayBuffer();
  }

  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass();

  try {
    let decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    if (mode === 'vocal_reduced') {
      decodedBuffer = applyVocalReduction(decodedBuffer, audioCtx);
    }

    const wavBlob = audioBufferToWavBlob(decodedBuffer);
    const url = URL.createObjectURL(wavBlob);

    return {
      blob: wavBlob,
      url,
      duration: decodedBuffer.duration,
      sampleRate: decodedBuffer.sampleRate,
      numberOfChannels: decodedBuffer.numberOfChannels,
      mode,
    };
  } finally {
    if (audioCtx.state !== 'closed') {
      await audioCtx.close();
    }
  }
}
