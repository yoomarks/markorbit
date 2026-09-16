# Agency Morning Triage — Usability Test Script

**PROTOTYPE / SUBJECT TO REAL DOGFOOD**

Task: `MO-AGENCY-IA-PROTOTYPE-001`

## Persona

A trademark agent or agency project lead beginning a normal workday. They understand clients, cases, trademarks, messages, deadlines, approvals, and filings, but have not learned MarkOrbit architecture terminology.

## Starting state

Open the Storybook story `Prototypes / Agency task-language IA / Today Morning Triage` at desktop width. The synthetic Northstar IP workspace is selected. No real client data or external provider is connected.

## Tasks

1. Identify the three items that most urgently need attention today.
2. Find the new message from outside counsel.
3. Decide which client, case, and trademark the message belongs to.
4. Link the message to the suggested work, or choose another match if the suggestion appears wrong.
5. Create a follow-up for the message.
6. Find and inspect the NORTHSTAR trademark status change.
7. Prepare a client update about the change.
8. Confirm whether the update is only a draft or has actually been sent.

## Success conditions

- The participant completes the journey without needing to understand `owner`, `currentness`, `prepared action`, `communication link`, `capability`, or `execution release`.
- They can distinguish official records, workspace information, and AI suggestions.
- They do not interpret unavailable information as no information.
- They can explain why a record needs refresh.
- They correctly state that the prepared client update has not been sent and that approving a filing draft does not file it.

## Observation checklist

Record:

- wrong navigation choices and backtracking;
- hesitation before choosing Today, Inbox, Cases, or Trademarks;
- terms that prompt a question or incorrect interpretation;
- confusion between official records, workspace information, and AI suggestions;
- confusion between up-to-date, needs-refresh, unavailable, and conflicting information;
- confusion between draft, approval, send, file, and result;
- clicks per task and unnecessary detours;
- task completion, time to completion, and recovery after a wrong choice;
- whether the participant looks for Professional Review or Execution Release as separate modules;
- product findings that require owner support rather than a prototype-only UI change.

## Mobile check

Use the Mobile Today and Mobile Message Approval and Quick Reply stories only to validate triage, message reading, quick response preparation, approval comprehension, and urgent status. Bulk trademark management is intentionally desktop-only in this prototype.
