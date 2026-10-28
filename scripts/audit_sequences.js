#!/usr/bin/env node
// audit_sequences.js — regenerate N sessions from seeds 1..N and re-check every
// constraint with Sequence.audit (independent re-derivation), plus determinism.
// Usage: node scripts/audit_sequences.js [N]
const path = require("path");
global.window = {};
require(path.join(__dirname, "..", "config.js"));
require(path.join(__dirname, "..", "stimuli", "stimuli.js"));
const Sequence = require(path.join(__dirname, "..", "sequence.js"));
const { CONFIG, STIMULI } = window;

const N = Number(process.argv[2] || 1000);
const orders = { 1: 0, 2: 0, 3: 0 }; let bad = 0;
for (let seed = 1; seed <= N; seed++) {
  const s = Sequence.generateSession(seed, STIMULI, CONFIG);
  const errs = Sequence.audit(s, STIMULI, CONFIG);
  const s2 = Sequence.generateSession(seed, STIMULI, CONFIG);
  if (JSON.stringify(s) !== JSON.stringify(s2)) errs.push("non-deterministic");
  orders[s.order]++;
  if (errs.length) { bad++; console.log("seed", seed, errs); }
}
console.log(`audited ${N} sessions: ${bad} with violations; order counts`, orders);
process.exit(bad ? 1 : 0);
