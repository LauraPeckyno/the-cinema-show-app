---
name: bundle-id
description: "The app's iOS bundle ID / Android package is com.streamingkeys.cinemashow, never the old Manus one"
metadata:
  node_type: memory
  type: project
  originSessionId: 92dcbb50-157b-4eda-8856-c31381529c4e
  modified: 2026-11-01T02:45:43.785Z
---

The Cinema Show ships as com.streamingkeys.cinemashow (iOS bundle ID and Android package), set as plain strings in app.config.ts.
**Why:** the user wants to publish under their own ID; the old Manus ID space.manus.the.cinema.show.app.t20260308222644 must not come back.
The old Manus App Store Connect record (app 6804018151) is registered under the space.manus ID and caused a signing failure; the user chose (2026-11-01) to publish to a NEW App Store Connect app under com.streamingkeys.cinemashow and leave the old record unused. On 2026-11-01 the user said they created that new App Store Connect app with bundle ID com.streamingkeys.cinemashow. A later attempt (00:36 that day, clean code) still failed because the publish card was still linked to old record 6804018151; the fix is selecting the new App Store Connect app in the card, not a code change.
New ASC app is 6829349162 (signing works). app.config.ts exports a function that passes through Newly's incoming ios.buildNumber / android.versionCode; without it uploads were rejected as "build number 1, not 2". Keep that pass-through.
**How to apply:** pick com.streamingkeys.cinemashow in the TestFlight card; never reintroduce the space.manus ID or a computed bundle ID.
