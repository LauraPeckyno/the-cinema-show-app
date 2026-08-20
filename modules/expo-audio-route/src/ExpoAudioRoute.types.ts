export type ExpoAudioRouteModuleEvents = {
  onAudioRouteChange: (params: RouteChangeEvent) => void;
};

export type RouteChangeEvent = {
  route: AudioRoute;
};

export type AudioRoute =
  | "speaker"
  | "wiredHeadset"
  | "bluetooth"
  | "unknown";

export type BuiltInMicrophonePreferenceResult = {
  applied: boolean;
  available: boolean;
  platform: "ios" | "android";
  reason?: string;
};
