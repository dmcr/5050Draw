/**
 * 50/50 Draw Tool - Google Apps Script
 * Container-bound script for conducting random draws from eligible participants
 */

/**
 * Creates custom menu when spreadsheet is opened
 * Automatically triggered by Google Sheets
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('50/50 Draw')
      .addItem('Conduct Draw', 'conductDraw')
      .addToUi();
}

/**
 * Gets reference to the Participants sheet
 * @return {Sheet} The Participants sheet
 */
function getParticipantsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Participants');
  if (!sheet) {
    throw new Error('Participants sheet not found. Please ensure the sheet is named "Participants".');
  }
  return sheet;
}

/**
 * Gets reference to the Winners sheet
 * @return {Sheet} The Winners sheet
 */
function getWinnersSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Winners');
  if (!sheet) {
    throw new Error('Winners sheet not found. Please ensure the sheet is named "Winners".');
  }
  return sheet;
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 * Ensures no position bias in random selection
 * @param {Array} array - Array to shuffle
 * @return {Array} Shuffled array
 */
function shuffle(array) {
  const shuffled = array.slice(); // Create a copy to avoid modifying original
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
function getCarryover() {
  const winnersSheet = getWinnersSheet();
  const lastRow = winnersSheet.getLastRow();

  // If no previous draws or only header row, no carry-over
  if (lastRow < 2) {
    return 0;
  }

  // Get the last draw's data
  // Columns: Timestamp, Winner Name, Winner Email, Participant Count, Draw Conducted By,
  //          Paid Until, Paid Up, Prize Amount, Carry-over Amount
  const lastDrawRange = winnersSheet.getRange(lastRow, 1, 1, 9);
  const lastDraw = lastDrawRange.getValues()[0];
  const carryover = lastDraw[8]; // Column I: Carry-over Amount

  return carryover;
}

/**
 * Conducts the 50/50 draw from eligible participants
 * Triggered from custom menu
 */
function conductDraw() {
  const ui = SpreadsheetApp.getUi();

  try {
    // Get participants data
    const participantsSheet = getParticipantsSheet();
    const lastRow = participantsSheet.getLastRow();

    // Check if there are any participants (beyond header row)
    if (lastRow < 2) {
      ui.alert('No Participants', 'There are no participants in the Participants sheet.', ui.ButtonSet.OK);
      return;
    }

    // Get all participant data (skip header row)
    // Columns: A=Email, B=Name, C=Paid Until
    const dataRange = participantsSheet.getRange(2, 1, lastRow - 1, 3);
    const participants = dataRange.getValues();

    // All participants are eligible (no payment status filtering)
    // Check for rows with missing required data
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day for comparison

    const incompleteRows = [];
    const eligibleParticipants = [];

    participants.forEach(function(row, index) {
      const email = row[0];
      const name = row[1];
      const paidUntil = row[2];
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header row

      // Check for missing required data
      if (!email || !name || !paidUntil) {
        const missing = [];
        if (!email) missing.push('Email');
        if (!name) missing.push('Name');
        if (!paidUntil) missing.push('Paid Until');
        incompleteRows.push('Row ' + rowNumber + ': Missing ' + missing.join(', '));
      } else {
        eligibleParticipants.push(row);
      }
    });

    // If there are incomplete rows, alert user and abort draw
    if (incompleteRows.length > 0) {
      ui.alert(
        'Cannot Conduct Draw - Incomplete Data',
        'The following participants have missing required data:\n\n' + incompleteRows.join('\n') + '\n\nPlease complete all participant data before conducting a draw.',
        ui.ButtonSet.OK
      );
      return;
    }

    // Validate that we have eligible participants
    if (eligibleParticipants.length === 0) {
      ui.alert(
        'No Participants',
        'There are no participants in the Participants sheet.',
        ui.ButtonSet.OK
      );
      return;
    }

    // Count paid-up participants for prize calculation
    let paidUpCount = 0;
    eligibleParticipants.forEach(function(row) {
      const paidUntil = row[2];
      const paidUntilDate = new Date(paidUntil);
      paidUntilDate.setHours(0, 0, 0, 0);
      if (paidUntilDate >= today) {
        paidUpCount++;
      }
    });

    // Shuffle eligible participants to eliminate any position bias
    const shuffledParticipants = shuffle(eligibleParticipants);

    // Select random winner from shuffled array
    const randomIndex = Math.floor(Math.random() * shuffledParticipants.length);
    const winner = shuffledParticipants[randomIndex];
    const winnerEmail = winner[0];
    const winnerName = winner[1];
    const winnerPaidUntil = winner[2];

    // Check if winner is paid up
    const winnerPaidUntilDate = new Date(winnerPaidUntil);
    winnerPaidUntilDate.setHours(0, 0, 0, 0);
    const isPaidUp = winnerPaidUntilDate >= today;

    // Calculate prize amounts
    const carryover = getCarryover();
    const currentPrize = paidUpCount + carryover;

    // Log the winner with prize and payment status
    logWinner(winnerEmail, winnerName, winnerPaidUntil, isPaidUp, currentPrize, eligibleParticipants.length);

    // Display winner to user with appropriate message
    const prizeBreakdown = paidUpCount + ' paid-up participants = $' + paidUpCount +
                           (carryover > 0 ? ' + $' + carryover + ' carry-over' : '') +
                           ' = $' + currentPrize + ' CAD';
    const prizeStatus = isPaidUp
      ? 'PRIZE AWARDED: $' + currentPrize + ' CAD\nNext draw carry-over: $0'
      : 'NOT PAID UP - Prize rolls over\nNext draw carry-over: $' + currentPrize;

    ui.alert(
      '50/50 Draw Winner',
      'Winner: ' + winnerName + '\nEmail: ' + winnerEmail + '\n\n' + prizeBreakdown + '\n\n' + prizeStatus + '\n\nTotal Participants: ' + eligibleParticipants.length,
      ui.ButtonSet.OK
    );

  } catch (error) {
    ui.alert('Error', 'An error occurred: ' + error.message, ui.ButtonSet.OK);
    Logger.log('Error in conductDraw: ' + error.message);
  }
}

/**
 * Logs the draw winner to the Winners sheet
 * @param {string} winnerEmail - Winner's email address
 * @param {string} winnerName - Winner's name
 * @param {Date} winnerPaidUntil - Winner's "Paid Until" date at time of draw
 * @param {boolean} isPaidUp - Whether winner is paid up
 * @param {number} currentPrize - Prize amount for this draw
 * @param {number} participantCount - Number of eligible participants
 */
function logWinner(winnerEmail, winnerName, winnerPaidUntil, isPaidUp, currentPrize, participantCount) {
  try {
    const winnersSheet = getWinnersSheet();
    const timestamp = new Date();
    const conductedBy = Session.getActiveUser().getEmail();

    // Calculate carry-over amount for next draw
    const carryover = isPaidUp ? 0 : currentPrize;

    // Append row: Timestamp, Winner Name, Winner Email, Participant Count, Draw Conducted By,
    //             Paid Until, Paid Up, Prize Amount, Carry-over Amount
    winnersSheet.appendRow([
      timestamp,
      winnerName,
      winnerEmail,
      participantCount,
      conductedBy,
      winnerPaidUntil,
      isPaidUp ? 'Yes' : 'No',
      currentPrize,
      carryover
    ]);

    Logger.log('Winner logged: ' + winnerName + ' (' + winnerEmail + ') - Prize: $' + currentPrize + ' - Paid Up: ' + isPaidUp);

  } catch (error) {
    throw new Error('Failed to log winner: ' + error.message);
  }
}