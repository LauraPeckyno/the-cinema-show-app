import React, { useRef, useEffect, useCallback, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";

interface MicPassthroughProps {
  isActive: boolean;
  trackId: number;
  bpm: number;
  effectIntensity: number; // 0-100
  effectVolumeMultiplier?: number; // 0.5–1.5 global wet-effect level
  micSensitivity: number; // 0-100 (fixed at 100 = +15dB gain)
  masterVolume: number; // 0-100 — overall output volume (device-controlled)
  musicVolume: number; // 0-100 — music track volume (effects capped at 30% of this)
  dryWetMix: number; // 0-100 — 0=fully dry (raw ambient), 100=fully wet (effected)
  shouldFadeOut?: boolean; // fades all mic output over the final two seconds of music playback
  onLevelUpdate?: (level: number) => void;
  onError?: (error: string) => void;
}

function getDefaultDryReturnGain(trackId: number): number {
  return (trackId === 1 || trackId === 6 || trackId === 12) ? 0 : trackId === 4 ? 0.20 : 0.25;
}

function getDefaultWetReturnGain(trackId: number, effectVolumeMultiplier: number): number {
  const trackWetBoost = trackId === 1 ? 1.20 : (trackId === 2 || trackId === 6) ? 1.15 : 1.0;
  return 0.80 * trackWetBoost * effectVolumeMultiplier;
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
  effectVolumeMultiplier = 1.0,
 micSensitivity,
 masterVolume,
 musicVolume,
 dryWetMix,
 shouldFadeOut = false,
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
        effectVolumeMultiplier={effectVolumeMultiplier}
        micSensitivity={micSensitivity}
        masterVolume={masterVolume}
        musicVolume={musicVolume}
        dryWetMix={dryWetMix}
        shouldFadeOut={shouldFadeOut}
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
      effectVolumeMultiplier={effectVolumeMultiplier}
      micSensitivity={micSensitivity}
      masterVolume={masterVolume}
      musicVolume={musicVolume}
      dryWetMix={dryWetMix}
      shouldFadeOut={shouldFadeOut}
      onLevelUpdate={onLevelUpdate}
      onError={onError}
    />
  );
}

// ─── Effect DSP chain builder (Web Audio API JavaScript) ─────────────────────
// All effects use FINITE taps only — NO feedback loops that could cause runaway.
// Anti-feedback design: tight noise gate + HP filter to reject speaker bleed.
function buildEffectChainJS(): string {
  return `
    // Effect chain builder: creates Web Audio API effect chains with NO FEEDBACK LOOPS
    // AGGRESSIVE anti-feedback: -10dB gate + multi-band filtering eliminates headphone leakage
    // Only voice and loud environmental sounds pass through
    function buildEffectChain(ctx, source, trackId, bpm, intensity) {
      // ZERO INPUT GAIN — unity (0dB), no amplification of leakage
      var inputBoost = ctx.createGain();
      inputBoost.gain.value = 1.0; // 0dB = unity gain

      var output = ctx.createGain();
      output.gain.value = 0.6; // conservative output to prevent any feedback buildup

      // Analyser for level metering
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;

      // Noise gate at -14dB: voice triggers easily, headphone leakage (-20 to -40dB) still rejected
      var inputGate = ctx.createDynamicsCompressor();
      inputGate.threshold.value = -14;
      inputGate.knee.value = 2;
      inputGate.ratio.value = 40; // extreme ratio = hard gate
      inputGate.attack.value = 0.001;
      inputGate.release.value = 0.04; // fast release to cut quickly when voice stops

      // === MULTI-BAND ANTI-LEAKAGE FILTERING ===
      // Headphone leakage has a characteristic frequency profile:
      // - Bass leakage (20-300Hz): strongest from headphone drivers
      // - Mid leakage (300-2000Hz): music fundamentals
      // - Treble leakage (8000+Hz): hi-hats, cymbals
      // Voice is primarily 300-3500Hz, so we use a bandpass to isolate it

      // High-pass: aggressively cut everything below 300Hz (bass leakage)
      var antiBleedHP = ctx.createBiquadFilter();
      antiBleedHP.type = 'highpass';
      antiBleedHP.frequency.value = 300;
      antiBleedHP.Q.value = 1.0; // steep rolloff

      // Low-pass: cut above 6000Hz (treble leakage from hi-hats/cymbals)
      var antiBleedLP = ctx.createBiquadFilter();
      antiBleedLP.type = 'lowpass';
      antiBleedLP.frequency.value = 6000;
      antiBleedLP.Q.value = 0.7;

      // Notch filter at ~150Hz to kill bass drum leakage specifically
      var bassNotch = ctx.createBiquadFilter();
      bassNotch.type = 'notch';
      bassNotch.frequency.value = 150;
      bassNotch.Q.value = 2.0;

      // Signal chain: source -> gate -> HP -> LP -> notch -> inputBoost
      source.connect(inputGate);
      inputGate.connect(antiBleedHP);
      antiBleedHP.connect(antiBleedLP);
      antiBleedLP.connect(bassNotch);
      bassNotch.connect(inputBoost);

      var beatSec = 60.0 / bpm;
      var t = ctx.currentTime;

      switch (trackId) {
        case 1: { // MEASURE DELAY — Corpse Parade (BPM 116)
          // Each four-beat measure captures only its first beat. Three finite quarter-note
          // returns then play during beats two, three, and four; there is no feedback loop.
          var listenGate1 = ctx.createGain();
          listenGate1.gain.value = 0;
          var corpseMeasure1 = beatSec * 4;
          for (var measure1 = 0; measure1 < 120; measure1++) {
            var measureStart1 = t + measure1 * corpseMeasure1;
            listenGate1.gain.setValueAtTime(1, measureStart1);
            listenGate1.gain.setValueAtTime(0, measureStart1 + beatSec);
          }

          // Speed multipliers correspond to BPM × 1.0, × 0.7, × 0.4, and × 1.6 playback.
          // Every return keeps its own selected speed for sixteen beats before choosing again.
          var corpseSpeedChoices1 = [1.0, 0.7, 0.4, 1.6];
          function makeCorpseSpeedNode1() {
            var speedBlock1 = 2048;
            var speedNode1 = ctx.createScriptProcessor(speedBlock1, 1, 1);
            var speedBuffer1 = new Float32Array(speedBlock1 * 32);
            var speedWrite1 = 0;
            var speedRead1 = speedBuffer1.length - speedBlock1 * 2;
            var speed1 = corpseSpeedChoices1[Math.floor(Math.random() * corpseSpeedChoices1.length)];
            var speedSectionFrames1 = Math.max(speedBlock1, Math.floor(ctx.sampleRate * beatSec * 16));
            var speedFramesUntilChange1 = speedSectionFrames1;
            speedNode1.onaudioprocess = function(e) {
              var inp = e.inputBuffer.getChannelData(0);
              var out = e.outputBuffer.getChannelData(0);
              for (var sample1 = 0; sample1 < speedBlock1; sample1++) {
                speedBuffer1[speedWrite1] = inp[sample1];
                speedWrite1 = (speedWrite1 + 1) % speedBuffer1.length;
                var readIndex1 = Math.floor(speedRead1) % speedBuffer1.length;
                if (readIndex1 < 0) readIndex1 += speedBuffer1.length;
                out[sample1] = speedBuffer1[readIndex1] * 0.86;
                speedRead1 = (speedRead1 + speed1) % speedBuffer1.length;
              }
              speedFramesUntilChange1 -= speedBlock1;
              if (speedFramesUntilChange1 <= 0) {
                speed1 = corpseSpeedChoices1[Math.floor(Math.random() * corpseSpeedChoices1.length)];
                speedFramesUntilChange1 += speedSectionFrames1;
              }
            };
            return speedNode1;
          }

          // Three single-tap quarter-note returns: no delayed return is fed back into a delay.
          var corpseTap1a = ctx.createDelay(5.0); corpseTap1a.delayTime.value = beatSec;
          var corpseTap1b = ctx.createDelay(5.0); corpseTap1b.delayTime.value = beatSec * 2;
          var corpseTap1c = ctx.createDelay(5.0); corpseTap1c.delayTime.value = beatSec * 3;
          var corpseGain1a = ctx.createGain(); corpseGain1a.gain.value = 0.58;
          var corpseGain1b = ctx.createGain(); corpseGain1b.gain.value = 0.48;
          var corpseGain1c = ctx.createGain(); corpseGain1c.gain.value = 0.40;
          var corpseSpeed1a = makeCorpseSpeedNode1();
          var corpseSpeed1b = makeCorpseSpeedNode1();
          var corpseSpeed1c = makeCorpseSpeedNode1();

          // Returns are given distinct stereo locations and all three positions are refreshed
          // on each sixteen-beat boundary.
          var corpsePan1a = ctx.createStereoPanner();
          var corpsePan1b = ctx.createStereoPanner();
          var corpsePan1c = ctx.createStereoPanner();
          function randomCorpsePans1(atTime1) {
            var panA1 = -1 + Math.random() * 2;
            var panB1 = -1 + Math.random() * 2;
            var panC1 = -1 + Math.random() * 2;
            if (Math.abs(panB1 - panA1) < 0.3) panB1 = panB1 > 0 ? panB1 - 0.5 : panB1 + 0.5;
            if (Math.abs(panC1 - panA1) < 0.3 || Math.abs(panC1 - panB1) < 0.3) panC1 = -panC1;
            corpsePan1a.pan.setValueAtTime(Math.max(-1, Math.min(1, panA1)), atTime1);
            corpsePan1b.pan.setValueAtTime(Math.max(-1, Math.min(1, panB1)), atTime1);
            corpsePan1c.pan.setValueAtTime(Math.max(-1, Math.min(1, panC1)), atTime1);
          }
          var corpsePanSection1 = beatSec * 16;
          for (var panSchedule1 = 0; panSchedule1 < 30; panSchedule1++) {
            randomCorpsePans1(t + panSchedule1 * corpsePanSection1);
          }

          inputBoost.connect(listenGate1);
          listenGate1.connect(corpseTap1a); corpseTap1a.connect(corpseSpeed1a); corpseSpeed1a.connect(corpseGain1a); corpseGain1a.connect(corpsePan1a); corpsePan1a.connect(analyser);
          listenGate1.connect(corpseTap1b); corpseTap1b.connect(corpseSpeed1b); corpseSpeed1b.connect(corpseGain1b); corpseGain1b.connect(corpsePan1b); corpsePan1b.connect(analyser);
          listenGate1.connect(corpseTap1c); corpseTap1c.connect(corpseSpeed1c); corpseSpeed1c.connect(corpseGain1c); corpseGain1c.connect(corpsePan1c); corpsePan1c.connect(analyser);

          analyser.connect(output);
          break;
        }

        case 2: { // INSOMNIA FILTER — Sleep Deprivation (BPM 76): HP filter 1000Hz, 2x rate delay, large room reverb
          // High-pass filter: completely silence everything below 1000Hz
          var hp2 = ctx.createBiquadFilter();
          hp2.type = 'highpass'; hp2.frequency.value = 1000;
          hp2.Q.value = 1.0; // steep cutoff

          // Two finite taps select new 1, 2, 4, or 12-beat values every sixteen beats.
          var sleepDelayChoices2 = [1, 2, 4, 12];
          var del2a = ctx.createDelay(15.0); del2a.delayTime.value = beatSec;
          var del2Gain = ctx.createGain(); del2Gain.gain.value = 0.5;
          var del2b = ctx.createDelay(15.0); del2b.delayTime.value = beatSec * 2;
          var del2bGain = ctx.createGain(); del2bGain.gain.value = 0.3;
          var sleepDelaySection2 = beatSec * 16;
          for (var sleepSchedule2 = 0; sleepSchedule2 < 48; sleepSchedule2++) {
            var sleepTime2 = t + sleepSchedule2 * sleepDelaySection2;
            var sleepChoiceA2 = sleepDelayChoices2[Math.floor(Math.random() * sleepDelayChoices2.length)];
            var sleepChoiceB2 = sleepDelayChoices2[Math.floor(Math.random() * sleepDelayChoices2.length)];
            del2a.delayTime.setValueAtTime(beatSec * sleepChoiceA2, sleepTime2);
            del2b.delayTime.setValueAtTime(beatSec * sleepChoiceB2, sleepTime2);
          }

          // Large room reverb (multi-tap delays, NO FEEDBACK — just parallel taps for density)
          var revMerge2 = ctx.createGain(); revMerge2.gain.value = 0.23;
          var revTimes2 = [0.043, 0.089, 0.137, 0.191, 0.253, 0.317, 0.389];
          for (var ri2 = 0; ri2 < revTimes2.length; ri2++) {
            var rvd2 = ctx.createDelay(3.0);
            rvd2.delayTime.value = revTimes2[ri2] * (2.0 + intensity * 1.0);
            var rvlp2 = ctx.createBiquadFilter();
            rvlp2.type = 'lowpass'; rvlp2.frequency.value = 4000 - ri2 * 300;
            var rvGain2 = ctx.createGain(); rvGain2.gain.value = 0.25 - ri2 * 0.03; // decaying taps
            del2a.connect(rvd2);
            rvd2.connect(rvlp2); rvlp2.connect(rvGain2); rvGain2.connect(revMerge2);
          }

          // Signal chain: input -> HP filter -> delays (finite taps) + reverb -> output
          inputBoost.connect(hp2);
          hp2.connect(del2a); del2a.connect(del2Gain);
          hp2.connect(del2b); del2b.connect(del2bGain);
          var dry2g = ctx.createGain(); dry2g.gain.value = 0.50;
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

          // Randomized eighth-note sampling gate, synced to the song BPM.
          var sampleGate3 = ctx.createGain(); sampleGate3.gain.value = 0;
          var eighthSample3 = beatSec / 2;
          for (var sampleSchedule3 = 0; sampleSchedule3 < 240; sampleSchedule3++) {
            var sampleTime3 = t + sampleSchedule3 * eighthSample3;
            var sampleOpen3 = Math.random() > 0.30 ? 1 : 0;
            sampleGate3.gain.setValueAtTime(sampleOpen3, sampleTime3);
            sampleGate3.gain.setValueAtTime(0, sampleTime3 + eighthSample3 * 0.68);
          }

          // Delay at 2x rate of music (half beat) — NO FEEDBACK, single tap
          var halfBeat3 = beatSec / 2;
          var del3 = ctx.createDelay(5.0); del3.delayTime.value = halfBeat3;
          var del3Gain = ctx.createGain(); del3Gain.gain.value = 0.3;

          // Voice-focused +4dB input lift before the CB chain.
          var cbInputGain3 = ctx.createGain(); cbInputGain3.gain.value = 1.6;
          // Signal chain: input -> voice lift -> gate -> bandpass -> distortion -> bandpass2 -> delay -> output
          inputBoost.connect(cbInputGain3);
          cbInputGain3.connect(sampleGate3);
          sampleGate3.connect(cbBp);
          cbBp.connect(cbWs);
          cbWs.connect(cbBp2);
          cbBp2.connect(del3); del3.connect(del3Gain);
          // Mix: distorted + delayed
          var dry3g = ctx.createGain(); dry3g.gain.value = 1.4;
          cbBp2.connect(dry3g); dry3g.connect(analyser);
          del3Gain.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 4: { // DEMON CHORUS — Krampus Wishes: quarter-note delayed reverse with finite reverb and doubled voice
          // A queued reverse buffer prevents callback resets from creating an accidental forward path.
          var bufSize4 = 8192;
          var reverseNode4 = ctx.createScriptProcessor(bufSize4, 1, 1);
          var reverseLength4 = bufSize4 * 2;
          var revBuf4 = new Float32Array(reverseLength4);
          var revPlayBuf4 = new Float32Array(reverseLength4);
          var revQueuedBuf4 = new Float32Array(reverseLength4);
          var revWriteIdx4 = 0;
          var revReadPos4 = -1;
          var queuedReverse4 = false;
          reverseNode4.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            for (var wi = 0; wi < bufSize4; wi++) {
              revBuf4[revWriteIdx4] = inp[wi];
              revWriteIdx4++;
              if (revWriteIdx4 >= reverseLength4) {
                if (revReadPos4 < 0) {
                  for (var ci = 0; ci < reverseLength4; ci++) revPlayBuf4[ci] = revBuf4[ci];
                  revReadPos4 = reverseLength4 - 1;
                } else {
                  for (var qi = 0; qi < reverseLength4; qi++) revQueuedBuf4[qi] = revBuf4[qi];
                  queuedReverse4 = true;
                }
                revWriteIdx4 = 0;
              }
            }
            // Read strictly backwards at normal speed. There is no forward wet path.
            for (var ro = 0; ro < bufSize4; ro++) {
              if (revReadPos4 < 0 && queuedReverse4) {
                for (var si = 0; si < reverseLength4; si++) revPlayBuf4[si] = revQueuedBuf4[si];
                revReadPos4 = reverseLength4 - 1;
                queuedReverse4 = false;
              }
              var readPos4 = Math.floor(revReadPos4);
              out[ro] = readPos4 >= 0 ? revPlayBuf4[readPos4] : 0;
              revReadPos4 -= 1;
            }
          };

          // Quarter-note delay before reverse capture.
          var quarterDelay4 = ctx.createDelay(5.0); quarterDelay4.delayTime.value = beatSec;
          inputBoost.connect(quarterDelay4); quarterDelay4.connect(reverseNode4);

          // Two voices make the reverse return sound like a demon chorus.
          var demonMain4 = ctx.createGain(); demonMain4.gain.value = 0.48;
          var demonDoubleDelay4 = ctx.createDelay(0.10); demonDoubleDelay4.delayTime.value = 0.028;
          var demonDoubleGain4 = ctx.createGain(); demonDoubleGain4.gain.value = 0.42;
          reverseNode4.connect(demonMain4); demonMain4.connect(analyser);
          reverseNode4.connect(demonDoubleDelay4); demonDoubleDelay4.connect(demonDoubleGain4); demonDoubleGain4.connect(analyser);

          // Finite dark reverb reflections only — no feedback loop.
          var demonReverb4 = ctx.createGain(); demonReverb4.gain.value = 0.52;
          var demonReverbTimes4 = [0.14, 0.27, 0.43, 0.68, 0.96];
          for (var demonRi4 = 0; demonRi4 < demonReverbTimes4.length; demonRi4++) {
            var demonTap4 = ctx.createDelay(2.0); demonTap4.delayTime.value = demonReverbTimes4[demonRi4];
            var demonFilter4 = ctx.createBiquadFilter(); demonFilter4.type = 'lowpass'; demonFilter4.frequency.value = 3200 - demonRi4 * 350;
            var demonTapGain4 = ctx.createGain(); demonTapGain4.gain.value = 0.30 - demonRi4 * 0.04;
            reverseNode4.connect(demonTap4); demonTap4.connect(demonFilter4); demonFilter4.connect(demonTapGain4); demonTapGain4.connect(demonReverb4);
          }
          demonReverb4.connect(analyser);
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

          // Switch among requested multipliers every five seconds without a persistent timer.
          var rotaryMultipliers5 = [2, 3, 4, 1 / 3, 10];
          for (var switch5 = 0; switch5 < 120; switch5++) {
            var multiplier5 = rotaryMultipliers5[Math.floor(Math.random() * rotaryMultipliers5.length)];
            var switchHz5 = (bpm * multiplier5) / 60;
            var switchTime5 = t + switch5 * 5;
            rotaryAmpLfo5.frequency.setValueAtTime(switchHz5, switchTime5);
            rotaryDelLfo5.frequency.setValueAtTime(switchHz5, switchTime5);
            rotaryDelLfo5b.frequency.setValueAtTime(switchHz5 * 1.1, switchTime5);
          }

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
          var rotaryMerge5 = ctx.createGain(); rotaryMerge5.gain.value = 0.45;
          rotaryAmp5.connect(rotaryMerge5);
          rotaryDel5b.connect(rotaryMerge5);
          rotaryMerge5.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 6: { // DARK DELAY — Expiation: -15dB gate, randomized stereo half-octave slow returns
          // Strict -15dB gate eliminates low-level high-frequency feedback before effects.
          var gate6 = ctx.createDynamicsCompressor();
          gate6.threshold.value = -15;
          gate6.knee.value = 1;
          gate6.ratio.value = 40;
          gate6.attack.value = 0.001;
          gate6.release.value = 0.04;

          // Treble cut: remove everything above 5kHz
          var lp6 = ctx.createBiquadFilter();
          lp6.type = 'lowpass'; lp6.frequency.value = 5000;
          lp6.Q.value = 0.7;

          // Both taps choose independent one-to-thirty beat delay times.
          var expiationDelayChoices6 = [];
          for (var expiationBeat6 = 1; expiationBeat6 <= 30; expiationBeat6++) expiationDelayChoices6.push(expiationBeat6);
          var del6 = ctx.createDelay(30.0); del6.delayTime.value = beatSec * expiationDelayChoices6[Math.floor(Math.random() * expiationDelayChoices6.length)];
          var del6Gain = ctx.createGain(); del6Gain.gain.value = 0.72;
          var del6b = ctx.createDelay(30.0); del6b.delayTime.value = beatSec * expiationDelayChoices6[Math.floor(Math.random() * expiationDelayChoices6.length)];
          var del6bGain = ctx.createGain(); del6bGain.gain.value = 0.36;
          for (var expiationSchedule6 = 1; expiationSchedule6 <= 60; expiationSchedule6++) {
            var expiationTime6 = t + expiationSchedule6 * beatSec * 16;
            del6.delayTime.setValueAtTime(beatSec * expiationDelayChoices6[Math.floor(Math.random() * expiationDelayChoices6.length)], expiationTime6);
            del6b.delayTime.setValueAtTime(beatSec * expiationDelayChoices6[Math.floor(Math.random() * expiationDelayChoices6.length)], expiationTime6);
          }

          // Each delay return plays at 75% speed: an audible, approximately half-octave-down shift.
          function makeHalfOctaveSlow6() {
            var octaveSize6 = 4096;
            var octaveNode6 = ctx.createScriptProcessor(octaveSize6, 1, 1);
            var octaveBuf6 = new Float32Array(octaveSize6 * 2);
            var octavePlay6 = new Float32Array(octaveSize6 * 2);
            var octaveWrite6 = 0;
            octaveNode6.onaudioprocess = function(e) {
              var inp = e.inputBuffer.getChannelData(0);
              var out = e.outputBuffer.getChannelData(0);
              for (var oi6 = 0; oi6 < octaveSize6; oi6++) {
                octaveBuf6[octaveWrite6++] = inp[oi6];
                if (octaveWrite6 >= octaveSize6 * 2) {
                  for (var oc6 = 0; oc6 < octaveSize6 * 2; oc6++) octavePlay6[oc6] = octaveBuf6[oc6];
                  octaveWrite6 = 0;
                }
              }
              for (var oo6 = 0; oo6 < octaveSize6; oo6++) {
                var halfOctaveRead6 = Math.floor(oo6 * 0.75);
                out[oo6] = octavePlay6[halfOctaveRead6] * 0.8;
              }
            };
            return octaveNode6;
          }
          var octaveDown6a = makeHalfOctaveSlow6();
          var octaveDown6b = makeHalfOctaveSlow6();
          var pan6a = ctx.createStereoPanner(); pan6a.pan.value = -1;
          var pan6b = ctx.createStereoPanner(); pan6b.pan.value = 1;

          // Signal chain: input -> gate -> LP filter -> stereo 75%-speed, half-octave-style returns.
          inputBoost.connect(gate6);
          gate6.connect(lp6);
          lp6.connect(del6); del6.connect(octaveDown6a); octaveDown6a.connect(del6Gain); del6Gain.connect(pan6a);
          lp6.connect(del6b); del6b.connect(octaveDown6b); octaveDown6b.connect(del6bGain); del6bGain.connect(pan6b);
          var dry6g = ctx.createGain(); dry6g.gain.value = 0.0;
          lp6.connect(dry6g); dry6g.connect(analyser);
          pan6a.connect(analyser);
          pan6b.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 7: { // CATHEDRAL — Recessional: -15dB gate, faster cathedral, randomized stereo echoes
          // Only voices and louder events cross the -15dB gate.
          var gate7 = ctx.createDynamicsCompressor();
          gate7.threshold.value = -15;
          gate7.knee.value = 1;
          gate7.ratio.value = 40;
          gate7.attack.value = 0.001;
          gate7.release.value = 0.06;

          // Faster cathedral decay — gated source only, finite parallel reflections, no feedback loop.
          var reverbMerge7 = ctx.createGain(); reverbMerge7.gain.value = 0.22;
          var reverbTimes7 = [0.019, 0.041, 0.071, 0.109, 0.151, 0.199, 0.257, 0.331];
          inputBoost.connect(gate7);
          for (var ri = 0; ri < reverbTimes7.length; ri++) {
            var rvDel7 = ctx.createDelay(5.0);
            rvDel7.delayTime.value = reverbTimes7[ri] * (1.6 + intensity * 0.6);
            var rvLp7 = ctx.createBiquadFilter();
            rvLp7.type = 'lowpass'; rvLp7.frequency.value = 2500 - ri * 100; // darker with each reflection
            var rvGain7 = ctx.createGain(); rvGain7.gain.value = 0.20 - ri * 0.02;
            gate7.connect(rvDel7);
            rvDel7.connect(rvLp7); rvLp7.connect(rvGain7); rvGain7.connect(reverbMerge7);
          }

          // Three finite echoes; each is independently randomized between one and twelve beats.
          var echoBeats7a = 1 + Math.floor(Math.random() * 12);
          var echoBeats7b = 1 + Math.floor(Math.random() * 12);
          var echoBeats7c = 1 + Math.floor(Math.random() * 12);
          var del7a = ctx.createDelay(5.0); del7a.delayTime.value = beatSec * echoBeats7a;
          var del7b = ctx.createDelay(5.0); del7b.delayTime.value = beatSec * echoBeats7b;
          var del7c = ctx.createDelay(5.0); del7c.delayTime.value = beatSec * echoBeats7c;
          var delGain7a = ctx.createGain(); delGain7a.gain.value = 0.6;
          var delGain7b = ctx.createGain(); delGain7b.gain.value = 0.4;
          var delGain7c = ctx.createGain(); delGain7c.gain.value = 0.2;
          var pan7a = ctx.createStereoPanner(); pan7a.pan.value = -1 + Math.random() * 2;
          var pan7b = ctx.createStereoPanner(); pan7b.pan.value = -1 + Math.random() * 2;
          var pan7c = ctx.createStereoPanner(); pan7c.pan.value = -1 + Math.random() * 2;

          // Re-randomize all finite echo times and pans every twenty seconds.
          for (var randomize7 = 1; randomize7 <= 90; randomize7++) {
            var randomizeTime7 = t + randomize7 * 20;
            del7a.delayTime.setValueAtTime(beatSec * (1 + Math.floor(Math.random() * 12)), randomizeTime7);
            del7b.delayTime.setValueAtTime(beatSec * (1 + Math.floor(Math.random() * 12)), randomizeTime7);
            del7c.delayTime.setValueAtTime(beatSec * (1 + Math.floor(Math.random() * 12)), randomizeTime7);
            pan7a.pan.setValueAtTime(-1 + Math.random() * 2, randomizeTime7);
            pan7b.pan.setValueAtTime(-1 + Math.random() * 2, randomizeTime7);
            pan7c.pan.setValueAtTime(-1 + Math.random() * 2, randomizeTime7);
          }

          gate7.connect(del7a); del7a.connect(delGain7a); delGain7a.connect(pan7a); pan7a.connect(analyser);
          gate7.connect(del7b); del7b.connect(delGain7b); delGain7b.connect(pan7b); pan7b.connect(analyser);
          gate7.connect(del7c); del7c.connect(delGain7c); delGain7c.connect(pan7c); pan7c.connect(analyser);

          // Dry (gated) signal + reverb
          var dry7 = ctx.createGain(); dry7.gain.value = 0.5;
          gate7.connect(dry7); dry7.connect(analyser);
          reverbMerge7.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 8: { // SYLLABLE CHOP — Road Show: eighth-note on/off voice fragments with randomized finite delays
          // A square wave at one cycle per beat creates an eighth-note on / eighth-note off rhythm.
          var syllableGate8 = ctx.createGain(); syllableGate8.gain.value = 0.5;
          var syllableLfo8 = ctx.createOscillator(); syllableLfo8.type = 'square';
          syllableLfo8.frequency.value = 1 / beatSec;
          var syllableDepth8 = ctx.createGain(); syllableDepth8.gain.value = 0.5;
          syllableLfo8.connect(syllableDepth8); syllableDepth8.connect(syllableGate8.gain);
          syllableLfo8.start();

          // Each half-second-like syllable fragment gets one finite BPM-based return.
          var sampleDelayChoices8 = [beatSec * 2, beatSec * 4, beatSec * 0.33, beatSec * 12];
          var sampleDelay8 = ctx.createDelay(15.0);
          sampleDelay8.delayTime.value = sampleDelayChoices8[Math.floor(Math.random() * sampleDelayChoices8.length)];
          var sampleReturn8 = ctx.createGain(); sampleReturn8.gain.value = 0.72;
          // Re-randomize the BPM-based return every twenty seconds without feedback.
          for (var sampleSchedule8 = 1; sampleSchedule8 <= 90; sampleSchedule8++) {
            var sampleTime8 = t + sampleSchedule8 * 20;
            var sampleChoice8 = sampleDelayChoices8[Math.floor(Math.random() * sampleDelayChoices8.length)];
            sampleDelay8.delayTime.setValueAtTime(sampleChoice8, sampleTime8);
          }

          // Chopped dry syllables and their selected finite delay are the entire effect.
          var syllableDry8 = ctx.createGain(); syllableDry8.gain.value = 0.48;
          inputBoost.connect(syllableGate8);
          syllableGate8.connect(syllableDry8); syllableDry8.connect(analyser);
          syllableGate8.connect(sampleDelay8); sampleDelay8.connect(sampleReturn8); sampleReturn8.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 9: { // PING PONG PHASER — Excitement and Elimination: ping-pong delay, 20dB gate, 2x speed, random phaser, max 2 delays
          // BPM 152, beatSec = 60/152 ≈ 0.395s
          // Tight -15dB gate: only strong foreground sounds reach the delays.
          var gate9 = ctx.createDynamicsCompressor();
          gate9.threshold.value = -15;
          gate9.knee.value = 1;
          gate9.ratio.value = 20;
          gate9.attack.value = 0.001;
          gate9.release.value = 0.03;

          // Ping-pong delay at music rate, played back at 2x speed (half the delay time)
          var halfBeat9 = beatSec / 2; // 2x speed = half the beat duration

          // Left delay (first echo)
          var delL9 = ctx.createDelay(5.0);
          delL9.delayTime.value = halfBeat9;
          var gainL9 = ctx.createGain(); gainL9.gain.value = 0.60;
          var panL9 = ctx.createStereoPanner(); panL9.pan.value = -1;

          // Right delay (second echo, panned opposite)
          var delR9 = ctx.createDelay(5.0);
          delR9.delayTime.value = halfBeat9 * 2; // second ping
          var gainR9 = ctx.createGain(); gainR9.gain.value = 0.50;
          var panR9 = ctx.createStereoPanner(); panR9.pan.value = 1;

          // Choose a new ping-pong subdivision every twenty-two seconds.
          var pingPongChoices9 = [beatSec / 2, beatSec / 3, beatSec / 0.5, beatSec / 8, beatSec / 0.33];
          for (var pingSchedule9 = 1; pingSchedule9 <= 82; pingSchedule9++) {
            var pingTime9 = t + pingSchedule9 * 22;
            var pingChoice9 = pingPongChoices9[Math.floor(Math.random() * pingPongChoices9.length)];
            delL9.delayTime.setValueAtTime(pingChoice9, pingTime9);
            delR9.delayTime.setValueAtTime(pingChoice9 * 2, pingTime9);
          }

          // Random phaser via allpass filters with LFO modulation
          // Phaser varies tone randomly on each successive hit
          var allpass9a = ctx.createBiquadFilter();
          allpass9a.type = 'allpass'; allpass9a.frequency.value = 1000;
          allpass9a.Q.value = 24;
          var allpass9b = ctx.createBiquadFilter();
          allpass9b.type = 'allpass'; allpass9b.frequency.value = 2500;
          allpass9b.Q.value = 24;
          var allpass9c = ctx.createBiquadFilter();
          allpass9c.type = 'allpass'; allpass9c.frequency.value = 4000;
          allpass9c.Q.value = 18;

          // Random-ish LFO for phaser sweep (uses non-harmonic frequency for pseudo-random feel)
          var phaserLfo9 = ctx.createOscillator(); phaserLfo9.type = 'sine';
          phaserLfo9.frequency.value = 2.5 + intensity * 7.5;
          var phaserDepth9 = ctx.createGain(); phaserDepth9.gain.value = 9000 + intensity * 12000;
          phaserLfo9.connect(phaserDepth9);
          phaserDepth9.connect(allpass9a.frequency);
          phaserDepth9.connect(allpass9b.frequency);
          phaserDepth9.connect(allpass9c.frequency);
          phaserLfo9.start();

          // Second LFO at irrational ratio for more random variation
          var phaserLfo9b = ctx.createOscillator(); phaserLfo9b.type = 'triangle';
          phaserLfo9b.frequency.value = 1.37; // irrational ratio to first LFO
          var phaserDepth9b = ctx.createGain(); phaserDepth9b.gain.value = 7000;
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

          // Mix: centered dry path plus emphatic hard-left and hard-right returns.
          var dry9 = ctx.createGain(); dry9.gain.value = 0.25;
          var dryPan9 = ctx.createStereoPanner(); dryPan9.pan.value = 0;
          gate9.connect(dry9); dry9.connect(dryPan9); dryPan9.connect(analyser);
          gainL9.connect(panL9); panL9.connect(analyser);
          gainR9.connect(panR9); panR9.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 10: { // SHIFTING CHORUS — Piano Fandango (BPM 106): simple chorus with random rate change every 16 measures
          // 16 measures at 106 BPM in 4/4 = 16 * 4 * (60/106) = ~36.2 seconds
          var measuresSec10 = 16 * 4 * beatSec; // ~36.2s per rate change

          // Chorus: 3 modulated delay voices
          var chorusMerge10 = ctx.createGain(); chorusMerge10.gain.value = 1.0;
          var chorusVoices10 = 3;
          var chorusBaseDelays10 = [0.015, 0.025, 0.035];
          var chorusPanSection10 = beatSec * 16;
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
            // Each chorus voice gets its own random pan and a new position every sixteen beats.
            var chorusPan10 = ctx.createStereoPanner();
            chorusPan10.pan.value = -1 + Math.random() * 2;
            for (var panSchedule10 = 1; panSchedule10 <= 40; panSchedule10++) {
              chorusPan10.pan.setValueAtTime(-1 + Math.random() * 2, t + chorusPanSection10 * panSchedule10);
            }
            // NO FEEDBACK — chorus voices are single-pass only
            inputBoost.connect(chDel10);
            chDel10.connect(chorusPan10); chorusPan10.connect(chorusMerge10);
          }

          // Fourth chorus voice: a twenty-beat delayed half-speed response at a random position.
          var chDel10d = ctx.createDelay(15.0); chDel10d.delayTime.value = beatSec * 20;
          var chSlowSize10 = 4096;
          var chSlowNode10 = ctx.createScriptProcessor(chSlowSize10, 1, 1);
          var chSlowBuf10 = new Float32Array(chSlowSize10 * 2);
          var chSlowPlay10 = new Float32Array(chSlowSize10 * 2);
          var chSlowWrite10 = 0;
          chSlowNode10.onaudioprocess = function(e) {
            var inp = e.inputBuffer.getChannelData(0);
            var out = e.outputBuffer.getChannelData(0);
            for (var sw10 = 0; sw10 < chSlowSize10; sw10++) {
              chSlowBuf10[chSlowWrite10++] = inp[sw10];
              if (chSlowWrite10 >= chSlowSize10 * 2) {
                for (var sc10 = 0; sc10 < chSlowSize10 * 2; sc10++) chSlowPlay10[sc10] = chSlowBuf10[sc10];
                chSlowWrite10 = 0;
              }
            }
            for (var so10 = 0; so10 < chSlowSize10; so10++) out[so10] = chSlowPlay10[Math.floor(so10 * 0.5)] * 0.58;
          };
          var chPan10d = ctx.createStereoPanner(); chPan10d.pan.value = -1 + Math.random() * 2;
          var chGain10d = ctx.createGain(); chGain10d.gain.value = 0.38;
          inputBoost.connect(chDel10d); chDel10d.connect(chSlowNode10); chSlowNode10.connect(chGain10d); chGain10d.connect(chPan10d); chPan10d.connect(chorusMerge10);

          // Mix: stronger centered dry voice + independently panned chorus voices.
          var dry10 = ctx.createGain(); dry10.gain.value = 0.5;
          var dryPan10 = ctx.createStereoPanner(); dryPan10.pan.value = 0;
          inputBoost.connect(dry10); dry10.connect(dryPan10); dryPan10.connect(analyser);
          chorusMerge10.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 11: { // EIGHTH-NOTE TRIPLET — Much Ado (BPM 120)
          // Gate at -10dB, then create three taps within one eighth-note span.
          var gate11 = ctx.createDynamicsCompressor();
          gate11.threshold.value = -10;
          gate11.knee.value = 1; gate11.ratio.value = 20;
          gate11.attack.value = 0.001; gate11.release.value = 0.03;
          var eighthTriplet11 = beatSec / 2;
          var triplet11a = ctx.createDelay(5.0); triplet11a.delayTime.value = eighthTriplet11 / 3;
          var triplet11b = ctx.createDelay(5.0); triplet11b.delayTime.value = (eighthTriplet11 * 2) / 3;
          var triplet11c = ctx.createDelay(5.0); triplet11c.delayTime.value = eighthTriplet11;
          var tripletGain11a = ctx.createGain(); tripletGain11a.gain.value = 0.32;
          var tripletGain11b = ctx.createGain(); tripletGain11b.gain.value = 0.32;
          var tripletGain11c = ctx.createGain(); tripletGain11c.gain.value = 0.55;
          // De-ess each tap before output to reduce amplified sibilance.
          var deEss11a = ctx.createBiquadFilter(); deEss11a.type = 'notch'; deEss11a.frequency.value = 6500; deEss11a.Q.value = 2.5;
          var deEss11b = ctx.createBiquadFilter(); deEss11b.type = 'notch'; deEss11b.frequency.value = 6500; deEss11b.Q.value = 2.5;
          var deEss11c = ctx.createBiquadFilter(); deEss11c.type = 'notch'; deEss11c.frequency.value = 6500; deEss11c.Q.value = 2.5;

          // Signal chain: input above -10dB -> de-essed finite eighth-note triplet taps.
          inputBoost.connect(gate11);
          gate11.connect(triplet11a); triplet11a.connect(tripletGain11a); tripletGain11a.connect(deEss11a); deEss11a.connect(analyser);
          gate11.connect(triplet11b); triplet11b.connect(tripletGain11b); tripletGain11b.connect(deEss11b); deEss11b.connect(analyser);
          gate11.connect(triplet11c); triplet11c.connect(tripletGain11c); tripletGain11c.connect(deEss11c); deEss11c.connect(analyser);
          analyser.connect(output);
          break;
        }

        case 12: { // CHIPMUNK — Theme for New Beginnings (BPM 84): dual delayed, randomized-speed playback
          // 1-second delay
          var del12 = ctx.createDelay(5.0); del12.delayTime.value = 1.0;
          var del12Gain = ctx.createGain(); del12Gain.gain.value = 0.42;
          // Second chipmunk tap uses twice the prior delay: three seconds.
          var del12b = ctx.createDelay(5.0); del12b.delayTime.value = 3.0;
          var del12bGain = ctx.createGain(); del12bGain.gain.value = 0.25;

          var chipmunkSpeeds12 = [2.0, 1.8, 1.5, 1.3];
          // Separate chipmunk processors keep each delayed return independently panned.
          function makeChipmunkNode12() {
            var bufSize12 = 4096;
            var node12 = ctx.createScriptProcessor(bufSize12, 1, 1);
            var chipmunkBuf12 = new Float32Array(bufSize12 * 2);
            var chipmunkPlayBuf12 = new Float32Array(bufSize12 * 2);
            var chipmunkWriteIdx12 = 0;
            var chipmunkSpeed12 = chipmunkSpeeds12[Math.floor(Math.random() * chipmunkSpeeds12.length)];
            var chipmunkSamplesPerSection12 = Math.floor(ctx.sampleRate * beatSec * 128);
            var chipmunkSamplesUntilChange12 = chipmunkSamplesPerSection12;
            node12.onaudioprocess = function(e) {
              var inp = e.inputBuffer.getChannelData(0);
              var out = e.outputBuffer.getChannelData(0);
              for (var wi = 0; wi < bufSize12; wi++) {
                chipmunkBuf12[chipmunkWriteIdx12++] = inp[wi];
                if (chipmunkWriteIdx12 >= bufSize12 * 2) {
                  for (var ci = 0; ci < bufSize12 * 2; ci++) chipmunkPlayBuf12[ci] = chipmunkBuf12[ci];
                  chipmunkWriteIdx12 = 0;
                }
              }
              chipmunkSamplesUntilChange12 -= bufSize12;
              if (chipmunkSamplesUntilChange12 <= 0) {
                chipmunkSpeed12 = chipmunkSpeeds12[Math.floor(Math.random() * chipmunkSpeeds12.length)];
                chipmunkSamplesUntilChange12 += chipmunkSamplesPerSection12;
              }
              for (var ro = 0; ro < bufSize12; ro++) {
                var readPos = Math.floor(ro * chipmunkSpeed12);
                out[ro] = (readPos < bufSize12 * 2) ? chipmunkPlayBuf12[readPos] * 0.8 : 0;
              }
            };
            return node12;
          }
          var chipmunkNode12a = makeChipmunkNode12();
          var chipmunkNode12b = makeChipmunkNode12();
          var chipmunkPan12a = ctx.createStereoPanner(); chipmunkPan12a.pan.value = -1 + Math.random() * 2;
          var chipmunkPan12b = ctx.createStereoPanner(); chipmunkPan12b.pan.value = -1 + Math.random() * 2;
          var chipmunkPanSection12 = beatSec * 24;
          for (var panSchedule12 = 1; panSchedule12 <= 50; panSchedule12++) {
            var panTime12 = t + panSchedule12 * chipmunkPanSection12;
            chipmunkPan12a.pan.setValueAtTime(-1 + Math.random() * 2, panTime12);
            chipmunkPan12b.pan.setValueAtTime(-1 + Math.random() * 2, panTime12);
          }

          // Signal chain: two finite delayed taps -> independent chipmunk paths -> independently random stereo positions.
          inputBoost.connect(del12); del12.connect(del12Gain);
          inputBoost.connect(del12b); del12b.connect(del12bGain);
          del12Gain.connect(chipmunkNode12a); chipmunkNode12a.connect(chipmunkPan12a); chipmunkPan12a.connect(analyser);
          del12bGain.connect(chipmunkNode12b); chipmunkNode12b.connect(chipmunkPan12b); chipmunkPan12b.connect(analyser);
          var dry12 = ctx.createGain(); dry12.gain.value = 0.0; // Theme for New Beginnings has no effect-chain dry return
          inputBoost.connect(dry12); dry12.connect(analyser);
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
    function buildDryWetChain(ctx, source, trackId, bpm, intensity, dryWetMix, effectVolumeMultiplier) {
      function getDefaultDryReturnGain(trackId) {
        return (trackId === 1 || trackId === 6 || trackId === 12) ? 0 : trackId === 4 ? 0.20 : 0.25;
      }
      function getDefaultWetReturnGain(trackId, effectVolumeMultiplier) {
        var trackWetBoost = trackId === 1 ? 1.20 : (trackId === 2 || trackId === 6) ? 1.15 : 1.0;
        return 0.80 * trackWetBoost * effectVolumeMultiplier;
      }
      // Higher fixed mix: dry return +5 points and effected return +10 points.
      // Gate, frequency filters, compressor, and limiter remain in place to control leakage and peaks
      var dryGain = ctx.createGain();
      // Corpse Parade, Expiation, and Theme remain fully wet. Krampus Wishes uses a 20% lower dry return.
      dryGain.gain.value = getDefaultDryReturnGain(trackId);

      var wetGain = ctx.createGain();
      wetGain.gain.value = getDefaultWetReturnGain(trackId, effectVolumeMultiplier);

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

      // Dry path gain stays below unity to suppress residual leakage while improving vocal audibility
      var dryBoost = ctx.createGain();
      dryBoost.gain.value = 0.75; // below unity — stronger voice return with leakage suppression retained

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
  effectVolumeMultiplier = 1.0,
  micSensitivity,
  masterVolume,
  musicVolume,
  dryWetMix,
  shouldFadeOut = false,
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

  // Update total mic output. During the final two seconds, dry and wet paths fade together.
  useEffect(() => {
    const outputGain = outputGainRef.current;
    const audioCtx = audioCtxRef.current;
    if (!outputGain || !audioCtx) return;
    const now = audioCtx.currentTime;
    const outputLevel = (musicVolume / 100) * 0.80;
    outputGain.gain.cancelScheduledValues(now);
    outputGain.gain.setValueAtTime(outputGain.gain.value, now);
    if (shouldFadeOut) {
      outputGain.gain.linearRampToValueAtTime(0, now + 2.0);
    } else {
      outputGain.gain.linearRampToValueAtTime(outputLevel, now + 0.08);
    }
  }, [musicVolume, shouldFadeOut]);

  // Update track-specific dry and wet returns without rebuilding the microphone graph.
  useEffect(() => {
    if (dryGainRef.current) dryGainRef.current.gain.value = getDefaultDryReturnGain(trackId);
    if (wetGainRef.current) wetGainRef.current.gain.value = getDefaultWetReturnGain(trackId, effectVolumeMultiplier);
  }, [dryWetMix, trackId, effectVolumeMultiplier]);

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
      // Mic-output master at 0.80x music volume; safety processing remains post-mix
      const outputLevel = (musicVolume / 100) * 0.80;
      // Start at 0 and ramp up over 4 seconds for smooth transition
      outputGain.gain.value = 0;
      outputGain.gain.linearRampToValueAtTime(outputLevel, ctx.currentTime + 4.0);
      outputGainRef.current = outputGain;

      // Build dry/wet chain
      const intensity = effectIntensity / 100;
      const mix = dryWetMix / 100;
      const buildFn = new Function(
        "ctx", "source", "trackId", "bpm", "intensity", "dryWetMix", "effectVolumeMultiplier",
        buildEffectChainJS() + "\n" + buildDryWetChainJS() + "\nreturn buildDryWetChain(ctx, source, trackId, bpm, intensity, dryWetMix, effectVolumeMultiplier);"
      );
      const chain = buildFn(ctx, source, trackId, bpm, intensity, mix, effectVolumeMultiplier);
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
  effectVolumeMultiplier = 1.0,
  micSensitivity,
  masterVolume,
  musicVolume,
  dryWetMix,
  shouldFadeOut = false,
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
  // Mic-output master at 0.80x music volume; native path matches web
  const vol = (musicVolume / 100) * 0.80;
  const mix = 0.80; // not used for initial setup (buildDryWetChain uses fixed 25/80)
  const wetEffectVolume = Math.max(0.5, Math.min(1.5, effectVolumeMultiplier));

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

async function startPassthrough(trackId, bpm, intensity, vol, dryWetMix, effectVolumeMultiplier) {
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

    chain = buildDryWetChain(audioCtx, source, trackId, bpm, intensity, dryWetMix, effectVolumeMultiplier);
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
        startPassthrough(trackId, bpm, intensity, vol, dryWetMix, effectVolumeMultiplier);
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

function fadeMicOutput(shouldFadeOut, vol) {
  if (outputGain && audioCtx) {
    var now = audioCtx.currentTime;
    outputGain.gain.cancelScheduledValues(now);
    outputGain.gain.setValueAtTime(outputGain.gain.value, now);
    if (shouldFadeOut) {
      outputGain.gain.linearRampToValueAtTime(0, now + 2.0);
    } else {
      outputGain.gain.linearRampToValueAtTime(vol, now + 0.08);
    }
  }
}

function setDryWet(mix, trackId, effectVolumeMultiplier) {
  if (chain && chain.dryGain && chain.wetGain && audioCtx) {
    var t = audioCtx.currentTime;
    chain.dryGain.gain.setValueAtTime(getDefaultDryReturnGain(trackId), t);
    chain.wetGain.gain.setValueAtTime(getDefaultWetReturnGain(trackId, effectVolumeMultiplier), t);
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
      const js = `startPassthrough(${trackId}, ${bpm}, ${intensity}, ${vol}, ${mix}, ${wetEffectVolume}); true;`;
      webViewRef.current.injectJavaScript(js);
    } else {
      webViewRef.current.injectJavaScript("stopPassthrough(); true;");
    }
  // Wet level has its own setDryWet update below. Keeping it out of this dependency
  // prevents slider movement from restarting the WebView and racing a later stop request.
  }, [isActive, isReady, permissionGranted, trackId, bpm, intensity, vol, mix]);

  // Update volume and the shared pre-finish fade dynamically.
  useEffect(() => {
    if (!webViewRef.current || !isReady || !isActive) return;
    webViewRef.current.injectJavaScript(`fadeMicOutput(${shouldFadeOut}, ${vol}); true;`);
  }, [vol, shouldFadeOut, isReady, isActive]);

  // Update dry/wet mix dynamically
  useEffect(() => {
    if (!webViewRef.current || !isReady || !isActive) return;
    webViewRef.current.injectJavaScript(`setDryWet(${mix}, ${trackId}, ${wetEffectVolume}); true;`);
  }, [mix, trackId, wetEffectVolume, isReady, isActive]);

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
            const js = `startPassthrough(${trackId}, ${bpm}, ${intensity}, ${vol}, ${mix}, ${wetEffectVolume}); true;`;
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
