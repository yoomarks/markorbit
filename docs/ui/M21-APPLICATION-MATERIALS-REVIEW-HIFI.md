# M21 Application Materials Review — High-Fidelity UI Brief

## Status and authority

This brief defines a fixture-backed MarkReg Ultimate UI prototype for the D-042
`US_FILING_PREPARATION` direction. It does not admit a production runtime, define a US legal
method, create a Professional Review case, or change any Matter owner state. Exact Method/Package,
currentness rules, reviewer roster, receipt enums, and runtime evidence remain BRN-A0 admission
facts.

Permanent boundary:

> 仅用于资料准备；未形成法律意见，未提交申请。
>
> For application-material preparation only; no legal opinion has been formed and no application
> has been filed.

## User and job

The first user is a MarkReg Ultimate application-preparation operator. A designated handler is the
next consumer, but this prototype does not simulate the handler's professional decision.

The user needs to review one authorized US direct-application Matter or Matter Draft, identify what
is present, missing, conflicting, unverified, stale, or subject to review, prepare unsent questions,
save an exact-version review snapshot, and request handler review without changing filing or legal
state.

## Supported fixture scope

- One existing US direct-application Matter/Matter Draft with pinned source versions.
- One applicant.
- One standard-character mark or static device mark.
- An already-confirmed §1(a) or §1(b) filing basis.
- One or more already-confirmed classes.

§44(d/e), §66(a), priority, multiple applicants, collective/certification/nontraditional marks,
substantive office actions, and non-US jurisdictions stop as unsupported scope. They are not
silently downgraded to warnings.

## Entry and information architecture

The production entry remains unresolved. The prototype uses the existing MarkReg Matter/Work
context and does not add primary navigation. Today, Work, Matter, Quote, Customer, and Trademark
deep links must ultimately resolve to the same authorized owner identity/version.

The page answers one question:

> 这件申请的资料目前有哪些、哪里缺失或冲突、下一步需要问什么和由谁复核？

Order:

1. High-prominence fixture notice.
2. Matter identity and pinned source version.
3. Permanent authority boundary.
4. Exact issue counts; never a score or completion percentage.
5. Group navigation: Applicant, Mark, Goods & Services, Filing Basis, Supporting Materials.
6. Structured field checklist and selected-field source inspector.
7. Unsent question drafts.
8. Save and handler-handoff controls.
9. Explicitly non-authoritative receipt.

Owner values, confirmed filing basis/classes, source versions, fingerprints, and formal state are
read-only. Notes, review flags, unsent question drafts, and a proposed working value are editable
only inside the preparation result. Selecting a source never overwrites its owner value.

## Interaction contract

Field states are `PRESENT`, `MISSING`, `UNKNOWN`, `CONFLICTING`, `UNVERIFIED`, `STALE`,
`NOT_APPLICABLE`, and `REVIEW_REQUIRED`. Source classes remain visibly distinct: official/external
snapshot, Workspace current data, customer statement, document-extraction candidate, AI/Brain
suggestion, and handler-confirmed result.

Conflicts show values, record locators, versions, timestamps, and currentness side by side. No
source wins by default. `UNKNOWN` never means “no”, and “not found” never becomes a legal claim of
nonexistence.

Locked actions:

- `保存核对结果 / Save Review`
- `生成待问清单 / Prepare Questions`
- `提交经办复核 / Submit for Handler Review`

Question drafts are always labelled unsent. Saving uses the locked result copy:

> 本次资料核对结果已保存，可交由下一步复核。尚未形成法律意见，也未提交任何商标申请。

`handoffAllowed` is owner/fixture input. The browser must not infer it from issue counts. A fixture
handoff receipt demonstrates expected presentation only and explicitly states that it did not
create or advance a Professional Review owner record.

## Desktop and mobile

At desktop width the workbench uses three regions: group navigation, checklist, and a sticky source
inspector. On narrow screens the order becomes matter context, boundary, issue counts, group
navigation, checklist, selected-field detail, source cards, question drafts, and actions. Conflict
columns become labelled Source A/Source B cards. Nothing depends on hover and no page-level
horizontal scrolling is permitted.

## State matrix

| State                  | User-visible treatment                                      | Safe action                              |
| ---------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| Loading                | Named Matter/source loading; boundary remains visible       | Wait                                     |
| Empty                  | No authorized Matter/Matter Draft; no private data inferred | Return to Work                           |
| Partial                | Available values remain usable; affected branch is explicit | Manual review / retry source             |
| Conflict               | Side-by-side sources; no default winner                     | Record proposed value / draft question   |
| Missing                | Exact missing item and blocking source signal               | Draft question                           |
| Unverified             | Candidate remains non-authoritative                         | Inspect / mark for review                |
| Stale                  | Old snapshot and changed version remain visible             | Compare/reload; save and handoff blocked |
| Dependency unavailable | AI/extraction unavailable, never converted to empty         | Continue manually                        |
| Permission denied      | No value, summary, or source detail leaks                   | Request access / return                  |
| Unsupported scope      | Exact unsupported reason and stop boundary                  | Return                                   |
| Recoverable save error | Edits retained; failure is not success                      | Retry save                               |
| Saved                  | Exact fixture snapshot version, actor, time                 | Continue review / request handoff        |
| Handed off (fixture)   | Read-only non-authoritative receipt; explicitly not filed   | Return to Matter                         |

## Evidence and acceptance

Storybook must include a working conflict/missing/unverified fixture, handoff-allowed fixture, stale,
dependency-unavailable, permission, unsupported, loading, empty, recoverable-error, saved receipt,
and 390px conflict state. Fixtures remain visibly marked as fixtures.

Acceptance proves that a keyboard user can inspect a conflict, record only a proposed value, open
and edit an unsent question list, save the review, and view an explicit non-filing result. It also
proves that stale/permission/unsupported states block unsafe action, no owner value is overwritten,
and desktop/mobile layouts have no horizontal page overflow.

The prototype emits no domain events. Any local interaction callbacks are presentation intents
only and must not be described as runtime audit or owner events.
