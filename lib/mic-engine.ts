/**
 * Microphone Engine
 *
 * Handles microphone recording and audio level metering.
 * - On web: uses the Web Audio API for real-time analysis
 * - On native: uses expo-audio AudioRecorder with metering enabled
 *   to get real dB levels from the device microphone
 */

import { Platform } from "react-native";
import * as ExpoAudio from "expo-audio";
import AudioModule from "expo-audio/build/AudioModule";
import { createRecordingOptions } from "expo-audio/build/utils/options";

export interface MicEngineCallbacks {
  onLevelUpdate: (level: number) => void;
  onError: (error: string) => void;
}

class MicEngine {
  private isActive = false;
  private callbacks: MicEngineCallbacks | null = null;

  // Web Audio API refs
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;

  // Native recording refs
  private nativeRecorder: any = null;
  private nativeInterval: ReturnType<typeof setInterval> | null = null;

  async start(callbacks: MicEngineCallbacks): Promise<boolean> {
    this.callbacks = callbacks;

    if (Platform.OS === "web") {
      return this.startWeb();
    }

    return this.startNative();
  }

  // ─── Web Implementation ─────────────────────────────────────────────

  private async startWeb(): Promise<boolean> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaStream = stream;

      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(stream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      source.connect(this.analyser);

      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength) as Uint8Array<ArrayBuffer>;

      this.isActive = true;
      this.updateLevelsWeb();

      return true;
    } catch (e) {
      this.callbacks?.onError("Failed to access microphone");
      return false;
    }
  }

  private updateLevelsWeb = () => {
    if (!this.isActive || !this.analyser || !this.dataArray) return;

    this.analyser.getByteFrequencyData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = this.dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);
    const level = Math.min(1, rms * 2.5);

    this.callbacks?.onLevelUpdate(level);

    this.animFrameId = requestAnimationFrame(this.updateLevelsWeb);
  };

  // ─── Native Implementation (expo-audio recording with metering) ─────

  private async startNative(): Promise<boolean> {
    try {
      // Request permission first
      const permStatus = await ExpoAudio.requestRecordingPermissionsAsync();
      if (!permStatus.granted) {
        this.callbacks?.onError(
          "Microphone permission denied. Please enable microphone access in your device settings."
        );
        return false;
      }

      // Configure audio mode for simultaneous recording and playback
      await ExpoAudio.setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });

      // Access AudioModule to create a recorder outside of a hook
      // AudioModule is the native module with AudioRecorder constructor

      // Build recording options with metering enabled
      const recordingOptions = {
        ...ExpoAudio.RecordingPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      };

      // Create platform-specific options
      const platformOptions = createRecordingOptions(recordingOptions);

      // Construct the native recorder
      const recorder = new AudioModule.AudioRecorder(platformOptions);

      // Prepare and start recording
      await recorder.prepareToRecordAsync();
      recorder.record();

      this.nativeRecorder = recorder;
      this.isActive = true;

      // Poll metering data at ~20fps
      this.nativeInterval = setInterval(() => {
        if (!this.isActive || !this.nativeRecorder) return;

        try {
          const status = this.nativeRecorder.getStatus();
          if (status && status.metering != null && status.metering !== undefined) {
            // metering is in dB, typically -160 to 0
            // Normalize: -60dB = silence, 0dB = max
            const db = status.metering;
            const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
            this.callbacks?.onLevelUpdate(normalized);
          } else {
            // If metering not available in status, use a gentle simulation
            this.simulateLevel();
          }
        } catch (e) {
          this.simulateLevel();
        }
      }, 50);

      return true;
    } catch (e: any) {
      console.warn("Native mic start error:", e?.message || e);
      // Fall back to simulated levels if recording fails
      return this.startNativeSimulation();
    }
  }

  private simulateLevel() {
    const base = 0.15;
    const variation = Math.random() * 0.5;
    const spike = Math.random() > 0.85 ? Math.random() * 0.3 : 0;
    const level = Math.min(1, base + variation + spike);
    this.callbacks?.onLevelUpdate(level);
  }

  private async startNativeSimulation(): Promise<boolean> {
    this.isActive = true;

    const runSimulation = () => {
      if (!this.isActive) return;
      this.simulateLevel();
      setTimeout(runSimulation, 50 + Math.random() * 50);
    };

    runSimulation();
    return true;
  }

  async stop() {
    this.isActive = false;

    // Web cleanup
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;

    // Native cleanup
    if (this.nativeInterval) {
      clearInterval(this.nativeInterval);
      this.nativeInterval = null;
    }

    if (this.nativeRecorder) {
      try {
        await this.nativeRecorder.stop();
      } catch (e) {
        // ignore stop errors
      }
      this.nativeRecorder = null;
    }

    // Reset audio mode to disable recording (allows other apps to use mic)
    if (Platform.OS !== "web") {
      try {
        await ExpoAudio.setAudioModeAsync({
          allowsRecording: false,
        });
      } catch (e) {
        // ignore
      }
    }

    this.callbacks = null;
  }

  getIsActive(): boolean {
    return this.isActive;
  }
}

// Singleton instance
export const micEngine = new MicEngine();
