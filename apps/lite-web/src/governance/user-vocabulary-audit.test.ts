import { describe, expect, it } from 'vitest';
import {
  compareVocabularyBaseline,
  scanLiteVocabulary,
  scanVocabularySource,
  summarizeVocabularyBaseline,
  validateVocabularyBaseline,
  type VocabularyBaselineEntry
} from './user-vocabulary-audit';

type BaselineFinding = readonly [
  VocabularyBaselineEntry['category'],
  phrase: string,
  count: number
];

function baselineEntries(
  file: string,
  surface: VocabularyBaselineEntry['surface'],
  reason: string,
  findings: readonly BaselineFinding[]
): VocabularyBaselineEntry[] {
  return findings.map(([category, phrase, count]) => ({
    file,
    category,
    phrase,
    count,
    surface,
    reason
  }));
}

const BASELINE: readonly VocabularyBaselineEntry[] = [
  ...baselineEntries(
    'apps/lite-web/src/App.tsx',
    'USER',
    'Known production shell wording debt; navigation names require a separate product decision.',
    [
      ['REVIEW_INTERNAL', 'Professional Review', 1],
      ['EXECUTION_INTERNAL', 'Execution Release', 1],
      ['TECHNICAL_EVIDENCE', 'fingerprints', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/agency-ia-prototype/AgencyIaPrototype.tsx',
    'ADVANCED',
    'Prototype-only Diagnostics fixture intentionally demonstrates exact technical evidence.',
    [['TECHNICAL_EVIDENCE', 'Fingerprint', 1]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/api/capability.ts',
    'USER',
    'Known client error copy exposes runtime vocabulary and requires a separate copy change.',
    [['CAPABILITY_INTERNAL', 'Capability runtime', 1]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/api/matters.ts',
    'USER',
    'Known Matter client errors retain the existing workflow name pending product review.',
    [['REVIEW_INTERNAL', 'Professional Review', 3]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/api/professional-review.ts',
    'USER',
    'Known review client fallback retains the existing workflow name pending product review.',
    [['REVIEW_INTERNAL', 'Professional Review', 1]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/capability/CapabilityCenter.tsx',
    'USER',
    'Known Capability Center wording debt remains outside this bounded governance change.',
    [
      ['REFLECTION_INTERNAL', 'reflection candidates', 2],
      ['REFLECTION_INTERNAL', 'reflection candidate', 3],
      ['CAPABILITY_INTERNAL', 'Capability Twin', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/capability/CapabilityCenter.tsx',
    'ADVANCED',
    'Capability evidence details expose exact fingerprints for inspection.',
    [['TECHNICAL_EVIDENCE', 'fingerprint', 2]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/content-studio/ContentStudio.tsx',
    'USER',
    'Known Content Studio owner-language debt requires an owning workflow copy decision.',
    [
      ['OWNER_INTERNAL', 'current owner truth', 3],
      ['OWNER_INTERNAL', 'Preparation owner', 1],
      ['OWNER_INTERNAL', 'owner-permitted', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/content-studio/ContentStudio.tsx',
    'ADVANCED',
    'Content lineage and conflict details expose exact fingerprints for diagnosis.',
    [['TECHNICAL_EVIDENCE', 'fingerprint', 6]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/customers/CustomersPreview.tsx',
    'USER',
    'Known fixture-preview safety wording is retained without changing product semantics.',
    [
      ['PROTECTED_ACTION_INTERNAL', 'protected actions', 1],
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/customers/fixture-repository.ts',
    'USER',
    'Existing customer preview fixtures render this known safety and review wording debt.',
    [
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1],
      ['REVIEW_INTERNAL', 'professional review', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/execution-release/ExecutionRelease.tsx',
    'USER',
    'The existing release workbench terminology is product-owned debt, not a V1 copy rewrite.',
    [
      ['EXECUTION_INTERNAL', 'Execution Releases', 2],
      ['EXECUTION_INTERNAL', 'Execution Release', 9],
      ['RAW_STATUS_ENUM', 'CURRENT', 1],
      ['RAW_STATUS_ENUM', 'STALE', 1],
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1],
      ['REVIEW_INTERNAL', 'Professional Review', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/guide/GuideWorkspace.tsx',
    'USER',
    'Known Guide safety copy retains internal owner wording pending an owning workflow change.',
    [['OWNER_INTERNAL', 'Current owner truth', 2]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/insights/WorkspaceInsights.tsx',
    'USER',
    'Known Insights qualification copy remains unchanged by this governance-only task.',
    [
      ['OWNER_INTERNAL', 'Owner-backed', 1],
      ['OWNER_INTERNAL', 'exact owner', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/matters/MatterWorkspace.tsx',
    'USER',
    'Known Matter workflow labels require a separate production information-architecture decision.',
    [
      ['OWNER_INTERNAL', 'exact owner', 2],
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1],
      ['REVIEW_INTERNAL', 'Professional Review', 7]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/opportunities/CandidateReview.tsx',
    'ADVANCED',
    'Candidate evidence and conflict details expose fingerprints for exact diagnosis.',
    [['TECHNICAL_EVIDENCE', 'fingerprint', 5]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/opportunities/GovernedActionComposer.tsx',
    'USER',
    'Known conflict copy retains owner terminology pending its workflow-owned copy review.',
    [['OWNER_INTERNAL', 'current owner truth', 2]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/professional-review/ProfessionalReview.tsx',
    'USER',
    'The existing workbench name is product-owned debt, not authorized for renaming here.',
    [['REVIEW_INTERNAL', 'professional review', 6]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/professional-review/ProfessionalReview.tsx',
    'USER',
    'Known blocking-copy debt renders the raw UNKNOWN result instead of user-facing language.',
    [['RAW_STATUS_ENUM', 'UNKNOWN', 2]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/site-manager/SiteManager.tsx',
    'USER',
    'Known Site Manager owner and safety wording remains for a later product copy review.',
    [
      ['OWNER_INTERNAL', 'Owner-backed', 5],
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1],
      ['OWNER_INTERNAL', 'owner state', 3],
      ['OWNER_INTERNAL', 'Exact owner', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/today/TodayCommandCenter.tsx',
    'USER',
    'Known Today deep-link wording is retained until the owning workflow is revised.',
    [['PREPARATION_INTERNAL', 'Prepared action', 2]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/today/TodayMoveSection.tsx',
    'USER',
    'Known Today section label is retained until the owning workflow is revised.',
    [['PREPARATION_INTERNAL', 'Prepared Action', 1]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/today/TodayWorkspace.tsx',
    'USER',
    'Known Today error copy is retained until the owning workflow is revised.',
    [['PREPARATION_INTERNAL', 'Prepared Action', 1]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/trademark-assets/HistoricalTrademarkAssetImportPanel.tsx',
    'ADVANCED',
    'Import review details expose exact fingerprints for migration diagnosis.',
    [['TECHNICAL_EVIDENCE', 'fingerprint', 2]]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/trademark-assets/TrademarkAssetWorkspace.tsx',
    'USER',
    'Known trademark safety and refresh copy remains outside this governance-only task.',
    [
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1],
      ['OWNER_INTERNAL', 'Current owner truth', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/trademark-assets/TrademarkServiceWorkbench.tsx',
    'USER',
    'Known service-workbench labels require a separate product-owned copy decision.',
    [
      ['REVIEW_INTERNAL', 'professional review', 1],
      ['PROTECTED_ACTION_INTERNAL', 'protected action', 1],
      ['OWNER_INTERNAL', 'Owner-backed', 1],
      ['PROTECTED_ACTION_INTERNAL', 'protected actions', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/trading-studio/TradingStudio.tsx',
    'USER',
    'Reported existing Trading debt; active issue #1283 exclusively owns any copy repair.',
    [
      ['OWNER_INTERNAL', 'owner state', 1],
      ['OWNER_INTERNAL', 'current owner truth', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/features/work/WorkHub.tsx',
    'USER',
    'Known Work Hub labels require a separate evidence-backed production IA decision.',
    [
      ['EXECUTION_INTERNAL', 'Execution Release', 4],
      ['REVIEW_INTERNAL', 'Professional Review', 3],
      ['OWNER_INTERNAL', 'Owner-backed', 1],
      ['REFLECTION_INTERNAL', 'reflection candidates', 1]
    ]
  ),
  ...baselineEntries(
    'apps/lite-web/src/routing/GovernedWorkRouteEntry.tsx',
    'USER',
    'Known route fallback safety copy remains unchanged by this governance-only task.',
    [['PROTECTED_ACTION_INTERNAL', 'protected actions', 1]]
  )
];

describe('user-facing vocabulary audit', () => {
  it('rejects internal architecture phrases in ordinary user copy', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      'export function Example() { return <h1>Execution Release</h1>; }'
    );

    expect(compareVocabularyBaseline(findings, [])).toEqual([
      expect.stringContaining('USER_VOCABULARY_LEAKAGE')
    ]);
  });

  it('allows a technical phrase only through an exact advanced-context exception', () => {
    const file = 'apps/lite-web/src/features/example/Diagnostics.tsx';
    const findings = scanVocabularySource(
      file,
      'export function Diagnostics() { return <code>Exact owner</code>; }'
    );
    const baseline: VocabularyBaselineEntry[] = [
      {
        file,
        category: 'OWNER_INTERNAL',
        phrase: 'Exact owner',
        count: 1,
        surface: 'ADVANCED',
        reason: 'Explicit support diagnostics reveal the exact owner reference.'
      }
    ];

    expect(compareVocabularyBaseline(findings, baseline)).toEqual([]);
  });

  it('ignores identifiers, imports, comments, and string literal types', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `
        import { ExecutionRelease } from './execution-release';
        // Execution Release is an internal contract.
        type OwnerState = 'CURRENT';
        const currentOwnerTruth = ExecutionRelease;
      `
    );

    expect(findings).toEqual([]);
  });

  it('does not confuse a seller OWNER role with architecture vocabulary', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `export function Example() { return <p>Seller role: OWNER</p>; }`
    );

    expect(findings).toEqual([]);
  });

  it('rejects a new phrase that is absent from an existing baseline', () => {
    const file = 'apps/lite-web/src/features/example/Example.tsx';
    const findings = scanVocabularySource(
      file,
      `export function Example() { return <><p>Prepared Action</p><p>Target Binding</p></>; }`
    );
    const baseline: VocabularyBaselineEntry[] = [
      {
        file,
        category: 'PREPARATION_INTERNAL',
        phrase: 'Prepared Action',
        count: 1,
        surface: 'USER',
        reason: 'Known wording debt retained until its owning workflow changes.'
      }
    ];

    expect(compareVocabularyBaseline(findings, baseline).join('\n')).toContain('Target Binding');
  });

  it('reports baselined debt deterministically and detects stale counts', () => {
    const baseline: VocabularyBaselineEntry[] = [
      {
        file: 'apps/lite-web/src/features/example/Example.tsx',
        category: 'PREPARATION_INTERNAL',
        phrase: 'Prepared Action',
        count: 2,
        surface: 'USER',
        reason: 'Known wording debt retained until its owning workflow changes.'
      }
    ];

    expect(summarizeVocabularyBaseline(baseline)).toEqual({ 'USER:PREPARATION_INTERNAL': 2 });
    expect(compareVocabularyBaseline([], baseline)).toEqual([
      'BASELINE_MISMATCH file=apps/lite-web/src/features/example/Example.tsx category=PREPARATION_INTERNAL phrase="Prepared Action" expected=2 actual=0'
    ]);
  });

  it('fails closed for malformed or overbroad exceptions', () => {
    const invalid = {
      file: 'apps/lite-web/src/features/**',
      category: 'OWNER_INTERNAL',
      phrase: '*',
      count: 0,
      surface: 'ADVANCED',
      reason: 'too short'
    } as VocabularyBaselineEntry;

    expect(validateVocabularyBaseline([invalid])).toEqual([
      'count must be a positive integer: apps/lite-web/src/features/**|OWNER_INTERNAL|*',
      'file must name one production TypeScript source file: apps/lite-web/src/features/**',
      'phrase must be exact: *',
      'reason is too short: apps/lite-web/src/features/**|OWNER_INTERNAL|*'
    ]);
  });

  it('allows required safety semantics in user language', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `export function Example() { return <><p>Up to date</p><p>Needs refresh</p><p>Some information is unavailable</p><p>Ready for approval</p></>; }`
    );

    expect(findings).toEqual([]);
  });

  it('rejects raw state enum tokens embedded in rendered user copy', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `export function Example() { return <p>Source status: CURRENT; fallback: UNAVAILABLE</p>; }`
    );

    expect(findings.map(({ category, phrase }) => [category, phrase])).toEqual([
      ['RAW_STATUS_ENUM', 'CURRENT'],
      ['RAW_STATUS_ENUM', 'UNAVAILABLE']
    ]);
  });

  it('rejects copy that collapses unavailable information into an empty result', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `export function Example() { return <p>No information available</p>; }`
    );

    expect(findings).toEqual([
      expect.objectContaining({
        category: 'AVAILABILITY_COLLAPSE',
        phrase: 'No information available'
      })
    ]);
  });

  it('rejects copy that equates distinct draft, approval, send, and publish states', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `export function Example() { return <><p>Draft means sent</p><p>Approved / published</p></>; }`
    );

    expect(findings.map(({ category, phrase }) => [category, phrase])).toEqual([
      ['LIFECYCLE_COLLAPSE', 'Approved / published'],
      ['LIFECYCLE_COLLAPSE', 'Draft means sent']
    ]);
  });

  it('allows raw technical state only through an exact diagnostics exception', () => {
    const file = 'apps/lite-web/src/features/example/Diagnostics.tsx';
    const findings = scanVocabularySource(
      file,
      `export function Diagnostics() { return <code>Freshness: UNKNOWN</code>; }`
    );
    const baseline: VocabularyBaselineEntry[] = [
      {
        file,
        category: 'RAW_STATUS_ENUM',
        phrase: 'UNKNOWN',
        count: 1,
        surface: 'ADVANCED',
        reason: 'Explicit support diagnostics expose the exact technical freshness state.'
      }
    ];

    expect(compareVocabularyBaseline(findings, baseline)).toEqual([]);
  });

  it('does not flag legitimate business uses or copy that preserves state distinctions', () => {
    const findings = scanVocabularySource(
      'apps/lite-web/src/features/example/Example.tsx',
      `export function Example() { return <><p>Current trademark owners</p><p>No appointments are available</p><p>Draft — not sent yet</p><p>Published portfolio</p></>; }`
    );

    expect(findings).toEqual([]);
  });

  it('keeps the checked-in audit summary explicit', () => {
    expect(BASELINE.reduce((total, entry) => total + entry.count, 0)).toBe(110);
    expect(summarizeVocabularyBaseline(BASELINE)).toEqual({
      'USER:REVIEW_INTERNAL': 24,
      'USER:EXECUTION_INTERNAL': 16,
      'USER:TECHNICAL_EVIDENCE': 1,
      'ADVANCED:TECHNICAL_EVIDENCE': 16,
      'USER:PREPARATION_INTERNAL': 4,
      'USER:REFLECTION_INTERNAL': 6,
      'USER:CAPABILITY_INTERNAL': 2,
      'USER:OWNER_INTERNAL': 27,
      'USER:PROTECTED_ACTION_INTERNAL': 10,
      'USER:RAW_STATUS_ENUM': 4
    });
  });

  it('matches the reviewed production baseline without silently expanding it', () => {
    const errors = compareVocabularyBaseline(scanLiteVocabulary(), BASELINE);
    expect(errors, errors.join('\n\n')).toEqual([]);
  });
});
