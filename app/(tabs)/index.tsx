import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View, Pressable, StyleSheet, Dimensions, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ArtDecoDivider, ArtDecoSunburst, ArtDecoHeader } from "@/components/art-deco";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// SoundCloud embed URL for "Four Better or Worse" — plays as a soft background loop
const BG_MUSIC_SC_URL = "https://soundcloud.com/imaginaurium/four-better-or-worse";
const BG_MUSIC_VOLUME = 25;

// ─── Web Background Music (iframe-based) ────────────────────────────────────
function WebBgMusic({ volume, muted }: { volume: number; muted: boolean }) {
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
    widgetRef.current?.setVolume?.(muted ? 0 : volume);
  }, [volume, muted]);

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
let NativeBgMusic: React.ComponentType<{ volume: number; muted: boolean }> = () => null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { WebView } = require("react-native-webview");

  NativeBgMusic = ({ volume, muted }: { volume: number; muted: boolean }) => {
    const webViewRef = useRef<any>(null);

    useEffect(() => {
      const v = muted ? 0 : volume;
      webViewRef.current?.injectJavaScript?.(`
        if (window.__widget) { window.__widget.setVolume(${v}); }
        true;
      `);
    }, [volume, muted]);

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
const albumCover = require("@/assets/images/cinemashow.png");

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();
  const [isMuted, setIsMuted] = useState(false);

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Background music — soft loop */}
      {Platform.OS === "web" ? (
        <WebBgMusic volume={BG_MUSIC_VOLUME} muted={isMuted} />
      ) : (
        <NativeBgMusic volume={BG_MUSIC_VOLUME} muted={isMuted} />
      )}

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* ─── Art Deco Sunburst Header ─── */}
          <View style={styles.sunburstWrap}>
            <ArtDecoSunburst size={SCREEN_WIDTH * 0.6} color={colors.primary} />
          </View>

          {/* ─── Title Section ─── */}
          <View style={styles.titleSection}>
            <Text style={[styles.subtitle, { color: colors.primary }]}>
              {"— AN IMMERSIVE AUDIO EXPERIENCE —"}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              THE CINEMA{"\n"}SHOW
            </Text>
            <Text style={[styles.artist, { color: colors.muted }]}>
              by Robert Peckyno
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
                source={albumCover}
                style={styles.albumCoverImage}
                resizeMode="cover"
              />
            </View>
            <View style={[styles.albumCoverGlow, { backgroundColor: colors.primary + "15" }]} />
          </View>

          {/* ─── Headphones Required Notice (text only, no icon) ─── */}
          <View style={[styles.headphonesNotice, { borderColor: colors.primary + "40" }]}>
            <Text style={[styles.headphonesTitle, { color: colors.primary }]}>
              HEADPHONES REQUIRED
            </Text>
            <Text style={[styles.headphonesText, { color: colors.muted }]}>
              This experience uses your device microphone to sample ambient sounds
              and blend them with the music. To avoid audio feedback, please connect
              headphones or earbuds before starting.
            </Text>
          </View>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.5} color={colors.primary} />

          {/* ─── Description ─── */}
          <ArtDecoHeader title="THE EXPERIENCE" color={colors.primary} textColor={colors.foreground} />

          <View style={styles.descriptionSection}>
            <Text style={[styles.description, { color: colors.muted }]}>
              Step into a world where your surroundings become part of the music.
              The Cinema Show captures ambient sounds through your microphone and
              weaves them into an instrumental soundtrack — creating a unique,
              one-of-a-kind listening experience that is different every time.
            </Text>
          </View>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.6} color={colors.primary} />

          {/* ─── CTA Button ─── */}
          <Pressable
            onPress={() => router.push("/(tabs)/tracks" as any)}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>
              {"\u{1F3AC}"}  EXPLORE THE ALBUM
            </Text>
          </Pressable>

          {/* ─── Album Info ─── */}
          <View style={styles.albumInfo}>
            <Text style={[styles.albumInfoText, { color: colors.muted }]}>
              12 Tracks  {"\u{00B7}"}  Dark & Light Sides  {"\u{00B7}"}  2026
            </Text>
          </View>
        </View>
      </ScrollView>
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
  sunburstWrap: {
    marginBottom: -8,
    opacity: 0.6,
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
  artist: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    letterSpacing: 1,
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
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  ctaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  albumInfo: {
    marginTop: 16,
  },
  albumInfoText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});
