import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  ScrollView,
  Modal,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";
import { useHeadphoneDetection } from "@/hooks/use-headphone-detection";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { AudioFilePlayer } from "@/components/audio-file-player";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useKeepAwake } from "expo-keep-awake";
import { reportTrackDuration } from "@/hooks/use-track-durations";
import { MicPassthrough } from "@/components/mic-passthrough";
import { TRACK_ARTWORK } from "@/constants/track-artwork";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function BPMBorderChaser({
  bpm,
  isPlaying,
  borderRadius,
}: {
  bpm: number;
  isPlaying: boolean;
  borderRadius: number;
}) {
  const progress = useSharedValue(0);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    cancelAnimation(progress);
    if (isPlaying && bpm > 0) {
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { duration: Math.max(120, 60000 / bpm), easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      progress.value = 0;
    }
  }, [bpm, isPlaying]);

  const getPixelStyle = (offset: number) => {
    "worklet";
    const pixel = 6;
    const horizontal = Math.max(1, size.width - pixel);
    const vertical = Math.max(1, size.height - pixel);
    const perimeter = 2 * (horizontal + vertical);
    let distance = ((progress.value + offset) % 1) * perimeter;
    let x = 0;
    let y = 0;
    if (distance <= horizontal) {
      x = distance;
    } else if ((distance -= horizontal) <= vertical) {
      x = horizontal;
      y = distance;
    } else if ((distance -= vertical) <= horizontal) {
      x = horizontal - distance;
      y = vertical;
    } else {
      distance -= horizontal;
      y = vertical - distance;
    }
    return {
      opacity: isPlaying ? 1 : 0,
      transform: [{ translateX: x }, { translateY: y }],
    };
  };

  const firstPixelStyle = useAnimatedStyle(() => getPixelStyle(0));
  const secondPixelStyle = useAnimatedStyle(() => getPixelStyle(0.5));

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => setSize(event.nativeEvent.layout)}
      style={[styles.borderChaserOverlay, { borderRadius }]}
    >
      <Animated.View style={[styles.borderChaserPixel, firstPixelStyle]} />
      <Animated.View style={[styles.borderChaserPixel, secondPixelStyle]} />
    </View>
  );
}

export default function NowPlayingScreen() {
  useKeepAwake();
  const router = useRouter();
  const colors = useColors();
  const [micError, setMicError] = useState<string | null>(null);
  const [showHeadphoneWarning, setShowHeadphoneWarning] = useState(false);
  const { route: audioRoute, isHeadphonesConnected, wasDisconnected, clearDisconnectedFlag } = useHeadphoneDetection();
  const {
    state,
    togglePlayback,
    toggleMic,
    setMicSensitivity,
    setEffectIntensity,
    setEffectVolumeMultiplier,
    setMasterVolume,
    setMusicVolume,
    setDryWetMix,
    updatePlaybackProgress,
    setTrackDuration,
    setPlaying,
    setLoading,
    updateMicLevel,
    advanceToNextTrack,
    stopPlayback,
  } = useAudioEngine();

  const {
    currentTrack,
    isPlaying,
    isMicActive,
    processedMicLevel,
    micSensitivity,
    effectIntensity,
    effectVolumeMultiplier,
    masterVolume,
    musicVolume,
    dryWetMix,
    playbackProgress,
    playbackTime,
    trackDuration,
    isLoading,
    isAlbumMode,
  } = state;

  // Stop all playback when leaving this screen (unmount, hardware back, gesture dismiss)
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  const dispatchMicLevel = useCallback((level: number) => {
    const sensitivity = micSensitivity / 100;
    const adjustedLevel = Math.min(1, level * sensitivity * 2);
    updateMicLevel(adjustedLevel, adjustedLevel);
  }, [micSensitivity]);

  // Headphone disconnection detection — auto-pause mic
  useEffect(() => {
    if (wasDisconnected && isMicActive) {
      toggleMic();
      setShowHeadphoneWarning(true);
    }
  }, [wasDisconnected]);

  const handleDismissHeadphoneWarning = useCallback(() => {
    setShowHeadphoneWarning(false);
    clearDisconnectedFlag();
  }, [clearDisconnectedFlag]);

  const handleReconnectAndResume = useCallback(() => {
    setShowHeadphoneWarning(false);
    clearDisconnectedFlag();
    if (isHeadphonesConnected && !isMicActive) {
      toggleMic();
    }
  }, [clearDisconnectedFlag, isHeadphonesConnected, isMicActive, toggleMic]);

  const handleSCReady = useCallback(() => {
    setLoading(false);
    // In album mode, auto-play when a new track becomes ready
    if (isAlbumMode && !isPlaying) {
      setPlaying(true);
    }
  }, [setLoading, isAlbumMode, isPlaying, setPlaying]);

  const handleSCDuration = useCallback(
    (durationMs: number) => {
      setTrackDuration(durationMs);
      if (currentTrack) {
        reportTrackDuration(currentTrack.id, durationMs);
      }
    },
    [setTrackDuration, currentTrack]
  );

  const handleSCPlay = useCallback(() => {
    setPlaying(true);
  }, [setPlaying]);

  const handleSCPause = useCallback(() => {
    setPlaying(false);
  }, [setPlaying]);

  const handleSCProgress = useCallback(
    (progress: number, time: number) => {
      updatePlaybackProgress(progress, time);
    },
    [updatePlaybackProgress]
  );

  const handleSCFinish = useCallback(() => {
    if (isAlbumMode) {
      // Auto-advance to next track in the album queue
      const hasNext = advanceToNextTrack();
      if (!hasNext) {
        // Album finished — navigate back to tracks screen
        router.back();
      }
      // If hasNext is true, the currentTrack will update and AudioFilePlayer
      // will re-render with the new track URL and auto-play
    } else {
      // Single track mode — just stop
      setPlaying(false);
      updatePlaybackProgress(0, 0);
    }
  }, [isAlbumMode, advanceToNextTrack, setPlaying, updatePlaybackProgress, router]);

  // Animated effects toggle: retain the zoom only, without the fading circle.
  const micPulse = useSharedValue(1);

  useEffect(() => {
    if (isMicActive) {
      micPulse.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1.0, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(micPulse);
      micPulse.value = withTiming(1, { duration: 200 });
    }
  }, [isMicActive]);

  const animatedMicStyle = useAnimatedStyle(() => ({
    transform: [{ scale: micPulse.value }],
  }));

  const wetSliderWidthRef = useRef(1);
  const updateWetEffectVolume = useCallback((locationX: number) => {
    const normalized = Math.max(0, Math.min(1, locationX / wetSliderWidthRef.current));
    setEffectVolumeMultiplier(0.5 + normalized);
  }, [setEffectVolumeMultiplier]);

  const wetSliderResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => updateWetEffectVolume(event.nativeEvent.locationX),
      onPanResponderMove: (event) => updateWetEffectVolume(event.nativeEvent.locationX),
    }),
  ).current;

  if (!currentTrack) {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
        <LinearGradient
          colors={["#0A0A14", "#1A1A2E", "#0A0A14"]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>No track selected</Text>
          <Pressable
            onPress={() => { stopPlayback(); router.back(); }}
            style={({ pressed }) => [
              styles.backButtonEmpty,
              { borderColor: colors.primary },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.backButtonText, { color: colors.primary }]}>Select a Track</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  const effectColor = currentTrack.effect.color;
  const isDark = currentTrack.side === "dark";
  const displayDuration = trackDuration > 0
    ? trackDuration
    : currentTrack.durationMs > 0
      ? currentTrack.durationMs / 1000
      : currentTrack.durationEstimate;
  const artworkUrl = TRACK_ARTWORK[currentTrack.id];
  const shouldFadeMicOutput = isPlaying && trackDuration > 0 && playbackTime >= Math.max(0, trackDuration - 2);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <Image
        source={{ uri: artworkUrl }}
        style={[styles.backgroundArtwork, { opacity: 0.75 }]}
        contentFit="cover"
        transition={300}
      />
      <LinearGradient
        colors={["rgba(8,8,18,0.18)", isDark ? "rgba(24,7,38,0.34)" : "rgba(12,12,30,0.34)", "rgba(8,8,18,0.58)"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Audio File Player — music at 90% of device volume (fixed) */}
      <AudioFilePlayer
        track={currentTrack}
        isPlaying={isPlaying}
        volume={musicVolume}
        onReady={handleSCReady}
        onPlay={handleSCPlay}
        onPause={handleSCPause}
        onProgress={handleSCProgress}
        onFinish={handleSCFinish}
        onDuration={handleSCDuration}
      />

      {/* Mic Audio Passthrough — effects at 50% of music volume, +8dB mic gain */}
      {/* Effects only start when track is actually playing */}
      <MicPassthrough
        isActive={isMicActive && isPlaying}
        trackId={currentTrack.id}
        bpm={currentTrack.bpm}
        effectIntensity={effectIntensity}
        effectVolumeMultiplier={effectVolumeMultiplier}
        micSensitivity={micSensitivity}
        masterVolume={masterVolume}
        musicVolume={musicVolume}
        dryWetMix={dryWetMix}
        shouldFadeOut={shouldFadeMicOutput}
        onLevelUpdate={dispatchMicLevel}
        onError={(err) => setMicError(err)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => { stopPlayback(); router.back(); }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>Tracks</Text>
          </Pressable>
        </View>

        {/* Track title over the full-screen artwork */}
        <View style={styles.titleArea}>
          <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={2}>
            {currentTrack.title}
          </Text>
        </View>

        {/* Progress Bar with Times */}
        <View style={styles.progressArea}>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { width: `${playbackProgress * 100}%`, backgroundColor: effectColor },
              ]}
            />
          </View>
          <View style={styles.progressTimeRow}>
            <Text style={[styles.timeText, { color: colors.muted }]}>
              {formatTime(playbackTime)}
            </Text>
            <Text style={[styles.timeText, { color: colors.muted }]}>
              {trackDuration > 0 ? `-${formatTime(displayDuration - playbackTime)}` : formatTime(displayDuration)}
            </Text>
          </View>
        </View>

        {/* Control Buttons: Play only */}
        <View style={styles.controlsRow}>
          {/* Play/Pause */}
          <Pressable
            onPress={togglePlayback}
            style={({ pressed }) => [
              styles.playButton,
              { backgroundColor: effectColor },
              pressed && { transform: [{ scale: 0.95 }], opacity: 0.9 },
            ]}
          >
            {isLoading ? (
              <Text style={styles.loadingText}>...</Text>
            ) : (
              <IconSymbol
                name={isPlaying ? "pause.fill" : "play.fill"}
                size={36}
                color="#0A0A14"
              />
            )}
            <BPMBorderChaser bpm={currentTrack.bpm} isPlaying={isPlaying} borderRadius={36} />
          </Pressable>
        </View>

        {/* Global effected-mic return slider: 0.5× at left, 1.0× center, 1.5× at right. */}
        <View style={styles.effectSliderArea}>
          <View style={styles.effectSliderHeading}>
            <Text style={[styles.effectSliderLabel, { color: colors.foreground }]}>Effect Volume</Text>
            <Text style={[styles.effectSliderValue, { color: effectColor }]}>{effectVolumeMultiplier.toFixed(1)}×</Text>
          </View>
          <View
            style={[styles.effectSliderTrack, { backgroundColor: colors.border }]}
            onLayout={(event) => { wetSliderWidthRef.current = Math.max(1, event.nativeEvent.layout.width); }}
            {...wetSliderResponder.panHandlers}
          >
            <View style={[styles.effectSliderFill, { width: `${(effectVolumeMultiplier - 0.5) * 100}%`, backgroundColor: effectColor }]} />
            <View style={[styles.effectSliderThumb, { left: `${(effectVolumeMultiplier - 0.5) * 100}%`, borderColor: effectColor, backgroundColor: colors.background }]} />
          </View>
          <View style={styles.effectSliderBounds}>
            <Text style={[styles.effectSliderBound, { color: colors.muted }]}>0.5×</Text>
            <Text style={[styles.effectSliderBound, { color: colors.muted }]}>1.0×</Text>
            <Text style={[styles.effectSliderBound, { color: colors.muted }]}>1.5×</Text>
          </View>
        </View>

        {/* Mic Error Message */}
        {micError && (
          <View style={[styles.micErrorArea, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}>
            <Text style={[styles.micErrorText, { color: colors.error }]}>
              {"\u26A0\uFE0F"} {micError}
            </Text>
          </View>
        )}

        {/* Animated Mic & Effects Toggle */}
        <View style={styles.micToggleArea}>
          <Animated.View style={animatedMicStyle}>
            <Pressable
              onPress={() => { setMicError(null); toggleMic(); }}
              style={({ pressed }) => [
                styles.micToggleButton,
                {
                  backgroundColor: isMicActive ? effectColor + "25" : colors.surface,
                  borderColor: isMicActive ? effectColor : colors.border,
                },
                pressed && { opacity: 0.8 },
              ]}
            >
              <IconSymbol
                name={isMicActive ? "mic.fill" : "mic.slash.fill"}
                size={32}
                color={isMicActive ? effectColor : colors.muted}
              />
              <Text style={[styles.micToggleLabel, { color: isMicActive ? effectColor : colors.muted, textAlign: 'center' }]}> 
                {isMicActive ? "Tap to Deactivate" : "Listen Normally or\nTap to Activate"}
              </Text>
              <BPMBorderChaser bpm={currentTrack.bpm} isPlaying={isPlaying} borderRadius={32} />
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Headphone Disconnection Warning Modal */}
      <Modal
        visible={showHeadphoneWarning}
        transparent
        animationType="fade"
        onRequestClose={handleDismissHeadphoneWarning}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: "#1A1A2E", borderColor: colors.warning }]}>
            <Text style={styles.modalIcon}>{"\u{1F3A7}"}</Text>
            <Text style={[styles.modalTitle, { color: colors.warning }]}>
              Headphones Disconnected
            </Text>
            <Text style={[styles.modalMessage, { color: colors.foreground }]}>
              Microphone has been paused to prevent audio feedback through the speakers.
            </Text>
            <Text style={[styles.modalHint, { color: colors.muted }]}>
              Reconnect your headphones to resume the ambient audio experience.
            </Text>
            <View style={styles.modalButtons}>
              <Pressable
                onPress={handleDismissHeadphoneWarning}
                style={({ pressed }) => [
                  styles.modalButton,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={[styles.modalButtonText, { color: colors.muted }]}>Dismiss</Text>
              </Pressable>
              {isHeadphonesConnected && (
                <Pressable
                  onPress={handleReconnectAndResume}
                  style={({ pressed }) => [
                    styles.modalButton,
                    { borderColor: colors.success, backgroundColor: colors.success + "20" },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.modalButtonText, { color: colors.success }]}>Resume Mic</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 18,
    marginBottom: 16,
  },
  backButtonEmpty: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: "500",
  },
  backgroundArtwork: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  titleArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  progressArea: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressTimeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 28,
    marginBottom: 32,
  },
  effectSliderArea: {
    marginHorizontal: 24,
    marginBottom: 24,
  },
  effectSliderHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  effectSliderLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  effectSliderValue: {
    fontSize: 14,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  effectSliderTrack: {
    height: 8,
    borderRadius: 4,
    justifyContent: "center",
  },
  effectSliderFill: {
    position: "absolute",
    height: "100%",
    left: 0,
    borderRadius: 4,
  },
  effectSliderThumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    marginLeft: -11,
  },
  effectSliderBounds: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  effectSliderBound: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  loadingText: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0A0A14",
  },
  micErrorArea: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  micErrorText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  micToggleArea: {
    alignItems: "center",
    marginBottom: 32,
    position: "relative",
  },
  micToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 32,
    borderWidth: 1.5,
    position: "relative",
    overflow: "hidden",
  },
  borderChaserOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  borderChaserPixel: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFF7C0",
    shadowColor: "#FFF7C0",
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 10,
  },
  micToggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  modalContent: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 16,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    textAlign: "center",
  },
  modalMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  modalHint: {
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
