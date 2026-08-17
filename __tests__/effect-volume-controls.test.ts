import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const audioEngineSource = readFileSync(
  resolve(process.cwd(), "lib/audio-engine.tsx"),
  "utf8",
);
const micPassthroughSource = readFileSync(
  resolve(process.cwd(), "components/mic-passthrough.tsx"),
  "utf8",
);
const nowPlayingSource = readFileSync(
  resolve(process.cwd(), "app/now-playing.tsx"),
  "utf8",
);

describe("Global wet-effect volume control", () => {
  it("defines a 1.0 default and clamps the shared multiplier to the requested 0.5–1.5 range", () => {
    expect(audioEngineSource).toContain("effectVolumeMultiplier: 1.0");
    expect(audioEngineSource).toContain("Math.max(0.5, Math.min(1.5, action.value))");
    expect(audioEngineSource).toContain("setEffectVolumeMultiplier");
  });

  it("applies the multiplier to wet gain in Web Audio and the native WebView bridge", () => {
    expect(micPassthroughSource).toContain("effectVolumeMultiplier?: number");
    expect(micPassthroughSource).toContain("wetGain.gain.value = getDefaultWetReturnGain(trackId, effectVolumeMultiplier)");
    expect(micPassthroughSource).toContain("chain.wetGain.gain.setValueAtTime(getDefaultWetReturnGain(trackId, effectVolumeMultiplier), t)");
    expect(micPassthroughSource).toContain("startPassthrough(${trackId}, ${bpm}, ${intensity}, ${vol}, ${mix}, ${wetEffectVolume})");
  });
});

describe("Now Playing wet slider and artwork composition", () => {
  it("offers a touch-dragged 0.5×–1.5× slider with a centered 1.0× default", () => {
    expect(nowPlayingSource).toContain("PanResponder.create");
    expect(nowPlayingSource).toContain("setEffectVolumeMultiplier(0.5 + normalized)");
    expect(nowPlayingSource).toContain("0.5×");
    expect(nowPlayingSource).toContain("1.0×");
    expect(nowPlayingSource).toContain("1.5×");
  });

  it("uses 75% track art as a full background and removes the fading toggle circle", () => {
    expect(nowPlayingSource).toContain("style={[styles.backgroundArtwork, { opacity: 0.75 }]}");
    expect(nowPlayingSource).toContain("opacity: 0.75");
    expect(nowPlayingSource).toContain("effectVolumeMultiplier={effectVolumeMultiplier}");
    expect(nowPlayingSource).not.toContain("micToggleGlow");
    expect(nowPlayingSource).not.toContain("animatedMicGlowStyle");
  });

  it("adds a playback-only dust-and-scratches overlay that is monochrome normally and color-shifting with active effects", () => {
    expect(nowPlayingSource).toContain("function FilmDustAndScratches");
    expect(nowPlayingSource).toContain("if (!isPlaying)");
    expect(nowPlayingSource).toContain('markColor.value = "#FFFFFF"');
    expect(nowPlayingSource).toContain("const FILM_EFFECT_COLORS");
    expect(nowPlayingSource).toContain("const beatDuration = Math.max(240, 60000 / Math.max(1, bpm))");
    expect(nowPlayingSource).toContain("const beatIndex = Math.floor((playbackTime * 1000) / beatDuration)");
    expect(nowPlayingSource).toContain("const scratchBurst = useSharedValue(0)");
    expect(nowPlayingSource).toContain("scratchBurst.value = withSequence");
    expect(nowPlayingSource).toContain("FILM_EFFECT_COLORS[Math.floor(Math.random() * FILM_EFFECT_COLORS.length)]");
    expect(nowPlayingSource).toContain("function createFilmDamageFrame()");
    expect(nowPlayingSource).toContain("setDamageFrame(createFilmDamageFrame())");
    expect(nowPlayingSource).toContain("const scratchColor = useSharedValue(\"#050505\")");
    expect(nowPlayingSource).toContain("scratchColor.value = withTiming(nextColor");
    expect(nowPlayingSource).not.toContain("filmColorWash");
    expect(nowPlayingSource).toContain("bpm={currentTrack.bpm}");
    expect(nowPlayingSource).toContain("playbackTime={playbackTime}");
    expect(nowPlayingSource).toContain("styles.filmOverlay");
    expect(nowPlayingSource).toContain("styles.filmScratch");
    expect(nowPlayingSource).toContain("styles.contentLayer");
  });

  it("adds a subtle reel-jitter to artwork on BPM-synchronized downbeats without moving controls", () => {
    expect(nowPlayingSource).toContain("function FilmReelJitter");
    expect(nowPlayingSource).toContain("const beatIndex = Math.floor((playbackTime * 1000) / beatDuration)");
    expect(nowPlayingSource).toContain("beatIndex % 4 !== 0");
    expect(nowPlayingSource).toContain("const horizontalKick = beatIndex % 8 === 0 ? 2 : -1.5");
    expect(nowPlayingSource).toContain("reelRotation.value = withSequence");
    expect(nowPlayingSource).toContain("styles.reelJitterLayer");
    expect(nowPlayingSource).toContain("<FilmReelJitter");
  });

  it("separates the title, timeline, play control, wet slider, and effects toggle with a consistent 40-point rhythm", () => {
    expect(nowPlayingSource).toMatch(/titleArea:\s*\{[\s\S]*?marginBottom: 40/);
    expect(nowPlayingSource).toMatch(/progressArea:\s*\{[\s\S]*?marginBottom: 40/);
    expect(nowPlayingSource).toMatch(/controlsRow:\s*\{[\s\S]*?marginBottom: 40/);
    expect(nowPlayingSource).toMatch(/effectSliderArea:\s*\{[\s\S]*?marginBottom: 40/);
  });

  it("uses full white playback borders and active-effects color-shifting borders instead of moving pixels", () => {
    expect(nowPlayingSource).toContain("function AnimatedButtonBorder");
    expect(nowPlayingSource).toContain("withTiming(\"#FFFFFF\", { duration: 1000");
    expect(nowPlayingSource).toContain("withTiming(\"#FF7CD8\"");
    expect(nowPlayingSource).toContain("withTiming(\"#7BE7FF\"");
    expect(nowPlayingSource).toContain("withTiming(\"#FFF1A6\"");
    expect(nowPlayingSource).toContain("const millisecondsIntoBar = (playbackTime * 1000) % barDuration");
    expect(nowPlayingSource).toContain("const millisecondsUntilBar = Math.max(1, barDuration - millisecondsIntoBar)");
    expect(nowPlayingSource).toContain("const barSyncedColorCycle = withSequence");
    expect(nowPlayingSource).toContain("withTiming(effectColor, { duration: millisecondsUntilBar");
    expect(nowPlayingSource).toContain("withTiming(1.6");
    expect(nowPlayingSource).toContain("barDuration * 0.42");
    expect(nowPlayingSource).toContain("barDuration * 0.58");
    expect(nowPlayingSource).toContain("shadowOpacity: borderPulse.value");
    expect(nowPlayingSource).toContain("isEffectsActive={false}");
    expect(nowPlayingSource).toContain("isEffectsActive={isMicActive && isPlaying}");
    expect(nowPlayingSource).toContain("animatedButtonBorder");
    expect(nowPlayingSource).toContain("styles.playButtonFrame");
    expect(nowPlayingSource).toContain("styles.micToggleFrame");
    expect(nowPlayingSource).toContain("opacity: isPlaying || isEffectsActive ? 1 : 0");
    expect(nowPlayingSource).toContain("zIndex: 20");
    expect(nowPlayingSource).not.toContain("BPMBorderChaser");
    expect(nowPlayingSource).not.toContain("borderChaserPixel");
    expect(nowPlayingSource).toContain("borderWidth: 3");
    expect(nowPlayingSource).toContain("playbackTime={playbackTime}");
  });
});
