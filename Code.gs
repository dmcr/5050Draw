/**
 * 50/50 Draw Tool - Google Apps Script
 *
 * Container-bound script with two jobs:
 *   1. Conduct the draw from the "50/50 Draw" menu (admins, inside the spreadsheet)
 *   2. Serve a small web page (Page.html) where bar staff record payments
 *
 * Functions whose names end in an underscore are private: they cannot be
 * called from the web page. Only webListNames() and webRecordPayment() are
 * exposed to it. Keep it that way, because the web app is deployed to run as
 * the spreadsheet owner.
 *
 * appsscript.json limits the script's Google permissions to this one
 * spreadsheet. Do not add services (Drive, Gmail, UrlFetch, ...) without
 * thinking about what the public page could then reach.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SHEET_PARTICIPANTS = 'Participants';
const SHEET_WINNERS = 'Winners';
const SHEET_PAYMENTS = 'Payments';

// Most draws the page will accept in one payment. 100 is a full season, so
// this allows a season payment while stopping a mistyped 1000.
const MAX_DRAWS_PER_PAYMENT = 100;

// Optional: set a script property with this name (Project Settings → Script
// properties) to require a PIN on the payment page. Leave unset for no PIN.
const PIN_PROPERTY = 'BAR_PIN';

// Participants sheet columns (1-based): Email, Name, Draws Remaining, Last Paid
const COL_EMAIL = 1;
const COL_NAME = 2;
const COL_DRAWS = 3;
const COL_LAST_PAID = 4;

const PAYMENTS_HEADERS = ['Timestamp', 'Participant', 'Draws Paid', 'Before', 'After', 'Recorded By', 'Result'];

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------

/**
 * Creates custom menu when spreadsheet is opened
 * Automatically triggered by Google Sheets
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('50/50 Draw')
      .addItem('Conduct Draw', 'conductDraw')
      .addSeparator()
      .addItem('Check participant list', 'checkParticipants')
      .addToUi();
}

/**
 * Runs the same validation as the draw without drawing.
 */
function checkParticipants() {
  const ui = SpreadsheetApp.getUi();
  try {
    const data = readParticipants_();
    if (data.problems.length > 0) {
      ui.alert('Problems Found', data.problems.join('\n'), ui.ButtonSet.OK);
      return;
    }
    const paidUp = data.participants.filter(function(p) { return p.draws > 0; }).length;
    ui.alert(
      'Participant List OK',
      data.participants.length + ' participants\n' + paidUp + ' paid up for the next draw',
      ui.ButtonSet.OK
    );
  } catch (error) {
    ui.alert('Error', error.message, ui.ButtonSet.OK);
  }
}

// ---------------------------------------------------------------------------
// Sheet helpers (private)
// ---------------------------------------------------------------------------

function getSheetOrThrow_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) {
    throw new Error(name + ' sheet not found. Please ensure the sheet is named "' + name + '".');
  }
  return sheet;
}

function getPaymentsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_PAYMENTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PAYMENTS);
    sheet.appendRow(PAYMENTS_HEADERS);
    sheet.getRange(1, 1, 1, PAYMENTS_HEADERS.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  return sheet;
}

/**
 * Reads the Participants sheet.
 * Returns { sheet, lastRow, participants: [{rowNumber, email, name, draws}], problems: [string] }
 *
 * Completely blank rows are skipped. Problems are reported for rows missing a
 * name or email, non-numeric Draws Remaining, and duplicate names or emails
 * (case-insensitive). Duplicate rows are still included in `participants`, so
 * callers must check `problems` before acting.
 */
function readParticipants_() {
  const sheet = getSheetOrThrow_(SHEET_PARTICIPANTS);
  const lastRow = sheet.getLastRow();
  const participants = [];
  const problems = [];

  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    rows.forEach(function(row, index) {
      const email = String(row[0]).trim();
      const name = String(row[1]).trim();
      const rawDraws = row[2];
      const rowNumber = index + 2;

      if (!email && !name && rawDraws === '') {
        return; // blank row
      }

      const draws = rawDraws === '' ? 0 : Number(rawDraws);
      const missing = [];
      if (!email) missing.push('Email');
      if (!name) missing.push('Name');
      if (isNaN(draws) || draws < 0 || draws !== Math.floor(draws)) {
        missing.push('Draws Remaining must be a whole number');
      }

      if (missing.length > 0) {
        problems.push('Row ' + rowNumber + ': ' + missing.join(', '));
      } else {
        participants.push({ rowNumber: rowNumber, email: email, name: name, draws: draws });
      }
    });
  }

  // Duplicate names or emails would give someone two chances in the draw.
  ['name', 'email'].forEach(function(field) {
    const seen = {};
    participants.forEach(function(p) {
      const key = p[field].toLowerCase();
      (seen[key] = seen[key] || []).push(p.rowNumber);
    });
    Object.keys(seen).forEach(function(key) {
      if (seen[key].length > 1) {
        problems.push('Rows ' + seen[key].join(', ') + ': duplicate ' + field + ' "' + key + '"');
      }
    });
  });

  return { sheet: sheet, lastRow: lastRow, participants: participants, problems: problems };
}

function findParticipantsByName_(participants, name) {
  const target = name.trim().toLowerCase();
  return participants.filter(function(p) { return p.name.toLowerCase() === target; });
}

// ---------------------------------------------------------------------------
// Draw
// ---------------------------------------------------------------------------

/**
 * Shuffles an array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @return {Array} Shuffled array
 */
function shuffle(array) {
  const shuffled = array.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Gets the carry-over amount from the previous draw
 * @return {number} Carry-over amount from previous draw (0 if no previous draws)
 */
function getCarryover_() {
  const winnersSheet = getSheetOrThrow_(SHEET_WINNERS);
  const lastRow = winnersSheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }
  // Column I: Carry-over Amount
  const carryover = Number(winnersSheet.getRange(lastRow, 9).getValue());
  return isNaN(carryover) ? 0 : carryover;
}

/**
 * Conducts the 50/50 draw. Every participant is in the draw; the prize is only
 * awarded if the winner has at least one draw remaining. After the draw, one
 * draw is deducted from every participant who had draws remaining.
 */
function conductDraw() {
  const ui = SpreadsheetApp.getUi();

  try {
    const data = readParticipants_();
    const participants = data.participants;

    if (data.problems.length > 0) {
      ui.alert(
        'Cannot Conduct Draw - Problems in Participants Sheet',
        data.problems.join('\n') + '\n\nPlease fix the Participants sheet before conducting a draw.',
        ui.ButtonSet.OK
      );
      return;
    }

    if (participants.length === 0) {
      ui.alert('No Participants', 'There are no participants in the Participants sheet.', ui.ButtonSet.OK);
      return;
    }

    const paidUpCount = participants.filter(function(p) { return p.draws > 0; }).length;
    const carryover = getCarryover_();
    const currentPrize = paidUpCount + carryover;

    const prizeBreakdown = paidUpCount + ' paid-up participants = $' + paidUpCount +
                           (carryover > 0 ? ' + $' + carryover + ' carry-over' : '') +
                           ' = $' + currentPrize + ' CAD';

    // Confirm first: a draw deducts a draw credit from everyone who is paid up,
    // so an accidental second run would cost participants a draw.
    const confirm = ui.alert(
      'Conduct Draw?',
      'Participants: ' + participants.length + '\nPaid up: ' + paidUpCount + '\n\n' + prizeBreakdown +
      '\n\nOne draw will be deducted from every paid-up participant. Continue?',
      ui.ButtonSet.YES_NO
    );
    if (confirm !== ui.Button.YES) {
      return;
    }

    const shuffled = shuffle(participants);
    const winner = shuffled[Math.floor(Math.random() * shuffled.length)];
    const isPaidUp = winner.draws > 0;

    logWinner_(winner, isPaidUp, currentPrize, participants.length);
    consumeDraws_(data.sheet, participants, data.lastRow);

    const prizeStatus = isPaidUp
      ? 'PRIZE AWARDED: $' + currentPrize + ' CAD\nNext draw carry-over: $0'
      : 'NOT PAID UP - Prize rolls over\nNext draw carry-over: $' + currentPrize;

    ui.alert(
      '50/50 Draw Winner',
      'Winner: ' + winner.name + '\nEmail: ' + winner.email +
      '\nDraws remaining at time of draw: ' + winner.draws +
      '\n\n' + prizeBreakdown + '\n\n' + prizeStatus +
      '\n\nTotal Participants: ' + participants.length,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('Error', 'An error occurred: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error in conductDraw: ' + error.message);
  }
}

/**
 * Deducts one draw from every participant with draws remaining.
 * Writes the whole column back in one call.
 */
function consumeDraws_(sheet, participants, lastRow) {
  const range = sheet.getRange(2, COL_DRAWS, lastRow - 1, 1);
  const values = range.getValues();
  participants.forEach(function(p) {
    if (p.draws > 0) {
      values[p.rowNumber - 2][0] = p.draws - 1;
    }
  });
  range.setValues(values);
}

/**
 * Logs the draw winner to the Winners sheet
 * Columns: Timestamp, Winner Name, Winner Email, Participant Count, Draw Conducted By,
 *          Draws Remaining, Paid Up, Prize Amount, Carry-over Amount
 */
function logWinner_(winner, isPaidUp, currentPrize, participantCount) {
  try {
    const winnersSheet = getSheetOrThrow_(SHEET_WINNERS);
    const carryover = isPaidUp ? 0 : currentPrize;

    winnersSheet.appendRow([
      new Date(),
      winner.name,
      winner.email,
      participantCount,
      Session.getActiveUser().getEmail(),
      winner.draws,
      isPaidUp ? 'Yes' : 'No',
      currentPrize,
      carryover
    ]);

    Logger.log('Winner logged: ' + winner.name + ' (' + winner.email + ') - Prize: $' + currentPrize + ' - Paid Up: ' + isPaidUp);
  } catch (error) {
    throw new Error('Failed to log winner: ' + error.message);
  }
}

// ---------------------------------------------------------------------------
// Payment page (web app)
// ---------------------------------------------------------------------------

/**
 * Serves the payment page. Deployed as a web app that executes as the
 * spreadsheet owner, so bar staff need no access to the spreadsheet.
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Page')
      .setTitle('50/50 Payment')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Throws unless the supplied PIN matches the BAR_PIN script property.
 * No property set means no PIN is required.
 */
function checkPin_(pin) {
  const required = PropertiesService.getScriptProperties().getProperty(PIN_PROPERTY);
  if (!required) {
    return;
  }
  if (String(pin || '').trim() !== String(required).trim()) {
    throw new Error('PIN_REQUIRED');
  }
}

/**
 * Called by the page. Returns every participant's name and draws remaining,
 * sorted by surname. Names and balances only: emails never leave the sheet.
 * @return {{name: string, draws: number}[]}
 */
function webListNames(pin) {
  checkPin_(pin);
  const surname = function(name) {
    const words = name.split(/\s+/);
    return words[words.length - 1].toLowerCase();
  };
  return readParticipants_().participants
      .map(function(p) { return { name: p.name, draws: p.draws }; })
      .sort(function(a, b) { return surname(a.name).localeCompare(surname(b.name)) || a.name.localeCompare(b.name); });
}

/**
 * Called by the page. Records a payment: adds draws to the participant,
 * stamps Last Paid, and appends a row to the Payments ledger. Every attempt
 * is logged, successful or not, so a failed one can be resolved by hand.
 * @return {string} Confirmation text shown to the staff member
 */
function webRecordPayment(pin, name, draws) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return recordPayment_(pin, name, draws, 'payment page');
  } finally {
    lock.releaseLock();
  }
}

function recordPayment_(pin, name, draws, recordedBy) {
  name = String(name || '').trim();
  const rawDraws = draws;
  draws = Number(draws);
  const now = new Date();

  try {
    checkPin_(pin);
    if (!name) {
      throw new Error('Pick a name first.');
    }
    if (!(draws >= 1 && draws <= MAX_DRAWS_PER_PAYMENT && draws === Math.floor(draws))) {
      throw new Error('Draws paid must be a whole number from 1 to ' + MAX_DRAWS_PER_PAYMENT + '.');
    }

    const data = readParticipants_();
    const matches = findParticipantsByName_(data.participants, name);
    if (matches.length === 0) {
      throw new Error('"' + name + '" is not on the Participants sheet. Nothing recorded. Ask an admin to add them.');
    }
    if (matches.length > 1) {
      throw new Error('"' + name + '" appears more than once on the Participants sheet (rows ' +
                      matches.map(function(p) { return p.rowNumber; }).join(', ') + '). Nothing recorded. Ask an admin to fix it.');
    }

    const participant = matches[0];
    const before = participant.draws;
    const after = before + draws;

    data.sheet.getRange(participant.rowNumber, COL_DRAWS).setValue(after);
    data.sheet.getRange(participant.rowNumber, COL_LAST_PAID).setValue(now);
    logPayment_([now, participant.name, draws, before, after, recordedBy, 'OK']);

    return participant.name + ': ' + draws + ' draw' + (draws === 1 ? '' : 's') + ' paid. ' +
           before + ' -> ' + after + ' remaining.';
  } catch (error) {
    const reason = error.message === 'PIN_REQUIRED' ? 'wrong or missing PIN' : error.message;
    logPayment_([now, asText_(name), asText_(rawDraws), '', '', recordedBy, 'ERROR: ' + reason]);
    throw error;
  }
}

/**
 * Makes untrusted input safe to write into a cell. A value starting with
 * = + - @ would otherwise be stored as a live formula.
 */
function asText_(value) {
  return String(value === undefined || value === null ? '' : value)
      .replace(/^[=+\-@\t\r]+/, '')
      .slice(0, 100);
}

/**
 * Appends a row to the Payments ledger. Never throws: a logging failure must
 * not hide the real outcome from the staff member.
 */
function logPayment_(row) {
  try {
    getPaymentsSheet_().appendRow(row);
  } catch (error) {
    Logger.log('Failed to log payment row: ' + error.message);
  }
}
