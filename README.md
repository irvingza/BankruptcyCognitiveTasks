# battery-pilot — face-word interference task, pre-pilot build

Smartphone-browser implementation (jsPsych 7.3.4, vendored in `lib/`) of the
short-form battery in `scarcity_cognitive_battery_design_v5.md`, with the rest
block per the rest spec of 2026-10-28 and the PI's pre-pilot changes of the same day:
rest (start: 50 s, 2 fades, 1 probe which closes the block) → practice (6 word +
6 CS trials, feedback and "too slow", gate 9/12, at most 2 rounds) → N20 / FT40 /
CS40 / N20 back-to-back in one of three orders (FT at 40 is the long arm of the
dosage question; the settled short form is FT20) → fixed 5 s transition → rest
(end: 2 min, 4 fades, probe at ~60 s and a final probe that closes the block).
Each N block is item-matched to half the FT words (alternating valence ranks).
Trials are response-terminated with a silent 5 s cap; no fixation cross between
trials (blank 300 ms); word superimposed on the face. One stimulus form, one
session. No waves, no Qualtrics handshake, no cross-wave assignment. ~7 min.

`rest-study/` is the separate static-vs-fading-cross rest experiment (spec §6):
`rest-study/index.html?cond=static|fade` (random if omitted). 3 min, 3 probes;
the fade condition adds 2-3 slow fades that stay faded until any tap/key, never
within 5 s of a probe. Both pages share the rest plugin and schedulers in
`plugins.js`, so a change there applies to both.

## Run it

Hosted on GitHub Pages from this repo: https://irvingza.github.io/BankruptcyCognitiveTasks/
(rest study: …/rest-study/). Any static host works; the only server code is the
Apps Script receiver in `server/`. Open `index.html` over http(s)
(not `file://` — browsers block the image preload). Quick local test:

    cd battery-pilot && python3 -m http.server 8000
    # then http://localhost:8000/  (phone on the same wifi: http://<your-ip>:8000/)

URL parameters:

    ?pid=zac&seed=42     participant id (logged); seed (fixed trial table)

With no parameters a random id and seed are drawn; both are in the data file.
The same seed always gives the same trial table, so any session can be
regenerated offline for auditing: `node scripts/audit_sequences.js`.

Keyboard works on a computer: F = man, J = woman (see `config.js: mapping`).

## Data

Each finished session is POSTed to the Google Sheet "Battery Pre-pilot Data" via a
small Apps Script receiver — setup in `server/README.md` (one-time, 2 minutes).
With no receiver URL in `config.js`, a JSON file `<pid>_<seed>.json` is offered for download
(`meta`, `trials[]`, `rests[]` with `position: start|end`, each holding the
probes — items 1-4 as 1-7, item 5 as one 0/1 per option, per-page response
times, time from block onset) and a per-block summary is shown on screen
(pre-pilot only). Timing, word placement and mapping actually used are in `meta`. To save to a server instead: create a
DataPipe experiment (https://pipe.jspsych.org, writes to an OSF project you
own) and put its id in `config.js: datapipe.experiment_id`.

`scripts/flatten.py data/*.json` turns the JSON files into one trial-level CSV
plus one probe-level CSV.

## Face images — placeholders

`images/faces/` currently holds grey silhouettes (`scripts/make_placeholder_faces.py`).
Replace them with the CFD images on the machine that has the CFD download:

    python3 scripts/fetch_cfd_images.py "/…/Faces/cfd/CFD Version 3.0/Images"

That copies one neutral image per manifest id (signifiers-removed variant for
CFD-INDIA) to `images/faces/<model_id>.jpg`. No standardization yet.
CFD licence: check the pending web-hosting clarification before putting real
images on a public URL.

## Stimulus form

`scripts/build_stimuli.py` writes `stimuli/stimuli.js` from the two pinned CSVs.
Pre-pilot form = 20 finance words spread evenly across the valence ranking of
the 46 matched finance keeps, their 40 matched neutrals, and 10 practice
neutrals drawn from the unused neutrals. To change the form, edit the
selection in that script and re-run it.

## Files

    index.html        shell
    config.js         every parameter: block sizes, orders, timing, mapping, rest, data
    stimuli/          final_word_list.csv, face_manifest.csv (pinned), stimuli.js (generated)
    sequence.js       seeded trial-table generator + independent audit (mirrors 08_sequence_generator.Rmd)
    plugins.js        face-word trial, rest period, probe
    task.js           timeline assembly, instructions, save
    style.css
    lib/              jsPsych 7.3.4 + plugins (vendored, no CDN)
    rest-study/       standalone static-vs-fading rest experiment
    server/           Code.gs (Apps Script receiver) + setup README
    scripts/          build_stimuli.py, make_placeholder_faces.py, fetch_cfd_images.py,
                      audit_sequences.js, flatten.py
    data/             test run output + screenshots

## Sequencing constraints enforced (and re-checked by `Sequence.audit`)

- every word once per session; every face at most once; practice faces/words never in main blocks
- 10F/10M per 20-trial block; CS 20F/20M and 10F/10M within each congruency
- CS 20 congruent / 20 incongruent, transitions CC/CI/IC/II balanced (±1), word = MAN/WOMAN
- no run of 4+ trials with the same correct response, in any block
- morphological neighbours ≥ 10 trials apart (evict/eviction, pawn/pawnshop in the 40-word form)
- CS always third; FT exactly once; order drawn from `config.js: order_weights`

## Deviations from the field design, on purpose (pre-pilot)

- randomization on-device from a logged seed (field: pre-generated in R)
- 12 practice faces taken from the 192 (field: separate practice identities)
- practice words = unused neutrals (field: the PRACTICE rows of final_word_list.csv)
- FT at 40 trials (N stays 20), no deadline message, blank ITI, fading cross in both rests, last probe closes each rest — PI pre-pilot calls, not yet in the design doc
- single form; no treatment-arm stratification
- "broad" cut from the neutrals (gender-coded); see EXCLUDE_NEUTRAL in build_stimuli.py
