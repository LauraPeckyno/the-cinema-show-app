import { Platform } from "react-native";

/**
 * Audio & Asset Cache
 *
 * Downloads remote audio files and images to local storage for instant playback.
 * - On native: Uses expo-file-system cacheDirectory for fast local access
 * - On web: Uses the Cache API (or falls back to direct URLs since browsers handle caching)
 *
 * No storage permissions are needed for cacheDirectory on native (it's app-sandboxed).
 */

// In-memory map of remote URL -> local URI (or blob URL on web)
const cache = new Map<string, string>();

// Track download promises to avoid duplicate concurrent downloads
const pendingDownloads = new Map<string, Promise<string>>();

/**
 * Get a cached local URI for a remote URL.
 * Returns the remote URL immediately if not cached yet.
 */
export function getCachedUri(remoteUrl: string): string {
  return cache.get(remoteUrl) || remoteUrl;
}

/**
 * Check if a URL is already cached locally.
 */
export function isCached(remoteUrl: string): boolean {
  return cache.has(remoteUrl);
}

/**
 * Pre-download a single file and cache it locally.
 * Returns the local URI (or the original URL on web if Cache API isn't available).
 */
export async function preDownload(remoteUrl: string): Promise<string> {
  // Already cached
  if (cache.has(remoteUrl)) {
    return cache.get(remoteUrl)!;
  }

  // Already downloading — wait for the existing promise
  if (pendingDownloads.has(remoteUrl)) {
    return pendingDownloads.get(remoteUrl)!;
  }

  const downloadPromise = _doDownload(remoteUrl);
  pendingDownloads.set(remoteUrl, downloadPromise);

  try {
    const localUri = await downloadPromise;
    cache.set(remoteUrl, localUri);
    return localUri;
  } finally {
    pendingDownloads.delete(remoteUrl);
  }
}

/**
 * Pre-download multiple files in parallel.
 * Returns when all downloads are complete.
 */
export async function preDownloadAll(urls: string[]): Promise<void> {
  await Promise.all(urls.map((url) => preDownload(url)));
}

/**
 * Internal download implementation — platform-specific.
 */
async function _doDownload(remoteUrl: string): Promise<string> {
  if (Platform.OS === "web") {
    return _doDownloadWeb(remoteUrl);
  }
  return _doDownloadNative(remoteUrl);
}

/**
 * Web: Use fetch + Cache API to pre-cache the file.
 * The browser will serve it from cache on subsequent requests.
 */
async function _doDownloadWeb(remoteUrl: string): Promise<string> {
  try {
    // Use the Cache API if available
    if ("caches" in globalThis) {
      const cacheStore = await caches.open("audio-cache-v1");
      const existing = await cacheStore.match(remoteUrl);
      if (existing) {
        // Already in browser cache — create blob URL for instant access
        const blob = await existing.blob();
        const blobUrl = URL.createObjectURL(blob);
        return blobUrl;
      }

      // Download and store in cache
      const response = await fetch(remoteUrl);
      if (response.ok) {
        // Clone response for cache storage
        const responseClone = response.clone();
        await cacheStore.put(remoteUrl, responseClone);
        // Create blob URL for immediate use
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        return blobUrl;
      }
    }

    // Fallback: just fetch to warm the browser's HTTP cache
    await fetch(remoteUrl);
    return remoteUrl;
  } catch (e) {
    console.warn("Web pre-download failed, using remote URL:", e);
    return remoteUrl;
  }
}

/**
 * Native: Use expo-file-system to download to cacheDirectory.
 */
async function _doDownloadNative(remoteUrl: string): Promise<string> {
  try {
    const FileSystem = await import("expo-file-system/legacy");

    // Generate a safe filename from the URL
    const filename = _urlToFilename(remoteUrl);
    const localUri = (FileSystem.cacheDirectory || "") + "audio-cache/" + filename;

    // Check if already downloaded
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists && (info as any).size && (info as any).size > 0) {
      return localUri;
    }

    // Ensure directory exists
    const dirUri = (FileSystem.cacheDirectory || "") + "audio-cache/";
    const dirInfo = await FileSystem.getInfoAsync(dirUri);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
    }

    // Download the file
    const result = await FileSystem.downloadAsync(remoteUrl, localUri);
    if (result.status === 200) {
      return result.uri;
    }

    // Download failed — fall back to remote URL
    console.warn(`Download returned status ${result.status} for ${remoteUrl}`);
    return remoteUrl;
  } catch (e) {
    console.warn("Native pre-download failed, using remote URL:", e);
    return remoteUrl;
  }
}

/**
 * Convert a URL to a safe filename.
 */
function _urlToFilename(url: string): string {
  // Extract the last path segment and decode it
  const parts = url.split("/");
  const lastPart = parts[parts.length - 1] || "file";
  // Replace any non-alphanumeric chars (except dots and hyphens) with underscores
  return decodeURIComponent(lastPart).replace(/[^a-zA-Z0-9.\-]/g, "_");
}
