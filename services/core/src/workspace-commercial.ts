import { WORKSPACE_PRODUCT_KEYS } from '@markorbit/contracts/workspace-commercial';
import type {
  AppliedRateSnapshotV1,
  AssignableBenefitDefinitionV1,
  AssignableEntitlementGrantV1,
  CommercialAgreementV1,
  CommercialOfferVersionV1,
  CommercialSubjectRefV1,
  EntitlementGrantAssignmentV1,
  EntitlementGrantV1,
  EntitlementDefinitionV1,
  EntitlementValueV1,
  RatePolicyApplicabilityV1,
  RatePolicyKindV1,
  RatePolicyVersionV1,
  ResolvedEntitlementV1,
  WorkspaceProductInstallationV1
} from '@markorbit/contracts/workspace-commercial';

export type WorkspaceCommercialErrorCode =
  | 'INVALID_INPUT'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'NOT_ACTIVE'
  | 'MEMBERSHIP_REQUIRED'
  | 'CAPACITY_EXCEEDED'
  | 'NO_APPLICABLE_ENTITLEMENT'
  | 'NO_APPLICABLE_RATE'
  | 'AMBIGUOUS_RATE';

export class WorkspaceCommercialError extends Error {
  constructor(
    readonly code: WorkspaceCommercialErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'WorkspaceCommercialError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
const key = (...parts: readonly (string | number)[]) => parts.join(':');

function instant(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed))
    throw new WorkspaceCommercialError('INVALID_INPUT', `${field} must be an ISO date/time.`);
  return parsed;
}

function activeAt(
  value: Readonly<{ effectiveFrom: string; effectiveTo?: string }>,
  at: number
): boolean {
  return (
    instant(value.effectiveFrom, 'effectiveFrom') <= at &&
    (!value.effectiveTo || at < instant(value.effectiveTo, 'effectiveTo'))
  );
}

function subjectKey(subject: CommercialSubjectRefV1): string {
  return subject.scope === 'USER' ? `USER:${subject.userId}` : `WORKSPACE:${subject.workspaceId}`;
}

function sameSubject(left: CommercialSubjectRefV1, right: CommercialSubjectRefV1): boolean {
  return subjectKey(left) === subjectKey(right);
}

function applicabilityKey(value: RatePolicyApplicabilityV1): string {
  return JSON.stringify(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
  );
}

function assertVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1)
    throw new WorkspaceCommercialError('INVALID_INPUT', 'version must be a positive integer.');
}

function assertWindow(value: Readonly<{ effectiveFrom: string; effectiveTo?: string }>): void {
  const from = instant(value.effectiveFrom, 'effectiveFrom');
  if (value.effectiveTo && instant(value.effectiveTo, 'effectiveTo') <= from)
    throw new WorkspaceCommercialError('INVALID_INPUT', 'effectiveTo must be after effectiveFrom.');
}

function latestVersionsAt<T extends Readonly<{ version: number; recordedAt: string }>>(
  values: readonly T[],
  id: (value: T) => string,
  at: number
): readonly T[] {
  const latest = new Map<string, T>();
  for (const value of values) {
    if (instant(value.recordedAt, 'recordedAt') > at) continue;
    const prior = latest.get(id(value));
    if (!prior || prior.version < value.version) latest.set(id(value), value);
  }
  return [...latest.values()];
}

export interface WorkspaceCommercialRepositoryV1 {
  appendInstallation(value: WorkspaceProductInstallationV1): Promise<void>;
  listInstallations(workspaceId: string): Promise<readonly WorkspaceProductInstallationV1[]>;
  appendOffer(value: CommercialOfferVersionV1): Promise<void>;
  getOffer(offerId: string, version: number): Promise<CommercialOfferVersionV1 | undefined>;
  appendAgreement(value: CommercialAgreementV1): Promise<void>;
  listAgreementVersions(agreementId: string): Promise<readonly CommercialAgreementV1[]>;
  appendGrant(value: EntitlementGrantV1): Promise<void>;
  listGrants(): Promise<readonly EntitlementGrantV1[]>;
  appendAssignableGrant(value: AssignableEntitlementGrantV1): Promise<void>;
  listAssignableGrantVersions(
    assignableGrantId: string
  ): Promise<readonly AssignableEntitlementGrantV1[]>;
  appendAssignment(value: EntitlementGrantAssignmentV1): Promise<void>;
  listAssignments(assignableGrantId?: string): Promise<readonly EntitlementGrantAssignmentV1[]>;
  appendRatePolicy(value: RatePolicyVersionV1): Promise<void>;
  listRatePolicies(kind: RatePolicyKindV1): Promise<readonly RatePolicyVersionV1[]>;
}

export class InMemoryWorkspaceCommercialRepositoryV1 implements WorkspaceCommercialRepositoryV1 {
  private readonly installations = new Map<string, WorkspaceProductInstallationV1>();
  private readonly offers = new Map<string, CommercialOfferVersionV1>();
  private readonly agreements = new Map<string, CommercialAgreementV1>();
  private readonly grants = new Map<string, EntitlementGrantV1>();
  private readonly assignableGrants = new Map<string, AssignableEntitlementGrantV1>();
  private readonly assignments = new Map<string, EntitlementGrantAssignmentV1>();
  private readonly rates = new Map<string, RatePolicyVersionV1>();

  private append<T>(map: Map<string, T>, id: string, version: number, value: T): void {
    const storageKey = key(id, version);
    if (map.has(storageKey))
      throw new WorkspaceCommercialError('CONFLICT', `${storageKey} exists.`);
    map.set(storageKey, clone(value));
  }
  appendInstallation(value: WorkspaceProductInstallationV1): Promise<void> {
    this.append(this.installations, value.installationId, value.version, value);
    return Promise.resolve();
  }
  listInstallations(workspaceId: string): Promise<readonly WorkspaceProductInstallationV1[]> {
    return Promise.resolve(
      [...this.installations.values()].filter((v) => v.workspaceId === workspaceId).map(clone)
    );
  }
  appendOffer(value: CommercialOfferVersionV1): Promise<void> {
    this.append(this.offers, value.offerId, value.version, value);
    return Promise.resolve();
  }
  getOffer(offerId: string, version: number): Promise<CommercialOfferVersionV1 | undefined> {
    const v = this.offers.get(key(offerId, version));
    return Promise.resolve(v && clone(v));
  }
  appendAgreement(value: CommercialAgreementV1): Promise<void> {
    this.append(this.agreements, value.agreementId, value.version, value);
    return Promise.resolve();
  }
  listAgreementVersions(agreementId: string): Promise<readonly CommercialAgreementV1[]> {
    return Promise.resolve(
      [...this.agreements.values()].filter((v) => v.agreementId === agreementId).map(clone)
    );
  }
  appendGrant(value: EntitlementGrantV1): Promise<void> {
    this.append(this.grants, value.grantId, value.version, value);
    return Promise.resolve();
  }
  listGrants(): Promise<readonly EntitlementGrantV1[]> {
    return Promise.resolve([...this.grants.values()].map(clone));
  }
  appendAssignableGrant(value: AssignableEntitlementGrantV1): Promise<void> {
    this.append(this.assignableGrants, value.assignableGrantId, value.version, value);
    return Promise.resolve();
  }
  listAssignableGrantVersions(
    assignableGrantId: string
  ): Promise<readonly AssignableEntitlementGrantV1[]> {
    return Promise.resolve(
      [...this.assignableGrants.values()]
        .filter((v) => v.assignableGrantId === assignableGrantId)
        .map(clone)
    );
  }
  appendAssignment(value: EntitlementGrantAssignmentV1): Promise<void> {
    this.append(this.assignments, value.assignmentId, value.version, value);
    return Promise.resolve();
  }
  listAssignments(assignableGrantId?: string): Promise<readonly EntitlementGrantAssignmentV1[]> {
    return Promise.resolve(
      [...this.assignments.values()]
        .filter((v) => !assignableGrantId || v.assignableGrantId === assignableGrantId)
        .map(clone)
    );
  }
  appendRatePolicy(value: RatePolicyVersionV1): Promise<void> {
    this.append(this.rates, value.policyId, value.version, value);
    return Promise.resolve();
  }
  listRatePolicies(kind: RatePolicyKindV1): Promise<readonly RatePolicyVersionV1[]> {
    return Promise.resolve([...this.rates.values()].filter((v) => v.kind === kind).map(clone));
  }
}

export interface ActiveMembershipV1 {
  membershipId: string;
  workspaceId: string;
  userId: string;
  status: 'ACTIVE' | 'SUSPENDED';
}

export class WorkspaceCommercialServiceV1 {
  constructor(
    private readonly repository: WorkspaceCommercialRepositoryV1,
    private readonly resolveMembership: (
      membershipId: string
    ) => Promise<ActiveMembershipV1 | undefined>
  ) {}

  async recordInstallation(
    value: WorkspaceProductInstallationV1
  ): Promise<WorkspaceProductInstallationV1> {
    assertVersion(value.version);
    assertWindow({ effectiveFrom: value.effectiveAt });
    const current = (await this.repository.listInstallations(value.workspaceId))
      .filter((v) => v.productKey === value.productKey)
      .sort((a, b) => b.version - a.version)[0];
    if (value.version !== (current?.version ?? 0) + 1)
      throw new WorkspaceCommercialError('CONFLICT', 'Installation version is not current.');
    await this.repository.appendInstallation(clone(value));
    return clone(value);
  }

  async listCurrentInstallations(
    workspaceId: string
  ): Promise<readonly WorkspaceProductInstallationV1[]> {
    const current = new Map<string, WorkspaceProductInstallationV1>();
    for (const value of await this.repository.listInstallations(workspaceId)) {
      const prior = current.get(value.productKey);
      if (!prior || prior.version < value.version) current.set(value.productKey, value);
    }
    return [...current.values()].filter((v) => v.status !== 'DECOMMISSIONED').map(clone);
  }

  async recordOffer(value: CommercialOfferVersionV1): Promise<CommercialOfferVersionV1> {
    const entitlements: readonly EntitlementDefinitionV1[] = value?.entitlements;
    const assignableBenefits: readonly AssignableBenefitDefinitionV1[] = value?.assignableBenefits;
    if (
      value?.schemaVersion !== 1 ||
      typeof value.offerId !== 'string' ||
      !value.offerId.trim() ||
      typeof value.sku !== 'string' ||
      !value.sku.trim() ||
      typeof value.displayName !== 'string' ||
      !value.displayName.trim() ||
      !['USER', 'WORKSPACE'].includes(value.subjectScope) ||
      !(WORKSPACE_PRODUCT_KEYS as readonly string[]).includes(value.productKey) ||
      !['NONE', 'MONTH', 'YEAR', 'CUSTOM'].includes(value.billingInterval) ||
      !['DRAFT', 'PUBLISHED', 'RETIRED'].includes(value.lifecycle) ||
      !Array.isArray(value.entitlements) ||
      !Array.isArray(value.assignableBenefits)
    )
      throw new WorkspaceCommercialError('INVALID_INPUT', 'Offer shape is invalid.');
    assertVersion(value.version);
    assertWindow(value);
    instant(value.recordedAt, 'recordedAt');
    if (
      !Number.isSafeInteger(value.amountMinor) ||
      value.amountMinor < 0 ||
      !/^[A-Z]{3}$/u.test(value.currency)
    )
      throw new WorkspaceCommercialError(
        'INVALID_INPUT',
        'Offer money must be non-negative with uppercase currency.'
      );
    if (entitlements.some((e) => e.subjectScope !== value.subjectScope))
      throw new WorkspaceCommercialError(
        'INVALID_INPUT',
        'Offer entitlement scope must match offer scope.'
      );
    if (
      assignableBenefits.some(
        (b) =>
          b.capacity < 1 ||
          b.entitlements.some((e: EntitlementDefinitionV1) => e.subjectScope !== 'USER')
      )
    )
      throw new WorkspaceCommercialError(
        'INVALID_INPUT',
        'Assignable benefits must be positive and USER scoped.'
      );
    await this.repository.appendOffer(clone(value));
    return clone(value);
  }

  async recordAgreement(value: CommercialAgreementV1): Promise<CommercialAgreementV1> {
    assertVersion(value.version);
    assertWindow(value);
    const offer = await this.repository.getOffer(value.offerId, value.offerVersion);
    if (!offer) throw new WorkspaceCommercialError('NOT_FOUND', 'Offer version does not exist.');
    if (offer.subjectScope !== value.subject.scope)
      throw new WorkspaceCommercialError(
        'INVALID_INPUT',
        'Agreement subject does not match offer scope.'
      );
    const versions = await this.repository.listAgreementVersions(value.agreementId);
    if (value.version !== Math.max(0, ...versions.map((v) => v.version)) + 1)
      throw new WorkspaceCommercialError('CONFLICT', 'Agreement version is not current.');
    await this.repository.appendAgreement(clone(value));
    if (value.version > 1 && value.status !== 'ACTIVE') {
      const grantStatus =
        value.status === 'SUSPENDED'
          ? ('SUSPENDED' as const)
          : value.status === 'EXPIRED'
            ? ('EXPIRED' as const)
            : value.status === 'CANCELLED'
              ? ('REVOKED' as const)
              : ('PENDING' as const);
      const latestGrants = new Map<string, EntitlementGrantV1>();
      for (const grant of await this.repository.listGrants()) {
        if (!grant.sourceRef.startsWith(`${value.agreementId}:`)) continue;
        const prior = latestGrants.get(grant.grantId);
        if (!prior || prior.version < grant.version) latestGrants.set(grant.grantId, grant);
      }
      for (const grant of latestGrants.values())
        await this.repository.appendGrant({
          ...grant,
          version: grant.version + 1,
          status: grantStatus,
          ...(value.effectiveTo ? { effectiveTo: value.effectiveTo } : {}),
          recordedAt: value.recordedAt
        });
      for (const [index] of offer.assignableBenefits.entries()) {
        const assignableGrantId = `assignable_${value.agreementId}_${index + 1}`;
        const versions = await this.repository.listAssignableGrantVersions(assignableGrantId);
        const grant = [...versions].sort((a, b) => b.version - a.version)[0];
        if (!grant) continue;
        const assignableStatus =
          value.status === 'SUSPENDED'
            ? ('SUSPENDED' as const)
            : value.status === 'EXPIRED'
              ? ('EXPIRED' as const)
              : value.status === 'CANCELLED'
                ? ('REVOKED' as const)
                : ('SUSPENDED' as const);
        await this.repository.appendAssignableGrant({
          ...grant,
          version: grant.version + 1,
          status: assignableStatus,
          ...(value.effectiveTo ? { effectiveTo: value.effectiveTo } : {}),
          recordedAt: value.recordedAt
        });
        const latestAssignments = new Map<string, EntitlementGrantAssignmentV1>();
        for (const assignment of await this.repository.listAssignments(assignableGrantId)) {
          const prior = latestAssignments.get(assignment.assignmentId);
          if (!prior || prior.version < assignment.version)
            latestAssignments.set(assignment.assignmentId, assignment);
        }
        for (const assignment of latestAssignments.values()) {
          if (assignment.status !== 'ACTIVE') continue;
          await this.repository.appendAssignment({
            ...assignment,
            version: assignment.version + 1,
            status: value.status === 'EXPIRED' ? 'EXPIRED' : 'REVOKED',
            effectiveTo: value.recordedAt,
            recordedAt: value.recordedAt
          });
        }
      }
    }
    return clone(value);
  }

  async materializeActiveAgreement(agreementId: string): Promise<
    Readonly<{
      grants: readonly EntitlementGrantV1[];
      assignableGrants: readonly AssignableEntitlementGrantV1[];
    }>
  > {
    const agreement = [...(await this.repository.listAgreementVersions(agreementId))].sort(
      (a, b) => b.version - a.version
    )[0];
    if (!agreement) throw new WorkspaceCommercialError('NOT_FOUND', 'Agreement does not exist.');
    if (agreement.status !== 'ACTIVE')
      throw new WorkspaceCommercialError('NOT_ACTIVE', 'Agreement is not ACTIVE.');
    const offer = await this.repository.getOffer(agreement.offerId, agreement.offerVersion);
    if (!offer || offer.lifecycle !== 'PUBLISHED')
      throw new WorkspaceCommercialError('NOT_ACTIVE', 'Agreement offer version is not PUBLISHED.');
    const grants: EntitlementGrantV1[] = [];
    for (const [index, entitlement] of offer.entitlements.entries()) {
      const grant: EntitlementGrantV1 = {
        schemaVersion: 1,
        grantId: `grant_${agreement.agreementId}_${index + 1}`,
        version: 1,
        subject: clone(agreement.subject),
        entitlement: clone(entitlement),
        status: 'ACTIVE',
        sourceType: 'AGREEMENT',
        sourceRef: `${agreement.agreementId}:${agreement.version}`,
        effectiveFrom: agreement.effectiveFrom,
        ...(agreement.effectiveTo ? { effectiveTo: agreement.effectiveTo } : {}),
        recordedAt: agreement.recordedAt
      };
      await this.repository.appendGrant(grant);
      grants.push(grant);
    }
    const assignableGrants: AssignableEntitlementGrantV1[] = [];
    if (agreement.subject.scope === 'WORKSPACE')
      for (const [index, benefit] of offer.assignableBenefits.entries()) {
        const grant: AssignableEntitlementGrantV1 = {
          schemaVersion: 1,
          assignableGrantId: `assignable_${agreement.agreementId}_${index + 1}`,
          version: 1,
          sponsorWorkspaceId: agreement.subject.workspaceId,
          sourceAgreementId: agreement.agreementId,
          benefitKey: benefit.benefitKey,
          capacity: benefit.capacity,
          entitlements: clone(benefit.entitlements),
          status: 'AVAILABLE',
          effectiveFrom: agreement.effectiveFrom,
          ...(agreement.effectiveTo ? { effectiveTo: agreement.effectiveTo } : {}),
          recordedAt: agreement.recordedAt
        };
        await this.repository.appendAssignableGrant(grant);
        assignableGrants.push(grant);
      }
    return clone({ grants, assignableGrants });
  }

  async assignBenefit(
    input: Readonly<{
      assignmentId: string;
      assignableGrantId: string;
      membershipId: string;
      effectiveFrom: string;
      recordedAt: string;
    }>
  ): Promise<EntitlementGrantAssignmentV1> {
    instant(input.effectiveFrom, 'effectiveFrom');
    instant(input.recordedAt, 'recordedAt');
    const grant = [
      ...(await this.repository.listAssignableGrantVersions(input.assignableGrantId))
    ].sort((a, b) => b.version - a.version)[0];
    if (!grant || !['AVAILABLE', 'ASSIGNED'].includes(grant.status))
      throw new WorkspaceCommercialError('NOT_ACTIVE', 'Assignable grant is not available.');
    const membership = await this.resolveMembership(input.membershipId);
    if (
      !membership ||
      membership.status !== 'ACTIVE' ||
      membership.workspaceId !== grant.sponsorWorkspaceId
    )
      throw new WorkspaceCommercialError(
        'MEMBERSHIP_REQUIRED',
        'An active membership in the sponsor Workspace is required.'
      );
    const all = await this.repository.listAssignments(grant.assignableGrantId);
    const latestById = new Map<string, EntitlementGrantAssignmentV1>();
    for (const value of all)
      if (
        !latestById.get(value.assignmentId) ||
        latestById.get(value.assignmentId)!.version < value.version
      )
        latestById.set(value.assignmentId, value);
    const active = [...latestById.values()].filter((v) => v.status === 'ACTIVE');
    if (active.length >= grant.capacity) {
      if (grant.capacity !== 1)
        throw new WorkspaceCommercialError(
          'CAPACITY_EXCEEDED',
          'Assignable grant capacity is exhausted.'
        );
      const prior = active[0]!;
      await this.repository.appendAssignment({
        ...prior,
        version: prior.version + 1,
        status: 'REVOKED',
        effectiveTo: input.effectiveFrom,
        recordedAt: input.recordedAt
      });
    }
    const assignment: EntitlementGrantAssignmentV1 = {
      schemaVersion: 1,
      assignmentId: input.assignmentId,
      version: 1,
      assignableGrantId: grant.assignableGrantId,
      workspaceId: grant.sponsorWorkspaceId,
      membershipId: membership.membershipId,
      userId: membership.userId,
      status: 'ACTIVE',
      effectiveFrom: input.effectiveFrom,
      ...(grant.effectiveTo ? { effectiveTo: grant.effectiveTo } : {}),
      recordedAt: input.recordedAt
    };
    await this.repository.appendAssignment(assignment);
    return clone(assignment);
  }

  async resolveEntitlement(
    subject: CommercialSubjectRefV1,
    entitlementKey: string,
    asOf: string
  ): Promise<ResolvedEntitlementV1> {
    const at = instant(asOf, 'asOf');
    const direct = latestVersionsAt(
      await this.repository.listGrants(),
      (value) => value.grantId,
      at
    ).filter(
      (v) =>
        v.status === 'ACTIVE' &&
        sameSubject(v.subject, subject) &&
        v.entitlement.key === entitlementKey &&
        activeAt(v, at)
    );
    const assigned: EntitlementGrantV1[] = [];
    if (subject.scope === 'USER') {
      const assignments = latestVersionsAt(
        await this.repository.listAssignments(),
        (value) => value.assignmentId,
        at
      );
      for (const assignment of assignments.filter(
        (v) => v.userId === subject.userId && v.status === 'ACTIVE' && activeAt(v, at)
      )) {
        const grant = latestVersionsAt(
          await this.repository.listAssignableGrantVersions(assignment.assignableGrantId),
          (value) => value.assignableGrantId,
          at
        )[0];
        if (!grant || !['AVAILABLE', 'ASSIGNED'].includes(grant.status) || !activeAt(grant, at))
          continue;
        for (const [index, entitlement] of grant.entitlements.entries())
          if (entitlement.key === entitlementKey)
            assigned.push({
              schemaVersion: 1,
              grantId: `${grant.assignableGrantId}:${assignment.assignmentId}:${index}`,
              version: grant.version,
              subject,
              entitlement,
              status: 'ACTIVE',
              sourceType: 'AGREEMENT',
              sourceRef: grant.sourceAgreementId,
              effectiveFrom: assignment.effectiveFrom,
              ...(assignment.effectiveTo ? { effectiveTo: assignment.effectiveTo } : {}),
              recordedAt: assignment.recordedAt
            });
      }
    }
    const grants = [...direct, ...assigned];
    if (!grants.length)
      throw new WorkspaceCommercialError(
        'NO_APPLICABLE_ENTITLEMENT',
        'No active entitlement grant applies.'
      );
    const values = grants.map((v) => v.entitlement.value);
    if (!values.every((v) => v.kind === values[0]!.kind))
      throw new WorkspaceCommercialError('CONFLICT', 'Entitlement value kinds conflict.');
    let value: EntitlementValueV1;
    if (values[0]!.kind === 'BOOLEAN')
      value = { kind: 'BOOLEAN', enabled: values.some((v) => v.kind === 'BOOLEAN' && v.enabled) };
    else if (values[0]!.kind === 'LEVEL') {
      const selected = (values as Extract<EntitlementValueV1, { kind: 'LEVEL' }>[]).sort(
        (a, b) => b.rank - a.rank
      )[0]!;
      value = clone(selected);
    } else {
      const quantities = values as Extract<EntitlementValueV1, { kind: 'QUANTITY' }>[];
      if (
        !quantities.every(
          (v) =>
            v.unit === quantities[0]!.unit &&
            v.period === quantities[0]!.period &&
            v.aggregation === quantities[0]!.aggregation
        )
      )
        throw new WorkspaceCommercialError('CONFLICT', 'Entitlement quantity semantics conflict.');
      const quantity =
        quantities[0]!.aggregation === 'SUM'
          ? quantities.reduce((sum, v) => sum + v.quantity, 0)
          : Math.max(...quantities.map((v) => v.quantity));
      value = { ...quantities[0]!, quantity };
    }
    return {
      schemaVersion: 1,
      subject: clone(subject),
      key: entitlementKey,
      value,
      contributingGrantRefs: grants.map((v) => ({ grantId: v.grantId, version: v.version })),
      resolvedAt: asOf
    };
  }

  async recordRatePolicy(value: RatePolicyVersionV1): Promise<RatePolicyVersionV1> {
    if (
      value?.schemaVersion !== 1 ||
      typeof value.policyId !== 'string' ||
      !value.policyId.trim() ||
      !['REFERRAL_COMMISSION', 'TRADING_FEE', 'MARKREG_SERVICE_FEE', 'MGSN_SERVICE_FEE'].includes(
        value.kind
      ) ||
      !['DRAFT', 'ACTIVE', 'RETIRED'].includes(value.lifecycle) ||
      !value.applicability ||
      typeof value.applicability !== 'object' ||
      !value.calculation ||
      typeof value.calculation !== 'object'
    )
      throw new WorkspaceCommercialError('INVALID_INPUT', 'Rate policy shape is invalid.');
    assertVersion(value.version);
    assertWindow(value);
    instant(value.recordedAt, 'recordedAt');
    if (
      value.calculation.kind === 'PERCENTAGE' &&
      (!Number.isInteger(value.calculation.basisPoints) || value.calculation.basisPoints < 0)
    )
      throw new WorkspaceCommercialError(
        'INVALID_INPUT',
        'basisPoints must be a non-negative integer.'
      );
    if (
      value.calculation.kind === 'FIXED_AMOUNT' &&
      (!Number.isSafeInteger(value.calculation.amountMinor) ||
        value.calculation.amountMinor < 0 ||
        !/^[A-Z]{3}$/u.test(value.calculation.currency))
    )
      throw new WorkspaceCommercialError('INVALID_INPUT', 'Fixed rate money is invalid.');
    await this.repository.appendRatePolicy(clone(value));
    return clone(value);
  }

  async resolveRate(
    input: Readonly<{
      kind: RatePolicyKindV1;
      applicability: RatePolicyApplicabilityV1;
      asOf: string;
      sourceRef: string;
      basisAmountMinor?: number;
      currency?: string;
    }>
  ): Promise<AppliedRateSnapshotV1> {
    const at = instant(input.asOf, 'asOf');
    const candidates = (await this.repository.listRatePolicies(input.kind)).filter(
      (v) =>
        v.lifecycle === 'ACTIVE' &&
        activeAt(v, at) &&
        applicabilityKey(v.applicability) === applicabilityKey(input.applicability)
    );
    if (!candidates.length)
      throw new WorkspaceCommercialError('NO_APPLICABLE_RATE', 'No active rate policy applies.');
    candidates.sort(
      (a, b) =>
        instant(b.effectiveFrom, 'effectiveFrom') - instant(a.effectiveFrom, 'effectiveFrom') ||
        b.version - a.version
    );
    if (
      candidates[1] &&
      candidates[1].effectiveFrom === candidates[0]!.effectiveFrom &&
      candidates[1].version === candidates[0]!.version
    )
      throw new WorkspaceCommercialError(
        'AMBIGUOUS_RATE',
        'Multiple equally current rate policies apply.'
      );
    const policy = candidates[0]!;
    let calculatedAmountMinor: number | undefined;
    let currency: string | undefined;
    if (policy.calculation.kind === 'FIXED_AMOUNT') {
      calculatedAmountMinor = policy.calculation.amountMinor;
      currency = policy.calculation.currency;
    }
    if (policy.calculation.kind === 'PERCENTAGE') {
      if (
        !Number.isSafeInteger(input.basisAmountMinor) ||
        input.basisAmountMinor! < 0 ||
        !input.currency
      )
        throw new WorkspaceCommercialError(
          'INVALID_INPUT',
          'Percentage resolution requires non-negative basisAmountMinor and currency.'
        );
      calculatedAmountMinor = Math.round(
        (input.basisAmountMinor! * policy.calculation.basisPoints) / 10_000
      );
      currency = input.currency;
    }
    return {
      schemaVersion: 1,
      policyId: policy.policyId,
      policyVersion: policy.version,
      kind: policy.kind,
      calculation: clone(policy.calculation),
      ...(input.basisAmountMinor !== undefined ? { basisAmountMinor: input.basisAmountMinor } : {}),
      ...(calculatedAmountMinor !== undefined ? { calculatedAmountMinor } : {}),
      ...(currency ? { currency } : {}),
      ...(policy.payerRef ? { payerRef: policy.payerRef } : {}),
      ...(policy.payeeRef ? { payeeRef: policy.payeeRef } : {}),
      ...(policy.beneficiaryRef ? { beneficiaryRef: policy.beneficiaryRef } : {}),
      appliedAt: input.asOf,
      sourceRef: input.sourceRef
    };
  }
}
