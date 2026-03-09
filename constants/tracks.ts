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
  durationEstimate: number; // estimated duration in seconds
}

export const TRACKS: Track[] = [
  // === DARK SIDE ===
  {
    id: 1,
    title: "Corpse Parade",
    side: "dark",
    bpm: 80,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/corpse-parade",
    effect: {
      name: "Spectral Reverb",
      description: "Deep cathedral reverb with spectral shimmer and ghostly echoes",
      color: "#6A0DAD",
      icon: "\u{1F47B}",
    },
    durationEstimate: 240,
  },
  {
    id: 2,
    title: "SleepDeprivation",
    side: "dark",
    bpm: 90,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/sleepdeprivation",
    effect: {
      name: "Granular Stutter",
      description: "Micro-sliced grains with random stutter and pitch drift",
      color: "#1B5E20",
      icon: "\u{1F300}",
    },
    durationEstimate: 210,
  },
  {
    id: 3,
    title: "Mutation and Madness",
    side: "dark",
    bpm: 100,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/mutationandmadness",
    effect: {
      name: "Bitcrusher Chaos",
      description: "Lo-fi bitcrushing with distortion and ring modulation",
      color: "#B71C1C",
      icon: "\u{26A1}",
    },
    durationEstimate: 220,
  },
  {
    id: 4,
    title: "Krampus Wishes",
    side: "dark",
    bpm: 75,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/krampus-wishes",
    effect: {
      name: "Reverse Swell",
      description: "Reversed audio swells with dark tremolo and sub-bass boost",
      color: "#4A148C",
      icon: "\u{1F504}",
    },
    durationEstimate: 250,
  },
  {
    id: 5,
    title: "Expiation",
    side: "dark",
    bpm: 70,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/expiation",
    effect: {
      name: "Tape Decay",
      description: "Warped tape saturation with wow, flutter, and degradation",
      color: "#3E2723",
      icon: "\u{1F4FC}",
    },
    durationEstimate: 260,
  },
  // === LIGHT SIDE ===
  {
    id: 6,
    title: "Road Show",
    side: "light",
    bpm: 120,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/road-show",
    effect: {
      name: "Rhythmic Gate",
      description: "Tempo-synced gate that chops audio into rhythmic patterns",
      color: "#FF6F00",
      icon: "\u{1F3B5}",
    },
    durationEstimate: 200,
  },
  {
    id: 7,
    title: "Recessional",
    side: "light",
    bpm: 95,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/recessional",
    effect: {
      name: "Shimmer Delay",
      description: "Pitch-shifted delay with ascending octave shimmer",
      color: "#0288D1",
      icon: "\u{2728}",
    },
    durationEstimate: 230,
  },
  {
    id: 8,
    title: "Inspirational Soundscapes",
    side: "light",
    bpm: 110,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/inspirational-soundscapes-the-drive2succeed",
    effect: {
      name: "Harmonic Freeze",
      description: "Spectral freeze that sustains harmonic content as pads",
      color: "#00897B",
      icon: "\u{2744}\u{FE0F}",
    },
    durationEstimate: 215,
  },
  {
    id: 9,
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
  },
  {
    id: 10,
    title: "Thoroughly Positive Pitzy",
    side: "light",
    bpm: 130,
    soundcloudUrl: "https://soundcloud.com/imaginaurium/thoroughly-positive-pitzy",
    effect: {
      name: "Vocoder Pulse",
      description: "Vocoder-style processing synced to rhythmic pulses",
      color: "#F9A825",
      icon: "\u{1F916}",
    },
    durationEstimate: 195,
  },
];

export const DARK_TRACKS = TRACKS.filter((t) => t.side === "dark");
export const LIGHT_TRACKS = TRACKS.filter((t) => t.side === "light");
