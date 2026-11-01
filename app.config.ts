// Load environment variables with proper priority (system > .env)
import "./scripts/load-env.js";
import type { ConfigContext, ExpoConfig } from "expo/config";

const env = {
  appName: "The Cinema Show",
  appSlug: "the-cinema-show-app",
  // Deep link scheme for the app (e.g. cinemashow://now-playing)
  scheme: "cinemashow",
  iosBundleId: "com.streamingkeys.cinemashow",
  androidPackage: "com.streamingkeys.cinemashow",
};

const config: ExpoConfig = {
  name: env.appName,
  slug: env.appSlug,
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: env.scheme,
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: env.iosBundleId,
    "infoPlist": {
        "ITSAppUsesNonExemptEncryption": false
      }
  },
  android: {
    adaptiveIcon: {
      backgroundColor: "#0A0A14",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    package: env.androidPackage,
    permissions: ["POST_NOTIFICATIONS", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS"],
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: env.scheme,
            host: "*",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-audio",
      {
        microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone.",
      },
    ],
    [
      "expo-video",
      {
        supportsBackgroundPlayback: true,
        supportsPictureInPicture: true,
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0A0A14",
        dark: {
          backgroundColor: "#0A0A14",
        },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          buildArchs: ["armeabi-v7a", "arm64-v8a"],
          minSdkVersion: 24,
        },
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
};

/**
 * Newly's release pipeline passes the build number (ios.buildNumber /
 * android.versionCode) in through the incoming config at release time.
 * Keep those so each TestFlight / Play upload carries the number the store
 * expects; everything else, including the bundle ID, stays as defined above.
 */
export default ({ config: incoming }: ConfigContext): ExpoConfig => ({
  ...config,
  ios: {
    ...config.ios,
    ...(incoming.ios?.buildNumber ? { buildNumber: incoming.ios.buildNumber } : {}),
  },
  android: {
    ...config.android,
    ...(incoming.android?.versionCode ? { versionCode: incoming.android.versionCode } : {}),
  },
});
