import { useState, useCallback } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable, Dimensions, Linking } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { ALBUM_PLAYBACK_QUEUE, DARK_TRACKS, LIGHT_TRACKS, Track } from "@/constants/tracks";
import { TRACK_ARTWORK } from "@/constants/track-artwork";
import { preDownload, preDownloadAll } from "@/lib/audio-cache";
import { BackgroundMusic } from "@/components/background-music";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPROCKET_SIZE = 8;

const ALBUM_MUSIC_URL = "https://streamingkeys2.imaginaurium.workers.dev/sh3.mp3";
const ALBUM_MUSIC_VOLUME = 25;
const PURCHASE_OUTLETS = [
  {
    label: "Amazon",
    icon: "amazon" as const,
    url: "https://www.amazon.com/music/player/artists/B001VIHWT2/robert-peckyno",
  },
  {
    label: "Apple Music",
    icon: "apple" as const,
    url: "https://music.apple.com/us/artist/robert-peckyno/418366396",
  },
  {
    label: "Bandcamp",
    icon: "bandcamp" as const,
    url: "https://streamingkeys.bandcamp.com/",
  },
];

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
  const { selectTrack, startAlbumPlayback } = useAudioEngine();
  const [musicStopped, setMusicStopped] = useState(false);
  const [musicRestartKey, setMusicRestartKey] = useState(0);

  const handleTrackPress = async (track: Track) => {
    // Stop album background music
    setMusicStopped(true);
    // Pre-download the selected track before navigating
    await preDownload(track.audioUrl);
    // Select track and navigate
    selectTrack(track);
    router.push("/now-playing" as any);
  };

  const handleStartTheShow = async () => {
    // Stop album background music and start continuous album playback
    setMusicStopped(true);
    // Light Side begins the album (Recessional); Dark Side follows after it.
    const firstTrack = ALBUM_PLAYBACK_QUEUE[0];
    await preDownload(firstTrack.audioUrl);
    startAlbumPlayback(ALBUM_PLAYBACK_QUEUE);
    router.push("/now-playing" as any);
    // Continue downloading remaining tracks in background
    const remainingUrls = ALBUM_PLAYBACK_QUEUE.slice(1).map((t) => t.audioUrl);
    preDownloadAll(remainingUrls).catch((e) => console.warn("Background pre-download error:", e));
  };

  // Reset music state when returning to this screen (e.g. back from Now Playing)
  useFocusEffect(
    useCallback(() => {
      setMusicStopped(false);
      setMusicRestartKey((previous) => previous + 1);
    }, [])
  );

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Album browse background music */}
      <BackgroundMusic
        source={ALBUM_MUSIC_URL}
        volume={ALBUM_MUSIC_VOLUME}
        stopped={musicStopped}
        restartKey={musicRestartKey}
      />

      <LinearGradient
        colors={["#0A0A14", "#1A1A2E"]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Start the Show button */}
        <View style={styles.instructionArea}>
          <Pressable
            onPress={handleStartTheShow}
            style={({ pressed }) => [
              styles.startShowButton,
              pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={styles.startShowText}>▶  Start the Show</Text>
          </Pressable>
          <Text style={[styles.instructionText, { color: colors.muted }]}>
            Start the Show to play all{"\n"}Select a Scene below
          </Text>
        </View>

        {/* Two film strips side by side */}
        <View style={styles.stripsContainer}>
          <FilmStrip
            tracks={LIGHT_TRACKS}
            side="light"
            onTrackPress={handleTrackPress}
          />
          <FilmStrip
            tracks={DARK_TRACKS}
            side="dark"
            onTrackPress={handleTrackPress}
          />
        </View>

        <View style={styles.buyAlbumSection}>
          <View style={styles.buySeparator} />
          <Text style={styles.buyAlbumHeading}>Buy the Album</Text>
          <View style={styles.outletLinks}>
            {PURCHASE_OUTLETS.map((outlet) => (
              <Pressable
                key={outlet.label}
                accessibilityRole="link"
                accessibilityLabel={`Buy The Cinema Show on ${outlet.label}`}
                onPress={() => {
                  void Linking.openURL(outlet.url);
                }}
                style={({ pressed }) => [styles.outletLink, pressed && styles.outletLinkPressed]}
              >
                <FontAwesome name={outlet.icon} size={20} color="#F6E8AE" />
                <Text style={styles.outletLabel}>{outlet.label}</Text>
              </Pressable>
            ))}
          </View>
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
    fontSize: 12,
    letterSpacing: 0.5,
    fontWeight: "400",
    textAlign: "center",
    marginTop: 10,
  },
  startShowButton: {
    backgroundColor: "#C9A84C",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 4,
  },
  startShowText: {
    color: "#1A1A2E",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  stripsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 12,
  },
  buyAlbumSection: {
    alignItems: "center",
    marginTop: 30,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  buySeparator: {
    width: "100%",
    height: 1,
    backgroundColor: "rgba(201, 168, 76, 0.46)",
  },
  buyAlbumHeading: {
    color: "#F6E8AE",
    marginTop: 16,
    fontSize: 15,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 2.4,
  },
  outletLinks: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
  },
  outletLink: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 82,
    borderWidth: 1,
    borderColor: "rgba(246, 232, 174, 0.35)",
    borderRadius: 10,
    backgroundColor: "rgba(9, 9, 19, 0.5)",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 5,
  },
  outletLinkPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.97 }],
  },
  outletLabel: {
    color: "#F6E8AE",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
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
