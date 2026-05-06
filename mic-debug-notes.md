# Mic Debug Notes

## Key findings from GitHub issue #3072 (react-native-webview)

### The Problem
- `getUserMedia` in WebView works in Expo Go but fails in production builds
- On Android, the WebView needs explicit permission grants at the app level BEFORE the WebView tries to use getUserMedia

### Solutions found:

1. **Request audio permission at app level BEFORE WebView loads**
   - Use `Audio.requestPermissionsAsync()` from expo-audio BEFORE the WebView mounts
   - Use `onLoadStart={() => _getAudioPermission()}` on the WebView

2. **Android permissions in app.config.ts**
   - Must include: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `AUDIO_CAPTURE`

3. **URL must be localhost or https**
   - WebView won't grant mic access to non-secure origins
   - Since we use `source={{ html: ... }}`, this could be an issue
   - May need to use `baseUrl: 'https://localhost'` in source

4. **iOS needs NSMicrophoneUsageDescription in infoPlist**

## Action Plan:
1. Add MODIFY_AUDIO_SETTINGS and AUDIO_CAPTURE to Android permissions in app.config.ts
2. Ensure expo-audio permission is requested BEFORE MicPassthrough WebView mounts
3. Add `baseUrl: 'https://localhost'` to the WebView source to satisfy secure origin requirement
4. Make the WebView container properly sized (not 1x1) to avoid throttling
5. Add onLoadStart permission check
6. Add explicit AudioContext.resume() after creation
