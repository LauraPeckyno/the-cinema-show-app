import { useEffect } from "react";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";

interface BackgroundMusicProps {
  source: string;
  volume: number;
  muted?: boolean;
  stopped: boolean;
  restartKey: number;
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
}: BackgroundMusicProps) {
  const player = useAudioPlayer(source);

  useEffect(() => {
    player.loop = true;
    setAudioModeAsync({ playsInSilentMode: true }).catch((error) => {
      console.warn("Unable to configure background audio mode:", error);
    });
  }, [player]);

  useEffect(() => {
    player.volume = muted ? 0 : Math.max(0, Math.min(1, volume / 100));
  }, [muted, player, volume]);

  useEffect(() => {
    if (stopped) {
      player.pause();
      return;
    }

    player.seekTo(0);
    player.play();
  }, [player, restartKey, stopped]);

  return null;
}
