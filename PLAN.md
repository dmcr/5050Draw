# 50/50 Draw Tool - Project Plan

## Purpose
Replace the manual roulette device draw system with a digital tool for conducting 50/50 draws.

## Solution: Google Apps Script (Container-Bound)

### Decision Rationale

**Considered Alternatives:**
- **Go CLI Tool**: Evaluated for native performance and cross-platform distribution, but rejected due to complexity of Google Sheets API authentication and manual distribution overhead
- **Standalone Apps Script**: Considered but unnecessary given tight integration with source data

**Chosen Approach: Container-Bound Apps Script**

Selected for the following reasons:
1. **Native Google Sheets Integration**: Both data source (participants) and outputs (audit trail, winners) live in Google Sheets
2. **Zero Installation**: Users simply open the spreadsheet and use custom menu
3. **Built-in Authentication**: Google Workspace handles all user identity and permissions
4. **Automatic Updates**: Script changes deploy instantly to all users
5. **Accessibility**: Works from any device with browser access
6. **Workspace Compatible**: Fully supported on small business Google Workspace plans

## Architecture

### Sheet Structure
The Google Sheets workbook will contain two sheets:

1. **Participants Sheet**
   - Columns: Email (unique), Name (unique), Paid Until (date)
   - Email and Name enforce uniqueness via data validation
   - Paid Until uses date picker for easy date entry
   - Editable by authorized users
   - Changes audited via Google Sheets built-in version history

2. **Winners Sheet**
   - Columns: Timestamp, Winner Name, Winner Email, Participant Count, Draw Conducted By
   - Serves as both winners log and audit trail for draw actions
   - Timestamp formatted as human-readable date/time
   - Protected (read-only except via script)

### Security & Permissions

- **User Identity**: Script captures `Session.getActiveUser().getEmail()` to record who conducted each draw
- **Sheet Protection**: Winners sheet set as protected range (read-only for most users, writable only by script + admins)
- **Execution Permissions**: Only users with edit access to the spreadsheet can run the script
- **Audit Trail**:
  - Draw actions: Immutable Winners sheet records all draw results
  - Participant changes: Google Sheets built-in version history tracks all edits automatically
- **Data Validation**: Email and Name columns enforce uniqueness to prevent duplicate participants

### User Interface

- **Custom Menu**: "50/50 Draw" menu added to spreadsheet toolbar
- **Dialog/Sidebar**: Display draw results and confirmation
- **Immediate Feedback**: Winner displayed to user, automatically logged to Winners sheet

## Requirements
- Load participant data (email, name, paid until date) from Participants sheet
- Filter participants to only those with Paid Until >= today
- Conduct random draw from eligible participants using Fisher-Yates shuffle + random selection
- Display winner to executing user via dialog
- Log every draw action with timestamp, winner details, participant count, and conducting user
- Maintain immutable audit trail of draw results in Winners sheet
- Enforce uniqueness on email and name fields via data validation
- Validate dates with date picker for Paid Until field

## Implementation Details

### Randomization Approach
- **Fisher-Yates shuffle algorithm**: Eliminates position bias by shuffling eligible participants
- **Math.random() selection**: Selects random index from shuffled array
- **Two-layer randomization**: Provides fair selection without cryptographic overhead (appropriate for prize draws)

### Code Structure (Code.gs)
- `onOpen()`: Creates custom menu on spreadsheet open
- `conductDraw()`: Main draw logic with eligibility filtering
- `shuffle()`: Fisher-Yates array shuffling
- `logWinner()`: Appends draw results to Winners sheet
- `getParticipantsSheet()`, `getWinnersSheet()`: Helper functions with error handling

## Status
✅ 1. Google Sheets template structure defined (SETUP.md)
✅ 2. Apps Script implemented with custom menu (Code.gs)
✅ 3. Draw logic with Fisher-Yates shuffle randomization (Code.gs)
✅ 4. Winner logging with full audit details (Code.gs)
⏳ 5. Set up sheet protection (manual step after deployment)
⏳ 6. Testing and validation (ready for testing)