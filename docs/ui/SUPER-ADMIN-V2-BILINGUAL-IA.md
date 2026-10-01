# Super Admin V2 — bilingual information architecture

## User and job-to-be-done

An Internal Operator needs to inspect and operate the existing twelve Super Admin domains in Simplified Chinese by default, or switch the same working context to English for cross-region collaboration. Language is presentation preference only: it must not alter the selected owner object, authorization, command, draft, audit meaning, Demo/Real boundary, or durable truth.

## Entry, navigation and persistence

- Entry remains every existing `/super-admin-v2/:module/:page` route; `/` is unchanged.
- `zh-CN` is the unconditional first-visit default and does not consult browser language.
- The top account/system area exposes `简体中文 / English`. Switching is immediate and does not navigate or reload.
- The preference is stored locally under a Super Admin-specific key and restored on the next visit.
- The current URL, primary/secondary navigation, filters, sorting, selected object, inspector, draft, Demo review state and protected confirmation stay mounted during a language switch.

## Translation ownership

- Locale codes and formatting behavior follow the repository's BCP 47 usage.
- Super Admin owns its dictionaries and terminology because its release cadence and management semantics differ from Lite.
- Shared technical identifiers remain unchanged: owner names, object IDs, contract versions, SHA values, file names, exact locators and raw log/source payloads.
- Source, Raw Artifact, Evidence, Plan, Run, Job, Checkpoint and Receipt remain distinct terms.
- Retry, Replay, Recovery and Rollback remain distinct actions.

## Presentation hierarchy

- The existing single-H1 page hierarchy, Shell, two-level navigation and product-specific workspaces remain unchanged.
- Chinese is the layout baseline. English may wrap naturally but cannot hide actions or introduce page-level overflow.
- The language control is compact on desktop and remains a reachable two-option control at 390 px and 200% zoom.
- Evidence originals and logs keep an explicit original-data treatment; surrounding labels and controls are localized.

## State matrix

| State                                                    | Required bilingual behavior                                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| First visit                                              | Render `zh-CN`, independent of browser language                                                           |
| Restored preference                                      | Render the saved valid locale; invalid values fall back to `zh-CN`                                        |
| Switching                                                | Update visible UI and accessible names without reload or state reset                                      |
| Missing translation                                      | Development/test audit reports the visible source text; no raw key, `undefined` or blank text is rendered |
| Loading / empty / error / permission / partial / success | Preserve the existing state meaning and localize only its presentation                                    |
| Protected confirmation                                   | Keep object, permission context, reason draft and focus behavior; replace all explanatory copy in place   |
| Real mode                                                | Preserve owner data and provenance verbatim; localize labels, availability and recovery guidance only     |
| Original evidence/log                                    | Preserve exact source text and identify it as original data; never replace it with a translation          |

## Acceptance path

1. Verify a clean first visit is Chinese, then switch to English and restore it in a new page.
2. Switch inside Data Engine task detail, Knowledge evidence review, Integration credentials, User permissions and a protected dialog; assert object and draft continuity.
3. Traverse all 90 routes in both locales and fail on missing visible translations outside explicit original-data regions.
4. Re-run existing object-integrity, keyboard, Demo/Real and 404 coverage.
5. Capture Chinese and English desktop, 1366×768, 390 px and zoom evidence for Shell, Data Engine and Knowledge representatives.

## Governed terminology for product confirmation

The following translations are deliberately locked as distinct management meanings. Product and security reviewers should confirm changes to this list as terminology decisions rather than ordinary copy edits.

| Canonical term                   | Simplified Chinese             | Boundary preserved                                                               |
| -------------------------------- | ------------------------------ | -------------------------------------------------------------------------------- |
| Enable / Disable                 | 启用 / 停用                    | Availability control, not health                                                 |
| Degraded / Unavailable / Stale   | 服务降级 / 不可用 / 数据已过期 | Runtime availability and observation freshness remain separate                   |
| Retry                            | 重试                           | Repeat a failed attempt under the same execution semantics                       |
| Replay                           | 重放                           | Reprocess retained input or event history                                        |
| Recover                          | 恢复                           | Return an interrupted object or service to an operable state                     |
| Rollback                         | 回滚                           | Restore an earlier governed version or configuration                             |
| Revoke                           | 撤销授权                       | Remove an existing grant or credential authority                                 |
| Suspend                          | 暂停                           | Temporarily stop availability or execution without deleting the object           |
| Delete / Archive                 | 删除 / 归档                    | Destructive removal and retained historical storage remain separate              |
| Audit Log                        | 审计日志                       | Governed operator/account activity record                                        |
| Source / Raw Artifact / Evidence | 来源 / 原始产物 / 证据         | Supply origin, unprocessed payload and reviewed evidence remain separate objects |
| Plan / Run / Job                 | 计划 / 运行 / 任务             | Scheduled intent, one execution and managed work unit remain separate            |
| Checkpoint / Receipt             | 检查点 / 回执                  | Recoverable progress marker and immutable execution evidence remain separate     |

Object IDs, owner names, contract versions, SHA values, exact locators, file names, official documents and raw logs are never translated. If translated evidence is introduced later, it must be displayed beside and clearly distinguished from the original; it cannot replace the original record.

## Non-goals

- No new module, owner contract, production API, permission, command or database access.
- No translation of official source payloads or technical identifiers.
- No replacement of the existing `/` console and no change to the Demo/Real safety boundary.
