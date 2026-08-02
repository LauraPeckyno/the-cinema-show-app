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
  micSensitivity: number; // fixed at 100 (max gain, +15dB)
  effectIntensity: number; // fixed at 100 (full effect processing)
  masterVolume: number; // fixed at 100 — overall output controlled by device volume
  musicVolume: number; // fixed at 90 — music at 90% of device volume
  dryWetMix: number; // fixed at 100 — fully wet (effected mic output)
  trackDryWetMap: Record<number, number>; // per-track dry/wet values, keyed by track ID
  micLevel: number; // 0-1 raw mic level
  processedMicLevel: number; // 0-1 after effect processing
  playbackProgress: number; // 0-1
  playbackTime: number; // seconds
  trackDuration: number; // actual duration in seconds (0 = not yet fetched)
  isLoading: boolean;
  error: string | null;
  // Album queue / auto-advance state
  albumQueue: Track[]; // ordered list of tracks for continuous playback
  albumQueueIndex: number; // current position in the queue (-1 = not in album mode)
  isAlbumMode: boolean; // true when "Start the Show" is active
}

const initialState: AudioEngineState = {
  currentTrack: null,
  isPlaying: false,
  isMicActive: false,
  micPermissionGranted: false,
  micSensitivity: 100, // max gain (+15dB) — captures slightest touch
  effectIntensity: 100, // full effect processing
  masterVolume: 100, // device volume controls overall output
  musicVolume: 90, // music at 90% of device volume
  dryWetMix: 100, // fully wet — effected mic output only
  trackDryWetMap: {},
  micLevel: 0,
  processedMicLevel: 0,
  playbackProgress: 0,
  playbackTime: 0,
  trackDuration: 0,
  isLoading: false,
  error: null,
  albumQueue: [],
  albumQueueIndex: -1,
  isAlbumMode: false,
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
  | { type: "SET_ERROR"; error: string | null }
  | { type: "SET_ALBUM_QUEUE"; queue: Track[]; startIndex: number }
  | { type: "ADVANCE_ALBUM_QUEUE" }
  | { type: "CLEAR_ALBUM_QUEUE" }
  | { type: "STOP_PLAYBACK" };

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
    // Album queue actions
    case "SET_ALBUM_QUEUE": {
      const track = action.queue[action.startIndex];
      const trackId = track?.id;
      const savedDryWet = trackId != null && state.trackDryWetMap[trackId] != null
        ? state.trackDryWetMap[trackId]
        : 50;
      return {
        ...state,
        albumQueue: action.queue,
        albumQueueIndex: action.startIndex,
        isAlbumMode: true,
        currentTrack: track || null,
        playbackProgress: 0,
        playbackTime: 0,
        trackDuration: 0,
        isPlaying: false,
        isLoading: !!track,
        dryWetMix: savedDryWet,
      };
    }
    case "ADVANCE_ALBUM_QUEUE": {
      const nextIndex = state.albumQueueIndex + 1;
      if (nextIndex >= state.albumQueue.length) {
        // Queue exhausted — end album mode
        return {
          ...state,
          isAlbumMode: false,
          albumQueue: [],
          albumQueueIndex: -1,
          isPlaying: false,
          playbackProgress: 0,
          playbackTime: 0,
        };
      }
      const nextTrack = state.albumQueue[nextIndex];
      const trackId = nextTrack?.id;
      const savedDryWet = trackId != null && state.trackDryWetMap[trackId] != null
        ? state.trackDryWetMap[trackId]
        : 50;
      return {
        ...state,
        albumQueueIndex: nextIndex,
        currentTrack: nextTrack,
        playbackProgress: 0,
        playbackTime: 0,
        trackDuration: 0,
        isPlaying: false,
        isLoading: true,
        dryWetMix: savedDryWet,
      };
    }
    case "CLEAR_ALBUM_QUEUE":
      return {
        ...state,
        isAlbumMode: false,
        albumQueue: [],
        albumQueueIndex: -1,
      };
    case "STOP_PLAYBACK":
      return {
        ...state,
        isPlaying: false,
        isMicActive: false,
        isAlbumMode: false,
        albumQueue: [],
        albumQueueIndex: -1,
        playbackProgress: 0,
        playbackTime: 0,
        micLevel: 0,
        processedMicLevel: 0,
        currentTrack: null,
      };
    default:
      return state;
  }
}

// ─── Persistence Keys ───────────────────────────────────────────────────────

const STORAGE_KEY_DRY_WET = "@cinema_show_dry_wet_map";

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
  // Album queue helpers
  startAlbumPlayback: (tracks: Track[]) => void;
  advanceToNextTrack: () => boolean; // returns true if advanced, false if queue exhausted
  clearAlbumQueue: () => void;
  stopPlayback: () => void;
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
        const dryWetRaw = await AsyncStorage.getItem(STORAGE_KEY_DRY_WET);
        if (dryWetRaw) {
          const map = JSON.parse(dryWetRaw);
          dispatch({ type: "LOAD_TRACK_DRY_WET_MAP", map });
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
    // Selecting a single track clears album mode
    dispatch({ type: "CLEAR_ALBUM_QUEUE" });
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
  }, []);

  const setMusicVolume = useCallback((value: number) => {
    dispatch({ type: "SET_MUSIC_VOLUME", value });
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

  // Album queue helpers
  const startAlbumPlayback = useCallback((tracks: Track[]) => {
    dispatch({ type: "SET_ALBUM_QUEUE", queue: tracks, startIndex: 0 });
  }, []);

  const advanceToNextTrack = useCallback((): boolean => {
    const { albumQueueIndex, albumQueue } = stateRef.current;
    const nextIndex = albumQueueIndex + 1;
    if (nextIndex >= albumQueue.length) {
      dispatch({ type: "ADVANCE_ALBUM_QUEUE" }); // will clear album mode
      return false;
    }
    dispatch({ type: "ADVANCE_ALBUM_QUEUE" });
    return true;
  }, []);

  const clearAlbumQueue = useCallback(() => {
    dispatch({ type: "CLEAR_ALBUM_QUEUE" });
  }, []);

  const stopPlayback = useCallback(() => {
    dispatch({ type: "STOP_PLAYBACK" });
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
        startAlbumPlayback,
        advanceToNextTrack,
        clearAlbumQueue,
        stopPlayback,
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
