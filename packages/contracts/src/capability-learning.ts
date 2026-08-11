export type RuntimeCapabilityDefinitionId = `runtime-capability_${string}`;
export type CapabilityObservationId = `capability-observation_${string}`;
export type CapabilityLedgerEntryId = `capability-ledger_${string}`;
export type ReflectionCandidateId = `reflection-candidate_${string}`;
export type ReflectionDispositionId = `reflection-disposition_${string}`;
export type CapabilityProfileProjectionId = `capability-profile_${string}`;
export type CapabilityTwinProjectionId = `capability-twin_${string}`;

export const capabilityObservationSourceOwners = ['EXECUTION', 'MARKREG'] as const;
export type CapabilityObservationSourceOwner = (typeof capabilityObservationSourceOwners)[number];

export const capabilityObservationSourceKinds = [
  'EXECUTION_PROFESSIONAL_REVIEW_DECISION',
  'EXECUTION_EVIDENCE_REVIEW_DECISION',
  'MARKREG_REVIEWED_LIFECYCLE_SOURCE'
] as const;
export type CapabilityObservationSourceKind = (typeof capabilityObservationSourceKinds)[number];

export const reflectionDispositionOutcomes = ['ACCEPTED', 'REJECTED', 'DEFERRED'] as const;
export type ReflectionDispositionOutcome = (typeof reflectionDispositionOutcomes)[number];

export interface CapabilityLearningAuthorityConsequences {
  canonicalTruth: false;
  capabilityVerified: false;
  publicProfilePublished: false;
  publicScoreCreated: false;
  permissionChanged: false;
  roleChanged: false;
  providerSupplyCapabilityConverted: false;
  rawProviderReturnConverted: false;
  paymentOrInvoiceCreated: false;
  legalAppointmentCreated: false;
  filingSubmitted: false;
  officialTruthCreated: false;
  externalActionExecuted: false;
}

export const capabilityLearningNoAuthorityConsequences = Object.freeze({
  canonicalTruth: false,
  capabilityVerified: false,
  publicProfilePublished: false,
  publicScoreCreated: false,
  permissionChanged: false,
  roleChanged: false,
  providerSupplyCapabilityConverted: false,
  rawProviderReturnConverted: false,
  paymentOrInvoiceCreated: false,
  legalAppointmentCreated: false,
  filingSubmitted: false,
  officialTruthCreated: false,
  externalActionExecuted: false
}) satisfies Readonly<CapabilityLearningAuthorityConsequences>;

export interface CapabilityCanonReference {
  canonId: string;
  canonVersion: string;
  sourceFingerprintSha256: string;
}

export interface RuntimeCapabilityLineage {
  domainId?: string;
  capabilityId: string;
  skillId?: string;
  actionId?: string;
  invocationId?: string;
}

export interface RuntimeCapabilityDefinition {
  schemaVersion: 1;
  runtimeCapabilityDefinitionId: RuntimeCapabilityDefinitionId;
  version: number;
  capabilityId: string;
  capabilityVersion: string;
  title: string;
  description: string;
  lineage: Readonly<RuntimeCapabilityLineage>;
  canonReference: Readonly<CapabilityCanonReference>;
  acceptedCanonProjection: true;
  createdFromWorkEvidence: false;
  createdFromAiOutput: false;
  createdAt: string;
}

export interface CapabilityObservationSourceReference {
  owner: CapabilityObservationSourceOwner;
  kind: CapabilityObservationSourceKind;
  sourceId: string;
  sourceVersion: string | number;
  sourceFingerprintSha256: string;
  observedAt: string;
  workspaceId: string;
  subjectUserId: string;
  correlationId?: string;
}

export interface CapabilityObservation {
  schemaVersion: 1;
  capabilityObservationId: CapabilityObservationId;
  workspaceId: string;
  subjectUserId: string;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
  }>;
  source: Readonly<CapabilityObservationSourceReference>;
  subjectAttributionAuthority: 'OWNER_SOURCE' | 'CORE_PRINCIPAL_RELATIONSHIP';
  observationNature: 'PRIVATE_GOVERNED_WORK_OBSERVATION';
  admittedAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}

export interface CapabilityLedgerEntry {
  schemaVersion: 1;
  capabilityLedgerEntryId: CapabilityLedgerEntryId;
  workspaceId: string;
  subjectUserId: string;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
  }>;
  observation: Readonly<{
    id: CapabilityObservationId;
    sourceOwner: CapabilityObservationSourceOwner;
    sourceKind: CapabilityObservationSourceKind;
    sourceId: string;
    sourceVersion: string | number;
    sourceFingerprintSha256: string;
  }>;
  appendOnly: true;
  private: true;
  recordedAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}

export interface ReflectionGenerationProvenance {
  policyVersion: string;
  model?: Readonly<{
    provider: string;
    model: string;
    modelVersion: string;
    promptVersion: string;
  }>;
}

export interface ReflectionCandidate {
  schemaVersion: 1;
  reflectionCandidateId: ReflectionCandidateId;
  workspaceId: string;
  subjectUserId: string;
  version: number;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
  }>;
  ledgerEntries: ReadonlyArray<
    Readonly<{
      id: CapabilityLedgerEntryId;
      sourceFingerprintSha256: string;
    }>
  >;
  explanation: string;
  proposedPrivateReflection: string;
  generation: Readonly<ReflectionGenerationProvenance>;
  status: 'PENDING';
  private: true;
  createdAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}

export interface ReflectionDisposition {
  schemaVersion: 1;
  reflectionDispositionId: ReflectionDispositionId;
  workspaceId: string;
  subjectUserId: string;
  candidate: Readonly<{
    id: ReflectionCandidateId;
    version: number;
    fingerprintSha256: string;
  }>;
  outcome: ReflectionDispositionOutcome;
  decidedBySubjectUserId: string;
  rationale?: string;
  decidedAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}

export interface AcceptedPrivateReflectionReference {
  candidateId: ReflectionCandidateId;
  candidateVersion: number;
  dispositionId: ReflectionDispositionId;
  acceptedAt: string;
  text: string;
}

export interface CapabilityProfileProjection {
  schemaVersion: 1;
  capabilityProfileProjectionId: CapabilityProfileProjectionId;
  workspaceId: string;
  subjectUserId: string;
  version: number;
  runtimeCapability: Readonly<{
    id: RuntimeCapabilityDefinitionId;
    version: number;
  }>;
  evidenceCount: number;
  latestEvidenceAt?: string;
  acceptedReflections: ReadonlyArray<Readonly<AcceptedPrivateReflectionReference>>;
  outstandingReflectionCandidate?: Readonly<{
    id: ReflectionCandidateId;
    version: number;
  }>;
  visibility: 'PRIVATE';
  numericProfessionalScore: null;
  verifiedBadge: false;
  generatedAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}

export interface CapabilityTwinProjection {
  schemaVersion: 1;
  capabilityTwinProjectionId: CapabilityTwinProjectionId;
  workspaceId: string;
  subjectUserId: string;
  version: number;
  profile: Readonly<{
    id: CapabilityProfileProjectionId;
    version: number;
  }>;
  capabilitySummaries: ReadonlyArray<
    Readonly<{
      runtimeCapabilityDefinitionId: RuntimeCapabilityDefinitionId;
      runtimeCapabilityVersion: number;
      evidenceCount: number;
      latestEvidenceAt?: string;
      acceptedPrivateReflection?: string;
    }>
  >;
  visibility: 'PRIVATE';
  autonomousIdentity: false;
  autonomousExecutionAuthority: false;
  generatedAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}

export interface CapabilityLearningAuthorityFixture {
  name: string;
  observedEvidence: Readonly<CapabilityLearningAuthorityConsequences>;
  reflectionCandidate: Readonly<CapabilityLearningAuthorityConsequences>;
  acceptedPrivateReflection: Readonly<CapabilityLearningAuthorityConsequences>;
}

export const capabilityLearningAuthorityFixture = Object.freeze({
  name: 'M6-WP-01 private capability learning authority lock',
  observedEvidence: capabilityLearningNoAuthorityConsequences,
  reflectionCandidate: capabilityLearningNoAuthorityConsequences,
  acceptedPrivateReflection: capabilityLearningNoAuthorityConsequences
}) satisfies Readonly<CapabilityLearningAuthorityFixture>;
