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
