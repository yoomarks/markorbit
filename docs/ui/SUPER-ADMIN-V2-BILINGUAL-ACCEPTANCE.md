# Super Admin V2 bilingual acceptance

## Delivered behavior

- First visit is always Simplified Chinese (`zh-CN`); browser language is not consulted.
- `简体中文 / English` is available in the system header and inside protected confirmations.
- The preference is restored from `markorbit.super-admin-v2.locale` without changing the route.
- Switching language keeps the selected object, filters, sorting, inspector, review draft, Demo state and protected-confirmation target mounted.
- All twelve primary modules and all ninety registered secondary routes are checked for untranslated visible text and accessible labels in English.
- Original evidence, raw logs, object IDs, contract versions, exact locators and SHA values are explicitly preserved.
- Demo/Real and protected-action behavior is unchanged; no production write or new owner access was added.

## Browser acceptance

The operations browser suite covers:

- Chinese default and English preference restoration;
- Data Engine task selection and deterministic query state;
- Knowledge evidence draft and approval-target continuity;
- API credential and user-permission selection continuity;
- protected dialog focus order, Escape and focus restoration;
- all ninety routes and missing-translation attributes;
- 1440×900, 1366×768, 390 px and 200% page-scale scenarios;
- existing V2.2 interaction integrity and V2.3 Demo/Real read-only boundaries.

Latest result: **92 passed, 8 intentionally skipped by viewport, 0 failed**.

## Local visual evidence

Playwright writes review evidence to the ignored local `playwright-screenshots/` directory so generated artifacts do not enter the product bundle:

- `super-admin-v2-i18n-overview-{zh,en}-{desktop,mobile}.png`
- `super-admin-v2-i18n-data-jobs-{zh,en}-{desktop,mobile}.png`
- `super-admin-v2-i18n-data-jobs-en-laptop.png`
- `super-admin-v2-i18n-knowledge-evidence-{zh,en}-{desktop,mobile}.png`
- `super-admin-v2-i18n-knowledge-evidence-en-200-percent.png`

## Product terminology review

The concentrated terminology decisions and authority boundaries are in [SUPER-ADMIN-V2-BILINGUAL-IA.md](./SUPER-ADMIN-V2-BILINGUAL-IA.md#governed-terminology-for-product-confirmation). Any change to Retry, Replay, Recover, Rollback, Revoke, Suspend, Delete, Archive, Source, Raw Artifact, Evidence, Plan, Run, Job, Checkpoint or Receipt should be reviewed as a management-semantics change rather than ordinary copy editing.
