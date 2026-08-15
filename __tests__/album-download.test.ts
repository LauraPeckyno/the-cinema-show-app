import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const downloadSource = readFileSync(
  resolve(process.cwd(), "lib/album-download.ts"),
  "utf8",
);
const tracksSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/tracks.tsx"),
  "utf8",
);
const appConfigSource = readFileSync(
  resolve(process.cwd(), "app.config.ts"),
  "utf8",
);

describe("Full-album MP3 download", () => {
  it("requests audio-library access only when the download action starts", () => {
    expect(downloadSource).toContain("MediaLibrary.requestPermissionsAsync(false, [\"audio\"])");
    expect(downloadSource).toContain("throw new AlbumDownloadError(\"permission-denied\")");
    expect(tracksSource).toContain("const handleAlbumDownload = async () =>");
    expect(tracksSource).toContain("await downloadAlbumToMusic(ALBUM_PLAYBACK_QUEUE, setDownloadProgress)");
  });

  it("downloads every queued Cloudflare MP3 and creates media assets in the device Music collection", () => {
    expect(downloadSource).toContain('const DEVICE_MUSIC_ALBUM = "Music"');
    expect(downloadSource).toContain("FileSystem.downloadAsync(track.audioUrl, destination)");
    expect(downloadSource).toContain("MediaLibrary.createAssetAsync(result.uri)");
    expect(downloadSource).toContain("MediaLibrary.createAlbumAsync(DEVICE_MUSIC_ALBUM, asset, false)");
    expect(downloadSource).toContain("onProgress?.({ completed: index + 1, total: tracks.length, trackTitle: track.title })");
  });

  it("places an Add to my Library control beneath the filmstrips and configures audio permission support", () => {
    expect(tracksSource).toContain('"Add to my Library"');
    expect(tracksSource).toContain("styles.downloadArea");
    expect(appConfigSource).toContain('"expo-media-library"');
    expect(appConfigSource).toContain('granularPermissions: ["audio"]');
  });

  it("keeps the completed state while removing the album count and file-size badge", () => {
    expect(tracksSource).toContain('? "Downloaded"');
    expect(tracksSource).toContain("downloadComplete && styles.downloadButtonComplete");
    expect(tracksSource).toContain('borderColor: "#55D68B"');
    expect(tracksSource).not.toContain("downloadSizeBadge");
    expect(tracksSource).not.toContain("formatAlbumSize");
    expect(downloadSource).not.toContain("getAlbumSizeBytes");
  });
});
