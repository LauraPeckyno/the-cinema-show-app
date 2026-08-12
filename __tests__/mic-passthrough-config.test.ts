import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const micPassthroughSource = readFileSync(
  resolve(process.cwd(), "components/mic-passthrough.tsx"),
  "utf8",
);

describe("Microphone passthrough fixed mix", () => {
  it("uses the requested 25% dry, 80% wet, and 0.80x master mic levels", () => {
    expect(micPassthroughSource).toContain("dryGain.gain.value = 0.25");
    expect(micPassthroughSource).toContain("wetGain.gain.value = 0.80");
    expect(micPassthroughSource).toContain("(musicVolume / 100) * 0.80");
    expect(micPassthroughSource).toContain("chain.dryGain.gain.setValueAtTime(0.25, t)");
    expect(micPassthroughSource).toContain("chain.wetGain.gain.setValueAtTime(0.80, t)");
  });
});

describe("Krampus Wishes reverse return", () => {
  it("uses a strictly descending read cursor rather than resetting every audio callback", () => {
    const caseStart = micPassthroughSource.indexOf("case 4:");
    const caseEnd = micPassthroughSource.indexOf("case 5:", caseStart);
    const krampusChain = micPassthroughSource.slice(caseStart, caseEnd);

    expect(krampusChain).toContain("revReadPos4 = reverseLength4 - 1");
    expect(krampusChain).toContain("revReadPos4 -= 1 / 3");
    expect(krampusChain).not.toContain(
      "readPos = (bufSize4 * 3 - 1) - Math.floor(ro * 0.5)",
    );
  });
});
