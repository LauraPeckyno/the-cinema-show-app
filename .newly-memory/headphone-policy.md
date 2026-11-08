---
name: headphone-policy
description: "Any headphones (wired, Bluetooth, USB) allow mic + music; only confirmed no-headphones stops all sound; prefer the phone's own mic"
metadata:
  node_type: memory
  type: project
  originSessionId: 92dcbb50-157b-4eda-8856-c31381529c4e
  modified: 2026-11-05T23:07:43.565Z
---

Requested 2026-11-05. Any connected headphones (wired, Bluetooth A2DP/HFP/LE, USB, hearing aids) count as connected and the mic and music play normally. The "Headphones Disconnected" prompt appears, stopping both music and mic, only when the phone confirms there are no headphones (the reading must hold for 1.5 s and be re-checked). The mic should always prefer the phone's built-in mic over headset/earbud mics, because those leak the music and cause feedback.
**Why:** short route changes during mic start-up used to misread Bluetooth headphones as unplugged and stop the app.
**How to apply:** keep this logic in hooks/use-headphone-detection.ts, the ExpoAudioRoute module (iOS sets the preferred input to builtInMic; HFP stays off) and preferBuiltInMic in the mic-passthrough WebView.
**Lesson (2026-11-08):** on iPhone, never change the audio category or preferred input while the mic is recording. Doing so cut WebKit's capture after about 2 s. Set the phone mic preference before getUserMedia only; keepMusicPlaybackAsync only moves the output to the speaker. Leaving Now Playing must stop the mic (beforeRemove plus unmount cleanup), or Android errors on the next track.
