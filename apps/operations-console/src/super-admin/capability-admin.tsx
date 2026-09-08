import { useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';
import { CapabilityCatalogIntegrity } from '../capability-catalog-integrity.js';
import { CognitiveOwnerReadError, loadCapabilityCognitiveOwner } from '../cognitive-platform.js';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
function objects(value: unknown): readonly JsonObject[] {
  return Array.isArray(value) ? value.map(object) : [];
}
function text(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}
function scalar(value: unknown, fallback = 'Unavailable'): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : fallback;
}
function count(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Unavailable';
}

export interface CapabilityAdminViewModel {
  owner: string;
  authority: string;
  policyAuthority: string;
  runtimeCount: string;
  profileCount: string;
  policyCount: string;
  runtimeCapabilities: readonly JsonObject[];
  implementationProfiles: readonly JsonObject[];
  sourcePolicies: readonly JsonObject[];
  catalogIntegrity: unknown;
  sourcePolicyBindingIntegrity: JsonObject;
}

export function buildCapabilityAdminViewModel(value: unknown): CapabilityAdminViewModel {
  const root = object(value);
  const source = object(root.source);
  const policySource = object(root.sourceAdmissionPolicySource);
  const summary = object(root.summary);
  return {
    owner: text(source.domain, 'CAPABILITY_ENGINE'),
    authority: text(source.authority, 'Owner projection'),
    policyAuthority: text(policySource.authority),
    runtimeCount: count(summary.runtimeCapabilityCount),
    profileCount: count(summary.implementationProfileCount),
    policyCount: count(summary.sourceAdmissionPolicyCount),
    runtimeCapabilities: objects(root.runtimeCapabilities),
    implementationProfiles: objects(root.implementationProfiles),
    sourcePolicies: objects(root.sourceAdmissionPolicies),
    catalogIntegrity: root.catalogIntegrity,
    sourcePolicyBindingIntegrity: object(root.sourcePolicyBindingIntegrity)
  };
}

function SourcePolicyBindingIntegrity({ value }: { value: JsonObject }) {
  const status = text(value.status, 'UNAVAILABLE');
  if (status === 'SOURCE_POLICY_BINDING_AUDIT_UNAVAILABLE') {
    return (
      <Alert tone="warning" title={status}>
        Audit dependency unavailable: {text(value.unavailableDependency)}. This is not a healthy or
        empty binding state.
      </Alert>
    );
  }
  if (status === 'SOURCE_POLICY_BINDINGS_HEALTHY') {
    return (
      <Card>
        <h3>Source-policy binding integrity</h3>
        <DataList
          items={[
            { label: 'Owner status', value: status },
            { label: 'Snapshot fingerprint', value: text(value.snapshotFingerprintSha256) },
            { label: 'Audit fingerprint', value: text(value.auditFingerprintSha256) },
            { label: 'Findings', value: String(objects(value.findings).length) }
          ]}
        />
        <p>
          Healthy structural binding does not establish Method/Reference currentness, method
          correctness, Recommendation suitability or product readiness.
        </p>
      </Card>
    );
  }
  if (status === 'SOURCE_POLICY_BINDING_FINDINGS') {
    const findings = objects(value.findings);
    return (
      <Card>
        <h3>Source-policy binding integrity</h3>
        <DataList
          items={[
            { label: 'Owner status', value: status },
            { label: 'Snapshot fingerprint', value: text(value.snapshotFingerprintSha256) },
            { label: 'Audit fingerprint', value: text(value.auditFingerprintSha256) },
            { label: 'Findings', value: String(findings.length) }
          ]}
        />
        <ol>
          {findings.map((finding) => {
            const policy = object(finding.policy);
            return (
              <li key={text(finding.findingId)}>
                <strong>{text(finding.code)}</strong> · {text(finding.findingId)} · policy{' '}
                {text(policy.policyId)} v{scalar(policy.policyVersion)} · fingerprint{' '}
                {text(policy.policyFingerprintSha256)}
              </li>
            );
          })}
        </ol>
        <p>Findings are owner audit truth only and do not authorize repair or promotion.</p>
      </Card>
    );
  }
  return (
    <Alert tone="warning" title="Source-policy binding owner truth unavailable">
      No recognized sourcePolicyBindingIntegrity owner status is present. The console does not infer
      healthy, empty or production-admissible state.
    </Alert>
  );
}

function CapabilityOwnerTruth({ value }: { value: JsonObject }) {
  const model = buildCapabilityAdminViewModel(value);
  return (
    <>
      <Card>
        <h3 id="capability-admin-overview">Overview</h3>
        <DataList
          items={[
            { label: 'Owner', value: model.owner },
            { label: 'Authority', value: model.authority },
            { label: 'Policy authority', value: model.policyAuthority },
            { label: 'Runtime Capabilities', value: model.runtimeCount },
            { label: 'Implementation Profiles', value: model.profileCount },
            { label: 'Source admission policies', value: model.policyCount }
          ]}
        />
      </Card>
      <Card>
        <h3 id="capability-admin-registry">Runtime Capability Registry</h3>
        {model.runtimeCapabilities.length === 0 ? (
          <p>Capability Engine returned a known-empty current Runtime Capability inventory.</p>
        ) : (
          <ol>
            {model.runtimeCapabilities.map((capability) => (
              <li
                key={text(capability.runtimeCapabilityDefinitionId, text(capability.capabilityId))}
              >
                <strong>{text(capability.title, text(capability.capabilityId))}</strong> ·{' '}
                {text(capability.capabilityId)}@{text(capability.capabilityVersion)} · definition v
                {scalar(capability.version)}
              </li>
            ))}
          </ol>
        )}
        <p>Runtime reachability or execution success is not method correctness.</p>
      </Card>
      <Card>
        <h3 id="capability-admin-implementations">Implementation Profiles</h3>
        {model.implementationProfiles.length === 0 ? (
          <p>Capability Engine returned a known-empty current Implementation Profile inventory.</p>
        ) : (
          <ol>
            {model.implementationProfiles.map((profile) => (
              <li key={`${text(profile.implementationProfileId)}:${scalar(profile.version)}`}>
                <strong>{text(profile.implementationProfileId)}</strong> v{scalar(profile.version)}{' '}
                · {text(profile.status)} · {text(profile.capabilityId)}@
                {text(profile.capabilityVersion)} · {text(profile.kind)}
              </li>
            ))}
          </ol>
        )}
        <p>
          APPROVED is lifecycle truth only; it is not production source admission or correctness.
        </p>
      </Card>
      <Card>
        <h3 id="capability-admin-admission">Admission / Source Policy</h3>
        {model.sourcePolicies.length === 0 ? (
          <p>Capability Engine returned a known-empty current source-admission policy inventory.</p>
        ) : (
          <ol>
            {model.sourcePolicies.map((policy) => (
              <li key={`${text(policy.policyId)}:${scalar(policy.policyVersion)}`}>
                <strong>{text(policy.policyId)}</strong> v{scalar(policy.policyVersion)} ·{' '}
                {text(policy.maturityClass)} · {text(policy.capabilityId)}@
                {text(policy.capabilityVersion)} · fingerprint{' '}
                {text(policy.policyFingerprintSha256)}
              </li>
            ))}
          </ol>
        )}
      </Card>
      <section id="capability-admin-integrity">
        <CapabilityCatalogIntegrity value={model.catalogIntegrity} />
        <SourcePolicyBindingIntegrity value={model.sourcePolicyBindingIntegrity} />
      </section>
      <Card>
        <h3 id="capability-admin-runtime">Runtime & Observations</h3>
        <p>
          This bounded owner projection does not establish a unified runtime success, quality or
          correctness score. No absent observation data is represented as zero or healthy.
        </p>
      </Card>
      <Card>
        <h3 id="capability-admin-audit">Audit</h3>
        <p>
          V1 is read-only. Exact ids, versions, policy fingerprints and owner integrity fingerprints
          remain visible evidence. No admit, register, retire, repair or policy mutation is exposed.
        </p>
      </Card>
    </>
  );
}

export function CapabilityAdminWorkspace() {
  const [value, setValue] = useState<JsonObject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setValue(await loadCapabilityCognitiveOwner());
    } catch (cause) {
      setValue(null);
      setError(
        cause instanceof CognitiveOwnerReadError
          ? `${cause.status === null ? cause.code : `HTTP ${cause.status} · ${cause.code}`} · ${cause.message}`
          : cause instanceof Error
            ? cause.message
            : 'Capability Engine owner truth is unavailable.'
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="super-admin-capability" aria-labelledby="super-admin-capability-heading">
      <PageHeader
        title="Capability"
        description="Runtime Capability, Implementation Profile, source-policy and integrity administration from bounded Capability Engine owner truth."
      />
      <Alert tone="info" title="Read-only owner truth">
        Reuses exact control-plane:cognitive:read authority. No capability-admin wildcard, browser
        recomputation of integrity or mutation authority is introduced.
      </Alert>
      <nav aria-label="Capability administration">
        <a href="#capability-admin-overview">Overview</a>
        {' · '}
        <a href="#capability-admin-registry">Registry</a>
        {' · '}
        <a href="#capability-admin-implementations">Implementations</a>
        {' · '}
        <a href="#capability-admin-runtime">Runtime & Observations</a>
        {' · '}
        <a href="#capability-admin-admission">Admission</a>
        {' · '}
        <a href="#capability-admin-integrity">Dependencies & Integrity</a>
        {' · '}
        <a href="#capability-admin-audit">Audit</a>
      </nav>
      <Card>
        <h3 id="super-admin-capability-heading">Current Capability Engine snapshot</h3>
        <p>Owner unavailable, known-empty, healthy-integrity and finding states remain distinct.</p>
        <Button disabled={busy} onClick={() => void load()}>
          {busy
            ? 'Loading Capability owner truth…'
            : value
              ? 'Reload Capability owner truth'
              : 'Load Capability owner truth'}
        </Button>
      </Card>
      {error ? (
        <Alert tone="warning" title="Capability Engine owner read unavailable">
          {error}
        </Alert>
      ) : null}
      {!value && !error ? (
        <p>No Capability owner snapshot loaded. Load owner truth to determine current state.</p>
      ) : null}
      {value ? <CapabilityOwnerTruth value={value} /> : null}
    </section>
  );
}
