import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Text,
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { AudioVisualizer } from "@/components/audio-visualizer";
import { SoundCloudPlayer } from "@/components/soundcloud-player";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useKeepAwake } from "expo-keep-awake";
import { getEffectProcessor } from "@/lib/audio-effects";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

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
  const trackRef = useRef<View>(null);

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
        ref={trackRef}
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
  const {
    state,
    togglePlayback,
    toggleMic,
    setMicSensitivity,
    setEffectIntensity,
    setVolume,
    updatePlaybackProgress,
    setPlaying,
    setLoading,
  } = useAudioEngine();

  const {
    currentTrack,
    isPlaying,
    isMicActive,
    micLevel,
    processedMicLevel,
    micSensitivity,
    effectIntensity,
    volume,
    playbackProgress,
    playbackTime,
    isLoading,
  } = state;

  // BPM indicator pulse
  const bpmPulse = useSharedValue(1);
  useEffect(() => {
    if (currentTrack && isPlaying) {
      const beatMs = (60 / currentTrack.bpm) * 1000;
      bpmPulse.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: beatMs * 0.15, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: beatMs * 0.85, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      bpmPulse.value = withTiming(1, { duration: 200 });
    }
  }, [isPlaying, currentTrack]);

  const bpmStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bpmPulse.value }],
  }));

  // Mic level indicator animation
  const micBarWidth = useSharedValue(0);
  useEffect(() => {
    micBarWidth.value = withTiming(processedMicLevel * 100, { duration: 80 });
  }, [processedMicLevel]);

  const micBarStyle = useAnimatedStyle(() => ({
    width: `${micBarWidth.value}%`,
  }));

  const handleSCReady = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

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
  const estimatedDuration = currentTrack.durationEstimate;

  // Use processedMicLevel for the visualizer (it has the effect applied)
  const visualizerLevel = isMicActive ? processedMicLevel : 0;

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
        volume={volume}
        onReady={handleSCReady}
        onPlay={handleSCPlay}
        onPause={handleSCPause}
        onProgress={handleSCProgress}
        onFinish={handleSCFinish}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.6 },
            ]}
          >
            <IconSymbol name="chevron.left" size={24} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.sideLabel, { color: effectColor }]}>
              {isDark ? "DARK SIDE" : "LIGHT SIDE"}
            </Text>
            <Text style={[styles.trackName, { color: colors.foreground }]} numberOfLines={1}>
              {currentTrack.title}
            </Text>
          </View>
          <View style={styles.headerRight} />
        </View>

        {/* Visualizer */}
        <View style={styles.visualizerArea}>
          <AudioVisualizer
            isPlaying={isPlaying}
            micLevel={visualizerLevel}
            bpm={currentTrack.bpm}
            effectColor={effectColor}
            effectIntensity={effectIntensity}
            micSensitivity={micSensitivity}
          />
        </View>

        {/* Status Row */}
        <View style={styles.statusRow}>
          <Animated.View style={[styles.bpmBadge, bpmStyle, { borderColor: effectColor }]}>
            <Text style={[styles.bpmText, { color: effectColor }]}>{currentTrack.bpm}</Text>
            <Text style={[styles.bpmLabel, { color: colors.muted }]}>BPM</Text>
          </Animated.View>

          <View style={[styles.effectBadge, { backgroundColor: effectColor + "20", borderColor: effectColor + "40" }]}>
            <Text style={styles.effectIcon}>{currentTrack.effect.icon}</Text>
            <Text style={[styles.effectNameSmall, { color: effectColor }]}>
              {currentTrack.effect.name}
            </Text>
          </View>

          <View style={[styles.micBadge, { borderColor: isMicActive ? colors.success : colors.border }]}>
            <View style={[styles.micDot, { backgroundColor: isMicActive ? colors.success : colors.muted }]} />
            <Text style={[styles.micStatusText, { color: isMicActive ? colors.success : colors.muted }]}>
              {isMicActive ? "MIC ON" : "MIC OFF"}
            </Text>
          </View>
        </View>

        {/* Mic Level Meter */}
        {isMicActive && (
          <View style={styles.micMeterArea}>
            <Text style={[styles.micMeterLabel, { color: colors.muted }]}>AMBIENT LEVEL</Text>
            <View style={[styles.micMeterTrack, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[
                  styles.micMeterFill,
                  micBarStyle,
                  { backgroundColor: effectColor },
                ]}
              />
            </View>
          </View>
        )}

        {/* Progress Bar */}
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
              {formatTime(estimatedDuration)}
            </Text>
          </View>
        </View>

        {/* Main Controls */}
        <View style={styles.controlsRow}>
          {/* Mic Toggle */}
          <Pressable
            onPress={toggleMic}
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

          {/* Volume indicator */}
          <View
            style={[
              styles.controlButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <IconSymbol name="speaker.wave.2.fill" size={24} color={colors.primary} />
          </View>
        </View>

        {/* Sliders */}
        <View style={styles.slidersArea}>
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
            color={effectColor}
            icon={"\u{2728}"}
          />
          <CustomSlider
            value={volume}
            onValueChange={setVolume}
            label="Volume"
            color={colors.primary}
            icon={"\u{1F50A}"}
          />
        </View>

        {/* Effect Description */}
        <View style={[styles.effectDescBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.effectDescTitle, { color: effectColor }]}>
            {currentTrack.effect.icon} {currentTrack.effect.name}
          </Text>
          <Text style={[styles.effectDescText, { color: colors.muted }]}>
            {currentTrack.effect.description}
          </Text>
          {isMicActive && (
            <Text style={[styles.effectActiveText, { color: colors.success }]}>
              Effect active — ambient audio is being processed
            </Text>
          )}
        </View>
      </ScrollView>
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
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  sideLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  trackName: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 2,
  },
  headerRight: {
    width: 40,
  },
  visualizerArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  bpmBadge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
  },
  bpmText: {
    fontSize: 18,
    fontWeight: "800",
  },
  bpmLabel: {
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1,
  },
  effectBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  effectIcon: {
    fontSize: 16,
  },
  effectNameSmall: {
    fontSize: 12,
    fontWeight: "600",
  },
  micBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  micDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  micStatusText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  micMeterArea: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  micMeterLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: "center",
  },
  micMeterTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  micMeterFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressArea: {
    paddingHorizontal: 24,
    marginBottom: 20,
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
    gap: 24,
    marginBottom: 28,
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
  slidersArea: {
    paddingHorizontal: 24,
    gap: 16,
    marginBottom: 24,
  },
  sliderContainer: {
    gap: 6,
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
    height: 6,
    borderRadius: 3,
    overflow: "visible",
    position: "relative",
  },
  sliderFill: {
    height: "100%",
    borderRadius: 3,
    position: "absolute",
    left: 0,
    top: 0,
  },
  sliderThumb: {
    position: "absolute",
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  effectDescBox: {
    marginHorizontal: 24,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  effectDescTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 6,
  },
  effectDescText: {
    fontSize: 13,
    lineHeight: 20,
  },
  effectActiveText: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
  },
});
