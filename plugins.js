// plugins.js — three small jsPsych 7 plugins written for this task:
//   face-word : fixation → word over face (tap zones / keys, deadline) → too-slow → blank
//   rest      : fixation cross that dims at random intervals; probes interrupt it
//   probe     : free-text "what was on your mind" + three sliders (no thumb until touched)
(function () {
  const PT = jsPsychModule.ParameterType;

  // ---------------------------------------------------------------- face-word
  class FaceWordPlugin {
    static info = { name: "face-word", parameters: {
      word: { type: PT.STRING }, face_file: { type: PT.STRING }, correct: { type: PT.STRING },
      is_cs: { type: PT.BOOL, default: false }, word_over: { type: PT.BOOL, default: false },
      feedback: { type: PT.BOOL, default: false },   // practice only: show correct / wrong after each response
      fixation_ms: { type: PT.INT }, deadline_ms: { type: PT.INT }, blank_ms: { type: PT.INT },
      feedback_ms: { type: PT.INT, default: 600 }, show_too_slow: { type: PT.BOOL, default: false },
      mapping: { type: PT.OBJECT }, meta: { type: PT.OBJECT, default: {} },
    } };
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    trial(el, t) {
      const m = t.mapping;
      const wordEl = `<div class="fw-word ${t.is_cs ? "cs" : ""} ${t.word_over ? "over" : ""}" id="fw-word"></div>`;
      el.innerHTML = `
        <div class="fw-stage ${t.word_over ? "word-over" : ""}">
          <div class="fw-top">${t.word_over ? "" : wordEl}</div>
          <div class="fw-mid" id="fw-mid">${t.word_over ? wordEl : ""}</div>
          <div class="fw-zones">
            <div class="fw-zone disabled" id="z-left">${m.label[m.left]}</div>
            <div class="fw-zone disabled" id="z-right">${m.label[m.right]}</div>
          </div>
        </div>`;
      const word = el.querySelector("#fw-word"), mid = el.querySelector("#fw-mid");
      const zL = el.querySelector("#z-left"), zR = el.querySelector("#z-right");
      const img = new Image(); img.src = t.face_file; img.className = "fw-face"; img.draggable = false;

      let onset = null, done = false, keyListener = null, deadlineTimer = null;
      const data = { response: null, response_side: null, rt: null, correct: null, timeout: false,
                     input: null, ...t.meta };

      const respond = (side, how) => {
        if (done || onset === null) return;
        done = true; clearTimeout(deadlineTimer);
        const rt = performance.now() - onset;
        data.response = m[side]; data.response_side = side; data.rt = Math.round(rt * 10) / 10;
        data.correct = data.response === t.correct; data.input = how;
        (side === "left" ? zL : zR).classList.add("active");
        word.textContent = "";
        if (t.feedback) {
          mid.innerHTML = `<div class="fw-feedback ${data.correct ? "ok" : "bad"}">${data.correct ? "correct" : "wrong"}</div>`;
          this.jsPsych.pluginAPI.setTimeout(() => { mid.innerHTML = ""; this.jsPsych.pluginAPI.setTimeout(finish, t.blank_ms); }, t.feedback_ms);
        } else {
          mid.innerHTML = "";
          this.jsPsych.pluginAPI.setTimeout(() => finish(), t.blank_ms);
        }
      };
      const onTimeout = () => {
        if (done) return; done = true; data.timeout = true; data.rt = null;
        word.textContent = "";
        if (t.show_too_slow) {            // practice only
          mid.innerHTML = `<div class="fw-feedback">too slow</div>`;
          this.jsPsych.pluginAPI.setTimeout(() => { mid.innerHTML = ""; this.jsPsych.pluginAPI.setTimeout(finish, t.blank_ms); }, t.feedback_ms);
        } else {                          // silent cap: no message, just move on
          mid.innerHTML = ""; this.jsPsych.pluginAPI.setTimeout(finish, t.blank_ms);
        }
      };
      const finish = () => {
        if (keyListener) this.jsPsych.pluginAPI.cancelKeyboardResponse(keyListener);
        zL.onpointerdown = zR.onpointerdown = null;
        el.innerHTML = "";
        this.jsPsych.finishTrial(data);
      };
      const handler = side => e => { e.preventDefault(); respond(side, "touch"); };

      // fixation → stimulus
      this.jsPsych.pluginAPI.setTimeout(() => {
        mid.insertBefore(img, mid.firstChild);
        word.textContent = t.word;
        zL.classList.remove("disabled"); zR.classList.remove("disabled");
        onset = performance.now();
        zL.onpointerdown = handler("left"); zR.onpointerdown = handler("right");
        keyListener = this.jsPsych.pluginAPI.getKeyboardResponse({
          callback_function: info => respond(info.key === m.key_left ? "left" : "right", "key"),
          valid_responses: [m.key_left, m.key_right], rt_method: "performance", persist: false, allow_held_key: false });
        deadlineTimer = setTimeout(onTimeout, t.deadline_ms);
      }, t.fixation_ms);
    }
  }

  // ---------------------------------------------------------------- rest
  // Runs `duration_ms` of fixation (probe time excluded). `probe_times_ms` are
  // elapsed fixation times at which `on_probe(k, at, host)` is awaited.
  // Static by default. With `dims: true` the cross fades: either at random gaps
  // (dim_min/max_gap_ms) or at `fade_times_ms`; a fade lasts `dim_ms` (CSS
  // transition) and, with `fade_hold`, stays faded until any tap/key restores it
  // (the rest-study version); otherwise it restores itself after dim_ms. A
  // tap/key within `dim_response_window_ms` of onset (or while held) = hit.
  class RestPlugin {
    static info = { name: "rest", parameters: {
      duration_ms: { type: PT.INT }, dim_min_gap_ms: { type: PT.INT }, dim_max_gap_ms: { type: PT.INT },
      dims: { type: PT.BOOL, default: false },
      dim_ms: { type: PT.INT }, dim_opacity: { type: PT.FLOAT }, dim_response_window_ms: { type: PT.INT },
      probe_times_ms: { type: PT.OBJECT }, on_probe: { type: PT.FUNCTION }, rnd: { type: PT.FUNCTION },
      caption: { type: PT.STRING, default: "" },
      fade_times_ms: { type: PT.OBJECT, default: null }, fade_hold: { type: PT.BOOL, default: false },
      end_after_last_probe: { type: PT.BOOL, default: true },
    } };
    constructor(jsPsych) { this.jsPsych = jsPsych; }
    trial(el, t) {
      const rnd = t.rnd || Math.random;
      el.innerHTML = `<div class="rest-stage" id="rest-stage"><div class="rest-cross" id="rest-cross">+</div>
        ${t.caption ? `<div class="rest-caption">${t.caption}</div>` : ""}</div><div id="probe-host"></div>`;
      const stage = el.querySelector("#rest-stage"), cross = el.querySelector("#rest-cross"), host = el.querySelector("#probe-host");
      const dims = [], taps = [], probes = []; let elapsed = 0, lastTick = performance.now(), running = true;
      const fadeQueue = t.fade_times_ms ? t.fade_times_ms.slice() : null;
      const scheduleDim = () => fadeQueue ? (fadeQueue.length ? fadeQueue.shift() : Infinity)
                                          : elapsed + t.dim_min_gap_ms + rnd() * (t.dim_max_gap_ms - t.dim_min_gap_ms);
      let probeIdx = 0, nextDim = scheduleDim();
      let curDim = null, finished = false;
      cross.style.transition = `opacity ${t.dims ? t.dim_ms : 120}ms`;
      const restore = () => { cross.style.opacity = 1; curDim = null; nextDim = fadeQueue ? scheduleDim() : scheduleDim(); };

      const onTap = (how) => {
        if (!running) return;
        const now = elapsed;
        const open = dims.find(d => d.hit === false && (now - d.onset <= t.dim_response_window_ms || (t.fade_hold && d === curDim)));
        if (open) { open.hit = true; open.rt = Math.round(now - open.onset); if (t.fade_hold && open === curDim) restore(); }
        taps.push({ t: Math.round(now), hit: !!open, input: how });
      };
      stage.onpointerdown = e => { e.preventDefault(); onTap("touch"); };
      // any key, anywhere on the page (document-level, so it works even if focus has left the task element)
      const onKey = e => { if (e.repeat) return; if (!running) return; e.preventDefault(); onTap("key"); };
      document.addEventListener("keydown", onKey);

      const tick = () => {
        if (finished) return;
        const now = performance.now();
        if (running) {
          elapsed += now - lastTick;
          if (t.dims && !curDim && elapsed >= nextDim) {
            curDim = { onset: Math.round(elapsed), hit: false, rt: null }; dims.push(curDim);
            cross.style.opacity = t.dim_opacity;
          }
          if (curDim && !t.fade_hold && elapsed - curDim.onset >= t.dim_ms) restore();
          if (probeIdx < t.probe_times_ms.length && elapsed >= t.probe_times_ms[probeIdx]) {
            running = false; const k = probeIdx++; const at = Math.round(elapsed);
            if (curDim) { curDim.restored_by_probe = true; restore(); }
            stage.style.display = "none";
            Promise.resolve(t.on_probe(k, at, host)).then(pd => {
              probes.push({ probe_index: k, at_ms: at, ...pd });
              // the last probe ends the block: no cross after the final questions
              if (probeIdx >= t.probe_times_ms.length && t.end_after_last_probe) { elapsed = Math.max(elapsed, t.duration_ms); }
              stage.style.display = ""; lastTick = performance.now(); running = true;
              if (!fadeQueue) nextDim = scheduleDim();
            });
            lastTick = now; requestAnimationFrame(tick); return;
          }
          if (elapsed >= t.duration_ms) {
            finished = true; document.removeEventListener("keydown", onKey); stage.onpointerdown = null;
            el.innerHTML = "";
            this.jsPsych.finishTrial({ rest_duration_ms: Math.round(elapsed), dims, taps, probes,
              n_dims: dims.length, n_hits: dims.filter(d => d.hit).length,
              n_false_alarms: taps.filter(x => !x.hit).length });
            return;
          }
        }
        lastTick = now; requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }

  // ---------------------------------------------------------------- probe
  // Thought-sampling probe (rest spec 2026-10-28). Not a jsPsych plugin: it runs
  // *inside* the rest trial, draws into `el`, and resolves with its data.
  // Page 1: intro line + items 1-4 (1-7 sliders, no thumb until touched).
  // Page 2: item 5, multi-select, "Nothing but the cross" exclusive, >= 1 required.
  const PROBE_ITEMS = [
    { id: "q1_wandering", html: "<b>Was your mind wandering</b> from one thing to another, with no direction, purpose, or aim? <b>Or were you focused</b> on something in particular?",
      anchors: ["Completely wandering", "Somewhat focused, somewhat wandering", "Completely focused"] },
    { id: "q2_trying", html: "Were you <b>actively trying to focus</b> on something in particular and ignoring distractions?",
      anchors: ["Not at all", "Somewhat", "Very much"] },
    { id: "q3_drawn", html: "Did you feel <b>drawn to focus</b> on something that called out for your attention? Something it would be difficult to pull away from, even if you tried?",
      anchors: ["Not at all", "Somewhat", "Very much"] },
    { id: "q4_valence", html: "How negative or positive was your emotional state?",
      anchors: ["Very negative", "Neutral", "Very positive"] },
  ];
  const PROBE_TOPICS = [
    ["friends_family", "Friends or family"], ["work", "Work"], ["finances", "Your finances"],
    ["body", "Discomfort in your body"], ["future", "Plans for the future"], ["past", "Memories about the past"],
    ["hobbies", "Your hobbies"], ["nothing", "Nothing but the cross"], ["blank", "My mind was blank"], ["other", "Other"],
  ];
  function runProbe(el, meta) {
    return new Promise(resolve => {
      const data = { ...meta };
      // ---- page 1 ----
      const t1 = performance.now();
      el.innerHTML = `<div class="probe">
        <p class="intro">We'll now ask you a few questions about your experiences while looking at the cross.</p>
        ${PROBE_ITEMS.map((it, i) => `<div class="q"><b>${i + 1}.</b> ${it.html}</div>
          <input type="range" min="1" max="7" step="1" value="4" class="untouched" id="pr-${it.id}">
          <div class="scale three"><span>${it.anchors[0]}</span><span>${it.anchors[1]}</span><span>${it.anchors[2]}</span></div>`).join("")}
        <button id="pr-go" disabled>Next</button></div>`;
      const go = el.querySelector("#pr-go");
      const ranges = PROBE_ITEMS.map(it => el.querySelector("#pr-" + it.id));
      const check = () => { go.disabled = !ranges.every(r => !r.classList.contains("untouched")); };
      ranges.forEach(r => { const touch = () => { r.classList.remove("untouched"); check(); };
        r.addEventListener("input", touch); r.addEventListener("pointerdown", touch); });
      go.onclick = () => {
        PROBE_ITEMS.forEach((it, i) => data[it.id] = Number(ranges[i].value));
        data.rt_items_1_4 = Math.round(performance.now() - t1);
        page2();
      };
      // ---- page 2 ----
      function page2() {
        const t2 = performance.now();
        el.innerHTML = `<div class="probe">
          <div class="q"><b>5.</b> What were you thinking about? <span class="hint">(select all that apply)</span></div>
          <div class="topics">${PROBE_TOPICS.map(([id, label]) =>
            `<label class="topic"><input type="checkbox" id="pr-t-${id}" value="${id}"><span>${label}</span></label>`).join("")}</div>
          <button id="pr-go2" disabled>Continue</button></div>`;
        const boxes = PROBE_TOPICS.map(([id]) => el.querySelector("#pr-t-" + id));
        const go2 = el.querySelector("#pr-go2");
        // "Nothing but the cross" and "My mind was blank" are exclusive: selecting either clears
        // everything else; selecting any content option clears both.
        const excl = [el.querySelector("#pr-t-nothing"), el.querySelector("#pr-t-blank")];
        const check2 = () => { go2.disabled = !boxes.some(b => b.checked); };
        boxes.forEach(b => b.addEventListener("change", () => {
          if (excl.includes(b) && b.checked) boxes.forEach(o => { if (o !== b) o.checked = false; });
          else if (!excl.includes(b) && b.checked) excl.forEach(o => { o.checked = false; });
          check2();
        }));
        go2.onclick = () => {
          PROBE_TOPICS.forEach(([id], i) => data["q5_" + id] = boxes[i].checked ? 1 : 0);
          data.rt_item_5 = Math.round(performance.now() - t2);
          el.innerHTML = ""; resolve(data);
        };
      }
      window.scrollTo(0, 0);
    });
  }

  // ---------------------------------------------------------------- rest schedulers (shared with rest-study/)
  // probes: k-th at P.at_ms[k] (or k*spacing) ± jitter, >= first_min, >= min_gap apart, <= duration - last_margin
  // With P.last_at_end the final probe sits exactly at the block end and closes the block
  // (the participant never sees the cross again after the last questions).
  function scheduleProbes(P, duration, rnd) {
    const out = [];
    for (let k = 0; k < P.n; k++) {
      const last = k === P.n - 1;
      if (last && P.last_at_end) { out.push(duration); break; }
      let t = (P.at_ms ? P.at_ms[k] : (k + 1) * P.spacing_ms) + (rnd() * 2 - 1) * P.jitter_ms;
      t = Math.max(P.first_min_ms, t);
      if (out.length && t - out[out.length - 1] < P.min_gap_ms) t = out[out.length - 1] + P.min_gap_ms;
      out.push(Math.round(Math.min(duration - (P.last_margin_ms || 0), t)));
    }
    return out;
  }
  // fades: n onsets >= min_gap apart, none within probe_margin of a probe (rejection sampling)
  function scheduleFades(F, n, duration, probeTimes, rnd) {
    if (!n) return [];
    for (let tries = 0; tries < 20000; tries++) {
      const cand = Array.from({ length: n }, () => F.first_min_ms + rnd() * (duration - F.end_margin_ms - F.first_min_ms)).sort((a, b) => a - b);
      const okGap = cand.every((x, i) => i === 0 || x - cand[i - 1] >= F.min_gap_ms);
      const okProbe = cand.every(x => probeTimes.every(p => x + F.fade_ms + F.probe_margin_ms < p || x > p + F.probe_margin_ms));
      if (okGap && okProbe) return cand.map(Math.round);
    }
    throw new Error("scheduleFades: no valid schedule");
  }
  function restTrial(R, F, caption, rnd, data) {
    const probeTimes = scheduleProbes(R.probes, R.duration_ms, rnd);
    const fadeTimes = scheduleFades(F, R.n_fades, R.duration_ms, probeTimes, rnd);
    return { type: RestPlugin, duration_ms: R.duration_ms, probe_times_ms: probeTimes, caption, rnd,
      dims: fadeTimes.length > 0, fade_times_ms: fadeTimes, fade_hold: true, dim_ms: F.fade_ms, dim_opacity: F.opacity,
      dim_response_window_ms: 1e9, dim_min_gap_ms: 0, dim_max_gap_ms: 0,
      on_probe: (k, at, host) => runProbe(host, {}), data: { ...data, probe_times_ms: probeTimes, fade_times_ms: fadeTimes } };
  }

  // ---------------------------------------------------------------- saving (shared)
  // Google Apps Script receiver (server/Code.gs). Body is sent as text/plain so the browser
  // makes a "simple" request (no CORS preflight, which Apps Script cannot answer). Returns a
  // promise resolving to true on success. Falls back to download / copy buttons in the caller.
  function saveSession(cfg, json) {
    if (!cfg || !cfg.url) return Promise.resolve(null);   // not configured
    return fetch(cfg.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: json, redirect: "follow" })
      .then(r => r.ok ? r.json().then(j => !!j.ok).catch(() => true) : false)
      .catch(() => false);
  }
  function endScreen(el, page, html, json, fname, cfg) {
    el.innerHTML = page(html + `
      <p id="save-status" class="hint">Saving…</p>
      <p><a id="dl" class="jspsych-btn" download="${fname}" hidden>Download data</a>
         <button id="cp" class="jspsych-btn" type="button" hidden>Copy data to clipboard</button></p>`);
    const a = el.querySelector("#dl"), cp = el.querySelector("#cp"), status = el.querySelector("#save-status");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    cp.onclick = () => navigator.clipboard.writeText(json).then(() => { status.textContent = "Copied — paste it into a file named " + fname; })
      .catch(() => { status.textContent = "Copy failed on this browser; use the download button."; });
    const fallback = msg => { status.textContent = msg; a.hidden = false; cp.hidden = false; };
    saveSession(cfg, json).then(ok => {
      if (ok === true) status.textContent = "Your data have been saved. You can close this page.";
      else if (ok === null) fallback("No data server configured — please download the file and send it to the research team.");
      else fallback("Saving to the server failed — please download the file and send it to the research team.");
    });
  }

  window.FaceWordPlugin = FaceWordPlugin; window.RestPlugin = RestPlugin; window.runProbe = runProbe;
  window.saveSession = saveSession; window.endScreen = endScreen;
  window.scheduleProbes = scheduleProbes; window.scheduleFades = scheduleFades; window.restTrial = restTrial;
})();
