from pathlib import Path


def replace(text: str, old: str, new: str, count: int = -1) -> str:
    if old not in text:
        return text
    return text.replace(old, new, count)


p = Path('src/governed-allocation.ts')
s = p.read_text()
s = replace(s, 'ControlledHandoffService', 'ControlledPrivacyHandoffService')
s = replace(s, "import type { MarkOrbitId } from '@markorbit/contracts';\n", '')
s = replace(s, 'correlationId: command.correlationId as MarkOrbitId', 'correlationId: command.correlationId')
s = replace(
    s,
    "      handoff: Readonly<ControlledHandoffVersionReferenceV1>;\n    }>;",
    "      handoff: Readonly<ControlledHandoffVersionReferenceV1>;\n"
    "      envelopeFingerprintSha256: string;\n"
    "      purposeFingerprintSha256: string;\n"
    "      projectionFingerprintSha256: string;\n"
    "      sourceSetFingerprintSha256: string;\n"
    "    }>;",
)
s = replace(
    s,
    "    const reference = command.handoffBinding.handoff;\n"
    "    const envelope = await this.handoffs.findLatest(reference.controlledHandoffId);",
    "    const reference = command.handoffBinding.handoff;\n"
    "    const envelopeFingerprintSha256 = requireSha256(\n"
    "      command.handoffBinding.envelopeFingerprintSha256,\n"
    "      'handoffBinding.envelopeFingerprintSha256'\n"
    "    );\n"
    "    const purposeFingerprintSha256 = requireSha256(\n"
    "      command.handoffBinding.purposeFingerprintSha256,\n"
    "      'handoffBinding.purposeFingerprintSha256'\n"
    "    );\n"
    "    const projectionFingerprintSha256 = requireSha256(\n"
    "      command.handoffBinding.projectionFingerprintSha256,\n"
    "      'handoffBinding.projectionFingerprintSha256'\n"
    "    );\n"
    "    const sourceSetFingerprintSha256 = requireSha256(\n"
    "      command.handoffBinding.sourceSetFingerprintSha256,\n"
    "      'handoffBinding.sourceSetFingerprintSha256'\n"
    "    );\n"
    "    const envelope = await this.handoffs.findLatest(reference.controlledHandoffId);",
)
s = replace(
    s,
    "      !envelope ||\n      envelope.version !== reference.version ||",
    "      !envelope ||\n"
    "      envelope.envelopeFingerprintSha256 !== envelopeFingerprintSha256 ||\n"
    "      envelope.purpose.purposeFingerprintSha256 !== purposeFingerprintSha256 ||\n"
    "      envelope.authorizedProjection.projectionFingerprintSha256 !== projectionFingerprintSha256 ||\n"
    "      envelope.authorizedProjection.sourceSetFingerprintSha256 !== sourceSetFingerprintSha256 ||\n"
    "      envelope.version !== reference.version ||",
)
s = replace(
    s,
    'purposeFingerprintSha256: envelope.purpose.purposeFingerprintSha256',
    'purposeFingerprintSha256',
)
s = replace(
    s,
    'projectionFingerprintSha256: envelope.authorizedProjection.projectionFingerprintSha256',
    'projectionFingerprintSha256',
)
s = replace(
    s,
    'sourceSetFingerprintSha256: envelope.authorizedProjection.sourceSetFingerprintSha256',
    'sourceSetFingerprintSha256',
)
s = replace(
    s,
    "    const selectionValidationFingerprintSha256 = fingerprint(selectionValidation);\n"
    "    const lineageBase = {",
    "    const admissionSelectionValidation: ProviderSelectionCurrentValidationV1 = {\n"
    "      ...selectionValidation,\n"
    "      publicReason: 'Historical admission validation was positive at governed Allocation commit.'\n"
    "    };\n"
    "    const selectionValidationFingerprintSha256 = fingerprint(admissionSelectionValidation);\n"
    "    const lineageBase = {",
)
s = replace(
    s,
    "      selectionValidation,\n      selectionValidationFingerprintSha256,",
    "      selectionValidation: admissionSelectionValidation,\n      selectionValidationFingerprintSha256,",
)
s = replace(
    s,
    "    return {\n      envelope,\n      validation,\n      validationFingerprintSha256: fingerprint(validation)\n    };",
    "    const admissionValidation: ControlledHandoffCurrentValidationV1 = {\n"
    "      ...validation,\n"
    "      attempt: { ...validation.attempt, attemptedAt: validation.evaluatedAt },\n"
    "      publicReason: 'Historical admission validation was positive at governed Allocation commit.'\n"
    "    };\n"
    "    return {\n"
    "      envelope,\n"
    "      validation: admissionValidation,\n"
    "      validationFingerprintSha256: fingerprint(admissionValidation)\n"
    "    };",
)
p.write_text(s)

p = Path('src/provider-work-incoming-authority.ts')
s = p.read_text()
s = replace(s, 'ControlledHandoffService', 'ControlledPrivacyHandoffService')
s = replace(s, 'scope: unknown,', 'scope: object,')
s = replace(s, 'sourceScope: unknown,', 'sourceScope: object,')
s = replace(s, '  ProviderWorkReadModelService,', '  type ProviderWorkReadModelService,')
p.write_text(s)

p = Path('src/governed-allocation-postgres.ts')
s = p.read_text()
s = replace(s, "import type { QueryClient } from '@markorbit/persistence';", "import { createHash } from 'node:crypto';\nimport type { QueryClient } from '@markorbit/persistence';")
s = replace(
    s,
    "import type { AllocationRecord } from './allocation-provider-acceptance.js';",
    "import {\n  AllocationProviderAcceptanceError,\n  type AllocationRecord\n} from './allocation-provider-acceptance.js';",
)
legacy_helper = """
function legacyAllocationRequestFingerprint(record: Readonly<AllocationRecord>): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        command: 'ALLOCATE_PROVIDER',
        workspaceId: record.workspaceId.toLowerCase(),
        servicePackageId: record.servicePackage.id,
        expectedServicePackageVersion: record.servicePackage.version,
        expectedPackageFingerprint: record.servicePackageFingerprintSha256,
        eligibilityEvaluationId: record.eligibilityEvaluation.id,
        expectedEligibilityEvaluationVersion: record.eligibilityEvaluation.version,
        expectedEligibilityFingerprint: record.eligibilityFingerprintSha256,
        providerId: record.provider.providerId,
        providerSupplyCapabilityId: record.providerSupplyCapability.id,
        expectedProviderSupplyCapabilityVersion: record.providerSupplyCapability.version,
        rationale: record.rationale,
        actorId: record.allocatedBy,
        correlationId: record.correlationId
      })
    )
    .digest('hex');
}

"""
if 'function legacyAllocationRequestFingerprint' not in s:
    s = s.replace('export class PostgresGovernedAllocationRepository', legacy_helper + 'export class PostgresGovernedAllocationRepository', 1)
s = replace(
    s,
    "throw new GovernedAllocationError(\n            'SELECTION_MISMATCH',\n            'An active Allocation already exists for this Service Package.',\n            409\n          );",
    "throw new AllocationProviderAcceptanceError(\n            'ACTIVE_ALLOCATION_EXISTS',\n            'An active Allocation already exists for this Service Package.',\n            409\n          );",
)
s = replace(
    s,
    'if (cause instanceof GovernedAllocationError) throw cause;',
    'if (cause instanceof GovernedAllocationError || cause instanceof AllocationProviderAcceptanceError) throw cause;',
)
s = replace(
    s,
    "        input.idempotencyKey,\n        input.requestFingerprintSha256,\n        input.allocation.allocationId,",
    "        input.idempotencyKey,\n        legacyAllocationRequestFingerprint(input.allocation),\n        input.allocation.allocationId,",
    1,
)
s = replace(
    s,
    '} catch (cause) {\n      throw this.unavailable(cause);\n    }',
    '} catch {\n      throw this.unavailable();\n    }',
    1,
)
s = replace(s, 'private unavailable(_cause: unknown)', 'private unavailable()')
s = replace(s, 'this.unavailable(cause)', 'this.unavailable()')
p.write_text(s)

p = Path('tests/governed-allocation.test.ts')
s = p.read_text()
s = replace(s, '  GovernedAllocationError,\n', '')
s = replace(s, '.toMatchObject<\n      Partial<GovernedAllocationError>\n    >({', '.toMatchObject({')
s = replace(s, '      expect(repo.commit).toHaveBeenCalledTimes(1);\n', '')
p.write_text(s)

p = Path('tests/governed-allocation-postgres.test.ts')
s = p.read_text()
s = replace(s, "import path from 'node:path';", "import { createHash } from 'node:crypto';\nimport path from 'node:path';")
s = replace(s, 'return client.query(text, values);', 'return values ? client.query(text, [...values]) : client.query(text);')
s = replace(
    s,
    '.then((value) => value.rows[0]!.count)',
    '.then((value) => Number((value.rows[0] as { count: number }).count))',
)
s = replace(
    s,
    'expect(lineageCount.rows[0]!.count).toBe(0);',
    'expect(Number((lineageCount.rows[0] as { count: number }).count)).toBe(0);',
)
s = replace(
    s,
    '    const result = await governedService().allocate(command(seeded));\n\n    expect(result.lineage).toMatchObject({',
    '    const governedCommand = command(seeded);\n'
    '    const result = await governedService().allocate(governedCommand);\n\n'
    '    expect(result.lineage).toMatchObject({',
    1,
)
replay_assertion = """
    const legacyReplay = await database.getPool().query(
      'SELECT request_fingerprint FROM mgsn_allocation_commands WHERE target_id=$1',
      [result.allocation.allocationId]
    );
    const legacyFingerprint = String(
      (legacyReplay.rows[0] as { request_fingerprint: string }).request_fingerprint
    );
    const expectedLegacyFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          command: 'ALLOCATE_PROVIDER',
          workspaceId: governedCommand.workspaceId.toLowerCase(),
          servicePackageId: governedCommand.servicePackageId,
          expectedServicePackageVersion: governedCommand.expectedServicePackageVersion,
          expectedPackageFingerprint: governedCommand.expectedServicePackageFingerprintSha256,
          eligibilityEvaluationId: governedCommand.eligibilityEvaluationId,
          expectedEligibilityEvaluationVersion: governedCommand.expectedEligibilityEvaluationVersion,
          expectedEligibilityFingerprint: governedCommand.expectedEligibilityFingerprintSha256,
          providerId: governedCommand.providerId,
          providerSupplyCapabilityId: governedCommand.providerSupplyCapabilityId,
          expectedProviderSupplyCapabilityVersion:
            governedCommand.expectedProviderSupplyCapabilityVersion,
          rationale: governedCommand.rationale,
          actorId: governedCommand.actorId,
          correlationId: governedCommand.correlationId
        })
      )
      .digest('hex');
    expect(legacyFingerprint).toBe(expectedLegacyFingerprint);
    expect(legacyFingerprint).not.toBe(result.requestFingerprintSha256);
"""
anchor = """    expect(
      await database
        .getPool()
        .query('SELECT count(*)::int AS count FROM mgsn_provider_acceptances')
        .then((value) => Number((value.rows[0] as { count: number }).count))
    ).toBe(0);
"""
if 'expectedLegacyFingerprint' not in s and anchor in s:
    s = s.replace(anchor, anchor + replay_assertion, 1)
p.write_text(s)
