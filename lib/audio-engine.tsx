import React, { createContext, useContext, useReducer, useCallback, useRef, useEffect } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Track } from "@/constants/tracks";

// ─── State ───────────────────────────────────────────────────────────────────

export interface AudioEngineState {
  currentTrack: Track | null;
  isPlaying: boolean;
  isMicActive: boolean;
  micPermissionGranted: boolean;
  micSensitivity: number; // 0-100
  effectIntensity: number; // 0-100
  masterVolume: number; // 0-100 — controls overall output (both music + mic)
  musicVolume: number; // 0-100 — controls SoundCloud track volume
  dryWetMix: number; // 0-100 — 0=fully dry (raw ambient), 100=fully wet (effected)
  trackDryWetMap: Record<number, number>; // per-track dry/wet values, keyed by track ID
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
  masterVolume: 80,
  musicVolume: 70,
  dryWetMix: 50, // default 50/50 mix
  trackDryWetMap: {},
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
  | { type: "SET_MASTER_VOLUME"; value: number }
  | { type: "SET_MUSIC_VOLUME"; value: number }
  | { type: "SET_DRY_WET_MIX"; value: number; trackId?: number }
  | { type: "LOAD_TRACK_DRY_WET_MAP"; map: Record<number, number> }
  | { type: "SET_MIC_LEVEL"; level: number; processedLevel: number }
  | { type: "SET_PLAYBACK_PROGRESS"; progress: number; time: number }
  | { type: "SET_TRACK_DURATION"; duration: number }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "SET_ERROR"; error: string | null };

function audioReducer(state: AudioEngineState, action: AudioAction): AudioEngineState {
  switch (action.type) {
    case "SET_TRACK": {
      const trackId = action.track?.id;
      // When switching tracks, load the per-track dry/wet value if available
      const savedDryWet = trackId != null && state.trackDryWetMap[trackId] != null
        ? state.trackDryWetMap[trackId]
        : 50; // default 50/50
      return {
        ...state,
        currentTrack: action.track,
        playbackProgress: 0,
        playbackTime: 0,
        trackDuration: 0,
        isPlaying: false,
        isLoading: !!action.track,
        dryWetMix: savedDryWet,
      };
    }
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
    case "SET_MASTER_VOLUME":
      return { ...state, masterVolume: action.value };
    case "SET_MUSIC_VOLUME":
      return { ...state, musicVolume: action.value };
    case "SET_DRY_WET_MIX": {
      const newMap = action.trackId != null
        ? { ...state.trackDryWetMap, [action.trackId]: action.value }
        : state.trackDryWetMap;
      return { ...state, dryWetMix: action.value, trackDryWetMap: newMap };
    }
    case "LOAD_TRACK_DRY_WET_MAP":
      return { ...state, trackDryWetMap: action.map };
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

// ─── Persistence Keys ───────────────────────────────────────────────────────

const STORAGE_KEY_DRY_WET = "@cinema_show_dry_wet_map";
const STORAGE_KEY_MASTER_VOL = "@cinema_show_master_vol";
const STORAGE_KEY_MUSIC_VOL = "@cinema_show_music_vol";

// ─── Context ─────────────────────────────────────────────────────────────────

interface AudioEngineContextType {
  state: AudioEngineState;
  selectTrack: (track: Track) => void;
  togglePlayback: () => void;
  toggleMic: () => void;
  requestMicPermission: () => Promise<boolean>;
  setMicSensitivity: (value: number) => void;
  setEffectIntensity: (value: number) => void;
  setMasterVolume: (value: number) => void;
  setMusicVolume: (value: number) => void;
  setDryWetMix: (value: number) => void;
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

  // Load persisted settings on mount
  useEffect(() => {
    (async () => {
      try {
        const [dryWetRaw, masterRaw, musicRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_DRY_WET),
          AsyncStorage.getItem(STORAGE_KEY_MASTER_VOL),
          AsyncStorage.getItem(STORAGE_KEY_MUSIC_VOL),
        ]);
        if (dryWetRaw) {
          const map = JSON.parse(dryWetRaw);
          dispatch({ type: "LOAD_TRACK_DRY_WET_MAP", map });
        }
        if (masterRaw) {
          dispatch({ type: "SET_MASTER_VOLUME", value: Number(masterRaw) });
        }
        if (musicRaw) {
          dispatch({ type: "SET_MUSIC_VOLUME", value: Number(musicRaw) });
        }
      } catch {
        // ignore storage errors
      }
    })();
  }, []);

  const requestMicPermission = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        dispatch({ type: "SET_MIC_PERMISSION", granted: true });
        return true;
      }
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
      dispatch({ type: "SET_MIC_ACTIVE", active: false });
      dispatch({ type: "SET_MIC_LEVEL", level: 0, processedLevel: 0 });
      return;
    }

    try {
      if (Platform.OS === "web") {
        dispatch({ type: "SET_MIC_ACTIVE", active: true });
        dispatch({ type: "SET_MIC_PERMISSION", granted: true });
      } else {
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

  const setMasterVolume = useCallback((value: number) => {
    dispatch({ type: "SET_MASTER_VOLUME", value });
    AsyncStorage.setItem(STORAGE_KEY_MASTER_VOL, String(value)).catch(() => {});
  }, []);

  const setMusicVolume = useCallback((value: number) => {
    dispatch({ type: "SET_MUSIC_VOLUME", value });
    AsyncStorage.setItem(STORAGE_KEY_MUSIC_VOL, String(value)).catch(() => {});
  }, []);

  const setDryWetMix = useCallback((value: number) => {
    const trackId = stateRef.current.currentTrack?.id;
    dispatch({ type: "SET_DRY_WET_MIX", value, trackId });
    // Persist the updated map
    if (trackId != null) {
      const updatedMap = { ...stateRef.current.trackDryWetMap, [trackId]: value };
      AsyncStorage.setItem(STORAGE_KEY_DRY_WET, JSON.stringify(updatedMap)).catch(() => {});
    }
  }, []);

  const updatePlaybackProgress = useCallback((progress: number, time: number) => {
    dispatch({ type: "SET_PLAYBACK_PROGRESS", progress, time });
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    dispatch({ type: "SET_PLAYING", playing });
  }, []);

  const setTrackDuration = useCallback((durationMs: number) => {
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
        setMasterVolume,
        setMusicVolume,
        setDryWetMix,
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
