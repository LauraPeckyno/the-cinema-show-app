import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(resolve(process.cwd(), "app/(tabs)/index.tsx"), "utf8");
const tracksSource = readFileSync(resolve(process.cwd(), "app/(tabs)/tracks.tsx"), "utf8");

describe("Home and Track Selection cinematic transitions", () => {
  it("reveals the keysrose artwork with a scroll-triggered smooth fade", () => {
    expect(homeSource).toContain("const keysRoseFadeOpacity = useSharedValue(0)");
    expect(homeSource).toContain("const handleHomeScroll");
    expect(homeSource).toContain("keysRoseFadeOpacity.value = withTiming(1, { duration: 700");
    expect(homeSource).toContain("scrollEventThrottle={16}");
    expect(homeSource).toContain("style={[styles.keysRoseContainer, keysRoseFadeStyle]}");
  });

  it("stages Track Selection through a black curtain fade and gentle rise", () => {
    expect(tracksSource).toContain("const runSceneEntrance");
    expect(tracksSource).toContain("curtainOpacity.value = withTiming(0, { duration: 520");
    expect(tracksSource).toContain("sceneTranslateY.value = 22");
    expect(tracksSource).toContain("withDelay(100, withTiming(1, { duration: 540");
    expect(tracksSource).toContain("styles.cinemaCurtain");
    expect(tracksSource).toContain("runSceneEntrance();");
  });
});
