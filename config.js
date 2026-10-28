// config.js — every tunable parameter of the pre-pilot task lives here.
// Design: scarcity_cognitive_battery_design_v5.md (short form).
window.CONFIG = {
  version: "prepilot-0.1",

  // ---- block structure (design doc §2.2, §4.1) ----
  // Pre-pilot runs the 40-trial FT/N arm of the dosage question (settled short form is N20/FT20).
  trials: { N: 20, FT: 40, CS: 40 },
  // practice: neutral-word trials + CS trials (half incongruent), feedback on every trial,
  // repeat once if accuracy is below the gate
  practice: { n_words: 6, n_cs: 6, pass_min_correct: 9, max_rounds: 2 },
  orders: {                       // CS always third; FT appears exactly once
    1: ["N1", "N2", "CS", "FT"],
    2: ["N1", "FT", "CS", "N2"],
    3: ["FT", "N1", "CS", "N2"],
  },
  order_weights: { 1: 1, 2: 1, 3: 1 },   // e.g. {1:2, 2:1, 3:1} for 2:1:1

  // ---- trial timing, ms ----
  // Trials are response-terminated. `deadline` is a silent cap (logged as a miss, no message)
  // so a put-down phone cannot hang the session; "too slow" is shown only in practice, at
  // `practice_deadline`. `fixation` is a blank inter-trial gap (no cross: it read as an event).
  // URL overrides: ?fixation=500&deadline=4000&blank=800
  timing: { fixation: 300, deadline: 5000, blank: 500, practice_deadline: 1500, feedback: 600 },

  // ---- word placement: "above" the face (design doc) or "over" it
  //      (superimposed across the face, as in face-word Stroop tasks). URL: ?word=over
  word_position: "over",

  // ---- response mapping (fixed for all participants; PI default, flag) ----
  // left tap / F key = man ; right tap / J key = woman
  mapping: { left: "M", right: "F", key_left: "f", key_right: "j",
             label: { M: "MAN", F: "WOMAN" } },

  // ---- sequencing constraints (mirrors 08_sequence_generator.Rmd) ----
  seq: { max_run_same_response: 3, neighbor_min_gap: 10, max_tries: 5000 },

  // ---- rest blocks (rest spec 2026-10-28, lengths per PI 2026-10-28) ----
  // Fading cross in both (a response demand, so a put-down phone is detectable): slow fade,
  // stays faded until any tap/key, never within probe_margin of a probe. Fade onset + RT logged.
  rest: {
    caption: "Keep your eyes on the cross and let your thoughts go wherever they will.",
    transition_ms: 5000,               // fixed screen between the last task block and the end rest
    // The last probe of each block sits at the block end and closes it (no cross after the final questions).
    fade: { fade_ms: 1500, opacity: 0.12, first_min_ms: 6000, min_gap_ms: 10000, probe_margin_ms: 5000, end_margin_ms: 5000 },
    start: { duration_ms: 50000, probes: { n: 1, last_at_end: true }, n_fades: 3 },
    end:   { duration_ms: 120000, probes: { n: 2, at_ms: [60000], jitter_ms: 10000, first_min_ms: 40000, min_gap_ms: 30000, last_at_end: true }, n_fades: 5 },
  },

  // ---- data return ----
  // Google Sheet receiver (server/Code.gs, deployed as an Apps Script web app). Paste the
  // "Web app URL" from the deployment here. Empty = no server: the end screen offers
  // download / copy instead. URL override for testing: ?sheets=<url>
  sheets: { url: "" },
};
