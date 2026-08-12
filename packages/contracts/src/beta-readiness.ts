export const betaReadinessGapKeys = [
  'CAPABILITY_PRIVATE_LEARNING',
  'CONTENT_OPPORTUNITY_CONVERSION_ANALYTICS',
  'LIFECYCLE_RECOMMENDED_ACTION_PATH',
  'RELIABILITY_RECOVERY_BASELINE',
  'DETERMINISTIC_SEEDED_BETA_SCENARIO',
  'THREE_LOOP_BETA_ACCEPTANCE_GRAPH',
  'DEPLOYMENT_REHEARSAL_RECOVERY',
  'EXACT_HEAD_BETA_RC_QUALIFICATION'
] as const;
export type BetaReadinessGapKey = (typeof betaReadinessGapKeys)[number];

export const betaReadinessGapStatuses = [
  'SATISFIED_BY_EXISTING_EVIDENCE',
  'REMAINS_M7_IMPLEMENTATION'
] as const;
export type BetaReadinessGapStatus = (typeof betaReadinessGapStatuses)[number];

export const betaReadinessWorkPackages = [
  'M7-WP-01',
  'M7-WP-02',
  'M7-WP-03',
  'M7-WP-04',
  'M7-WP-05',
  'M7-WP-06',
  'M7-WP-07'
] as const;
export type BetaReadinessWorkPackage = (typeof betaReadinessWorkPackages)[number];

export interface BetaReadinessAuthorityConsequences {
  businessAuthorityGranted: false;
  protectedActionAuthorized: false;
  productionDeploymentAuthorized: false;
  betaReleased: false;
  ownerReleaseAuthorized: false;
  customerTruthCreated: false;
  providerTruthCreated: false;
  officialTruthCreated: false;
  capabilityVerified: false;
  capabilityCanonMutated: false;
}

export const betaReadinessNoAuthorityConsequences = Object.freeze({
  businessAuthorityGranted: false,
  protectedActionAuthorized: false,
  productionDeploymentAuthorized: false,
  betaReleased: false,
  ownerReleaseAuthorized: false,
  customerTruthCreated: false,
  providerTruthCreated: false,
  officialTruthCreated: false,
  capabilityVerified: false,
  capabilityCanonMutated: false
}) satisfies Readonly<BetaReadinessAuthorityConsequences>;

export interface BetaReadinessGapInventoryEntry {
  schemaVersion: 1;
  key: BetaReadinessGapKey;
  week4Objective: string;
  status: BetaReadinessGapStatus;
  evidenceRefs: ReadonlyArray<string>;
  remainingWorkPackage?: BetaReadinessWorkPackage;
  revalidatedByWorkPackage?: BetaReadinessWorkPackage;
  note: string;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}

export const m7BetaReadinessGapInventoryV1 = Object.freeze([
  {
    schemaVersion: 1,
    key: 'CAPABILITY_PRIVATE_LEARNING',
    week4Objective: 'Capability Profile, Twin projection, Ledger and private Reflection Candidate',
    status: 'SATISFIED_BY_EXISTING_EVIDENCE',
    evidenceRefs: ['M6-WP-01..M6-WP-08', 'PR #93 M6 independent GO audit'],
    note: 'Reuse the completed private Capability learning loop; Milestone 7 must not rebuild it.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'CONTENT_OPPORTUNITY_CONVERSION_ANALYTICS',
    week4Objective: 'Content and opportunity conversion analytics',
    status: 'REMAINS_M7_IMPLEMENTATION',
    evidenceRefs: ['PLC-WP-08 Product Loop GO establishes the durable source facts'],
    remainingWorkPackage: 'M7-WP-02',
    note: 'Add only bounded Product-owned/read-only projections from existing owner facts.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'LIFECYCLE_RECOMMENDED_ACTION_PATH',
    week4Objective: 'Lifecycle reminders and recommended actions',
    status: 'SATISFIED_BY_EXISTING_EVIDENCE',
    evidenceRefs: ['M5-WP-01..M5-WP-08', 'PR #70 M5 final GO audit'],
    note: 'Reuse lifecycle projection and non-executing Recommended Action semantics.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'RELIABILITY_RECOVERY_BASELINE',
    week4Objective: 'Permission, isolation, idempotency, retry and recovery tests',
    status: 'SATISFIED_BY_EXISTING_EVIDENCE',
    evidenceRefs: ['M2-M6 reliability matrices', 'PLC-WP-07 real-runtime reliability matrix'],
    revalidatedByWorkPackage: 'M7-WP-06',
    note: 'Reuse the established reliability gates and re-run them in the exact-head Beta RC matrix.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'DETERMINISTIC_SEEDED_BETA_SCENARIO',
    week4Objective: 'Seeded demo',
    status: 'REMAINS_M7_IMPLEMENTATION',
    evidenceRefs: [],
    remainingWorkPackage: 'M7-WP-03',
    note: 'Create a deterministic reset/reseed path only for explicitly enabled non-production rehearsal environments.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'THREE_LOOP_BETA_ACCEPTANCE_GRAPH',
    week4Objective: 'E2E suites proving the three complete MVP loops',
    status: 'REMAINS_M7_IMPLEMENTATION',
    evidenceRefs: ['Existing milestone-local real-runtime browser and integration suites'],
    remainingWorkPackage: 'M7-WP-04',
    note: 'Compose existing owner runtimes into one Beta-level real-runtime acceptance graph rather than replacing them.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'DEPLOYMENT_REHEARSAL_RECOVERY',
    week4Objective: 'Deployment rehearsal',
    status: 'REMAINS_M7_IMPLEMENTATION',
    evidenceRefs: [],
    remainingWorkPackage: 'M7-WP-05',
    note: 'Prove non-production migration/startup/restart/rollback recovery without production traffic cutover.',
    authority: betaReadinessNoAuthorityConsequences
  },
  {
    schemaVersion: 1,
    key: 'EXACT_HEAD_BETA_RC_QUALIFICATION',
    week4Objective: 'Beta release candidate with three complete loops and explicit known limits',
    status: 'REMAINS_M7_IMPLEMENTATION',
    evidenceRefs: ['M7-WP-02..M7-WP-05 outputs are prerequisites'],
    remainingWorkPackage: 'M7-WP-06',
    note: 'Produce exact-head readiness evidence and known limits for independent M7-WP-07 audit; Owner release authorization remains separate.',
    authority: betaReadinessNoAuthorityConsequences
  }
] as const satisfies ReadonlyArray<Readonly<BetaReadinessGapInventoryEntry>>);

export const betaReadinessBoundaryKinds = [
  'PRODUCT_CONVERSION_METRIC',
  'SEEDED_DEMO_RECORD',
  'DEPLOYMENT_REHEARSAL',
  'BETA_RELEASE_CANDIDATE',
  'AUTOMATED_GATE'
] as const;
export type BetaReadinessBoundaryKind = (typeof betaReadinessBoundaryKinds)[number];

export interface ProductConversionMetricBoundary {
  schemaVersion: 1;
  kind: 'PRODUCT_CONVERSION_METRIC';
  observationalOnly: true;
  mutatesBusinessState: false;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}

export interface SeededDemoRecordBoundary {
  schemaVersion: 1;
  kind: 'SEEDED_DEMO_RECORD';
  environment: 'TEST' | 'REHEARSAL';
  nonProduction: true;
  customerTruth: false;
  providerTruth: false;
  officialTruth: false;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}

export interface DeploymentRehearsalBoundary {
  schemaVersion: 1;
  kind: 'DEPLOYMENT_REHEARSAL';
  nonProduction: true;
  productionTrafficCutover: false;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}

export interface BetaReleaseCandidateBoundary {
  schemaVersion: 1;
  kind: 'BETA_RELEASE_CANDIDATE';
  released: false;
  ownerAuthorizationRequired: true;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}

export interface AutomatedGateBoundary {
  schemaVersion: 1;
  kind: 'AUTOMATED_GATE';
  greenGateAuthorizesRelease: false;
  ownerAuthorizationRequired: true;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}

export type BetaReadinessBoundary =
  | ProductConversionMetricBoundary
  | SeededDemoRecordBoundary
  | DeploymentRehearsalBoundary
  | BetaReleaseCandidateBoundary
  | AutomatedGateBoundary;

export const betaReadinessAuthorityFixture = Object.freeze({
  name: 'M7-WP-01 beta readiness authority lock',
  boundaries: [
    {
      schemaVersion: 1,
      kind: 'PRODUCT_CONVERSION_METRIC',
      observationalOnly: true,
      mutatesBusinessState: false,
      authority: betaReadinessNoAuthorityConsequences
    },
    {
      schemaVersion: 1,
      kind: 'SEEDED_DEMO_RECORD',
      environment: 'REHEARSAL',
      nonProduction: true,
      customerTruth: false,
      providerTruth: false,
      officialTruth: false,
      authority: betaReadinessNoAuthorityConsequences
    },
    {
      schemaVersion: 1,
      kind: 'DEPLOYMENT_REHEARSAL',
      nonProduction: true,
      productionTrafficCutover: false,
      authority: betaReadinessNoAuthorityConsequences
    },
    {
      schemaVersion: 1,
      kind: 'BETA_RELEASE_CANDIDATE',
      released: false,
      ownerAuthorizationRequired: true,
      authority: betaReadinessNoAuthorityConsequences
    },
    {
      schemaVersion: 1,
      kind: 'AUTOMATED_GATE',
      greenGateAuthorizesRelease: false,
      ownerAuthorizationRequired: true,
      authority: betaReadinessNoAuthorityConsequences
    }
  ] as const
}) satisfies Readonly<{
  name: string;
  boundaries: ReadonlyArray<Readonly<BetaReadinessBoundary>>;
}>;

export const productConversionAnalyticsSourceKinds = [
  'CONTENT_OPPORTUNITY',
  'CONTENT_DRAFT',
  'CONTENT_REVIEW_DECISION',
  'PUBLISH_PACKAGE',
  'CONTENT_USE_FEEDBACK',
  'OPPORTUNITY_CANDIDATE',
  'OPPORTUNITY_QUALIFICATION_DECISION',
  'PREPARED_ACTION_HANDOFF_RESULT'
] as const;
export type ProductConversionAnalyticsSourceKind =
  (typeof productConversionAnalyticsSourceKinds)[number];

export interface ProductConversionAnalyticsSourceFamily {
  schemaVersion: 1;
  owner: 'LITE';
  kind: ProductConversionAnalyticsSourceKind;
  provenance: 'DURABLE_OWNER_STATE';
  downstreamOwner?: 'MARKREG';
}

export const productConversionAnalyticsSourceFamilies = Object.freeze([
  { schemaVersion: 1, owner: 'LITE', kind: 'CONTENT_OPPORTUNITY', provenance: 'DURABLE_OWNER_STATE' },
  { schemaVersion: 1, owner: 'LITE', kind: 'CONTENT_DRAFT', provenance: 'DURABLE_OWNER_STATE' },
  {
    schemaVersion: 1,
    owner: 'LITE',
    kind: 'CONTENT_REVIEW_DECISION',
    provenance: 'DURABLE_OWNER_STATE'
  },
  { schemaVersion: 1, owner: 'LITE', kind: 'PUBLISH_PACKAGE', provenance: 'DURABLE_OWNER_STATE' },
  { schemaVersion: 1, owner: 'LITE', kind: 'CONTENT_USE_FEEDBACK', provenance: 'DURABLE_OWNER_STATE' },
  { schemaVersion: 1, owner: 'LITE', kind: 'OPPORTUNITY_CANDIDATE', provenance: 'DURABLE_OWNER_STATE' },
  {
    schemaVersion: 1,
    owner: 'LITE',
    kind: 'OPPORTUNITY_QUALIFICATION_DECISION',
    provenance: 'DURABLE_OWNER_STATE'
  },
  {
    schemaVersion: 1,
    owner: 'LITE',
    kind: 'PREPARED_ACTION_HANDOFF_RESULT',
    provenance: 'DURABLE_OWNER_STATE',
    downstreamOwner: 'MARKREG'
  }
] as const satisfies ReadonlyArray<Readonly<ProductConversionAnalyticsSourceFamily>>);

export interface ProductConversionRate {
  numerator: number;
  denominator: number;
  rate: number | null;
}

export interface ContentConversionFunnel {
  contentOpportunities: number;
  draftPrepared: number;
  humanReviewRecorded: number;
  publishPackagesPrepared: number;
  userReportedUseFeedback: number;
  rates: Readonly<{
    opportunityToDraft: Readonly<ProductConversionRate>;
    draftToHumanReview: Readonly<ProductConversionRate>;
    humanReviewToPublishPackage: Readonly<ProductConversionRate>;
    publishPackageToUseFeedback: Readonly<ProductConversionRate>;
  }>;
}

export interface OpportunityConversionFunnel {
  opportunityCandidates: number;
  qualificationDecisions: number;
  qualifiedForMarkReg: number;
  formalOpportunityHandoffResults: number;
  rates: Readonly<{
    candidateToQualification: Readonly<ProductConversionRate>;
    qualificationToQualified: Readonly<ProductConversionRate>;
    qualifiedToFormalOpportunityHandoff: Readonly<ProductConversionRate>;
  }>;
}

export interface ProductLoopConversionAnalyticsSnapshot {
  schemaVersion: 1;
  workspaceId: string;
  owner: 'LITE';
  scope: 'WORKSPACE_ALL_TIME';
  generatedAt: string;
  sourceFamilies: ReadonlyArray<Readonly<ProductConversionAnalyticsSourceFamily>>;
  content: Readonly<ContentConversionFunnel>;
  opportunity: Readonly<OpportunityConversionFunnel>;
  crossOwnerEvidence: Readonly<{
    evidenceOwner: 'LITE';
    downstreamOwner: 'MARKREG';
    sourceKind: 'PREPARED_ACTION_HANDOFF_RESULT';
    directMarkRegQueryPerformed: false;
  }>;
  observationalOnly: true;
  mutatesBusinessState: false;
  userReportedExternalUseVerified: false;
  authority: Readonly<BetaReadinessAuthorityConsequences>;
}
