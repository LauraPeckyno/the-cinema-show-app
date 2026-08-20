import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const micSource = fs.readFileSync(path.join(projectRoot, "components/mic-passthrough.tsx"), "utf8");
describe("manual microphone gate control", () => {
  it("uses a user-selected tight gate instead of attempting to identify a microphone route", () => {
    expect(micSource).toContain("tightGate?: boolean");
    expect(micSource).toContain("strictAccessoryGate ? -2 : -14");
    expect(micSource).toContain("tightGate = false");
    expect(micSource).toContain("setGate(tightGate)");
    expect(micSource).not.toContain("requestBuiltInMicrophoneStream");
    expect(micSource).not.toContain("onInputDeviceChange");
  });

  it("updates the WebView gate without rebuilding the microphone graph", () => {
    expect(micSource).toContain("function setGate(tightGate)");
    expect(micSource).toContain("chain.effectChain.inputGate.threshold.setValueAtTime(tightGate ? -2 : -14");
  });
});
