import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const homeSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/index.tsx"),
  "utf8",
);

describe("Home screen keysrose artwork", () => {
  it("places the supplied image after Headphones Required at 90% viewport width", () => {
    expect(homeSource).toContain('const KEYS_ROSE_URL = "https://streamingkeys2.imaginaurium.workers.dev/keysrose.jpg"');
    expect(homeSource.indexOf("styles.keysRoseContainer")).toBeGreaterThan(
      homeSource.indexOf("styles.headphonesNotice"),
    );
    expect(homeSource).toContain("source={{ uri: KEYS_ROSE_URL }}");
    expect(homeSource).toContain("width: SCREEN_WIDTH * 0.9");
    expect(homeSource).toContain("height: SCREEN_WIDTH * 0.9");
  });
});
