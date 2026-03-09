import { Text, View, StyleSheet, FlatList, Pressable, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScreenContainer } from "@/components/screen-container";
import { useColors } from "@/hooks/use-colors";
import { useAudioEngine } from "@/lib/audio-engine";
import { DARK_TRACKS, LIGHT_TRACKS, Track } from "@/constants/tracks";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function TrackCard({ track, onPress }: { track: Track; onPress: () => void }) {
  const colors = useColors();
  const isDark = track.side === "dark";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
      ]}
    >
      {/* Effect color accent bar */}
      <View style={[styles.accentBar, { backgroundColor: track.effect.color }]} />

      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.trackEmoji}>{track.effect.icon}</Text>
          <View style={styles.cardTitleArea}>
            <Text style={[styles.trackTitle, { color: colors.foreground }]} numberOfLines={1}>
              {track.title}
            </Text>
            <Text style={[styles.trackBpm, { color: colors.primary }]}>
              {track.bpm} BPM
            </Text>
          </View>
          <View style={[styles.trackNumber, { backgroundColor: track.effect.color + "30" }]}>
            <Text style={[styles.trackNumberText, { color: track.effect.color }]}>
              {String(track.id).padStart(2, "0")}
            </Text>
          </View>
        </View>

        <Text style={[styles.effectName, { color: track.effect.color }]}>
          {track.effect.name}
        </Text>
        <Text style={[styles.effectDesc, { color: colors.muted }]} numberOfLines={2}>
          {track.effect.description}
        </Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle, isDark }: { title: string; subtitle: string; isDark: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View style={[styles.sectionDot, { backgroundColor: isDark ? "#6A0DAD" : "#FF6F00" }]} />
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      </View>
      <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>{subtitle}</Text>
    </View>
  );
}

export default function TracksScreen() {
  const router = useRouter();
  const colors = useColors();
  const { selectTrack } = useAudioEngine();

  const handleTrackPress = (track: Track) => {
    selectTrack(track);
    router.push("/now-playing" as any);
  };

  const data = [
    { type: "header-dark" as const, key: "header-dark" },
    ...DARK_TRACKS.map((t) => ({ type: "track" as const, key: `track-${t.id}`, track: t })),
    { type: "header-light" as const, key: "header-light" },
    ...LIGHT_TRACKS.map((t) => ({ type: "track" as const, key: `track-${t.id}`, track: t })),
  ];

  return (
    <ScreenContainer containerClassName="bg-background">
      <LinearGradient
        colors={["#0A0A14", "#1A1A2E"]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.headerArea}>
        <Text style={[styles.pageTitle, { color: colors.foreground }]}>SELECT A TRACK</Text>
        <Text style={[styles.pageSubtitle, { color: colors.muted }]}>
          Each track applies a unique filter to your ambient sounds
        </Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          if (item.type === "header-dark") {
            return (
              <SectionHeader
                title="DARK SIDE"
                subtitle="Haunting, atmospheric, and experimental"
                isDark={true}
              />
            );
          }
          if (item.type === "header-light") {
            return (
              <SectionHeader
                title="LIGHT SIDE"
                subtitle="Uplifting, rhythmic, and inspiring"
                isDark={false}
              />
            );
          }
          if (item.type === "track" && "track" in item) {
            return (
              <TrackCard
                track={item.track!}
                onPress={() => handleTrackPress(item.track!)}
              />
            );
          }
          return null;
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 3,
  },
  pageSubtitle: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 2,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
    marginLeft: 18,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
    flexDirection: "row",
  },
  accentBar: {
    width: 4,
  },
  cardContent: {
    flex: 1,
    padding: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  trackEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  cardTitleArea: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  trackBpm: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  trackNumber: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  trackNumberText: {
    fontSize: 13,
    fontWeight: "800",
  },
  effectName: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  effectDesc: {
    fontSize: 12,
    lineHeight: 18,
  },
});
