import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";

import type { Track } from "@/constants/tracks";

const DEVICE_MUSIC_ALBUM = "Music";
const LOCAL_DOWNLOAD_DIRECTORY = `${FileSystem.documentDirectory}cinema-show-downloads/`;

export type AlbumDownloadProgress = {
  completed: number;
  total: number;
  trackTitle: string;
};

export class AlbumDownloadError extends Error {
  constructor(public readonly code: "unsupported" | "permission-denied" | "download-failed") {
    super(code);
  }
}

/**
 * Downloads each album MP3, then registers it in the device Music library.
 * On Android this places the files in the user-accessible Music collection.
 */
export async function downloadAlbumToMusic(
  tracks: Track[],
  onProgress?: (progress: AlbumDownloadProgress) => void,
) {
  if (Platform.OS === "web") {
    throw new AlbumDownloadError("unsupported");
  }

  const permission = Platform.OS === "android"
    ? await MediaLibrary.requestPermissionsAsync(false, ["audio"])
    : await MediaLibrary.requestPermissionsAsync();

  if (!permission.granted) {
    throw new AlbumDownloadError("permission-denied");
  }

  await FileSystem.makeDirectoryAsync(LOCAL_DOWNLOAD_DIRECTORY, { intermediates: true });
  let musicAlbum = await MediaLibrary.getAlbumAsync(DEVICE_MUSIC_ALBUM);

  for (let index = 0; index < tracks.length; index += 1) {
    const track = tracks[index];
    const filename = `${String(index + 1).padStart(2, "0")}-${track.audioUrl.split("/").pop()}`;
    const destination = `${LOCAL_DOWNLOAD_DIRECTORY}${filename}`;

    try {
      const result = await FileSystem.downloadAsync(track.audioUrl, destination);
      const asset = await MediaLibrary.createAssetAsync(result.uri);

      if (musicAlbum) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], musicAlbum, false);
      } else {
        musicAlbum = await MediaLibrary.createAlbumAsync(DEVICE_MUSIC_ALBUM, asset, false);
      }
    } catch (error) {
      console.error(`Unable to download ${track.title}:`, error);
      throw new AlbumDownloadError("download-failed");
    }

    onProgress?.({ completed: index + 1, total: tracks.length, trackTitle: track.title });
  }
}
