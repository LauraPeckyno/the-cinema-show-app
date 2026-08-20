import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const nowPlayingSource = fs.readFileSync(path.join(projectRoot, "app/now-playing.tsx"), "utf8");

describe("Now Playing microphone status indicator", () => {
  it("shows the selected microphone state and built-in microphone guidance", () => {
    expect(nowPlayingSource).toContain('const [microphoneInput, setMicrophoneInput] = useState<MicrophoneInputStatus>("unknown")');
    expect(nowPlayingSource).toContain('label: "Microphone: Built-in"');
    expect(nowPlayingSource).toContain('label: "Microphone: Accessory (Strict Gate)"');
    expect(nowPlayingSource).toContain("Use built-in mic for best results.");
    expect(nowPlayingSource).toContain("onInputDeviceChange={setMicrophoneInput}");
  });
});
