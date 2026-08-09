from pathlib import Path

# Fix contract/service package fingerprint semantics and root MarkOrbitId import.
path = Path('services/mgsn/src/service-package-eligibility.ts')
text = path.read_text()
text = text.replace(
    "import type {\n  CreateServicePackageCommand,\n  EligibilityCheck,\n  EligibilityEvaluation,\n  EligibilityEvaluationId,\n  EvaluateProviderEligibilityCommand,\n  MarkOrbitId,",
    "import type { MarkOrbitId } from '@markorbit/contracts';\nimport type {\n  CreateServicePackageCommand,\n  EligibilityCheck,\n  EligibilityEvaluation,\n  EligibilityEvaluationId,\n  EvaluateProviderEligibilityCommand,",
    1,
)
text = text.replace(
    "export interface ServicePackageRecord extends ServicePackage {\n  createdBy: string;",
    "export interface ServicePackageRecord extends ServicePackage {\n  servicePackageFingerprintSha256: string;\n  createdBy: string;",
    1,
)
text = text.replace(
    "      source,\n      sourceFingerprintSha256: packageFingerprint,\n      jurisdiction:",
    "      source,\n      sourceFingerprintSha256: source.sourceFingerprintSha256,\n      servicePackageFingerprintSha256: packageFingerprint,\n      jurisdiction:",
    1,
)
text = text.replace(
    "if (servicePackage.sourceFingerprintSha256 !== expectedPackageFingerprint)",
    "if (servicePackage.servicePackageFingerprintSha256 !== expectedPackageFingerprint)",
    1,
)
text = text.replace(
    "servicePackageFingerprintSha256: servicePackage.sourceFingerprintSha256,\n      provider:",
    "servicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,\n      provider:",
    1,
)
text = text.replace(
    "servicePackageFingerprintSha256: servicePackage.sourceFingerprintSha256,\n      providerId:",
    "servicePackageFingerprintSha256: servicePackage.servicePackageFingerprintSha256,\n      providerId:",
    1,
)
path.write_text(text)

# Refine the shared ServicePackage contract so the exact Execution source fingerprint
# and the deterministic MGSN package fingerprint are distinct.
path = Path('packages/contracts/src/provider-execution.ts')
text = path.read_text()
needle = "  source: Readonly<ProviderExecutionSourceSnapshot>;\n  sourceFingerprintSha256: string;\n  jurisdiction: string;"
replacement = "  source: Readonly<ProviderExecutionSourceSnapshot>;\n  sourceFingerprintSha256: string;\n  servicePackageFingerprintSha256: string;\n  jurisdiction: string;"
if needle not in text:
    raise SystemExit('ServicePackage fingerprint contract insertion point not found')
path.write_text(text.replace(needle, replacement, 1))

# Forward-compatible WP03 migration assertions: MGSN now owns 0028 and 0029.
path = Path('services/mgsn/tests/provider-registry-postgres.test.ts')
text = path.read_text()
old = """    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual([
      '0028_mgsn_provider_registry'
    ]);"""
new = """    expect(owned.map((migration) => `${migration.version}_${migration.name}`)).toEqual([
      '0028_mgsn_provider_registry',
      '0029_mgsn_service_package_eligibility'
    ]);"""
if old not in text:
    raise SystemExit('WP03 migration expectation not found')
text = text.replace(old, new, 1)
old = """    expect(relations.rows.map((row) => row.name)).toEqual([
      'mgsn_provider_registry_audit',
      'mgsn_provider_registry_commands',
      'mgsn_provider_supply_capabilities',
      'mgsn_providers'
    ]);"""
new = """    expect(relations.rows.map((row) => row.name)).toEqual([
      'mgsn_eligibility_evaluations',
      'mgsn_provider_registry_audit',
      'mgsn_provider_registry_commands',
      'mgsn_provider_supply_capabilities',
      'mgsn_providers',
      'mgsn_service_package_audit',
      'mgsn_service_package_commands',
      'mgsn_service_packages'
    ]);"""
if old not in text:
    raise SystemExit('WP03 relation expectation not found')
path.write_text(text.replace(old, new, 1))
