/**
 * Code.gs — Google Apps Script receiver for the battery pre-pilot.
 *
 * Bound to the Sheet "Battery Pre-pilot Data". Each finished session POSTs its JSON here;
 * this appends one row to `sessions`, one row per trial to `trials`, one per probe to
 * `probes`, one per fade to `fades`, and the full JSON to `raw` (so nothing is lost if
 * the flat tabs ever need rebuilding). Header rows are written on first use.
 *
 * Deploy once: Extensions → Apps Script → paste this file → Deploy → New deployment →
 * type "Web app", Execute as "Me", Who has access "Anyone" → Deploy → copy the Web app URL
 * into config.js: sheets.url (battery) and config_rest.js: sheets.url (rest study).
 * Re-deploy ("Manage deployments → edit → new version") after any change to this file.
 */
var SHEET_ID = "1tRxq_ysG7DDL17TkvC4ox7y6B1ZLvvDeVhktNA0MBoY";

function doPost(e) {
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var d = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.openById(SHEET_ID), m = d.meta || {};
    var base = { received: new Date().toISOString(), study: d.study || "battery", participant: m.participant,
      seed: m.seed, condition: m.condition || "", order: m.order || "", block_order: m.block_order || "",
      form_id: m.form_id || "", task_version: m.task_version || "" };

    append(ss, "sessions", [ Object.assign({}, base, {
      started: m.started, finished: m.finished, total_s: Math.round((m.total_ms || 0) / 1000),
      n_trials: (d.trials || []).length, n_rests: (d.rests || (d.rest ? [d.rest] : [])).length,
      word_position: m.word_position || "", deadline_ms: m.timing ? m.timing.deadline : "",
      mapping_left: m.mapping ? m.mapping.left : "", touch: m.touch, screen: m.screen, user_agent: m.user_agent }) ]);

    if (d.trials && d.trials.length) append(ss, "trials", d.trials.map(function (t) { return Object.assign({}, base, t); }));

    var rests = d.rests || (d.rest ? [Object.assign({ position: "only" }, d.rest)] : []);
    var probes = [], fades = [];
    rests.forEach(function (r) {
      (r.probes || []).forEach(function (p) { probes.push(Object.assign({}, base, { rest_position: r.position, rest_duration_ms: r.duration_ms }, p)); });
      (r.fades || r.dims || []).forEach(function (f) { fades.push(Object.assign({}, base, { rest_position: r.position }, f)); });
    });
    if (probes.length) append(ss, "probes", probes);
    if (fades.length) append(ss, "fades", fades);

    append(ss, "raw", [{ received: base.received, study: base.study, participant: base.participant, seed: base.seed, json: e.postData.contents }]);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally { lock.releaseLock(); }
}

function doGet() { return ContentService.createTextOutput("battery receiver up"); }

// Append objects as rows; the header row is the union of keys seen so far (new keys extend it).
function append(ss, name, rows) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var lastCol = sh.getLastColumn();
  var header = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].filter(String) : [];
  rows.forEach(function (r) { Object.keys(r).forEach(function (k) { if (header.indexOf(k) < 0) header.push(k); }); });
  sh.getRange(1, 1, 1, header.length).setValues([header]);
  if (!lastCol) sh.setFrozenRows(1);
  var out = rows.map(function (r) { return header.map(function (k) {
    var v = r[k]; if (v === undefined || v === null) return "";
    return (typeof v === "object") ? JSON.stringify(v) : v; }); });
  sh.getRange(sh.getLastRow() + 1, 1, out.length, header.length).setValues(out);
}
