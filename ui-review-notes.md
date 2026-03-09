# UI Review Notes

## Home Screen
- Dark cinema-themed background with gradient renders correctly
- App icon displays in rounded container
- "THE CINEMA SHOW" title and "by Robert Peckyno" subtitle visible
- "Your world becomes the soundtrack" tagline shows in italic
- "Enter the Theater" gold button renders correctly
- Tab bar at bottom with Home, Tracks, About tabs - all working
- Film hole decorations at bottom visible

## Tracks Screen
- "SELECT A TRACK" header with subtitle renders
- Dark Side section with purple dot and 5 tracks
- Light Side section with orange dot and 5 tracks
- Each track card shows: emoji icon, title, BPM, track number, effect name, description
- Colored accent bars on left of each card visible
- Cards are tappable and navigate to Now Playing

## Now Playing Screen
- Header shows "DARK SIDE" label and track name "Corpse Parade"
- Back chevron button visible
- Audio visualizer with pulsing rings and center glow renders
- BPM badge (80), Effect badge (Spectral Reverb), MIC OFF badge visible
- Progress bar with 0:00 / 4:00 timestamps
- Play/Pause button (purple, centered), Mic toggle, Volume button
- Three sliders: Mic Sensitivity (70%), Effect Intensity (50%), Volume (80%)
- Effect description card at bottom
- SoundCloud widget iframe loaded (hidden but functional)

## Issues Found
- SoundCloud widget shows "Learn more" and "Play on SoundCloud" links at bottom - these are from the iframe, should be hidden
- The iframe seems to be partially visible
