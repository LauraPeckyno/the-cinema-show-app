import { describe, it, expect } from "vitest";
import { getEffectProcessor } from "../lib/audio-effects";
import { TRACKS, DARK_TRACKS, LIGHT_TRACKS } from "../constants/tracks";

describe("Track Data", () => {
  it("should have exactly 10 tracks", () => {
    expect(TRACKS.length).toBe(10);
  });

  it("should have 5 dark tracks and 5 light tracks", () => {
    expect(DARK_TRACKS.length).toBe(5);
    expect(LIGHT_TRACKS.length).toBe(5);
  });

  it("each track should have required fields", () => {
    TRACKS.forEach((track) => {
      expect(track.id).toBeGreaterThan(0);
      expect(track.title).toBeTruthy();
      expect(track.side).toMatch(/^(dark|light)$/);
      expect(track.bpm).toBeGreaterThan(0);
      expect(track.bpm).toBeLessThan(200);
      expect(track.soundcloudUrl).toContain("soundcloud.com");
      expect(track.effect.name).toBeTruthy();
      expect(track.effect.description).toBeTruthy();
      expect(track.effect.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(track.durationEstimate).toBeGreaterThan(0);
    });
  });

  it("each track should have a unique ID", () => {
    const ids = TRACKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each track should have a unique effect name", () => {
    const names = TRACKS.map((t) => t.effect.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("Audio Effects Processor", () => {
  it("should return a processor for each track ID", () => {
    for (let i = 1; i <= 10; i++) {
      const processor = getEffectProcessor(i);
      expect(typeof processor).toBe("function");
    }
  });

  it("should return default processor for unknown track ID", () => {
    const processor = getEffectProcessor(999);
    expect(typeof processor).toBe("function");
  });

  it("each processor should return valid output for zero mic level", () => {
    for (let i = 1; i <= 10; i++) {
      const processor = getEffectProcessor(i);
      const result = processor(0, 120, 0.5, 1.0);
      expect(result).toHaveProperty("processedLevel");
      expect(result).toHaveProperty("visualizerModifier");
      expect(result).toHaveProperty("pulseRate");
      expect(typeof result.processedLevel).toBe("number");
      expect(typeof result.visualizerModifier).toBe("number");
      expect(typeof result.pulseRate).toBe("number");
    }
  });

  it("each processor should return valid output for max mic level", () => {
    for (let i = 1; i <= 10; i++) {
      const processor = getEffectProcessor(i);
      const result = processor(1.0, 120, 1.0, 5.0);
      expect(result.processedLevel).toBeGreaterThanOrEqual(0);
      expect(result.processedLevel).toBeLessThanOrEqual(2); // Allow some headroom
      expect(result.visualizerModifier).toBeGreaterThan(0);
      expect(result.pulseRate).toBeGreaterThan(0);
    }
  });

  it("processors should produce different outputs for different tracks", () => {
    const results = [];
    for (let i = 1; i <= 10; i++) {
      const processor = getEffectProcessor(i);
      const result = processor(0.5, 100, 0.5, 2.0);
      results.push(result);
    }
    // Not all results should be identical
    const uniqueProcessedLevels = new Set(results.map((r) => r.processedLevel.toFixed(4)));
    expect(uniqueProcessedLevels.size).toBeGreaterThan(1);
  });

  it("effect intensity should affect output", () => {
    for (let i = 1; i <= 10; i++) {
      const processor = getEffectProcessor(i);
      const lowIntensity = processor(0.5, 100, 0.1, 2.0);
      const highIntensity = processor(0.5, 100, 0.9, 2.0);
      // At least one property should differ
      const differs =
        lowIntensity.processedLevel !== highIntensity.processedLevel ||
        lowIntensity.visualizerModifier !== highIntensity.visualizerModifier ||
        lowIntensity.pulseRate !== highIntensity.pulseRate;
      expect(differs).toBe(true);
    }
  });

  it("BPM should affect pulse rate", () => {
    const processor = getEffectProcessor(6); // Rhythmic Gate
    const slow = processor(0.5, 60, 0.5, 2.0);
    const fast = processor(0.5, 140, 0.5, 2.0);
    expect(fast.pulseRate).toBeGreaterThan(slow.pulseRate);
  });
});
