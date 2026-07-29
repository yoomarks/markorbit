# Milestone 001 Negative-path Matrix

The machine-readable descriptor is validated by `pnpm test:story-matrix`. Existing owning-service and real Gateway HTTP suites remain the executable adapters; a direct service call is never represented as HTTP evidence.

| Case   | Stage / service                                 | Domain and Gateway error        | HTTP | Mutation | Authority | Test adapters                                    |
| ------ | ----------------------------------------------- | ------------------------------- | ---: | -------- | --------- | ------------------------------------------------ |
| NP-001 | Quote / markreg-service                         | STALE_QUOTE                     |  409 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-002 | Quote / markreg-service                         | QUOTE_EXPIRED                   |  409 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-003 | Customer Confirmation / markreg-service         | VERSION_MISMATCH                |  409 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-004 | Customer Confirmation / markreg-service         | CONFIRMATION_WITHDRAWN          |  409 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-005 | Matter Draft / markreg-service                  | BLOCKING_CHECK_UNKNOWN          |  422 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-006 | Professional Review / execution-service         | ACTIVE_REVIEW_CASE_EXISTS       |  409 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-007 | Professional Review / execution-service         | STALE_PROFESSIONAL_REVIEW       |  409 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-008 | Documents and Instructions / markreg-service    | REQUIRED_DOCUMENT_MISSING       |  422 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-009 | Documents and Instructions / markreg-service    | SUPERSEDED_DOCUMENT             |  409 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-010 | Documents and Instructions / markreg-service    | INSTRUCTION_LEDGER_UNCONFIRMED  |  422 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-011 | Preparation Lock / markreg-service              | STALE_PREPARATION_SOURCE        |  409 | none     | none      | `services/markreg/tests`; `apps/gateway/tests`   |
| NP-012 | Filing Authorization / execution-service        | ACKNOWLEDGEMENT_REQUIRED        |  422 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-013 | Filing Authorization / execution-service        | FILING_AUTHORIZATION_EXPIRED    |  409 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-014 | Execution Release / execution-service           | BLOCKING_CHECK_FAILED           |  422 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-015 | Execution Release / execution-service           | BLOCKING_CHECK_UNKNOWN          |  422 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-016 | Execution Release / execution-service           | ACTIVE_EXECUTION_RELEASE_EXISTS |  409 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
| NP-017 | Filing Execution Task Draft / execution-service | STALE_FILING_TASK_DRAFT         |  409 | none     | none      | `services/execution/tests`; `apps/gateway/tests` |
