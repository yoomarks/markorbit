from pathlib import Path

p = Path('tests/governed-allocation-postgres.test.ts')
s = p.read_text()

selection_import = "import { providerSelectionContractFixtureV1 } from '@markorbit/contracts/provider-selection';\n"
if 'controlledHandoffContractFixtureV1' not in s:
    s = s.replace(
        selection_import,
        "import {\n"
        "  controlledHandoffContractFixtureV1,\n"
        "  type ControlledHandoffEnvelopeV1\n"
        "} from '@markorbit/contracts/controlled-privacy-handoff';\n"
        + selection_import,
        1,
    )

anchor = "import { PostgresGovernedAllocationRepository } from '../src/governed-allocation-postgres.js';\n"
imports = (
    anchor
    + "import { PostgresProviderWorkReadRepository } from '../src/provider-work-read-model-postgres.js';\n"
    + "import { ProviderWorkReadModelService } from '../src/provider-work-read-model.js';\n"
    + "import {\n"
    + "  GovernedProviderWorkReadModelService,\n"
    + "  PostgresProviderWorkIncomingAuthorityRepository\n"
    + "} from '../src/provider-work-incoming-authority.js';\n"
    + "import {\n"
    + "  ControlledPrivacyHandoffService,\n"
    + "  type ControlledHandoffCurrentAuthoritySnapshot,\n"
    + "  type ControlledHandoffPrincipal\n"
    + "} from '../src/controlled-privacy-handoff.js';\n"
    + "import { PostgresControlledHandoffRepository } from '../src/controlled-privacy-handoff-postgres.js';\n"
)
if 'PostgresProviderWorkIncomingAuthorityRepository' not in s:
    s = s.replace(anchor, imports, 1)

correlation_anchor = "const correlationId = 'correlation_governed_716' as const;\n"
handoff_constants = """
const handoffFixture = controlledHandoffContractFixtureV1;
const handoffSnapshot: ControlledHandoffCurrentAuthoritySnapshot = {
  authorityAvailable: true,
  selectionCurrent: true,
  selectionScopeMatch: true,
  sourceVersionsMatch: true,
  sourceAccessCurrent: true,
  participationActive: true,
  visibilityAuthorized: true,
  directExecutorEstablished: true,
  hiddenIntermediaryDetected: false,
  evidenceArtifactAccessAuthorized: false,
  checkedAuthorityReferences: ['authority:governed-handoff-716']
};
const handoffAuthority = handoffFixture.authorizeCommand.trustedHumanAuthority;
const handoffPrincipal: ControlledHandoffPrincipal = {
  workspaceId: handoffAuthority.originatingWorkspaceId,
  actorId: handoffAuthority.authorizingActorId,
  actorKind: 'HUMAN_USER',
  principalReference: handoffAuthority.principalReference,
  workspaceMembershipReference: handoffAuthority.workspaceMembershipReference,
  handoffAuthorityReference: handoffAuthority.handoffAuthorityReference,
  handoffAuthorityVersion: handoffAuthority.handoffAuthorityVersion,
  authenticatedAt: handoffAuthority.authenticatedAt,
  affirmativeHumanActionEvidenceReference:
    handoffAuthority.affirmativeHumanActionEvidenceReference
};
"""
if 'const handoffSnapshot:' not in s:
    s = s.replace(correlation_anchor, correlation_anchor + handoff_constants, 1)

selection_service_anchor = """  const selectionService = () =>
    new ProviderSelectionService(
      selectionRepository(),
      { evaluateCurrentAuthority: () => Promise.resolve(structuredClone(selectionSnapshot)) },
      () => at,
      () => fixture.currentSelection.providerSelectionId
    );
"""
handoff_helpers = """
  const handoffRepository = () =>
    new PostgresControlledHandoffRepository(database, database.getPool());
  const handoffService = () =>
    new ControlledPrivacyHandoffService(
      handoffRepository(),
      { evaluateCurrentAuthority: () => Promise.resolve(structuredClone(handoffSnapshot)) },
      () => at,
      () => 'controlled-handoff_governed-716' as never
    );

  async function seedExactHandoff() {
    const authorize = structuredClone(handoffFixture.authorizeCommand);
    authorize.validFrom = '2026-09-04T14:00:00.000Z';
    authorize.validUntil = '2026-09-05T15:00:00.000Z';
    authorize.idempotencyKey = 'controlled-handoff:governed-716';
    authorize.commandFingerprintSha256 = 'b'.repeat(64);
    authorize.correlationId = 'correlation_controlled-handoff_governed-716';
    return handoffService().authorizeOrReplace(handoffPrincipal, authorize);
  }
"""
if 'async function seedExactHandoff' not in s:
    s = s.replace(selection_service_anchor, selection_service_anchor + handoff_helpers, 1)

command_end = """      handoffBinding: { mode: 'NONE_EXPLICIT' }
    };
  }
"""
exact_command = """

  function exactCommand(
    seeded: Awaited<ReturnType<typeof seedProviderSelectionAndEligiblePackage>>,
    envelope: ControlledHandoffEnvelopeV1,
    key = 'governed-allocation-exact-handoff-716'
  ): GovernedAllocationCommand {
    return {
      ...command(seeded, key),
      handoffBinding: {
        mode: 'EXACT',
        handoff: {
          controlledHandoffId: envelope.controlledHandoffId,
          version: envelope.version
        },
        envelopeFingerprintSha256: envelope.envelopeFingerprintSha256,
        purposeFingerprintSha256: envelope.purpose.purposeFingerprintSha256,
        projectionFingerprintSha256: envelope.authorizedProjection.projectionFingerprintSha256,
        sourceSetFingerprintSha256: envelope.authorizedProjection.sourceSetFingerprintSha256
      }
    };
  }
"""
if 'function exactCommand(' not in s:
    s = s.replace(command_end, command_end + exact_command, 1)

service_end = """      () => `allocation-admission-lineage_governed-716-${++lineageSequence}`
    );
  }
"""
exact_service = """

  function exactGovernedService(repository = governedRepository()) {
    const planner = new ExactM4GovernedAllocationPlanner(
      allocationRepository(),
      packageRepository(),
      providerRepository(),
      executionSource,
      () => at,
      () => `allocation_governed-exact-716-${++allocationSequence}`
    );
    return new GovernedAllocationService(
      planner,
      repository,
      selectionRepository(),
      selectionService(),
      handoffRepository(),
      handoffService(),
      directExecutor,
      () => at,
      () => `allocation-admission-lineage_governed-exact-716-${++lineageSequence}`
    );
  }
"""
if 'function exactGovernedService' not in s:
    s = s.replace(service_end, service_end + exact_service, 1)

truncate_anchor = """      `TRUNCATE
        mgsn_allocation_admission_lineage_audit,
"""
truncate_handoff = """      `TRUNCATE
        mgsn_allocation_admission_lineage_audit,
        mgsn_controlled_handoff_owner_audit_events,
        mgsn_controlled_handoff_command_replays,
        mgsn_controlled_handoff_slot_state,
        mgsn_controlled_handoff_versions,
        mgsn_controlled_handoff_identities,
"""
if 'mgsn_controlled_handoff_owner_audit_events' not in s:
    s = s.replace(truncate_anchor, truncate_handoff, 1)

none_anchor = "    expect(legacyFingerprint).not.toBe(result.requestFingerprintSha256);\n"
none_assertion = """

    const providerWork = new GovernedProviderWorkReadModelService(
      new ProviderWorkReadModelService(
        new PostgresProviderWorkReadRepository(database.getPool()),
        providerRepository(),
        () => at
      ),
      new PostgresProviderWorkIncomingAuthorityRepository(database.getPool()),
      { validateCurrent: vi.fn() } as never
    );
    const currentRead = await providerWork.read(
      {
        workspaceId: seeded.provider.providerWorkspaceId,
        userId: 'provider-user_governed-716',
        membershipId: 'provider-membership_governed-716'
      },
      result.allocation.allocationId
    );
    expect(currentRead.decision).toBe('AUTHORIZED');
    if (currentRead.decision !== 'AUTHORIZED') throw new Error('Provider Work must be readable.');
    expect(currentRead.item.incomingDataAuthority).toMatchObject({
      state: 'KNOWN_ABSENT',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
"""
if "state: 'KNOWN_ABSENT'" not in s and none_anchor in s:
    s = s.replace(none_anchor, none_anchor + none_assertion, 1)

legacy_anchor = "    expect(Number((lineageCount.rows[0] as { count: number }).count)).toBe(0);\n"
legacy_assertion = """

    const providerWork = new GovernedProviderWorkReadModelService(
      new ProviderWorkReadModelService(
        new PostgresProviderWorkReadRepository(database.getPool()),
        providerRepository(),
        () => at
      ),
      new PostgresProviderWorkIncomingAuthorityRepository(database.getPool()),
      { validateCurrent: vi.fn() } as never
    );
    const legacyRead = await providerWork.read(
      {
        workspaceId: seeded.provider.providerWorkspaceId,
        userId: 'provider-user_legacy-716',
        membershipId: 'provider-membership_legacy-716'
      },
      'allocation_legacy-716'
    );
    expect(legacyRead.decision).toBe('AUTHORIZED');
    if (legacyRead.decision !== 'AUTHORIZED') throw new Error('Legacy Provider Work must be readable.');
    expect(legacyRead.item.incomingDataAuthority).toMatchObject({
      state: 'UNKNOWN',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
"""
if "provider-user_legacy-716" not in s and legacy_anchor in s:
    s = s.replace(legacy_anchor, legacy_anchor + legacy_assertion, 1)

final_anchor = "\n  it('keeps the legacy M4 allocateProvider path valid without inferring #712 lineage', async () => {"
exact_test = """

  it('persists, replays and freshly revalidates exact Handoff authority without projecting private values', async () => {
    const seeded = await seedProviderSelectionAndEligiblePackage();
    const authorizedHandoff = await seedExactHandoff();
    const exact = exactCommand(seeded, authorizedHandoff.envelope);

    const first = await exactGovernedService().allocate(exact);
    expect(first.lineage.handoffBindingState).toBe('EXACT_CONTROLLED_HANDOFF');
    expect(first.lineage.handoff).toMatchObject({
      envelope: {
        controlledHandoffId: authorizedHandoff.envelope.controlledHandoffId,
        version: authorizedHandoff.envelope.version
      },
      validation: {
        purpose: 'HANDOFF_CONSUMPTION',
        decision: 'CURRENTLY_USABLE_FOR_EXACT_CONSUMPTION',
        currentlyUsable: true,
        currentExactDisclosurePermitted: true,
        publicReason: 'Historical admission validation was positive at governed Allocation commit.'
      }
    });

    const replay = await exactGovernedService().allocate(exact);
    expect(replay).toEqual(first);

    const changedLineage = structuredClone(exact);
    if (changedLineage.handoffBinding.mode !== 'EXACT') throw new Error('Exact Handoff fixture required.');
    changedLineage.handoffBinding = {
      ...changedLineage.handoffBinding,
      sourceSetFingerprintSha256: '0'.repeat(64)
    };
    await expect(exactGovernedService().allocate(changedLineage)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_CONFLICT',
      status: 409
    });

    const providerWork = new GovernedProviderWorkReadModelService(
      new ProviderWorkReadModelService(
        new PostgresProviderWorkReadRepository(database.getPool()),
        providerRepository(),
        () => at
      ),
      new PostgresProviderWorkIncomingAuthorityRepository(database.getPool()),
      handoffService()
    );
    const principal = {
      workspaceId: seeded.provider.providerWorkspaceId,
      userId: 'provider-user_exact-716',
      membershipId: 'provider-membership_exact-716'
    };
    const currentRead = await providerWork.read(principal, first.allocation.allocationId);
    expect(currentRead.decision).toBe('AUTHORIZED');
    if (currentRead.decision !== 'AUTHORIZED') throw new Error('Exact Provider Work must be readable.');
    expect(currentRead.item.incomingDataAuthority).toMatchObject({
      state: 'CURRENTLY_USABLE',
      handoff: {
        controlledHandoffId: authorizedHandoff.envelope.controlledHandoffId,
        version: authorizedHandoff.envelope.version
      },
      currentExactProjectionMayBeResolvedSeparately: true,
      embeddedPrivateFieldValues: false
    });
    expect('incomingFieldsVisible' in currentRead.item.incomingDataAuthority).toBe(false);

    const revoke = structuredClone(handoffFixture.revokeCommand);
    revoke.target = {
      controlledHandoffId: authorizedHandoff.envelope.controlledHandoffId,
      version: authorizedHandoff.envelope.version
    };
    revoke.idempotencyKey = 'controlled-handoff:governed-716:revoke';
    revoke.commandFingerprintSha256 = 'e'.repeat(64);
    revoke.correlationId = 'correlation_controlled-handoff_governed-716-revoke';
    await handoffService().revoke(handoffPrincipal, revoke);

    const deniedRead = await providerWork.read(principal, first.allocation.allocationId);
    expect(deniedRead.decision).toBe('AUTHORIZED');
    if (deniedRead.decision !== 'AUTHORIZED') throw new Error('Denied Provider Work must remain readable.');
    expect(deniedRead.item.incomingDataAuthority).toMatchObject({
      state: 'DENIED',
      incomingFieldsVisible: false,
      embeddedPrivateFieldValues: false
    });
  });
"""
if 'persists, replays and freshly revalidates exact Handoff authority' not in s:
    s = s.replace(final_anchor, exact_test + final_anchor, 1)

p.write_text(s)
