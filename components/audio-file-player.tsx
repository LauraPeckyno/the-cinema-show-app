import React, { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { Track } from "@/constants/tracks";
import { getCachedUri } from "@/lib/audio-cache";

interface AudioFilePlayerProps {
  track: Track;
  isPlaying: boolean;
  volume: number; // 0-100
  onPlay?: () => void;
  onPause?: () => void;
  onProgress?: (progress: number, time: number) => void;
  onReady?: () => void;
  onFinish?: () => void;
  onDuration?: (durationMs: number) => void;
}

/**
 * Cross-platform audio file player using HTML5 Audio on web
 * and expo-audio on native platforms.
 * Replaces the SoundCloud widget-based player with direct file streaming.
 */
export function AudioFilePlayer({
  track,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onProgress,
  onReady,
  onFinish,
  onDuration,
}: AudioFilePlayerProps) {
  if (Platform.OS === "web") {
    return (
      <WebAudioFilePlayer
        track={track}
        isPlaying={isPlaying}
        volume={volume}
        onPlay={onPlay}
        onPause={onPause}
        onProgress={onProgress}
        onReady={onReady}
        onFinish={onFinish}
        onDuration={onDuration}
      />
    );
  }

  return (
    <NativeAudioFilePlayer
      track={track}
      isPlaying={isPlaying}
      volume={volume}
      onPlay={onPlay}
      onPause={onPause}
      onProgress={onProgress}
      onReady={onReady}
      onFinish={onFinish}
      onDuration={onDuration}
    />
  );
}

// ─── Web Implementation (HTML5 Audio) ──────────────────────────────────────

function WebAudioFilePlayer({
  track,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onProgress,
  onReady,
  onFinish,
  onDuration,
}: AudioFilePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackUrlRef = useRef<string>("");
  const isReadyRef = useRef(false);

  // Create or replace audio element when track changes
  useEffect(() => {
    const url = getCachedUri(track.audioUrl);
    if (trackUrlRef.current === url && audioRef.current) return;
    trackUrlRef.current = url;
    isReadyRef.current = false;

    // Clean up previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current.load();
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    const audio = new Audio(url);
    audio.preload = "auto";
    // Don't set crossOrigin for same-origin proxy or blob URLs
    if (url.startsWith("http") && !url.startsWith(window.location.origin)) {
      audio.crossOrigin = "anonymous";
    }
    audioRef.current = audio;

    // Use loadedmetadata for readiness (fires much sooner than canplaythrough for large files)
    audio.addEventListener("loadedmetadata", () => {
      if (audio.duration && isFinite(audio.duration)) {
        onDuration?.(audio.duration * 1000);
      }
      if (!isReadyRef.current) {
        isReadyRef.current = true;
        onReady?.();
      }
    });

    // Also mark ready on canplay as a fallback
    audio.addEventListener("canplay", () => {
      if (!isReadyRef.current) {
        isReadyRef.current = true;
        if (audio.duration && isFinite(audio.duration)) {
          onDuration?.(audio.duration * 1000);
        }
        onReady?.();
      }
    });

    audio.addEventListener("play", () => {
      onPlay?.();
    });

    audio.addEventListener("pause", () => {
      // Only fire onPause if not ended (ended fires onFinish)
      if (!audio.ended) {
        onPause?.();
      }
    });

    audio.addEventListener("ended", () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      onFinish?.();
    });

    audio.addEventListener("error", (e) => {
      console.error("Audio load error:", e);
    });

    // Set initial volume
    audio.volume = Math.max(0, Math.min(1, volume / 100));

    return () => {
      audio.pause();
      audio.src = "";
      audio.load();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [track.audioUrl]);

  // Play/pause control
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !isReadyRef.current) return;

    if (isPlaying) {
      audio.play().catch((e) => {
        console.warn("Audio play failed:", e);
      });
      // Start progress reporting
      if (!progressIntervalRef.current) {
        progressIntervalRef.current = setInterval(() => {
          if (audio.duration && isFinite(audio.duration) && !audio.paused) {
            const progress = audio.currentTime / audio.duration;
            onProgress?.(progress, audio.currentTime);
          }
        }, 250);
      }
    } else {
      audio.pause();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [isPlaying]);

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }, [volume]);

  // No visible UI needed
  return null;
}

// ─── Native Implementation (expo-audio) ────────────────────────────────────

function NativeAudioFilePlayer({
  track,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onProgress,
  onReady,
  onFinish,
  onDuration,
}: AudioFilePlayerProps) {
  const playerRef = useRef<any>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const trackUrlRef = useRef<string>("");
  const isReadyRef = useRef(false);
  const hasFinishedRef = useRef(false);
  const listenerSubRef = useRef<any>(null);

  // Create player when track changes
  useEffect(() => {
    const url = getCachedUri(track.audioUrl);
    if (trackUrlRef.current === url && playerRef.current) return;
    trackUrlRef.current = url;
    isReadyRef.current = false;
    hasFinishedRef.current = false;

    // Clean up previous player
    if (listenerSubRef.current) {
      try { listenerSubRef.current.remove(); } catch {}
      listenerSubRef.current = null;
    }
    if (playerRef.current) {
      try { playerRef.current.remove(); } catch {}
      playerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    let mounted = true;

    (async () => {
      try {
        const { createAudioPlayer, setAudioModeAsync } = await import("expo-audio");

        // Ensure audio plays in silent mode
        await setAudioModeAsync({ playsInSilentMode: true });

        const player = createAudioPlayer({ uri: url });
        if (!mounted) {
          player.remove();
          return;
        }
        playerRef.current = player;

        // Set volume
        player.volume = Math.max(0, Math.min(1, volume / 100));

        // Listen for playback status updates
        const sub = player.addListener("playbackStatusUpdate", (status: any) => {
          if (!mounted) return;

          // Detect when player is ready (has duration)
          if (!isReadyRef.current && status.isLoaded && status.duration > 0) {
            isReadyRef.current = true;
            onDuration?.(status.duration * 1000);
            onReady?.();
          }

          // Detect playback finished
          if (status.didJustFinish && !hasFinishedRef.current) {
            hasFinishedRef.current = true;
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
            onFinish?.();
          }
        });
        listenerSubRef.current = sub;
      } catch (e) {
        console.error("Failed to create audio player:", e);
      }
    })();

    return () => {
      mounted = false;
      if (listenerSubRef.current) {
        try { listenerSubRef.current.remove(); } catch {}
        listenerSubRef.current = null;
      }
      if (playerRef.current) {
        try { playerRef.current.remove(); } catch {}
        playerRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [track.audioUrl]);

  // Play/pause control
  useEffect(() => {
    const player = playerRef.current;
    if (!player || !isReadyRef.current) return;

    if (isPlaying) {
      hasFinishedRef.current = false;
      player.play();
      onPlay?.();
      // Start progress reporting
      if (!progressIntervalRef.current) {
        progressIntervalRef.current = setInterval(() => {
          if (player && isReadyRef.current) {
            const currentTime = player.currentTime || 0;
            const duration = player.duration || 0;
            if (duration > 0) {
              const progress = currentTime / duration;
              onProgress?.(progress, currentTime);
            }
          }
        }, 250);
      }
    } else {
      player.pause();
      onPause?.();
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    }
  }, [isPlaying]);

  // Volume control
  useEffect(() => {
    if (playerRef.current) {
      playerRef.current.volume = Math.max(0, Math.min(1, volume / 100));
    }
  }, [volume]);

  // No visible UI needed
  return null;
}
