import { Platform } from "react-native";
import { getApiBaseUrl } from "@/constants/oauth";

/**
 * Audio & Asset Cache
 *
 * Downloads remote audio files and images to local storage for instant playback.
 * - On web: Routes through the backend proxy (/api/media/:filename) to add CORS headers,
 *   then caches as blob URLs for instant access.
 * - On native: Uses expo-file-system cacheDirectory for fast local access.
 *   Native apps don't have CORS restrictions so can fetch directly from Cloudflare.
 *
 * No storage permissions are needed for cacheDirectory on native (it's app-sandboxed).
 */

// The Cloudflare Workers base URL (used on native where CORS doesn't apply)
const CF_WORKER_BASE = "http://streamingkeys.imaginaurium.workers.dev";

// In-memory map of remote URL -> local URI (or blob URL on web)
const cache = new Map<string, string>();

// Track download promises to avoid duplicate concurrent downloads
const pendingDownloads = new Map<string, Promise<string>>();

/**
 * Convert a Cloudflare direct URL to a proxy URL for web.
 * e.g., "http://streamingkeys.imaginaurium.workers.dev/Cover.png"
 *    -> "https://3000-xxx.manus.computer/api/media/Cover.png"
 */
function toProxyUrl(remoteUrl: string): string {
  const filename = remoteUrl.replace(CF_WORKER_BASE + "/", "");
  const apiBase = getApiBaseUrl();
  return `${apiBase}/api/media/${filename}`;
}

/**
 * Get a cached local URI for a remote URL.
 * On web, returns the proxy URL if not yet cached (so it works even without pre-download).
 * On native, returns the original URL if not cached.
 */
export function getCachedUri(remoteUrl: string): string {
  if (cache.has(remoteUrl)) {
    return cache.get(remoteUrl)!;
  }
  // On web, always use proxy URL to avoid CORS issues
  if (Platform.OS === "web" && remoteUrl.startsWith(CF_WORKER_BASE)) {
    return toProxyUrl(remoteUrl);
  }
  return remoteUrl;
}

/**
 * Check if a URL is already cached locally.
 */
export function isCached(remoteUrl: string): boolean {
  return cache.has(remoteUrl);
}

/**
 * Pre-download a single file and cache it locally.
 * Returns the local URI (blob URL on web, file URI on native).
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
 * Pre-download multiple files in parallel (limited concurrency).
 * Returns when all downloads are complete.
 */
export async function preDownloadAll(urls: string[]): Promise<void> {
  // Download 2 at a time to avoid overwhelming the connection
  const CONCURRENCY = 2;
  const queue = [...urls];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const url = queue.shift();
      if (url) {
        try {
          await preDownload(url);
        } catch (e) {
          console.warn("Background pre-download failed:", url, e);
        }
      }
    }
  });
  await Promise.all(workers);
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
 * Web: Fetch via the backend proxy (which adds CORS + Content-Type),
 * then store as a blob URL for instant access.
 */
async function _doDownloadWeb(remoteUrl: string): Promise<string> {
  try {
    // Use proxy URL to avoid CORS issues
    const fetchUrl = remoteUrl.startsWith(CF_WORKER_BASE)
      ? toProxyUrl(remoteUrl)
      : remoteUrl;

    const response = await fetch(fetchUrl);
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      return blobUrl;
    }

    // If fetch failed, return the proxy URL (browser will try again on use)
    console.warn(`Web pre-download returned ${response.status} for ${remoteUrl}`);
    return fetchUrl;
  } catch (e) {
    console.warn("Web pre-download failed, using proxy URL:", e);
    // Return proxy URL as fallback
    if (remoteUrl.startsWith(CF_WORKER_BASE)) {
      return toProxyUrl(remoteUrl);
    }
    return remoteUrl;
  }
}

/**
 * Native: Use expo-file-system to download to cacheDirectory.
 * Native apps don't have CORS restrictions, so fetch directly from Cloudflare.
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
