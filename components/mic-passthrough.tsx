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
      inputBoost.gain.value = 3.0 + intensity * 4.0; // 3x to 7x input gain boost

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
        case 1: { // SPECTRAL REVERB — massive shimmer hall with 8 delay lines and evolving feedback
          var delays = [];
          var fbs = [];
          var times = [0.037, 0.079, 0.113, 0.167, 0.233, 0.311, 0.419, 0.541];
          var fbVals = [0.72, 0.68, 0.74, 0.65, 0.71, 0.67, 0.69, 0.73];
          var merger = ctx.createGain(); merger.gain.value = 0.35;
          var shimmerHp = ctx.createBiquadFilter();
          shimmerHp.type = 'highpass'; shimmerHp.frequency.value = 1200 + intensity * 3000;
          shimmerHp.Q.value = 1.5;
          var shimmerLfo = ctx.createOscillator(); shimmerLfo.type = 'sine';
          shimmerLfo.frequency.value = 0.05 + intensity * 0.15; // very slow sweep
          var shimmerLfoG = ctx.createGain(); shimmerLfoG.gain.value = 2000 * intensity;
          shimmerLfo.connect(shimmerLfoG); shimmerLfoG.connect(shimmerHp.frequency);
          shimmerLfo.start();

          for (var i = 0; i < 8; i++) {
            var d = ctx.createDelay(2.0);
            d.delayTime.value = times[i] * (1.0 + intensity * 0.5);
            var fb = ctx.createGain();
            fb.gain.value = fbVals[i] * (0.7 + intensity * 0.28);
            // Time-varying feedback: slowly modulate
            fb.gain.setValueAtTime(fb.gain.value, t);
            fb.gain.linearRampToValueAtTime(fb.gain.value * 0.9, t + 4);
            fb.gain.linearRampToValueAtTime(fb.gain.value * 1.05, t + 8);
            fb.gain.linearRampToValueAtTime(fb.gain.value, t + 12);
            inputBoost.connect(d);
            d.connect(fb); fb.connect(d); // feedback loop
            d.connect(shimmerHp);
            delays.push(d); fbs.push(fb);
          }
          shimmerHp.connect(merger);
          // Also add some dry signal
          var dryMix = ctx.createGain(); dryMix.gain.value = 0.15;
          inputBoost.connect(dryMix);
          dryMix.connect(analyser);
          merger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 2: { // GRANULAR STUTTER — aggressive rhythmic chopping with pitch randomization
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
          grainDel.connect(analyser);
          // Also direct stuttered signal
          stutterGain.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 3: { // DARK ECHO — cavernous multi-tap delay with extreme feedback and darkening
          var echoTaps = [beatSec * 0.5, beatSec, beatSec * 1.5, beatSec * 2.0, beatSec * 3.0];
          var echoMerger = ctx.createGain(); echoMerger.gain.value = 0.5;
          var echoLp = ctx.createBiquadFilter();
          echoLp.type = 'lowpass';
          echoLp.frequency.value = 400 + (1 - intensity) * 600; // very dark
          echoLp.Q.value = 2 + intensity * 4;
          // Sweeping filter on feedback
          var echoLfo = ctx.createOscillator(); echoLfo.type = 'triangle';
          echoLfo.frequency.value = 0.03; // very slow sweep
          var echoLfoG = ctx.createGain(); echoLfoG.gain.value = 200 * intensity;
          echoLfo.connect(echoLfoG); echoLfoG.connect(echoLp.frequency);
          echoLfo.start();

          for (var ei = 0; ei < echoTaps.length; ei++) {
            var ed = ctx.createDelay(5.0);
            ed.delayTime.value = echoTaps[ei];
            var efb = ctx.createGain();
            efb.gain.value = 0.6 + intensity * 0.25 - ei * 0.03; // high feedback, decreasing per tap
            inputBoost.connect(ed);
            ed.connect(echoLp);
            echoLp.connect(efb); efb.connect(ed); // feedback through filter (darkens each repeat)
            ed.connect(echoMerger);
          }
          // Dry signal very quiet
          var echoDry = ctx.createGain(); echoDry.gain.value = 0.1;
          inputBoost.connect(echoDry); echoDry.connect(analyser);
          echoMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 4: { // PITCH WARP — extreme detuned chorus with multiple voices and slow drift
          var warpVoices = 4;
          var warpMerger = ctx.createGain(); warpMerger.gain.value = 0.6;
          var warpRates = [0.1, 0.23, 0.37, 0.53]; // different LFO rates for each voice
          var warpDepths = [0.015, 0.02, 0.012, 0.025]; // deep modulation
          var warpDelays = [0.03, 0.045, 0.06, 0.08];

          for (var wi = 0; wi < warpVoices; wi++) {
            var wd = ctx.createDelay(0.2);
            wd.delayTime.value = warpDelays[wi];
            var wLfo = ctx.createOscillator(); wLfo.type = 'sine';
            wLfo.frequency.value = warpRates[wi] + intensity * 0.5;
            var wLfoG = ctx.createGain();
            wLfoG.gain.value = warpDepths[wi] * (1 + intensity * 2);
            wLfo.connect(wLfoG); wLfoG.connect(wd.delayTime);
            wLfo.start();
            // Feedback for each voice
            var wFb = ctx.createGain(); wFb.gain.value = 0.4 + intensity * 0.3;
            wd.connect(wFb); wFb.connect(wd);
            inputBoost.connect(wd);
            wd.connect(warpMerger);
          }
          // Dry signal
          var warpDry = ctx.createGain(); warpDry.gain.value = 0.2;
          inputBoost.connect(warpDry); warpDry.connect(analyser);
          warpMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 5: { // HARMONIC FREEZE — extreme resonant bandpass with very long sustain/infinite hold
          var freezeBands = [400, 800, 1200, 2000, 3200];
          var freezeMerger = ctx.createGain(); freezeMerger.gain.value = 0.5;
          for (var fi = 0; fi < freezeBands.length; fi++) {
            var fbp = ctx.createBiquadFilter();
            fbp.type = 'bandpass';
            fbp.frequency.value = freezeBands[fi] * (0.8 + intensity * 0.4);
            fbp.Q.value = 15 + intensity * 25; // very resonant — near self-oscillation
            var fDel = ctx.createDelay(2.0);
            fDel.delayTime.value = 0.2 + fi * 0.15 + intensity * 0.3;
            var fFb = ctx.createGain();
            fFb.gain.value = 0.75 + intensity * 0.2; // very long sustain
            // Time-varying: feedback slowly increases to create "freeze" effect
            fFb.gain.setValueAtTime(0.6, t);
            fFb.gain.linearRampToValueAtTime(0.75 + intensity * 0.2, t + 3);
            inputBoost.connect(fbp);
            fbp.connect(fDel);
            fDel.connect(fFb); fFb.connect(fDel);
            fDel.connect(freezeMerger);
          }
          var freezeDry = ctx.createGain(); freezeDry.gain.value = 0.1;
          inputBoost.connect(freezeDry); freezeDry.connect(analyser);
          freezeMerger.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 6: { // TAPE SATURATION — heavy multi-stage distortion with cabinet simulation
          // Stage 1: Pre-gain boost
          var preGain = ctx.createGain(); preGain.gain.value = 2.0 + intensity * 6.0;
          // Stage 2: Waveshaper (aggressive curve)
          var satWs1 = ctx.createWaveShaper();
          var curve1 = new Float32Array(512);
          for (var s1 = 0; s1 < 512; s1++) {
            var sx1 = (s1 / 256) - 1;
            curve1[s1] = Math.tanh(sx1 * (2 + intensity * 8));
          }
          satWs1.curve = curve1; satWs1.oversample = '4x';
          // Stage 3: Second waveshaper (tube-style asymmetric)
          var satWs2 = ctx.createWaveShaper();
          var curve2 = new Float32Array(512);
          for (var s2 = 0; s2 < 512; s2++) {
            var sx2 = (s2 / 256) - 1;
            curve2[s2] = sx2 > 0 ? 1 - Math.exp(-sx2 * (3 + intensity * 5)) : -1 + Math.exp(sx2 * (3 + intensity * 5));
          }
          satWs2.curve = curve2; satWs2.oversample = '4x';
          // Cabinet sim: lowpass + resonant peak
          var cabLp = ctx.createBiquadFilter();
          cabLp.type = 'lowpass'; cabLp.frequency.value = 2500 + (1 - intensity) * 3000;
          cabLp.Q.value = 1.5;
          var cabPeak = ctx.createBiquadFilter();
          cabPeak.type = 'peaking'; cabPeak.frequency.value = 800;
          cabPeak.gain.value = 4 + intensity * 6; cabPeak.Q.value = 2;
          // Output level control (distortion is loud)
          var satOut = ctx.createGain(); satOut.gain.value = 0.4;

          inputBoost.connect(preGain);
          preGain.connect(satWs1);
          satWs1.connect(satWs2);
          satWs2.connect(cabLp);
          cabLp.connect(cabPeak);
          cabPeak.connect(satOut);
          satOut.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 7: { // VOID FILTER — extreme resonant sweep with self-oscillation and sub-bass
          var voidLp = ctx.createBiquadFilter();
          voidLp.type = 'lowpass';
          voidLp.frequency.value = 150; // starts very low
          voidLp.Q.value = 18 + intensity * 12; // near self-oscillation
          // Dramatic slow sweep LFO
          var voidLfo = ctx.createOscillator(); voidLfo.type = 'sine';
          voidLfo.frequency.value = 0.02 + intensity * 0.08; // very slow
          var voidLfoG = ctx.createGain();
          voidLfoG.gain.value = 2000 + intensity * 5000; // huge sweep range
          voidLfo.connect(voidLfoG); voidLfoG.connect(voidLp.frequency);
          voidLfo.start();
          // Secondary faster LFO for wobble
          var voidLfo2 = ctx.createOscillator(); voidLfo2.type = 'triangle';
          voidLfo2.frequency.value = bpm / 60 * 0.5;
          var voidLfoG2 = ctx.createGain(); voidLfoG2.gain.value = 500 * intensity;
          voidLfo2.connect(voidLfoG2); voidLfoG2.connect(voidLp.frequency);
          voidLfo2.start();
          // Sub-bass boost
          var subBoost = ctx.createBiquadFilter();
          subBoost.type = 'peaking'; subBoost.frequency.value = 60;
          subBoost.gain.value = 8 + intensity * 6; subBoost.Q.value = 1;
          // Feedback delay for resonance tail
          var voidDel = ctx.createDelay(1.0);
          voidDel.delayTime.value = beatSec * 0.25;
          var voidFb = ctx.createGain(); voidFb.gain.value = 0.4 + intensity * 0.35;
          voidLp.connect(voidDel); voidDel.connect(voidFb); voidFb.connect(voidLp);

          inputBoost.connect(voidLp);
          voidLp.connect(subBoost);
          subBoost.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 8: { // RHYTHMIC GATE — aggressive BPM-synced gate with stacked patterns and sidechain
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

        case 9: { // CRYSTAL DELAY — bright cascading multi-tap with pitch-shifted repeats
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

        case 10: { // AMBIENT WASH — infinite reverb with modulated allpass network
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

        case 11: { // BIT CRUSHER — extreme lo-fi with sample rate reduction and noise
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

        case 12: { // CHORUS ENSEMBLE — massive 6-voice detuned chorus with deep modulation
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

        case 13: { // VOCODER PULSE — aggressive multi-band vocoder with rhythmic amplitude modulation
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

        case 14: { // PRISM SPLIT — spectral decomposition with time-staggered bands and ping-pong
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

        case 15: { // ORBITAL RESONANCE — deep phaser with ring modulation and space echo
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

        case 16: { // TEMPORAL SHIFT — extreme pitch-shifting delay with reverse-like buildup
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
      outputGainRef.current.gain.value = (masterVolume / 100) * (micSensitivity / 50); // sensitivity scaled higher
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
  const vol = (masterVolume / 100) * (micSensitivity / 50); // boosted sensitivity
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
      var level = Math.min(1, rms * 3.0); // boosted level for sensitivity
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
