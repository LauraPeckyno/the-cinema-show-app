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
  interpolateColor,
} from "react-native-reanimated";
import { useHeadphoneDetection } from "@/hooks/use-headphone-detection";
import { useRouter } from "expo-router";
import { initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { AudioFilePlayer } from "@/components/audio-file-player";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { reportTrackDuration } from "@/hooks/use-track-durations";
import { MicPassthrough } from "@/components/mic-passthrough";
import { TRACK_ARTWORK } from "@/constants/track-artwork";

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const GATE_GUIDANCE_STORAGE_KEY = "@the-cinema-show/gate-guidance-seen-v1";

function FilmReelJitter({
  artworkUrl,
  isPlaying,
}: {
  artworkUrl: string;
  isPlaying: boolean;
}) {
  const reelX = useSharedValue(0);
  const reelY = useSharedValue(0);
  const reelRotation = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(reelX);
    cancelAnimation(reelY);
    cancelAnimation(reelRotation);
    let reelTimer: ReturnType<typeof setTimeout> | null = null;

    const resetReel = () => {
      reelX.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.ease) });
      reelY.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.ease) });
      reelRotation.value = withTiming(0, { duration: 90, easing: Easing.out(Easing.ease) });
    };

    if (!isPlaying) {
      resetReel();
      return;
    }

    const triggerRareReelSlip = () => {
      const horizontalKick = Math.random() > 0.5 ? 2 : -1.5;
      reelX.value = withSequence(
        withTiming(horizontalKick, { duration: 34, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 132, easing: Easing.inOut(Easing.ease) }),
      );
      reelY.value = withSequence(
        withTiming(-1.5, { duration: 28, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 138, easing: Easing.inOut(Easing.ease) }),
      );
      reelRotation.value = withSequence(
        withTiming(0.22, { duration: 32, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 136, easing: Easing.inOut(Easing.ease) }),
      );
      scheduleNextReelSlip();
    };

    const scheduleNextReelSlip = () => {
      const nextSlipDelay = 30000 + Math.round(Math.random() * 30000);
      reelTimer = setTimeout(triggerRareReelSlip, nextSlipDelay);
    };

    scheduleNextReelSlip();
    return () => {
      if (reelTimer) clearTimeout(reelTimer);
      resetReel();
    };
  }, [isPlaying, reelRotation, reelX, reelY]);

  const reelJitterStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: reelX.value },
      { translateY: reelY.value },
      { rotate: `${reelRotation.value}deg` },
    ],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.reelJitterLayer, reelJitterStyle]}>
      <Image
        source={{ uri: artworkUrl }}
        style={[styles.backgroundArtwork, { opacity: 0.75 }]}
        contentFit="cover"
        transition={300}
      />
    </Animated.View>
  );
}

const FILM_EFFECT_COLORS = ["#FF4FA3", "#55E6FF", "#B68CFF", "#FFE36B", "#61F2B2", "#FF845C"];
const filmPercent = (value: number) => `${value}%` as `${number}%`;

function createFilmDamageFrame() {
  return {
    dust: Array.from({ length: 14 }, () => ({
      left: filmPercent(4 + Math.round(Math.random() * 92)),
      top: filmPercent(3 + Math.round(Math.random() * 94)),
      size: 2 + Math.floor(Math.random() * 3),
      opacity: 0.42 + Math.random() * 0.4,
    })),
    scratches: Array.from({ length: 5 }, () => ({
      left: filmPercent(4 + Math.round(Math.random() * 92)),
      top: filmPercent(2 + Math.round(Math.random() * 70)),
      height: filmPercent(24 + Math.round(Math.random() * 36)),
      opacity: 0.2 + Math.random() * 0.22,
    })),
  };
}

function FilmDustAndScratches({
  isPlaying,
  isEffectsActive,
  bpm,
  playbackTime,
}: {
  isPlaying: boolean;
  isEffectsActive: boolean;
  bpm: number;
  playbackTime: number;
}) {
  const filmOpacity = useSharedValue(0);
  const flicker = useSharedValue(0.4);
  const scratchBurst = useSharedValue(0);
  const markColor = useSharedValue("#FFFFFF");
  const scratchColor = useSharedValue("#050505");
  const [damageFrame, setDamageFrame] = useState(createFilmDamageFrame);

  useEffect(() => {
    cancelAnimation(filmOpacity);
    cancelAnimation(flicker);

    if (!isPlaying) {
      filmOpacity.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.ease) });
      flicker.value = 0.4;
      scratchBurst.value = 0;
      markColor.value = "#FFFFFF";
      scratchColor.value = "#050505";
      return;
    }

    filmOpacity.value = withTiming(1, { duration: 340, easing: Easing.out(Easing.ease) });
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.88, { duration: 95, easing: Easing.linear }),
        withTiming(0.38, { duration: 170, easing: Easing.linear }),
        withTiming(0.68, { duration: 130, easing: Easing.linear }),
      ),
      -1,
      false,
    );
  }, [filmOpacity, flicker, isPlaying, markColor, scratchBurst, scratchColor]);

  const beatDuration = Math.max(240, 60000 / Math.max(1, bpm));
  const beatIndex = Math.floor((playbackTime * 1000) / beatDuration);

  useEffect(() => {
    cancelAnimation(scratchBurst);
    if (!isPlaying) {
      scratchBurst.value = 0;
      markColor.value = "#FFFFFF";
      return;
    }

    setDamageFrame(createFilmDamageFrame());
    scratchBurst.value = 0;
    scratchBurst.value = withSequence(
      withTiming(1, { duration: Math.min(85, beatDuration * 0.18), easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: Math.max(120, beatDuration * 0.82), easing: Easing.in(Easing.ease) }),
    );
    if (isEffectsActive) {
      const nextColor = FILM_EFFECT_COLORS[Math.floor(Math.random() * FILM_EFFECT_COLORS.length)];
      markColor.value = withTiming(nextColor, { duration: Math.min(180, beatDuration * 0.35), easing: Easing.inOut(Easing.ease) });
      scratchColor.value = withTiming(nextColor, { duration: Math.min(180, beatDuration * 0.35), easing: Easing.inOut(Easing.ease) });
    } else {
      markColor.value = withTiming("#FFFFFF", { duration: Math.min(180, beatDuration * 0.35), easing: Easing.out(Easing.ease) });
      scratchColor.value = withTiming("#050505", { duration: Math.min(180, beatDuration * 0.35), easing: Easing.out(Easing.ease) });
    }
  }, [beatDuration, beatIndex, isEffectsActive, isPlaying, markColor, scratchBurst, scratchColor]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: filmOpacity.value * (0.58 + flicker.value * 0.42),
  }));
  const colorMarkStyle = useAnimatedStyle(() => ({ backgroundColor: markColor.value }));
  const scratchColorStyle = useAnimatedStyle(() => ({ backgroundColor: scratchColor.value }));
  const scratchBurstStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + scratchBurst.value * 0.82,
    transform: [{ translateY: scratchBurst.value * -10 }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.filmOverlay, overlayStyle]}>
      {damageFrame.dust.map((speck, index) => (
        <Animated.View
          key={`dust-${index}`}
          style={[
            styles.filmDustSpeck,
            {
              left: speck.left,
              top: speck.top,
              width: speck.size,
              height: speck.size,
              borderRadius: speck.size / 2,
              opacity: speck.opacity,
            },
            colorMarkStyle,
          ]}
        />
      ))}
      <Animated.View style={[StyleSheet.absoluteFillObject, scratchBurstStyle]}>
        {damageFrame.scratches.map((scratch, index) => (
          <Animated.View
            key={`scratch-${index}`}
            style={[
              styles.filmScratch,
              {
                left: scratch.left,
                top: scratch.top,
                height: scratch.height,
                opacity: scratch.opacity,
              },
              scratchColorStyle,
            ]}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

function AnimatedButtonBorder({
  bpm,
  playbackTime,
  isPlaying,
  isEffectsActive,
  effectColor,
  borderRadius,
}: {
  bpm: number;
  playbackTime: number;
  isPlaying: boolean;
  isEffectsActive: boolean;
  effectColor: string;
  borderRadius: number;
}) {
  const borderColor = useSharedValue("transparent");
  const borderPulse = useSharedValue(1);

  useEffect(() => {
    cancelAnimation(borderColor);
    cancelAnimation(borderPulse);
    const barDuration = Math.max(240, (60000 / Math.max(1, bpm)) * 4);
    const millisecondsIntoBar = (playbackTime * 1000) % barDuration;
    const millisecondsUntilBar = Math.max(1, barDuration - millisecondsIntoBar);
    if (isEffectsActive) {
      borderPulse.value = 1;
      const barSyncedColorCycle = withSequence(
        withTiming(effectColor, { duration: barDuration * 0.25, easing: Easing.inOut(Easing.ease) }),
        withTiming("#FF7CD8", { duration: barDuration * 0.25, easing: Easing.inOut(Easing.ease) }),
        withTiming("#7BE7FF", { duration: barDuration * 0.25, easing: Easing.inOut(Easing.ease) }),
        withTiming("#FFF1A6", { duration: barDuration * 0.25, easing: Easing.inOut(Easing.ease) }),
      );
      borderColor.value = withSequence(
        withTiming(effectColor, { duration: millisecondsUntilBar, easing: Easing.linear }),
        withRepeat(barSyncedColorCycle, -1, false),
      );
    } else if (isPlaying) {
      borderColor.value = withTiming("#FFFFFF", { duration: 1000, easing: Easing.inOut(Easing.ease) });
      borderPulse.value = withRepeat(
        withSequence(
          withTiming(1.6, { duration: Math.max(250, barDuration * 0.42), easing: Easing.out(Easing.ease) }),
          withTiming(0.96, { duration: Math.max(300, barDuration * 0.58), easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
    } else {
      borderPulse.value = withTiming(1, { duration: 180 });
      borderColor.value = withTiming("transparent", { duration: 220, easing: Easing.out(Easing.ease) });
    }
  }, [bpm, effectColor, isEffectsActive, isPlaying]);

  const animatedBorderStyle = useAnimatedStyle(() => ({
    borderColor: borderColor.value,
    shadowColor: borderColor.value,
    opacity: isPlaying || isEffectsActive ? 1 : 0,
    shadowOpacity: borderPulse.value,
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.animatedButtonBorder, { borderRadius }, animatedBorderStyle]}
    />
  );
}

export default function NowPlayingScreen() {
  useKeepAwake();
  const router = useRouter();
  // A full-screen modal can report a 0 top inset on iOS, so fall back to the
  // window's measured status-bar height to keep the back button tappable.
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, initialWindowMetrics?.insets.top ?? 0);
  const colors = useColors();
  const [micError, setMicError] = useState<string | null>(null);
  const [isTightGate, setIsTightGate] = useState(false);
  const [showGateGuidance, setShowGateGuidance] = useState(false);
  const gateGuidanceSeenRef = useRef(false);
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

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(GATE_GUIDANCE_STORAGE_KEY)
      .then((value) => {
        if (mounted && value === "true") gateGuidanceSeenRef.current = true;
      })
      .catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const handleGateChange = useCallback((tight: boolean) => {
    setIsTightGate(tight);
    if (gateGuidanceSeenRef.current) return;

    gateGuidanceSeenRef.current = true;
    setShowGateGuidance(true);
    void AsyncStorage.setItem(GATE_GUIDANCE_STORAGE_KEY, "true").catch(() => undefined);
  }, []);

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
    <ScreenContainer edges={["bottom", "left", "right"]} containerClassName="bg-background">
      <FilmReelJitter
        artworkUrl={artworkUrl}
        isPlaying={isPlaying}
      />
      <LinearGradient
        colors={["rgba(8,8,18,0.18)", isDark ? "rgba(24,7,38,0.34)" : "rgba(12,12,30,0.34)", "rgba(8,8,18,0.58)"]}
        style={StyleSheet.absoluteFillObject}
      />
      <FilmDustAndScratches
        isPlaying={isPlaying}
        isEffectsActive={isMicActive && isPlaying}
        bpm={currentTrack.bpm}
        playbackTime={playbackTime}
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

      {/* Mic Audio Passthrough — active independently of music playback. */}
      <MicPassthrough
        isActive={isMicActive}
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
        tightGate={isTightGate}
      />

      <ScrollView style={styles.contentLayer} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Back Button */}
        <View style={[styles.header, { paddingTop: safeTop + 8 }]}>
          <Pressable
            onPress={() => { stopPlayback(); router.back(); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to tracks"
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
              {`-${formatTime(Math.max(0, displayDuration - playbackTime))}`}
            </Text>
          </View>
        </View>

        {/* Control Buttons: Play only */}
        <View style={styles.controlsRow}>
          {/* Play/Pause */}
          <View style={styles.playButtonFrame}>
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
            {/* Sibling overlay prevents the animated border from being buried by the button surface. */}
            <AnimatedButtonBorder
              bpm={currentTrack.bpm}
              playbackTime={playbackTime}
              isPlaying={isPlaying}
              isEffectsActive={false}
              effectColor={effectColor}
              borderRadius={36}
            />
          </View>
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
            <View style={styles.micToggleFrame}>
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
              </Pressable>
              {/* The animated outline lives above—not inside—the clipping button surface. */}
              <AnimatedButtonBorder
                bpm={currentTrack.bpm}
                playbackTime={playbackTime}
                isPlaying={isPlaying}
                isEffectsActive={isMicActive && isPlaying}
                effectColor={effectColor}
                borderRadius={32}
              />
            </View>
          </Animated.View>
          <View style={styles.gateControl}>
            <Text style={[styles.gateLabel, { color: colors.muted }]}>Gate</Text>
            <View style={[styles.gateSwitch, { borderColor: isTightGate ? colors.warning : colors.border }]}> 
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !isTightGate }}
                onPress={() => handleGateChange(false)}
                style={({ pressed }) => [
                  styles.gateOption,
                  !isTightGate && { backgroundColor: effectColor + "30" },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Text style={[styles.gateOptionText, { color: !isTightGate ? effectColor : colors.muted }]}>Open</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: isTightGate }}
                onPress={() => handleGateChange(true)}
                style={({ pressed }) => [
                  styles.gateOption,
                  isTightGate && { backgroundColor: colors.warning + "30" },
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Text style={[styles.gateOptionText, { color: isTightGate ? colors.warning : colors.muted }]}>Tight</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showGateGuidance}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGateGuidance(false)}
      >
        <View style={styles.gateTooltipOverlay}>
          <View style={[styles.gateTooltipCard, { backgroundColor: "#12121FEF", borderColor: effectColor + "88" }]}>
            <Text style={[styles.gateTooltipTitle, { color: effectColor }]}>Gate Guide</Text>
            <Text style={[styles.gateTooltipText, { color: colors.foreground }]}>
              Use the Open Gate for normal environments and over-ear headphones that use your phone&apos;s built-in mic. (Preferred if possible){"\n\n"}
              If you use earbuds with a mic and there is feedback, use the Tight Gate and turn down the effect volume until listening is comfortable.
            </Text>
            <Pressable
              onPress={() => setShowGateGuidance(false)}
              style={({ pressed }) => [styles.gateTooltipDismiss, { borderColor: effectColor }, pressed && { opacity: 0.72 }]}
            >
              <Text style={[styles.gateTooltipDismissText, { color: effectColor }]}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  reelJitterLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  filmOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    overflow: "hidden",
  },
  filmDustSpeck: {
    position: "absolute",
  },
  filmScratch: {
    position: "absolute",
    width: 1,
    backgroundColor: "#050505",
  },
  contentLayer: {
    zIndex: 3,
  },
  titleArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    marginBottom: 40,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  progressArea: {
    paddingHorizontal: 24,
    marginBottom: 40,
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
    marginBottom: 40,
  },
  effectSliderArea: {
    marginHorizontal: 24,
    marginBottom: 40,
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
  playButtonFrame: {
    width: 72,
    height: 72,
    borderRadius: 36,
    position: "relative",
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
  micToggleFrame: {
    position: "relative",
    borderRadius: 32,
  },
  micToggleButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 32,
    borderWidth: 3,
    position: "relative",
    overflow: "hidden",
  },
  animatedButtonBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    shadowOpacity: 0.85,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    zIndex: 20,
    elevation: 12,
  },
  micToggleLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  gateControl: {
    alignItems: "center",
    marginTop: 14,
  },
  gateLabel: {
    marginBottom: 6,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  gateSwitch: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  gateOption: {
    minWidth: 74,
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gateOptionText: {
    fontSize: 12,
    fontWeight: "700",
  },
  gateTooltipOverlay: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  gateTooltipCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  gateTooltipTitle: {
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    textAlign: "center",
    textTransform: "uppercase",
  },
  gateTooltipText: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  gateTooltipDismiss: {
    alignSelf: "center",
    marginTop: 18,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  gateTooltipDismissText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
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
