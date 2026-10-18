# Google Sheets Setup Instructions

Two pieces: the **spreadsheet** (participants, winners, payments) and the **Apps Script**, which
runs the draw from a menu and also serves a small **payment page** that bar staff open on the iPad.

Bar staff only ever see the payment page. They need no access to the spreadsheet and cannot run
a draw.

## Step 1: Create the Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com) and create a new blank spreadsheet
2. Name it: **"50/50 Draw Tool"**

**Note on Audit Trail:** Google Sheets keeps version history (**File → Version history**) of every
edit. The Winners sheet is the audit log for draws, and the Payments sheet is the ledger of
payments (who paid, for how many draws, when, and the balance before and after).

## Step 2: Create the Sheets

### Sheet 1: Participants
1. Rename "Sheet1" to **"Participants"**
2. Add the header row:
   - A1: `Email`
   - B1: `Name`
   - C1: `Draws Remaining`
   - D1: `Last Paid`
3. Add participants starting at A2, one per row. Leave Draws Remaining blank or `0` for anyone
   who has not paid yet. Someone who prepaid for the whole season gets `100` draws, more than a
   season can use.

   **From the club's membership exports:** `build-participants.py` in this repo merges the full
   membership export and the season-paid export into a CSV with exactly these columns. See the
   docstring at the top of the script. Import it with **File → Import → Upload → Replace current
   sheet** on the Participants tab. Keep the exports and the CSV under `private-data/`, which is
   git-ignored.
4. **Email uniqueness validation (column A):**
   - Select A2:A1000 → **Data → Data validation**
   - Criteria: "Custom formula is" → `=COUNTIF($A$2:$A,A2)=1`
   - Check "Reject input", error text: "This email already exists."
5. **Name uniqueness validation (column B):**
   - Select B2:B1000 → **Data → Data validation**
   - Criteria: "Custom formula is" → `=COUNTIF($B$2:$B,B2)=1`
   - Check "Reject input", error text: "This name already exists."
6. **Whole-number validation (column C):**
   - Select C2:C1000 → **Data → Data validation**
   - Criteria: "Number" → "greater than or equal to" `0`
   - Check "Reject input"
7. Format column D: **Format → Number → Date time**

**Example:**
```
A1: Email                    B1: Name              C1: Draws Remaining   D1: Last Paid
A2: john.smith@email.com     B2: John Smith        C2: 3                 D2: 2026/10/09 19:12
A3: jane.doe@email.com       B3: Jane Doe          C3: 0                 D3:
A4: bob.johnson@email.com    B4: Bob Johnson       C4: 26                D4: 2026/10/02 18:40
```

**How paid-up works:** people pay per draw, not per week. A draw deducts one from everyone who
has any left. A participant is paid up for a draw if Draws Remaining is greater than zero when the
draw runs. Weeks with no draw cost nobody anything, so there is no date arithmetic to get wrong.

**Adding participants** is an admin job: type the row on this sheet. The payment page reads the
sheet live, so the name appears there straight away. The page cannot add people.

**Duplicates:** the data validation below only stops duplicates typed by hand. Pasted or imported
rows get through, so the draw itself also refuses to run while any name or email appears twice,
and the payment page refuses to credit a duplicated name. **50/50 Draw → Check participant list**
runs the same checks without drawing.

### Sheet 2: Winners
1. Create a new sheet named **"Winners"**
2. Add the header row:
   - A1: `Timestamp`
   - B1: `Winner Name`
   - C1: `Winner Email`
   - D1: `Participant Count`
   - E1: `Draw Conducted By`
   - F1: `Draws Remaining`
   - G1: `Paid Up`
   - H1: `Prize Amount`
   - I1: `Carry-over Amount`
3. Format column A: **Format → Number → Date time**
4. Conditional formatting on **A2:I1000** (**Format → Conditional formatting**):
   - Rule 1, custom formula `=$G2="Yes"` → light green background (#d9ead3)
   - Rule 2, custom formula `=$G2="No"` → light red background (#f4cccc)

The script fills this sheet in. Leave it with just headers.

**Prize system:**
- Everyone on the Participants sheet is in every draw, paid up or not
- Prize = number of paid-up participants + carry-over from the previous draw
- Winner paid up (Draws Remaining > 0 at draw time): prize awarded, carry-over resets to $0
- Winner not paid up: whole prize carries over to the next draw
- "Draws Remaining" on the Winners sheet is the winner's count at the moment of the draw

## Step 3: Install the Apps Script

1. **Extensions → Apps Script**
2. **Project Settings** (gear) → tick **Show "appsscript.json" manifest file in editor**
3. Back in the editor, replace the contents of `appsscript.json` with the one from this repo.
   This limits what the script may touch to **this spreadsheet only** (plus showing menus and
   reading your own email for the Draw Conducted By column). Without it, Google would grant the
   script access to every spreadsheet in your account.
4. Replace the contents of `Code.gs` with the `Code.gs` from this repo
5. Click **+** next to Files → **HTML**, name it exactly `Page`, and replace its contents with
   `Page.html` from this repo
6. Save, then reload the spreadsheet. A **50/50 Draw** menu appears.
7. Run **50/50 Draw → Check participant list** once to trigger the authorisation prompt. The
   permission screen should list only this spreadsheet, menus, and your email address. If it
   asks for all your spreadsheets, the manifest step was missed. It also tells you how many
   people are paid up.

## Step 4: Payment Page (bar staff entry)

### Deploy it
1. In the Apps Script editor: **Deploy → New deployment**
2. Gear icon → **Web app**
3. Description: `Bar payment page`
4. **Execute as: Me**. This is what lets bar staff update a sheet they cannot open.
5. **Who has access: Anyone**. The iPad is shared and has no Google login.
6. **Deploy**, approve the permissions, and copy the URL ending in `/exec`.
   **Deploy → Manage deployments** shows it again any time.

### Set a PIN (recommended)
Anyone who has the URL can record payments, so protect it with a short PIN:
1. Apps Script editor → **Project Settings** (gear) → **Script properties** → **Add script property**
2. Property `BAR_PIN`, value e.g. `4471`
3. The page asks for the PIN once per device and remembers it. Change the property to change the PIN.

### Put it on the iPad
1. Open the `/exec` URL in Safari on the bar iPad
2. Share → **Add to Home Screen**, name it "50/50 Payment"
3. Open it from the home screen and enter the PIN once

### Using it
- Type part of a name. The list filters as you type and is in surname order. The number on the
  right is that person's draws remaining, shown in red when it is zero, so staff can also answer
  "am I paid up?" without recording anything. Tap the name.
- Set how many draws were paid with the number box or the − and + buttons (100 for a season),
  then tap the green button twice to record it.
- The confirmation shows the balance before and after, e.g. `Bob Baker: 3 draws paid. 0 -> 3 remaining.`,
  and the list refreshes so the new balance appears next to the name.
- Someone who is not listed must be added to the Participants sheet by an admin, and then appears
  immediately.

### What the page can reach
- Anyone with the URL and PIN sees names and draws remaining. Emails, the winners log and the
  payments ledger never leave the spreadsheet.
- Only two functions are callable from the page: list names, and record a payment for a listed
  name. Everything else in the script is private, and the draw cannot be run from a web page.
- Anything typed into the page is stored as plain text, never as a formula.
- The manifest from Step 3 means that even a bug in those two functions could not reach any
  other spreadsheet or Google service in your account.

### After editing the code
A web app runs the version that was deployed, not the live editor. After any change to `Code.gs`
or `Page.html`: **Deploy → Manage deployments → pencil icon → Version: New version → Deploy**.
The URL stays the same, so the iPad needs nothing.

### The Payments ledger
The first recorded payment creates a **Payments** sheet with these columns:

| Timestamp | Participant | Draws Paid | Before | After | Recorded By | Result |
|-----------|-------------|------------|--------|-------|-------------|--------|

One row per attempt. Result is `OK` for a recorded payment, or `ERROR: ...` with the reason
(unknown name, duplicate rows, bad number, wrong PIN). Failed attempts change nothing on the
Participants sheet, but they are kept so that if someone paid and the page said no, you can see
what was attempted and fix it by hand.

## Step 5: Sheet Protection

1. Right-click the **Winners** tab → **Protect sheet** → restrict to yourself or named editors.
   Protecting it does not stop the draw: the draw runs as the person using the menu, so give
   draw-runners edit rights on this sheet.
2. Right-click **Payments** → **Protect sheet** the same way. The payment page still writes to it
   because it runs as you.
3. Leave **Participants** unprotected for the admins who run draws and tidy up data.

## Reconciling Against Bar Takings

The Payments sheet is the ledger. Draws are $1 each, so the number of draws recorded on a day is
the cash the bar should have taken for the 50/50 that day. To total a day, put the date in a cell
(say `A1` on a scratch tab) and use:

```
=SUMIFS(Payments!C:C, Payments!A:A, ">="&A1, Payments!A:A, "<"&(A1+1), Payments!G:G, "OK")
```

Only rows whose Result is `OK` are counted, so failed attempts never inflate the total.

Corrections typed straight into Draws Remaining on the Participants sheet do not appear in this
ledger. They are recorded in **File → Version history** with who made them and when, but keep
such edits to genuine corrections so the ledger stays a faithful record of money taken.

## Starting a New Season

**Recommended: copy the workbook.** The old season's file stays exactly as it is, as a frozen
archive nothing can touch, and the copy brings the tab layout, validation, formatting and
protection with it.

1. In last season's workbook: **File → Make a copy**, named e.g. **50/50 Draw 2026-27**.
   Tick "Share it with the same people" if the same admins run draws.
2. In the copy, on the **Participants** tab: select everything below the header row and delete
   it, then **File → Import → Upload** the CSV from `build-participants.py` → **Replace data at
   selected cell** with A1 selected (or **Replace current sheet**). Check the headers read
   Email, Name, Draws Remaining, Last Paid. If the old tab still had a Paid Until column, the
   import replaces it.
3. On the **Winners** tab: delete everything below the header row and change header F1 from
   `Paid Until` to `Draws Remaining`. An empty Winners tab starts the pot at $0. To carry an
   unclaimed pot forward, type one row with the amount in column I (Carry-over Amount) and a
   note in column B.
4. **Extensions → Apps Script** in the copy. The copy carries the old script, so follow Step 3
   from the top: manifest, `Code.gs`, `Page` HTML file. Then deploy the payment page (Step 4) and
   set the PIN. Deployments, PINs and the web app URL do not copy across, so these are always
   fresh for the new workbook.
5. Reload the copy and run **50/50 Draw → Check participant list**. The permission screen
   appears here; confirm it names only this spreadsheet.
6. Re-check sheet protection on Winners (Step 5). The first payment creates the Payments tab;
   protect it after that.
7. Give the new workbook's link to whoever runs draws, and the payment page URL to the bar.

**Alternative: stay in the same workbook.** Rename the old tabs (e.g. **Participants 2025-26**,
**Winners 2025-26**; their protection stays), create fresh **Participants** and **Winners** tabs
with the Step 2 headers, import the CSV, and update the script as in Step 3. The script only
ever looks at the tabs named exactly Participants and Winners. This keeps one link for admins,
at the cost of the live script sitting next to the archive.

Either way, the row count on the old Winners tab is how many draws last season had.
