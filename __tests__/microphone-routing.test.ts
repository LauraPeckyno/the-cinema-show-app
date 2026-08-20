import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");
const micSource = fs.readFileSync(path.join(projectRoot, "components/mic-passthrough.tsx"), "utf8");
const iosSource = fs.readFileSync(
  path.join(projectRoot, "modules/expo-audio-route/ios/ExpoAudioRouteModule.swift"),
  "utf8",
);
const androidSource = fs.readFileSync(
  path.join(projectRoot, "modules/expo-audio-route/android/src/main/java/expo/modules/audioroute/ExpoAudioRouteModule.kt"),
  "utf8",
);

describe("built-in microphone preference", () => {
  it("selects an identified built-in input by exact device ID before creating effects", () => {
    expect(micSource).toContain("requestBuiltInMicrophoneStream");
    expect(micSource).toContain("navigator.mediaDevices.enumerateDevices()");
    expect(micSource).toContain("deviceId: { exact: deviceId }");
    expect(micSource).toContain("ACCESSORY_MICROPHONE_LABEL");
    expect(micSource).toContain("Disconnect the headset or Bluetooth microphone before activating effects.");
  });

  it("applies iOS built-in microphone routing before native WebView capture", () => {
    expect(iosSource).toContain('AsyncFunction("preferBuiltInMicrophoneAsync")');
    expect(iosSource).toContain(".builtInMic");
    expect(iosSource).toContain("setPreferredInput(builtInMic)");
    expect(micSource).toContain("preferNativeBuiltInMicrophone");
    expect(micSource).toContain("await preferNativeBuiltInMicrophone()");
  });

  it("documents Android WebView device selection as the safe routing fallback", () => {
    expect(androidSource).toContain('"webview_device_selection_required"');
    expect(androidSource).toContain("AudioDeviceInfo.TYPE_BUILTIN_MIC");
  });
});
