import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Modal,
} from "react-native";
import { useHeadphoneDetection } from "@/hooks/use-headphone-detection";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { SoundCloudPlayer } from "@/components/soundcloud-player";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useKeepAwake } from "expo-keep-awake";
import { reportTrackDuration } from "@/hooks/use-track-durations";
import { MicPassthrough } from "@/components/mic-passthrough";
import { TRACK_ARTWORK } from "@/constants/track-artwork";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function CustomSlider({
  value,
  onValueChange,
  label,
  color,
  icon,
}: {
  value: number;
  onValueChange: (v: number) => void;
  label: string;
  color: string;
  icon: string;
}) {
  const colors = useColors();

  const handlePress = (e: any) => {
    const nativeEvent = e.nativeEvent;
    const x = nativeEvent.locationX ?? nativeEvent.offsetX ?? 0;
    const trackWidth = SCREEN_WIDTH - 80;
    const pct = Math.max(0, Math.min(100, (x / trackWidth) * 100));
    onValueChange(pct);
  };

  return (
    <View style={styles.sliderContainer}>
      <View style={styles.sliderLabelRow}>
        <Text style={styles.sliderIcon}>{icon}</Text>
        <Text style={[styles.sliderLabel, { color: colors.muted }]}>{label}</Text>
        <Text style={[styles.sliderValue, { color }]}>{Math.round(value)}%</Text>
      </View>
      <Pressable
        onPress={handlePress}
        style={[styles.sliderTrack, { backgroundColor: colors.border }]}
      >
        <View
          style={[
            styles.sliderFill,
            { width: `${value}%`, backgroundColor: color },
          ]}
        />
        <View
          style={[
            styles.sliderThumb,
            {
              left: `${value}%`,
              backgroundColor: color,
            },
          ]}
        />
      </Pressable>
    </View>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
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
    setMasterVolume,
    setMusicVolume,
    setDryWetMix,
    updatePlaybackProgress,
    setTrackDuration,
    setPlaying,
    setLoading,
    updateMicLevel,
  } = useAudioEngine();

  const {
    currentTrack,
    isPlaying,
    isMicActive,
    processedMicLevel,
    micSensitivity,
    effectIntensity,
    masterVolume,
    musicVolume,
    dryWetMix,
    playbackProgress,
    playbackTime,
    trackDuration,
    isLoading,
  } = state;

  // Music mute toggle state
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const savedMusicVolumeRef = useRef(musicVolume);

  const handleMuteToggle = useCallback(() => {
    if (isMusicMuted) {
      // Unmute - restore saved volume
      setMusicVolume(savedMusicVolumeRef.current);
      setIsMusicMuted(false);
    } else {
      // Mute - save current volume and set to 0
      savedMusicVolumeRef.current = musicVolume;
      setMusicVolume(0);
      setIsMusicMuted(true);
    }
  }, [isMusicMuted, musicVolume, setMusicVolume]);

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
  }, [setLoading]);

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
    setPlaying(false);
    updatePlaybackProgress(0, 0);
  }, [setPlaying, updatePlaybackProgress]);

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
            onPress={() => router.back()}
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

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-background">
      <LinearGradient
        colors={["#0A0A14", isDark ? "#1A0A2E" : "#1A1A2E", "#0A0A14"]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Hidden SoundCloud Player */}
      <SoundCloudPlayer
        track={currentTrack}
        isPlaying={isPlaying}
        volume={Math.round((masterVolume / 100) * musicVolume)}
        onReady={handleSCReady}
        onPlay={handleSCPlay}
        onPause={handleSCPause}
        onProgress={handleSCProgress}
        onFinish={handleSCFinish}
        onDuration={handleSCDuration}
      />

      {/* Mic Audio Passthrough */}
      <MicPassthrough
        isActive={isMicActive}
        trackId={currentTrack.id}
        bpm={currentTrack.bpm}
        effectIntensity={effectIntensity}
        micSensitivity={micSensitivity}
        masterVolume={masterVolume}
        dryWetMix={dryWetMix}
        onLevelUpdate={dispatchMicLevel}
        onError={(err) => setMicError(err)}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
            <Text style={[styles.backText, { color: colors.foreground }]}>Tracks</Text>
          </Pressable>
        </View>

        {/* Track Artwork */}
        <View style={styles.artworkArea}>
          <View style={[styles.artworkFrame, { borderColor: effectColor + "60" }]}>
            <Image
              source={{ uri: artworkUrl }}
              style={styles.artworkImage}
              contentFit="cover"
              transition={300}
            />
          </View>
        </View>

        {/* Track Title (centered) */}
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

        {/* Control Buttons: Mic, Play, Volume */}
        <View style={styles.controlsRow}>
          {/* Mic Toggle */}
          <Pressable
            onPress={() => { setMicError(null); toggleMic(); }}
            style={({ pressed }) => [
              styles.controlButton,
              {
                backgroundColor: isMicActive ? colors.success + "20" : colors.surface,
                borderColor: isMicActive ? colors.success : colors.border,
              },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <IconSymbol
              name={isMicActive ? "mic.fill" : "mic.slash.fill"}
              size={24}
              color={isMicActive ? colors.success : colors.muted}
            />
          </Pressable>

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
          </Pressable>

          {/* Volume Mute Toggle */}
          <Pressable
            onPress={handleMuteToggle}
            style={({ pressed }) => [
              styles.controlButton,
              {
                backgroundColor: isMusicMuted ? colors.error + "20" : colors.surface,
                borderColor: isMusicMuted ? colors.error : colors.border,
              },
              pressed && { transform: [{ scale: 0.95 }] },
            ]}
          >
            <IconSymbol
              name={isMusicMuted ? "speaker.slash.fill" : "speaker.wave.2.fill"}
              size={24}
              color={isMusicMuted ? colors.error : colors.primary}
            />
          </Pressable>
        </View>

        {/* Mic Error Message */}
        {micError && (
          <View style={[styles.micErrorArea, { backgroundColor: colors.error + '15', borderColor: colors.error + '40' }]}>
            <Text style={[styles.micErrorText, { color: colors.error }]}>
              {"\u26A0\uFE0F"} {micError}
            </Text>
          </View>
        )}

        {/* Volume Adjustment Bars */}
        <View style={styles.slidersArea}>
          <CustomSlider
            value={masterVolume}
            onValueChange={setMasterVolume}
            label="Master Volume"
            color={colors.primary}
            icon={"\u{1F50A}"}
          />
          <CustomSlider
            value={musicVolume}
            onValueChange={setMusicVolume}
            label="Music Volume"
            color={effectColor}
            icon={"\u{1F3B5}"}
          />
          <CustomSlider
            value={dryWetMix}
            onValueChange={setDryWetMix}
            label="Dry / Wet Mix"
            color={"#9B59B6"}
            icon={"\u{1F4A7}"}
          />
          <CustomSlider
            value={micSensitivity}
            onValueChange={setMicSensitivity}
            label="Mic Sensitivity"
            color={colors.success}
            icon={"\u{1F399}\u{FE0F}"}
          />
          <CustomSlider
            value={effectIntensity}
            onValueChange={setEffectIntensity}
            label="Effect Intensity"
            color={"#E67E22"}
            icon={"\u{2728}"}
          />
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
  artworkArea: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 20,
  },
  artworkFrame: {
    width: SCREEN_WIDTH * 0.7,
    height: SCREEN_WIDTH * 0.7,
    borderRadius: 12,
    borderWidth: 2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  artworkImage: {
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
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
  slidersArea: {
    paddingHorizontal: 24,
    gap: 24,
    marginBottom: 24,
  },
  sliderContainer: {
    gap: 8,
  },
  sliderLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sliderIcon: {
    fontSize: 14,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  sliderTrack: {
    height: 10,
    borderRadius: 5,
    overflow: "visible",
    position: "relative",
    paddingVertical: 8,
    marginVertical: 4,
  },
  sliderFill: {
    height: 10,
    borderRadius: 5,
    position: "absolute",
    left: 0,
    top: 0,
  },
  sliderThumb: {
    position: "absolute",
    top: -7,
    width: 24,
    height: 24,
    borderRadius: 12,
    marginLeft: -12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
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
