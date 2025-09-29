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
The Google Sheets workbook will contain three sheets:

1. **Participants Sheet**
   - List of names eligible for the draw
   - Editable by authorized users

2. **Audit Log Sheet**
   - Timestamped record of every draw action
   - Captures: timestamp, user who ran draw, participant count, winner
   - Protected (read-only except via script)

3. **Winners Sheet**
   - Historical record of all winners
   - Protected (read-only except via script)

### Security & Permissions

- **User Identity**: Script captures `Session.getActiveUser().getEmail()` to bind each draw to the executing user
- **Sheet Protection**: Audit Log and Winners sheets set as protected ranges (read-only for most users, writable only by script + admins)
- **Execution Permissions**: Only users with edit access to the spreadsheet can run the script
- **Audit Trail**: Immutable by design - users cannot manually edit protected sheets, ensuring audit integrity

### User Interface

- **Custom Menu**: "50/50 Draw" menu added to spreadsheet toolbar
- **Dialog/Sidebar**: Display draw results and confirmation
- **Immediate Feedback**: Winner displayed to user, automatically logged to audit and winner sheets

## Requirements
- Load participant names from Participants sheet
- Conduct cryptographically random draw
- Display winner to executing user
- Log every draw action with timestamp and user identity
- Maintain immutable audit trail and winner history

## Next Steps
1. Create Google Sheets template with three sheets
2. Implement Apps Script with custom menu
3. Implement draw logic with proper randomization
4. Implement audit logging
5. Set up sheet protection
6. Testing and validation