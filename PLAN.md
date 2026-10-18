# 50/50 Draw Tool - Project Plan

## Purpose
Replace the manual roulette device draw system with a digital tool for conducting 50/50 draws,
and replace the paper sheet at the bar with a page on the bar iPad that updates the participant
list directly.

## Solution: Google Apps Script (Container-Bound) + Apps Script Web App

### Decision Rationale

**Considered Alternatives:**
- **Go CLI Tool**: Rejected due to complexity of Google Sheets API authentication and manual distribution overhead
- **Standalone Apps Script**: Unnecessary given tight integration with source data
- **For bar-staff entry**: a sheet-embedded sidebar (needs sheet edit access and a desktop browser; the Sheets iPad app does not show custom menus) and email parsing (fragile) were rejected. A linked Google Form was drafted first, but Forms dropdowns cannot be filtered by typing, which is unusable with ~130 names on an iPad. The script's own web page gives type-to-filter and, as a bonus, removes the form, the submit trigger, the dropdown sync and the status-string parsing

**Chosen Approach: Container-Bound Apps Script serving a payment web page**

1. **Native Google Sheets Integration**: participants, winners and payment log all live in one workbook
2. **Zero Installation**: admins use a custom menu; bar staff use a page saved to the iPad home screen
3. **Built-in Authentication**: Google handles admin identity; the page runs as the owner, needs no login, grants no sheet access, and is optionally PIN-protected
4. **Automatic Updates**: script changes deploy instantly
5. **Workspace Compatible**: supported on small business Google Workspace plans

## Architecture

### Sheet Structure

1. **Participants Sheet**
   - Columns: Email (unique), Name (unique), Draws Remaining (whole number), Last Paid (date/time)
   - Draws Remaining is a credit count: participants pay per draw. Replaces the earlier "Paid Until" date, which depended on draw dates and broke on weeks with no draw
   - Rows are added only by admins; the payment page only credits existing rows. Direct edits are for corrections and show in version history
   - Duplicate names or emails (case-insensitive) block the draw and the payment page, because sheet validation does not catch pasted or imported rows

2. **Winners Sheet**
   - Columns: Timestamp, Winner Name, Winner Email, Participant Count, Draw Conducted By, Draws Remaining, Paid Up, Prize Amount, Carry-over Amount
   - Winners log and audit trail for draw actions; protected
   - Draws Remaining records the winner's credit count at the moment of the draw

3. **Payments Sheet** (created automatically on the first payment)
   - Columns: Timestamp, Participant, Draws Paid, Before, After, Recorded By, Result
   - Payment ledger for reconciling with bar takings; one row per attempt, Result `OK` or `ERROR: reason`, so a failed attempt can be resolved by hand
   - Protected; kept across seasons

### Payment Page (Page.html, served by doGet)
- Deployed as a web app: execute as owner, accessible to anyone with the link, optional PIN in the `BAR_PIN` script property
- Type-to-filter name list in surname order with each person's draws remaining, fetched live from the Participants sheet, so staff can also confirm whether someone is paid up
- Draws paid 1 to 10, two-tap confirm, result shows the before/after balance
- Only `webListNames` and `webRecordPayment` are callable from the page; every other server function has a trailing underscore, which Apps Script treats as private. The draw uses the spreadsheet UI, which is unavailable to a web app
- `appsscript.json` pins the OAuth grant to the current spreadsheet only (plus container UI and the owner's email), so the script cannot reach other spreadsheets or Google services even through a bug
- Untrusted input written to the ledger is stripped of leading formula characters (`= + - @`) and truncated
- The page cannot add participants; adding people is a manual admin edit and shows up immediately

### Security & Permissions
- **Draw identity**: `Session.getActiveUser().getEmail()` records who conducted each draw
- **Bar staff**: payment page only; no spreadsheet access, cannot run draws
- **Web app identity**: runs as the owner, so the page updates a sheet the submitter cannot open
- **Sheet protection**: Winners and Payments protected; Participants editable by admins
- **Audit**: Winners sheet (draws), Payments sheet (payments), Sheets version history (manual edits)

## Prize System
- All participants eligible to win regardless of payment status
- Prize = number of participants with Draws Remaining > 0 + carry-over
- Winner paid up: prize awarded, carry-over resets to $0
- Winner not paid up: entire prize becomes carry-over
- After every draw, one draw is deducted from each paid-up participant. The draw asks for confirmation first because of this side effect.

## Implementation Details

### Randomization
- Fisher-Yates shuffle followed by a uniform random index (`Math.random`, V8 runtime)
- Verified uniform and position-independent by `test-randomness.js`
- `test-code.js` runs the draw, payment, validation, PIN and injection logic against a mock of the Apps Script services (`node test-code.js`)
- Repeat winners within a season are expected: with 40 participants and 20 draws there is about a 96% chance that two different people each win twice

### Code Structure (Code.gs)
- `onOpen()`: custom menu (Conduct Draw, Check participant list)
- `readParticipants_()`: parses the Participants sheet, skips blank rows, reports bad and duplicate rows
- `conductDraw()`: validates, confirms, draws, logs, then deducts credits via `consumeDraws_()`
- `getCarryover_()`, `logWinner_()`, `shuffle()`
- `doGet()`: serves Page.html; `webListNames()`, `webRecordPayment()`: the page's two entry points; `recordPayment_()`, `checkPin_()`, `getPaymentsSheet_()`

### Season data
- `build-participants.py` merges the club's membership export and season-paid export into the Participants CSV (everyone listed; season payers get 100 draws, others 0)
- Exports and generated CSVs live under `private-data/`, which is git-ignored and blocked by a local pre-commit hook

## Status
✅ 1. Sheet structure defined (SETUP.md)
✅ 2. Apps Script with custom menu (Code.gs)
✅ 3. Fisher-Yates draw with randomness tests (test-randomness.js)
✅ 4. Rolling prize system
✅ 5. Credit-based paid-up tracking (Draws Remaining)
✅ 6. Payment page (Page.html) with type-to-filter names, PIN, and Payments ledger
✅ 7. Duplicate name/email validation before draws and payments
⏳ 8. Deploy the web app, set the PIN, protect sheets (manual, SETUP.md Steps 4-5)
⏳ 9. New-season setup for 2026-27 (SETUP.md "Starting a New Season")
