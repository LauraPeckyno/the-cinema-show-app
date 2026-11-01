---
name: bundle-id
description: "The app's iOS bundle ID / Android package is com.streamingkeys.cinemashow, never the old Manus one"
metadata:
  node_type: memory
  type: project
  originSessionId: 92dcbb50-157b-4eda-8856-c31381529c4e
  modified: 2026-11-01T00:26:46.154Z
---

The Cinema Show ships as com.streamingkeys.cinemashow (iOS bundle ID and Android package), set as plain strings in app.config.ts.
**Why:** the user wants to publish under their own ID; the old Manus ID space.manus.the.cinema.show.app.t20260308222644 must not come back.
**How to apply:** pick com.streamingkeys.cinemashow in the TestFlight card; never reintroduce the space.manus ID or a computed bundle ID.
