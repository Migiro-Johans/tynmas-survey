/**
 * Tynmas Labs feedback survey — backend (Google Apps Script bound to a Google Sheet).
 *
 * SET-UP (5 minutes):
 *  1. Create a new Google Sheet (e.g. "Tynmas Survey Responses").
 *  2. Extensions → Apps Script. Delete the sample code, paste this whole file.
 *  3. Change ADMIN_KEY below to a long private secret (this is what the admin types into the dashboard).
 *  4. Deploy → New deployment → type "Web app":
 *        Description: survey backend
 *        Execute as:  Me
 *        Who has access: Anyone            ← required so visitors' phones can submit without signing in
 *     Click Deploy, authorise when asked, then copy the "Web app URL" (ends in /exec).
 *  5. Paste that URL into ENDPOINT in site/index.html.
 *  After editing this file later, use Deploy → Manage deployments → Edit → Version "New version" so the URL stays the same.
 *
 * API (all responses are JSON):
 *  GET  ?action=count                → {ok:true, count:N}                 (public — used for "N people have shared feedback")
 *  GET  ?action=list&key=ADMIN_KEY   → {ok:true, responses:[...]}          (admin)
 *  POST {"action":"submit","response":{...}}        → {ok:true}           (public)
 *  POST {"action":"clear","key":"ADMIN_KEY"}        → {ok:true}           (admin — deletes every response)
 */

var ADMIN_KEY  = 'change-me-to-a-long-private-secret';
var SHEET_NAME = 'Responses';
var COLS = ['id','ts','name','company','email','phone','based','role','level',
            'excites','excitesOther','make','makeOther','help','wants','wantsOther'];
var LIST_COLS = ['excites','make','wants'];   // stored as "a; b; c" in one cell

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'count') return json_({ ok: true, count: countRows_() });
    if (p.action === 'list') {
      if (p.key !== ADMIN_KEY) return json_({ ok: false, error: 'unauthorized' });
      return json_({ ok: true, responses: readAll_() });
    }
    return json_({ ok: true, service: 'tynmas-survey', responses_stored: countRows_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json_({ ok: false, error: 'bad json' }); }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (body.action === 'submit') {
      var r = body.response || {};
      if (!r.id || !String(r.name || '').trim()) return json_({ ok: false, error: 'missing id or name' });
      var sh = sheet_();
      if (findRowById_(sh, r.id)) return json_({ ok: true, duplicate: true });   // safe to re-send
      var row = COLS.map(function (c) {
        var v = r[c];
        if (Array.isArray(v)) v = v.join('; ');
        return v == null ? '' : String(v).slice(0, 2000);
      });
      sh.appendRow(row);
      return json_({ ok: true });
    }
    if (body.action === 'clear') {
      if (body.key !== ADMIN_KEY) return json_({ ok: false, error: 'unauthorized' });
      var s = sheet_();
      if (s.getLastRow() > 1) s.deleteRows(2, s.getLastRow() - 1);
      return json_({ ok: true });
    }
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* ---------- helpers ---------- */
function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), COLS.length).setNumberFormat('@');  // keep phones like +254… as text
    sh.appendRow(COLS);
    sh.setFrozenRows(1);
  }
  return sh;
}
function countRows_() { return Math.max(0, sheet_().getLastRow() - 1); }
function findRowById_(sh, id) {
  var n = sh.getLastRow();
  if (n < 2) return 0;
  var ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return 0;
}
function readAll_() {
  var sh = sheet_();
  var n = sh.getLastRow();
  if (n < 2) return [];
  var rows = sh.getRange(2, 1, n - 1, COLS.length).getValues();
  return rows.map(function (row) {
    var o = {};
    COLS.forEach(function (c, i) {
      var v = row[i];
      if (v instanceof Date) v = v.toISOString();
      if (LIST_COLS.indexOf(c) >= 0) o[c] = v ? String(v).split(/;\s*/).filter(Boolean) : [];
      else o[c] = v == null ? '' : String(v);
    });
    return o;
  });
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
