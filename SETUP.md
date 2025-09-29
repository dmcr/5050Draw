# Google Sheets Setup Instructions

## Step 1: Create New Google Sheets Workbook

1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new blank spreadsheet
3. Name it: **"50/50 Draw Tool"**

## Step 2: Create Two Sheets

**Note on Audit Trail:** Google Sheets provides built-in version history (**File → Version history → See version history**) that automatically tracks all edits with timestamps and user information. We'll use this for auditing participant data changes, while the Winners sheet will serve as the audit log for draw actions.

### Sheet 1: Participants
1. Rename "Sheet1" to **"Participants"**
2. Add header row:
   - A1: `Email`
   - B1: `Name`
   - C1: `Paid Until`
3. Add your participant data starting at A2 (one person per row)
4. **Set up email uniqueness validation for column A:**
   - Select column A (starting from A2 to A1000, or expected max rows)
   - Go to **Data → Data validation**
   - Criteria: "Custom formula is"
   - Formula: `=COUNTIF($A$2:$A,A2)=1`
   - Check "Reject input"
   - Custom error text: "This email already exists. Each email must be unique."
   - Save
5. **Set up name uniqueness validation for column B:**
   - Select column B (starting from B2 to B1000, or expected max rows)
   - Go to **Data → Data validation**
   - Criteria: "Custom formula is"
   - Formula: `=COUNTIF($B$2:$B,B2)=1`
   - Check "Reject input"
   - Custom error text: "This name already exists. Each name must be unique."
   - Save
6. **Set up date validation for "Paid Until" column:**
   - Select column C (starting from C2)
   - Go to **Data → Data validation**
   - Criteria: "Date" then "is valid date"
   - Check "Reject input" to enforce valid dates
   - Optionally add validation help text: "Enter a valid date"
   - Save

   **Note:** Google Sheets automatically shows a date picker (calendar icon) when you click on any cell in this column.

**Example:**
```
A1: Email                    B1: Name              C1: Paid Until
A2: john.smith@email.com     B2: John Smith        C2: 2025/03/26
A3: jane.doe@email.com       B3: Jane Doe          C3: 2025/04/15
A4: bob.johnson@email.com    B4: Bob Johnson       C4: 2025/03/26
```

**Note:** Both Email and Name columns enforce uniqueness via data validation, ensuring each participant has a unique identifier and name.

### Sheet 2: Winners
1. Create new sheet, name it **"Winners"**
2. Add header row:
   - A1: `Timestamp`
   - B1: `Winner Name`
   - C1: `Winner Email`
   - D1: `Participant Count`
   - E1: `Draw Conducted By`
3. Format column A for date/time display:
   - Select column A
   - Go to **Format → Number → Date time**
   - This will display timestamps in human-readable format (e.g., "3/26/2025 14:30:00")

**Note:** This sheet serves as both the winners log and audit trail for all draw actions. It will be populated automatically by the script. You can leave it with just headers for now.

## Step 3: Sheet Protection (Complete after script is installed)

After installing the Apps Script code:

1. **Protect Winners sheet:**
   - Right-click "Winners" sheet tab → "Protect sheet"
   - Set permissions: "Only you" or specific editors
   - Check "Show a warning when editing this range" (alternative)
   - This ensures draw results cannot be manually altered

2. **Leave Participants sheet unprotected** so authorized users can add/remove participants and update paid dates

## Next Steps

Once sheets are created:
- Open **Extensions → Apps Script**
- Copy Code.gs