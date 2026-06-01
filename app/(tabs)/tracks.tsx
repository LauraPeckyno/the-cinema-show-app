import { useState, useCallback } from "react";
import { Text, View, StyleSheet, ScrollView, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { DARK_TRACKS, LIGHT_TRACKS, Track } from "@/constants/tracks";
import { TRACK_ARTWORK } from "@/constants/track-artwork";
import { IconSymbol } from "@/components/ui/icon-symbol";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SPROCKET_SIZE = 8;

/** A single film frame cell with artwork and long-press title overlay */
function FilmCell({ track, onPress }: { track: Track; onPress: () => void }) {
  const artworkUrl = TRACK_ARTWORK[track.id];
  const [showTitle, setShowTitle] = useState(false);
  const overlayOpacity = useSharedValue(0);

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleLongPress = useCallback(() => {
    setShowTitle(true);
    overlayOpacity.value = withTiming(1, { duration: 200 });
  }, [overlayOpacity]);

  const handlePressOut = useCallback(() => {
    overlayOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(() => setShowTitle(false), 300);
  }, [overlayOpacity]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      delayLongPress={300}
      style={({ pressed }) => [
        styles.filmCell,
        pressed && !showTitle && { transform: [{ scale: 0.95 }], opacity: 0.8 },
      ]}
    >
      <Image
        source={{ uri: artworkUrl }}
        style={styles.cellImage}
        contentFit="cover"
        transition={300}
      />
      {/* Subtle gradient overlay at bottom for depth */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={styles.cellOverlay}
      />
      {/* Title overlay on long-press */}
      {showTitle && (
        <Animated.View style={[styles.titleOverlay, animatedOverlayStyle]}>
          <LinearGradient
            colors={["rgba(0,0,0,0.85)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0.85)"]}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={styles.titleOverlayText} numberOfLines={2}>
            {track.title}
          </Text>
          <Text style={styles.titleOverlayEffect}>
            {track.effect.name}
          </Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

/** Film strip sprocket holes along the edge */
function SprocketHoles({ count, color }: { count: number; color: string }) {
  return (
    <View style={styles.sprocketColumn}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={[styles.sprocketHole, { borderColor: color }]} />
      ))}
    </View>
  );
}

/** A complete film strip (one side of the album) */
function FilmStrip({ tracks, side, onTrackPress }: { tracks: Track[]; side: "dark" | "light"; onTrackPress: (track: Track) => void }) {
  const isDark = side === "dark";
  const stripColor = isDark ? "#1A0A0A" : "#F5F5F5";
  const borderColor = isDark ? "#8B0000" : "#FFFFFF";
  const sprocketColor = isDark ? "#333" : "#CCCCCC";
  const labelColor = isDark ? "#E57373" : "#333333";
  const sprocketCount = tracks.length * 4;

  return (
    <View style={[styles.filmStrip, { backgroundColor: stripColor, borderColor }]}>
      {/* Left sprocket holes */}
      <SprocketHoles count={sprocketCount} color={sprocketColor} />

      {/* Film frames */}
      <View style={styles.framesColumn}>
        {/* Side label */}
        <View style={[styles.sideLabel, { borderBottomColor: borderColor }]}>
          <Text style={[styles.sideLabelText, { color: labelColor }]}>
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

/** Now Playing mini-bar */
function NowPlayingBar({ onPress }: { onPress: () => void }) {
  const { state } = useAudioEngine();
  const { currentTrack, isPlaying } = state;
  const colors = useColors();

  if (!currentTrack) return null;

  const artworkUrl = TRACK_ARTWORK[currentTrack.id];
  const effectColor = currentTrack.effect.color;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.nowPlayingBar,
        { backgroundColor: "#1A1A2E", borderColor: effectColor + "60" },
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
    >
      {/* Mini artwork */}
      <View style={[styles.nowPlayingArt, { borderColor: effectColor + "40" }]}>
        <Image
          source={{ uri: artworkUrl }}
          style={styles.nowPlayingArtImage}
          contentFit="cover"
        />
      </View>

      {/* Track info */}
      <View style={styles.nowPlayingInfo}>
        <Text style={[styles.nowPlayingTitle, { color: colors.foreground }]} numberOfLines={1}>
          {currentTrack.title}
        </Text>
        <Text style={[styles.nowPlayingStatus, { color: effectColor }]}>
          {isPlaying ? "Now Playing" : "Paused"}
        </Text>
      </View>

      {/* Play indicator */}
      <View style={[styles.nowPlayingIcon, { backgroundColor: effectColor + "20" }]}>
        <IconSymbol
          name={isPlaying ? "pause.fill" : "play.fill"}
          size={18}
          color={effectColor}
        />
      </View>
    </Pressable>
  );
}

export default function TracksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { selectTrack, state } = useAudioEngine();

  const handleTrackPress = (track: Track) => {
    selectTrack(track);
    router.push("/now-playing" as any);
  };

  const handleNowPlayingPress = () => {
    router.push("/now-playing" as any);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <LinearGradient
        colors={["#0A0A14", "#1A1A2E"]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          state.currentTrack ? { paddingBottom: 140 } : undefined,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Instruction text */}
        <View style={styles.instructionArea}>
          <Text style={[styles.instructionText, { color: colors.muted }]}>
            Hold a frame to reveal its title
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

      {/* Now Playing mini-bar */}
      <NowPlayingBar onPress={handleNowPlayingPress} />
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
    height: "30%",
  },
  titleOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  titleOverlayText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  titleOverlayEffect: {
    color: "#D4AF37",
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 1,
    marginTop: 4,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Now Playing mini-bar
  nowPlayingBar: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  nowPlayingArt: {
    width: 44,
    height: 44,
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
  },
  nowPlayingArtImage: {
    width: "100%",
    height: "100%",
  },
  nowPlayingInfo: {
    flex: 1,
    gap: 2,
  },
  nowPlayingTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  nowPlayingStatus: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  nowPlayingIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
