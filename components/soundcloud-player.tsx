import React, { useRef, useCallback, useEffect, useState } from "react";
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
  onDuration?: (durationMs: number) => void;
}

/**
 * SoundCloud player component.
 * - On web: uses an iframe with the SoundCloud Widget API
 * - On native (Android/iOS): uses react-native-webview to embed the same widget
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
  onDuration,
}: SoundCloudPlayerProps) {
  if (Platform.OS === "web") {
    return (
      <WebSoundCloudPlayer
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
    <NativeSoundCloudPlayer
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

// ─── Web Implementation (iframe) ────────────────────────────────────────────

function WebSoundCloudPlayer({
  track,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onProgress,
  onReady,
  onFinish,
  onDuration,
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

  const initWidget = useCallback(() => {
    if (!iframeRef.current) return;
    const checkSC = () => {
      if (typeof (window as any).SC !== "undefined" && (window as any).SC.Widget) {
        const widget = (window as any).SC.Widget(iframeRef.current);
        widgetRef.current = widget;
        widget.bind((window as any).SC.Widget.Events.READY, () => {
          readyRef.current = true;
          widget.setVolume(volume);
          // Fetch actual duration from the widget
          widget.getDuration((durationMs: number) => {
            if (durationMs && onDuration) {
              onDuration(durationMs);
            }
          });
          onReady?.();
        });
        widget.bind((window as any).SC.Widget.Events.PLAY, () => onPlay?.());
        widget.bind((window as any).SC.Widget.Events.PAUSE, () => onPause?.());
        widget.bind((window as any).SC.Widget.Events.FINISH, () => onFinish?.());
        widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
          if (data && onProgress) {
            onProgress(data.relativePosition, data.currentPosition / 1000);
          }
        });
      } else {
        setTimeout(checkSC, 200);
      }
    };
    setTimeout(checkSC, 500);
  }, [volume, onReady, onPlay, onPause, onFinish, onProgress]);

  useEffect(() => {
    if (!widgetRef.current || !readyRef.current) return;
    if (isPlaying) {
      widgetRef.current.play();
    } else {
      widgetRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!widgetRef.current || !readyRef.current) return;
    widgetRef.current.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    if (!widgetRef.current || !readyRef.current) return;
    readyRef.current = false;
    widgetRef.current.load(track.soundcloudUrl, {
      auto_play: false,
      callback: () => {
        readyRef.current = true;
        widgetRef.current.setVolume(volume);
        // Fetch actual duration after loading new track
        widgetRef.current.getDuration((durationMs: number) => {
          if (durationMs && onDuration) {
            onDuration(durationMs);
          }
        });
        onReady?.();
      },
    });
  }, [track.soundcloudUrl]);

  return (
    <View style={styles.hiddenContainer}>
      <iframe
        ref={(el) => {
          iframeRef.current = el;
          if (el) initWidget();
        }}
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={embedUrl}
        style={{ opacity: 0, position: "absolute", pointerEvents: "none" }}
      />
    </View>
  );
}

// ─── Native Implementation (react-native-webview) ──────────────────────────

function NativeSoundCloudPlayer({
  track,
  isPlaying,
  volume,
  onPlay,
  onPause,
  onProgress,
  onReady,
  onFinish,
  onDuration,
}: SoundCloudPlayerProps) {
  const webViewRef = useRef<any>(null);
  const [isWidgetReady, setIsWidgetReady] = useState(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  // We dynamically import WebView to avoid crashes if not installed
  const [WebViewComponent, setWebViewComponent] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("react-native-webview");
        if (mounted) {
          setWebViewComponent(() => mod.default || mod.WebView);
        }
      } catch (e) {
        console.warn("react-native-webview not available:", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const embedUrl = track.soundcloudUrl;

  // Build the HTML page that embeds the SoundCloud widget
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; background: #000; overflow: hidden; }
    iframe { width: 100%; height: 166px; }
  </style>
</head>
<body>
  <iframe id="sc-widget"
    width="100%" height="166" scrolling="no" frameborder="no" allow="autoplay"
    src="https://w.soundcloud.com/player/?url=${encodeURIComponent(embedUrl)}&color=%23C8A951&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false">
  </iframe>
  <script src="https://w.soundcloud.com/player/api.js"></script>
  <script>
    var widget = null;
    var ready = false;

    function initWidget() {
      if (typeof SC === 'undefined' || !SC.Widget) {
        setTimeout(initWidget, 200);
        return;
      }
      var iframe = document.getElementById('sc-widget');
      widget = SC.Widget(iframe);

      widget.bind(SC.Widget.Events.READY, function() {
        ready = true;
        widget.setVolume(${volume});
        // Fetch actual duration from the widget
        widget.getDuration(function(durationMs) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'duration', durationMs: durationMs }));
        });
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
      });

      widget.bind(SC.Widget.Events.PLAY, function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'play' }));
      });

      widget.bind(SC.Widget.Events.PAUSE, function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pause' }));
      });

      widget.bind(SC.Widget.Events.FINISH, function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'finish' }));
      });

      widget.bind(SC.Widget.Events.PLAY_PROGRESS, function(data) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'progress',
          position: data.relativePosition,
          time: data.currentPosition / 1000
        }));
      });
    }

    setTimeout(initWidget, 300);
  </script>
</body>
</html>`;

  // Handle messages from the WebView
  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        switch (data.type) {
          case "ready":
            setIsWidgetReady(true);
            onReady?.();
            break;
          case "duration":
            if (data.durationMs && onDuration) {
              onDuration(data.durationMs);
            }
            break;
          case "play":
            onPlay?.();
            break;
          case "pause":
            onPause?.();
            break;
          case "finish":
            onFinish?.();
            break;
          case "progress":
            onProgress?.(data.position, data.time);
            break;
        }
      } catch (e) {
        // ignore parse errors
      }
    },
    [onReady, onPlay, onPause, onFinish, onProgress]
  );

  // Control playback via injected JS
  useEffect(() => {
    if (!webViewRef.current || !isWidgetReady) return;
    const js = isPlaying
      ? "if(widget && ready) widget.play(); true;"
      : "if(widget && ready) widget.pause(); true;";
    webViewRef.current.injectJavaScript(js);
  }, [isPlaying, isWidgetReady]);

  // Control volume
  useEffect(() => {
    if (!webViewRef.current || !isWidgetReady) return;
    webViewRef.current.injectJavaScript(
      `if(widget && ready) widget.setVolume(${volume}); true;`
    );
  }, [volume, isWidgetReady]);

  // Load new track
  useEffect(() => {
    if (!webViewRef.current || !isWidgetReady) return;
    setIsWidgetReady(false);
    const loadJs = `
      if(widget && ready) {
        ready = false;
        widget.load('${embedUrl}', {
          auto_play: false,
          callback: function() {
            ready = true;
            widget.setVolume(${volume});
            // Fetch actual duration after loading new track
            widget.getDuration(function(durationMs) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'duration', durationMs: durationMs }));
            });
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
          }
        });
      }
      true;
    `;
    webViewRef.current.injectJavaScript(loadJs);
  }, [track.soundcloudUrl]);

  if (!WebViewComponent) {
    return null;
  }

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
        allowsProtectedMedia={true}
        setSupportMultipleWindows={false}
        onError={(e: any) => console.warn("WebView error:", e.nativeEvent)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 1,
    height: 1,
    overflow: "hidden",
    position: "absolute",
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  nativeContainer: {
    width: 300,
    height: 200,
    overflow: "hidden",
    position: "absolute",
    top: -9999,
    left: -9999,
    opacity: 0.01,
    zIndex: -1,
  },
  webview: {
    width: 300,
    height: 200,
    backgroundColor: "transparent",
  },
});
