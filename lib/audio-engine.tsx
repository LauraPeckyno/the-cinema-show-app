import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import { Platform } from "react-native";
import { Track } from "@/constants/tracks";

// ─── State ───────────────────────────────────────────────────────────────────

export interface AudioEngineState {
  currentTrack: Track | null;
  isPlaying: boolean;
  isMicActive: boolean;
  micPermissionGranted: boolean;
  micSensitivity: number; // 0-100
  effectIntensity: number; // 0-100
  volume: number; // 0-100
  micLevel: number; // 0-1 raw mic level
  processedMicLevel: number; // 0-1 after effect processing
  playbackProgress: number; // 0-1
  playbackTime: number; // seconds
  trackDuration: number; // actual duration in seconds from SoundCloud (0 = not yet fetched)
  isLoading: boolean;
  error: string | null;
}

const initialState: AudioEngineState = {
  currentTrack: null,
  isPlaying: false,
  isMicActive: false,
  micPermissionGranted: false,
  micSensitivity: 70,
  effectIntensity: 50,
  volume: 80,
  micLevel: 0,
  processedMicLevel: 0,
  playbackProgress: 0,
  playbackTime: 0,
  trackDuration: 0,
  isLoading: false,
  error: null,
};

// ─── Actions ─────────────────────────────────────────────────────────────────

type AudioAction =
  | { type: "SET_TRACK"; track: Track | null }
  | { type: "SET_PLAYING"; playing: boolean }
  | { type: "SET_MIC_ACTIVE"; active: boolean }
  | { type: "SET_MIC_PERMISSION"; granted: boolean }
  | { type: "SET_MIC_SENSITIVITY"; value: number }
  | { type: "SET_EFFECT_INTENSITY"; value: number }
  | { type: "SET_VOLUME"; value: number }
  | { type: "SET_MIC_LEVEL"; level: number; processedLevel: number }
  | { type: "SET_PLAYBACK_PROGRESS"; progress: number; time: number }
  | { type: "SET_TRACK_DURATION"; duration: number }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };

function audioReducer(state: AudioEngineState, action: AudioAction): AudioEngineState {
  switch (action.type) {
    case "SET_TRACK":
      return { ...state, currentTrack: action.track, playbackProgress: 0, playbackTime: 0, trackDuration: 0, isPlaying: false, isLoading: !!action.track };
    case "SET_PLAYING":
      return { ...state, isPlaying: action.playing };
    case "SET_MIC_ACTIVE":
      return { ...state, isMicActive: action.active };
    case "SET_MIC_PERMISSION":
      return { ...state, micPermissionGranted: action.granted };
    case "SET_MIC_SENSITIVITY":
      return { ...state, micSensitivity: action.value };
    case "SET_EFFECT_INTENSITY":
      return { ...state, effectIntensity: action.value };
    case "SET_VOLUME":
      return { ...state, volume: action.value };
    case "SET_MIC_LEVEL":
      return { ...state, micLevel: action.level, processedMicLevel: action.processedLevel };
    case "SET_PLAYBACK_PROGRESS":
      return { ...state, playbackProgress: action.progress, playbackTime: action.time };
    case "SET_TRACK_DURATION":
      return { ...state, trackDuration: action.duration };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "SET_ERROR":
      return { ...state, error: action.error };
    default:
      return state;
  }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface AudioEngineContextType {
  state: AudioEngineState;
  selectTrack: (track: Track) => void;
  togglePlayback: () => void;
  toggleMic: () => void;
  requestMicPermission: () => Promise<boolean>;
  setMicSensitivity: (value: number) => void;
  setEffectIntensity: (value: number) => void;
  setVolume: (value: number) => void;
  updatePlaybackProgress: (progress: number, time: number) => void;
  setTrackDuration: (durationMs: number) => void;
  setPlaying: (playing: boolean) => void;
  setLoading: (loading: boolean) => void;
  updateMicLevel: (level: number, processedLevel: number) => void;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

export function AudioEngineProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(audioReducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const requestMicPermission = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        dispatch({ type: "SET_MIC_PERMISSION", granted: true });
        return true;
      }
      // On native, request permission through expo-audio
      const ExpoAudio = await import("expo-audio");
      const status = await ExpoAudio.requestRecordingPermissionsAsync();
      dispatch({ type: "SET_MIC_PERMISSION", granted: status.granted });
      return status.granted;
    } catch (e) {
      dispatch({ type: "SET_ERROR", error: "Failed to request microphone permission" });
      return false;
    }
  }, []);

  const selectTrack = useCallback((track: Track) => {
    dispatch({ type: "SET_TRACK", track });
  }, []);

  const togglePlayback = useCallback(() => {
    dispatch({ type: "SET_PLAYING", playing: !stateRef.current.isPlaying });
  }, []);

  const toggleMic = useCallback(async () => {
    const currentState = stateRef.current;

    if (currentState.isMicActive) {
      // Stop mic — the MicPassthrough component will react to isMicActive=false
      dispatch({ type: "SET_MIC_ACTIVE", active: false });
      dispatch({ type: "SET_MIC_LEVEL", level: 0, processedLevel: 0 });
      return;
    }

    // Request mic permission first
    try {
      if (Platform.OS === "web") {
        // On web, the MicPassthrough will request getUserMedia directly
        dispatch({ type: "SET_MIC_ACTIVE", active: true });
        dispatch({ type: "SET_MIC_PERMISSION", granted: true });
      } else {
        // On native, request permission through expo-audio first
        const ExpoAudio = await import("expo-audio");
        const status = await ExpoAudio.requestRecordingPermissionsAsync();
        if (status.granted) {
          dispatch({ type: "SET_MIC_PERMISSION", granted: true });
          dispatch({ type: "SET_MIC_ACTIVE", active: true });
        } else {
          dispatch({ type: "SET_ERROR", error: "Microphone permission denied" });
        }
      }
    } catch (e: any) {
      dispatch({ type: "SET_ERROR", error: e?.message || "Failed to request mic permission" });
    }
  }, []);

  const setMicSensitivity = useCallback((value: number) => {
    dispatch({ type: "SET_MIC_SENSITIVITY", value });
  }, []);

  const setEffectIntensity = useCallback((value: number) => {
    dispatch({ type: "SET_EFFECT_INTENSITY", value });
  }, []);

  const setVolume = useCallback((value: number) => {
    dispatch({ type: "SET_VOLUME", value });
  }, []);

  const updatePlaybackProgress = useCallback((progress: number, time: number) => {
    dispatch({ type: "SET_PLAYBACK_PROGRESS", progress, time });
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    dispatch({ type: "SET_PLAYING", playing });
  }, []);

  const setTrackDuration = useCallback((durationMs: number) => {
    // Convert from milliseconds to seconds
    dispatch({ type: "SET_TRACK_DURATION", duration: durationMs / 1000 });
  }, []);

  const setLoading = useCallback((loading: boolean) => {
    dispatch({ type: "SET_LOADING", loading });
  }, []);

  const updateMicLevel = useCallback((level: number, processedLevel: number) => {
    dispatch({ type: "SET_MIC_LEVEL", level, processedLevel });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // MicPassthrough component handles its own cleanup
    };
  }, []);

  return (
    <AudioEngineContext.Provider
      value={{
        state,
        selectTrack,
        togglePlayback,
        toggleMic,
        requestMicPermission,
        setMicSensitivity,
        setEffectIntensity,
        setVolume,
        updatePlaybackProgress,
        setTrackDuration,
        setPlaying,
        setLoading,
        updateMicLevel,
      }}
    >
      {children}
    </AudioEngineContext.Provider>
  );
}

export function useAudioEngine() {
  const ctx = useContext(AudioEngineContext);
  if (!ctx) throw new Error("useAudioEngine must be used within AudioEngineProvider");
  return ctx;
}
