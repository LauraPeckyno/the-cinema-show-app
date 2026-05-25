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
  soundcloudUrl: string;
  effect: AudioEffect;
  durationEstimate: number; // estimated duration in seconds (used as fallback)
  durationMs: number; // actual duration in milliseconds from SoundCloud
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
    soundcloudUrl: "https://soundcloud.com/imaginaurium/corpseparade",
    effect: {
      name: "Ectoplasm",
      description: "Deep cathedral reverb with spectral shimmer and ghostly echoes",
      color: "#6A0DAD",
      icon: "\u{1F47B}",
    },
    durationEstimate: 240,
    durationMs: 35212,
  },
  {
    id: 2,
    title: "Sleep Deprivation",
    side: "dark",
    bpm: 76,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/sleepdeprivation",
    effect: {
      name: "Insomnia",
      description: "Micro-sliced grains with random stutter, pitch drift, and dual ping-pong delays",
      color: "#1B5E20",
      icon: "\u{1F300}",
    },
    durationEstimate: 210,
    durationMs: 30708,
  },
  {
    id: 3,
    title: "Mutation and Madness",
    side: "dark",
    bpm: 120,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/mutationandmadness",
    effect: {
      name: "Mutation Chaos",
      description: "Bitcrusher at 60 BPM, Chorus at 40 BPM (10% width), Mono Delay at 30 BPM, Gate at 60 BPM",
      color: "#B71C1C",
      icon: "\u{26A1}",
    },
    durationEstimate: 220,
    durationMs: 30601,
  },
  {
    id: 4,
    title: "Krampus Wishes",
    side: "dark",
    bpm: 75,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/krampuswishes",
    effect: {
      name: "Krampus' Helpers",
      description: "Completely reversed waveform with rotary modulator at 480 BPM and 240 BPM",
      color: "#4A148C",
      icon: "\u{1F504}",
    },
    durationEstimate: 250,
    durationMs: 35229,
  },
  {
    id: 5,
    title: "Corpse on the Grating",
    side: "dark",
    bpm: 80,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/corpseonthegrating",
    effect: {
      name: "Spectral Correction",
      description: "Stereo Enhancer at 200% width, 7-second reverb, auto pitch correction to A440 minor scale",
      color: "#455A64",
      icon: "\u{2699}\u{FE0F}",
    },
    durationEstimate: 230,
    durationMs: 30248,
  },
  {
    id: 6,
    title: "Expiation",
    side: "dark",
    bpm: 60,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/expiation",
    effect: {
      name: "Penance Gate",
      description: "Square wave gate (1ms attack, 22ms release) into Ping Pong Delay at 60 BPM, 95% wet return",
      color: "#3E2723",
      icon: "\u{1F4FC}",
    },
    durationEstimate: 260,
    durationMs: 34642,
  },

  // ═══════════════════════════════════════════════════════════════════
  // LIGHT SIDE (9 tracks)
  // ═══════════════════════════════════════════════════════════════════
  {
    id: 7,
    title: "Road Show",
    side: "light",
    bpm: 120,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/roadshow",
    effect: {
      name: "Rhythmic Gate",
      description: "Tempo-synced gate that chops audio into rhythmic patterns",
      color: "#FF6F00",
      icon: "\u{1F3B5}",
    },
    durationEstimate: 200,
    durationMs: 30077,
  },
  {
    id: 8,
    title: "Recessional",
    side: "light",
    bpm: 95,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/2020-recessional",
    effect: {
      name: "Shimmer Delay",
      description: "Pitch-shifted delay with ascending octave shimmer",
      color: "#0288D1",
      icon: "\u{2728}",
    },
    durationEstimate: 230,
    durationMs: 30172,
  },
  {
    id: 9,
    title: "Inspirational Soundscapes",
    side: "light",
    bpm: 110,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/drive2succeed",
    effect: {
      name: "Harmonic Freeze",
      description: "Spectral freeze that sustains harmonic content as pads",
      color: "#00897B",
      icon: "\u{2744}\u{FE0F}",
    },
    durationEstimate: 215,
    durationMs: 32607,
  },
  {
    id: 10,
    title: "Excitement and Elimination",
    side: "light",
    bpm: 128,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/excitement-and-elimination",
    effect: {
      name: "Sidechain Pump",
      description: "Rhythmic ducking that creates a pumping, breathing effect synced to the beat",
      color: "#E65100",
      icon: "\u{1F4A5}",
    },
    durationEstimate: 205,
    durationMs: 30282,
  },
  {
    id: 11,
    title: "Acoustic Atmospheres",
    side: "light",
    bpm: 105,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/acoustic-atmospheres-gypsy-fandango",
    effect: {
      name: "Flanger Wash",
      description: "Deep flanging with stereo widening and chorus",
      color: "#7B1FA2",
      icon: "\u{1F30A}",
    },
    durationEstimate: 225,
    durationMs: 30243,
  },
  {
    id: 12,
    title: "Thoroughly Positive Pitzy",
    side: "light",
    bpm: 130,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/thoroughly-positive-pitzy-2",
    effect: {
      name: "Vocoder Pulse",
      description: "Vocoder-style processing synced to rhythmic pulses",
      color: "#F9A825",
      icon: "\u{1F916}",
    },
    durationEstimate: 195,
    durationMs: 32803,
  },
  {
    id: 13,
    title: "Much Ado",
    side: "light",
    bpm: 115,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/much-ado",
    effect: {
      name: "Prism Split",
      description: "Splits audio into spectral bands with rainbow-shifted delays",
      color: "#AD1457",
      icon: "\u{1F308}",
    },
    durationEstimate: 210,
    durationMs: 30869,
  },
  {
    id: 14,
    title: "Rings",
    side: "light",
    bpm: 88,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/rings",
    effect: {
      name: "Orbital Resonance",
      description: "Circular panning with resonant ring modulation and slow phase sweep",
      color: "#1565C0",
      icon: "\u{1F4AB}",
    },
    durationEstimate: 240,
    durationMs: 30371,
  },
  {
    id: 15,
    title: "Brothers",
    side: "light",
    bpm: 92,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/brothers",
    effect: {
      name: "Warm Chorus",
      description: "Rich chorus doubling with warm saturation and gentle detuning",
      color: "#2E7D32",
      icon: "\u{1F91D}",
    },
    durationEstimate: 235,
    durationMs: 30217,
  },
];

export const DARK_TRACKS = TRACKS.filter((t) => t.side === "dark");
export const LIGHT_TRACKS = TRACKS.filter((t) => t.side === "light");
