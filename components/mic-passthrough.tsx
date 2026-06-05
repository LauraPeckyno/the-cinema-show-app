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
 * MicPassthrough — BOLD EDITION
 *
 * Captures microphone audio with HIGH GAIN, splits into dry (raw) and wet (effected) paths,
 * applies dramatically bold effects (long delays, deep reverbs, heavy distortion, pronounced LFOs),
 * blends them according to dryWetMix, and outputs to speakers/headphones.
 *
 * Effects ONLY alter the microphone audio input — music playback is unaffected.
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

// ─── BOLD Effect DSP chain builder (Web Audio API JavaScript) ─────────────────
// All effects are dramatically more pronounced with longer delays, more feedback,
// deeper modulation, and time-varying parameters.
function buildEffectChainJS(): string {
  return `
    // BOLD Effect chain builder: creates dramatic Web Audio API effect chains
    function buildEffectChain(ctx, source, trackId, bpm, intensity) {
      // HIGH INPUT GAIN — capture even the smallest sounds
      var inputBoost = ctx.createGain();
      inputBoost.gain.value = 15.0 + intensity * 15.0; // 15x to 30x input gain — captures even the slightest scratch or movement

      var output = ctx.createGain();
      output.gain.value = 1.0;

      // Analyser for level metering
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      source.connect(inputBoost);

      var beatSec = 60.0 / bpm;
      var t = ctx.currentTime;

      switch (trackId) {
        case 1: { // ECTOPLASM — massive shimmer hall with 8 delay lines, DOUBLED times, and 0.9 Hz LFO
          var delays = [];
          var fbs = [];
          // DOUBLED delay times (2x the original values)
          var times = [0.074, 0.158, 0.226, 0.334, 0.466, 0.622, 0.838, 1.082];
          var fbVals = [0.72, 0.68, 0.74, 0.65, 0.71, 0.67, 0.69, 0.73];
          var merger = ctx.createGain(); merger.gain.value = 0.4;
          var shimmerHp = ctx.createBiquadFilter();
          shimmerHp.type = 'highpass'; shimmerHp.frequency.value = 1200 + intensity * 3000;
          shimmerHp.Q.value = 1.5;
          // Existing slow shimmer sweep LFO
          var shimmerLfo = ctx.createOscillator(); shimmerLfo.type = 'sine';
          shimmerLfo.frequency.value = 0.05 + intensity * 0.15;
          var shimmerLfoG = ctx.createGain(); shimmerLfoG.gain.value = 2000 * intensity;
          shimmerLfo.connect(shimmerLfoG); shimmerLfoG.connect(shimmerHp.frequency);
          shimmerLfo.start();

          // ── NEW: 0.9 Hz master LFO that modulates the overall reverb character over time ──
          // This creates a breathing/pulsing variation in the reverb tail
          var masterLfo = ctx.createOscillator(); masterLfo.type = 'sine';
          masterLfo.frequency.value = 0.9; // 0.9 Hz — about once per second
          // Modulate the merger output gain: creates a pulsing swell in the reverb
          var masterLfoToMerger = ctx.createGain();
          masterLfoToMerger.gain.value = 0.2 + intensity * 0.15; // ±0.2 to ±0.35 volume swell
          masterLfo.connect(masterLfoToMerger);
          masterLfoToMerger.connect(merger.gain);
          // Modulate the shimmer filter frequency: adds tonal movement at 0.9 Hz
          var masterLfoToFilter = ctx.createGain();
          masterLfoToFilter.gain.value = 800 + intensity * 1200; // ±800 to ±2000 Hz sweep
          masterLfo.connect(masterLfoToFilter);
          masterLfoToFilter.connect(shimmerHp.frequency);
          masterLfo.start();

          // Per-delay-line feedback modulation LFOs at 0.9 Hz with phase offsets
          // Each delay line gets a slightly phase-shifted version of the 0.9 Hz LFO
          // modulating its feedback, creating a swirling spatial effect
          var fbLfoGains = [];
          for (var i = 0; i < 8; i++) {
            var d = ctx.createDelay(4.0); // DOUBLED max delay buffer (was 2.0)
            d.delayTime.value = times[i] * (1.0 + intensity * 0.5);
            var fb = ctx.createGain();
            var baseFb = fbVals[i] * (0.7 + intensity * 0.28);
            fb.gain.value = baseFb;
            // Time-varying feedback: slowly modulate over long periods
            fb.gain.setValueAtTime(baseFb, t);
            fb.gain.linearRampToValueAtTime(baseFb * 0.85, t + 6);
            fb.gain.linearRampToValueAtTime(baseFb * 1.08, t + 12);
            fb.gain.linearRampToValueAtTime(baseFb * 0.92, t + 18);
            fb.gain.linearRampToValueAtTime(baseFb, t + 24);
            // ── 0.9 Hz LFO modulating each feedback gain with phase offset ──
            var fbLfoG = ctx.createGain();
            fbLfoG.gain.value = 0.06 + intensity * 0.08; // ±0.06 to ±0.14 feedback variation
            masterLfo.connect(fbLfoG);
            fbLfoG.connect(fb.gain);
            fbLfoGains.push(fbLfoG);
            // Also modulate delay time slightly for chorus-like movement
            var delLfoG = ctx.createGain();
            delLfoG.gain.value = 0.003 + i * 0.001; // subtle time modulation per line
            masterLfo.connect(delLfoG);
            delLfoG.connect(d.delayTime);

            inputBoost.connect(d);
            d.connect(fb); fb.connect(d); // feedback loop
            d.connect(shimmerHp);
            delays.push(d); fbs.push(fb);
          }
          shimmerHp.connect(merger);
          // Dry signal (slightly louder to balance the longer reverb)
          var dryMix = ctx.createGain(); dryMix.gain.value = 0.18;
          inputBoost.connect(dryMix);
          dryMix.connect(analyser);
          merger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 2: { // INSOMNIA — rhythmic chopping with dual ping-pong delays
          var stutterGain = ctx.createGain();
          stutterGain.gain.value = 1.0;
          // Main stutter LFO — synced to 16th notes
          var stutterLfo = ctx.createOscillator();
          stutterLfo.type = 'square';
          stutterLfo.frequency.value = bpm / 60 * 4; // 16th notes
          var stutterDepth = ctx.createGain();
          stutterDepth.gain.value = 0.8 + intensity * 0.2; // very deep gating
          // Secondary stutter at triplet timing for polyrhythmic feel
          var stutterLfo2 = ctx.createOscillator();
          stutterLfo2.type = 'square';
          stutterLfo2.frequency.value = bpm / 60 * 3; // triplets
          var stutterDepth2 = ctx.createGain();
          stutterDepth2.gain.value = 0.3 * intensity;
          // Pitch-shifting delay that creates granular texture
          var grainDel = ctx.createDelay(0.1);
          grainDel.delayTime.value = 0.01;
          var grainLfo = ctx.createOscillator(); grainLfo.type = 'sawtooth';
          grainLfo.frequency.value = bpm / 60 * 2;
          var grainLfoG = ctx.createGain(); grainLfoG.gain.value = 0.008 * intensity;
          grainLfo.connect(grainLfoG); grainLfoG.connect(grainDel.delayTime);
          grainLfo.start();
          // Feedback for stacking
          var grainFb = ctx.createGain(); grainFb.gain.value = 0.5 + intensity * 0.3;
          grainDel.connect(grainFb); grainFb.connect(grainDel);

          inputBoost.connect(stutterGain);
          stutterLfo.connect(stutterDepth); stutterDepth.connect(stutterGain.gain);
          stutterLfo2.connect(stutterDepth2); stutterDepth2.connect(stutterGain.gain);
          stutterLfo.start(); stutterLfo2.start();
          stutterGain.connect(grainDel);

          // ── PING PONG DELAY at 76 BPM (quarter note = 60/76 = ~0.789s) ──
          // Left-right alternating delay simulated with two cross-fed delay lines
          var ppDelay76sec = 60.0 / 76.0; // ~0.789s per beat
          var ppDelL1 = ctx.createDelay(2.0);
          ppDelL1.delayTime.value = ppDelay76sec; // left tap at 76 BPM
          var ppDelR1 = ctx.createDelay(2.0);
          ppDelR1.delayTime.value = ppDelay76sec * 2; // right tap (2 beats)
          var ppFbL1 = ctx.createGain(); ppFbL1.gain.value = 0.5; // 50% feedback
          var ppFbR1 = ctx.createGain(); ppFbR1.gain.value = 0.5; // 50% feedback
          // Cross-feed: left feeds right, right feeds left (ping-pong pattern)
          ppDelL1.connect(ppFbL1); ppFbL1.connect(ppDelR1);
          ppDelR1.connect(ppFbR1); ppFbR1.connect(ppDelL1);
          var ppMix1 = ctx.createGain(); ppMix1.gain.value = 0.45;
          ppDelL1.connect(ppMix1);
          ppDelR1.connect(ppMix1);

          // ── PING PONG DELAY at 304 BPM (quarter note = 60/304 = ~0.197s) ──
          // Fast rhythmic ping-pong for rapid echoes
          var ppDelay304sec = 60.0 / 304.0; // ~0.197s per beat
          var ppDelL2 = ctx.createDelay(1.0);
          ppDelL2.delayTime.value = ppDelay304sec; // left tap at 304 BPM
          var ppDelR2 = ctx.createDelay(1.0);
          ppDelR2.delayTime.value = ppDelay304sec * 2; // right tap (2 beats)
          var ppFbL2 = ctx.createGain(); ppFbL2.gain.value = 0.5; // 50% feedback
          var ppFbR2 = ctx.createGain(); ppFbR2.gain.value = 0.5; // 50% feedback
          // Cross-feed: ping-pong pattern
          ppDelL2.connect(ppFbL2); ppFbL2.connect(ppDelR2);
          ppDelR2.connect(ppFbR2); ppFbR2.connect(ppDelL2);
          var ppMix2 = ctx.createGain(); ppMix2.gain.value = 0.45;
          ppDelL2.connect(ppMix2);
          ppDelR2.connect(ppMix2);

          // Route: granular stutter → both ping pong delays (parallel)
          grainDel.connect(ppDelL1);
          grainDel.connect(ppDelL2);
          // Also send direct stuttered signal into the ping pongs
          stutterGain.connect(ppDelL1);
          stutterGain.connect(ppDelL2);

          // Mix everything to analyser: granular + both ping pong delays
          grainDel.connect(analyser);
          stutterGain.connect(analyser);
          ppMix1.connect(analyser);
          ppMix2.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 3: { // MUTATION CHAOS — Bitcrusher at 60 BPM, Chorus at 40 BPM (10% width), Mono Delay at 30 BPM, Gate at 60 BPM
          // All effects synced to their respective BPMs (track BPM is 120)
          var beat60 = 60.0 / 60.0; // 1.0s per beat at 60 BPM
          var beat40 = 60.0 / 40.0; // 1.5s per beat at 40 BPM
          var beat30 = 60.0 / 30.0; // 2.0s per beat at 30 BPM

          // ── BITCRUSHER at 60 BPM ──
          // Simulated bitcrushing via waveshaper + sample-rate reduction effect
          var crushWs = ctx.createWaveShaper();
          var crushCurve = new Float32Array(256);
          var crushBits = 4 + Math.floor((1 - intensity) * 8); // 4-12 bits depending on intensity
          var crushSteps = Math.pow(2, crushBits);
          for (var ci = 0; ci < 256; ci++) {
            var cx = (ci / 128) - 1;
            crushCurve[ci] = Math.round(cx * crushSteps) / crushSteps;
          }
          crushWs.curve = crushCurve;
          crushWs.oversample = 'none';
          // Rhythmic bitcrush modulation at 60 BPM — LFO gates the crush intensity
          var crushLfo = ctx.createOscillator(); crushLfo.type = 'square';
          crushLfo.frequency.value = 60.0 / 60.0; // 1 Hz = 60 BPM
          var crushLfoGain = ctx.createGain(); crushLfoGain.gain.value = 0.5;
          crushLfo.connect(crushLfoGain);
          crushLfo.start();
          // Pre-crush gain
          var crushPreGain = ctx.createGain(); crushPreGain.gain.value = 1.5 + intensity * 2.0;

          // ── CHORUS at 40 BPM (10% width) ──
          // Chorus uses modulated delay lines; 10% width = 0.1 * beat40 = 0.15s max modulation
          var chorusDelay = ctx.createDelay(0.5);
          chorusDelay.delayTime.value = 0.02; // base delay
          var chorusLfo = ctx.createOscillator(); chorusLfo.type = 'sine';
          chorusLfo.frequency.value = 40.0 / 60.0; // 0.667 Hz = 40 BPM
          var chorusWidth = beat40 * 0.10; // 10% width = 0.15s
          var chorusLfoGain = ctx.createGain();
          chorusLfoGain.gain.value = chorusWidth * 0.5; // modulation depth
          chorusLfo.connect(chorusLfoGain);
          chorusLfoGain.connect(chorusDelay.delayTime);
          chorusLfo.start();
          var chorusMix = ctx.createGain(); chorusMix.gain.value = 0.5 + intensity * 0.3;

          // ── MONO DELAY at 30 BPM ──
          // Single delay line with feedback, synced to 30 BPM (2s per beat)
          var monoDelay = ctx.createDelay(4.0);
          monoDelay.delayTime.value = beat30; // 2.0s delay time
          var monoFb = ctx.createGain();
          monoFb.gain.value = 0.45 + intensity * 0.25; // moderate-to-high feedback
          monoDelay.connect(monoFb);
          monoFb.connect(monoDelay); // feedback loop
          var monoDelayMix = ctx.createGain(); monoDelayMix.gain.value = 0.5;

          // ── GATE at 60 BPM ──
          // Hard rhythmic gate that chops the signal at 60 BPM
          var gateNode = ctx.createGain(); gateNode.gain.value = 1.0;
          var gateLfo = ctx.createOscillator(); gateLfo.type = 'square';
          gateLfo.frequency.value = 60.0 / 60.0; // 1 Hz = 60 BPM
          var gateDepth = ctx.createGain(); gateDepth.gain.value = 0.9 + intensity * 0.1;
          gateLfo.connect(gateDepth);
          gateDepth.connect(gateNode.gain);
          gateLfo.start();

          // ── Signal chain: input → bitcrusher → chorus → mono delay → gate → output ──
          inputBoost.connect(crushPreGain);
          crushPreGain.connect(crushWs);
          // Bitcrushed signal splits to chorus (wet) and direct (dry)
          crushWs.connect(chorusDelay); // wet chorus path
          chorusDelay.connect(chorusMix);
          crushWs.connect(gateNode); // direct path through gate
          chorusMix.connect(gateNode); // chorus also through gate
          // Gate output feeds mono delay and direct to analyser
          gateNode.connect(monoDelay);
          gateNode.connect(analyser);
          monoDelay.connect(monoDelayMix);
          monoDelayMix.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 4: { // KRAMPUS' HELPERS — Reversed waveform at 1/2 speed + rotary modulator + large reverb
          // ── WAVEFORM REVERSAL at HALF SPEED ──
          // Captures audio into a large buffer, plays back in reverse at half speed
          // (reads every other sample) creating a slowed, reversed texture
          var revBufSize4 = 8192; // larger buffer for half-speed playback
          var reverseNode4 = ctx.createScriptProcessor(revBufSize4, 1, 1);
          var revBuffer4 = new Float32Array(revBufSize4 * 2); // double buffer for half-speed
          var revWriteIdx4 = 0;
          var revPhase4 = 0; // alternates: 0=filling, 1=playing
          var revPlayBuf4 = new Float32Array(revBufSize4 * 2);
          reverseNode4.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            // Accumulate input into write buffer
            for (var wi = 0; wi < revBufSize4; wi++) {
              revBuffer4[revWriteIdx4] = inp[wi];
              revWriteIdx4++;
              if (revWriteIdx4 >= revBufSize4 * 2) {
                // Buffer full - copy to play buffer and reset
                for (var ci = 0; ci < revBufSize4 * 2; ci++) {
                  revPlayBuf4[ci] = revBuffer4[ci];
                }
                revWriteIdx4 = 0;
              }
            }
            // Output: read from play buffer in reverse at half speed
            // Half speed = read 1 sample for every 2 output samples (interpolated)
            for (var ro = 0; ro < revBufSize4; ro++) {
              var readPos = (revBufSize4 * 2 - 1) - Math.floor(ro * 0.5);
              if (readPos >= 0 && readPos < revBufSize4 * 2) {
                out[ro] = revPlayBuf4[readPos] * 0.8;
              } else {
                out[ro] = 0;
              }
            }
          };

          // ── ROTARY MODULATOR at 480 BPM (8 Hz) ──
          var rotary480Hz = 480.0 / 60.0;
          var rotary480Lfo = ctx.createOscillator(); rotary480Lfo.type = 'sine';
          rotary480Lfo.frequency.value = rotary480Hz;
          var rotary480Amp = ctx.createGain(); rotary480Amp.gain.value = 1.0;
          var rotary480AmpDepth = ctx.createGain();
          rotary480AmpDepth.gain.value = 0.4 + intensity * 0.3;
          rotary480Lfo.connect(rotary480AmpDepth);
          rotary480AmpDepth.connect(rotary480Amp.gain);
          var rotary480Del = ctx.createDelay(0.05);
          rotary480Del.delayTime.value = 0.003;
          var rotary480DelMod = ctx.createGain();
          rotary480DelMod.gain.value = 0.002 + intensity * 0.002;
          rotary480Lfo.connect(rotary480DelMod);
          rotary480DelMod.connect(rotary480Del.delayTime);
          rotary480Lfo.start();

          // ── ROTARY MODULATOR at 240 BPM (4 Hz) ──
          var rotary240Hz = 240.0 / 60.0;
          var rotary240Lfo = ctx.createOscillator(); rotary240Lfo.type = 'sine';
          rotary240Lfo.frequency.value = rotary240Hz;
          var rotary240Amp = ctx.createGain(); rotary240Amp.gain.value = 1.0;
          var rotary240AmpDepth = ctx.createGain();
          rotary240AmpDepth.gain.value = 0.35 + intensity * 0.25;
          rotary240Lfo.connect(rotary240AmpDepth);
          rotary240AmpDepth.connect(rotary240Amp.gain);
          var rotary240Del = ctx.createDelay(0.05);
          rotary240Del.delayTime.value = 0.005;
          var rotary240DelMod = ctx.createGain();
          rotary240DelMod.gain.value = 0.003 + intensity * 0.003;
          rotary240Lfo.connect(rotary240DelMod);
          rotary240DelMod.connect(rotary240Del.delayTime);
          rotary240Lfo.start();

          // ── LARGE REVERB (5-7 second decay) ──
          // Applied to the entire output for cavernous atmosphere
          var krRevDelays = [0.089, 0.127, 0.167, 0.199, 0.241, 0.307];
          var krRevMerge = ctx.createGain(); krRevMerge.gain.value = 0.5;

          // ── Signal chain: input → reverse(half-speed) → rotary480 + rotary240 → reverb → output ──
          inputBoost.connect(reverseNode4);
          reverseNode4.connect(rotary480Del);
          rotary480Del.connect(rotary480Amp);
          reverseNode4.connect(rotary240Del);
          rotary240Del.connect(rotary240Amp);
          // Mix rotary outputs
          var rotaryMerge4 = ctx.createGain(); rotaryMerge4.gain.value = 0.5;
          rotary480Amp.connect(rotaryMerge4);
          rotary240Amp.connect(rotaryMerge4);
          // Feed rotary mix into reverb (connect to each delay line input)
          // The reverb delay lines need signal fed into them
          // We create a reverb input splitter
          var krRevIn = ctx.createGain(); krRevIn.gain.value = 0.7;
          rotaryMerge4.connect(krRevIn);
          // Properly build reverb: input -> delays -> feedback loop -> merge
          var krRevDels = [];
          for (var kri2 = 0; kri2 < krRevDelays.length; kri2++) {
            var krd = ctx.createDelay(2.0);
            krd.delayTime.value = krRevDelays[kri2] * (1 + intensity * 0.15);
            var krfb = ctx.createGain();
            krfb.gain.value = 0.82 + intensity * 0.05;
            krRevIn.connect(krd);
            krd.connect(krfb);
            krfb.connect(krd); // feedback loop
            krd.connect(krRevMerge);
          }
          // Output: dry rotary + wet reverb
          var krDryOut = ctx.createGain(); krDryOut.gain.value = 0.3;
          rotaryMerge4.connect(krDryOut);
          krDryOut.connect(analyser);
          krRevMerge.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 5: { // SPECTRAL CORRECTION — Stereo Enhancer (200%), 7s reverb, A440 minor pitch correction
          // ── STEREO ENHANCER at 200% width ──
          // Simulated via mid-side processing: boost side (difference) signal
          // In mono Web Audio we simulate width by creating a delayed/phase-shifted copy
          var stereoDelay = ctx.createDelay(0.05);
          stereoDelay.delayTime.value = 0.015; // Haas effect for width
          var stereoPhaseInvert = ctx.createGain();
          stereoPhaseInvert.gain.value = -1.0; // phase inversion for difference
          var stereoWidth = ctx.createGain();
          stereoWidth.gain.value = 2.0; // 200% width
          var stereoMid = ctx.createGain(); stereoMid.gain.value = 0.5;
          var stereoSide = ctx.createGain(); stereoSide.gain.value = 1.0; // boosted side
          var stereoMerge = ctx.createGain(); stereoMerge.gain.value = 0.8;
          // Mid path (direct)
          inputBoost.connect(stereoMid);
          stereoMid.connect(stereoMerge);
          // Side path (delayed + phase shifted for maximum width)
          inputBoost.connect(stereoDelay);
          stereoDelay.connect(stereoWidth);
          stereoWidth.connect(stereoMerge);

          // ── 7-SECOND REVERB ──
          // Very long reverb using 8 feedback delay lines with high feedback
          var revDelays = [0.097, 0.131, 0.173, 0.211, 0.257, 0.313, 0.397, 0.461];
          var revMerger = ctx.createGain(); revMerger.gain.value = 0.4;
          var revLp = ctx.createBiquadFilter();
          revLp.type = 'lowpass'; revLp.frequency.value = 3000 + (1 - intensity) * 2000;
          revLp.Q.value = 0.7;
          // Long reverb with SAFE feedback to prevent runaway/feedback
          // Using lower feedback (0.78-0.82) with more delay lines for density
          // This gives ~4-5s decay without risk of oscillation
          for (var ri = 0; ri < revDelays.length; ri++) {
            var rd = ctx.createDelay(2.0);
            rd.delayTime.value = revDelays[ri] * (1 + intensity * 0.2);
            var rFb = ctx.createGain();
            rFb.gain.value = 0.78 + intensity * 0.04; // safe feedback, no runaway
            var rdLp = ctx.createBiquadFilter();
            rdLp.type = 'lowpass'; rdLp.frequency.value = 3000 + (1 - intensity) * 2000;
            rdLp.Q.value = 0.7;
            stereoMerge.connect(rd);
            rd.connect(rdLp); rdLp.connect(rFb); rFb.connect(rd);
            rd.connect(revMerger);
          }

          // ── AUTO PITCH CORRECTION to A440 minor scale ──
          // A natural minor: A, B, C, D, E, F, G (440, 494, 523, 587, 659, 698, 784 Hz)
          // We use a bank of very narrow bandpass filters tuned to A minor scale frequencies
          // across multiple octaves to force the signal toward those pitches
          var minorFreqs = [
            // A2=110, B2=123, C3=131, D3=147, E3=165, F3=175, G3=196
            110, 123.47, 130.81, 146.83, 164.81, 174.61, 196.00,
            // A3=220, B3=247, C4=262, D4=294, E4=330, F4=349, G4=392
            220, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00,
            // A4=440, B4=494, C5=523, D5=587, E5=659, F5=698, G5=784
            440, 493.88, 523.25, 587.33, 659.25, 698.46, 783.99,
            // A5=880, B5=988, C6=1047, D6=1175, E6=1319
            880, 987.77, 1046.50, 1174.66, 1318.51
          ];
          var pitchMerger = ctx.createGain(); pitchMerger.gain.value = 0.6;
          for (var pci = 0; pci < minorFreqs.length; pci++) {
            var pcBp = ctx.createBiquadFilter();
            pcBp.type = 'bandpass';
            pcBp.frequency.value = minorFreqs[pci];
            pcBp.Q.value = 30 + intensity * 20; // very narrow = strong pitch correction
            revMerger.connect(pcBp);
            pcBp.connect(pitchMerger);
          }

          // Mix: pitch-corrected reverb output + a touch of direct reverb
          var directRev = ctx.createGain(); directRev.gain.value = 0.15;
          revMerger.connect(directRev); directRev.connect(analyser);
          pitchMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 6: { // PENANCE GATE — Square wave gate (1ms attack, 22ms release) + Ping Pong Delay at 60 BPM, 95% wet
          // ── SQUARE WAVE GATE with 1ms attack and 22ms release ──
          // The gate opens/closes at 60 BPM (1 Hz) with shaped envelope
          var gateRate = 60.0 / 60.0; // 1 Hz = 60 BPM
          var gateNode6 = ctx.createGain(); gateNode6.gain.value = 0.0;
          // Use a ScriptProcessor to create precise attack/release envelope
          // For Web Audio, we approximate with a square LFO + envelope shaping
          var gateLfo6 = ctx.createOscillator(); gateLfo6.type = 'square';
          gateLfo6.frequency.value = gateRate;
          // Shape the square wave: we use a lowpass filter to round the edges
          // 1ms attack = very fast rise, 22ms release = slightly slower fall
          // A lowpass at ~45 Hz on a 1 Hz square gives roughly the right envelope shape
          var gateEnvFilter = ctx.createBiquadFilter();
          gateEnvFilter.type = 'lowpass';
          gateEnvFilter.frequency.value = 45; // shapes the 1ms/22ms envelope
          gateEnvFilter.Q.value = 0.5;
          var gateEnvGain = ctx.createGain();
          gateEnvGain.gain.value = 0.95 + intensity * 0.05; // near-full gating
          gateLfo6.connect(gateEnvFilter);
          gateEnvFilter.connect(gateEnvGain);
          gateEnvGain.connect(gateNode6.gain);
          gateLfo6.start();

          // ── PING PONG DELAY at 60 BPM (1s per beat), 95% wet return ──
          var ppBeat60 = 60.0 / 60.0; // 1.0s per beat
          // Left delay tap
          var ppDelL = ctx.createDelay(3.0);
          ppDelL.delayTime.value = ppBeat60; // 1s (quarter note at 60 BPM)
          // Right delay tap (half beat offset for ping-pong)
          var ppDelR = ctx.createDelay(3.0);
          ppDelR.delayTime.value = ppBeat60 * 0.5; // 0.5s (eighth note)
          // Cross-feedback for ping-pong pattern
          var ppFbLR = ctx.createGain(); ppFbLR.gain.value = 0.6 + intensity * 0.2;
          var ppFbRL = ctx.createGain(); ppFbRL.gain.value = 0.6 + intensity * 0.2;
          ppDelL.connect(ppFbLR); ppFbLR.connect(ppDelR);
          ppDelR.connect(ppFbRL); ppFbRL.connect(ppDelL);
          // Wet/dry mixing: 95% wet return
          var ppWet = ctx.createGain(); ppWet.gain.value = 0.95;
          var ppDry = ctx.createGain(); ppDry.gain.value = 0.05;
          // Merge ping pong outputs
          var ppMerge = ctx.createGain(); ppMerge.gain.value = 0.7;
          ppDelL.connect(ppMerge);
          ppDelR.connect(ppMerge);

          // ── Signal chain: input → gate → ping pong delay (95% wet) → output ──
          inputBoost.connect(gateNode6);
          // Gated signal feeds into ping pong
          gateNode6.connect(ppDelL);
          gateNode6.connect(ppDelR);
          // Wet path (95%)
          ppMerge.connect(ppWet);
          ppWet.connect(analyser);
          // Dry path (5%)
          gateNode6.connect(ppDry);
          ppDry.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 7: { // RHYTHMIC GATE — aggressive BPM-synced gate with stacked patterns and sidechain
          // Main gate at quarter notes
          var gateGain = ctx.createGain(); gateGain.gain.value = 1.0;
          var gateLfo = ctx.createOscillator(); gateLfo.type = 'square';
          gateLfo.frequency.value = bpm / 60;
          var gateDepth = ctx.createGain(); gateDepth.gain.value = 0.9 + intensity * 0.1; // near-total gating
          // Secondary gate at dotted eighth for complex rhythm
          var gateGain2 = ctx.createGain(); gateGain2.gain.value = 1.0;
          var gateLfo2 = ctx.createOscillator(); gateLfo2.type = 'square';
          gateLfo2.frequency.value = bpm / 60 * 1.5; // dotted eighth
          var gateDepth2 = ctx.createGain(); gateDepth2.gain.value = 0.5 * intensity;
          // Delay tail on gated signal
          var gateDel = ctx.createDelay(2.0);
          gateDel.delayTime.value = beatSec * 0.5;
          var gateFb = ctx.createGain(); gateFb.gain.value = 0.55 + intensity * 0.25;
          var gateLp = ctx.createBiquadFilter();
          gateLp.type = 'lowpass'; gateLp.frequency.value = 2000 + (1 - intensity) * 3000;

          inputBoost.connect(gateGain);
          gateLfo.connect(gateDepth); gateDepth.connect(gateGain.gain);
          gateLfo.start();
          gateGain.connect(gateGain2);
          gateLfo2.connect(gateDepth2); gateDepth2.connect(gateGain2.gain);
          gateLfo2.start();
          gateGain2.connect(gateDel);
          gateDel.connect(gateLp); gateLp.connect(gateFb); gateFb.connect(gateDel);
          gateGain2.connect(analyser);
          gateDel.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 8: { // CRYSTAL DELAY — bright cascading multi-tap with pitch-shifted repeats
          var cdTimes = [beatSec * 0.25, beatSec * 0.5, beatSec * 0.75, beatSec, beatSec * 1.5, beatSec * 2];
          var cdMerger = ctx.createGain(); cdMerger.gain.value = 0.35;
          // Shimmer LFO for pitch modulation
          var shimLfo8 = ctx.createOscillator(); shimLfo8.type = 'sine';
          shimLfo8.frequency.value = 2 + intensity * 3;
          shimLfo8.start();

          // Each delay tap gets its OWN filter and feedback to prevent shared-node feedback loops
          for (var ci = 0; ci < cdTimes.length; ci++) {
            var cd8 = ctx.createDelay(5.0);
            cd8.delayTime.value = cdTimes[ci];
            // Individual highpass per tap (prevents shared filter feedback)
            var cdHp8 = ctx.createBiquadFilter();
            cdHp8.type = 'highpass'; cdHp8.frequency.value = 3000 + intensity * 3000;
            cdHp8.Q.value = 1.5 + intensity * 2;
            // Individual shimmer delay per tap
            var shimDel8 = ctx.createDelay(0.05);
            shimDel8.delayTime.value = 0.01;
            var shimG8 = ctx.createGain(); shimG8.gain.value = 0.004 + intensity * 0.006;
            shimLfo8.connect(shimG8); shimG8.connect(shimDel8.delayTime);
            // SAFE feedback: reduced values, no shared routing
            var cFb8 = ctx.createGain();
            cFb8.gain.value = 0.35 + intensity * 0.15 - ci * 0.02; // much lower feedback
            // Chain: input -> delay -> hp -> shimmer -> feedback -> delay
            inputBoost.connect(cd8);
            cd8.connect(cdHp8);
            cdHp8.connect(shimDel8);
            shimDel8.connect(cFb8);
            cFb8.connect(cd8);
            cd8.connect(cdMerger);
          }
          var cdDry8 = ctx.createGain(); cdDry8.gain.value = 0.2;
          inputBoost.connect(cdDry8); cdDry8.connect(analyser);
          cdMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 9: { // SIDECHAIN PUMP — Excitement and Elimination
          var scDel = ctx.createDelay(2.0);
          scDel.delayTime.value = beatSec;
          var scLfo = ctx.createOscillator(); scLfo.type = 'sine';
          scLfo.frequency.value = bpm / 60;
          var scGain = ctx.createGain(); scGain.gain.value = 1.0;
          var scLfoG = ctx.createGain(); scLfoG.gain.value = 0.8 + intensity * 0.2;
          scLfo.connect(scLfoG); scLfoG.connect(scGain.gain);
          scLfo.start();
          var scFb = ctx.createGain(); scFb.gain.value = 0.4 + intensity * 0.3;
          inputBoost.connect(scGain);
          scGain.connect(scDel); scDel.connect(scFb); scFb.connect(scDel);
          scGain.connect(analyser);
          scDel.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 10: { // FLANGER WASH — Piano Fandango
          var fwLfo = ctx.createOscillator(); fwLfo.type = 'sine';
          fwLfo.frequency.value = 0.2 + intensity * 0.8;
          var fwDel = ctx.createDelay(0.02);
          fwDel.delayTime.value = 0.005;
          var fwLfoG = ctx.createGain(); fwLfoG.gain.value = 0.004 * (1 + intensity * 3);
          fwLfo.connect(fwLfoG); fwLfoG.connect(fwDel.delayTime);
          fwLfo.start();
          var fwFb = ctx.createGain(); fwFb.gain.value = 0.6 + intensity * 0.3;
          fwDel.connect(fwFb); fwFb.connect(fwDel);
          var fwDry = ctx.createGain(); fwDry.gain.value = 0.4;
          inputBoost.connect(fwDel);
          inputBoost.connect(fwDry); fwDry.connect(analyser);
          fwDel.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 11: { // WARM CHORUS — Brothers
          var wcVoices = 6;
          var wcMerger = ctx.createGain(); wcMerger.gain.value = 0.5;
          var wcRates = [0.2, 0.35, 0.5, 0.7, 0.9, 1.2];
          var wcDepths = [0.012, 0.015, 0.018, 0.02, 0.014, 0.022];
          var wcDelays = [0.02, 0.03, 0.04, 0.025, 0.035, 0.045];
          for (var wci = 0; wci < wcVoices; wci++) {
            var wcd = ctx.createDelay(0.1);
            wcd.delayTime.value = wcDelays[wci];
            var wcLfo = ctx.createOscillator(); wcLfo.type = 'sine';
            wcLfo.frequency.value = wcRates[wci] * (1 + intensity);
            var wcLfoG = ctx.createGain();
            wcLfoG.gain.value = wcDepths[wci] * (1 + intensity * 3);
            wcLfo.connect(wcLfoG); wcLfoG.connect(wcd.delayTime);
            wcLfo.start();
            var wcFb = ctx.createGain(); wcFb.gain.value = 0.3 + intensity * 0.35;
            wcd.connect(wcFb); wcFb.connect(wcd);
            inputBoost.connect(wcd);
            wcd.connect(wcMerger);
          }
          var wcDry = ctx.createGain(); wcDry.gain.value = 0.2;
          inputBoost.connect(wcDry); wcDry.connect(analyser);
          wcMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 12: { // PRISM SPLIT — Much Ado
          var prismBands2 = [200, 500, 900, 1400, 2200, 3500, 5500, 8000];
          var prismMerger2 = ctx.createGain(); prismMerger2.gain.value = 0.4;
          for (var pi2 = 0; pi2 < prismBands2.length; pi2++) {
            var pBp2 = ctx.createBiquadFilter();
            pBp2.type = 'bandpass'; pBp2.frequency.value = prismBands2[pi2];
            pBp2.Q.value = 4 + intensity * 6;
            var pDel2 = ctx.createDelay(2.0);
            pDel2.delayTime.value = pi2 * 0.08 * (1 + intensity);
            var pFb2 = ctx.createGain(); pFb2.gain.value = 0.45 + intensity * 0.3;
            pDel2.connect(pFb2); pFb2.connect(pDel2);
            var pGain2 = ctx.createGain();
            pGain2.gain.value = 0.5 + (pi2 % 2 === 0 ? 0.2 : -0.1);
            inputBoost.connect(pBp2);
            pBp2.connect(pDel2);
            pDel2.connect(pGain2);
            pGain2.connect(prismMerger2);
          }
          prismMerger2.connect(analyser);
          analyser.connect(output);
          break;
        }



        default: // Fallback - boosted passthrough
          inputBoost.connect(analyser);
          analyser.connect(output);
          break;
      }

      return { output: output, analyser: analyser };
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
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      // HIGH INPUT GAIN for dry path too
      var dryBoost = ctx.createGain();
      dryBoost.gain.value = 3.0 + intensity * 4.0; // match the effect chain input boost

      // Dry path: source -> dryBoost -> dryGain -> merger
      source.connect(dryBoost);
      dryBoost.connect(dryGain);
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

  // Update master volume — includes mic sensitivity as gain multiplier
  useEffect(() => {
    if (outputGainRef.current) {
      outputGainRef.current.gain.value = (masterVolume / 100) * (micSensitivity / 25); // ultra-high sensitivity — 4x at max, captures faintest sounds
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
      await ctx.resume();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const outputGain = ctx.createGain();
      outputGain.gain.value = (masterVolume / 100) * (micSensitivity / 50);
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
        const level = Math.min(1, rms * 3.0); // boosted level reporting
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
  const vol = (masterVolume / 100) * (micSensitivity / 25); // ultra-high sensitivity — 4x at max, captures faintest sounds
  const mix = dryWetMix / 100;

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
    log('Starting BOLD mic passthrough for track ' + trackId);

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

    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 44100,
      latencyHint: 'interactive'
    });
    log('AudioContext state: ' + audioCtx.state);

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
      var level = Math.min(1, rms * 8.0); // ultra-boosted level metering — shows even the tiniest vibrations
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'level', level: level }));
    }, 50);

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'started' }));
    log('BOLD mic passthrough started successfully');
  } catch (e) {
    var errMsg = e.message || 'Unknown mic error';
    log('Error: ' + errMsg);

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
  if (outputGain && audioCtx) {
    outputGain.gain.setValueAtTime(vol, audioCtx.currentTime);
  }
}

function setDryWet(mix) {
  if (chain && chain.dryGain && chain.wetGain && audioCtx) {
    var t = audioCtx.currentTime;
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
          if (event?.nativeEvent?.resources) {
            event.nativeEvent.grant(event.nativeEvent.resources);
          }
        }}
        androidPermissionsRequest={(resources: string[], grant: (resources: string[]) => void) => {
          grant(resources);
        }}
        onLoadEnd={() => {
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
