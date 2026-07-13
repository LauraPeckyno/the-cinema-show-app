import { useEffect, useRef, useState, useCallback } from "react";
import { ScrollView, Text, View, Pressable, StyleSheet, Dimensions, Platform, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useFonts } from "expo-font";
import { useAudioPlayer } from "expo-audio";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ArtDecoDivider, ArtDecoHeader } from "@/components/art-deco";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// SoundCloud embed URL for background music
const BG_MUSIC_SC_URL = "https://soundcloud.com/imaginaurium/thoroughly-positive-pitzy-2";
const BG_MUSIC_VOLUME = 25;

// Projector sound effect
const projectorSound = require("@/assets/sounds/projector-start.mp3");

// ─── Web Background Music (iframe-based) ────────────────────────────────────
function WebBgMusic({ volume, muted, stopped }: { volume: number; muted: boolean; stopped: boolean }) {
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
      w.setVolume(muted ? 0 : volume);
      w.play();
    });
    w.bind(SC.Widget.Events.FINISH, () => { w.seekTo(0); w.play(); });
  }, [loaded]);

  useEffect(() => {
    if (stopped) {
      widgetRef.current?.pause?.();
    } else {
      widgetRef.current?.setVolume?.(muted ? 0 : volume);
    }
  }, [volume, muted, stopped]);

  if (Platform.OS !== "web") return null;

  const src = `https://w.soundcloud.com/player/?url=${encodeURIComponent(BG_MUSIC_SC_URL)}&auto_play=true&show_artwork=false&visual=false&buying=false&sharing=false&download=false&show_playcount=false&show_user=false&color=%23C9A84C`;

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

// ─── Native Background Music (WebView-based) ────────────────────────────────
let NativeBgMusic: React.ComponentType<{ volume: number; muted: boolean; stopped: boolean }> = () => null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview");

  NativeBgMusic = ({ volume, muted, stopped }: { volume: number; muted: boolean; stopped: boolean }) => {
    const webViewRef = useRef<any>(null);

    useEffect(() => {
      if (stopped) {
        webViewRef.current?.injectJavaScript?.(`
          if (window.__widget) { window.__widget.pause(); }
          true;
        `);
      } else {
        const v = muted ? 0 : volume;
        webViewRef.current?.injectJavaScript?.(`
          if (window.__widget) { window.__widget.setVolume(${v}); }
          true;
        `);
      }
    }, [volume, muted, stopped]);

    const html = `<!DOCTYPE html><html><head>
      <script src="https://w.soundcloud.com/player/api.js"></script>
    </head><body>
      <iframe id="sc" width="100%" height="100" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(BG_MUSIC_SC_URL)}&auto_play=true&show_artwork=false&visual=false&buying=false&sharing=false&download=false&show_playcount=false&show_user=false&color=%23C9A84C" allow="autoplay"></iframe>
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

// ─── Album Cover Image ──────────────────────────────────────────────────────
import { getCachedUri } from "@/lib/audio-cache";

const ALBUM_COVER_REMOTE = "http://streamingkeys.imaginaurium.workers.dev/Cover.png";
// Use cached local URI if pre-downloaded, otherwise falls back to remote
const getAlbumCoverUri = () => getCachedUri(ALBUM_COVER_REMOTE);

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isMuted, setIsMuted] = useState(false);
  const [musicStopped, setMusicStopped] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const [fontsLoaded] = useFonts({
    "PlayfairDisplay-Bold": "https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvXDXbtY.ttf",
  });

  // Projector sound player
  const projectorPlayer = useAudioPlayer(projectorSound);

  // Gold shimmer animation for ticket button
  const shimmerX = useSharedValue(-1);

  // Fade-to-black overlay opacity
  const fadeOpacity = useSharedValue(0);

  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value * 120 }],
  }));

  const fadeOverlayStyle = useAnimatedStyle(() => ({
    opacity: fadeOpacity.value,
  }));

  const navigateToTracks = useCallback(() => {
    router.push("/(tabs)/tracks" as any);
  }, [router]);

  const handleTicketPress = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // Play projector sound (soft volume)
    projectorPlayer.volume = 0.3;
    projectorPlayer.seekTo(0);
    projectorPlayer.play();

    // Stop background music
    setMusicStopped(true);

    // Fade to black then navigate
    fadeOpacity.value = withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }, (finished) => {
      if (finished) {
        runOnJS(navigateToTracks)();
      }
    });
  }, [isTransitioning, projectorPlayer, fadeOpacity, navigateToTracks]);

  // Reset transition state when screen regains focus (e.g. tapping Home tab)
  useFocusEffect(
    useCallback(() => {
      setIsTransitioning(false);
      setMusicStopped(false);
      fadeOpacity.value = 0;
    }, [])
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Background music — soft loop */}
      {Platform.OS === "web" ? (
        <WebBgMusic volume={BG_MUSIC_VOLUME} muted={isMuted} stopped={musicStopped} />
      ) : (
        <NativeBgMusic volume={BG_MUSIC_VOLUME} muted={isMuted} stopped={musicStopped} />
      )}

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* ─── Title Section ─── */}
          <View style={styles.titleSection}>
            <Text style={[styles.subtitle, { color: colors.primary }]}>
              Now Playing
            </Text>
            <Text style={[styles.title, { color: colors.foreground, fontFamily: fontsLoaded ? "PlayfairDisplay-Bold" : undefined }]}>
              THE CINEMA{"\n"}SHOW
            </Text>
          </View>

          {/* ─── Music Mute/Unmute Button ─── */}
          <Pressable
            onPress={() => setIsMuted((prev) => !prev)}
            style={({ pressed }) => [
              styles.muteButton,
              {
                borderColor: isMuted ? colors.muted + "60" : colors.primary + "80",
                backgroundColor: isMuted ? colors.muted + "15" : colors.primary + "15",
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}
          >
            <Text style={[styles.muteIcon, { color: isMuted ? colors.muted : colors.primary }]}>
              {isMuted ? "\u{1F507}" : "\u{1F50A}"}
            </Text>
            <Text style={[styles.muteLabel, { color: isMuted ? colors.muted : colors.primary }]}>
              {isMuted ? "MUSIC OFF" : "MUSIC ON"}
            </Text>
          </Pressable>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.75} color={colors.primary} />

          {/* ─── Album Cover ─── */}
          <View style={styles.albumCoverContainer}>
            <View style={[styles.albumCoverBorder, { borderColor: colors.primary + "80" }]}>
              <Image
                source={{ uri: getAlbumCoverUri() }}
                style={styles.albumCoverImage}
                resizeMode="cover"
              />
            </View>
            <View style={[styles.albumCoverGlow, { backgroundColor: colors.primary + "15" }]} />
          </View>

          {/* ─── Description ─── */}
          <ArtDecoHeader title="THE EXPERIENCE" color={colors.primary} textColor={colors.foreground} />

          <View style={styles.descriptionSection}>
            <Text style={[styles.description, { color: colors.muted }]}>
              Step into a world where you become a part of the music. The Cinema Show captures ambient sounds and weaves them into the instrumental soundtrack - creating a unique listening experience that is different every time.
            </Text>
          </View>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.5} color={colors.primary} />

          {/* ─── Headphones Required Notice (text only, no icon) ─── */}
          <View style={[styles.headphonesNotice, { borderColor: colors.primary + "40" }]}>
            <Text style={[styles.headphonesTitle, { color: colors.primary }]}>
              HEADPHONES REQUIRED
            </Text>
            <Text style={[styles.headphonesText, { color: colors.muted }]}>
              To avoid audio feedback, please connect headphones or earbuds before starting.
            </Text>
          </View>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.6} color={colors.primary} />

          {/* ─── Ticket Button ─── */}
          <Pressable
            onPress={handleTicketPress}
            style={({ pressed }) => [
              styles.ticketButton,
              {
                borderColor: colors.primary,
                backgroundColor: colors.primary + "10",
                opacity: pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            {/* Ticket perforations */}
            <View style={[styles.ticketNotchLeft, { backgroundColor: colors.background }]} />
            <View style={[styles.ticketNotchRight, { backgroundColor: colors.background }]} />
            {/* Dashed tear lines */}
            <View style={[styles.ticketTearTop, { borderColor: colors.primary + "40" }]} />
            <View style={[styles.ticketTearBottom, { borderColor: colors.primary + "40" }]} />
            {/* Gold shimmer overlay */}
            <Animated.View style={[styles.shimmerOverlay, shimmerStyle]} pointerEvents="none">
              <LinearGradient
                colors={["transparent", colors.primary + "30", "transparent"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            {/* Ticket content */}
            <Text style={[styles.ticketLabel, { color: colors.muted }]}>ADMIT ONE</Text>
            <Text style={[styles.ticketTitle, { color: colors.primary }]}>Enter the Theatre</Text>
            <Text style={[styles.ticketLabel, { color: colors.muted }]}>{"\u2605"} {"\u2605"} {"\u2605"}</Text>
          </Pressable>

        </View>
      </ScrollView>

      {/* ─── Fade-to-Black Overlay ─── */}
      <Animated.View style={[styles.fadeOverlay, fadeOverlayStyle]} pointerEvents={isTransitioning ? "auto" : "none"} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },

  titleSection: {
    alignItems: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 4,
    lineHeight: 44,
  },
  muteButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginVertical: 8,
    gap: 8,
  },
  muteIcon: {
    fontSize: 18,
  },
  muteLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
  },
  albumCoverContainer: {
    alignItems: "center",
    marginVertical: 16,
    position: "relative",
  },
  albumCoverBorder: {
    borderWidth: 2,
    borderRadius: 8,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#C9A84C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  albumCoverImage: {
    width: SCREEN_WIDTH - 80,
    height: SCREEN_WIDTH - 80,
    borderRadius: 6,
  },
  albumCoverGlow: {
    position: "absolute",
    top: -10,
    left: -10,
    right: -10,
    bottom: -10,
    borderRadius: 16,
    zIndex: -1,
  },
  headphonesNotice: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    width: SCREEN_WIDTH - 56,
  },
  headphonesTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 6,
  },
  headphonesText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  descriptionSection: {
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  description: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
  },
  ticketButton: {
    position: "relative",
    alignItems: "center",
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    marginTop: 12,
    overflow: "visible",
  },
  ticketNotchLeft: {
    position: "absolute",
    left: -8,
    top: "50%",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: -8,
  },
  ticketNotchRight: {
    position: "absolute",
    right: -8,
    top: "50%",
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: -8,
  },
  ticketTearTop: {
    position: "absolute",
    top: 8,
    left: 16,
    right: 16,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  ticketTearBottom: {
    position: "absolute",
    bottom: 8,
    left: 16,
    right: 16,
    borderTopWidth: 1,
    borderStyle: "dashed",
  },
  ticketLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 3,
    marginVertical: 2,
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginVertical: 4,
  },
  shimmerOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 60,
    left: "50%",
    marginLeft: -30,
  },
  fadeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000000",
    zIndex: 999,
  },
});
