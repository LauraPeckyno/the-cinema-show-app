import React, { useRef, useCallback, useEffect } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { Track } from "@/constants/tracks";

interface SoundCloudPlayerProps {
  track: Track;
  isPlaying: boolean;
  volume: number;
  onPlay?: () => void;
  onPause?: () => void;
  onProgress?: (progress: number, time: number) => void;
  onReady?: () => void;
  onFinish?: () => void;
}

/**
 * SoundCloud player using an iframe embed.
 * On web, renders a hidden iframe with the SoundCloud widget.
 * On native, we use a minimal approach since WebView isn't bundled by default.
 */
export function SoundCloudPlayer({
  track,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onProgress,
  onReady,
  onFinish,
}: SoundCloudPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<any>(null);
  const readyRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    track.soundcloudUrl
  )}&color=%23C8A951&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;

  // Load SC Widget API script
  useEffect(() => {
    if (Platform.OS !== "web") return;
    if (scriptLoadedRef.current) return;

    const existing = document.querySelector('script[src*="api.js"]');
    if (existing) {
      scriptLoadedRef.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.async = true;
    script.onload = () => {
      scriptLoadedRef.current = true;
    };
    document.head.appendChild(script);
  }, []);

  // Initialize widget when iframe is ready
  const initWidget = useCallback(() => {
    if (Platform.OS !== "web") return;
    if (!iframeRef.current) return;

    const checkSC = () => {
      if (typeof (window as any).SC !== "undefined" && (window as any).SC.Widget) {
        const widget = (window as any).SC.Widget(iframeRef.current);
        widgetRef.current = widget;

        widget.bind((window as any).SC.Widget.Events.READY, () => {
          readyRef.current = true;
          widget.setVolume(volume);
          onReady?.();
        });

        widget.bind((window as any).SC.Widget.Events.PLAY, () => {
          onPlay?.();
        });

        widget.bind((window as any).SC.Widget.Events.PAUSE, () => {
          onPause?.();
        });

        widget.bind((window as any).SC.Widget.Events.FINISH, () => {
          onFinish?.();
        });

        widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
          if (data && onProgress) {
            onProgress(data.relativePosition, data.currentPosition / 1000);
          }
        });
      } else {
        setTimeout(checkSC, 200);
      }
    };

    // Small delay to let iframe load
    setTimeout(checkSC, 500);
  }, [volume, onReady, onPlay, onPause, onFinish, onProgress]);

  // Control playback
  useEffect(() => {
    if (!widgetRef.current || !readyRef.current) return;
    if (isPlaying) {
      widgetRef.current.play();
    } else {
      widgetRef.current.pause();
    }
  }, [isPlaying]);

  // Control volume
  useEffect(() => {
    if (!widgetRef.current || !readyRef.current) return;
    widgetRef.current.setVolume(volume);
  }, [volume]);

  // Reload widget when track changes
  useEffect(() => {
    if (!widgetRef.current || !readyRef.current) return;
    readyRef.current = false;
    widgetRef.current.load(track.soundcloudUrl, {
      auto_play: false,
      callback: () => {
        readyRef.current = true;
        widgetRef.current.setVolume(volume);
        onReady?.();
      },
    });
  }, [track.soundcloudUrl]);

  if (Platform.OS !== "web") {
    // For native, we'd use react-native-webview, but for now return null
    return null;
  }

  return (
    <View style={styles.container}>
      <iframe
        ref={(el) => {
          iframeRef.current = el;
          if (el) initWidget();
        }}
        width="100%"
        height="0"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={embedUrl}
        style={{ opacity: 0, position: "absolute", pointerEvents: "none" }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 1,
    height: 1,
    overflow: "hidden",
    position: "absolute",
    top: -100,
    left: -100,
    opacity: 0,
  },
});
