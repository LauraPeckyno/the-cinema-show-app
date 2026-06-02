import { Text, View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ArtDecoDivider, ArtDecoHeader } from "@/components/art-deco";

export default function AboutScreen() {
  const colors = useColors();

  const openLink = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <ScreenContainer containerClassName="bg-background">
      <LinearGradient
        colors={["#0A0A14", "#1A1A2E"]}
        style={StyleSheet.absoluteFillObject}
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Album Cover at top */}
        <View style={styles.albumCoverContainer}>
          <Image
            source={require("@/assets/images/cinemashow.png")}
            style={styles.albumCover}
            contentFit="cover"
          />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>THE CINEMA SHOW</Text>
        <Text style={[styles.artist, { color: colors.primary }]}>streamingkeys</Text>

        <ArtDecoDivider width={200} color={colors.primary} />

        {/* Description */}
        <ArtDecoHeader title="THE ALBUM" color={colors.primary} textColor={colors.foreground} />
        <View style={styles.section}>
          <Text style={[styles.bodyText, { color: colors.muted }]}>
            "The Cinema Show" is an instrumental album themed around movie theaters and the
            moviegoing experience. Split into two sides — Dark and Light — the album explores
            the full spectrum of cinematic emotion, from haunting atmospheric soundscapes to
            uplifting rhythmic compositions.
          </Text>
        </View>

        <ArtDecoHeader title="THE APP" color={colors.primary} textColor={colors.foreground} />
        <View style={styles.section}>
          {/* App Icon */}
          <View style={styles.appIconContainer}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.appIcon}
              contentFit="contain"
            />
          </View>
          <Text style={[styles.bodyText, { color: colors.muted }]}>
            Inspired by the amazing companion app to the movie Inception, the Cinema Show
            uses your device's microphone to sample your environment. These samples are then
            processed with studio audio filters creating a one-of-a-kind immersive listening
            experience that is unique every time.
          </Text>
        </View>

        <ArtDecoDivider width={160} color={colors.primary} />

        {/* Learn More Button */}
        <View style={styles.buttonContainer}>
          <Pressable
            onPress={() => openLink("https://streamingkeys.com")}
            style={({ pressed }) => [
              styles.learnMoreButton,
              { borderColor: colors.primary },
              pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
            ]}
          >
            <Text style={[styles.learnMoreText, { color: colors.primary }]}>
              Learn More @ streamingkeys.com
            </Text>
          </Pressable>
        </View>

        {/* Copyright */}
        <View style={styles.copyrightContainer}>
          <Text style={[styles.copyrightText, { color: colors.muted }]}>
            All music, graphics, and this application are {"\u00A9"}2026 by Robert Peckyno. All Rights Reserved.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    alignItems: "center",
  },
  albumCoverContainer: {
    width: 220,
    height: 220,
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
    marginBottom: 20,
    shadowColor: "#C8A951",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 2,
    borderColor: "#C8A95140",
  },
  albumCover: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
  },
  artist: {
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  section: {
    width: "100%",
    marginBottom: 8,
  },
  appIconContainer: {
    alignItems: "center",
    marginBottom: 16,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  buttonContainer: {
    marginTop: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  learnMoreButton: {
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  learnMoreText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  copyrightContainer: {
    marginTop: 8,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  copyrightText: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 16,
  },
});
