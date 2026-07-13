import React, { useRef, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";

interface MicPassthroughProps {
  isActive: boolean;
  trackId: number;
  bpm: number;
  effectIntensity: number; // 0-100
  micSensitivity: number; // 0-100 (fixed at 100 = +15dB gain)
  masterVolume: number; // 0-100 — overall output volume (device-controlled)
  musicVolume: number; // 0-100 — music track volume (effects capped at 30% of this)
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
  musicVolume,
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
        musicVolume={musicVolume}
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
      musicVolume={musicVolume}
      dryWetMix={dryWetMix}
      onLevelUpdate={onLevelUpdate}
      onError={onError}
    />
  );
}

// ─── Effect DSP chain builder (Web Audio API JavaScript) ─────────────────────
// All effects use FINITE taps only — NO feedback loops that could cause runaway.
// Input gain is moderate to prevent speaker-to-mic feedback accumulation.
function buildEffectChainJS(): string {
  return `
    // Effect chain builder: creates Web Audio API effect chains with NO FEEDBACK LOOPS
    function buildEffectChain(ctx, source, trackId, bpm, intensity) {
      // MODERATE INPUT GAIN — sensitive but safe from speaker-to-mic feedback
      // +15dB = ~5.6x linear gain (enough to hear light touches without runaway)
      var inputBoost = ctx.createGain();
      inputBoost.gain.value = 5.6;

      var output = ctx.createGain();
      output.gain.value = 1.0;

      // Analyser for level metering
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      // Noise gate at input: reject speaker bleed and ambient noise
      // Only pass signals that are clearly intentional (above -45dB)
      var inputGate = ctx.createDynamicsCompressor();
      inputGate.threshold.value = -45;
      inputGate.knee.value = 3;
      inputGate.ratio.value = 12;
      inputGate.attack.value = 0.002;
      inputGate.release.value = 0.08;

      source.connect(inputGate);
      inputGate.connect(inputBoost);

      var beatSec = 60.0 / bpm;
      var t = ctx.currentTime;

      switch (trackId) {
        case 1: { // PHANTOM STUTTER — Corpse Parade (BPM 116): dual random delays, 16th-note repeat with pitch mod, 4-24 beat half-speed repeat
          // Delay 1: random length 0.25-1s, repeats at 16th-note speed, pitch modulates downward, max 4 repeats
          var randomLen1 = 0.25 + Math.random() * 0.75; // 0.25 to 1 second
          var sixteenthSec = beatSec / 4; // 16th note duration
          var del1a = ctx.createDelay(5.0); del1a.delayTime.value = sixteenthSec;
          var del1b = ctx.createDelay(5.0); del1b.delayTime.value = sixteenthSec * 2;
          var del1c = ctx.createDelay(5.0); del1c.delayTime.value = sixteenthSec * 3;
          var del1d = ctx.createDelay(5.0); del1d.delayTime.value = sixteenthSec * 4;
          var gain1a = ctx.createGain(); gain1a.gain.value = 0.8;
          var gain1b = ctx.createGain(); gain1b.gain.value = 0.6;
          var gain1c = ctx.createGain(); gain1c.gain.value = 0.4;
          var gain1d = ctx.createGain(); gain1d.gain.value = 0.25;
          // Pitch-lowering modulator on delay 1 (sawtooth = descending)
          var pitchMod1 = ctx.createOscillator(); pitchMod1.type = 'sawtooth';
          pitchMod1.frequency.value = 0.2; // slow descent
          var pitchDepth1 = ctx.createGain(); pitchDepth1.gain.value = 0.005 + intensity * 0.01;
          pitchMod1.connect(pitchDepth1);
          pitchDepth1.connect(del1a.delayTime);
          pitchDepth1.connect(del1b.delayTime);
          pitchDepth1.connect(del1c.delayTime);
          pitchDepth1.connect(del1d.delayTime);
          pitchMod1.start();

          // Delay 2: random time 4-24 beats away, plays back at half speed (via pitch shift down)
          var randomBeats2 = 4 + Math.floor(Math.random() * 21); // 4 to 24 beats
          var del2 = ctx.createDelay(15.0); del2.delayTime.value = beatSec * randomBeats2;
          var gain2 = ctx.createGain(); gain2.gain.value = 0.5;
          // Half-speed via slow modulation of delay time (creates pitch-down effect)
          var pitchMod2 = ctx.createOscillator(); pitchMod2.type = 'sawtooth';
          pitchMod2.frequency.value = 0.08; // very slow for half-speed feel
          var pitchDepth2 = ctx.createGain(); pitchDepth2.gain.value = 0.015 + intensity * 0.02;
          pitchMod2.connect(pitchDepth2); pitchDepth2.connect(del2.delayTime);
          pitchMod2.start();

          // Signal chain
          inputBoost.connect(del1a); del1a.connect(gain1a);
          inputBoost.connect(del1b); del1b.connect(gain1b);
          inputBoost.connect(del1c); del1c.connect(gain1c);
          inputBoost.connect(del1d); del1d.connect(gain1d);
          inputBoost.connect(del2); del2.connect(gain2);

          // Mix all to output
          var dry1 = ctx.createGain(); dry1.gain.value = 0.4;
          inputBoost.connect(dry1); dry1.connect(analyser);
          gain1a.connect(analyser); gain1b.connect(analyser);
          gain1c.connect(analyser); gain1d.connect(analyser);
          gain2.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 2: { // INSOMNIA FILTER — Sleep Deprivation (BPM 76): HP filter 1000Hz, 2x rate delay, large room reverb
          // High-pass filter: completely silence everything below 1000Hz
          var hp2 = ctx.createBiquadFilter();
          hp2.type = 'highpass'; hp2.frequency.value = 1000;
          hp2.Q.value = 1.0; // steep cutoff

          // Delay at twice the rate of music (half a beat) — NO FEEDBACK, finite taps only
          var halfBeat2 = beatSec / 2; // 2x rate = half beat duration
          var del2a = ctx.createDelay(5.0); del2a.delayTime.value = halfBeat2;
          var del2Gain = ctx.createGain(); del2Gain.gain.value = 0.5;
          // Second tap at 2x the delay (decaying)
          var del2b = ctx.createDelay(5.0); del2b.delayTime.value = halfBeat2 * 2;
          var del2bGain = ctx.createGain(); del2bGain.gain.value = 0.25;

          // Large room reverb (multi-tap delays, NO FEEDBACK — just parallel taps for density)
          var revMerge2 = ctx.createGain(); revMerge2.gain.value = 0.35;
          var revTimes2 = [0.043, 0.089, 0.137, 0.191, 0.253, 0.317, 0.389];
          for (var ri2 = 0; ri2 < revTimes2.length; ri2++) {
            var rvd2 = ctx.createDelay(3.0);
            rvd2.delayTime.value = revTimes2[ri2] * (2.0 + intensity * 1.0);
            var rvlp2 = ctx.createBiquadFilter();
            rvlp2.type = 'lowpass'; rvlp2.frequency.value = 4000 - ri2 * 300;
            var rvGain2 = ctx.createGain(); rvGain2.gain.value = 0.4 - ri2 * 0.04; // decaying taps
            del2a.connect(rvd2);
            rvd2.connect(rvlp2); rvlp2.connect(rvGain2); rvGain2.connect(revMerge2);
          }

          // Signal chain: input -> HP filter -> delays (finite taps) + reverb -> output
          inputBoost.connect(hp2);
          hp2.connect(del2a); del2a.connect(del2Gain);
          hp2.connect(del2b); del2b.connect(del2bGain);
          var dry2g = ctx.createGain(); dry2g.gain.value = 0.4;
          hp2.connect(dry2g); dry2g.connect(analyser);
          del2Gain.connect(analyser);
          del2bGain.connect(analyser);
          revMerge2.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 3: { // CB RADIO — Mutation and Madness (BPM 120): 0.5s random sampling, CB radio distortion, 2x rate delay
          // CB Radio distortion: bandpass filter (300-3000Hz) + waveshaper for harsh clipping
          var cbBp = ctx.createBiquadFilter();
          cbBp.type = 'bandpass'; cbBp.frequency.value = 1500; cbBp.Q.value = 1.5;
          // Waveshaper for harsh CB-style distortion
          var cbWs = ctx.createWaveShaper();
          var cbCurve = new Float32Array(256);
          for (var cbi = 0; cbi < 256; cbi++) {
            var cbx = (cbi / 128) - 1;
            cbCurve[cbi] = Math.tanh(cbx * (3 + intensity * 5)) * 0.8; // harsh clipping
          }
          cbWs.curve = cbCurve; cbWs.oversample = '2x';
          // Additional narrow bandpass to simulate radio speaker
          var cbBp2 = ctx.createBiquadFilter();
          cbBp2.type = 'bandpass'; cbBp2.frequency.value = 2000; cbBp2.Q.value = 3;

          // Random sampling gate at 0.5s intervals (2Hz square wave gate)
          var sampleGate3 = ctx.createGain(); sampleGate3.gain.value = 1.0;
          var sampleLfo3 = ctx.createOscillator(); sampleLfo3.type = 'square';
          sampleLfo3.frequency.value = 2.0; // every 0.5 seconds
          var sampleDepth3 = ctx.createGain(); sampleDepth3.gain.value = 0.9;
          sampleLfo3.connect(sampleDepth3); sampleDepth3.connect(sampleGate3.gain);
          sampleLfo3.start();

          // Delay at 2x rate of music (half beat) — NO FEEDBACK, single tap
          var halfBeat3 = beatSec / 2;
          var del3 = ctx.createDelay(5.0); del3.delayTime.value = halfBeat3;
          var del3Gain = ctx.createGain(); del3Gain.gain.value = 0.5;

          // Signal chain: input -> gate -> bandpass -> distortion -> bandpass2 -> delay -> output
          inputBoost.connect(sampleGate3);
          sampleGate3.connect(cbBp);
          cbBp.connect(cbWs);
          cbWs.connect(cbBp2);
          cbBp2.connect(del3); del3.connect(del3Gain);
          // Mix: distorted + delayed
          var dry3g = ctx.createGain(); dry3g.gain.value = 0.5;
          cbBp2.connect(dry3g); dry3g.connect(analyser);
          del3Gain.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 4: { // REVERSE ECHO — Krampus Wishes (BPM 120): 8-beat delay, reversed half-speed playback, very large reverb
          // 8-beat delay
          var eightBeats4 = beatSec * 8;
          var del4 = ctx.createDelay(15.0); del4.delayTime.value = eightBeats4;
          var del4Gain = ctx.createGain(); del4Gain.gain.value = 0.7;

          // Reverse + half-speed via ScriptProcessor
          var bufSize4 = 8192;
          var reverseNode4 = ctx.createScriptProcessor(bufSize4, 1, 1);
          var revBuf4 = new Float32Array(bufSize4 * 2);
          var revWriteIdx4 = 0;
          var revPlayBuf4 = new Float32Array(bufSize4 * 2);
          reverseNode4.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            for (var wi = 0; wi < bufSize4; wi++) {
              revBuf4[revWriteIdx4] = inp[wi];
              revWriteIdx4++;
              if (revWriteIdx4 >= bufSize4 * 2) {
                for (var ci = 0; ci < bufSize4 * 2; ci++) revPlayBuf4[ci] = revBuf4[ci];
                revWriteIdx4 = 0;
              }
            }
            // Read in reverse at half speed
            for (var ro = 0; ro < bufSize4; ro++) {
              var readPos = (bufSize4 * 2 - 1) - Math.floor(ro * 0.5);
              out[ro] = (readPos >= 0 && readPos < bufSize4 * 2) ? revPlayBuf4[readPos] * 0.7 : 0;
            }
          };

          // Very large reverb — NO FEEDBACK, parallel decaying taps for density
          var revMerge4 = ctx.createGain(); revMerge4.gain.value = 0.4;
          var revTimes4 = [0.071, 0.113, 0.167, 0.223, 0.293, 0.367, 0.449, 0.541];
          for (var ri4 = 0; ri4 < revTimes4.length; ri4++) {
            var rvd4 = ctx.createDelay(4.0);
            rvd4.delayTime.value = revTimes4[ri4] * (2.5 + intensity * 1.5);
            var rvlp4 = ctx.createBiquadFilter();
            rvlp4.type = 'lowpass'; rvlp4.frequency.value = 3000 - ri4 * 200;
            var rvGain4 = ctx.createGain(); rvGain4.gain.value = 0.4 - ri4 * 0.04;
            reverseNode4.connect(rvd4);
            rvd4.connect(rvlp4); rvlp4.connect(rvGain4); rvGain4.connect(revMerge4);
          }

          // Signal chain: input -> 8-beat delay -> reverse/half-speed -> reverb -> output
          inputBoost.connect(del4); del4.connect(del4Gain);
          del4Gain.connect(reverseNode4);
          var dry4g = ctx.createGain(); dry4g.gain.value = 0.2;
          reverseNode4.connect(dry4g); dry4g.connect(analyser);
          revMerge4.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 5: { // ROTARY SPEAKER — Investigation Station (BPM 80): Hammond-style rotary modulator at 2x BPM
          // Rotary speed = 2x BPM = 160 BPM = 2.667 Hz
          var rotaryHz5 = (bpm * 2) / 60; // 2x BPM in Hz

          // Amplitude modulation (Leslie speaker tremolo)
          var rotaryAmp5 = ctx.createGain(); rotaryAmp5.gain.value = 1.0;
          var rotaryAmpLfo5 = ctx.createOscillator(); rotaryAmpLfo5.type = 'sine';
          rotaryAmpLfo5.frequency.value = rotaryHz5;
          var rotaryAmpDepth5 = ctx.createGain();
          rotaryAmpDepth5.gain.value = 0.4 + intensity * 0.3; // deep tremolo
          rotaryAmpLfo5.connect(rotaryAmpDepth5);
          rotaryAmpDepth5.connect(rotaryAmp5.gain);
          rotaryAmpLfo5.start();

          // Frequency modulation (Doppler pitch shift via delay modulation)
          var rotaryDel5 = ctx.createDelay(0.05);
          rotaryDel5.delayTime.value = 0.004; // base delay
          var rotaryDelLfo5 = ctx.createOscillator(); rotaryDelLfo5.type = 'sine';
          rotaryDelLfo5.frequency.value = rotaryHz5;
          var rotaryDelDepth5 = ctx.createGain();
          rotaryDelDepth5.gain.value = 0.003 + intensity * 0.003; // pitch wobble depth
          rotaryDelLfo5.connect(rotaryDelDepth5);
          rotaryDelDepth5.connect(rotaryDel5.delayTime);
          rotaryDelLfo5.start();

          // Second rotary at slightly different speed for horn/drum simulation
          var rotaryHz5b = rotaryHz5 * 1.1; // slightly detuned for realism
          var rotaryDel5b = ctx.createDelay(0.05);
          rotaryDel5b.delayTime.value = 0.006;
          var rotaryDelLfo5b = ctx.createOscillator(); rotaryDelLfo5b.type = 'sine';
          rotaryDelLfo5b.frequency.value = rotaryHz5b;
          var rotaryDelDepth5b = ctx.createGain();
          rotaryDelDepth5b.gain.value = 0.004 + intensity * 0.004;
          rotaryDelLfo5b.connect(rotaryDelDepth5b);
          rotaryDelDepth5b.connect(rotaryDel5b.delayTime);
          rotaryDelLfo5b.start();

          // Crossover: low frequencies to one rotor, highs to another
          var loPass5 = ctx.createBiquadFilter();
          loPass5.type = 'lowpass'; loPass5.frequency.value = 800;
          var hiPass5 = ctx.createBiquadFilter();
          hiPass5.type = 'highpass'; hiPass5.frequency.value = 800;

          // Signal chain: input -> crossover -> two rotary modulators -> merge
          inputBoost.connect(loPass5);
          inputBoost.connect(hiPass5);
          loPass5.connect(rotaryDel5); rotaryDel5.connect(rotaryAmp5);
          hiPass5.connect(rotaryDel5b);
          var rotaryMerge5 = ctx.createGain(); rotaryMerge5.gain.value = 0.7;
          rotaryAmp5.connect(rotaryMerge5);
          rotaryDel5b.connect(rotaryMerge5);
          rotaryMerge5.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 6: { // DARK DELAY — Expiation (BPM 90): 20dB gate, beat-synced delay, treble cut >5kHz, 2/3 rate playback
          // 20dB noise gate
          var gate6 = ctx.createDynamicsCompressor();
          gate6.threshold.value = -40; // 20dB above -60dB noise floor
          gate6.knee.value = 1;
          gate6.ratio.value = 20;
          gate6.attack.value = 0.001;
          gate6.release.value = 0.03;

          // Treble cut: remove everything above 5kHz
          var lp6 = ctx.createBiquadFilter();
          lp6.type = 'lowpass'; lp6.frequency.value = 5000;
          lp6.Q.value = 0.7;

          // Beat-synced delay (one beat) — NO FEEDBACK, finite taps
          var del6 = ctx.createDelay(5.0); del6.delayTime.value = beatSec;
          var del6Gain = ctx.createGain(); del6Gain.gain.value = 0.5;
          // Second tap at 2 beats (decaying)
          var del6b = ctx.createDelay(5.0); del6b.delayTime.value = beatSec * 2;
          var del6bGain = ctx.createGain(); del6bGain.gain.value = 0.25;

          // 2/3 rate playback via pitch-shifting modulation (slows perceived playback)
          var slowLfo6 = ctx.createOscillator(); slowLfo6.type = 'sawtooth';
          slowLfo6.frequency.value = 0.12; // slow modulation for pitch-down feel
          var slowDepth6 = ctx.createGain(); slowDepth6.gain.value = 0.012 + intensity * 0.015;
          slowLfo6.connect(slowDepth6); slowDepth6.connect(del6.delayTime);
          slowLfo6.start();

          // Signal chain: input -> gate -> LP filter -> delays (finite taps, with slow mod) -> output
          inputBoost.connect(gate6);
          gate6.connect(lp6);
          lp6.connect(del6); del6.connect(del6Gain);
          lp6.connect(del6b); del6b.connect(del6bGain);
          var dry6g = ctx.createGain(); dry6g.gain.value = 0.4;
          lp6.connect(dry6g); dry6g.connect(analyser);
          del6Gain.connect(analyser);
          del6bGain.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 7: { // CATHEDRAL — Recessional: long church reverb, 10dB noise gate, half-rate delay, max 3 echoes
          // Noise gate: only pass signals >10dB above floor
          // Implemented as a gain node that the ScriptProcessor/worklet would control
          // For Web Audio: use compressor as gate (fast attack, high ratio below threshold)
          var gate7 = ctx.createDynamicsCompressor();
          gate7.threshold.value = -50; // signals below -50dB are gated (approx 10dB above typical noise floor at -60dB)
          gate7.knee.value = 1;
          gate7.ratio.value = 20; // heavy compression below threshold = gate
          gate7.attack.value = 0.001;
          gate7.release.value = 0.05;

          // Long church reverb — NO FEEDBACK, parallel decaying taps for cathedral density
          var reverbMerge7 = ctx.createGain(); reverbMerge7.gain.value = 0.5;
          var reverbTimes7 = [0.023, 0.047, 0.083, 0.127, 0.179, 0.241, 0.317, 0.401, 0.503, 0.617, 0.743, 0.881];
          inputBoost.connect(gate7);
          for (var ri = 0; ri < reverbTimes7.length; ri++) {
            var rvDel7 = ctx.createDelay(5.0);
            rvDel7.delayTime.value = reverbTimes7[ri] * (3.0 + intensity * 1.5);
            var rvLp7 = ctx.createBiquadFilter();
            rvLp7.type = 'lowpass'; rvLp7.frequency.value = 2500 - ri * 100; // darker with each reflection
            var rvGain7 = ctx.createGain(); rvGain7.gain.value = 0.45 - ri * 0.03; // natural decay
            gate7.connect(rvDel7);
            rvDel7.connect(rvLp7); rvLp7.connect(rvGain7); rvGain7.connect(reverbMerge7);
          }

          // Half-rate delay (half the tempo = 2 beats per echo), max 3 echoes
          var halfRate7 = beatSec * 2; // half the rate of music
          var del7a = ctx.createDelay(5.0); del7a.delayTime.value = halfRate7;
          var del7b = ctx.createDelay(5.0); del7b.delayTime.value = halfRate7 * 2;
          var del7c = ctx.createDelay(5.0); del7c.delayTime.value = halfRate7 * 3;
          var delGain7a = ctx.createGain(); delGain7a.gain.value = 0.6;
          var delGain7b = ctx.createGain(); delGain7b.gain.value = 0.35;
          var delGain7c = ctx.createGain(); delGain7c.gain.value = 0.15;

          gate7.connect(del7a); del7a.connect(delGain7a); delGain7a.connect(analyser);
          gate7.connect(del7b); del7b.connect(delGain7b); delGain7b.connect(analyser);
          gate7.connect(del7c); del7c.connect(delGain7c); delGain7c.connect(analyser);

          // Dry (gated) signal + reverb
          var dry7 = ctx.createGain(); dry7.gain.value = 0.7;
          gate7.connect(dry7); dry7.connect(analyser);
          reverbMerge7.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 8: { // GATED STUTTER — Road Show: quarter-note gated 0.25s samples, 12-beat repeat, pitch-lowering modulator
          // BPM 140, beatSec = 60/140 ≈ 0.4286s
          // Quarter note gate: chop mic into 0.25s samples at quarter-note intervals
          var gateFreq8 = bpm / 60; // quarter notes per second
          var gateOsc8 = ctx.createOscillator(); gateOsc8.type = 'square';
          gateOsc8.frequency.value = gateFreq8;
          var gateGain8 = ctx.createGain(); gateGain8.gain.value = 0;
          gateOsc8.connect(gateGain8.gain);
          gateOsc8.start();

          // Primary delay: plays back at quarter-note rate
          var primaryDel8 = ctx.createDelay(5.0);
          primaryDel8.delayTime.value = beatSec; // one beat delay
          var primaryGain8 = ctx.createGain(); primaryGain8.gain.value = 0.7;

          // 12-beat repeat delay
          var repeatDel8 = ctx.createDelay(10.0);
          repeatDel8.delayTime.value = beatSec * 12; // repeat after 12 beats
          var repeatGain8 = ctx.createGain(); repeatGain8.gain.value = 0.5;

          // Pitch-lowering modulator on primary delay (slow downward LFO on delay time)
          var pitchLfo8 = ctx.createOscillator(); pitchLfo8.type = 'sawtooth';
          pitchLfo8.frequency.value = 0.15; // slow descent
          var pitchDepth8 = ctx.createGain(); pitchDepth8.gain.value = 0.008 + intensity * 0.012; // subtle pitch drop
          pitchLfo8.connect(pitchDepth8); pitchDepth8.connect(primaryDel8.delayTime);
          pitchLfo8.start();

          // Pitch-lowering modulator on repeat delay
          var pitchLfo8b = ctx.createOscillator(); pitchLfo8b.type = 'sawtooth';
          pitchLfo8b.frequency.value = 0.08; // even slower for the repeat
          var pitchDepth8b = ctx.createGain(); pitchDepth8b.gain.value = 0.012 + intensity * 0.018;
          pitchLfo8b.connect(pitchDepth8b); pitchDepth8b.connect(repeatDel8.delayTime);
          pitchLfo8b.start();

          // Signal chain: input -> gate -> primary delay -> repeat delay
          inputBoost.connect(gateGain8);
          gateGain8.connect(primaryDel8);
          primaryDel8.connect(primaryGain8);
          primaryGain8.connect(repeatDel8);
          repeatDel8.connect(repeatGain8);

          // Mix: dry gated + primary delay + 12-beat repeat
          gateGain8.connect(analyser);
          primaryGain8.connect(analyser);
          repeatGain8.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 9: { // PING PONG PHASER — Excitement and Elimination: ping-pong delay, 20dB gate, 2x speed, random phaser, max 2 delays
          // BPM 152, beatSec = 60/152 ≈ 0.395s
          // 20dB noise gate: only process sounds significantly above background
          var gate9 = ctx.createDynamicsCompressor();
          gate9.threshold.value = -40; // 20dB above typical -60dB noise floor
          gate9.knee.value = 1;
          gate9.ratio.value = 20;
          gate9.attack.value = 0.001;
          gate9.release.value = 0.03;

          // Ping-pong delay at music rate, played back at 2x speed (half the delay time)
          var halfBeat9 = beatSec / 2; // 2x speed = half the beat duration

          // Left delay (first echo)
          var delL9 = ctx.createDelay(5.0);
          delL9.delayTime.value = halfBeat9;
          var gainL9 = ctx.createGain(); gainL9.gain.value = 0.7;

          // Right delay (second echo, panned opposite)
          var delR9 = ctx.createDelay(5.0);
          delR9.delayTime.value = halfBeat9 * 2; // second ping
          var gainR9 = ctx.createGain(); gainR9.gain.value = 0.45;

          // Random phaser via allpass filters with LFO modulation
          // Phaser varies tone randomly on each successive hit
          var allpass9a = ctx.createBiquadFilter();
          allpass9a.type = 'allpass'; allpass9a.frequency.value = 1000;
          allpass9a.Q.value = 5;
          var allpass9b = ctx.createBiquadFilter();
          allpass9b.type = 'allpass'; allpass9b.frequency.value = 2500;
          allpass9b.Q.value = 5;
          var allpass9c = ctx.createBiquadFilter();
          allpass9c.type = 'allpass'; allpass9c.frequency.value = 4000;
          allpass9c.Q.value = 3;

          // Random-ish LFO for phaser sweep (uses non-harmonic frequency for pseudo-random feel)
          var phaserLfo9 = ctx.createOscillator(); phaserLfo9.type = 'sine';
          phaserLfo9.frequency.value = 0.7 + intensity * 2.3; // varies 0.7-3 Hz for randomness
          var phaserDepth9 = ctx.createGain(); phaserDepth9.gain.value = 2000 + intensity * 3000;
          phaserLfo9.connect(phaserDepth9);
          phaserDepth9.connect(allpass9a.frequency);
          phaserDepth9.connect(allpass9b.frequency);
          phaserDepth9.connect(allpass9c.frequency);
          phaserLfo9.start();

          // Second LFO at irrational ratio for more random variation
          var phaserLfo9b = ctx.createOscillator(); phaserLfo9b.type = 'triangle';
          phaserLfo9b.frequency.value = 1.37; // irrational ratio to first LFO
          var phaserDepth9b = ctx.createGain(); phaserDepth9b.gain.value = 1500;
          phaserLfo9b.connect(phaserDepth9b);
          phaserDepth9b.connect(allpass9a.frequency);
          phaserLfo9b.start();

          // Signal chain: input -> gate -> delay L -> phaser -> delay R
          inputBoost.connect(gate9);
          gate9.connect(delL9);
          delL9.connect(gainL9);
          gainL9.connect(allpass9a); allpass9a.connect(allpass9b); allpass9b.connect(allpass9c);
          allpass9c.connect(delR9);
          delR9.connect(gainR9);

          // Mix: dry gated + 2 delay taps (no feedback = max 2 delays)
          var dry9 = ctx.createGain(); dry9.gain.value = 0.5;
          gate9.connect(dry9); dry9.connect(analyser);
          gainL9.connect(analyser);
          gainR9.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 10: { // SHIFTING CHORUS — Piano Fandango (BPM 106): simple chorus with random rate change every 16 measures
          // 16 measures at 106 BPM in 4/4 = 16 * 4 * (60/106) = ~36.2 seconds
          var measuresSec10 = 16 * 4 * beatSec; // ~36.2s per rate change

          // Chorus: 3 modulated delay voices
          var chorusMerge10 = ctx.createGain(); chorusMerge10.gain.value = 0.6;
          var chorusVoices10 = 3;
          var chorusBaseDelays10 = [0.015, 0.025, 0.035];
          for (var cv10 = 0; cv10 < chorusVoices10; cv10++) {
            var chDel10 = ctx.createDelay(0.1);
            chDel10.delayTime.value = chorusBaseDelays10[cv10];
            // LFO with random initial rate (will be modulated by ScriptProcessor)
            var chLfo10 = ctx.createOscillator(); chLfo10.type = 'sine';
            var initRate10 = 0.3 + Math.random() * 2.5; // random 0.3-2.8 Hz
            chLfo10.frequency.value = initRate10;
            var chDepth10 = ctx.createGain();
            chDepth10.gain.value = 0.004 + intensity * 0.008; // modulation depth
            chLfo10.connect(chDepth10); chDepth10.connect(chDel10.delayTime);
            chLfo10.start();
            // Schedule random rate changes every 16 measures
            for (var sched10 = 1; sched10 <= 10; sched10++) {
              var newRate10 = 0.3 + Math.random() * 2.5;
              chLfo10.frequency.setValueAtTime(newRate10, t + measuresSec10 * sched10);
            }
            // NO FEEDBACK — chorus voices are single-pass only
            inputBoost.connect(chDel10);
            chDel10.connect(chorusMerge10);
          }

          // Mix: dry + chorus
          var dry10 = ctx.createGain(); dry10.gain.value = 0.5;
          inputBoost.connect(dry10); dry10.connect(analyser);
          chorusMerge10.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 11: { // TIME STRETCH — Much Ado (BPM 120): 3x time-stretch, hall reverb, 20dB gate delay
          // 3x time-stretch via ScriptProcessor (reads 1 sample for every 3 output samples)
          var bufSize11 = 4096;
          var stretchNode11 = ctx.createScriptProcessor(bufSize11, 1, 1);
          var stretchBuf11 = new Float32Array(bufSize11 * 3);
          var stretchWriteIdx11 = 0;
          var stretchPlayBuf11 = new Float32Array(bufSize11 * 3);
          stretchNode11.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            // Write input to buffer
            for (var wi = 0; wi < bufSize11; wi++) {
              stretchBuf11[stretchWriteIdx11] = inp[wi];
              stretchWriteIdx11++;
              if (stretchWriteIdx11 >= bufSize11 * 3) {
                for (var ci = 0; ci < bufSize11 * 3; ci++) stretchPlayBuf11[ci] = stretchBuf11[ci];
                stretchWriteIdx11 = 0;
              }
            }
            // Read at 1/3 speed (3x stretch)
            for (var ro = 0; ro < bufSize11; ro++) {
              var readPos = Math.floor(ro / 3);
              out[ro] = (readPos < bufSize11 * 3) ? stretchPlayBuf11[readPos] * 0.7 : 0;
            }
          };

          // Large hall reverb — NO FEEDBACK, parallel decaying taps
          var revMerge11 = ctx.createGain(); revMerge11.gain.value = 0.4;
          var revTimes11 = [0.053, 0.097, 0.149, 0.211, 0.277, 0.353, 0.431];
          for (var ri11 = 0; ri11 < revTimes11.length; ri11++) {
            var rvd11 = ctx.createDelay(4.0);
            rvd11.delayTime.value = revTimes11[ri11] * (2.0 + intensity * 1.5);
            var rvlp11 = ctx.createBiquadFilter();
            rvlp11.type = 'lowpass'; rvlp11.frequency.value = 4000 - ri11 * 300;
            var rvGain11 = ctx.createGain(); rvGain11.gain.value = 0.4 - ri11 * 0.04;
            stretchNode11.connect(rvd11);
            rvd11.connect(rvlp11); rvlp11.connect(rvGain11); rvGain11.connect(revMerge11);
          }

          // 20dB noise gate + beat-synced delay — NO FEEDBACK, single tap
          var gate11 = ctx.createDynamicsCompressor();
          gate11.threshold.value = -40; // 20dB above -60dB noise floor
          gate11.knee.value = 1; gate11.ratio.value = 20;
          gate11.attack.value = 0.001; gate11.release.value = 0.03;
          var del11 = ctx.createDelay(5.0); del11.delayTime.value = beatSec;
          var del11Gain = ctx.createGain(); del11Gain.gain.value = 0.4;

          // Signal chain: input -> stretch -> reverb; input -> gate -> delay (no feedback)
          inputBoost.connect(stretchNode11);
          inputBoost.connect(gate11);
          gate11.connect(del11); del11.connect(del11Gain);
          var dry11 = ctx.createGain(); dry11.gain.value = 0.3;
          stretchNode11.connect(dry11); dry11.connect(analyser);
          revMerge11.connect(analyser);
          del11Gain.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 12: { // CHIPMUNK — Brothers (BPM 84): 1-second delay, sped-up chipmunk playback
          // 1-second delay
          var del12 = ctx.createDelay(5.0); del12.delayTime.value = 1.0;
          var del12Gain = ctx.createGain(); del12Gain.gain.value = 0.7;

          // Chipmunk speed-up via ScriptProcessor (reads 2 samples per 1 output = 2x speed)
          var bufSize12 = 4096;
          var chipmunkNode12 = ctx.createScriptProcessor(bufSize12, 1, 1);
          var chipmunkBuf12 = new Float32Array(bufSize12 * 2);
          var chipmunkWriteIdx12 = 0;
          var chipmunkPlayBuf12 = new Float32Array(bufSize12 * 2);
          chipmunkNode12.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            // Write input
            for (var wi = 0; wi < bufSize12; wi++) {
              chipmunkBuf12[chipmunkWriteIdx12] = inp[wi];
              chipmunkWriteIdx12++;
              if (chipmunkWriteIdx12 >= bufSize12 * 2) {
                for (var ci = 0; ci < bufSize12 * 2; ci++) chipmunkPlayBuf12[ci] = chipmunkBuf12[ci];
                chipmunkWriteIdx12 = 0;
              }
            }
            // Read at 2x speed (chipmunk effect)
            for (var ro = 0; ro < bufSize12; ro++) {
              var readPos = Math.floor(ro * 2);
              out[ro] = (readPos < bufSize12 * 2) ? chipmunkPlayBuf12[readPos] * 0.8 : 0;
            }
          };

          // Signal chain: input -> 1s delay -> chipmunk speed-up -> output
          inputBoost.connect(del12); del12.connect(del12Gain);
          del12Gain.connect(chipmunkNode12);
          var dry12 = ctx.createGain(); dry12.gain.value = 0.3;
          inputBoost.connect(dry12); dry12.connect(analyser);
          chipmunkNode12.connect(analyser);
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

      // ─── Dynamics Compressor ───────────────────────────────────────────
      // Tames transient spikes from the high mic gain (+15dB input boost)
      // Ratio 12:1 with fast attack catches percussive hits immediately
      var compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;  // start compressing at -24dB
      compressor.knee.value = 6;         // soft knee for natural response
      compressor.ratio.value = 12;       // aggressive ratio for transients
      compressor.attack.value = 0.003;   // 3ms attack — catches fast transients
      compressor.release.value = 0.15;   // 150ms release — smooth recovery

      // ─── Hard Limiter (brick-wall) ─────────────────────────────────────
      // Second stage: prevents ANY signal from exceeding -3dB (safe ceiling)
      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;      // brick-wall ceiling at -3dB
      limiter.knee.value = 0;            // hard knee = true limiter behavior
      limiter.ratio.value = 20;          // near-infinite ratio
      limiter.attack.value = 0.001;      // 1ms — instant catch
      limiter.release.value = 0.05;      // 50ms fast release

      // Analyser for combined level metering
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      // Moderate gain for dry path (matches the effect chain's 5.6x input boost)
      var dryBoost = ctx.createGain();
      dryBoost.gain.value = 5.6; // same as effect chain inputBoost

      // Dry path: source -> dryBoost -> dryGain -> merger
      source.connect(dryBoost);
      dryBoost.connect(dryGain);
      dryGain.connect(merger);

      // Wet path: source -> effectChain -> wetGain -> merger
      var effectChain = buildEffectChain(ctx, source, trackId, bpm, intensity);
      effectChain.output.connect(wetGain);
      wetGain.connect(merger);

      // Signal chain: merger -> compressor -> limiter -> analyser
      merger.connect(compressor);
      compressor.connect(limiter);
      limiter.connect(analyser);

      return {
        analyser: analyser,
        output: analyser, // output from analyser (post-compressor/limiter)
        dryGain: dryGain,
        wetGain: wetGain,
        compressor: compressor,
        limiter: limiter,
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
  musicVolume,
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

  // Update output volume — effects capped at 30% of music volume, never exceeds safe levels
  useEffect(() => {
    if (outputGainRef.current) {
      // Effects output = 30% of music volume (which is 90% of device volume)
      // This ensures effected mic never overwhelms the music
      const effectsCeiling = (musicVolume / 100) * 0.30;
      outputGainRef.current.gain.value = effectsCeiling;
    }
  }, [musicVolume]);

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
      // Effects output = 30% of music volume — safe hearing level
      const effectsCeiling = (musicVolume / 100) * 0.30;
      // Start at 0 and ramp up over 4 seconds for smooth transition
      outputGain.gain.value = 0;
      outputGain.gain.linearRampToValueAtTime(effectsCeiling, ctx.currentTime + 4.0);
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
  musicVolume,
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
  // Effects output = 30% of music volume — safe hearing level, never overwhelms music
  const vol = (musicVolume / 100) * 0.30;
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
    // Start at 0 and ramp up over 4 seconds for smooth transition
    outputGain.gain.value = 0;
    outputGain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 4.0);

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
