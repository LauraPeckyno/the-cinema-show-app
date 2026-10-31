---
name: cinema-show-app
description: What this imported app is (The Cinema Show album player by streamingkeys) and how it is built
metadata:
  node_type: memory
  type: project
  originSessionId: 92dcbb50-157b-4eda-8856-c31381529c4e
  modified: 2026-10-31T19:33:16.123Z
---

Imported from GitHub (LauraPeckyno/the-cinema-show-app), originally built on Manus. It is an album player for "The Cinema Show" by streamingkeys: Home (bio, cover), Tracks (12 tracks, dark/light sides), Now Playing (film-grain overlay, live microphone effects via a hidden WebView running Web Audio, Open/Tight gate). Music and cover live on the user's Cloudflare worker (streamingkeys2.imaginaurium.workers.dev); track artwork was on Manus CloudFront.

**Why:** It keeps its own stack (Expo SDK 54, expo-router, NativeWind v4, root-level app/ folder, local native module in modules/expo-audio-route). The bundled Express/tRPC/MySQL server is Manus template code the screens don't use.
**How to apply:** Don't bring in HeroUI/Uniwind/tokens; edit within its existing conventions. Ask before removing the Manus server or auth code.
