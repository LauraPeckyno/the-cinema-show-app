import { useState, useCallback, useEffect, useRef } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable, Dimensions, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { DARK_TRACKS, LIGHT_TRACKS, Track } from "@/constants/tracks";
import { TRACK_ARTWORK } from "@/constants/track-artwork";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPROCKET_SIZE = 8;

// Album browse background music
const ALBUM_MUSIC_SC_URL = "https://soundcloud.com/imaginaurium/space-horrors-3";
const ALBUM_MUSIC_VOLUME = 25;

// ─── Web Album Music (iframe-based) ────────────────────────────────────────
function WebAlbumMusic({ volume, stopped }: { volume: number; stopped: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  useEffect(() => {
    if (!loaded || !iframeRef.current || Platform.OS !== "web") return;
    const SC = (window as any).SC;
    if (!SC?.Widget) return;
    const w = SC.Widget(iframeRef.current);
    widgetRef.current = w;
    w.bind(SC.Widget.Events.READY, () => {
      w.setVolume(volume);
      w.play();
    });
    w.bind(SC.Widget.Events.FINISH, () => { w.seekTo(0); w.play(); });
  }, [loaded]);

  useEffect(() => {
    if (stopped) {
      widgetRef.current?.pause?.();
    }
  }, [stopped]);

  if (Platform.OS !== "web") return null;

  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(ALBUM_MUSIC_SC_URL)}&auto_play=true&show_artwork=false&visual=false&buying=false&sharing=false&download=false&show_playcount=false&show_user=false&color=%23C9A84C`;

  return (
    <View style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>
      {/* @ts-ignore — web-only iframe */}
      <iframe
        ref={iframeRef as any}
        src={src}
        width="1"
        height="1"
        allow="autoplay"
        style={{ border: "none" }}
      />
    </View>
  );
}

// ─── Native Album Music (WebView-based) ────────────────────────────────────
let NativeAlbumMusic: React.ComponentType<{ volume: number; stopped: boolean }> = () => null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview");

  NativeAlbumMusic = ({ volume, stopped }: { volume: number; stopped: boolean }) => {
    const webViewRef = useRef<any>(null);

    useEffect(() => {
      if (stopped) {
        webViewRef.current?.injectJavaScript?.(`
          if (window.__widget) { window.__widget.pause(); }
          true;
        `);
      }
    }, [stopped]);

    const html = `<!DOCTYPE html><html><head>
      <script src="https://w.soundcloud.com/player/api.js"></script>
    </head><body>
      <iframe id="sc" width="100%" height="100" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(ALBUM_MUSIC_SC_URL)}&auto_play=true&show_artwork=false&visual=false&buying=false&sharing=false&download=false&show_playcount=false&show_user=false&color=%23C9A84C" allow="autoplay"></iframe>
      <script>
        var iframe = document.getElementById('sc');
        var widget = SC.Widget(iframe);
        window.__widget = widget;
        widget.bind(SC.Widget.Events.READY, function() {
          widget.setVolume(${volume});
          widget.play();
        });
        widget.bind(SC.Widget.Events.FINISH, function() {
          widget.seekTo(0);
          widget.play();
        });
      </script>
    </body></html>`;

    return (
      <View style={{ position: "absolute", width: 50, height: 50, opacity: 0, top: -100 }}>
        <WebView
          ref={webViewRef}
          source={{ html, baseUrl: "https://soundcloud.com" }}
          javaScriptEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          style={{ width: 50, height: 50 }}
        />
      </View>
    );
  };
}

/** A single film frame cell with artwork and always-visible title */
function FilmCell({ track, onPress }: { track: Track; onPress: () => void }) {
  const artworkUrl = TRACK_ARTWORK[track.id];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filmCell,
        pressed && { transform: [{ scale: 0.95 }], opacity: 0.8 },
      ]}
    >
      <Image
        source={{ uri: artworkUrl }}
        style={styles.cellImage}
        contentFit="cover"
        transition={300}
      />
      {/* Gradient overlay at bottom for text readability */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.75)"]}
        style={styles.cellOverlay}
      />
      {/* Always-visible title at bottom */}
      <View style={styles.titleArea}>
        <Text style={styles.titleText} numberOfLines={2}>
          {track.title}
        </Text>
      </View>
    </Pressable>
  );
}

/** Film strip sprocket holes along the edge */
function SprocketHoles({ count, color }: { count: number; color?: string }) {
  return (
    <View style={styles.sprocketColumn}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.sprocketHole, color ? { borderColor: color } : undefined]} />
      ))}
    </View>
  );
}

/** A complete film strip (one side of the album) */
function FilmStrip({ tracks, side, onTrackPress }: { tracks: Track[]; side: "dark" | "light"; onTrackPress: (track: Track) => void }) {
  const colors = useColors();
  const isDark = side === "dark";
  const stripColor = isDark ? "#1A0A0A" : "#F5F5F5";
  const borderColor = isDark ? "#8B0000" : "#CCCCCC";
  const sprocketColor = isDark ? "#333" : "#AAAAAA";
  const sprocketCount = tracks.length * 4;

  return (
    <View style={[styles.filmStrip, { backgroundColor: stripColor, borderColor }]}>
      {/* Left sprocket holes */}
      <SprocketHoles count={sprocketCount} color={sprocketColor} />

      {/* Film frames */}
      <View style={styles.framesColumn}>
        {/* Side label */}
        <View style={[styles.sideLabel, { borderBottomColor: borderColor }]}>
          <Text style={[styles.sideLabelText, { color: isDark ? "#E57373" : "#333333" }]}>
            {isDark ? "DARK" : "LIGHT"}
          </Text>
        </View>

        {tracks.map((track) => (
          <FilmCell
            key={track.id}
            track={track}
            onPress={() => onTrackPress(track)}
          />
        ))}
      </View>

      {/* Right sprocket holes */}
      <SprocketHoles count={sprocketCount} color={sprocketColor} />
    </View>
  );
}

export default function TracksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { selectTrack } = useAudioEngine();
  const [musicStopped, setMusicStopped] = useState(false);

  const handleTrackPress = (track: Track) => {
    // Stop album background music
    setMusicStopped(true);
    // Select track and navigate
    selectTrack(track);
    router.push("/now-playing" as any);
  };

  // Reset music state when returning to this screen (e.g. back from Now Playing)
  useFocusEffect(
    useCallback(() => {
      setMusicStopped(false);
    }, [])
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Album browse background music */}
      {Platform.OS === "web" ? (
        <WebAlbumMusic volume={ALBUM_MUSIC_VOLUME} stopped={musicStopped} />
      ) : (
        <NativeAlbumMusic volume={ALBUM_MUSIC_VOLUME} stopped={musicStopped} />
      )}

      <LinearGradient
        colors={["#0A0A14", "#1A1A2E"]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Instruction text */}
        <View style={styles.instructionArea}>
          <Text style={[styles.instructionText, { color: colors.muted }]}>
            Tap a frame to start the show!
          </Text>
        </View>

        {/* Two film strips side by side */}
        <View style={styles.stripsContainer}>
          <FilmStrip
            tracks={DARK_TRACKS}
            side="dark"
            onTrackPress={handleTrackPress}
          />
          <FilmStrip
            tracks={LIGHT_TRACKS}
            side="light"
            onTrackPress={handleTrackPress}
          />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 100,
  },
  instructionArea: {
    alignItems: "center",
    paddingVertical: 16,
  },
  instructionText: {
    fontSize: 14,
    letterSpacing: 1,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  stripsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  filmStrip: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 4,
    overflow: "hidden",
    paddingVertical: 8,
  },
  sprocketColumn: {
    width: 14,
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingVertical: 4,
  },
  sprocketHole: {
    width: SPROCKET_SIZE,
    height: SPROCKET_SIZE,
    borderRadius: SPROCKET_SIZE / 2,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "#333",
    marginVertical: 2,
  },
  framesColumn: {
    flex: 1,
    paddingVertical: 4,
    gap: 6,
  },
  sideLabel: {
    alignItems: "center",
    paddingBottom: 6,
    marginBottom: 2,
    borderBottomWidth: 1,
    marginHorizontal: 4,
  },
  sideLabelText: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
  },
  filmCell: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "#333",
  },
  cellImage: {
    width: "100%",
    height: "100%",
  },
  cellOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "40%",
  },
  titleArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  titleText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 0.3,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
