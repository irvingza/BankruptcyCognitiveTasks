#!/usr/bin/env python3
"""flatten.py — combine session JSON files into trials.csv and probes.csv.
Usage: python3 scripts/flatten.py data/*.json
"""
import csv, json, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
trials, probes, dims = [], [], []
for p in sys.argv[1:]:
    d = json.load(open(p)); m = d["meta"]
    base = {k: m.get(k) for k in ("participant", "seed", "order", "block_order", "form_id", "task_version", "started")}
    for t in d["trials"]: trials.append({**base, **t})
    for r in d.get("rests", []):
        for pr in r["probes"]: probes.append({**base, "rest_position": r["position"], **pr})
        for dm in r["dims"]: dims.append({**base, "rest_position": r["position"], **dm})

def write(name, rows):
    if not rows: return
    keys = list(dict.fromkeys(k for r in rows for k in r))
    with open(os.path.join(ROOT, "data", name), "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=keys); w.writeheader(); w.writerows(rows)
    print(f"{name}: {len(rows)} rows")

write("trials.csv", trials); write("probes.csv", probes); write("dims.csv", dims)
