import React, { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Platform } from "react-native";

interface MicPassthroughProps {
  isActive: boolean;
  trackId: number;
  bpm: number;
  effectIntensity: number; // 0-100
  micSensitivity: number; // 0-100
  volume: number; // 0-100 (mic passthrough volume)
  onLevelUpdate?: (level: number) => void;
  onError?: (error: string) => void;
}

/**
 * MicPassthroughWebView
 *
 * On native: Runs a hidden WebView that captures the microphone via getUserMedia,
 * applies real-time Web Audio API effects, and outputs the processed audio to
 * the device speakers/headphones. This mixes naturally with the SoundCloud
 * track audio at the OS audio mixer level.
 *
 * On web: Uses the Web Audio API directly in the main page context.
 *
 * Each track ID maps to a unique DSP chain (reverb, delay, filter, distortion, etc.)
 */
export function MicPassthrough({
  isActive,
  trackId,
  bpm,
  effectIntensity,
  micSensitivity,
  volume,
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
        volume={volume}
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
      volume={volume}
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
          var dry = ctx.createGain(); dry.gain.value = 0.6 - intensity * 0.2;

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

        case 2: // Granular Stutter - rapid gain modulation
          var lfo = ctx.createOscillator();
          lfo.type = 'square';
          lfo.frequency.value = (bpm / 60) * (2 + intensity * 6);
          var lfoGain = ctx.createGain();
          lfoGain.gain.value = 0.5 + intensity * 0.5;
          var bp = ctx.createBiquadFilter();
          bp.type = 'bandpass'; bp.frequency.value = 1000 + intensity * 3000;
          bp.Q.value = 1 + intensity * 4;

          source.connect(gain);
          gain.connect(bp);
          lfo.connect(lfoGain);
          lfoGain.connect(gain.gain);
          lfo.start();
          bp.connect(analyser);
          analyser.connect(output);
          break;

        case 3: // Bitcrusher Chaos - waveshaper distortion + filter
          var ws = ctx.createWaveShaper();
          var curve = new Float32Array(256);
          for (var i = 0; i < 256; i++) {
            var x = (i / 128) - 1;
            var amt = 2 + intensity * 20;
            curve[i] = ((3 + amt) * x * 20 * (Math.PI / 180)) / ((Math.PI / 180) + amt * Math.abs(x));
          }
          ws.curve = curve;
          ws.oversample = '4x';
          var lp = ctx.createBiquadFilter();
          lp.type = 'lowpass'; lp.frequency.value = 2000 + (1 - intensity) * 6000;
          lp.Q.value = 1 + intensity * 5;

          source.connect(gain);
          gain.connect(ws);
          ws.connect(lp);
          lp.connect(analyser);
          analyser.connect(output);
          break;

        case 4: // Reverse Swell - slow attack envelope with tremolo
          var trem = ctx.createOscillator();
          trem.type = 'sine';
          trem.frequency.value = 2 + intensity * 6;
          var tremGain = ctx.createGain();
          tremGain.gain.value = 0.3 * intensity;
          var lpf = ctx.createBiquadFilter();
          lpf.type = 'lowpass'; lpf.frequency.value = 500 + intensity * 3000;
          lpf.Q.value = 2 + intensity * 6;
          var del = ctx.createDelay(1.0);
          del.delayTime.value = 0.1 + intensity * 0.3;
          var delFb = ctx.createGain(); delFb.gain.value = 0.3 + intensity * 0.4;

          source.connect(gain);
          trem.connect(tremGain);
          tremGain.connect(gain.gain);
          trem.start();
          gain.connect(lpf);
          lpf.connect(del);
          del.connect(delFb);
          delFb.connect(del);
          lpf.connect(analyser);
          del.connect(analyser);
          analyser.connect(output);
          break;

        case 5: // Metallic Resonance - high-Q bandpass with feedback
          var bp1 = ctx.createBiquadFilter();
          bp1.type = 'bandpass'; bp1.frequency.value = 800 + intensity * 2000;
          bp1.Q.value = 5 + intensity * 15;
          var bp2 = ctx.createBiquadFilter();
          bp2.type = 'bandpass'; bp2.frequency.value = 1600 + intensity * 3000;
          bp2.Q.value = 3 + intensity * 10;
          var metalDel = ctx.createDelay(0.05);
          metalDel.delayTime.value = 0.005 + intensity * 0.015;
          var metalFb = ctx.createGain(); metalFb.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(bp1);
          gain.connect(bp2);
          bp1.connect(metalDel);
          metalDel.connect(metalFb);
          metalFb.connect(bp1);
          bp1.connect(analyser);
          bp2.connect(analyser);
          analyser.connect(output);
          break;

        case 6: // Tape Decay - wow/flutter modulation + saturation
          var wowLfo = ctx.createOscillator();
          wowLfo.type = 'sine'; wowLfo.frequency.value = 0.5 + intensity * 1.5;
          var wowGain = ctx.createGain(); wowGain.gain.value = 0.002 + intensity * 0.008;
          var tapeDel = ctx.createDelay(0.1);
          tapeDel.delayTime.value = 0.01;
          var tapeWs = ctx.createWaveShaper();
          var tapeCurve = new Float32Array(256);
          for (var j = 0; j < 256; j++) {
            var xv = (j / 128) - 1;
            tapeCurve[j] = Math.tanh(xv * (1 + intensity * 3));
          }
          tapeWs.curve = tapeCurve;
          var tapeLp = ctx.createBiquadFilter();
          tapeLp.type = 'lowpass'; tapeLp.frequency.value = 3000 + (1 - intensity) * 5000;

          source.connect(gain);
          wowLfo.connect(wowGain);
          wowGain.connect(tapeDel.delayTime);
          wowLfo.start();
          gain.connect(tapeDel);
          tapeDel.connect(tapeWs);
          tapeWs.connect(tapeLp);
          tapeLp.connect(analyser);
          analyser.connect(output);
          break;

        case 7: // Phantom Echo - long delays with pitch-shifted feedback
          var echo1 = ctx.createDelay(2.0);
          echo1.delayTime.value = 60 / bpm * 0.75;
          var echo2 = ctx.createDelay(2.0);
          echo2.delayTime.value = 60 / bpm * 0.5;
          var echoFb1 = ctx.createGain(); echoFb1.gain.value = 0.3 + intensity * 0.35;
          var echoFb2 = ctx.createGain(); echoFb2.gain.value = 0.2 + intensity * 0.3;
          var echoHp = ctx.createBiquadFilter();
          echoHp.type = 'highpass'; echoHp.frequency.value = 400 + intensity * 1500;
          var echoLp = ctx.createBiquadFilter();
          echoLp.type = 'lowpass'; echoLp.frequency.value = 2000 + (1 - intensity) * 4000;
          var dryE = ctx.createGain(); dryE.gain.value = 0.5;
          var wetE = ctx.createGain(); wetE.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(dryE);
          gain.connect(echo1); echo1.connect(echoFb1); echoFb1.connect(echoHp); echoHp.connect(echo1);
          gain.connect(echo2); echo2.connect(echoFb2); echoFb2.connect(echoLp); echoLp.connect(echo2);
          echo1.connect(wetE); echo2.connect(wetE);
          dryE.connect(analyser); wetE.connect(analyser);
          analyser.connect(output);
          break;

        case 8: // Rhythmic Gate - tempo-synced tremolo
          var gateLfo = ctx.createOscillator();
          gateLfo.type = 'square';
          gateLfo.frequency.value = bpm / 60 * 4; // sixteenth notes
          var gateGainNode = ctx.createGain();
          gateGainNode.gain.value = 0.5 + intensity * 0.5;

          source.connect(gain);
          gateLfo.connect(gateGainNode);
          gateGainNode.connect(gain.gain);
          gateLfo.start();
          gain.connect(analyser);
          analyser.connect(output);
          break;

        case 9: // Shimmer Delay - bright delays with high-pass
          var shimDel1 = ctx.createDelay(2.0);
          shimDel1.delayTime.value = 60 / bpm / 2;
          var shimDel2 = ctx.createDelay(2.0);
          shimDel2.delayTime.value = 60 / bpm;
          var shimFb1 = ctx.createGain(); shimFb1.gain.value = 0.25 + intensity * 0.35;
          var shimFb2 = ctx.createGain(); shimFb2.gain.value = 0.2 + intensity * 0.3;
          var shimHp = ctx.createBiquadFilter();
          shimHp.type = 'highpass'; shimHp.frequency.value = 1500 + intensity * 3000;
          shimHp.Q.value = 0.7;
          var shimDry = ctx.createGain(); shimDry.gain.value = 0.5;
          var shimWet = ctx.createGain(); shimWet.gain.value = 0.3 + intensity * 0.5;

          source.connect(gain);
          gain.connect(shimDry);
          gain.connect(shimDel1); shimDel1.connect(shimFb1); shimFb1.connect(shimHp); shimHp.connect(shimDel1);
          gain.connect(shimDel2); shimDel2.connect(shimFb2); shimFb2.connect(shimDel2);
          shimDel1.connect(shimWet); shimDel2.connect(shimWet);
          shimDry.connect(analyser); shimWet.connect(analyser);
          analyser.connect(output);
          break;

        case 10: // Harmonic Freeze - sustained resonant filter
          var freezeBp = ctx.createBiquadFilter();
          freezeBp.type = 'bandpass'; freezeBp.frequency.value = 600 + intensity * 2000;
          freezeBp.Q.value = 8 + intensity * 20;
          var freezeDel = ctx.createDelay(1.0);
          freezeDel.delayTime.value = 0.05 + intensity * 0.2;
          var freezeFb = ctx.createGain(); freezeFb.gain.value = 0.5 + intensity * 0.4;
          var freezeDry = ctx.createGain(); freezeDry.gain.value = 0.4;
          var freezeWet = ctx.createGain(); freezeWet.gain.value = 0.4 + intensity * 0.4;

          source.connect(gain);
          gain.connect(freezeDry);
          gain.connect(freezeBp);
          freezeBp.connect(freezeDel);
          freezeDel.connect(freezeFb);
          freezeFb.connect(freezeBp);
          freezeBp.connect(freezeWet);
          freezeDry.connect(analyser); freezeWet.connect(analyser);
          analyser.connect(output);
          break;

        case 11: // Sidechain Pump - rhythmic ducking
          var pumpLfo = ctx.createOscillator();
          pumpLfo.type = 'sawtooth';
          pumpLfo.frequency.value = bpm / 60;
          var pumpGainMod = ctx.createGain();
          pumpGainMod.gain.value = 0.3 + intensity * 0.5;
          var pumpComp = ctx.createDynamicsCompressor();
          pumpComp.threshold.value = -20 - intensity * 20;
          pumpComp.ratio.value = 4 + intensity * 12;
          pumpComp.attack.value = 0.003;
          pumpComp.release.value = 0.1 + (1 - intensity) * 0.3;

          source.connect(gain);
          gain.connect(pumpComp);
          pumpLfo.connect(pumpGainMod);
          pumpGainMod.connect(gain.gain);
          pumpLfo.start();
          pumpComp.connect(analyser);
          analyser.connect(output);
          break;

        case 12: // Flanger Wash - modulated short delay
          var flangeDel = ctx.createDelay(0.02);
          flangeDel.delayTime.value = 0.005;
          var flangeLfo = ctx.createOscillator();
          flangeLfo.type = 'sine';
          flangeLfo.frequency.value = 0.2 + intensity * 0.8;
          var flangeLfoGain = ctx.createGain();
          flangeLfoGain.gain.value = 0.002 + intensity * 0.003;
          var flangeFb = ctx.createGain();
          flangeFb.gain.value = 0.3 + intensity * 0.5;
          var flangeDry = ctx.createGain(); flangeDry.gain.value = 0.6;
          var flangeWet = ctx.createGain(); flangeWet.gain.value = 0.4 + intensity * 0.3;

          source.connect(gain);
          gain.connect(flangeDry);
          gain.connect(flangeDel);
          flangeLfo.connect(flangeLfoGain);
          flangeLfoGain.connect(flangeDel.delayTime);
          flangeLfo.start();
          flangeDel.connect(flangeFb);
          flangeFb.connect(flangeDel);
          flangeDel.connect(flangeWet);
          flangeDry.connect(analyser); flangeWet.connect(analyser);
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

        case 16: // Warm Chorus - multi-voice detuned delays
          var ch1 = ctx.createDelay(0.05);
          ch1.delayTime.value = 0.015;
          var ch2 = ctx.createDelay(0.05);
          ch2.delayTime.value = 0.025;
          var ch3 = ctx.createDelay(0.05);
          ch3.delayTime.value = 0.035;
          var chLfo1 = ctx.createOscillator(); chLfo1.type = 'sine'; chLfo1.frequency.value = 1.2;
          var chLfo2 = ctx.createOscillator(); chLfo2.type = 'sine'; chLfo2.frequency.value = 1.8;
          var chLfo3 = ctx.createOscillator(); chLfo3.type = 'sine'; chLfo3.frequency.value = 2.3;
          var chLfoG1 = ctx.createGain(); chLfoG1.gain.value = 0.001 + intensity * 0.002;
          var chLfoG2 = ctx.createGain(); chLfoG2.gain.value = 0.001 + intensity * 0.002;
          var chLfoG3 = ctx.createGain(); chLfoG3.gain.value = 0.001 + intensity * 0.002;
          var chWs = ctx.createWaveShaper();
          var chCurve = new Float32Array(256);
          for (var ci = 0; ci < 256; ci++) {
            var cx = (ci / 128) - 1;
            chCurve[ci] = Math.tanh(cx * (1 + intensity * 0.5));
          }
          chWs.curve = chCurve;
          var chDry = ctx.createGain(); chDry.gain.value = 0.5;
          var chWet = ctx.createGain(); chWet.gain.value = 0.3 + intensity * 0.3;

          source.connect(gain);
          gain.connect(chDry);
          gain.connect(ch1); gain.connect(ch2); gain.connect(ch3);
          chLfo1.connect(chLfoG1); chLfoG1.connect(ch1.delayTime);
          chLfo2.connect(chLfoG2); chLfoG2.connect(ch2.delayTime);
          chLfo3.connect(chLfoG3); chLfoG3.connect(ch3.delayTime);
          chLfo1.start(); chLfo2.start(); chLfo3.start();
          ch1.connect(chWs); ch2.connect(chWs); ch3.connect(chWs);
          chWs.connect(chWet);
          chDry.connect(analyser); chWet.connect(analyser);
          analyser.connect(output);
          break;

        default: // Passthrough with gentle reverb
          var defDel = ctx.createDelay(0.5);
          defDel.delayTime.value = 0.1;
          var defFb = ctx.createGain(); defFb.gain.value = 0.2;
          var defDry = ctx.createGain(); defDry.gain.value = 0.7;
          var defWet = ctx.createGain(); defWet.gain.value = 0.3;

          source.connect(gain);
          gain.connect(defDry);
          gain.connect(defDel);
          defDel.connect(defFb);
          defFb.connect(defDel);
          defDel.connect(defWet);
          defDry.connect(analyser); defWet.connect(analyser);
          analyser.connect(output);
          break;
      }

      return { gain: gain, output: output, analyser: analyser };
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
  volume,
  onLevelUpdate,
  onError,
}: MicPassthroughProps) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const outputGainRef = useRef<GainNode | null>(null);
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

  // Update volume
  useEffect(() => {
    if (outputGainRef.current) {
      outputGainRef.current.gain.value = (volume / 100) * (micSensitivity / 100);
    }
  }, [volume, micSensitivity]);

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
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const outputGain = ctx.createGain();
      outputGain.gain.value = (volume / 100) * (micSensitivity / 100);
      outputGainRef.current = outputGain;

      // Build the effect chain using eval of the shared JS
      const intensity = effectIntensity / 100;
      const buildFn = new Function("ctx", "source", "trackId", "bpm", "intensity", buildEffectChainJS() + "\nreturn buildEffectChain(ctx, source, trackId, bpm, intensity);");
      const chain = buildFn(ctx, source, trackId, bpm, intensity);
      chainRef.current = chain;

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
    analyserRef.current = null;
    chainRef.current = null;
  }

  return null; // No visual component needed
}

// ─── Native Implementation (WebView with Web Audio API) ─────────────────────

function NativeMicPassthrough({
  isActive,
  trackId,
  bpm,
  effectIntensity,
  micSensitivity,
  volume,
  onLevelUpdate,
  onError,
}: MicPassthroughProps) {
  const webViewRef = useRef<any>(null);
  const [WebViewComponent, setWebViewComponent] = useState<any>(null);
  const [isReady, setIsReady] = useState(false);

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

  const intensity = effectIntensity / 100;
  const vol = (volume / 100) * (micSensitivity / 100);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body { margin: 0; background: #000; }</style>
</head>
<body>
<script>
${buildEffectChainJS()}

var audioCtx = null;
var outputGain = null;
var analyser = null;
var stream = null;
var chain = null;
var running = false;
var meteringInterval = null;

async function startPassthrough(trackId, bpm, intensity, vol) {
  try {
    stopPassthrough();

    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    var source = audioCtx.createMediaStreamSource(stream);

    outputGain = audioCtx.createGain();
    outputGain.gain.value = vol;

    chain = buildEffectChain(audioCtx, source, trackId, bpm, intensity);
    chain.output.connect(outputGain);
    outputGain.connect(audioCtx.destination);

    analyser = chain.analyser;
    running = true;

    // Send level data to React Native at ~20fps
    var dataArray = new Uint8Array(analyser.frequencyBinCount);
    meteringInterval = setInterval(function() {
      if (!running || !analyser) return;
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
  } catch (e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: e.message || 'Mic access failed' }));
  }
}

function stopPassthrough() {
  running = false;
  if (meteringInterval) { clearInterval(meteringInterval); meteringInterval = null; }
  if (stream) { stream.getTracks().forEach(function(t) { t.stop(); }); stream = null; }
  if (audioCtx) { audioCtx.close().catch(function(){}); audioCtx = null; }
  outputGain = null;
  analyser = null;
  chain = null;
}

function setVolume(vol) {
  if (outputGain) outputGain.gain.value = vol;
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
          // Mic passthrough started successfully
          break;
        case "level":
          onLevelUpdate?.(data.level);
          break;
        case "error":
          onError?.(data.message);
          break;
      }
    } catch (e) {
      // ignore
    }
  }, [onLevelUpdate, onError]);

  // Start/stop passthrough
  useEffect(() => {
    if (!webViewRef.current || !isReady) return;

    if (isActive) {
      const js = `startPassthrough(${trackId}, ${bpm}, ${intensity}, ${vol}); true;`;
      webViewRef.current.injectJavaScript(js);
    } else {
      webViewRef.current.injectJavaScript("stopPassthrough(); true;");
    }
  }, [isActive, isReady, trackId, bpm, intensity, vol]);

  // Update volume dynamically
  useEffect(() => {
    if (!webViewRef.current || !isReady || !isActive) return;
    webViewRef.current.injectJavaScript(`setVolume(${vol}); true;`);
  }, [vol, isReady, isActive]);

  if (!WebViewComponent) return null;

  const WV = WebViewComponent;

  return (
    <View style={styles.nativeContainer}>
      <WV
        ref={webViewRef}
        source={{ html: htmlContent }}
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
        onPermissionRequest={(event: any) => {
          // Grant microphone permission to the WebView on Android
          if (event?.nativeEvent?.resources) {
            event.nativeEvent.grant(event.nativeEvent.resources);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nativeContainer: {
    width: 1,
    height: 1,
    overflow: "hidden",
    position: "absolute",
    top: -9999,
    left: -9999,
    opacity: 0.01,
    zIndex: -1,
  },
  webview: {
    width: 1,
    height: 1,
    backgroundColor: "transparent",
  },
});
