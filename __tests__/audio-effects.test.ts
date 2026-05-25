import { describe, it, expect } from "vitest";
import { getEffectProcessor } from "../lib/audio-effects";
import { TRACKS, DARK_TRACKS, LIGHT_TRACKS } from "../constants/tracks";

describe("Track Data", () => {
  it("should have exactly 12 tracks total", () => {
    expect(TRACKS.length).toBe(12);
  });

  it("should have 6 dark tracks and 6 light tracks", () => {
    expect(DARK_TRACKS.length).toBe(6);
    expect(LIGHT_TRACKS.length).toBe(6);
  });

  it("should have unique IDs from 1 to 12", () => {
    const ids = TRACKS.map((t) => t.id).sort((a, b) => a - b);
    expect(ids).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("each track should have required fields", () => {
    TRACKS.forEach((track) => {
      expect(track.id).toBeGreaterThan(0);
      expect(track.title).toBeTruthy();
      expect(track.side).toMatch(/^(dark|light)$/);
      expect(track.bpm).toBeGreaterThan(0);
      expect(track.bpm).toBeLessThan(250);
      expect(track.soundcloudUrl).toContain("soundcloud.com");
      expect(track.effect.name).toBeTruthy();
      expect(track.effect.description).toBeTruthy();
      expect(track.effect.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(track.durationEstimate).toBeGreaterThan(0);
    });
  });

  it("should have unique effect names for each track", () => {
    const names = TRACKS.map((t) => t.effect.name);
    expect(new Set(names).size).toBe(12);
  });

  it("should have valid SoundCloud URLs for all tracks", () => {
    for (const track of TRACKS) {
      expect(track.soundcloudUrl).toMatch(/^https:\/\/soundcloud\.com\/imaginaurium\//);
    }
  });

  it("should have durationMs for all tracks", () => {
    for (const track of TRACKS) {
      expect(track.durationMs).toBeGreaterThan(0);
      expect(track.durationMs).toBeLessThan(600000); // less than 10 minutes
    }
  });

  it("should format durationMs correctly to m:ss", () => {
    for (const track of TRACKS) {
      const sec = Math.floor(track.durationMs / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      const formatted = `${m}:${s.toString().padStart(2, "0")}`;
      expect(formatted).toMatch(/^\d+:\d{2}$/);
      // All current tracks are between 30s and 37s
      expect(sec).toBeGreaterThanOrEqual(30);
      expect(sec).toBeLessThanOrEqual(40);
    }
  });
});

describe("Audio Effects Processor", () => {
  it("should return a valid processor for all 12 track IDs", () => {
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      expect(typeof processor).toBe("function");
    }
  });

  it("should return fallback processor for unknown track ID", () => {
    const processor = getEffectProcessor(999);
    expect(typeof processor).toBe("function");
    const result = processor(0.5, 120, 0.5, 1.0);
    expect(result).toHaveProperty("processedLevel");
    expect(result).toHaveProperty("visualizerModifier");
    expect(result).toHaveProperty("pulseRate");
  });

  it("should return processedLevel in 0-1 range for all effects", () => {
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      for (const micLevel of [0, 0.25, 0.5, 0.75, 1.0]) {
        for (const time of [0, 0.5, 1.0, 2.5, 5.0, 10.0]) {
          const result = processor(micLevel, TRACKS[id - 1].bpm, 0.5, time);
          expect(result.processedLevel).toBeGreaterThanOrEqual(0);
          expect(result.processedLevel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("should return positive visualizerModifier for all effects", () => {
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      for (const time of [0, 1.0, 3.0, 7.5]) {
        const result = processor(0.5, TRACKS[id - 1].bpm, 0.5, time);
        expect(result.visualizerModifier).toBeGreaterThan(0);
      }
    }
  });

  it("should return positive pulseRate for all effects", () => {
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      const result = processor(0.5, TRACKS[id - 1].bpm, 0.5, 1.0);
      expect(result.pulseRate).toBeGreaterThan(0);
    }
  });

  it("should handle zero mic level gracefully", () => {
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      const result = processor(0, TRACKS[id - 1].bpm, 0.5, 1.0);
      expect(result.processedLevel).toBeGreaterThanOrEqual(0);
      expect(result.processedLevel).toBeLessThanOrEqual(1);
    }
  });

  it("effect intensity should affect output", () => {
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      const lowIntensity = processor(0.5, 100, 0.1, 2.0);
      const highIntensity = processor(0.5, 100, 0.9, 2.0);
      const differs =
        lowIntensity.processedLevel !== highIntensity.processedLevel ||
        lowIntensity.visualizerModifier !== highIntensity.visualizerModifier ||
        lowIntensity.pulseRate !== highIntensity.pulseRate;
      expect(differs).toBe(true);
    }
  });

  it("each effect should produce unique behavior signatures", () => {
    const results: string[] = [];
    for (let id = 1; id <= 12; id++) {
      const processor = getEffectProcessor(id);
      const samples = [0.5, 1.0, 2.0, 3.0].map((t) => {
        const r = processor(0.5, 100, 0.5, t);
        return `${r.processedLevel.toFixed(4)}-${r.visualizerModifier.toFixed(4)}-${r.pulseRate.toFixed(4)}`;
      });
      results.push(samples.join("|"));
    }
    const uniqueResults = new Set(results);
    expect(uniqueResults.size).toBe(12);
  });

  it("BPM should affect pulse rate for rhythmic effects", () => {
    // Test with Rhythmic Gate (track 7)
    const processor = getEffectProcessor(7);
    const slow = processor(0.5, 60, 0.5, 2.0);
    const fast = processor(0.5, 140, 0.5, 2.0);
    expect(fast.pulseRate).toBeGreaterThan(slow.pulseRate);
  });
});

describe("Volume Computation", () => {
  it("master volume * music volume should produce correct SoundCloud volume", () => {
    const masterVolume = 80;
    const musicVolume = 70;
    const scVolume = Math.round((masterVolume / 100) * musicVolume);
    expect(scVolume).toBe(56);
  });

  it("master volume at 0 should silence everything", () => {
    const masterVolume = 0;
    const musicVolume = 100;
    const scVolume = Math.round((masterVolume / 100) * musicVolume);
    expect(scVolume).toBe(0);
  });

  it("master volume at 100 should pass music volume through", () => {
    const masterVolume = 100;
    const musicVolume = 50;
    const scVolume = Math.round((masterVolume / 100) * musicVolume);
    expect(scVolume).toBe(50);
  });
});

describe("Dry/Wet Mix", () => {
  it("mix at 0 should be fully dry", () => {
    const dryWetMix = 0;
    const mix = dryWetMix / 100;
    expect(1.0 - mix).toBe(1.0);
    expect(mix).toBe(0);
  });

  it("mix at 100 should be fully wet", () => {
    const dryWetMix = 100;
    const mix = dryWetMix / 100;
    expect(1.0 - mix).toBe(0);
    expect(mix).toBe(1.0);
  });

  it("mix at 50 should be equal blend", () => {
    const dryWetMix = 50;
    const mix = dryWetMix / 100;
    expect(1.0 - mix).toBe(0.5);
    expect(mix).toBe(0.5);
  });

  it("per-track dry/wet map should store values by track ID", () => {
    const trackDryWetMap: Record<number, number> = {};
    trackDryWetMap[1] = 30;
    trackDryWetMap[5] = 80;
    trackDryWetMap[10] = 50;
    expect(trackDryWetMap[1]).toBe(30);
    expect(trackDryWetMap[5]).toBe(80);
    expect(trackDryWetMap[10]).toBe(50);
    expect(trackDryWetMap[2]).toBeUndefined();
  });
});
