const fs = require("fs");
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

// NativeWind writes its compiled styles into react-native-css-interop/.cache.
// In a read-only (hard-linked) install those files can't be overwritten, so
// swap any read-only file for a writable copy with the same contents. Files are
// never left missing, because another bundler sharing this folder may be using them.
try {
  const cacheDir = path.join(
    path.dirname(require.resolve("react-native-css-interop/package.json")),
    ".cache",
  );
  for (const file of fs.readdirSync(cacheDir)) {
    const filePath = path.join(cacheDir, file);
    try {
      fs.accessSync(filePath, fs.constants.W_OK);
    } catch {
      const contents = fs.readFileSync(filePath);
      fs.unlinkSync(filePath);
      fs.writeFileSync(filePath, contents);
    }
  }
} catch {
  // No cache yet; nothing to fix.
}

const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Force write CSS to file system instead of virtual modules
  // This fixes iOS styling issues in development mode
  forceWriteFileSystem: true,
});
