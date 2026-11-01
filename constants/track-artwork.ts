/**
 * Track artwork URLs for the film strip display, hosted on the
 * StreamingKeys Cloudflare worker. Keyed by track id (see constants/tracks.ts).
 */
const BASE = "https://streamingkeys2.imaginaurium.workers.dev";

export const TRACK_ARTWORK: Record<number, string> = {
  1: `${BASE}/B_corpseparade.jpg`, // Corpse Parade
  2: `${BASE}/B_sleepdeprivation.jpg`, // Sleep Deprivation
  3: `${BASE}/B_mutation.jpg`, // Mutation and Madness
  4: `${BASE}/B_krampuswishes.jpg`, // Krampus Wishes
  5: `${BASE}/B_investigation.jpg`, // Investigation Station
  6: `${BASE}/B_expiation.jpg`, // Expiation
  7: `${BASE}/A_recessional.jpg`, // Recessional
  8: `${BASE}/A_roadshow.jpg`, // Road Show
  9: `${BASE}/A_excitement.jpg`, // Excitement and Elimination
  10: `${BASE}/A_pianofandango.jpg`, // Piano Fandango
  11: `${BASE}/A_muchado.jpg`, // Much Ado
  12: `${BASE}/A_theme4new.jpg`, // Theme for New Beginnings
};
