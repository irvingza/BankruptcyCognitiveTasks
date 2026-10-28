# CLAUDE.md — standing instructions for work in this folder

- Design of record: `scarcity_cognitive_battery_design_v5.md` (project). Do not change
  block sizes, orders, timing, or the sequencing constraints without the PI (Zac Irving) saying so.
- Stimulus files in `stimuli/*.csv` are pinned inputs from the word/face pipelines. Never edit
  them here; regenerate `stimuli/stimuli.js` with `scripts/build_stimuli.py`.
- Keep/cut decisions on stimuli are the PI's. Scripts may propose; they do not decide.
- Randomization must stay seeded and reproducible; after any change to `sequence.js`,
  run `node scripts/audit_sequences.js 1000` and it must pass.
- No CDN dependencies: everything the page needs is in this folder.
- Participant-facing text never calls the fixation period "rest", and the instruction for it
  is permissive ("let your thoughts go wherever they will"), not "think of nothing".
- Prefer small plain-JS changes over new frameworks; the RA inherits this code.
- Data layout (`<pid>_<seed>.json`) is read by `scripts/flatten.py`; keep them in step.
