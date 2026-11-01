---
name: android-eventemitter-error
description: "Intermittent Android \"Cannot read property 'EventEmitter' of undefined\" red screen was investigated; not app code"
metadata:
  node_type: memory
  type: project
  originSessionId: 92dcbb50-157b-4eda-8856-c31381529c4e
  modified: 2026-11-01T03:07:49.201Z
---

Investigated 2026-11-01: the intermittent Android red screen "TypeError: Cannot read property 'EventEmitter' of undefined" is thrown by expo-modules-core's EventEmitter.ts (`globalThis.expo.EventEmitter`) while the bundle is still loading, i.e. Expo's native runtime wasn't attached yet. Only one expo-modules-core (3.0.30, matches SDK 54); the app's code never touches EventEmitter. Three cold launches and a full warm walkthrough on the emulator showed no error, so it appears tied to the preview reloading a new bundle into an already-running app, not to the app.
**Why:** avoids re-investigating from scratch.
**How to apply:** if it comes back, check whether it happens on a cold launch or in the production APK; only then treat it as an app bug.
