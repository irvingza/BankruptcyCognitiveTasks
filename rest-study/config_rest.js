// config_rest.js — standalone rest study: static cross vs fading cross (between participants).
// Everything else (instructions, duration, probes) is identical to the battery's rest block.
window.REST_CONFIG = {
  version: "rest-study-0.1",
  conditions: ["static", "fade"],      // URL ?cond=static|fade overrides the random draw
  duration_ms: 180000,
  probes: { n: 3, at_ms: [60000, 120000], jitter_ms: 15000, first_min_ms: 45000, min_gap_ms: 30000, last_at_end: true },   // last probe closes the block
  caption: "Keep your eyes on the cross and let your thoughts go wherever they will.",
  fade: {
    n_min: 5, n_max: 7,                // fades per block
    fade_ms: 1500,                     // slow fade (1-2 s)
    opacity: 0.12,                     // how faint the cross gets
    first_min_ms: 6000, min_gap_ms: 10000, probe_margin_ms: 5000, end_margin_ms: 5000,
  },
  sheets: { url: "" },                 // same Apps Script web app URL as config.js

};
