/**
 * Audio Effects Processor
 *
 * Each of the 15 tracks has a unique audio effect that modifies how the ambient
 * microphone input is processed and visualized. The effects transform the mic
 * level data to create unique visual and audio patterns for each track.
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

/** 1. Ectoplasm - Smooth, sustained levels with long decay and ghostly shimmer */
function ectoplasm(micLevel: number, bpm: number, intensity: number, time: number) {
  const reverbed = micLevel * (1 + intensity * 0.5);
  const shimmer = Math.sin(time * 3) * 0.1 * intensity;
  return {
    processedLevel: Math.max(0, Math.min(1, reverbed + shimmer)),
    visualizerModifier: 1 + intensity * 0.3,
    pulseRate: bpm * (1 - intensity * 0.1),
  };
}

/** 2. Insomnia - Choppy, glitchy level changes with ping-pong delay */
function insomnia(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const subBeat = (time % beatInterval) / beatInterval;
  const stutterCount = Math.floor(4 + intensity * 8);
  const stutterPhase = (subBeat * stutterCount) % 1;
  const gate = stutterPhase < 0.5 ? 1 : 0.2;
  const pitchDrift = Math.sin(time * 7) * intensity * 0.2;
  return {
    processedLevel: Math.max(0, Math.min(1, micLevel * gate * (1 + pitchDrift))),
    visualizerModifier: 1 + intensity * 0.5 * gate,
    pulseRate: bpm * (1 + intensity * 0.5),
  };
}

/** 3. Mutation Chaos - Bitcrusher + Chorus + Mono Delay + Gate */
function mutationChaos(micLevel: number, bpm: number, intensity: number, time: number) {
  // Bitcrusher at 60 BPM
  const bits = Math.max(2, Math.floor(8 - intensity * 6));
  const steps = Math.pow(2, bits);
  const crushed = Math.floor(micLevel * steps) / steps;
  // Gate at 60 BPM (1 Hz square)
  const gatePhase = (time % 1.0) / 1.0;
  const gate = gatePhase < 0.5 ? 1 : 0.15;
  // Chorus at 40 BPM (0.667 Hz) with 10% width
  const chorusMod = Math.sin(time * (40 / 60) * Math.PI * 2) * 0.1 * intensity;
  // Mono delay at 30 BPM (2s) — simulated echo
  const delayEcho = crushed * 0.4 * Math.sin(time * (30 / 60) * Math.PI);
  const combined = crushed * gate * (1 + chorusMod) + delayEcho * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, combined)),
    visualizerModifier: 1 + intensity * 0.7 * gate,
    pulseRate: 60, // Gate BPM drives the pulse
  };
}

/** 4. Krampus' Helpers - Reversed waveform with rotary modulator at 480/240 BPM */
function krampusHelpers(micLevel: number, bpm: number, intensity: number, time: number) {
  // Reversed waveform simulation: inverted envelope
  const beatInterval = 60 / bpm;
  const beatPhase = (time % beatInterval) / beatInterval;
  const reversed = Math.pow(1 - beatPhase, 1.5 + intensity);
  // Rotary modulator at 480 BPM (8 Hz) — amplitude modulation
  const rotary480 = 1 + Math.sin(time * 8 * Math.PI * 2) * (0.4 + intensity * 0.3);
  // Rotary modulator at 240 BPM (4 Hz) — slower bass rotor
  const rotary240 = 1 + Math.sin(time * 4 * Math.PI * 2) * (0.35 + intensity * 0.25);
  const combined = micLevel * reversed * rotary480 * 0.5 + micLevel * reversed * rotary240 * 0.5;
  return {
    processedLevel: Math.min(1, Math.max(0, combined)),
    visualizerModifier: 1 + intensity * 0.5 * Math.abs(Math.sin(time * 8)),
    pulseRate: 480, // Fast rotary drives the pulse
  };
}

/** 5. Spectral Correction - Stereo enhancer + 7s reverb + A440 minor pitch correction */
function spectralCorrection(micLevel: number, bpm: number, intensity: number, time: number) {
  // Long reverb decay simulation
  const reverbDecay = 0.8 + intensity * 0.15;
  const reverbed = micLevel * reverbDecay;
  // Pitch correction resonance — emphasizes A minor scale harmonics
  const a440 = Math.sin(time * 440 * 0.01) * 0.05 * intensity;
  const harmonicE = Math.sin(time * 330 * 0.01) * 0.03 * intensity;
  // Stereo width creates slow spatial movement
  const widthMod = Math.sin(time * 0.5) * 0.08 * intensity;
  const combined = reverbed + a440 + harmonicE + widthMod;
  return {
    processedLevel: Math.min(1, Math.max(0, combined)),
    visualizerModifier: 1 + intensity * 0.4,
    pulseRate: bpm * 0.5, // Slow, spacious pulse
  };
}

/** 6. Penance Gate - Square wave gate + Ping Pong Delay at 60 BPM, 95% wet */
function penanceGate(micLevel: number, bpm: number, intensity: number, time: number) {
  // Square wave gate at 60 BPM (1 Hz)
  const gatePhase = (time % 1.0) / 1.0;
  const gate = gatePhase < 0.5 ? 1 : 0.05; // hard gate
  // Ping pong delay at 60 BPM — alternating echoes
  const ppEchoL = micLevel * 0.6 * Math.sin((time / 1.0) * Math.PI * 0.5);
  const ppEchoR = micLevel * 0.5 * Math.sin(((time + 0.5) / 1.0) * Math.PI * 0.5);
  // 95% wet return
  const wet = (ppEchoL + ppEchoR) * intensity * 0.95;
  const dry = micLevel * gate * 0.05;
  const combined = wet + dry;
  return {
    processedLevel: Math.min(1, Math.max(0, combined)),
    visualizerModifier: 1 + intensity * 0.6 * gate,
    pulseRate: 60, // Gate BPM
  };
}

/** 7. Rhythmic Gate - Tempo-synced on/off chopping */
function rhythmicGate(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const sixteenthNote = beatInterval / 4;
  const phase = (time % sixteenthNote) / sixteenthNote;
  const gateWidth = 0.3 + (1 - intensity) * 0.5;
  const gate = phase < gateWidth ? 1 : 0.15;
  return {
    processedLevel: micLevel * gate,
    visualizerModifier: Math.max(0.15, gate * (1 + intensity * 0.5)),
    pulseRate: bpm * 4,
  };
}

/** 8. Shimmer Delay - Ascending pitch-shifted echoes */
function shimmerDelay(micLevel: number, bpm: number, intensity: number, time: number) {
  const delayTime = 60 / bpm / 2;
  const echo1 = micLevel * 0.7 * Math.sin((time / delayTime) * Math.PI);
  const echo2 = micLevel * 0.4 * Math.sin(((time + delayTime) / delayTime) * Math.PI);
  const shimmer = Math.sin(time * 6) * 0.1 * intensity;
  const combined = micLevel + echo1 * intensity * 0.5 + echo2 * intensity * 0.3 + shimmer;
  return {
    processedLevel: Math.min(1, Math.max(0, combined)),
    visualizerModifier: 1 + intensity * 0.6,
    pulseRate: bpm,
  };
}

/** 9. Harmonic Freeze - Sustained, frozen harmonics */
function harmonicFreeze(micLevel: number, bpm: number, intensity: number, time: number) {
  const sustainFactor = 0.8 + intensity * 0.18;
  const frozen = Math.max(micLevel, micLevel * sustainFactor);
  const harmonics = Math.sin(time * 2) * 0.05 * intensity;
  return {
    processedLevel: Math.max(0, Math.min(1, frozen + harmonics)),
    visualizerModifier: 1 + intensity * 0.3,
    pulseRate: bpm * 0.5,
  };
}

/** 10. Sidechain Pump - Rhythmic ducking/pumping effect */
function sidechainPump(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const beatPhase = (time % beatInterval) / beatInterval;
  // Fast attack, slow release curve
  const pump = beatPhase < 0.1
    ? 1 - (beatPhase / 0.1) * intensity * 0.8
    : (1 - intensity * 0.8) + (beatPhase - 0.1) / 0.9 * intensity * 0.8;
  const breathing = Math.sin(time * Math.PI * 2 / beatInterval) * 0.1 * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, micLevel * pump + breathing)),
    visualizerModifier: 1 + intensity * 0.5 * (1 - pump),
    pulseRate: bpm,
  };
}

/** 11. Flanger Wash - Sweeping comb filter effect */
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

/** 12. Vocoder Pulse - Rhythmic vocoder-style processing */
function vocoderPulse(micLevel: number, bpm: number, intensity: number, time: number) {
  const beatInterval = 60 / bpm;
  const eighthNote = beatInterval / 2;
  const phase = (time % eighthNote) / eighthNote;
  const pulse = Math.pow(Math.sin(phase * Math.PI), 2);
  const vocoded = micLevel * pulse * (0.5 + intensity * 0.5);
  const formant = Math.sin(time * 15) * 0.1 * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, vocoded + formant)),
    visualizerModifier: Math.max(0.15, pulse * (1 + intensity * 0.5)),
    pulseRate: bpm * 2,
  };
}

/** 13. Prism Split - Spectral band splitting with rainbow delays */
function prismSplit(micLevel: number, bpm: number, intensity: number, time: number) {
  const numBands = 5;
  let combined = 0;
  for (let i = 0; i < numBands; i++) {
    const bandDelay = i * 0.05 * intensity;
    const bandPhase = Math.sin((time + bandDelay) * (3 + i * 2)) * 0.5 + 0.5;
    combined += micLevel * bandPhase / numBands;
  }
  const rainbow = Math.sin(time * 2) * 0.1 * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, combined + rainbow)),
    visualizerModifier: 1 + intensity * 0.5,
    pulseRate: bpm * (1 + intensity * 0.15),
  };
}

/** 14. Orbital Resonance - Circular panning with ring modulation */
function orbitalResonance(micLevel: number, bpm: number, intensity: number, time: number) {
  const orbitRate = 0.3 + intensity * 0.7;
  const orbit = Math.sin(time * orbitRate * Math.PI * 2);
  const ringMod = Math.sin(time * 8 * intensity) * 0.2 * intensity;
  const phaseSweep = Math.sin(time * 0.15) * 0.1 * intensity;
  const processed = micLevel * (1 + orbit * 0.2 * intensity) + ringMod * micLevel + phaseSweep;
  return {
    processedLevel: Math.min(1, Math.max(0, processed)),
    visualizerModifier: 1 + Math.abs(orbit) * intensity * 0.4,
    pulseRate: bpm * (1 + orbit * 0.05),
  };
}

/** 15. Warm Chorus - Rich chorus doubling with warm saturation */
function warmChorus(micLevel: number, bpm: number, intensity: number, time: number) {
  const voice1 = Math.sin(time * 1.2) * 0.03 * intensity;
  const voice2 = Math.sin(time * 1.8 + 0.5) * 0.03 * intensity;
  const voice3 = Math.sin(time * 2.3 + 1.0) * 0.02 * intensity;
  const chorus = micLevel + voice1 + voice2 + voice3;
  const warmth = Math.tanh(chorus * (1 + intensity * 0.5));
  const detune = Math.sin(time * 0.8) * 0.02 * intensity;
  return {
    processedLevel: Math.min(1, Math.max(0, warmth + detune)),
    visualizerModifier: 1 + intensity * 0.25,
    pulseRate: bpm,
  };
}

// Map track IDs to their effect processors
const EFFECT_PROCESSORS: Record<number, EffectProcessor> = {
  1: ectoplasm,
  2: insomnia,
  3: mutationChaos,
  4: krampusHelpers,
  5: spectralCorrection,
  6: penanceGate,
  7: rhythmicGate,
  8: shimmerDelay,
  9: harmonicFreeze,
  10: sidechainPump,
  11: flangerWash,
  12: vocoderPulse,
  13: prismSplit,
  14: orbitalResonance,
  15: warmChorus,
};

export function getEffectProcessor(trackId: number): EffectProcessor {
  return EFFECT_PROCESSORS[trackId] || ectoplasm;
}
