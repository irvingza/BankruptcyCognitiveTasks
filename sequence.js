// sequence.js — seeded, on-device trial-table generator for the pre-pilot.
// Mirrors the constraints of 08_sequence_generator.Rmd for the short form
// (N20 – FT20 – CS40 – N20, three orders). Same seed → same table, so the
// table can be regenerated offline from the logged seed for auditing.
//
// Field version: tables are pre-generated server-side in R; this file is the
// pre-pilot stand-in and is written so the constraint list is one-to-one.
//
// Exposes window.Sequence = { generateSession(seed, stimuli, config), mulberry32 }
(function () {
  // ---- seeded PRNG (mulberry32) ----
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rnd) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function maxRun(seq) {
    let best = 1, run = 1;
    for (let i = 1; i < seq.length; i++) {
      run = seq[i] === seq[i - 1] ? run + 1 : 1; if (run > best) best = run;
    }
    return best;
  }
  function pickWeighted(weights, rnd) {
    const keys = Object.keys(weights); const tot = keys.reduce((s, k) => s + weights[k], 0);
    let r = rnd() * tot;
    for (const k of keys) { r -= weights[k]; if (r <= 0) return Number(k); }
    return Number(keys[keys.length - 1]);
  }

  // balanced gender sequence of length n (n/2 F, n/2 M), runs ≤ maxRun
  function genderSeq(n, maxRunLen, rnd, maxTries) {
    const base = Array(n / 2).fill("F").concat(Array(n / 2).fill("M"));
    for (let t = 0; t < maxTries; t++) {
      const s = shuffle(base, rnd);
      if (maxRun(s) <= maxRunLen) return s;
    }
    throw new Error("genderSeq: no valid sequence");
  }

  // CS block: n trials, n/2 congruent (C) / n/2 incongruent (I);
  // transitions CC, CI, IC, II balanced (each within ±1 of (n-1)/4);
  // gender 50/50 overall and 50/50 within each congruency; response runs ≤ maxRun
  function csSeq(n, maxRunLen, rnd, maxTries) {
    const congBase = Array(n / 2).fill("C").concat(Array(n / 2).fill("I"));
    const q = (n - 1) / 4;
    for (let t = 0; t < maxTries; t++) {
      const cong = shuffle(congBase, rnd);
      const trans = { CC: 0, CI: 0, IC: 0, II: 0 };
      for (let i = 1; i < n; i++) trans[cong[i - 1] + cong[i]]++;
      if (Object.values(trans).some(v => Math.abs(v - q) > 1)) continue;
      // genders: n/4 F and n/4 M within each congruency cell
      const gC = shuffle(Array(n / 4).fill("F").concat(Array(n / 4).fill("M")), rnd);
      const gI = shuffle(Array(n / 4).fill("F").concat(Array(n / 4).fill("M")), rnd);
      const gender = []; let c = 0, k = 0;
      for (let i = 0; i < n; i++) gender.push(cong[i] === "C" ? gC[c++] : gI[k++]);
      if (maxRun(gender) > maxRunLen) continue;
      return { cong, gender, trans };
    }
    throw new Error("csSeq: no valid sequence");
  }

  function generateSession(seed, S, C) {
    const rnd = mulberry32(seed >>> 0);
    const order = pickWeighted(C.order_weights, rnd);
    const blockNames = C.orders[order];
    const maxRunLen = C.seq.max_run_same_response;
    const tries = C.seq.max_tries;

    // ---- faces: practice faces first (half F / half M), then the session; each face once ----
    const nPrac = C.practice.n_words + C.practice.n_cs;
    const F = shuffle(S.faces.filter(f => f.gender === "F"), rnd);
    const M = shuffle(S.faces.filter(f => f.gender === "M"), rnd);
    const pracF = F.splice(0, nPrac / 2), pracM = M.splice(0, nPrac / 2);
    const takeFace = g => (g === "F" ? F : M).shift();

    // ---- words ----
    const byBlock = b => S.words.filter(w => w.block === b);
    const wordsFor = { FT: byBlock("FT"), N1: byBlock("N1"), N2: byBlock("N2") };

    // neighbour map
    const nb = {};
    for (const [a, b] of S.neighbors) { (nb[a] = nb[a] || []).push(b); (nb[b] = nb[b] || []).push(a); }

    let blocks, tryCount = 0;
    while (true) {
      if (++tryCount > tries) throw new Error("generateSession: neighbour constraint unsatisfiable");
      // snapshot face pools so a retry does not consume faces
      const Fs = F.slice(), Ms = M.slice();
      const take = g => (g === "F" ? Fs : Ms).shift();
      blocks = [];
      for (const name of blockNames) {
        const type = name === "CS" ? "CS" : name === "FT" ? "FT" : "N";
        const trialsList = [];
        if (type === "CS") {
          const { cong, gender, trans } = csSeq(C.trials.CS, maxRunLen, rnd, tries);
          for (let i = 0; i < C.trials.CS; i++) {
            const face = take(gender[i]);
            const wordGender = cong[i] === "C" ? gender[i] : (gender[i] === "F" ? "M" : "F");
            trialsList.push({ block: name, block_type: type, trial_in_block: i + 1,
              word: C.mapping.label[wordGender], word_category: "CS",
              congruency: cong[i] === "C" ? "congruent" : "incongruent",
              face_id: face.id, face_gender: face.gender, face_group: face.group, face_file: face.file,
              correct: face.gender });
          }
          blocks.push({ name, type, trials: trialsList, cs_transitions: trans });
        } else {
          const n = C.trials[type];
          const gender = genderSeq(n, maxRunLen, rnd, tries);
          const words = shuffle(wordsFor[name], rnd);
          for (let i = 0; i < n; i++) {
            const face = take(gender[i]);
            trialsList.push({ block: name, block_type: type, trial_in_block: i + 1,
              word: words[i].word, word_category: words[i].category, congruency: null,
              face_id: face.id, face_gender: face.gender, face_group: face.group, face_file: face.file,
              correct: face.gender });
          }
          blocks.push({ name, type, trials: trialsList });
        }
      }
      // neighbour separation on global trial index
      const flat = blocks.flatMap(b => b.trials); let ok = true;
      const pos = {}; flat.forEach((t, i) => { pos[t.word] = i; });
      for (const a in nb) for (const b of nb[a]) {
        if (a in pos && b in pos && Math.abs(pos[a] - pos[b]) < C.seq.neighbor_min_gap) ok = false;
      }
      if (ok) break;
    }
    // number trials globally
    let g = 0; for (const b of blocks) for (const t of b.trials) t.trial = ++g;

    // ---- practice: n_words neutral-word trials + n_cs CS trials (half congruent), shuffled together;
    //      one practice face per trial, never reused in the main blocks ----
    const pw = shuffle(S.practice_words, rnd).slice(0, C.practice.n_words);
    const kinds = shuffle(Array(C.practice.n_words).fill("W").concat(Array(C.practice.n_cs).fill("CS")), rnd);
    const csCong = shuffle(Array(Math.ceil(C.practice.n_cs / 2)).fill("C").concat(Array(Math.floor(C.practice.n_cs / 2)).fill("I")), rnd);
    const pg = genderSeq(nPrac, maxRunLen, rnd, tries);
    const pF = pracF.slice(), pM = pracM.slice(); let wi = 0, ci = 0;
    const practice = pg.map((gd, i) => {
      const face = (gd === "F" ? pF : pM).shift();
      const base = { block: "PRACTICE", block_type: "PRACTICE", trial_in_block: i + 1, trial: i + 1,
        face_id: face.id, face_gender: face.gender, face_group: face.group, face_file: face.file, correct: face.gender };
      if (kinds[i] === "CS") {
        const cong = csCong[ci++]; const wordGender = cong === "C" ? gd : (gd === "F" ? "M" : "F");
        return { ...base, word: C.mapping.label[wordGender], word_category: "CS",
          congruency: cong === "C" ? "congruent" : "incongruent" };
      }
      return { ...base, word: pw[wi++].word, word_category: "PRACTICE", congruency: null };
    });

    return { seed: seed >>> 0, order, block_order: blockNames, form_id: S.form_id, practice, blocks };
  }

  // ---- self-audit: re-derives every constraint independently of the generator ----
  function audit(session, S, C) {
    const errs = [];
    const flat = session.blocks.flatMap(b => b.trials);
    const ids = flat.map(t => t.face_id).concat(session.practice.map(t => t.face_id));
    if (new Set(ids).size !== ids.length) errs.push("face repeated");
    const words = flat.map(t => t.word).filter(w => !["MAN", "WOMAN"].includes(w));
    if (new Set(words).size !== words.length) errs.push("word repeated");
    if (words.length !== C.trials.FT + 2 * C.trials.N) errs.push("word count " + words.length);
    for (const b of session.blocks) {
      const g = b.trials.map(t => t.face_gender);
      if (g.filter(x => x === "F").length !== g.length / 2) errs.push(b.name + " gender imbalance");
      if (maxRun(g) > C.seq.max_run_same_response) errs.push(b.name + " response run");
      if (b.type === "CS") {
        const c = b.trials.map(t => t.congruency);
        if (c.filter(x => x === "congruent").length !== C.trials.CS / 2) errs.push("CS congruency count");
        for (const cc of ["congruent", "incongruent"]) {
          const gg = b.trials.filter(t => t.congruency === cc).map(t => t.face_gender);
          if (gg.filter(x => x === "F").length !== C.trials.CS / 4) errs.push("CS gender within " + cc);
        }
        for (const t of b.trials) {
          const lab = C.mapping.label[t.face_gender];
          if ((t.word === lab) !== (t.congruency === "congruent")) errs.push("CS word/congruency mismatch");
        }
        const tr = {}; for (let i = 1; i < c.length; i++) { const k = c[i-1][0] + c[i][0]; tr[k] = (tr[k]||0) + 1; }
        if (Object.values(tr).some(v => Math.abs(v - (C.trials.CS - 1) / 4) > 1)) errs.push("CS transitions unbalanced");
      } else {
        const expect = b.name === "FT" ? "FINANCE" : "NEUTRAL";
        if (!b.trials.every(t => t.word_category === expect)) errs.push(b.name + " wrong word category");
        const want = new Set(S.words.filter(w => w.block === b.name).map(w => w.word));
        if (!b.trials.every(t => want.has(t.word))) errs.push(b.name + " word from wrong set");
      }
    }
    if (session.block_order[2] !== "CS") errs.push("CS not third");
    if (session.block_order.filter(x => x === "FT").length !== 1) errs.push("FT count");
    const pos = {}; flat.forEach((t, i) => { pos[t.word] = i; });
    for (const [a, b] of S.neighbors) if (a in pos && b in pos && Math.abs(pos[a]-pos[b]) < C.seq.neighbor_min_gap) errs.push("neighbours too close: " + a + "/" + b);
    if (session.practice.length !== C.practice.n_words + C.practice.n_cs) errs.push("practice length");
    if (session.practice.filter(t => t.word_category === "CS").length !== C.practice.n_cs) errs.push("practice CS count");
    if (!session.practice.every(t => t.word_category === "CS" || t.word_category === "PRACTICE")) errs.push("practice word category");
    const pracIds = new Set(session.practice.map(t => t.face_id));
    if (flat.some(t => pracIds.has(t.face_id))) errs.push("practice face reused in main blocks");
    return errs;
  }

  window.Sequence = { generateSession, audit, mulberry32 };
  if (typeof module !== "undefined") module.exports = window.Sequence;
})();
