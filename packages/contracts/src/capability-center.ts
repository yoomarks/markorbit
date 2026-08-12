import type {
  CapabilityLearningAuthorityConsequences,
  CapabilityLedgerEntry,
  CapabilityProfileProjection,
  CapabilityTwinProjection,
  ReflectionCandidate
} from './capability-learning.js';

export interface CapabilityCenterPendingCandidate {
  candidate: Readonly<ReflectionCandidate>;
  candidateFingerprintSha256: string;
}

/**
 * Private subject-scoped browser read model for M6-WP-06.
 *
 * Capability Engine remains the semantic owner. Gateway may aggregate/transport this
 * exact view and Lite may render/action it, but neither may promote it into verified,
 * canonical, public or autonomous authority.
 */
export interface CapabilityCenterView {
  schemaVersion: 1;
  workspaceId: string;
  subjectUserId: string;
  ledgerEntries: ReadonlyArray<Readonly<CapabilityLedgerEntry>>;
  profiles: ReadonlyArray<Readonly<CapabilityProfileProjection>>;
  twin: Readonly<CapabilityTwinProjection> | null;
  pendingCandidates: ReadonlyArray<Readonly<CapabilityCenterPendingCandidate>>;
  visibility: 'PRIVATE';
  generatedAt: string;
  authority: Readonly<CapabilityLearningAuthorityConsequences>;
}
