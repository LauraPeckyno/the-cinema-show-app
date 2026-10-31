import { useEffect } from "react";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

interface BackgroundMusicProps {
  source: string;
  volume: number;
  muted?: boolean;
  stopped: boolean;
  restartKey: number;
  onStopReady?: (stop: (() => void) | null) => void;
}

/**
 * Cross-platform looping background music backed by a direct MP3 URL.
 * `restartKey` deliberately seeks to the beginning when its containing
 * screen regains focus, preserving the existing Home and Tracks behavior.
 */
export function BackgroundMusic({
  source,
  volume,
  muted = false,
  stopped,
  restartKey,
  onStopReady,
}: BackgroundMusicProps) {
  const player = useAudioPlayer(source);

  // The player is released when this component unmounts (or the app is
  // backgrounded and torn down). Calls after that throw "shared object that
  // was already released", so every call goes through this guard.
  const safely = (fn: () => unknown) => {
    try {
      const result = fn();
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(() => {});
      }
    } catch {
      // Player already released; nothing to do.
    }
  };

  useEffect(() => {
    safely(() => {
      player.loop = true;
    });
    setAudioModeAsync({ playsInSilentMode: true }).catch((error) => {
      console.warn("Unable to configure background audio mode:", error);
    });
  }, [player]);

  useEffect(() => {
    safely(() => {
      player.volume = muted ? 0 : Math.max(0, Math.min(1, volume / 100));
    });
  }, [muted, player, volume]);

  useEffect(() => {
    const stopImmediately = () => {
      safely(() => player.pause());
      safely(() => player.seekTo(0));
    };
    onStopReady?.(stopImmediately);
    return () => {
      stopImmediately();
      onStopReady?.(null);
    };
  }, [onStopReady, player]);

  useEffect(() => {
    if (stopped) {
      safely(() => player.pause());
      safely(() => player.seekTo(0));
      return;
    }

    safely(() => player.seekTo(0));
    safely(() => player.play());
  }, [player, restartKey, stopped]);

  return null;
}
