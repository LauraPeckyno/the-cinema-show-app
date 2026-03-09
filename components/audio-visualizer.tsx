import React, { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  withDelay,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const VISUALIZER_SIZE = SCREEN_WIDTH * 0.6;
const NUM_RINGS = 4;
const NUM_BARS = 24;

interface AudioVisualizerProps {
  isPlaying: boolean;
  micLevel: number; // 0-1
  bpm: number;
  effectColor: string;
  effectIntensity: number; // 0-100
  micSensitivity: number; // 0-100
}

function PulsingRing({
  index,
  isPlaying,
  bpm,
  effectColor,
  micLevel,
}: {
  index: number;
  isPlaying: boolean;
  bpm: number;
  effectColor: string;
  micLevel: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.15);

  const beatDuration = (60 / bpm) * 1000; // ms per beat

  useEffect(() => {
    if (isPlaying) {
      const delay = index * (beatDuration / NUM_RINGS);
      const baseScale = 1 + index * 0.15;
      const micBoost = micLevel * 0.2;

      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(baseScale + 0.1 + micBoost, {
              duration: beatDuration * 0.3,
              easing: Easing.out(Easing.ease),
            }),
            withTiming(baseScale, {
              duration: beatDuration * 0.7,
              easing: Easing.inOut(Easing.ease),
            })
          ),
          -1,
          false
        )
      );

      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.3 + micLevel * 0.2, {
              duration: beatDuration * 0.3,
              easing: Easing.out(Easing.ease),
            }),
            withTiming(0.08, {
              duration: beatDuration * 0.7,
              easing: Easing.inOut(Easing.ease),
            })
          ),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(scale);
      cancelAnimation(opacity);
      scale.value = withTiming(1, { duration: 300 });
      opacity.value = withTiming(0.1, { duration: 300 });
    }
  }, [isPlaying, bpm, micLevel]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const ringSize = VISUALIZER_SIZE * (0.5 + index * 0.18);

  return (
    <Animated.View
      style={[
        styles.ring,
        animStyle,
        {
          width: ringSize,
          height: ringSize,
          borderRadius: ringSize / 2,
          borderColor: effectColor,
          borderWidth: 1.5 - index * 0.2,
        },
      ]}
    />
  );
}

function VisualizerBar({
  index,
  total,
  isPlaying,
  bpm,
  effectColor,
  micLevel,
}: {
  index: number;
  total: number;
  isPlaying: boolean;
  bpm: number;
  effectColor: string;
  micLevel: number;
}) {
  const height = useSharedValue(4);
  const beatDuration = (60 / bpm) * 1000;

  useEffect(() => {
    if (isPlaying) {
      const phase = (index / total) * beatDuration;
      const baseHeight = 4 + micLevel * 30;

      height.value = withDelay(
        phase,
        withRepeat(
          withSequence(
            withTiming(baseHeight + Math.random() * 20, {
              duration: beatDuration * 0.4,
              easing: Easing.out(Easing.ease),
            }),
            withTiming(4 + Math.random() * 6, {
              duration: beatDuration * 0.6,
              easing: Easing.inOut(Easing.ease),
            })
          ),
          -1,
          false
        )
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(4, { duration: 300 });
    }
  }, [isPlaying, bpm, micLevel]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  const angle = (index / total) * 360;
  const radius = VISUALIZER_SIZE * 0.32;

  return (
    <Animated.View
      style={[
        styles.bar,
        animStyle,
        {
          backgroundColor: effectColor,
          transform: [
            { rotate: `${angle}deg` },
            { translateY: -radius },
          ],
        },
      ]}
    />
  );
}

export function AudioVisualizer({
  isPlaying,
  micLevel,
  bpm,
  effectColor,
  effectIntensity,
  micSensitivity,
}: AudioVisualizerProps) {
  const adjustedMicLevel = micLevel * (micSensitivity / 100);

  return (
    <View style={styles.container}>
      {/* Pulsing rings */}
      {Array.from({ length: NUM_RINGS }).map((_, i) => (
        <PulsingRing
          key={`ring-${i}`}
          index={i}
          isPlaying={isPlaying}
          bpm={bpm}
          effectColor={effectColor}
          micLevel={adjustedMicLevel}
        />
      ))}

      {/* Center bars */}
      <View style={styles.barsContainer}>
        {Array.from({ length: NUM_BARS }).map((_, i) => (
          <VisualizerBar
            key={`bar-${i}`}
            index={i}
            total={NUM_BARS}
            isPlaying={isPlaying}
            bpm={bpm}
            effectColor={effectColor}
            micLevel={adjustedMicLevel}
          />
        ))}
      </View>

      {/* Center glow */}
      <View
        style={[
          styles.centerGlow,
          {
            backgroundColor: effectColor + "20",
            shadowColor: effectColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: VISUALIZER_SIZE,
    height: VISUALIZER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
  },
  barsContainer: {
    position: "absolute",
    width: VISUALIZER_SIZE,
    height: VISUALIZER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  bar: {
    position: "absolute",
    width: 3,
    borderRadius: 1.5,
    opacity: 0.7,
  },
  centerGlow: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
});
