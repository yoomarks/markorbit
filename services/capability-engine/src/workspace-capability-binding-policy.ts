import type { WorkspaceTrademarkIssueIntelligenceReadinessV1 } from './workspace-trademark-issue-intelligence-readiness.js';

export interface WorkspaceCapabilityBindingPolicyTargetV1 {
  policyId: string;
  policyVersion: string;
  ruleId: string;
  reason: string;
  capabilityId: string;
  capabilityVersion: string;
}

export interface WorkspaceCapabilityBindingPolicyV1 {
  resolve(
    readiness: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>
  ): Promise<Readonly<WorkspaceCapabilityBindingPolicyTargetV1> | undefined>;
}

export interface WorkspaceCapabilityBindingPolicyRuleV1 extends WorkspaceCapabilityBindingPolicyTargetV1 {
  task: 'TRADEMARK_ISSUE_EXTRACTION';
  interpreterProfileId?: string;
}

export type WorkspaceCapabilityBindingPolicyErrorCode = 'INVALID_POLICY' | 'AMBIGUOUS_POLICY';

export class WorkspaceCapabilityBindingPolicyError extends Error {
  constructor(
    readonly code: WorkspaceCapabilityBindingPolicyErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WorkspaceCapabilityBindingPolicyError';
  }
}

function canonicalText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string')
    throw new WorkspaceCapabilityBindingPolicyError('INVALID_POLICY', `${field} must be a string.`);
  const cleaned = value.trim();
  if (!cleaned || cleaned !== value || cleaned.length > maximum)
    throw new WorkspaceCapabilityBindingPolicyError(
      'INVALID_POLICY',
      `${field} must contain canonical text.`
    );
  return cleaned;
}

function normalizeRule(
  rule: Readonly<WorkspaceCapabilityBindingPolicyRuleV1>
): WorkspaceCapabilityBindingPolicyRuleV1 {
  if (rule.task !== 'TRADEMARK_ISSUE_EXTRACTION')
    throw new WorkspaceCapabilityBindingPolicyError(
      'INVALID_POLICY',
      'Only the governed trademark issue task is supported by WIF-05.'
    );
  return {
    policyId: canonicalText(rule.policyId, 'policyId', 300),
    policyVersion: canonicalText(rule.policyVersion, 'policyVersion', 120),
    ruleId: canonicalText(rule.ruleId, 'ruleId', 300),
    reason: canonicalText(rule.reason, 'reason', 2000),
    capabilityId: canonicalText(rule.capabilityId, 'capabilityId', 300),
    capabilityVersion: canonicalText(rule.capabilityVersion, 'capabilityVersion', 120),
    task: 'TRADEMARK_ISSUE_EXTRACTION',
    ...(rule.interpreterProfileId === undefined
      ? {}
      : {
          interpreterProfileId: canonicalText(
            rule.interpreterProfileId,
            'interpreterProfileId',
            300
          )
        })
  };
}

export class StaticWorkspaceCapabilityBindingPolicyV1 implements WorkspaceCapabilityBindingPolicyV1 {
  private readonly rules: readonly WorkspaceCapabilityBindingPolicyRuleV1[];

  constructor(rules: readonly Readonly<WorkspaceCapabilityBindingPolicyRuleV1>[] = []) {
    this.rules = rules.map(normalizeRule);
    const ids = this.rules.map((rule) => `${rule.policyId}:${rule.policyVersion}:${rule.ruleId}`);
    if (new Set(ids).size !== ids.length)
      throw new WorkspaceCapabilityBindingPolicyError(
        'INVALID_POLICY',
        'Workspace Capability binding policy rule identities must be unique.'
      );
  }

  resolve(
    readiness: Readonly<WorkspaceTrademarkIssueIntelligenceReadinessV1>
  ): Promise<Readonly<WorkspaceCapabilityBindingPolicyTargetV1> | undefined> {
    if (!readiness.ready || readiness.status !== 'READY_FOR_CAPABILITY_BINDING')
      return Promise.resolve(undefined);
    const intelligence = readiness.intelligence;
    if (!intelligence) return Promise.resolve(undefined);
    const matches = this.rules.filter(
      (rule) =>
        rule.task === intelligence.task &&
        (rule.interpreterProfileId === undefined ||
          rule.interpreterProfileId === intelligence.interpreter.profileId)
    );
    if (matches.length > 1)
      throw new WorkspaceCapabilityBindingPolicyError(
        'AMBIGUOUS_POLICY',
        'Multiple server-governed Workspace Capability binding rules match the same Brain intelligence.'
      );
    const match = matches[0];
    if (!match) return Promise.resolve(undefined);
    return Promise.resolve({
      policyId: match.policyId,
      policyVersion: match.policyVersion,
      ruleId: match.ruleId,
      reason: match.reason,
      capabilityId: match.capabilityId,
      capabilityVersion: match.capabilityVersion
    });
  }
}

export const productionWorkspaceCapabilityBindingPolicyV1 =
  new StaticWorkspaceCapabilityBindingPolicyV1([]);
