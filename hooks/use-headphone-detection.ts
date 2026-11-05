import { useState, useEffect, useCallback, useRef } from "react";
import { Platform } from "react-native";

export type AudioRoute = "speaker" | "wiredHeadset" | "bluetooth" | "unknown";

/** How long the phone must stay on its speaker before headphones count as unplugged. */
const DISCONNECT_SETTLE_MS = 1500;

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
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

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

        // Subscribe to route changes. Opening the microphone makes the phone
        // shuffle its audio route for a moment (Bluetooth headphones can briefly
        // look like the speaker), so a "speaker" report only counts as a
        // disconnect once it is still true after a short settle and a fresh check.
        const subscription = AudioRouteModule.addListener(
          "onAudioRouteChange",
          (event: { route: AudioRoute }) => {
            if (!isMounted) return;
            const newRoute = event.route;

            if (newRoute !== "speaker") {
              if (settleTimer) {
                clearTimeout(settleTimer);
                settleTimer = null;
              }
              setRoute(newRoute);
              previousRouteRef.current = newRoute;
              return;
            }

            const prevRoute = previousRouteRef.current;
            const hadHeadphones = prevRoute === "wiredHeadset" || prevRoute === "bluetooth";
            if (!hadHeadphones) {
              setRoute(newRoute);
              previousRouteRef.current = newRoute;
              return;
            }

            if (settleTimer) clearTimeout(settleTimer);
            settleTimer = setTimeout(async () => {
              settleTimer = null;
              if (!isMounted) return;
              let confirmed: AudioRoute = "speaker";
              try {
                confirmed = await AudioRouteModule.getCurrentRouteAsync();
              } catch {
                // keep the reported route
              }
              if (!isMounted) return;
              if (confirmed === "speaker") {
                setWasDisconnected(true);
              }
              setRoute(confirmed);
              previousRouteRef.current = confirmed;
            }, DISCONNECT_SETTLE_MS);
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
      if (settleTimer) clearTimeout(settleTimer);
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
