export type AlbumSide = "dark" | "light";

export interface AudioEffect {
  name: string;
  description: string;
  color: string; // Unique color for this effect's visualizer
  icon: string; // Emoji icon for the effect
}

export interface Track {
  id: number;
  title: string;
  side: AlbumSide;
  bpm: number;
  audioUrl: string; // Direct URL to audio file (Cloudflare R2)
  effect: AudioEffect;
  durationEstimate: number; // estimated duration in seconds (used as fallback)
  durationMs: number; // actual duration in milliseconds (0 = not yet known)
}

export const TRACKS: Track[] = [
  // ═══════════════════════════════════════════════════════════════════
  // DARK SIDE (6 tracks)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 1,
    title: "Corpse Parade",
    side: "dark",
    bpm: 116,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/CorpseParade.mp3",
    effect: {
      name: "Phantom Stutter",
      description: "Dual random delays (0.25-1s), 16th-note repeat with pitch mod (max 4), 4-24 beat half-speed repeat",
      color: "#6A0DAD",
      icon: "\u{1F47B}",
    },
    durationEstimate: 240,
    durationMs: 0,
  },
  {
    id: 2,
    title: "Sleep Deprivation",
    side: "dark",
    bpm: 76,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/SleepDeprivation.mp3",
    effect: {
      name: "Insomnia Filter",
      description: "HP filter at 1000Hz, 2x rate delay, large room reverb",
      color: "#1B5E20",
      icon: "\u{1F300}",
    },
    durationEstimate: 210,
    durationMs: 0,
  },
  {
    id: 3,
    title: "Mutation and Madness",
    side: "dark",
    bpm: 120,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/MutationandMadness.mp3",
    effect: {
      name: "CB Radio",
      description: "Random 0.5s sampling, CB radio distortion, 2x rate delay",
      color: "#B71C1C",
      icon: "\u{1F4FB}",
    },
    durationEstimate: 220,
    durationMs: 0,
  },
  {
    id: 4,
    title: "Krampus Wishes",
    side: "dark",
    bpm: 120,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/KrampusWishes.mp3",
    effect: {
      name: "Reverse Echo",
      description: "8-beat delay, reversed half-speed playback, very large reverb",
      color: "#4A148C",
      icon: "\u{1F504}",
    },
    durationEstimate: 250,
    durationMs: 0,
  },
  {
    id: 5,
    title: "Investigation Station",
    side: "dark",
    bpm: 80,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/InvestigationStation.mp3",
    effect: {
      name: "Rotary Speaker",
      description: "Hammond-style rotary modulator at 2x BPM",
      color: "#455A64",
      icon: "\u{2699}\u{FE0F}",
    },
    durationEstimate: 230,
    durationMs: 0,
  },
  {
    id: 6,
    title: "Expiation",
    side: "dark",
    bpm: 90,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/Expiation.mp3",
    effect: {
      name: "Dark Delay",
      description: "20dB gate, beat-synced delay, treble cut >5kHz, 2/3 rate playback",
      color: "#3E2723",
      icon: "\u{1F4FC}",
    },
    durationEstimate: 260,
    durationMs: 0,
  },

  // ═══════════════════════════════════════════════════════════════════
  // LIGHT SIDE (6 tracks)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 7,
    title: "Recessional",
    side: "light",
    bpm: 152,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/Recessional.mp3",
    effect: {
      name: "Cathedral",
      description: "Long church reverb with 10dB noise gate, half-rate delay, max 3 echoes",
      color: "#0288D1",
      icon: "\u{26EA}",
    },
    durationEstimate: 230,
    durationMs: 0,
  },
  {
    id: 8,
    title: "Road Show",
    side: "light",
    bpm: 140,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/RoadShow.mp3",
    effect: {
      name: "Gated Stutter",
      description: "Quarter-note gated delay (0.25s samples), 12-beat repeat with pitch-lowering modulator",
      color: "#FF6F00",
      icon: "\u{1F3B5}",
    },
    durationEstimate: 200,
    durationMs: 0,
  },
  {
    id: 9,
    title: "Excitement and Elimination",
    side: "light",
    bpm: 152,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/ExcitementandElimination.mp3",
    effect: {
      name: "Ping Pong Phaser",
      description: "Ping-pong delay at music rate, 20dB gate, 2x speed playback, random phaser, max 2 delays",
      color: "#E65100",
      icon: "\u{1F4A5}",
    },
    durationEstimate: 205,
    durationMs: 0,
  },
  {
    id: 10,
    title: "Piano Fandango",
    side: "light",
    bpm: 106,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/PianoFandango.mp3",
    effect: {
      name: "Shifting Chorus",
      description: "Simple chorus effect with random rate change every 16 measures",
      color: "#7B1FA2",
      icon: "\u{1F3B6}",
    },
    durationEstimate: 225,
    durationMs: 0,
  },
  {
    id: 11,
    title: "Much Ado",
    side: "light",
    bpm: 120,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/MuchAdo.mp3",
    effect: {
      name: "Time Stretch",
      description: "3x time-stretch slowdown, large hall reverb, 20dB gate delay in time with music",
      color: "#AD1457",
      icon: "\u{231B}",
    },
    durationEstimate: 210,
    durationMs: 0,
  },
  {
    id: 12,
    title: "Theme for New Beginnings",
    side: "light",
    bpm: 84,
    audioUrl: "https://streamingkeys2.imaginaurium.workers.dev/ThemeforNewBeginnings.mp3",
    effect: {
      name: "Chipmunk",
      description: "1-second delay with sped-up chipmunk playback",
      color: "#2E7D32",
      icon: "\u{1F43F}\u{FE0F}",
    },
    durationEstimate: 235,
    durationMs: 0,
  },
];

export const DARK_TRACKS = TRACKS.filter((t) => t.side === "dark");
export const LIGHT_TRACKS = TRACKS.filter((t) => t.side === "light");

// Start the album on the Light Side, beginning with Recessional.
// Keeping track ID 12 preserves its existing ID-keyed artwork and effect chain.
export const ALBUM_PLAYBACK_QUEUE = [...LIGHT_TRACKS, ...DARK_TRACKS];
