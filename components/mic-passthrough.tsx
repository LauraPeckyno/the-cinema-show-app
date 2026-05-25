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

        case 4: { // KRAMPUS' HELPERS — Completely reversed waveform + rotary modulator at 480 BPM and 240 BPM
          // ── WAVEFORM REVERSAL ──
          // Uses a ScriptProcessor/AudioWorklet pattern: captures audio into a buffer,
          // then plays it back in reverse. We use a pair of alternating delay buffers
          // to create a continuous reverse effect.
          var revBufSize = 4096; // buffer size for reverse chunks
          var reverseNode = ctx.createScriptProcessor(revBufSize, 1, 1);
          var revBuffer = new Float32Array(revBufSize);
          var revWritePos = 0;
          var revReadReady = false;
          reverseNode.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            // Write input to buffer
            for (var ri = 0; ri < revBufSize; ri++) {
              revBuffer[ri] = inp[ri];
            }
            // Output the buffer in reverse order
            for (var ro = 0; ro < revBufSize; ro++) {
              out[ro] = revBuffer[revBufSize - 1 - ro];
            }
          };

          // ── ROTARY MODULATOR at 480 BPM (8 Hz) ──
          // Simulates a Leslie-style rotary speaker with amplitude + frequency modulation
          var rotary480Hz = 480.0 / 60.0; // 8 Hz
          var rotary480Lfo = ctx.createOscillator(); rotary480Lfo.type = 'sine';
          rotary480Lfo.frequency.value = rotary480Hz;
          // Amplitude modulation (tremolo) at 480 BPM
          var rotary480Amp = ctx.createGain(); rotary480Amp.gain.value = 1.0;
          var rotary480AmpDepth = ctx.createGain();
          rotary480AmpDepth.gain.value = 0.4 + intensity * 0.3; // deep AM
          rotary480Lfo.connect(rotary480AmpDepth);
          rotary480AmpDepth.connect(rotary480Amp.gain);
          // Frequency modulation (doppler/pitch wobble) at 480 BPM via modulated delay
          var rotary480Del = ctx.createDelay(0.05);
          rotary480Del.delayTime.value = 0.003;
          var rotary480DelMod = ctx.createGain();
          rotary480DelMod.gain.value = 0.002 + intensity * 0.002; // subtle pitch modulation
          rotary480Lfo.connect(rotary480DelMod);
          rotary480DelMod.connect(rotary480Del.delayTime);
          rotary480Lfo.start();

          // ── ROTARY MODULATOR at 240 BPM (4 Hz) ──
          // Second rotary at half speed for bass rotor simulation
          var rotary240Hz = 240.0 / 60.0; // 4 Hz
          var rotary240Lfo = ctx.createOscillator(); rotary240Lfo.type = 'sine';
          rotary240Lfo.frequency.value = rotary240Hz;
          // Amplitude modulation at 240 BPM
          var rotary240Amp = ctx.createGain(); rotary240Amp.gain.value = 1.0;
          var rotary240AmpDepth = ctx.createGain();
          rotary240AmpDepth.gain.value = 0.35 + intensity * 0.25;
          rotary240Lfo.connect(rotary240AmpDepth);
          rotary240AmpDepth.connect(rotary240Amp.gain);
          // Frequency modulation at 240 BPM
          var rotary240Del = ctx.createDelay(0.05);
          rotary240Del.delayTime.value = 0.005;
          var rotary240DelMod = ctx.createGain();
          rotary240DelMod.gain.value = 0.003 + intensity * 0.003;
          rotary240Lfo.connect(rotary240DelMod);
          rotary240DelMod.connect(rotary240Del.delayTime);
          rotary240Lfo.start();

          // ── Signal chain: input → reverse → rotary480 → rotary240 → output ──
          inputBoost.connect(reverseNode);
          // Reversed signal splits into two rotary paths that merge
          reverseNode.connect(rotary480Del);
          rotary480Del.connect(rotary480Amp);
          reverseNode.connect(rotary240Del);
          rotary240Del.connect(rotary240Amp);
          // Mix both rotary outputs
          var rotaryMerge = ctx.createGain(); rotaryMerge.gain.value = 0.6;
          rotary480Amp.connect(rotaryMerge);
          rotary240Amp.connect(rotaryMerge);
          rotaryMerge.connect(analyser);
          // Small dry reversed signal for presence
          var revDry = ctx.createGain(); revDry.gain.value = 0.15;
          reverseNode.connect(revDry);
          revDry.connect(analyser);
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
          // Very high feedback for 7-second decay
          // RT60 ~ 7s requires feedback ~ 0.93-0.96 for these delay times
          for (var ri = 0; ri < revDelays.length; ri++) {
            var rd = ctx.createDelay(2.0);
            rd.delayTime.value = revDelays[ri] * (1 + intensity * 0.2);
            var rFb = ctx.createGain();
            rFb.gain.value = 0.93 + intensity * 0.03; // ~7s RT60
            stereoMerge.connect(rd);
            rd.connect(revLp); revLp.connect(rFb); rFb.connect(rd);
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
          var cdMerger = ctx.createGain(); cdMerger.gain.value = 0.4;
          var cdHp = ctx.createBiquadFilter();
          cdHp.type = 'highpass'; cdHp.frequency.value = 3000 + intensity * 4000; // very bright
          cdHp.Q.value = 2 + intensity * 3;
          // Shimmer: pitch-shift via modulated delay on feedback
          var shimDel = ctx.createDelay(0.05);
          shimDel.delayTime.value = 0.01;
          var shimLfo = ctx.createOscillator(); shimLfo.type = 'sawtooth';
          shimLfo.frequency.value = 2 + intensity * 4;
          var shimLfoG = ctx.createGain(); shimLfoG.gain.value = 0.005 + intensity * 0.01;
          shimLfo.connect(shimLfoG); shimLfoG.connect(shimDel.delayTime);
          shimLfo.start();

          for (var ci = 0; ci < cdTimes.length; ci++) {
            var cd = ctx.createDelay(5.0);
            cd.delayTime.value = cdTimes[ci];
            var cFb = ctx.createGain();
            cFb.gain.value = 0.55 + intensity * 0.25 - ci * 0.02;
            inputBoost.connect(cd);
            cd.connect(cdHp);
            cdHp.connect(shimDel); shimDel.connect(cFb); cFb.connect(cd);
            cd.connect(cdMerger);
          }
          var cdDry = ctx.createGain(); cdDry.gain.value = 0.15;
          inputBoost.connect(cdDry); cdDry.connect(analyser);
          cdMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 9: { // AMBIENT WASH — infinite reverb with modulated allpass network
          var awDelays = [0.053, 0.097, 0.139, 0.181, 0.227, 0.293, 0.371, 0.449];
          var awMerger = ctx.createGain(); awMerger.gain.value = 0.3;
          var awLp = ctx.createBiquadFilter();
          awLp.type = 'lowpass'; awLp.frequency.value = 800 + (1 - intensity) * 1500;
          awLp.Q.value = 0.7;
          // Modulate the filter slowly
          var awLfo = ctx.createOscillator(); awLfo.type = 'sine';
          awLfo.frequency.value = 0.015; // ultra slow
          var awLfoG = ctx.createGain(); awLfoG.gain.value = 400 * intensity;
          awLfo.connect(awLfoG); awLfoG.connect(awLp.frequency);
          awLfo.start();

          for (var ai = 0; ai < awDelays.length; ai++) {
            var ad = ctx.createDelay(2.0);
            ad.delayTime.value = awDelays[ai] * (1 + intensity * 0.3);
            var aFb = ctx.createGain();
            aFb.gain.value = 0.78 + intensity * 0.15; // very high feedback = near-infinite
            // Time-varying: slowly increase feedback for "wash" buildup
            aFb.gain.setValueAtTime(0.65, t);
            aFb.gain.linearRampToValueAtTime(0.78 + intensity * 0.15, t + 5);
            inputBoost.connect(ad);
            ad.connect(awLp); awLp.connect(aFb); aFb.connect(ad);
            ad.connect(awMerger);
          }
          var awDry = ctx.createGain(); awDry.gain.value = 0.05; // almost no dry
          inputBoost.connect(awDry); awDry.connect(analyser);
          awMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 10: { // BIT CRUSHER — extreme lo-fi with sample rate reduction and noise
          // Aggressive quantization
          var bcWs = ctx.createWaveShaper();
          var bcSteps = 2 + Math.floor((1 - intensity) * 6); // very few steps = very crushed
          var bcCurve = new Float32Array(512);
          for (var bi = 0; bi < 512; bi++) {
            var bx = (bi / 256) - 1;
            bcCurve[bi] = Math.round(bx * bcSteps) / bcSteps;
          }
          bcWs.curve = bcCurve;
          // Sample rate reduction via very short delay with square LFO
          var srDel = ctx.createDelay(0.01);
          srDel.delayTime.value = 0.001;
          var srLfo = ctx.createOscillator(); srLfo.type = 'sawtooth';
          srLfo.frequency.value = 4000 + (1 - intensity) * 8000; // lower = more crushed
          var srLfoG = ctx.createGain(); srLfoG.gain.value = 0.001;
          srLfo.connect(srLfoG); srLfoG.connect(srDel.delayTime);
          srLfo.start();
          // Aggressive lowpass to simulate aliasing
          var bcLp = ctx.createBiquadFilter();
          bcLp.type = 'lowpass'; bcLp.frequency.value = 1000 + (1 - intensity) * 4000;
          bcLp.Q.value = 3 + intensity * 5;
          // Ring mod for digital artifacts
          var ringOsc = ctx.createOscillator(); ringOsc.type = 'square';
          ringOsc.frequency.value = 100 + intensity * 400;
          var ringGain = ctx.createGain(); ringGain.gain.value = 0.15 * intensity;
          ringOsc.connect(ringGain);
          ringOsc.start();
          // Feedback delay for stacking
          var bcDel = ctx.createDelay(1.0);
          bcDel.delayTime.value = beatSec * 0.5;
          var bcFb = ctx.createGain(); bcFb.gain.value = 0.4 + intensity * 0.3;

          inputBoost.connect(bcWs);
          bcWs.connect(srDel);
          srDel.connect(bcLp);
          ringGain.connect(bcLp.frequency); // modulate filter with ring
          bcLp.connect(bcDel); bcDel.connect(bcFb); bcFb.connect(bcWs); // feedback loop
          bcLp.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 11: { // CHORUS ENSEMBLE — massive 6-voice detuned chorus with deep modulation
          var chVoices = 6;
          var chMerger = ctx.createGain(); chMerger.gain.value = 0.5;
          var chRates = [0.2, 0.35, 0.5, 0.7, 0.9, 1.2];
          var chDepths = [0.012, 0.015, 0.018, 0.02, 0.014, 0.022];
          var chDelays = [0.02, 0.03, 0.04, 0.025, 0.035, 0.045];

          for (var chi = 0; chi < chVoices; chi++) {
            var chd = ctx.createDelay(0.1);
            chd.delayTime.value = chDelays[chi];
            var chLfo = ctx.createOscillator(); chLfo.type = 'sine';
            chLfo.frequency.value = chRates[chi] * (1 + intensity);
            var chLfoG = ctx.createGain();
            chLfoG.gain.value = chDepths[chi] * (1 + intensity * 3); // deep modulation
            chLfo.connect(chLfoG); chLfoG.connect(chd.delayTime);
            chLfo.start();
            // Feedback per voice for richness
            var chFb = ctx.createGain(); chFb.gain.value = 0.3 + intensity * 0.35;
            chd.connect(chFb); chFb.connect(chd);
            inputBoost.connect(chd);
            chd.connect(chMerger);
          }
          // Slight dry signal
          var chDry = ctx.createGain(); chDry.gain.value = 0.2;
          inputBoost.connect(chDry); chDry.connect(analyser);
          chMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 12: { // VOCODER PULSE — aggressive multi-band vocoder with rhythmic amplitude modulation
          var vocBands = [200, 400, 800, 1600, 3200, 6400];
          var vocMerger = ctx.createGain(); vocMerger.gain.value = 0.5;
          for (var vi = 0; vi < vocBands.length; vi++) {
            var vBp = ctx.createBiquadFilter();
            vBp.type = 'bandpass'; vBp.frequency.value = vocBands[vi];
            vBp.Q.value = 8 + intensity * 12; // very narrow bands
            // Each band gets its own rhythmic modulation at different subdivisions
            var vLfo = ctx.createOscillator(); vLfo.type = 'sine';
            vLfo.frequency.value = bpm / 60 * (vi + 1) * 0.5; // different rates per band
            var vGain = ctx.createGain(); vGain.gain.value = 1.0;
            var vLfoG = ctx.createGain(); vLfoG.gain.value = 0.7 + intensity * 0.3;
            vLfo.connect(vLfoG); vLfoG.connect(vGain.gain);
            vLfo.start();
            inputBoost.connect(vBp);
            vBp.connect(vGain);
            vGain.connect(vocMerger);
          }
          // Add delay tail for spaciousness
          var vocDel = ctx.createDelay(2.0);
          vocDel.delayTime.value = beatSec * 0.75;
          var vocFb = ctx.createGain(); vocFb.gain.value = 0.5 + intensity * 0.25;
          vocMerger.connect(vocDel); vocDel.connect(vocFb); vocFb.connect(vocDel);
          vocMerger.connect(analyser);
          vocDel.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 13: { // PRISM SPLIT — spectral decomposition with time-staggered bands and ping-pong
          var prismBands = [200, 500, 900, 1400, 2200, 3500, 5500, 8000];
          var prismMerger = ctx.createGain(); prismMerger.gain.value = 0.4;
          for (var pi = 0; pi < prismBands.length; pi++) {
            var pBp = ctx.createBiquadFilter();
            pBp.type = 'bandpass'; pBp.frequency.value = prismBands[pi];
            pBp.Q.value = 4 + intensity * 6;
            // Each band delayed by increasing amount — creates "prism" spread
            var pDel = ctx.createDelay(2.0);
            pDel.delayTime.value = pi * 0.08 * (1 + intensity);
            // Feedback per band
            var pFb = ctx.createGain(); pFb.gain.value = 0.45 + intensity * 0.3;
            pDel.connect(pFb); pFb.connect(pDel);
            // Pan simulation via gain alternation
            var pGain = ctx.createGain();
            pGain.gain.value = 0.5 + (pi % 2 === 0 ? 0.2 : -0.1);
            inputBoost.connect(pBp);
            pBp.connect(pDel);
            pDel.connect(pGain);
            pGain.connect(prismMerger);
          }
          prismMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 14: { // ORBITAL RESONANCE — deep phaser with ring modulation and space echo
          // Multi-stage allpass phaser
          var phaserStages = 8;
          var phaserInput = inputBoost;
          var phaserLfo = ctx.createOscillator(); phaserLfo.type = 'sine';
          phaserLfo.frequency.value = 0.1 + intensity * 0.4; // slow sweep
          phaserLfo.start();
          var lastNode = inputBoost;
          for (var phi = 0; phi < phaserStages; phi++) {
            var ap = ctx.createBiquadFilter();
            ap.type = 'allpass';
            ap.frequency.value = 200 + phi * 400;
            ap.Q.value = 0.5;
            var apLfoG = ctx.createGain();
            apLfoG.gain.value = 300 + intensity * 600;
            phaserLfo.connect(apLfoG); apLfoG.connect(ap.frequency);
            lastNode.connect(ap);
            lastNode = ap;
          }
          // Ring modulator
          var ringMod = ctx.createOscillator(); ringMod.type = 'sine';
          ringMod.frequency.value = 80 + intensity * 300;
          var ringModG = ctx.createGain(); ringModG.gain.value = 0.3 + intensity * 0.5;
          ringMod.connect(ringModG);
          ringMod.start();
          var ringTarget = ctx.createGain(); ringTarget.gain.value = 1.0;
          ringModG.connect(ringTarget.gain);
          lastNode.connect(ringTarget);
          // Space echo on the result
          var orbDel = ctx.createDelay(3.0);
          orbDel.delayTime.value = beatSec * 1.5;
          var orbFb = ctx.createGain(); orbFb.gain.value = 0.55 + intensity * 0.25;
          var orbLp = ctx.createBiquadFilter();
          orbLp.type = 'lowpass'; orbLp.frequency.value = 3000;
          ringTarget.connect(orbDel);
          orbDel.connect(orbLp); orbLp.connect(orbFb); orbFb.connect(orbDel);
          // Mix
          var orbDry = ctx.createGain(); orbDry.gain.value = 0.15;
          inputBoost.connect(orbDry); orbDry.connect(analyser);
          ringTarget.connect(analyser);
          orbDel.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 15: { // TEMPORAL SHIFT — extreme pitch-shifting delay with reverse-like buildup
          // Multiple delay lines at different musical intervals
          var tsTimes = [beatSec * 0.33, beatSec * 0.66, beatSec, beatSec * 1.5, beatSec * 2.5];
          var tsMerger = ctx.createGain(); tsMerger.gain.value = 0.45;
          // Pitch modulation on all delays
          var tsLfo = ctx.createOscillator(); tsLfo.type = 'triangle';
          tsLfo.frequency.value = 0.05 + intensity * 0.2; // very slow pitch drift
          tsLfo.start();

          for (var ti = 0; ti < tsTimes.length; ti++) {
            var td = ctx.createDelay(5.0);
            td.delayTime.value = tsTimes[ti];
            var tLfoG = ctx.createGain();
            tLfoG.gain.value = 0.02 + intensity * 0.04; // pitch shift amount
            tsLfo.connect(tLfoG); tLfoG.connect(td.delayTime);
            var tFb = ctx.createGain();
            tFb.gain.value = 0.6 + intensity * 0.2 - ti * 0.02;
            // Time-varying feedback: builds up over time like reverse reverb
            tFb.gain.setValueAtTime(0.4, t);
            tFb.gain.linearRampToValueAtTime(0.6 + intensity * 0.2, t + 4);
            tFb.gain.linearRampToValueAtTime(0.7 + intensity * 0.15, t + 8);
            td.connect(tFb); tFb.connect(td);
            inputBoost.connect(td);
            td.connect(tsMerger);
          }
          // Highpass to keep it ethereal
          var tsHp = ctx.createBiquadFilter();
          tsHp.type = 'highpass'; tsHp.frequency.value = 200 + intensity * 400;
          tsMerger.connect(tsHp);
          var tsDry = ctx.createGain(); tsDry.gain.value = 0.1;
          inputBoost.connect(tsDry); tsDry.connect(analyser);
          tsHp.connect(analyser);
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
