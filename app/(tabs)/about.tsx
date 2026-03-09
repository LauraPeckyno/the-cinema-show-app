import { Text, View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";

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
        {/* Album Art */}
        <View style={styles.artContainer}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.albumArt}
            contentFit="contain"
          />
        </View>

        <Text style={[styles.title, { color: colors.foreground }]}>THE CINEMA SHOW</Text>
        <Text style={[styles.artist, { color: colors.primary }]}>Robert Peckyno</Text>
        <Text style={[styles.year, { color: colors.muted }]}>2026 Instrumental Album</Text>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ABOUT THE ALBUM</Text>
          <Text style={[styles.bodyText, { color: colors.muted }]}>
            "The Cinema Show" is an instrumental album themed around movie theaters and the
            moviegoing experience. Split into two sides — Dark and Light — the album explores
            the full spectrum of cinematic emotion, from haunting atmospheric soundscapes to
            uplifting rhythmic compositions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>ABOUT THE APP</Text>
          <Text style={[styles.bodyText, { color: colors.muted }]}>
            Inspired by the Inception companion app, The Cinema Show uses your device's
            microphone to sample ambient sounds from your environment. These samples are
            then processed with unique audio effects and synced to the BPM of each track,
            creating a one-of-a-kind immersive listening experience that blends your world
            with cinematic music.
          </Text>
          <Text style={[styles.bodyText, { color: colors.muted, marginTop: 12 }]}>
            Each of the 10 tracks applies a different filter and effect to your ambient
            audio — from spectral reverb and granular stutter to vocoder pulses and
            harmonic freeze. No two listening sessions are ever the same.
          </Text>
        </View>

        {/* Links */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>LISTEN ON SOUNDCLOUD</Text>
          <Pressable
            onPress={() => openLink("https://soundcloud.com/imaginaurium/sets/the-cinema-show-dark-2026")}
            style={({ pressed }) => [
              styles.linkButton,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              The Cinema Show [Dark]
            </Text>
          </Pressable>
          <Pressable
            onPress={() => openLink("https://soundcloud.com/imaginaurium/sets/the-cinema-show-light")}
            style={({ pressed }) => [
              styles.linkButton,
              { borderColor: colors.border },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.linkText, { color: colors.primary }]}>
              The Cinema Show [Light]
            </Text>
          </Pressable>
        </View>

        {/* Credits */}
        <View style={[styles.section, styles.credits]}>
          <Text style={[styles.creditText, { color: colors.muted }]}>
            Music by Robert Peckyno / @streamingkeys
          </Text>
          <Text style={[styles.creditText, { color: colors.muted }]}>
            Album Release: May 1, 2026
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
  artContainer: {
    width: 160,
    height: 160,
    borderRadius: 20,
    overflow: "hidden",
    marginTop: 16,
    marginBottom: 20,
    shadowColor: "#C8A951",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  albumArt: {
    width: 160,
    height: 160,
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
  },
  year: {
    fontSize: 13,
    marginTop: 4,
  },
  divider: {
    width: 60,
    height: 2,
    borderRadius: 1,
    marginVertical: 24,
  },
  section: {
    width: "100%",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    marginBottom: 10,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
  },
  linkButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: "center",
  },
  linkText: {
    fontSize: 15,
    fontWeight: "600",
  },
  credits: {
    alignItems: "center",
    paddingTop: 8,
  },
  creditText: {
    fontSize: 12,
    marginBottom: 4,
  },
});
