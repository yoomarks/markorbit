export type VersionedIdentity = Readonly<{ id: string; version: string | number }>;
export type MilestoneLineageKey =
  | 'plan'
  | 'quote'
  | 'matterDraft'
  | 'professionalReviewCase'
  | 'reviewDecision'
  | 'documentPackage'
  | 'instructionLedger'
  | 'preparationLock'
  | 'filingAuthorization'
  | 'executionRelease';

export class MilestoneLineageRecorder {
  readonly scenarioId = 'milestone-001-golden-path';
  readonly versioned = new Map<MilestoneLineageKey, VersionedIdentity>();
  readonly identities = new Map<'customerConfirmation' | 'filingExecutionTaskDraft', string>();
  record(key: MilestoneLineageKey, identity: VersionedIdentity) {
    if (!identity.id || identity.version === '') throw new Error(`Incomplete ${key} lineage.`);
    this.versioned.set(key, Object.freeze({ ...identity }));
    return identity;
  }
  recordIdentity(key: 'customerConfirmation' | 'filingExecutionTaskDraft', id: string) {
    if (!id) throw new Error(`Incomplete ${key} lineage.`);
    this.identities.set(key, id);
    return id;
  }
  require(key: MilestoneLineageKey) {
    const value = this.versioned.get(key);
    if (!value) throw new Error(`Missing ${key} lineage.`);
    return value;
  }
}
