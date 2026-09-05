import { Alert, Card, DataList } from '@markorbit/ui';

type JsonObject = Record<string, unknown>;

export type CapabilityCatalogIntegrityView =
  | Readonly<{
      kind: 'available';
      status: 'CATALOG_HEALTHY' | 'CATALOG_INTEGRITY_FINDINGS';
      snapshotFingerprintSha256: string;
      auditFingerprintSha256: string;
      findings: readonly JsonObject[];
    }>
  | Readonly<{
      kind: 'unavailable';
      status: 'CATALOG_AUDIT_UNAVAILABLE';
      unavailableDependency: string;
    }>
  | Readonly<{ kind: 'invalid' }>;

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function scalar(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}

export function describeCapabilityCatalogIntegrity(value: unknown): CapabilityCatalogIntegrityView {
  const record = object(value);
  if (record.status === 'CATALOG_AUDIT_UNAVAILABLE') {
    return {
      kind: 'unavailable',
      status: record.status,
      unavailableDependency: text(record.unavailableDependency)
    };
  }
  if (record.status === 'CATALOG_HEALTHY' || record.status === 'CATALOG_INTEGRITY_FINDINGS') {
    if (
      typeof record.snapshotFingerprintSha256 !== 'string' ||
      typeof record.auditFingerprintSha256 !== 'string' ||
      !Array.isArray(record.findings)
    ) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'available',
      status: record.status,
      snapshotFingerprintSha256: record.snapshotFingerprintSha256,
      auditFingerprintSha256: record.auditFingerprintSha256,
      findings: record.findings.map(object)
    };
  }
  return { kind: 'invalid' };
}

function Finding({ finding }: { finding: JsonObject }) {
  const runtime = object(finding.runtimeCapability);
  const profiles = Array.isArray(finding.implementationProfiles)
    ? finding.implementationProfiles.map(object)
    : [];
  return (
    <li key={text(finding.findingId)}>
      <strong>{text(finding.code)}</strong> · {text(finding.findingId)} · capability{' '}
      {text(finding.capabilityId)} · fingerprint {text(finding.findingFingerprintSha256)}
      {Object.keys(runtime).length > 0
        ? ` · runtime ${text(runtime.runtimeCapabilityDefinitionId)} v${scalar(runtime.version)} (${text(runtime.capabilityId)}@${text(runtime.capabilityVersion)})`
        : ''}
      {profiles.length > 0 ? (
        <ul>
          {profiles.map((profile) => (
            <li key={`${text(profile.implementationProfileId)}:${scalar(profile.version)}`}>
              profile {text(profile.implementationProfileId)} v{scalar(profile.version)} ·{' '}
              {text(profile.status)} · {text(profile.capabilityId)}@
              {text(profile.capabilityVersion)} · {text(profile.implementationKey)}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function CapabilityCatalogIntegrity({ value }: { value: unknown }) {
  const view = describeCapabilityCatalogIntegrity(value);
  if (view.kind === 'invalid') {
    return (
      <Alert tone="warning" title="Capability catalog integrity owner truth unavailable">
        No valid catalogIntegrity owner projection is present. The console does not infer a healthy
        or empty catalog.
      </Alert>
    );
  }
  if (view.kind === 'unavailable') {
    return (
      <Alert tone="warning" title={view.status}>
        Audit dependency unavailable: {view.unavailableDependency}. Empty findings are not treated
        as healthy.
      </Alert>
    );
  }
  return (
    <Card>
      <h3>Capability catalog binding integrity</h3>
      <DataList
        items={[
          { label: 'Owner status', value: view.status },
          { label: 'Snapshot fingerprint', value: view.snapshotFingerprintSha256 },
          { label: 'Audit fingerprint', value: view.auditFingerprintSha256 },
          { label: 'Findings', value: String(view.findings.length) }
        ]}
      />
      {view.findings.length === 0 ? (
        view.status === 'CATALOG_HEALTHY' ? (
          <p>Owner reports CATALOG_HEALTHY with no structural catalog-binding findings.</p>
        ) : (
          <p>
            Owner reports CATALOG_INTEGRITY_FINDINGS with no bounded findings in this projection.
            The console does not reinterpret this as healthy.
          </p>
        )
      ) : (
        <ol>
          {view.findings.map((finding) => (
            <Finding key={text(finding.findingId)} finding={finding} />
          ))}
        </ol>
      )}
      <p>
        Catalog integrity is read-only structural owner truth. Healthy does not mean method
        correctness, production source admission, Recommendation suitability, product readiness or
        Official Truth. Findings do not authorize repair or remediation.
      </p>
    </Card>
  );
}
