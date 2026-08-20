import { NativeModule, requireNativeModule } from "expo";
import {
  AudioRoute,
  BuiltInMicrophonePreferenceResult,
  ExpoAudioRouteModuleEvents,
} from "./ExpoAudioRoute.types";

declare class ExpoAudioRouteModule extends NativeModule<ExpoAudioRouteModuleEvents> {
  getCurrentRouteAsync(): Promise<AudioRoute>;
  preferBuiltInMicrophoneAsync(): Promise<BuiltInMicrophonePreferenceResult>;
}

// This call loads the native module object from the JSI.
export default requireNativeModule<ExpoAudioRouteModule>("ExpoAudioRoute");
