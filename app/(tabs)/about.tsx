import { Text, View, StyleSheet, ScrollView, Pressable, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ArtDecoDivider, ArtDecoFrame, ArtDecoHeader, ArtDecoSunburst } from "@/components/art-deco";

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
          <Text style={[styles.bodyText, { color: colors.muted }]}>
            Inspired by the Inception companion app, The Cinema Show uses your device's
            microphone to sample ambient sounds from your environment. These samples are
            then processed with unique audio effects and synced to the BPM of each track,
            creating a one-of-a-kind immersive listening experience that blends your world
            with cinematic music.
          </Text>
          <Text style={[styles.bodyText, { color: colors.muted, marginTop: 12 }]}>
            Each of the 12 tracks applies a different filter and effect to your ambient
            audio — from spectral reverb and granular stutter to vocoder pulses and
            harmonic freeze. No two listening sessions are ever the same.
          </Text>
        </View>

        {/* Links */}
        <ArtDecoHeader title="SOUNDCLOUD" color={colors.primary} textColor={colors.foreground} />
        <View style={styles.section}>
          <ArtDecoFrame color="#8B0000" style={styles.linkFrame}>
            <Pressable
              onPress={() => openLink("https://soundcloud.com/imaginaurium/sets/the-cinema-show-dark-2026")}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.linkText, { color: "#E57373" }]}>
                {"\u{1F311}"}  The Cinema Show [Dark]
              </Text>
              <Text style={[styles.linkDesc, { color: colors.muted }]}>6 tracks — atmospheric and haunting</Text>
            </Pressable>
          </ArtDecoFrame>
          <ArtDecoFrame color={colors.primary} style={styles.linkFrame}>
            <Pressable
              onPress={() => openLink("https://soundcloud.com/imaginaurium/sets/the-cinema-show-light")}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>
                {"\u{2600}\u{FE0F}"}  The Cinema Show [Light]
              </Text>
              <Text style={[styles.linkDesc, { color: colors.muted }]}>6 tracks — uplifting and inspiring</Text>
            </Pressable>
          </ArtDecoFrame>
        </View>

        {/* Credits */}
        <ArtDecoDivider width={160} color={colors.primary} />
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
    width: 140,
    height: 140,
    borderRadius: 16,
    overflow: "hidden",
    marginTop: 16,
    marginBottom: 16,
    shadowColor: "#C8A951",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  albumArt: {
    width: 140,
    height: 140,
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
    marginBottom: 4,
  },
  section: {
    width: "100%",
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  linkFrame: {
    marginBottom: 12,
  },
  linkText: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 4,
  },
  linkDesc: {
    fontSize: 12,
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
