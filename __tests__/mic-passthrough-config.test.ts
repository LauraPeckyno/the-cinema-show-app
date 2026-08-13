import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const micPassthroughSource = readFileSync(
  resolve(process.cwd(), "components/mic-passthrough.tsx"),
  "utf8",
);
const nowPlayingSource = readFileSync(
  resolve(process.cwd(), "app/now-playing.tsx"),
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
  it("uses 1–12 beat independently panned Recessional echoes", () => {
    const recessional = branch(7, 8);
    expect(recessional).toContain("Math.random() * 12");
    expect(recessional).toContain("ctx.createStereoPanner()");
  });

  it("uses randomized Road Show stutters with zero dry return and the requested glide rate", () => {
    const roadShow = branch(8, 9);
    expect(roadShow).toContain("var stutterChoices8 = [beatSec / 2, beatSec, beatSec * 2, beatSec * 4]");
    expect(roadShow).toContain("var stutterSection8 = beatSec * 16");
    expect(roadShow).toContain("pitchLfo8.frequency.value = (1 / beatSec) * 12");
    expect(roadShow).toContain("repeatGain8.gain.value = 0.8");
    expect(roadShow).not.toContain("gateGain8.connect(analyser)");
  });

  it("tightens Excitement’s gate and increases its phaser depth", () => {
    const excitement = branch(9, 10);
    expect(excitement).toContain("gate9.threshold.value = -15");
    expect(excitement).toContain("phaserDepth9.gain.value = 9000 + intensity * 12000");
    expect(excitement).toContain("phaserDepth9b.gain.value = 7000");
  });

  it("raises Piano Fandango chorus gain and removes Much Ado time stretching", () => {
    const piano = branch(10, 11);
    const muchAdo = branch(11, 12);
    expect(piano).toContain("chorusMerge10.gain.value = 0.75");
    expect(muchAdo).toContain("var quarterTriplet11 = beatSec");
    expect(muchAdo).toContain("triplet11a.delayTime.value = quarterTriplet11 / 3");
    expect(muchAdo).not.toContain("stretchNode11");
  });

  it("uses a human-range random D-minor vocoder without a Corpse Parade dry return", () => {
    const corpseParade = branch(1, 2);
    expect(corpseParade).toContain("vocoderScale1 = [146.83, 174.61, 196.00, 220.00, 233.08, 261.63, 293.66, 349.23, 392.00, 440.00]");
    expect(corpseParade).toContain("vocoderScale1[Math.floor(Math.random() * vocoderScale1.length)]");
    expect(corpseParade).toContain("vocoderReturn1.gain.value = 1.02");
    expect(corpseParade).toContain("whisperVol.gain.value = 0.0");
  });

  it("randomizes Sleep Deprivation delay values every sixteen beats", () => {
    const sleep = branch(2, 3);
    expect(sleep).toContain("var sleepDelayChoices2 = [1, 2, 4, 12]");
    expect(sleep).toContain("var sleepDelaySection2 = beatSec * 16");
    expect(sleep).toContain("del2a.delayTime.setValueAtTime(beatSec * sleepChoiceA2, sleepTime2)");
    expect(sleep).toContain("del2b.delayTime.setValueAtTime(beatSec * sleepChoiceB2, sleepTime2)");
  });

  it("uses a dry-free one-third-speed Krampus reverse return", () => {
    const krampus = branch(4, 5);
    expect(krampus).toContain("revReadPos4 -= 1 / 3");
    expect(krampus).toContain("dry4g.gain.value = 0.0");
    expect(krampus).not.toContain("del4");
    expect(krampus).not.toContain("revMerge4");
  });

  it("uses the requested Expiation timing, two-octave second return, and louder gains", () => {
    const expiation = branch(6, 7);
    expect(expiation).toContain("del6.delayTime.value = beatSec * 2");
    expect(expiation).toContain("del6b.delayTime.value = beatSec * 4");
    expect(expiation).toContain("function makeTwoOctaveDown6()");
    expect(expiation).toContain("del6Gain.gain.value = 0.60");
    expect(expiation).toContain("del6bGain.gain.value = 0.30");
  });
});

describe("Universal pre-finish microphone fade", () => {
  it("detects the final two seconds in Now Playing and ramps all mic output down on both platforms", () => {
    expect(nowPlayingSource).toContain("trackDuration - 2");
    expect(nowPlayingSource).toContain("shouldFadeOut={shouldFadeMicOutput}");
    expect(micPassthroughSource).toContain("shouldFadeOut?: boolean");
    expect(micPassthroughSource).toContain("linearRampToValueAtTime(0, now + 2.0)");
    expect(micPassthroughSource).toContain("function fadeMicOutput(shouldFadeOut, vol)");
  });
});
