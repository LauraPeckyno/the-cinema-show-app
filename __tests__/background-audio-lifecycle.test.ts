import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/index.tsx"),
  "utf8",
);
const tracksSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/tracks.tsx"),
  "utf8",
);
const backgroundMusicSource = readFileSync(
  resolve(process.cwd(), "components/background-music.tsx"),
  "utf8",
);

describe("Homepage projector sound lifecycle", () => {
  it("begins a fade before two seconds and pauses the projector at the end", () => {
    expect(homeSource).toContain("}, 1400);");
    expect(homeSource).toContain("const fadeSteps = 6");
    expect(homeSource).toContain("}, 100);");
    expect(homeSource).toContain("projectorPlayer.pause()");
    expect(homeSource).toContain("clearProjectorFade()");
  });
});

describe("Screen background-music restart lifecycle", () => {
  it("restarts homepage background music whenever Home regains focus", () => {
    expect(homeSource).toContain("const [musicRestartKey, setMusicRestartKey] = useState(0)");
    expect(homeSource).toContain("setMusicRestartKey((previous) => previous + 1)");
    expect(homeSource).toContain("https://streamingkeys2.imaginaurium.workers.dev/tpp.mp3");
    expect(homeSource).toContain("<BackgroundMusic");
  });

  it("restarts track-selection background music whenever Tracks regains focus", () => {
    expect(tracksSource).toContain("const [musicRestartKey, setMusicRestartKey] = useState(0)");
    expect(tracksSource).toContain("setMusicRestartKey((previous) => previous + 1)");
    expect(tracksSource).toContain("https://streamingkeys2.imaginaurium.workers.dev/sh3.mp3");
    expect(tracksSource).toContain("<BackgroundMusic");
  });

  it("uses a direct looping player that restarts on focus without SoundCloud code", () => {
    expect(backgroundMusicSource).toContain("useAudioPlayer(source)");
    expect(backgroundMusicSource).toContain("player.loop = true");
    expect(backgroundMusicSource).toContain("player.seekTo(0)");
    expect(backgroundMusicSource).toContain("player.play()");
    expect(`${homeSource}${tracksSource}${backgroundMusicSource}`.toLowerCase()).not.toContain("soundcloud");
  });
});
