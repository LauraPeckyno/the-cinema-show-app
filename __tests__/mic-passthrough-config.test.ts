import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const micPassthroughSource = readFileSync(
  resolve(process.cwd(), "components/mic-passthrough.tsx"),
  "utf8",
);

function branch(startCase: number, endCase: number | "default") {
  const start = micPassthroughSource.indexOf(`case ${startCase}:`);
  const end = endCase === "default"
    ? micPassthroughSource.indexOf("default:", start)
    : micPassthroughSource.indexOf(`case ${endCase}:`, start);
  return micPassthroughSource.slice(start, end);
}

describe("Microphone passthrough fixed mix", () => {
  it("retains the 25% dry, 80% wet, and 0.80x master mic mix", () => {
    expect(micPassthroughSource).toContain("trackId === 12 ? 0 : 0.25");
    expect(micPassthroughSource).toContain("wetGain.gain.value = 0.80");
    expect(micPassthroughSource).toContain("(musicVolume / 100) * 0.80");
    expect(micPassthroughSource).toContain("chain.wetGain.gain.setValueAtTime(0.80, t)");
  });

  it("removes both dry returns for Theme for New Beginnings", () => {
    const theme = branch(12, "default");
    expect(theme).toContain("dry12.gain.value = 0.0");
    expect(micPassthroughSource).toContain("trackId === 12 ? 0 : 0.25");
  });
});

describe("Requested per-track DSP refinements", () => {
  it("gates Recessional at -15dB with randomized stereo echoes", () => {
    const recessional = branch(7, 8);
    expect(recessional).toContain("gate7.threshold.value = -15");
    expect(recessional).toContain("echoBeats7a = 1 + Math.floor(Math.random() * 6)");
    expect(recessional).toContain("ctx.createStereoPanner()");
  });

  it("uses 16th-note Road Show gating and a 0.8-gain fixed 12-beat repeat", () => {
    const roadShow = branch(8, 9);
    expect(roadShow).toContain("var gateFreq8 = (bpm / 60) * 4");
    expect(roadShow).toContain("repeatGain8.gain.value = 0.8");
    expect(roadShow).not.toContain("pitchLfo8b");
  });

  it("uses louder hard-panned Excitement returns and a centered dry signal", () => {
    const excitement = branch(9, 10);
    expect(excitement).toContain("gainL9.gain.value = 0.60");
    expect(excitement).toContain("gainR9.gain.value = 0.50");
    expect(excitement).toContain("dryPan9.pan.value = 0");
    expect(excitement).toContain("panL9.pan.value = -1");
    expect(excitement).toContain("panR9.pan.value = 1");
  });

  it("uses a -10dB gated triplet for Much Ado without the hall reverb", () => {
    const muchAdo = branch(11, 12);
    expect(muchAdo).toContain("gate11.threshold.value = -10");
    expect(muchAdo).toContain("triplet11a.delayTime.value = beatSec / 3");
    expect(muchAdo).toContain("stretchReturn11.gain.value = 0.70");
    expect(muchAdo).not.toContain("revMerge11");
  });

  it("replaces Corpse Parade whisper processing with an auto-tuned vocoder", () => {
    const corpseParade = branch(1, 2);
    expect(corpseParade).toContain("whisperVol.gain.value = 0.0");
    expect(corpseParade).toContain("vocoderScale1");
    expect(corpseParade).toContain("vocoderReturn1.gain.value = 0.85");
  });

  it("updates Sleep Deprivation and Mutation and Madness returns", () => {
    const sleep = branch(2, 3);
    const mutation = branch(3, 4);
    expect(sleep).toContain("var fullBeat2 = beatSec");
    expect(sleep).toContain("revMerge2.gain.value = 0.23");
    expect(mutation).toContain("cbInputGain3.gain.value = 1.6");
    expect(mutation).toContain("dry3g.gain.value = 1.4");
  });

  it("runs Krampus Wishes immediately in reverse at two-thirds speed without reverb", () => {
    const krampus = branch(4, 5);
    expect(krampus).toContain("inputBoost.connect(reverseNode4)");
    expect(krampus).toContain("revReadPos4 -= 2 / 3");
    expect(krampus).not.toContain("del4");
    expect(krampus).not.toContain("revMerge4");
  });

  it("randomizes Investigation Station and tightens octave-down Expiation returns", () => {
    const investigation = branch(5, 6);
    const expiation = branch(6, 7);
    expect(investigation).toContain("var rotaryMultipliers5 = [2, 3, 4, 1 / 3, 10]");
    expect(investigation).toContain("switch5 * 5");
    expect(expiation).toContain("gate6.threshold.value = -15");
    expect(expiation).toContain("function makeOctaveDown6()");
    expect(expiation).toContain("del6Gain.gain.value = 0.5");
    expect(expiation).toContain("del6bGain.gain.value = 0.25");
  });
});
