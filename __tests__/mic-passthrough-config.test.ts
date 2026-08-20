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
  it("applies fully wet routing and featured wet returns slightly above the music level", () => {
    expect(micPassthroughSource).toContain("function getDefaultDryReturnGain(trackId: number): number");
    expect(micPassthroughSource).toContain("function getDefaultWetReturnGain(trackId: number, effectVolumeMultiplier: number): number");
    expect(micPassthroughSource).toContain("(trackId === 1 || trackId === 2 || trackId === 6) ? 1.40 : 1.0");
    expect(micPassthroughSource).toContain("return 0.80 * trackWetBoost * effectVolumeMultiplier");
    expect(micPassthroughSource).toContain("(musicVolume / 100) * 0.80");
    expect(micPassthroughSource).toContain("chain.wetGain.gain.setValueAtTime(getDefaultWetReturnGain(trackId, effectVolumeMultiplier), t)");
    expect(micPassthroughSource).toContain("wetGain.gain.value = getDefaultWetReturnGain(trackId, effectVolumeMultiplier)");
  });
});

describe("Latest requested per-track DSP refinements", () => {
  it("re-randomizes Recessional’s 1–12 beat stereo echoes every twenty seconds", () => {
    const recessional = branch(7, 8);
    expect(recessional).toContain("Math.random() * 12");
    expect(recessional).toContain("randomize7 * 20");
    expect(recessional).toContain("pan7a.pan.setValueAtTime");
  });

  it("uses Road Show eighth-note on/off syllable chopping and finite randomized BPM delays", () => {
    const roadShow = branch(8, 9);
    expect(roadShow).toContain("syllableLfo8.frequency.value = 1 / beatSec");
    expect(roadShow).toContain("var sampleDelayChoices8 = [beatSec * 2, beatSec * 4, beatSec * 0.33, beatSec * 12]");
    expect(roadShow).toContain("sampleSchedule8 * 20");
    expect(roadShow).toContain("sampleReturn8.connect(analyser)");
  });

  it("re-randomizes Excitement ping-pong timing every twenty-two seconds", () => {
    const excitement = branch(9, 10);
    expect(excitement).toContain("var pingPongChoices9 = [beatSec / 2, beatSec / 3, beatSec / 0.5, beatSec / 8, beatSec / 0.33]");
    expect(excitement).toContain("pingSchedule9 * 22");
    expect(excitement).toContain("delL9.delayTime.setValueAtTime(pingChoice9, pingTime9)");
  });

  it("pans Piano Fandango chorus voices every sixteen beats and adds its delayed half-speed fourth voice", () => {
    const piano = branch(10, 11);
    const muchAdo = branch(11, 12);
    expect(piano).toContain("chorusMerge10.gain.value = 1.0");
    expect(piano).toContain("var chorusPanSection10 = beatSec * 16");
    expect(piano).toContain("chorusPan10.pan.setValueAtTime");
    expect(piano).toContain("dry10.gain.value = 0.5");
    expect(piano).toContain("dryPan10.pan.value = 0");
    expect(piano).toContain("chDel10d.delayTime.value = beatSec * 20");
    expect(piano).toContain("Math.floor(so10 * 0.5)");
    expect(piano).toContain("chPan10d.pan.value = -1 + Math.random() * 2");
    expect(muchAdo).toContain("var eighthTriplet11 = beatSec / 2");
    expect(muchAdo).toContain("tripletGain11a.gain.value = 0.32");
    expect(muchAdo).toContain("tripletGain11b.gain.value = 0.32");
    expect(muchAdo).toContain("tripletGain11c.gain.value = 0.55");
    expect(muchAdo).toContain("deEss11a.type = 'notch'");
  });

  it("uses Corpse Parade’s four-beat listen window with three randomized-speed, independently panned quarter-note returns", () => {
    const corpseParade = branch(1, 2);
    expect(corpseParade).toContain("var corpseMeasure1 = beatSec * 4");
    expect(corpseParade).toContain("listenGate1.gain.setValueAtTime(1, measureStart1)");
    expect(corpseParade).toContain("listenGate1.gain.setValueAtTime(0, measureStart1 + beatSec)");
    expect(corpseParade).toContain("var corpseSpeedChoices1 = [1.0, 0.7, 0.4, 1.6]");
    expect(corpseParade).toContain("beatSec * 16");
    expect(corpseParade).toContain("corpseTap1a.delayTime.value = beatSec");
    expect(corpseParade).toContain("corpseTap1b.delayTime.value = beatSec * 2");
    expect(corpseParade).toContain("corpseTap1c.delayTime.value = beatSec * 3");
    expect(corpseParade).toContain("var corpsePanSection1 = beatSec * 16");
    expect(corpseParade).toContain("randomCorpsePans1(t + panSchedule1 * corpsePanSection1)");
    expect(corpseParade).not.toContain("hardTuneNode1");
    expect(micPassthroughSource).toContain("trackId === 4 ? 0.20 : 0.25");
  });

  it("uses a quarter-note delayed reverse demon chorus with finite reverb", () => {
    const krampus = branch(4, 5);
    expect(krampus).toContain("revReadPos4 -= 1");
    expect(krampus).toContain("quarterDelay4.delayTime.value = beatSec");
    expect(krampus).toContain("demonDoubleDelay4.delayTime.value = 0.028");
    expect(krampus).toContain("demonReverbTimes4 = [0.14, 0.27, 0.43, 0.68, 0.96]");
  });

  it("uses independently panned dual chipmunk taps for Theme for New Beginnings", () => {
    const theme = branch(12, "default");
    expect(theme).toContain("del12Gain.gain.value = 0.42");
    expect(theme).toContain("del12b.delayTime.value = 3.0");
    expect(theme).toContain("del12bGain.gain.value = 0.25");
    expect(theme).toContain("var chipmunkSpeeds12 = [2.0, 1.8, 1.5, 1.3]");
    expect(theme).toContain("beatSec * 128");
    expect(theme).toContain("var chipmunkPanSection12 = beatSec * 24");
    expect(theme).toContain("chipmunkPan12a.pan.setValueAtTime");
    expect(theme).toContain("chipmunkPan12b.pan.setValueAtTime");
    expect(theme).toContain("var chipmunkNode12a = makeChipmunkNode12()");
    expect(theme).toContain("var chipmunkNode12b = makeChipmunkNode12()");
  });

  it("uses dry-free hard-panned randomized, slower half-octave Expiation returns", () => {
    const expiation = branch(6, 7);
    expect(expiation).toContain("expiationDelayChoices6.push(expiationBeat6)");
    expect(expiation).toContain("function makeHalfOctaveSlow6()");
    expect(expiation).toContain("Math.floor(oo6 * 0.75)");
    expect(expiation).toContain("del6Gain.gain.value = 0.72");
    expect(expiation).toContain("del6bGain.gain.value = 0.36");
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

describe("Wet slider microphone lifecycle", () => {
  it("keeps wet-volume updates out of the native start-stop dependency while routing them through setDryWet", () => {
    expect(micPassthroughSource).toContain("}, [isActive, isReady, permissionGranted, trackId, bpm, intensity, vol, mix, preferNativeBuiltInMicrophone]);");
    expect(micPassthroughSource).toContain("setDryWet(${mix}, ${trackId}, ${wetEffectVolume}); true;");
    expect(micPassthroughSource).toContain("}, [mix, trackId, wetEffectVolume, isReady, isActive]);");
    expect(micPassthroughSource).toContain('webViewRef.current.injectJavaScript("stopPassthrough(); true;")');
  });
});
