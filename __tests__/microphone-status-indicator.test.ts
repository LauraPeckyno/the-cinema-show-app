import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const nowPlayingSource = fs.readFileSync(path.join(projectRoot, "app/now-playing.tsx"), "utf8");

describe("Now Playing manual Gate switch", () => {
  it("places Open and Tight gate controls below the Effects button", () => {
    expect(nowPlayingSource).toContain("const [isTightGate, setIsTightGate] = useState(false)");
    expect(nowPlayingSource).toContain("tightGate={isTightGate}");
    expect(nowPlayingSource).not.toContain("Microphone: Built-in");
    expect(nowPlayingSource).not.toContain("Use built-in mic for best results.");
  });

  it("shows the requested Gate guidance only on the first user interaction", () => {
    expect(nowPlayingSource).toContain('const GATE_GUIDANCE_STORAGE_KEY = "@the-cinema-show/gate-guidance-seen-v1"');
    expect(nowPlayingSource).toContain("AsyncStorage.getItem(GATE_GUIDANCE_STORAGE_KEY)");
    expect(nowPlayingSource).toContain("gateGuidanceSeenRef.current = true");
    expect(nowPlayingSource).toContain("setShowGateGuidance(true)");
    expect(nowPlayingSource).toContain("Use the Open Gate for normal environments and over-ear headphones");
    expect(nowPlayingSource).toContain("If you use earbuds with a mic and there is feedback, use the Tight Gate");
    expect(nowPlayingSource).toContain("Got it");
  });
});
