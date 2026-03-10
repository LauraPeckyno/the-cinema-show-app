import { ScrollView, Text, View, Pressable, StyleSheet, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { ArtDecoDivider, ArtDecoFrame, ArtDecoSunburst, ArtDecoHeader, ArtDecoCorner } from "@/components/art-deco";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const router = useRouter();
  const colors = useColors();

  return (
    <ScreenContainer containerClassName="bg-background">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
          {/* ─── Art Deco Sunburst Header ─── */}
          <View style={styles.sunburstWrap}>
            <ArtDecoSunburst size={SCREEN_WIDTH * 0.6} color={colors.primary} />
          </View>

          {/* ─── Title Section ─── */}
          <View style={styles.titleSection}>
            <Text style={[styles.subtitle, { color: colors.primary }]}>
              {"— AN IMMERSIVE AUDIO EXPERIENCE —"}
            </Text>
            <Text style={[styles.title, { color: colors.foreground }]}>
              THE CINEMA{"\n"}SHOW
            </Text>
            <Text style={[styles.artist, { color: colors.muted }]}>
              by Robert Peckyno
            </Text>
          </View>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.75} color={colors.primary} />

          {/* ─── Headphones Required Notice ─── */}
          <ArtDecoFrame color={colors.primary} style={styles.headphonesFrame}>
            <View style={styles.headphonesContent}>
              <Text style={styles.headphonesIcon}>{"\u{1F3A7}"}</Text>
              <Text style={[styles.headphonesTitle, { color: colors.primary }]}>
                HEADPHONES REQUIRED
              </Text>
              <Text style={[styles.headphonesText, { color: colors.muted }]}>
                This experience uses your device microphone to sample ambient sounds
                and blend them with the music. To avoid audio feedback, please connect
                headphones or earbuds before starting.
              </Text>
            </View>
          </ArtDecoFrame>

          {/* ─── Description ─── */}
          <ArtDecoHeader title="THE EXPERIENCE" color={colors.primary} textColor={colors.foreground} />

          <View style={styles.descriptionSection}>
            <Text style={[styles.description, { color: colors.muted }]}>
              Step into a world where your surroundings become part of the music.
              The Cinema Show captures ambient sounds through your microphone and
              weaves them into an instrumental soundtrack — creating a unique,
              one-of-a-kind listening experience that is different every time.
            </Text>
          </View>

          {/* ─── How It Works ─── */}
          <ArtDecoHeader title="HOW IT WORKS" color={colors.primary} textColor={colors.foreground} />

          <View style={styles.stepsContainer}>
            {[
              { num: "I", text: "Choose a track from the Dark or Light side of the album" },
              { num: "II", text: "Enable your microphone to capture ambient sounds" },
              { num: "III", text: "Each track applies a unique effect to your environment" },
              { num: "IV", text: "The result is a one-of-a-kind immersive soundscape" },
            ].map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={[styles.stepNumContainer, { borderColor: colors.primary + "60" }]}>
                  <Text style={[styles.stepNum, { color: colors.primary }]}>{step.num}</Text>
                </View>
                <Text style={[styles.stepText, { color: colors.foreground }]}>{step.text}</Text>
              </View>
            ))}
          </View>

          <ArtDecoDivider width={SCREEN_WIDTH * 0.6} color={colors.primary} />

          {/* ─── CTA Button ─── */}
          <Pressable
            onPress={() => router.push("/(tabs)/tracks" as any)}
            style={({ pressed }) => [
              styles.ctaButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Text style={[styles.ctaText, { color: colors.background }]}>
              {"\u{1F3AC}"}  EXPLORE THE ALBUM
            </Text>
          </Pressable>

          {/* ─── Album Info ─── */}
          <View style={styles.albumInfo}>
            <Text style={[styles.albumInfoText, { color: colors.muted }]}>
              16 Tracks  {"\u{00B7}"}  Dark & Light Sides  {"\u{00B7}"}  2026
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sunburstWrap: {
    marginBottom: -8,
    opacity: 0.6,
  },
  titleSection: {
    alignItems: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 3,
    marginBottom: 8,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 4,
    lineHeight: 44,
  },
  artist: {
    fontSize: 14,
    fontWeight: "500",
    marginTop: 8,
    letterSpacing: 1,
  },
  headphonesFrame: {
    marginHorizontal: 12,
    marginVertical: 12,
    width: SCREEN_WIDTH - 56,
  },
  headphonesContent: {
    alignItems: "center",
    paddingVertical: 4,
  },
  headphonesIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  headphonesTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  headphonesText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  descriptionSection: {
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  stepsContainer: {
    width: "100%",
    paddingHorizontal: 8,
    marginBottom: 16,
    gap: 12,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  stepNumContainer: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNum: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  ctaButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 8,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 2,
  },
  albumInfo: {
    marginTop: 16,
  },
  albumInfoText: {
    fontSize: 12,
    letterSpacing: 1,
  },
});
