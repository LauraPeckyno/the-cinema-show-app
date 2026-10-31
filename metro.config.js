const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// NativeWind writes its compiled styles into react-native-css-interop/.cache.
// In a read-only (hard-linked) install those files can't be overwritten, so
// remove any stale copies first and let NativeWind write fresh ones.
try {
  const cacheDir = path.join(
    path.dirname(require.resolve("react-native-css-interop/package.json")),
    ".cache",
  );
  for (const file of fs.readdirSync(cacheDir)) {
    fs.rmSync(path.join(cacheDir, file), { force: true });
  }
} catch {
  // No cache yet; nothing to clean.
}

const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
