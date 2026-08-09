import json
from pathlib import Path

# Shared contract: Provider references Core Workspace's real string/UUID identity.
p = Path('packages/contracts/src/provider-execution.ts')
s = p.read_text()
count = s.count('providerWorkspaceId: MarkOrbitId;')
if count != 3:
    raise SystemExit(f'expected 3 providerWorkspaceId fields, found {count}')
p.write_text(s.replace('providerWorkspaceId: MarkOrbitId;', 'providerWorkspaceId: string;'))

# Consume WP-01 through its published package subpath.
for filename in [
    'services/mgsn/src/provider-registry.ts',
    'services/mgsn/src/provider-registry-postgres.ts',
]:
    p = Path(filename)
    s = p.read_text()
    old = "from '@markorbit/contracts';"
    if old not in s:
        raise SystemExit(f'contracts root import not found: {filename}')
    p.write_text(s.replace(old, "from '@markorbit/contracts/provider-execution';", 1))

# Exact durable idempotent replay returns the original command response snapshot.
p = Path('services/mgsn/src/provider-registry.ts')
s = p.read_text()
needle = "  responseVersion: number;\n}"
if needle not in s:
    raise SystemExit('replay interface not found')
s = s.replace(
    needle,
    "  responseVersion: number;\n  responseRecord: ProviderRegistryRecord | ProviderSupplyCapabilityRecord;\n}",
    1,
)
old = """    const record = await this.repository.findProviderById(replay.targetId as ProviderId);
    if (!record || record.version !== replay.responseVersion)
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Provider result is unavailable.',
        503
      );
    return record;"""
new = """    const record = replay.responseRecord as ProviderRegistryRecord;
    if (record.providerId !== replay.targetId || record.version !== replay.responseVersion)
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Provider result is unavailable.',
        503
      );
    return record;"""
if old not in s:
    raise SystemExit('provider replay block not found')
s = s.replace(old, new, 1)
old = """    const record = await this.repository.findSupplyCapability(
      replay.targetId as ProviderSupplyCapabilityId,
      replay.responseVersion
    );
    if (!record)
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Supply Capability result is unavailable.',
        503
      );
    return record;"""
new = """    const record = replay.responseRecord as ProviderSupplyCapabilityRecord;
    if (
      record.providerSupplyCapabilityId !== replay.targetId ||
      record.version !== replay.responseVersion
    )
      throw new ProviderRegistryError(
        'PERSISTENCE_UNAVAILABLE',
        'Idempotent Supply Capability result is unavailable.',
        503
      );
    return record;"""
if old not in s:
    raise SystemExit('supply replay block not found')
p.write_text(s.replace(old, new, 1))

p = Path('services/mgsn/src/provider-registry-postgres.ts')
s = p.read_text()
old_select = 'SELECT request_fingerprint,target_type,target_id,response_version FROM mgsn_provider_registry_commands'
s = s.replace(
    old_select,
    'SELECT request_fingerprint,target_type,target_id,response_version,response_record FROM mgsn_provider_registry_commands',
)
needle = """        responseVersion: Number(row.response_version)
      };"""
repl = """        responseVersion: Number(row.response_version),
        responseRecord: row.response_record as ProviderRegistryRecord | ProviderSupplyCapabilityRecord
      };"""
if s.count(needle) != 1:
    raise SystemExit('findReplay mapping not found')
s = s.replace(needle, repl, 1)
needle = """      responseVersion: Number(row.response_version)
    } satisfies ProviderRegistryReplay;"""
repl = """      responseVersion: Number(row.response_version),
      responseRecord: row.response_record as ProviderRegistryRecord | ProviderSupplyCapabilityRecord
    } satisfies ProviderRegistryReplay;"""
if needle not in s:
    raise SystemExit('lockReplay mapping not found')
p.write_text(s.replace(needle, repl, 1))

# Permanent focused scripts.
p = Path('package.json')
data = json.loads(p.read_text())
data['scripts']['build:mgsn-provider-registry-deps'] = 'turbo run build --filter=@markorbit/mgsn-service...'
data['scripts']['test:mgsn-provider-registry:postgres'] = 'pnpm build:mgsn-provider-registry-deps && MGSN_PROVIDER_REGISTRY_POSTGRES_REQUIRED=1 pnpm --filter @markorbit/mgsn-service exec vitest run tests/provider-registry-postgres.test.ts'
p.write_text(json.dumps(data, indent=2) + '\n')

# Machine-readable implementation traceability.
p = Path('docs/planning/MO-MVP-MILESTONE-004-IMPLEMENTATION-TRACEABILITY.json')
data = json.loads(p.read_text())
for wp in data['workPackages']:
    if wp['id'] == 'M4-WP-03':
        wp.clear()
        wp.update({
            'id': 'M4-WP-03',
            'status': 'IMPLEMENTED_IN_PR_51',
            'evidence': [
                'infrastructure/persistence/migrations/0028_mgsn_provider_registry.sql',
                'services/mgsn/src/provider-registry.ts',
                'services/mgsn/src/provider-registry-postgres.ts',
                'services/mgsn/tests/provider-registry-postgres.test.ts',
                'docs/tasks/MO-MVP-M4-WP-03-DURABLE-MGSN-PROVIDER-REGISTRY.md',
            ],
        })
data['wp03DurabilityBoundary'] = {
    'owner': 'MGSN',
    'databasePerOwner': True,
    'migration': '0028_mgsn_provider_registry',
    'coreWorkspaceIdentityReferencedNotDuplicated': True,
    'uniqueProviderWorkspaceBinding': True,
    'versionedSupplyCapabilityHistory': True,
    'durableIdempotency': True,
    'optimisticConcurrency': True,
    'appendOnlyAudit': True,
    'suspendedOrInactiveSupplyEligible': False,
    'userCapabilityVerifiedAutomatically': False,
    'professionalQualifiedAutomatically': False,
    'providerAllocated': False,
    'legalProfessionalAppointmentCreated': False,
    'paymentOrInvoiceCreated': False,
    'filingSubmitted': False,
    'officialTruthCreated': False,
}
p.write_text(json.dumps(data, indent=2) + '\n')

p = Path('docs/planning/TASK-INDEX.md')
s = p.read_text()
old = """- M4-WP-03 — Durable MGSN Provider Registry and Supply Capability (**next after WP-02 merge**)
- M4-WP-04 — MGSN Service Package and deterministic Eligibility (**not started**)"""
new = """- M4-WP-03 — Durable MGSN Provider Registry and Supply Capability (**implemented in PR #51**)
  - MGSN-owned migration: `0028_mgsn_provider_registry`.
  - Durable Provider/Core Workspace reference with unique identity binding, suspension/inactive state, optimistic versioning and idempotency.
  - Immutable historical Supply Capability versions with effective period, capacity/availability, evidence references and supply-only verification state.
  - Supply Capability does not create user Capability evidence, professional qualification, Allocation, appointment, Filing, Payment/Invoice or Official Truth.
  - Evidence: `docs/tasks/MO-MVP-M4-WP-03-DURABLE-MGSN-PROVIDER-REGISTRY.md`.
- M4-WP-04 — MGSN Service Package and deterministic Eligibility (**next after WP-03 merge**)"""
if old not in s:
    raise SystemExit('TASK-INDEX WP03 block not found')
p.write_text(s.replace(old, new, 1))

Path('docs/tasks/MO-MVP-M4-WP-03-DURABLE-MGSN-PROVIDER-REGISTRY.md').write_text("""# M4-WP-03 — Durable MGSN Provider Registry and Supply Capability

**Milestone:** MO-MVP-MILESTONE-004  
**Direction:** `DURABLE_GOVERNED_PROVIDER_EXECUTION_AND_RETURN`  
**PR:** #51  
**Status:** IMPLEMENTED_IN_PR_51

## Objective

Make MGSN the durable owner of private provider-network supply truth before Service Package admission and deterministic Eligibility.

## Ownership and identity

Core remains owner of Workspace identity. MGSN stores only a bounded `providerWorkspaceId` reference, never reads Core tables and does not duplicate Core identity. Provider creation requires an active Core Workspace reference; reactivation rechecks that source. A unique database constraint prevents duplicate Provider binding to one Core Workspace.

MGSN owns Provider records, versioned Provider Supply Capability, durable idempotency response evidence and append-only registry audit evidence in its own database.

## Provider Registry and Supply Capability

Provider records use server-generated IDs, `ACTIVE` / `SUSPENDED` / `INACTIVE` state, optimistic versions, actor lineage and timestamps. `INACTIVE` is terminal in this M4 boundary.

Supply Capability revisions create immutable historical versions and one current version. Each version carries an exact Provider reference snapshot, normalized jurisdictions/service types, effective period, capacity/availability, evidence references, supply verification state and SHA-256 fingerprint.

`VERIFIED_FOR_SUPPLY` is private MGSN operating verification only. It is not user Capability evidence and is not automatic professional qualification.

## Reliability and authority boundary

Migration `0028_mgsn_provider_registry` belongs only to `@markorbit/mgsn-service`. The durable repository enforces optimistic concurrency, exact idempotency replay/conflict detection, history reads, provider identity uniqueness, append-only audit and 503-class persistence outage semantics.

Suspended/inactive Provider state or suspended/retired supply cannot be treated as operationally eligible input. Full deterministic Eligibility remains M4-WP-04.

WP-03 does not create Allocation, Provider Acceptance, legal/professional appointment, Payment, Invoice, Filing submission, official application truth, user Capability verification or Official Truth.

## Contract correction

WP-01 typed `providerWorkspaceId` as `MarkOrbitId`, while Core Workspace IDs are UUID/string identities. WP-03 corrects the shared provider-execution contract to Core's actual `string` identity type and consumes it through the published `@markorbit/contracts/provider-execution` subpath.

## Evidence

`pnpm test:mgsn-provider-registry:postgres` proves migration ownership, Core identity validation, duplicate prevention, durable replay/conflict behavior, suspension/reactivation, optimistic versioning, immutable Supply Capability history, bounded supply inputs, operational ineligibility, append-only audit and outage mapping.

Final acceptance is the clean PR #51 head passing repository-required CI with no temporary helper workflow retained.

## Next dependency

After PR #51 merges with green hosted gates, continue with **M4-WP-04 — Service Package and deterministic Eligibility**.
""")
