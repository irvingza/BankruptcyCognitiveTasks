// task.js — assembles the pre-pilot session and runs it.
//   welcome → rest instructions → rest (start, 50 s, 1 probe, 1 fade) → task instructions →
//   practice (6 word + 6 CS trials, feedback, gate 9/12, max 2 rounds) → 160 trials back-to-back →
//   fixed transition → rest (end, 2 min, 2 probes, 2 fades) → save/download
(function () {
  const C = window.CONFIG, S = window.STIMULI;
  const params = new URLSearchParams(location.search);
  const pid = params.get("pid") || ("p" + Math.random().toString(36).slice(2, 10));
  const seed = params.has("seed") ? (Number(params.get("seed")) >>> 0)
                                  : (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);
  // pre-pilot conveniences: timing and word placement can be overridden from the URL
  for (const k of ["fixation", "deadline", "blank"]) if (params.has(k)) C.timing[k] = Number(params.get(k));
  if (params.has("word")) C.word_position = params.get("word");
  if (params.has("sheets")) C.sheets.url = params.get("sheets");
  const session = Sequence.generateSession(seed, S, C);
  const auditErrs = Sequence.audit(session, S, C);
  if (auditErrs.length) { document.body.innerHTML = "<pre>Sequence audit failed:\n" + auditErrs.join("\n") + "</pre>"; return; }
  const restRnd = Sequence.mulberry32(seed ^ 0x9E3779B9);   // rest timing: separate stream, same seed
  const rest = position => restTrial(C.rest[position], C.rest.fade, C.rest.caption, restRnd, { phase: "rest", rest_position: position });

  const meta = { participant: pid, seed, order: session.order, block_order: session.block_order.join("-"),
    form_id: session.form_id, task_version: C.version, started: new Date().toISOString(),
    timing: { ...C.timing }, word_position: C.word_position, mapping: { left: C.mapping.left, right: C.mapping.right },
    user_agent: navigator.userAgent, screen: `${screen.width}x${screen.height}`,
    viewport: `${innerWidth}x${innerHeight}`, touch: ("ontouchstart" in window) };

  // Own container: initJsPsych() without display_element wipes <body>, which
  // removes any <style> that lives there (true of hosted copies of this page).
  const display = document.createElement("div"); display.id = "task-root";
  document.body.appendChild(display);
  const jsPsych = initJsPsych({ display_element: display, on_finish: () => finishSession() });
  const m = C.mapping;
  const mapText = `Tap the <b>${m.label[m.left]}</b> area on the left of the screen, or the <b>${m.label[m.right]}</b> area on the right.` +
                  ` <span class="hint">On a computer: <b>${m.key_left.toUpperCase()}</b> = ${m.label[m.left]}, <b>${m.key_right.toUpperCase()}</b> = ${m.label[m.right]}.</span>`;
  const page = html => `<div class="txt">${html}</div>`;

  const timeline = [];
  const nPrac = C.practice.n_words + C.practice.n_cs;
  timeline.push({ type: jsPsychPreload, images: session.practice.concat(...session.blocks.map(b => b.trials)).map(t => t.face_file),
    show_progress_bar: true, message: "<p>Loading…</p>", continue_after_error: true });

  timeline.push({ type: jsPsychHtmlButtonResponse, choices: ["Start"], stimulus: page(
    `<h1>Welcome</h1><p>This part takes about 7 minutes.</p>
     <p>Please hold your phone upright, turn off notifications if you can, and find a quiet spot.</p>`) });
  // ---- rest block FIRST (participant-facing text never calls it "rest") ----
  timeline.push({ type: jsPsychInstructions, show_clickable_nav: true, button_label_next: "Next", button_label_previous: "Back", pages: [
    page(`<p>For the next few minutes, keep your eyes focused on the cross in the middle of the screen and let your thoughts go
          wherever they will. There is nothing you need to do; just think about whatever comes to mind.</p>`),
    page(`<p>A few times, the screen will pause and ask some questions about what was going through your mind.
          Now and then, the cross will fade. When you notice this, tap anywhere on the screen or click any key so that the cross comes back.</p>
          <p>Please stay on this page until the cross disappears. The survey will continue from there.</p>
          <p>Tap or click Next to begin.</p>`),
  ] });
  timeline.push(rest("start"));

  timeline.push({ type: jsPsychInstructions, show_clickable_nav: true, button_label_next: "Next", button_label_previous: "Back", pages: [
    page(`<h1>Faces and words</h1>
          <p>On each screen you will see a <b>photo of a face</b> with a word written across it.</p>
          <p>Your job: decide <b>as quickly as you can</b> whether the <b>picture</b> shows a <b>man</b> or a <b>woman</b>.</p>
          <p>${mapText}</p>
          <p><b>Ignore the text.</b> The word is not part of the task. Always answer for the <b>picture</b>, never for the word.</p>`),
    page(`<p>Respond as quickly as you can without making mistakes.</p>
          <p>We'll start with ${nPrac} practice screens. During practice you'll be told whether each answer was right,
             and "too slow" if you took too long.</p>`),
  ] });
  const ready = label => ({ type: jsPsychHtmlKeyboardResponse, choices: "NO_KEYS", trial_duration: 1500,
    stimulus: page(`<p class="ready">${label}</p>`), data: { phase: "ready" } });

  const fwTrial = (t, extra) => ({ type: FaceWordPlugin, word: t.word, face_file: t.face_file, correct: t.correct,
    is_cs: t.word_category === "CS", word_over: C.word_position === "over",
    fixation_ms: C.timing.fixation, deadline_ms: C.timing.deadline,
    blank_ms: C.timing.blank, feedback_ms: C.timing.feedback, mapping: m,
    meta: { phase: "task", block: t.block, block_type: t.block_type, block_position: extra.pos, trial: t.trial,
      trial_in_block: t.trial_in_block, word: t.word, word_category: t.word_category, congruency: t.congruency,
      face_id: t.face_id, face_gender: t.face_gender, face_group: t.face_group, correct_response: t.correct } });

  // ---- practice: feedback + "too slow"; repeat once if below the gate ----
  let practiceRound = 0;
  const practiceBlock = { timeline: [ ready("Get ready…") ].concat(session.practice.map(t => {
      const tr = fwTrial(t, { pos: 0 }); tr.meta.phase = "practice"; tr.feedback = true; tr.show_too_slow = true;
      tr.deadline_ms = C.timing.practice_deadline;
      tr.on_start = trial => { trial.meta = { ...trial.meta, practice_round: practiceRound + 1 }; }; return tr; })) };
  const practiceLoop = { timeline: [practiceBlock, {
      type: jsPsychHtmlButtonResponse, choices: ["Continue"], stimulus: () => {
        const last = jsPsych.data.get().filter({ phase: "practice" }).values().slice(-nPrac);
        const nOk = last.filter(d => d.correct).length;
        practiceLoop._pass = nOk >= C.practice.pass_min_correct || practiceRound + 1 >= C.practice.max_rounds;
        return page(practiceLoop._pass
          ? `<p>End of practice: ${nOk} of ${nPrac} correct.</p>
             <p>The task takes about 3 minutes. ${mapText} Always answer for the <b>picture</b>, never the word.</p>`
          : `<p>${nOk} of ${nPrac} correct. Let's run the practice once more.</p>
             <p>Remember: decide whether the <b>picture</b> shows a man or a woman, and ignore the text.
                ${mapText}</p>`);
      }, data: { phase: "practice_result" } } ],
    loop_function: () => { practiceRound++; return !practiceLoop._pass; } };
  timeline.push(practiceLoop);
  timeline.push(ready("Here we go…"));

  session.blocks.forEach((b, i) => {
    b.trials.forEach(t => timeline.push(fwTrial(t, { pos: i + 1 })));
  });

  // ---- rest block AGAIN at the end: fixed transition (not self-paced, so the lag from the
  //      last block is constant), then the cross; no further instructions ----
  timeline.push({ type: jsPsychHtmlKeyboardResponse, choices: "NO_KEYS", trial_duration: C.rest.transition_ms, stimulus: page(
    `<p>Now the cross again. Keep your eyes focused on it and let your thoughts go wherever they will; there is nothing you need to do.
        Tap when it fades. A few times the screen will pause and ask some questions.</p>`),
    data: { phase: "transition" } });
  timeline.push(rest("end"));

  timeline.push({ type: jsPsychHtmlKeyboardResponse, choices: "NO_KEYS", trial_duration: 400, stimulus: "" });

  // ---- save ----
  function finishSession() {
    const all = jsPsych.data.get().values();
    const trials = all.filter(d => d.phase === "practice" || d.phase === "task").map(d => ({
      phase: d.phase, practice_round: d.practice_round, block: d.block, block_type: d.block_type, block_position: d.block_position, trial: d.trial,
      trial_in_block: d.trial_in_block, word: d.word, word_category: d.word_category, congruency: d.congruency,
      face_id: d.face_id, face_gender: d.face_gender, face_group: d.face_group, correct_response: d.correct_response,
      response: d.response, response_side: d.response_side, rt: d.rt, correct: d.correct, timeout: d.timeout,
      input: d.input, time_elapsed: d.time_elapsed }));
    const rests = all.filter(d => d.phase === "rest").map(rest => ({ position: rest.rest_position,
      duration_ms: rest.rest_duration_ms, probe_times_ms: rest.probe_times_ms, fade_times_ms: rest.fade_times_ms,
      probes: rest.probes, fades: rest.dims, taps: rest.taps }));
    const out = { study: "battery", meta: { ...meta, finished: new Date().toISOString(), total_ms: jsPsych.getTotalTime() },
      trials, rests };
    const json = JSON.stringify(out, null, 1);
    const fname = `${pid}_${seed}.json`;
    const summary = quickSummary(trials);

    endScreen(display, page, `<h1>All done — thank you.</h1>
      <p class="hint">Pre-pilot summary (not shown in the field version):</p><pre style="font-size:13px">${summary}</pre>`,
      json, fname, C.sheets);
  }

  function quickSummary(trials) {
    const med = xs => { const s = xs.slice().sort((a, b) => a - b); return s.length ? Math.round(s[Math.floor(s.length / 2)]) : "–"; };
    const lines = [];
    for (const b of session.blocks) {
      const ts = trials.filter(t => t.phase === "task" && t.block === b.name);
      const ok = ts.filter(t => t.correct), rts = ok.map(t => t.rt);
      let line = `${b.name.padEnd(3)} ${String(ts.length).padStart(3)} trials  acc ${Math.round(100 * ok.length / ts.length)}%  median RT ${med(rts)} ms`;
      if (b.type === "CS") {
        const c = ok.filter(t => t.congruency === "congruent").map(t => t.rt), i = ok.filter(t => t.congruency === "incongruent").map(t => t.rt);
        line += `  (congruent ${med(c)}, incongruent ${med(i)}, effect ${med(i) - med(c)} ms)`;
      }
      lines.push(line);
    }
    const miss = trials.filter(t => t.phase === "task" && t.timeout).length;
    const rests = jsPsych.data.get().filter({ phase: "rest" }).values().map(r =>
      `rest ${r.rest_position}: ${r.rest_duration_ms / 1000 | 0} s, probes at ${r.probes.map(p => (p.at_ms / 1000 | 0) + " s").join(", ")}, fades ` +
      (r.dims.length ? r.dims.map(d => `${d.onset / 1000 | 0} s → ${d.hit ? d.rt + " ms" : "no tap"}`).join("; ") : "none"));
    return lines.join("\n") + `\npractice rounds ${practiceRound}  silent timeouts ${miss}\n` + rests.join("\n") +
      `\norder ${session.order}: ${session.block_order.join(" → ")}  seed ${seed}`;
  }

  jsPsych.run(timeline);
})();
