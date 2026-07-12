import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "track_durations_v2";

/**
 * Map of trackId -> duration in seconds.
 * Populated when audio player reports actual durations.
 * Persisted to AsyncStorage so durations are available on subsequent launches.
 */
type DurationMap = Record<number, number>;

// ─── Global in-memory store ────────────────────────────────────────────────

let _durations: DurationMap = {};
let _loaded = false;
type Listener = () => void;
const _listeners = new Set<Listener>();

function notify() {
  _listeners.forEach((fn) => fn());
}

async function loadCache() {
  if (_loaded) return;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DurationMap;
      // Merge: keep any already-reported values (they are fresher)
      _durations = { ...parsed, ..._durations };
    }
  } catch {
    // ignore
  }
  _loaded = true;
  notify();
}

async function persistCache() {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(_durations));
  } catch {
    // ignore
  }
}

/**
 * Call this when the audio player reports a track's duration.
 * @param trackId  The track ID
 * @param durationMs  Duration in **milliseconds**
 */
export function reportTrackDuration(trackId: number, durationMs: number) {
  const sec = durationMs / 1000;
  if (sec > 0 && sec !== _durations[trackId]) {
    _durations[trackId] = sec;
    notify();
    persistCache();
  }
}

/**
 * React hook that subscribes to the global duration store.
 * Returns the current map and a formatting helper.
 */
export function useTrackDurations() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    // Load cache on first mount
    loadCache();

    const listener: Listener = () => forceUpdate((n) => n + 1);
    _listeners.add(listener);
    return () => {
      _listeners.delete(listener);
    };
  }, []);

  const formatDuration = useCallback((trackId: number): string => {
    const sec = _durations[trackId];
    if (!sec || sec <= 0) return "";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  }, []);

  const getDuration = useCallback((trackId: number): number => {
    return _durations[trackId] || 0;
  }, []);

  return { durations: _durations, formatDuration, getDuration };
}
