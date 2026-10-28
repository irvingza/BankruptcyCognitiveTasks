#!/usr/bin/env python3
"""build_stimuli.py — turn the two pinned stimulus CSVs into stimuli/stimuli.js
for the pre-pilot runtime.

Inputs (pinned, copied verbatim from the project):
  stimuli/final_word_list.csv   47 FINANCE + 92 NEUTRAL (slots A/B)
  stimuli/face_manifest.csv     192 main faces (96F / 96M)

Pre-pilot form (ONE form only; PI to replace with a screened form later):
  * N_FINANCE finance words chosen from the 46 finance words that have matched
    neutrals, spread evenly across the valence ranking.  (`credit card` has no
    match and is skipped.)  Pre-pilot: 40 (the long arm of the dosage question).
  * The matched neutrals (slot A -> N block 1, slot B -> N block 2).
  * 10 practice words = 10 neutrals NOT in the form (lowest |zipf - 3.68| first),
    because the project's PRACTICE rows are not in this copy of final_word_list.csv.
  * Morphological neighbours: auto-detected pairs (one word a prefix of the
    other, >= 4 shared leading letters) among the 60 form words.

Faces: all 192 main identities; the runtime draws 100 per session.
  No practice faces in this copy of face_manifest.csv, so the runtime
  takes 10 of the 192 for practice and excludes them from the main draw.

Run:  python3 scripts/build_stimuli.py
"""
import csv, json, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WORDS = os.path.join(ROOT, "stimuli", "final_word_list.csv")
FACES = os.path.join(ROOT, "stimuli", "face_manifest.csv")
OUT   = os.path.join(ROOT, "stimuli", "stimuli.js")

N_FINANCE = 40
N_PER_BLOCK = 20      # each N block is item-matched to half the FT words (alternating ranks)
N_PRACTICE = 10

# Neutrals cut after PI screening (word -> reason). A cut word is replaced by the
# unused neutral closest to its finance word on Zipf + concreteness (same metric
# as 05_neutral_match.R, SDs taken over the 92 neutrals in the file).
EXCLUDE_NEUTRAL = {
    "broad": "gender-coded (slang for a woman)",
}
TARGET_ZIPF = 3.68   # main-list profile (see 07_practice_words.R)

def num(x):
    try: return float(x)
    except: return None

words = list(csv.DictReader(open(WORDS, newline="")))
fin = [w for w in words if w["category"] == "FINANCE"]
neu = [w for w in words if w["category"] == "NEUTRAL"]

matched = {}
for n in neu:
    matched.setdefault(n["matched_to"], {})[n["slot"]] = n
fin_ok = [f for f in fin if f["word"] in matched and set(matched[f["word"]]) == {"A","B"}]
fin_ok.sort(key=lambda f: num(f["valence"]))          # file order is by valence, keep explicit
k = len(fin_ok)
idx = sorted({round(i * k / N_FINANCE) for i in range(N_FINANCE)})
# guard against rounding collisions
while len(idx) < N_FINANCE:
    for j in range(k):
        if j not in idx: idx.append(j); break
    idx.sort()
form_fin = [fin_ok[i] for i in idx[:N_FINANCE]]

def rec(w, cat, block, matched_to=None):
    return {"word": w["word"], "category": cat, "block": block,
            "matched_to": matched_to,
            "valence": num(w["valence"]), "arousal": num(w["arousal"]),
            "zipf": num(w["zipf"]), "concreteness": num(w["concreteness"])}

import statistics
sz = statistics.pstdev([num(n["zipf"]) for n in neu]); sc = statistics.pstdev([num(n["concreteness"]) for n in neu])
form_fin_words = {f["word"] for f in form_fin}
taken = {n["word"] for f in form_fin for n in matched[f["word"]].values()}
def replacement(f):
    pool = [n for n in neu if n["word"] not in taken and n["word"] not in EXCLUDE_NEUTRAL]
    best = min(pool, key=lambda n: ((num(n["zipf"]) - num(f["zipf"])) / sz) ** 2 +
                                   ((num(n["concreteness"]) - num(f["concreteness"])) / sc) ** 2)
    taken.add(best["word"]); return best

form = []; swaps = []
for i, f in enumerate(form_fin):
    form.append(rec(f, "FINANCE", "FT"))
    # N1 takes the slot-A neutral of even-ranked finance words, N2 the slot-B neutral of odd-ranked ones,
    # so each N block (N_PER_BLOCK) is matched one-to-one to half of the FT block on Zipf + concreteness
    pairs = (("A", "N1"), ("B", "N2")) if N_PER_BLOCK == N_FINANCE else ((("A", "N1"),) if i % 2 == 0 else (("B", "N2"),))
    for slot, block in pairs:
        n = matched[f["word"]][slot]
        if n["word"] in EXCLUDE_NEUTRAL:
            r = replacement(f); swaps.append((n["word"], r["word"], f["word"], EXCLUDE_NEUTRAL[n["word"]])); n = r
        form.append(rec(n, "NEUTRAL", block, f["word"]))

used = {w["word"] for w in form}
spare = [n for n in neu if n["word"] not in used and n["word"] not in EXCLUDE_NEUTRAL and num(n["zipf"]) is not None]
spare.sort(key=lambda n: abs(num(n["zipf"]) - TARGET_ZIPF))
practice = [rec(n, "PRACTICE", "P") for n in spare[:N_PRACTICE]]

# morphological neighbours among the 60 form words (+ practice)
allw = [w["word"] for w in form + practice]
neighbors = []
for i, a in enumerate(allw):
    for b in allw[i+1:]:
        s, l = (a, b) if len(a) <= len(b) else (b, a)
        if len(s) >= 4 and l.startswith(s) and s != l:
            neighbors.append([a, b])

faces = []
for r in csv.DictReader(open(FACES, newline="")):
    if r["role"] != "main": continue
    faces.append({"id": r["model_id"], "db": r["database"], "group": r["group"],
                  "gender": r["gender"], "typicality": num(r["typicality"]),
                  "file": f"images/faces/{r['model_id']}.jpg"})

assert len(form) == N_FINANCE + 2 * N_PER_BLOCK and len(practice) == N_PRACTICE
assert sum(1 for f in faces if f["gender"]=="F") == 96 and len(faces) == 192

out = {"form_id": "prepilot-A",
       "built_from": {"words": "final_word_list.csv (47 FINANCE / 92 NEUTRAL)",
                      "faces": "face_manifest.csv (192 main)"},
       "words": form, "practice_words": practice, "neighbors": neighbors,
       "faces": faces}
with open(OUT, "w") as fh:
    fh.write("// GENERATED by scripts/build_stimuli.py — do not edit by hand.\n")
    fh.write("window.STIMULI = " + json.dumps(out, indent=1) + ";\n")

print(f"form {out['form_id']}: {len(form_fin)} finance / {len(form)-len(form_fin)} neutral ({N_PER_BLOCK} per N block) / {len(practice)} practice")
print("finance:", ", ".join(f["word"] for f in form_fin))
print("practice:", ", ".join(p["word"] for p in practice))
print("neighbour pairs:", neighbors)
for old, new, f, why in swaps: print(f"swapped neutral {old!r} -> {new!r} (matched to {f}; {why})")
print("faces:", len(faces))
