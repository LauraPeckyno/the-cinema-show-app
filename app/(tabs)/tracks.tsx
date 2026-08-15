import { useState, useCallback } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable, Dimensions, Alert, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { ALBUM_PLAYBACK_QUEUE, DARK_TRACKS, LIGHT_TRACKS, Track } from "@/constants/tracks";
import { TRACK_ARTWORK } from "@/constants/track-artwork";
import { preDownload, preDownloadAll } from "@/lib/audio-cache";
import { BackgroundMusic } from "@/components/background-music";
import {
  AlbumDownloadError,
  downloadAlbumToMusic,
} from "@/lib/album-download";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPROCKET_SIZE = 8;

const ALBUM_MUSIC_URL = "https://streamingkeys2.imaginaurium.workers.dev/sh3.mp3";
const ALBUM_MUSIC_VOLUME = 25;

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
  const [downloadProgress, setDownloadProgress] = useState<{ completed: number; total: number; trackTitle: string } | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);

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

  const handleAlbumDownload = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Download on a phone", "Full-album downloads are available in the installed mobile app.");
      return;
    }

    setDownloadComplete(false);
    setDownloadProgress({ completed: 0, total: ALBUM_PLAYBACK_QUEUE.length, trackTitle: "Requesting storage access" });

    try {
      await downloadAlbumToMusic(ALBUM_PLAYBACK_QUEUE, setDownloadProgress);
      setDownloadComplete(true);
      Alert.alert("Album saved", "All 12 MP3s were added to your device Music folder.");
    } catch (error) {
      setDownloadProgress(null);
      if (error instanceof AlbumDownloadError && error.code === "permission-denied") {
        Alert.alert("Storage access needed", "Allow music-storage access to save the album to your phone.");
        return;
      }
      Alert.alert("Download incomplete", "We could not save every track. Please check your connection and available device storage.");
    }
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

        <View style={styles.downloadArea}>
          <Pressable
            onPress={handleAlbumDownload}
            disabled={downloadComplete || (downloadProgress !== null && !downloadComplete)}
            style={({ pressed }) => [
              styles.downloadButton,
              downloadComplete && styles.downloadButtonComplete,
              (pressed || (downloadProgress !== null && !downloadComplete)) && styles.downloadButtonPressed,
            ]}
          >
            <Text style={[styles.downloadButtonText, downloadComplete && styles.downloadButtonTextComplete]}>
              {downloadComplete
                ? "Downloaded"
                : downloadProgress
                  ? `Downloading ${downloadProgress.completed}/${downloadProgress.total}`
                  : "Add to my Library"}
            </Text>
          </Pressable>
          {downloadProgress && !downloadComplete && (
            <Text style={[styles.downloadStatus, { color: colors.muted }]} numberOfLines={1}>
              {downloadProgress.trackTitle}
            </Text>
          )}
          {downloadComplete && (
            <Text style={[styles.downloadStatus, { color: "#C9A84C" }]}>Saved to your Music folder</Text>
          )}
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
  downloadArea: {
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 20,
  },
  downloadButton: {
    minWidth: 190,
    borderWidth: 1.5,
    borderColor: "#C9A84C",
    borderRadius: 999,
    backgroundColor: "rgba(201, 168, 76, 0.12)",
    paddingHorizontal: 26,
    paddingVertical: 13,
    alignItems: "center",
  },
  downloadButtonComplete: {
    borderColor: "#55D68B",
    backgroundColor: "rgba(85, 214, 139, 0.16)",
  },
  downloadButtonPressed: {
    opacity: 0.65,
    transform: [{ scale: 0.98 }],
  },
  downloadButtonText: {
    color: "#F6E8AE",
    fontWeight: "700",
    letterSpacing: 1.1,
    fontSize: 13,
    textTransform: "uppercase",
  },
  downloadButtonTextComplete: {
    color: "#8AF0B6",
  },
  downloadStatus: {
    marginTop: 9,
    maxWidth: 250,
    fontSize: 11,
    textAlign: "center",
    letterSpacing: 0.35,
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
