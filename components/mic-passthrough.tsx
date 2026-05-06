import React, { useRef, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";

interface MicPassthroughProps {
  isActive: boolean;
  trackId: number;
  bpm: number;
  effectIntensity: number; // 0-100
  micSensitivity: number; // 0-100
  masterVolume: number; // 0-100 — overall output volume
  dryWetMix: number; // 0-100 — 0=fully dry (raw ambient), 100=fully wet (effected)
  onLevelUpdate?: (level: number) => void;
  onError?: (error: string) => void;
}

/**
 * MicPassthrough
 *
 * Captures microphone audio, splits into dry (raw) and wet (effected) paths,
 * blends them according to dryWetMix, and outputs to speakers/headphones.
 *
 * On native: Runs a hidden WebView with Web Audio API
 * On web: Uses the Web Audio API directly in the main page context
 */
export function MicPassthrough({
  isActive,
  trackId,
  bpm,
  effectIntensity,
  micSensitivity,
  masterVolume,
  dryWetMix,
  onLevelUpdate,
  onError,
}: MicPassthroughProps) {
  if (Platform.OS === "web") {
    return (
      <WebMicPassthrough
        isActive={isActive}
        trackId={trackId}
        bpm={bpm}
        effectIntensity={effectIntensity}
        micSensitivity={micSensitivity}
        masterVolume={masterVolume}
        dryWetMix={dryWetMix}
        onLevelUpdate={onLevelUpdate}
        onError={onError}
      />
    );
  }

  return (
    <NativeMicPassthrough
      isActive={isActive}
      trackId={trackId}
      bpm={bpm}
      effectIntensity={effectIntensity}
      micSensitivity={micSensitivity}
      masterVolume={masterVolume}
      dryWetMix={dryWetMix}
      onLevelUpdate={onLevelUpdate}
      onError={onError}
    />
  );
}

// ─── Effect DSP chain builder (Web Audio API JavaScript) ─────────────────────
// This JS string is shared between web and native (injected into WebView HTML)
function buildEffectChainJS(): string {
  return `
    // Effect chain builder: creates Web Audio API nodes for each track effect
    function buildEffectChain(ctx, source, trackId, bpm, intensity) {
      var gain = ctx.createGain();
      gain.gain.value = 1.0;

      var output = ctx.createGain();
      output.gain.value = 1.0;

      // Analyser for level metering
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      switch (trackId) {
        case 1: // Spectral Reverb - convolution-like reverb with shimmer
          var delay1 = ctx.createDelay(1.0);
          delay1.delayTime.value = 0.03;
          var delay2 = ctx.createDelay(1.0);
          delay2.delayTime.value = 0.07;
          var delay3 = ctx.createDelay(1.0);
          delay3.delayTime.value = 0.13;
          var delay4 = ctx.createDelay(1.0);
          delay4.delayTime.value = 0.21;
          var fb1 = ctx.createGain(); fb1.gain.value = 0.3 + intensity * 0.4;
          var fb2 = ctx.createGain(); fb2.gain.value = 0.25 + intensity * 0.35;
          var fb3 = ctx.createGain(); fb3.gain.value = 0.2 + intensity * 0.3;
          var fb4 = ctx.createGain(); fb4.gain.value = 0.15 + intensity * 0.25;
          var hp = ctx.createBiquadFilter();
          hp.type = 'highpass'; hp.frequency.value = 800 + intensity * 2000;
          hp.Q.value = 0.5;
          var mix = ctx.createGain(); mix.gain.value = 0.4 + intensity * 0.4;
          var dry = ctx.createGain(); dry.gain.value = 0.6;

          source.connect(gain);
          gain.connect(dry);
          gain.connect(delay1); delay1.connect(fb1); fb1.connect(delay1);
          gain.connect(delay2); delay2.connect(fb2); fb2.connect(delay2);
          gain.connect(delay3); delay3.connect(fb3); fb3.connect(delay3);
          gain.connect(delay4); delay4.connect(fb4); fb4.connect(delay4);
          delay1.connect(hp); delay2.connect(hp); delay3.connect(hp); delay4.connect(hp);
          hp.connect(mix);
          dry.connect(analyser); mix.connect(analyser);
          analyser.connect(output);
          break;

        case 2: // Granular Stutter - rhythmic chopping synced to BPM
          var stutterGain = ctx.createGain();
          stutterGain.gain.value = 1.0;
          var stutterLfo = ctx.createOscillator();
          stutterLfo.type = 'square';
          stutterLfo.frequency.value = bpm / 60 * 2; // eighth notes
          var stutterDepth = ctx.createGain();
          stutterDepth.gain.value = 0.5 + intensity * 0.5;

          source.connect(gain);
          gain.connect(stutterGain);
          stutterLfo.connect(stutterDepth);
          stutterDepth.connect(stutterGain.gain);
          stutterLfo.start();
          stutterGain.connect(analyser);
          analyser.connect(output);
          break;

        case 3: // Dark Echo - long feedback delay with filtering
          var echoDelay = ctx.createDelay(2.0);
          echoDelay.delayTime.value = 60 / bpm; // one beat delay
          var echoFb = ctx.createGain();
          echoFb.gain.value = 0.3 + intensity * 0.4;
          var echoLp = ctx.createBiquadFilter();
          echoLp.type = 'lowpass';
          echoLp.frequency.value = 800 + (1 - intensity) * 2000;
          var echoDry = ctx.createGain(); echoDry.gain.value = 0.6;
          var echoWet = ctx.createGain(); echoWet.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(echoDry);
          gain.connect(echoDelay);
          echoDelay.connect(echoLp);
          echoLp.connect(echoFb);
          echoFb.connect(echoDelay);
          echoLp.connect(echoWet);
          echoDry.connect(analyser); echoWet.connect(analyser);
          analyser.connect(output);
          break;

        case 4: // Pitch Warp - detuned doubling with modulation
          var warpDelay = ctx.createDelay(0.1);
          warpDelay.delayTime.value = 0.02;
          var warpLfo = ctx.createOscillator();
          warpLfo.type = 'sine';
          warpLfo.frequency.value = 2 + intensity * 6;
          var warpLfoGain = ctx.createGain();
          warpLfoGain.gain.value = 0.005 + intensity * 0.015;
          var warpDry = ctx.createGain(); warpDry.gain.value = 0.5;
          var warpWet = ctx.createGain(); warpWet.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(warpDry);
          gain.connect(warpDelay);
          warpLfo.connect(warpLfoGain);
          warpLfoGain.connect(warpDelay.delayTime);
          warpLfo.start();
          warpDelay.connect(warpWet);
          warpDry.connect(analyser); warpWet.connect(analyser);
          analyser.connect(output);
          break;

        case 5: // Harmonic Freeze - resonant bandpass with sustain
          var freezeBp = ctx.createBiquadFilter();
          freezeBp.type = 'bandpass';
          freezeBp.frequency.value = 500 + intensity * 1500;
          freezeBp.Q.value = 5 + intensity * 15;
          var freezeDelay = ctx.createDelay(0.5);
          freezeDelay.delayTime.value = 0.1 + intensity * 0.3;
          var freezeFb = ctx.createGain();
          freezeFb.gain.value = 0.5 + intensity * 0.4;
          var freezeDry = ctx.createGain(); freezeDry.gain.value = 0.4;
          var freezeWet = ctx.createGain(); freezeWet.gain.value = 0.4 + intensity * 0.4;

          source.connect(gain);
          gain.connect(freezeDry);
          gain.connect(freezeBp);
          freezeBp.connect(freezeDelay);
          freezeDelay.connect(freezeFb);
          freezeFb.connect(freezeDelay);
          freezeDelay.connect(freezeWet);
          freezeDry.connect(analyser); freezeWet.connect(analyser);
          analyser.connect(output);
          break;

        case 6: // Tape Saturation - warm distortion with filtering
          var satWs = ctx.createWaveShaper();
          var satCurve = new Float32Array(256);
          for (var si = 0; si < 256; si++) {
            var sx = (si / 128) - 1;
            satCurve[si] = (Math.PI + intensity * 10) * sx / (Math.PI + intensity * 10 * Math.abs(sx));
          }
          satWs.curve = satCurve;
          satWs.oversample = '4x';
          var satLp = ctx.createBiquadFilter();
          satLp.type = 'lowpass';
          satLp.frequency.value = 3000 + (1 - intensity) * 5000;
          var satDry = ctx.createGain(); satDry.gain.value = 0.5;
          var satWet = ctx.createGain(); satWet.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(satDry);
          gain.connect(satWs);
          satWs.connect(satLp);
          satLp.connect(satWet);
          satDry.connect(analyser); satWet.connect(analyser);
          analyser.connect(output);
          break;

        case 7: // Void Filter - sweeping lowpass with resonance
          var voidLp = ctx.createBiquadFilter();
          voidLp.type = 'lowpass';
          voidLp.frequency.value = 200 + intensity * 3000;
          voidLp.Q.value = 2 + intensity * 10;
          var voidLfo = ctx.createOscillator();
          voidLfo.type = 'sine';
          voidLfo.frequency.value = bpm / 120;
          var voidLfoGain = ctx.createGain();
          voidLfoGain.gain.value = 500 + intensity * 2000;

          source.connect(gain);
          gain.connect(voidLp);
          voidLfo.connect(voidLfoGain);
          voidLfoGain.connect(voidLp.frequency);
          voidLfo.start();
          voidLp.connect(analyser);
          analyser.connect(output);
          break;

        case 8: // Rhythmic Gate - BPM-synced tremolo
          var gateGain = ctx.createGain();
          gateGain.gain.value = 1.0;
          var gateLfo = ctx.createOscillator();
          gateLfo.type = 'square';
          gateLfo.frequency.value = bpm / 60;
          var gateDepth = ctx.createGain();
          gateDepth.gain.value = 0.3 + intensity * 0.6;

          source.connect(gain);
          gain.connect(gateGain);
          gateLfo.connect(gateDepth);
          gateDepth.connect(gateGain.gain);
          gateLfo.start();
          gateGain.connect(analyser);
          analyser.connect(output);
          break;

        case 9: // Crystal Delay - bright multi-tap delay
          var cd1 = ctx.createDelay(1.0);
          cd1.delayTime.value = 60 / bpm / 2;
          var cd2 = ctx.createDelay(1.0);
          cd2.delayTime.value = 60 / bpm;
          var cd3 = ctx.createDelay(2.0);
          cd3.delayTime.value = 60 / bpm * 1.5;
          var cdHp = ctx.createBiquadFilter();
          cdHp.type = 'highpass'; cdHp.frequency.value = 2000 + intensity * 3000;
          var cdFb = ctx.createGain(); cdFb.gain.value = 0.2 + intensity * 0.3;
          var cdDry = ctx.createGain(); cdDry.gain.value = 0.5;
          var cdWet = ctx.createGain(); cdWet.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(cdDry);
          gain.connect(cd1); gain.connect(cd2); gain.connect(cd3);
          cd1.connect(cdHp); cd2.connect(cdHp); cd3.connect(cdHp);
          cdHp.connect(cdFb); cdFb.connect(cd1);
          cdHp.connect(cdWet);
          cdDry.connect(analyser); cdWet.connect(analyser);
          analyser.connect(output);
          break;

        case 10: // Ambient Wash - long reverb with modulated filtering
          var awD1 = ctx.createDelay(1.0); awD1.delayTime.value = 0.05;
          var awD2 = ctx.createDelay(1.0); awD2.delayTime.value = 0.11;
          var awD3 = ctx.createDelay(1.0); awD3.delayTime.value = 0.17;
          var awFb1 = ctx.createGain(); awFb1.gain.value = 0.4 + intensity * 0.3;
          var awFb2 = ctx.createGain(); awFb2.gain.value = 0.35 + intensity * 0.25;
          var awFb3 = ctx.createGain(); awFb3.gain.value = 0.3 + intensity * 0.2;
          var awLp = ctx.createBiquadFilter();
          awLp.type = 'lowpass'; awLp.frequency.value = 1500 + (1 - intensity) * 3000;
          var awDry = ctx.createGain(); awDry.gain.value = 0.4;
          var awWet = ctx.createGain(); awWet.gain.value = 0.4 + intensity * 0.4;

          source.connect(gain);
          gain.connect(awDry);
          gain.connect(awD1); awD1.connect(awFb1); awFb1.connect(awD1);
          gain.connect(awD2); awD2.connect(awFb2); awFb2.connect(awD2);
          gain.connect(awD3); awD3.connect(awFb3); awFb3.connect(awD3);
          awD1.connect(awLp); awD2.connect(awLp); awD3.connect(awLp);
          awLp.connect(awWet);
          awDry.connect(analyser); awWet.connect(analyser);
          analyser.connect(output);
          break;

        case 11: // Bit Crusher - lo-fi digital degradation
          var bcWs = ctx.createWaveShaper();
          var bcSteps = 4 + Math.floor((1 - intensity) * 28);
          var bcCurve = new Float32Array(256);
          for (var bi = 0; bi < 256; bi++) {
            var bx = (bi / 128) - 1;
            bcCurve[bi] = Math.round(bx * bcSteps) / bcSteps;
          }
          bcWs.curve = bcCurve;
          var bcLp = ctx.createBiquadFilter();
          bcLp.type = 'lowpass';
          bcLp.frequency.value = 2000 + (1 - intensity) * 8000;
          var bcDry = ctx.createGain(); bcDry.gain.value = 0.4;
          var bcWet = ctx.createGain(); bcWet.gain.value = 0.4 + intensity * 0.4;

          source.connect(gain);
          gain.connect(bcDry);
          gain.connect(bcWs);
          bcWs.connect(bcLp);
          bcLp.connect(bcWet);
          bcDry.connect(analyser); bcWet.connect(analyser);
          analyser.connect(output);
          break;

        case 12: // Chorus Ensemble - rich detuned doubling
          var chDel1 = ctx.createDelay(0.05);
          chDel1.delayTime.value = 0.015;
          var chDel2 = ctx.createDelay(0.05);
          chDel2.delayTime.value = 0.025;
          var chLfo1 = ctx.createOscillator(); chLfo1.type = 'sine';
          chLfo1.frequency.value = 0.5 + intensity * 2;
          var chLfo2 = ctx.createOscillator(); chLfo2.type = 'sine';
          chLfo2.frequency.value = 0.7 + intensity * 2.5;
          var chLfoG1 = ctx.createGain(); chLfoG1.gain.value = 0.003 + intensity * 0.005;
          var chLfoG2 = ctx.createGain(); chLfoG2.gain.value = 0.004 + intensity * 0.006;
          var chDry = ctx.createGain(); chDry.gain.value = 0.5;
          var chWet = ctx.createGain(); chWet.gain.value = 0.3 + intensity * 0.4;

          source.connect(gain);
          gain.connect(chDry);
          gain.connect(chDel1); gain.connect(chDel2);
          chLfo1.connect(chLfoG1); chLfoG1.connect(chDel1.delayTime);
          chLfo2.connect(chLfoG2); chLfoG2.connect(chDel2.delayTime);
          chLfo1.start(); chLfo2.start();
          chDel1.connect(chWet); chDel2.connect(chWet);
          chDry.connect(analyser); chWet.connect(analyser);
          analyser.connect(output);
          break;

        case 13: // Vocoder Pulse - bandpass + rhythmic modulation
          var vocBp = ctx.createBiquadFilter();
          vocBp.type = 'bandpass'; vocBp.frequency.value = 1000 + intensity * 2000;
          vocBp.Q.value = 3 + intensity * 8;
          var vocLfo = ctx.createOscillator();
          vocLfo.type = 'sine';
          vocLfo.frequency.value = bpm / 60 * 2; // eighth notes
          var vocLfoGain = ctx.createGain();
          vocLfoGain.gain.value = 0.4 + intensity * 0.5;

          source.connect(gain);
          gain.connect(vocBp);
          vocLfo.connect(vocLfoGain);
          vocLfoGain.connect(gain.gain);
          vocLfo.start();
          vocBp.connect(analyser);
          analyser.connect(output);
          break;

        case 14: // Prism Split - parallel bandpass filters at different frequencies
          var bands = [300, 800, 1500, 3000, 6000];
          var bandGains = [];
          for (var b = 0; b < bands.length; b++) {
            var bpf = ctx.createBiquadFilter();
            bpf.type = 'bandpass';
            bpf.frequency.value = bands[b];
            bpf.Q.value = 2 + intensity * 3;
            var bdel = ctx.createDelay(0.5);
            bdel.delayTime.value = b * 0.02 * intensity;
            var bg = ctx.createGain();
            bg.gain.value = 0.3;
            source.connect(gain);
            gain.connect(bpf);
            bpf.connect(bdel);
            bdel.connect(bg);
            bg.connect(analyser);
          }
          analyser.connect(output);
          break;

        case 15: // Orbital Resonance - phaser-like with ring modulation
          var orbDel1 = ctx.createDelay(0.02);
          orbDel1.delayTime.value = 0.003;
          var orbDel2 = ctx.createDelay(0.02);
          orbDel2.delayTime.value = 0.007;
          var orbLfo = ctx.createOscillator();
          orbLfo.type = 'sine';
          orbLfo.frequency.value = 0.3 + intensity * 0.7;
          var orbLfoG1 = ctx.createGain(); orbLfoG1.gain.value = 0.002;
          var orbLfoG2 = ctx.createGain(); orbLfoG2.gain.value = 0.003;
          var orbRing = ctx.createOscillator();
          orbRing.type = 'sine';
          orbRing.frequency.value = 200 + intensity * 600;
          var orbRingGain = ctx.createGain();
          orbRingGain.gain.value = 0.1 * intensity;
          var orbDry = ctx.createGain(); orbDry.gain.value = 0.6;
          var orbWet = ctx.createGain(); orbWet.gain.value = 0.3 + intensity * 0.4;

          source.connect(gain);
          gain.connect(orbDry);
          gain.connect(orbDel1);
          gain.connect(orbDel2);
          orbLfo.connect(orbLfoG1); orbLfoG1.connect(orbDel1.delayTime);
          orbLfo.connect(orbLfoG2); orbLfoG2.connect(orbDel2.delayTime);
          orbLfo.start();
          orbRing.connect(orbRingGain);
          orbRingGain.connect(gain.gain);
          orbRing.start();
          orbDel1.connect(orbWet); orbDel2.connect(orbWet);
          orbDry.connect(analyser); orbWet.connect(analyser);
          analyser.connect(output);
          break;

        case 16: // Temporal Shift - pitch-shifting delay with feedback
          var tsDel = ctx.createDelay(1.0);
          tsDel.delayTime.value = 60 / bpm * 0.75;
          var tsFb = ctx.createGain();
          tsFb.gain.value = 0.3 + intensity * 0.35;
          var tsLfo = ctx.createOscillator();
          tsLfo.type = 'triangle';
          tsLfo.frequency.value = 0.1 + intensity * 0.5;
          var tsLfoG = ctx.createGain();
          tsLfoG.gain.value = 0.01 + intensity * 0.02;
          var tsHp = ctx.createBiquadFilter();
          tsHp.type = 'highpass'; tsHp.frequency.value = 300;
          var tsLp = ctx.createBiquadFilter();
          tsLp.type = 'lowpass'; tsLp.frequency.value = 4000 + (1 - intensity) * 4000;
          var tsDry = ctx.createGain(); tsDry.gain.value = 0.5;
          var tsWet = ctx.createGain(); tsWet.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(tsDry);
          gain.connect(tsDel);
          tsLfo.connect(tsLfoG); tsLfoG.connect(tsDel.delayTime);
          tsLfo.start();
          tsDel.connect(tsHp); tsHp.connect(tsLp);
          tsLp.connect(tsFb); tsFb.connect(tsDel);
          tsLp.connect(tsWet);
          tsDry.connect(analyser); tsWet.connect(analyser);
          analyser.connect(output);
          break;

        default: // Fallback - simple gain passthrough
          source.connect(gain);
          gain.connect(analyser);
          analyser.connect(output);
          break;
      }

      return { gain: gain, output: output, analyser: analyser };
    }
  `;
}

// ─── Dry/Wet chain builder JS (wraps the effect chain with dry/wet blending) ──
function buildDryWetChainJS(): string {
  return `
    // Build a dry/wet blended chain around the effect chain
    function buildDryWetChain(ctx, source, trackId, bpm, intensity, dryWetMix) {
      // dryWetMix: 0 = fully dry, 1 = fully wet
      var dryGain = ctx.createGain();
      dryGain.gain.value = 1.0 - dryWetMix;

      var wetGain = ctx.createGain();
      wetGain.gain.value = dryWetMix;

      var merger = ctx.createGain();
      merger.gain.value = 1.0;

      // Analyser for combined level metering
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Dry path: source -> inputGain -> dryGain -> merger
      var inputGain = ctx.createGain();
      inputGain.gain.value = 1.0;
      source.connect(inputGain);
      inputGain.connect(dryGain);
      dryGain.connect(merger);

      // Wet path: source -> effectChain -> wetGain -> merger
      var effectChain = buildEffectChain(ctx, source, trackId, bpm, intensity);
      effectChain.output.connect(wetGain);
      wetGain.connect(merger);

      merger.connect(analyser);

      return {
        analyser: analyser,
        output: analyser, // output from analyser
        dryGain: dryGain,
        wetGain: wetGain,
        effectChain: effectChain
      };
    }
  `;
}

// ─── Web Implementation ────────────────────────────────────────────────────

function WebMicPassthrough({
  isActive,
  trackId,
  bpm,
  effectIntensity,
  micSensitivity,
  masterVolume,
  dryWetMix,
  onLevelUpdate,
  onError,
}: MicPassthroughProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);
  const wetGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chainRef = useRef<any>(null);

  // Start/stop based on isActive
  useEffect(() => {
    if (isActive) {
      startWebPassthrough();
    } else {
      stopWebPassthrough();
    }
    return () => {
      stopWebPassthrough();
    };
  }, [isActive, trackId]);

  // Update master volume
  useEffect(() => {
    if (outputGainRef.current) {
      outputGainRef.current.gain.value = (masterVolume / 100) * (micSensitivity / 100);
    }
  }, [masterVolume, micSensitivity]);

  // Update dry/wet mix
  useEffect(() => {
    const mix = dryWetMix / 100;
    if (dryGainRef.current) dryGainRef.current.gain.value = 1.0 - mix;
    if (wetGainRef.current) wetGainRef.current.gain.value = mix;
  }, [dryWetMix]);

  async function startWebPassthrough() {
    try {
      stopWebPassthrough();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      await ctx.resume(); // Ensure AudioContext is running
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const outputGain = ctx.createGain();
      outputGain.gain.value = (masterVolume / 100) * (micSensitivity / 100);
      outputGainRef.current = outputGain;

      // Build dry/wet chain
      const intensity = effectIntensity / 100;
      const mix = dryWetMix / 100;
      const buildFn = new Function(
        "ctx", "source", "trackId", "bpm", "intensity", "dryWetMix",
        buildEffectChainJS() + "\n" + buildDryWetChainJS() + "\nreturn buildDryWetChain(ctx, source, trackId, bpm, intensity, dryWetMix);"
      );
      const chain = buildFn(ctx, source, trackId, bpm, intensity, mix);
      chainRef.current = chain;
      dryGainRef.current = chain.dryGain;
      wetGainRef.current = chain.wetGain;

      // Connect chain output -> volume -> speakers
      chain.output.connect(outputGain);
      outputGain.connect(ctx.destination);

      // Level metering
      const analyser = chain.analyser;
      analyserRef.current = analyser;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function updateLevel() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const n = dataArray[i] / 255;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(1, rms * 2.5);
        onLevelUpdate?.(level);
        animFrameRef.current = requestAnimationFrame(updateLevel);
      }
      updateLevel();
    } catch (e: any) {
      onError?.(e?.message || "Failed to start mic passthrough");
    }
  }

  function stopWebPassthrough() {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    sourceRef.current = null;
    outputGainRef.current = null;
    dryGainRef.current = null;
    wetGainRef.current = null;
    analyserRef.current = null;
    chainRef.current = null;
  }

  return null;
}

// ─── Native Implementation (WebView with Web Audio API) ─────────────────────

function NativeMicPassthrough({
  isActive,
  trackId,
  bpm,
  effectIntensity,
  micSensitivity,
  masterVolume,
  dryWetMix,
  onLevelUpdate,
  onError,
}: MicPassthroughProps) {
  const webViewRef = useRef<any>(null);
  const [WebViewComponent, setWebViewComponent] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  // Load WebView component
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("react-native-webview");
        if (mounted) {
          setWebViewComponent(() => mod.default || mod.WebView);
        }
      } catch (e) {
        console.warn("react-native-webview not available for mic passthrough");
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Request native mic permission BEFORE WebView tries getUserMedia
  // This is critical on Android — the WebView can only access the mic
  // if the native app already has RECORD_AUDIO permission granted.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ExpoAudio = await import("expo-audio");
        const status = await ExpoAudio.requestRecordingPermissionsAsync();
        if (mounted) {
          setPermissionGranted(status.granted);
          if (!status.granted) {
            onError?.("Microphone permission denied. Please enable in Settings.");
          }
        }
      } catch (e: any) {
        if (mounted) {
          onError?.("Failed to request mic permission: " + (e?.message || "unknown error"));
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  const intensity = effectIntensity / 100;
  const vol = (masterVolume / 100) * (micSensitivity / 100);
  const mix = dryWetMix / 100;

  // The HTML content for the WebView that runs Web Audio API
  // Key fixes for Android:
  // 1. AudioContext.resume() is called explicitly after creation
  // 2. getUserMedia is called with proper constraints
  // 3. Detailed error reporting via postMessage
  // 4. Retry logic if getUserMedia fails initially
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; media-src *;">
  <style>body { margin: 0; background: transparent; }</style>
</head>
<body>
<script>
${buildEffectChainJS()}
${buildDryWetChainJS()}

var audioCtx = null;
var outputGain = null;
var analyser = null;
var stream = null;
var chain = null;
var running = false;
var meteringInterval = null;
var retryCount = 0;
var MAX_RETRIES = 3;

function log(msg) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'log', message: msg }));
}

async function startPassthrough(trackId, bpm, intensity, vol, dryWetMix) {
  try {
    stopPassthrough();
    log('Starting mic passthrough for track ' + trackId);

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia not available in this WebView context');
    }

    log('Requesting getUserMedia...');
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
        sampleRate: 44100
      }
    });
    log('Got media stream with ' + stream.getAudioTracks().length + ' audio tracks');

    // Create AudioContext and explicitly resume it (critical for Android WebView)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
      latencyHint: 'interactive'
    });
    log('AudioContext state: ' + audioCtx.state);

    // Force resume — Android WebView often starts AudioContext in suspended state
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
      log('AudioContext resumed, state: ' + audioCtx.state);
    }

    var source = audioCtx.createMediaStreamSource(stream);

    outputGain = audioCtx.createGain();
    outputGain.gain.value = vol;

    chain = buildDryWetChain(audioCtx, source, trackId, bpm, intensity, dryWetMix);
    chain.output.connect(outputGain);
    outputGain.connect(audioCtx.destination);

    analyser = chain.analyser;
    running = true;
    retryCount = 0;

    // Send level data to React Native at ~20fps
    var dataArray = new Uint8Array(analyser.frequencyBinCount);
    meteringInterval = setInterval(function() {
      if (!running || !analyser) return;

      // Check if AudioContext got suspended and try to resume
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      analyser.getByteFrequencyData(dataArray);
      var sum = 0;
      for (var i = 0; i < dataArray.length; i++) {
        var n = dataArray[i] / 255;
        sum += n * n;
      }
      var rms = Math.sqrt(sum / dataArray.length);
      var level = Math.min(1, rms * 2.5);
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'level', level: level }));
    }, 50);

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' }));
    log('Mic passthrough started successfully');
  } catch (e) {
    var errMsg = e.message || 'Unknown mic error';
    log('Error: ' + errMsg);

    // Retry logic for transient failures
    if (retryCount < MAX_RETRIES && errMsg.indexOf('permission') === -1) {
      retryCount++;
      log('Retrying in 500ms (attempt ' + retryCount + '/' + MAX_RETRIES + ')');
      setTimeout(function() {
        startPassthrough(trackId, bpm, intensity, vol, dryWetMix);
      }, 500);
    } else {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: errMsg }));
    }
  }
}

function stopPassthrough() {
  running = false;
  if (meteringInterval) { clearInterval(meteringInterval); meteringInterval = null; }
  if (stream) { stream.getTracks().forEach(function(t) { t.stop(); }); stream = null; }
  if (audioCtx) {
    try { audioCtx.close(); } catch(e) {}
    audioCtx = null;
  }
  outputGain = null;
  analyser = null;
  chain = null;
}

function setVolume(vol) {
  if (outputGain) {
    outputGain.gain.setValueAtTime(vol, audioCtx ? audioCtx.currentTime : 0);
  }
}

function setDryWet(mix) {
  if (chain && chain.dryGain && chain.wetGain) {
    var t = audioCtx ? audioCtx.currentTime : 0;
    chain.dryGain.gain.setValueAtTime(1.0 - mix, t);
    chain.wetGain.gain.setValueAtTime(mix, t);
  }
}

// Signal ready
window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
</script>
</body>
</html>`;

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case "ready":
          setIsReady(true);
          break;
        case "started":
          break;
        case "level":
          onLevelUpdate?.(data.level);
          break;
        case "error":
          onError?.(data.message);
          break;
        case "log":
          // Debug logging — can be removed in production
          console.log("[MicPassthrough WebView]", data.message);
          break;
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [onLevelUpdate, onError]);

  // Start/stop passthrough when isActive changes
  useEffect(() => {
    if (!webViewRef.current || !isReady || !permissionGranted) return;

    if (isActive) {
      const js = `startPassthrough(${trackId}, ${bpm}, ${intensity}, ${vol}, ${mix}); true;`;
      webViewRef.current.injectJavaScript(js);
    } else {
      webViewRef.current.injectJavaScript("stopPassthrough(); true;");
    }
  }, [isActive, isReady, permissionGranted, trackId, bpm, intensity, vol, mix]);

  // Update volume dynamically
  useEffect(() => {
    if (!webViewRef.current || !isReady || !isActive) return;
    webViewRef.current.injectJavaScript(`setVolume(${vol}); true;`);
  }, [vol, isReady, isActive]);

  // Update dry/wet mix dynamically
  useEffect(() => {
    if (!webViewRef.current || !isReady || !isActive) return;
    webViewRef.current.injectJavaScript(`setDryWet(${mix}); true;`);
  }, [mix, isReady, isActive]);

  // Don't render WebView until we have permission and the component
  if (!WebViewComponent || !permissionGranted) return null;

  const WV = WebViewComponent;

  return (
    <View style={styles.nativeContainer}>
      <WV
        ref={webViewRef}
        source={{ html: htmlContent, baseUrl: "https://localhost" }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mixedContentMode="always"
        originWhitelist={["*"]}
        style={styles.webview}
        androidLayerType="hardware"
        setSupportMultipleWindows={false}
        allowFileAccess={true}
        webviewDebuggingEnabled={__DEV__}
        onPermissionRequest={(event: any) => {
          // Grant all requested permissions (microphone, audio)
          if (event?.nativeEvent?.resources) {
            event.nativeEvent.grant(event.nativeEvent.resources);
          }
        }}
        androidPermissionsRequest={(resources: string[], grant: (resources: string[]) => void) => {
          // Alternative permission handler for newer react-native-webview versions
          grant(resources);
        }}
        onLoadEnd={() => {
          // After the WebView loads, if mic is already active, start passthrough
          if (isActive && isReady && permissionGranted) {
            const js = `startPassthrough(${trackId}, ${bpm}, ${intensity}, ${vol}, ${mix}); true;`;
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(js);
            }, 300);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nativeContainer: {
    // Use real dimensions (not 1x1) to prevent Android from throttling the WebView
    // But position off-screen and make transparent so it's invisible to the user
    width: 100,
    height: 100,
    overflow: "hidden",
    position: "absolute",
    top: -200,
    left: -200,
    opacity: 0.01,
    zIndex: -1,
  },
  webview: {
    width: 100,
    height: 100,
    backgroundColor: "transparent",
  },
});
