#!/usr/bin/env python3
"""
Build the Participants sheet for a new season from two membership exports.

Usage:
  python3 build-participants.py MEMBERS.xls PAID.xls OUTPUT.csv [--credits 100]

MEMBERS.xls  full membership export (columns: name, lastname, email, cb_agerange)
PAID.xls     export of members who have paid for the season (same columns)
OUTPUT.csv   written with the Participants headers: Email, Name, Draws Remaining, Last Paid

Everyone in MEMBERS is included. Anyone whose email also appears in PAID gets
--credits draws (default 100, i.e. "paid for the season"); everyone else gets 0.
Rows are sorted by surname. Age range is dropped: the draw does not need it.

Requires: pip install xlrd   (the exports are legacy binary .xls files)

Keep inputs and output under private-data/ which is git-ignored. This script
prints counts only, never names or emails.
"""
import argparse, csv, sys
import xlrd


def load(path):
    sheet = xlrd.open_workbook(path).sheet_by_index(0)
    header = [str(c.value).strip().lower() for c in sheet.row(0)]
    for col in ('name', 'lastname', 'email'):
        if col not in header:
            sys.exit(f'{path}: expected a "{col}" column, found {header}')
    idx = {col: header.index(col) for col in ('name', 'lastname', 'email')}
    rows = []
    for r in range(1, sheet.nrows):
        row = [str(c.value).strip() for c in sheet.row(r)]
        if not any(row):
            continue
        name, last, email = row[idx['name']], row[idx['lastname']], row[idx['email']].lower()
        if not name or not email:
            sys.exit(f'{path}: row {r + 1} is missing a name or email')
        rows.append({'name': name, 'last': last, 'email': email})
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('members')
    ap.add_argument('paid')
    ap.add_argument('output')
    ap.add_argument('--credits', type=int, default=100, help='draws to give each season-paid member')
    args = ap.parse_args()

    members = load(args.members)
    paid_emails = {p['email'] for p in load(args.paid)}

    member_emails = {m['email'] for m in members}
    if len(member_emails) != len(members):
        sys.exit('members file has duplicate emails; fix the export first')
    names = [m['name'].lower() for m in members]
    if len(set(names)) != len(names):
        sys.exit('members file has two people with the same name; the form dropdown needs unique names')
    missing = paid_emails - member_emails
    if missing:
        print(f'WARNING: {len(missing)} paid emails are not in the members file and were skipped', file=sys.stderr)

    members.sort(key=lambda m: (m['last'].lower(), m['name'].lower()))
    with open(args.output, 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['Email', 'Name', 'Draws Remaining', 'Last Paid'])
        for m in members:
            w.writerow([m['email'], m['name'], args.credits if m['email'] in paid_emails else 0, ''])

    paid_count = sum(1 for m in members if m['email'] in paid_emails)
    print(f'wrote {len(members)} participants to {args.output}: '
          f'{paid_count} with {args.credits} draws, {len(members) - paid_count} with 0')


if __name__ == '__main__':
    main()
