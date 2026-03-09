# The Cinema Show — Mobile App Interface Design

## Overview

The Cinema Show is an immersive audio experience app that pairs ambient environmental sounds captured through the user's microphone with instrumental tracks from Robert Peckyno's album "The Cinema Show." The app is themed around the movie theater and moviegoing experience, evoking the atmosphere of classic cinema — dark theaters, velvet curtains, flickering projectors, and golden-age Hollywood glamour.

---

## Screen List

| Screen | Purpose |
|--------|---------|
| **Home / Welcome** | Landing screen with album art, cinema atmosphere, and entry point to the experience |
| **Track Selection** | Browse and select from 10 tracks split into "Dark" and "Light" sides of the album |
| **Now Playing / Experience** | The main immersive screen where mic sampling + track playback + effects happen |
| **About** | Album info, artist credit, and app description |

---

## Primary Content and Functionality

### 1. Home / Welcome Screen
- Large hero area with album artwork and "The Cinema Show" title
- Tagline: "Your world becomes the soundtrack"
- Animated ambient background suggesting a dark theater (subtle grain/flicker)
- Prominent "Enter the Theater" button to navigate to Track Selection
- Bottom: small "About" link

### 2. Track Selection Screen
- Two sections: **"Dark Side"** and **"Light Side"** of the album
- Each track displayed as a card with:
  - Track number and name
  - A brief mood/effect descriptor (e.g., "Haunting reverb cathedral", "Rhythmic stutter gate")
  - Visual indicator of the unique filter/effect style
- Cards have a cinema-ticket aesthetic with torn edges or film-strip borders
- Tapping a track navigates to the Now Playing screen

### 3. Now Playing / Experience Screen
- **Top area**: Track name and album side indicator (Dark/Light)
- **Center**: Large circular audio visualizer that reacts to both the music track and the ambient mic input
  - The visualizer pulses with the BPM of the track
  - Color shifts based on the filter/effect applied
- **Controls area**:
  - Play/Pause button (large, centered)
  - Mic sensitivity slider (controls how much ambient audio is mixed in)
  - Effect intensity slider (controls the strength of the per-song filter)
  - Volume control
- **Bottom**: Current track progress bar with time indicators
- **Status indicators**: Mic active icon, BPM display, current effect name
- Background: Dark theater ambiance with subtle animated elements

### 4. About Screen
- Album artwork
- Artist name: Robert Peckyno
- Album description and cinema theme explanation
- Links to SoundCloud playlists
- App credits

---

## Key User Flows

### Flow 1: First Launch → Start Experience
1. User opens app → Home screen with cinema atmosphere
2. User taps "Enter the Theater" → Track Selection screen
3. User browses Dark/Light sections → Taps a track card
4. App requests microphone permission (if not granted)
5. Now Playing screen loads → Track streams from SoundCloud
6. Mic begins sampling ambient audio
7. Sampled audio is processed with the track's unique filter and synced to BPM
8. User hears blended immersive audio

### Flow 2: Switching Tracks
1. From Now Playing → Swipe down or tap back arrow
2. Returns to Track Selection
3. Select different track → New filter/effect applied automatically

### Flow 3: Adjusting the Mix
1. On Now Playing screen
2. Drag mic sensitivity slider → More/less ambient audio in the mix
3. Drag effect intensity slider → Stronger/weaker filter effect
4. Real-time audio changes

---

## Color Choices

The palette is inspired by classic cinema: deep blacks, rich burgundy/crimson (theater curtains), warm gold (art deco accents), and cool silver (film reels).

| Token | Light Mode | Dark Mode | Usage |
|-------|-----------|-----------|-------|
| `primary` | `#C8A951` | `#D4B96A` | Gold accent — buttons, highlights, active states |
| `background` | `#1A1A2E` | `#0A0A14` | Deep navy-black — always dark for cinema feel |
| `surface` | `#242440` | `#16162B` | Slightly lighter dark — cards, elevated surfaces |
| `foreground` | `#F0E6D3` | `#F0E6D3` | Warm cream — primary text |
| `muted` | `#8B7E6A` | `#6B6155` | Muted gold-brown — secondary text |
| `border` | `#3A3A5C` | `#2A2A44` | Subtle purple-gray borders |
| `success` | `#4CAF50` | `#66BB6A` | Green for active mic |
| `warning` | `#FF9800` | `#FFB74D` | Orange for warnings |
| `error` | `#E53935` | `#EF5350` | Red — cinema curtain red for errors |
| `accent` | `#8B1A1A` | `#A52A2A` | Deep crimson — theater curtain accent |

**Design Note**: The app should feel predominantly dark regardless of device theme, evoking a movie theater interior. The "light mode" is still dark, just slightly lighter.

---

## Track Data with Effects

Each of the 10 tracks has a unique audio filter/effect applied to the ambient microphone samples:

| # | Track Name | Side | BPM | Effect Name | Effect Description |
|---|-----------|------|-----|-------------|-------------------|
| 1 | Corpse Parade | Dark | 80 | Spectral Reverb | Deep cathedral reverb with spectral shimmer, ghostly echoes |
| 2 | SleepDeprivation | Dark | 90 | Granular Stutter | Micro-sliced grains with random stutter and pitch drift |
| 3 | MutationandMadness | Dark | 100 | Bitcrusher Chaos | Lo-fi bitcrushing with distortion and ring modulation |
| 4 | Krampus Wishes | Dark | 75 | Reverse Swell | Reversed audio swells with dark tremolo and sub-bass boost |
| 5 | Expiation | Dark | 70 | Tape Decay | Warped tape saturation with wow/flutter and degradation |
| 6 | Road Show | Light | 120 | Rhythmic Gate | Tempo-synced gate that chops audio into rhythmic patterns |
| 7 | Recessional | Light | 95 | Shimmer Delay | Pitch-shifted delay with ascending octave shimmer |
| 8 | Inspirational Soundscapes | Light | 110 | Harmonic Freeze | Spectral freeze that sustains harmonic content as pads |
| 9 | Acoustic Atmospheres | Light | 105 | Flanger Wash | Deep flanging with stereo widening and chorus |
| 10 | Thoroughly Positive Pitzy | Light | 130 | Vocoder Pulse | Vocoder-style processing synced to rhythmic pulses |

---

## Typography

- **Headings**: System bold, large sizes for cinema-poster feel
- **Body**: System regular, warm cream color on dark backgrounds
- **Track names**: Slightly condensed, uppercase for ticket/marquee aesthetic
- **Numbers/BPM**: Monospace feel for technical readability

---

## Audio Architecture (Conceptual)

The app uses a dual-layer audio approach:
1. **Music Layer**: SoundCloud Widget API streams the selected track via a hidden WebView/iframe
2. **Ambient Layer**: Device microphone captures environmental audio via expo-audio recording
3. **Processing Layer**: The ambient audio is processed with the track-specific filter/effect and synced to the track's BPM
4. **Mix Layer**: Both layers are blended based on user-controlled mix levels

Since expo-audio provides recording but not real-time DSP, the audio processing will be simulated through:
- Periodic mic sampling (short recording chunks)
- Processing indicators and visual feedback
- The SoundCloud track provides the musical foundation
- Mic input level drives visual elements and mix parameters
