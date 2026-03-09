/**
 * Audio Effects Processor
 * 
 * Each track has a unique audio effect that modifies how the ambient
 * microphone input is processed and visualized. On web, these use
 * the Web Audio API for real-time processing. On native, they affect
 * the visualizer behavior and mic level processing.
 * 
 * The effects transform the mic level data to create unique
 * visual and audio patterns for each track.
 */

export type EffectProcessor = (
  micLevel: number,
  bpm: number,
  intensity: number, // 0-1
  time: number // current time in seconds
) => {
  processedLevel: number;
  visualizerModifier: number; // multiplier for visualizer
  pulseRate: number; // modified pulse rate
};

/**
 * 1. Spectral Reverb - Smooth, sustained levels with long decay
 */
function spectralReverb(micLevel: number, bpm: number, intensity: number, time: number) {
  const decay = 0.95 - intensity * 0.1;
  const reverbed = micLevel * (1 + intensity * 0.5);
  const shimmer = Math.sin(time * 3) * 0.1 * intensity;
  return {
    processedLevel: Math.min(1, reverbed + shimmer),
    visualizerModifier: 1 + intensity * 0.3,
    pulseRate: bpm * (1 - intensity * 0.1),
  };
}

/**
 * 2. Granular Stutter - Choppy, glitchy level changes
 */
function granularStutter(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const subBeat = (time % beatInterval) / beatInterval;
  const stutterCount = Math.floor(4 + intensity * 8);
  const stutterPhase = (subBeat * stutterCount) % 1;
  const gate = stutterPhase < 0.5 ? 1 : 0;
  const pitchDrift = Math.sin(time * 7) * intensity * 0.2;
  return {
    processedLevel: micLevel * gate * (1 + pitchDrift),
    visualizerModifier: 1 + intensity * 0.5 * gate,
    pulseRate: bpm * (1 + intensity * 0.5),
  };
}

/**
 * 3. Bitcrusher Chaos - Quantized, distorted levels
 */
function bitcrusherChaos(micLevel: number, bpm: number, intensity: number, time: number) {
  const bits = Math.max(2, Math.floor(8 - intensity * 6));
  const steps = Math.pow(2, bits);
  const crushed = Math.floor(micLevel * steps) / steps;
  const distortion = crushed * (1 + intensity * 0.8);
  const ring = Math.sin(time * 20 * intensity) * 0.15 * intensity;
  return {
    processedLevel: Math.min(1, Math.abs(distortion + ring)),
    visualizerModifier: 1 + intensity * 0.7,
    pulseRate: bpm * (1 + intensity * 0.2),
  };
}

/**
 * 4. Reverse Swell - Inverted envelope with slow build
 */
function reverseSwell(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const beatPhase = (time % beatInterval) / beatInterval;
  // Reverse the envelope: quiet at start, loud at end of beat
  const reversedEnvelope = Math.pow(beatPhase, 2 - intensity);
  const tremolo = 1 + Math.sin(time * 4) * 0.3 * intensity;
  return {
    processedLevel: micLevel * reversedEnvelope * tremolo,
    visualizerModifier: 1 + intensity * 0.4 * reversedEnvelope,
    pulseRate: bpm * 0.5,
  };
}

/**
 * 5. Tape Decay - Warped, degraded signal with wow/flutter
 */
function tapeDecay(micLevel: number, bpm: number, intensity: number, time: number) {
  const wow = Math.sin(time * 0.5) * 0.15 * intensity;
  const flutter = Math.sin(time * 12) * 0.05 * intensity;
  const saturation = Math.tanh(micLevel * (1 + intensity * 2));
  const degradation = saturation * (1 - intensity * 0.2) + wow + flutter;
  return {
    processedLevel: Math.max(0, Math.min(1, degradation)),
    visualizerModifier: 1 + intensity * 0.2,
    pulseRate: bpm * (1 + wow * 0.1),
  };
}

/**
 * 6. Rhythmic Gate - Tempo-synced on/off chopping
 */
function rhythmicGate(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const sixteenthNote = beatInterval / 4;
  const phase = (time % sixteenthNote) / sixteenthNote;
  const gateWidth = 0.3 + (1 - intensity) * 0.5;
  const gate = phase < gateWidth ? 1 : 0;
  return {
    processedLevel: micLevel * gate,
    visualizerModifier: Math.max(0.1, gate * (1 + intensity * 0.5)),
    pulseRate: bpm * 4,
  };
}

/**
 * 7. Shimmer Delay - Ascending pitch-shifted echoes
 */
function shimmerDelay(micLevel: number, bpm: number, intensity: number, time: number) {
  const delayTime = 60 / bpm / 2;
  const echo1 = micLevel * 0.7 * Math.sin(time / delayTime * Math.PI);
  const echo2 = micLevel * 0.4 * Math.sin((time + delayTime) / delayTime * Math.PI);
  const shimmer = Math.sin(time * 6) * 0.1 * intensity;
  const combined = micLevel + echo1 * intensity * 0.5 + echo2 * intensity * 0.3 + shimmer;
  return {
    processedLevel: Math.min(1, Math.max(0, combined)),
    visualizerModifier: 1 + intensity * 0.6,
    pulseRate: bpm,
  };
}

/**
 * 8. Harmonic Freeze - Sustained, frozen harmonics
 */
function harmonicFreeze(micLevel: number, bpm: number, intensity: number, time: number) {
  // Freeze effect: level stays sustained, slowly decaying
  const sustainFactor = 0.8 + intensity * 0.18;
  const frozen = Math.max(micLevel, micLevel * sustainFactor);
  const harmonics = Math.sin(time * 2) * 0.05 * intensity;
  return {
    processedLevel: Math.min(1, frozen + harmonics),
    visualizerModifier: 1 + intensity * 0.3,
    pulseRate: bpm * 0.5,
  };
}

/**
 * 9. Flanger Wash - Sweeping comb filter effect
 */
function flangerWash(micLevel: number, bpm: number, intensity: number, time: number) {
  const sweepRate = 0.2 + intensity * 0.8;
  const sweep = Math.sin(time * sweepRate * Math.PI * 2);
  const flanged = micLevel * (1 + sweep * 0.3 * intensity);
  const stereoWidth = Math.cos(time * sweepRate * Math.PI) * 0.1 * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, flanged + stereoWidth)),
    visualizerModifier: 1 + sweep * intensity * 0.4,
    pulseRate: bpm,
  };
}

/**
 * 10. Vocoder Pulse - Rhythmic vocoder-style processing
 */
function vocoderPulse(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const eighthNote = beatInterval / 2;
  const phase = (time % eighthNote) / eighthNote;
  const pulse = Math.pow(Math.sin(phase * Math.PI), 2);
  const vocoded = micLevel * pulse * (0.5 + intensity * 0.5);
  const formant = Math.sin(time * 15) * 0.1 * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, vocoded + formant)),
    visualizerModifier: Math.max(0.1, pulse * (1 + intensity * 0.5)),
    pulseRate: bpm * 2,
  };
}

// Map track IDs to their effect processors
const EFFECT_PROCESSORS: Record<number, EffectProcessor> = {
  1: spectralReverb,
  2: granularStutter,
  3: bitcrusherChaos,
  4: reverseSwell,
  5: tapeDecay,
  6: rhythmicGate,
  7: shimmerDelay,
  8: harmonicFreeze,
  9: flangerWash,
  10: vocoderPulse,
};

export function getEffectProcessor(trackId: number): EffectProcessor {
  return EFFECT_PROCESSORS[trackId] || spectralReverb;
}
