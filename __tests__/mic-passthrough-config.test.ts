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
  it("retains the 80% wet and 0.80x master mic mix while disabling global dry for the requested tracks", () => {
    expect(micPassthroughSource).toContain("(trackId === 1 || trackId === 6 || trackId === 12) ? 0 : 0.25");
    expect(micPassthroughSource).toContain("wetGain.gain.value = 0.80");
    expect(micPassthroughSource).toContain("(musicVolume / 100) * 0.80");
    expect(micPassthroughSource).toContain("chain.wetGain.gain.setValueAtTime(0.80, t)");
  });
});

describe("Latest requested per-track DSP refinements", () => {
  it("re-randomizes Recessional’s 1–12 beat stereo echoes every twenty seconds", () => {
    const recessional = branch(7, 8);
    expect(recessional).toContain("Math.random() * 12");
    expect(recessional).toContain("randomize7 * 20");
    expect(recessional).toContain("pan7a.pan.setValueAtTime");
  });

  it("uses the requested slow Road Show base rate and randomly scheduled full on/off gate", () => {
    const roadShow = branch(8, 9);
    expect(roadShow).toContain("var gateFreq8 = 0.01 / beatSec");
    expect(roadShow).toContain("var outputOnChoices8 = [0.25 * bpm, 0.33 * bpm, 0.5 * bpm, 4.0 * bpm, 10 * bpm]");
    expect(roadShow).toContain("outputGateCursor8 += outputOnDuration8 + bpm * 4");
    expect(roadShow).toContain("outputGate8.connect(analyser)");
  });

  it("re-randomizes Excitement ping-pong timing every twenty-two seconds", () => {
    const excitement = branch(9, 10);
    expect(excitement).toContain("var pingPongChoices9 = [beatSec / 2, beatSec / 3, beatSec / 0.5, beatSec / 8, beatSec / 0.33]");
    expect(excitement).toContain("pingSchedule9 * 22");
    expect(excitement).toContain("delL9.delayTime.setValueAtTime(pingChoice9, pingTime9)");
  });

  it("raises Piano Fandango chorus and uses de-essed eighth-note Much Ado triplets", () => {
    const piano = branch(10, 11);
    const muchAdo = branch(11, 12);
    expect(piano).toContain("chorusMerge10.gain.value = 1.0");
    expect(muchAdo).toContain("var eighthTriplet11 = beatSec / 2");
    expect(muchAdo).toContain("tripletGain11a.gain.value = 0.32");
    expect(muchAdo).toContain("tripletGain11b.gain.value = 0.32");
    expect(muchAdo).toContain("tripletGain11c.gain.value = 0.55");
    expect(muchAdo).toContain("deEss11a.type = 'notch'");
  });

  it("uses a stronger D-minor Corpse Parade vocoder without a global dry return", () => {
    const corpseParade = branch(1, 2);
    expect(corpseParade).toContain("vocoderReturn1.gain.value = 1.5");
    expect(corpseParade).toContain("vocoderScale1 = [146.83, 174.61, 196.00, 220.00, 233.08, 261.63, 293.66, 349.23, 392.00, 440.00]");
    expect(micPassthroughSource).toContain("trackId === 1 || trackId === 6 || trackId === 12");
  });

  it("uses a normal-speed dry-free Krampus reverse return", () => {
    const krampus = branch(4, 5);
    expect(krampus).toContain("revReadPos4 -= 1");
    expect(krampus).toContain("dry4g.gain.value = 0.0");
  });

  it("uses dual randomized-speed chipmunk taps for Theme for New Beginnings", () => {
    const theme = branch(12, "default");
    expect(theme).toContain("del12b.delayTime.value = 1.5");
    expect(theme).toContain("del12bGain.gain.value = 0.25");
    expect(theme).toContain("var chipmunkSpeeds12 = [2.0, 1.8, 1.5, 1.3]");
    expect(theme).toContain("beatSec * 128");
  });

  it("uses dry-free hard-panned one-octave Expiation returns", () => {
    const expiation = branch(6, 7);
    expect(expiation).toContain("function makeOctaveDown6()");
    expect(expiation).toContain("pan6a.pan.value = -1");
    expect(expiation).toContain("pan6b.pan.value = 1");
    expect(expiation).toContain("dry6g.gain.value = 0.0");
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
