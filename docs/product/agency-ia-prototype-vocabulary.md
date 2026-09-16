# Agency IA Prototype Vocabulary

**PROTOTYPE / SUBJECT TO REAL DOGFOOD**

Task: `MO-AGENCY-IA-PROTOTYPE-001`

This document records wording used by the isolated Agency IA Storybook prototype. It is a UX projection only. It does not rename a contract, change an owner, establish legal meaning, or authorize a production navigation cutover.

| Internal concept      | Current UI wording            | Prototype wording                        | Visibility  | Reason                                                                             |
| --------------------- | ----------------------------- | ---------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| Formal Matter         | Matter / Formal Matter        | Case                                     | USER        | Matches how an agency finds professional work.                                     |
| Trademark Asset       | Trademark Asset               | Trademark                                | USER        | Removes implementation vocabulary from ordinary portfolio work.                    |
| Directory             | Customers / Directory         | Clients & contacts                       | USER        | Describes the relationship surface without equating every contact with a customer. |
| Communication Link    | Communication Link            | Linked to…                               | USER        | Makes the relationship action explicit without exposing the contract name.         |
| Discovered            | Discovered                    | Found / Suggested                        | USER        | Describes provenance without implying admission to the workspace.                  |
| Managed               | Managed                       | Added to workspace / Managed for client  | USER        | Keeps workspace admission distinct from professional representation.               |
| Currentness           | Currentness / CURRENT / STALE | Up to date / Needs refresh               | USER        | Gives an actionable freshness signal.                                              |
| Freshness             | Freshness                     | Last checked / Updated                   | USER        | Provides time context in familiar language.                                        |
| Prepared Action       | Prepared Action               | Draft action / Ready for review          | USER        | States that nothing has been performed.                                            |
| Professional Review   | Professional Review           | Review                                   | USER        | Places review inside a Case rather than in a top-level module.                     |
| Execution Release     | Execution Release             | Ready to file / Ready to send / Approval | USER        | Describes the next case step while retaining explicit final confirmation.          |
| Opportunity Candidate | Opportunity Candidate         | Potential opportunity                    | USER        | Avoids implying demand or instruction truth.                                       |
| Target Binding        | Target Binding                | Connected destination                    | ADVANCED    | Useful when choosing a destination; exact binding remains diagnostic.              |
| Publish Request       | Publish Request               | Publish review                           | USER        | Frames the request as a reviewable step, not a completed publication.              |
| Protected Action      | Protected Action              | Final confirmation                       | USER        | Preserves the safety boundary at the point of action.                              |
| Capability            | Capability                    | Working skill                            | HIDDEN      | Ordinary work should not require capability runtime vocabulary.                    |
| Reflection Candidate  | Reflection Candidate          | Suggested learning                       | USER        | Makes the suggestion provisional and user-controlled.                              |
| Brain                 | AI Guide / Brain              | Ask MO                                   | USER        | Makes assistance contextual rather than a destination.                             |
| Cordis                | Capability Center             | My working style / Team Playbook         | USER        | Uses recognizable professional language.                                           |
| Evidence Ledger       | Governed evidence provenance  | Sources & history                        | USER        | Supports trust checks without ledger vocabulary.                                   |
| Official Truth        | Official Truth                | Official record                          | USER        | Identifies authoritative source information in plain language.                     |
| Provider Return       | Provider Return               | Provider update                          | ADVANCED    | Describes source output without treating it as official truth.                     |
| Owner reference       | Owner ref                     | Owner reference                          | DIAGNOSTICS | Needed for support, not daily agency work.                                         |
| Fingerprint / receipt | Fingerprint / receipt         | Fingerprint / receipt                    | DIAGNOSTICS | Exact technical evidence remains available but hidden by default.                  |

## Trust and freshness rules

- `Official record`, `Workspace information`, and `AI suggestion` are visually and textually distinct.
- `Some data unavailable` is never rendered as an empty result.
- `Needs refresh` preserves the stale-data warning while hiding the backend enum.
- Every approval or draft confirmation states whether anything has actually been sent or filed.
- Exact identifiers, versions, receipts, fingerprints, and technical currentness remain under `Advanced → Diagnostics`.
