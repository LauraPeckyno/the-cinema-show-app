import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";

export type AudioRoute = "speaker" | "wiredHeadset" | "bluetooth" | "unknown";

interface HeadphoneState {
  route: AudioRoute;
  isHeadphonesConnected: boolean;
  wasDisconnected: boolean;
}

/**
 * Hook to detect headphone connection state.
 * On native (iOS/Android), uses the expo-audio-route local module.
 * On web, always reports "unknown" (no reliable detection available).
 */
export function useHeadphoneDetection(): HeadphoneState & {
  clearDisconnectedFlag: () => void;
} {
  const [route, setRoute] = useState<AudioRoute>("unknown");
  const [wasDisconnected, setWasDisconnected] = useState(false);
  const previousRouteRef = useRef<AudioRoute>("unknown");
  const moduleRef = useRef<any>(null);
  const listenerRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === "web") {
      // No reliable headphone detection on web
      return;
    }

    let isMounted = true;

    async function init() {
      try {
        // Dynamically import the native module to avoid crashes on web
        const AudioRouteModule = require("@/modules/expo-audio-route").default;
        moduleRef.current = AudioRouteModule;

        // Get initial route
        const currentRoute = await AudioRouteModule.getCurrentRouteAsync();
        if (isMounted) {
          setRoute(currentRoute);
          previousRouteRef.current = currentRoute;
        }

        // Subscribe to route changes
        const { useEventListener } = require("expo");
        // Since we can't use hooks dynamically, use addListener directly
        const subscription = AudioRouteModule.addListener(
          "onAudioRouteChange",
          (event: { route: AudioRoute }) => {
            if (!isMounted) return;
            const newRoute = event.route;
            const prevRoute = previousRouteRef.current;

            // Detect disconnection: was headphones/bluetooth, now speaker
            if (
              (prevRoute === "wiredHeadset" || prevRoute === "bluetooth") &&
              newRoute === "speaker"
            ) {
              setWasDisconnected(true);
            }

            setRoute(newRoute);
            previousRouteRef.current = newRoute;
          }
        );
        listenerRef.current = subscription;
      } catch (error) {
        // Module not available (e.g., running in Expo Go without native build)
        console.warn("[HeadphoneDetection] Native module not available:", error);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (listenerRef.current && listenerRef.current.remove) {
        listenerRef.current.remove();
      }
    };
  }, []);

  const isHeadphonesConnected =
    route === "wiredHeadset" || route === "bluetooth";

  const clearDisconnectedFlag = useCallback(() => {
    setWasDisconnected(false);
  }, []);

  return {
    route,
    isHeadphonesConnected,
    wasDisconnected,
    clearDisconnectedFlag,
  };
}
