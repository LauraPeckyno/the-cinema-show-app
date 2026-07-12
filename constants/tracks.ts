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
    bpm: 80,
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/CorpseParade.wav",
    effect: {
      name: "Ectoplasm",
      description: "Deep cathedral reverb with spectral shimmer and ghostly echoes",
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
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/SleepDeprivation.wav",
    effect: {
      name: "Insomnia",
      description: "Micro-sliced grains with random stutter, pitch drift, and dual ping-pong delays",
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
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/MutationandMadness.wav",
    effect: {
      name: "Mutation Chaos",
      description: "Bitcrusher at 60 BPM, Chorus at 40 BPM (10% width), Mono Delay at 30 BPM, Gate at 60 BPM",
      color: "#B71C1C",
      icon: "\u{26A1}",
    },
    durationEstimate: 220,
    durationMs: 0,
  },
  {
    id: 4,
    title: "Krampus Wishes",
    side: "dark",
    bpm: 75,
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/KrampusWishes.wav",
    effect: {
      name: "Krampus' Helpers",
      description: "Completely reversed waveform with rotary modulator at 480 BPM and 240 BPM",
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
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/InvestigationStation.wav",
    effect: {
      name: "Spectral Correction",
      description: "Stereo Enhancer at 200% width, 7-second reverb, auto pitch correction to A440 minor scale",
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
    bpm: 60,
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/Expiation.wav",
    effect: {
      name: "Penance Gate",
      description: "Square wave gate (1ms attack, 22ms release) into Ping Pong Delay at 60 BPM, 95% wet return",
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
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/Recessional.wav",
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
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/RoadShow.wav",
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
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/ExcitementandElimination.wav",
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
    bpm: 105,
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/PianoFandango.wav",
    effect: {
      name: "Flanger Wash",
      description: "Deep flanging with stereo widening and chorus",
      color: "#7B1FA2",
      icon: "\u{1F30A}",
    },
    durationEstimate: 225,
    durationMs: 0,
  },
  {
    id: 11,
    title: "Much Ado",
    side: "light",
    bpm: 115,
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/MuchAdo.wav",
    effect: {
      name: "Prism Split",
      description: "Splits audio into spectral bands with rainbow-shifted delays",
      color: "#AD1457",
      icon: "\u{1F308}",
    },
    durationEstimate: 210,
    durationMs: 0,
  },
  {
    id: 12,
    title: "Brothers",
    side: "light",
    bpm: 92,
    audioUrl: "http://streamingkeys.imaginaurium.workers.dev/Brothers.wav",
    effect: {
      name: "Warm Chorus",
      description: "Rich chorus doubling with warm saturation and gentle detuning",
      color: "#2E7D32",
      icon: "\u{1F91D}",
    },
    durationEstimate: 235,
    durationMs: 0,
  },
];

export const DARK_TRACKS = TRACKS.filter((t) => t.side === "dark");
export const LIGHT_TRACKS = TRACKS.filter((t) => t.side === "light");
