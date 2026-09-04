from pathlib import Path

p = Path('tests/governed-allocation-postgres.test.ts')
s = p.read_text()

anchor = "import { PostgresGovernedAllocationRepository } from '../src/governed-allocation-postgres.js';\n"
imports = (
    anchor
    + "import { PostgresProviderWorkReadRepository } from '../src/provider-work-read-model-postgres.js';\n"
    + "import { ProviderWorkReadModelService } from '../src/provider-work-read-model.js';\n"
    + "import {\n"
    + "  GovernedProviderWorkReadModelService,\n"
    + "  PostgresProviderWorkIncomingAuthorityRepository\n"
    + "} from '../src/provider-work-incoming-authority.js';\n"
)
if 'PostgresProviderWorkIncomingAuthorityRepository' not in s:
    s = s.replace(anchor, imports, 1)

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
        workspaceId: providerWorkspaceId,
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
        workspaceId: providerWorkspaceId,
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

p.write_text(s)
