import { Text, View, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { useEffect } from "react";
import { Pressable } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();

  // Subtle pulsing glow animation
  const glowOpacity = useSharedValue(0.3);
  useEffect(() => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <ScreenContainer containerClassName="bg-background">
      <View style={styles.container}>
        <LinearGradient
          colors={["#0A0A14", "#1A1A2E", "#242440", "#1A1A2E", "#0A0A14"]}
          style={StyleSheet.absoluteFillObject}
        />

        {/* Ambient glow behind the logo */}
        <Animated.View style={[styles.glowCircle, glowStyle]}>
          <LinearGradient
            colors={["transparent", "#C8A95120", "#C8A95140", "#C8A95120", "transparent"]}
            style={StyleSheet.absoluteFillObject}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>

        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            contentFit="contain"
          />
        </View>

        {/* Title */}
        <Text style={[styles.title, { color: colors.foreground }]}>THE CINEMA SHOW</Text>
        <Text style={[styles.subtitle, { color: colors.primary }]}>by Robert Peckyno</Text>

        {/* Tagline */}
        <Text style={[styles.tagline, { color: colors.muted }]}>
          Your world becomes the soundtrack
        </Text>

        {/* Description */}
        <View style={styles.descriptionBox}>
          <Text style={[styles.description, { color: colors.muted }]}>
            Capture the sounds around you and blend them with cinematic instrumentals.
            Each track transforms your environment into a unique immersive experience.
          </Text>
        </View>

        {/* Enter Button */}
        <Pressable
          onPress={() => router.push({ pathname: "/(tabs)/tracks" } as any)}
          style={({ pressed }) => [
            styles.enterButton,
            { backgroundColor: colors.primary },
            pressed && { transform: [{ scale: 0.97 }], opacity: 0.9 },
          ]}
        >
          <Text style={[styles.enterButtonText, { color: "#0A0A14" }]}>
            Enter the Theater
          </Text>
        </Pressable>

        {/* Film strip decoration */}
        <View style={styles.filmStrip}>
          {Array.from({ length: 12 }).map((_, i) => (
            <View
              key={i}
              style={[styles.filmHole, { backgroundColor: colors.border }]}
            />
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  glowCircle: {
    position: "absolute",
    width: SCREEN_WIDTH * 0.8,
    height: SCREEN_WIDTH * 0.8,
    borderRadius: SCREEN_WIDTH * 0.4,
    top: "15%",
    alignSelf: "center",
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#C8A951",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 20,
  },
  tagline: {
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    marginBottom: 24,
    letterSpacing: 1,
  },
  descriptionBox: {
    maxWidth: 320,
    marginBottom: 32,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  enterButton: {
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 40,
  },
  enterButtonText: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 1,
  },
  filmStrip: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-evenly",
    paddingVertical: 8,
  },
  filmHole: {
    width: 8,
    height: 8,
    borderRadius: 2,
    opacity: 0.4,
  },
});
