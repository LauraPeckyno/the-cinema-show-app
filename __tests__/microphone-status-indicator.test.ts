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
});
