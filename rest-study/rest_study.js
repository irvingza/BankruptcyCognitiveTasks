// rest_study.js — standalone rest block, static vs fading cross (rest spec §6).
(function () {
  const C = window.REST_CONFIG;
  const params = new URLSearchParams(location.search);
  if (params.has("sheets")) C.sheets.url = params.get("sheets");
  const pid = params.get("pid") || ("p" + Math.random().toString(36).slice(2, 10));
  const seed = params.has("seed") ? (Number(params.get("seed")) >>> 0) : (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0);
  const rnd = Sequence.mulberry32(seed);
  const cond = C.conditions.includes(params.get("cond")) ? params.get("cond") : C.conditions[Math.floor(rnd() * C.conditions.length)];

  const probeTimes = scheduleProbes(C.probes, C.duration_ms, rnd);
  const nFades = cond === "fade" ? C.fade.n_min + Math.floor(rnd() * (C.fade.n_max - C.fade.n_min + 1)) : 0;
  const fadeTimes = scheduleFades(C.fade, nFades, C.duration_ms, probeTimes, rnd);

  const meta = { participant: pid, seed, condition: cond, task_version: C.version, started: new Date().toISOString(),
    duration_ms: C.duration_ms, probe_times_ms: probeTimes, fade_times_ms: fadeTimes.length ? fadeTimes : null,
    user_agent: navigator.userAgent, screen: `${screen.width}x${screen.height}`, touch: ("ontouchstart" in window) };

  const display = document.createElement("div"); display.id = "task-root"; document.body.appendChild(display);
  const jsPsych = initJsPsych({ display_element: display, on_finish: finish });
  const page = html => `<div class="txt">${html}</div>`;

  const screen2 = cond === "fade"
    ? `<p>A few times, the screen will pause and ask some questions about what was going through your mind. Now and then, the cross will fade.
         When you notice this, tap anywhere on the screen or click any key so that the cross comes back.</p>`
    : `<p>A few times, the screen will pause and ask some questions about what was going through your mind.</p>`;

  const timeline = [
    { type: jsPsychInstructions, show_clickable_nav: true, button_label_next: "Next", button_label_previous: "Back", pages: [
      page(`<p>For the next few minutes, keep your eyes focused on the cross in the middle of the screen and let your thoughts go
            wherever they will. There is nothing you need to do; just think about whatever comes to mind.</p>`),
      page(`${screen2}<p>Please stay on this page until the cross disappears. The survey will continue from there.</p>
            <p>Tap or click Next to begin.</p>`),
    ] },
    restTrial({ duration_ms: C.duration_ms, probes: C.probes, n_fades: nFades }, C.fade, C.caption, rnd, { phase: "rest" }),
    { type: jsPsychHtmlKeyboardResponse, choices: "NO_KEYS", trial_duration: 300, stimulus: "" },
  ];

  function finish() {
    const r = jsPsych.data.get().values().find(d => d.phase === "rest");
    const out = { study: "rest-study", meta: { ...meta, finished: new Date().toISOString(), total_ms: jsPsych.getTotalTime() },
      rest: { duration_ms: r.rest_duration_ms, probes: r.probes, fades: r.dims, taps: r.taps } };
    const json = JSON.stringify(out, null, 1), fname = `rest_${pid}_${seed}.json`;
    const fades = (r.dims || []).map(d => `${(d.onset / 1000).toFixed(0)} s: ${d.hit ? d.rt + " ms" : "no response"}${d.restored_by_probe ? " (restored by probe)" : ""}`).join("; ");
    endScreen(display, page, `<h1>All done — thank you.</h1>
      <p class="hint">Pre-pilot summary: condition <b>${cond}</b>, ${r.probes.length} probes at ${r.probes.map(p => (p.at_ms / 1000).toFixed(0) + " s").join(", ")}
        ${fades ? "; fades " + fades : ""}; block ${(jsPsych.getTotalTime() / 1000).toFixed(0)} s including answering.</p>`,
      json, fname, C.sheets);
  }
  jsPsych.run(timeline);
})();
