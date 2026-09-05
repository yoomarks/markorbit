import { useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';
import { CapabilityCatalogIntegrity } from './capability-catalog-integrity.js';
import { CognitiveAttentionWorkspace } from './cognitive-attention-workspace.js';
import { CognitiveDependencyWorkspace } from './cognitive-dependency-workspace.js';

type JsonObject = Record<string, unknown>;

export interface CognitiveOwnerReadFailure {
  status: number | null;
  code: string;
  message: string;
}

export type CognitiveOwnerReadResult =
  | Readonly<{ status: 'available'; value: JsonObject }>
  | Readonly<{ status: 'unavailable'; error: CognitiveOwnerReadFailure }>;

export interface CognitivePlatformSnapshot {
  core: CognitiveOwnerReadResult;
  capability: CognitiveOwnerReadResult;
}

export class CognitiveOwnerReadError extends Error {
  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'CognitiveOwnerReadError';
  }
}

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

function count(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value}` : 'Unavailable';
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string') return 'Unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function failure(cause: unknown): CognitiveOwnerReadFailure {
  if (cause instanceof CognitiveOwnerReadError)
    return { status: cause.status, code: cause.code, message: cause.message };
  return {
    status: null,
    code: 'COGNITIVE_OWNER_UNAVAILABLE',
    message: cause instanceof Error ? cause.message : 'Cognitive owner truth is unavailable.'
  };
}

async function readOwner(path: string): Promise<JsonObject> {
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'include',
      headers: { accept: 'application/json' }
    });
  } catch (cause) {
    throw new CognitiveOwnerReadError(
      null,
      'COGNITIVE_OWNER_TRANSPORT_UNAVAILABLE',
      cause instanceof Error ? cause.message : 'Cognitive owner transport is unavailable.'
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new CognitiveOwnerReadError(
      response.status,
      'COGNITIVE_OWNER_RESPONSE_INVALID',
      `Cognitive owner returned non-JSON HTTP ${response.status}.`
    );
  }

  const record = object(value);
  if (!response.ok) {
    throw new CognitiveOwnerReadError(
      response.status,
      text(record.code, `HTTP_${response.status}`),
      text(record.message, text(record.code, `Request failed with HTTP ${response.status}.`))
    );
  }
  return record;
}

export function loadCoreCognitiveOwner(): Promise<JsonObject> {
  return readOwner('/api/internal/control-plane/cognitive/brain');
}

export function loadCapabilityCognitiveOwner(): Promise<JsonObject> {
  return readOwner('/api/internal/control-plane/cognitive/capabilities');
}

export async function loadCognitivePlatformSnapshot(): Promise<CognitivePlatformSnapshot> {
  const [core, capability] = await Promise.allSettled([
    loadCoreCognitiveOwner(),
    loadCapabilityCognitiveOwner()
  ]);
  return {
    core:
      core.status === 'fulfilled'
        ? { status: 'available', value: core.value }
        : { status: 'unavailable', error: failure(core.reason) },
    capability:
      capability.status === 'fulfilled'
        ? { status: 'available', value: capability.value }
        : { status: 'unavailable', error: failure(capability.reason) }
  };
}

export function describeBrainBuildRuns(value: unknown): Readonly<{
  title: string;
  detail: string;
}> {
  const record = object(value);
  if (record.availability === 'NOT_DURABLY_RECORDED' && record.inventory === null) {
    return {
      title: 'Durable Brain Build Run inventory is not recorded',
      detail:
        'Core explicitly reports NOT_DURABLY_RECORDED. This is not zero runs, healthy, ready or an empty history.'
    };
  }
  if (typeof record.availability === 'string') {
    return {
      title: `Owner availability: ${record.availability}`,
      detail: Array.isArray(record.inventory)
        ? `Core supplied ${record.inventory.length} durable Brain Build Run record(s). No readiness is inferred.`
        : 'Core supplied a different bounded availability state. No run count or readiness is inferred.'
    };
  }
  return {
    title: 'Brain Build Run availability unavailable',
    detail:
      'No valid owner availability field is present; the console does not infer an empty inventory.'
  };
}

function OwnerUnavailable({ owner, error }: { owner: string; error: CognitiveOwnerReadFailure }) {
  return (
    <Alert tone="warning" title={`${owner} cognitive read unavailable`}>
      {error.status === null ? error.code : `HTTP ${error.status} · ${error.code}`} ·{' '}
      {error.message}
    </Alert>
  );
}

function CoreInventory({ value }: { value: JsonObject }) {
  const source = object(value.source);
  const summary = object(value.summary);
  const assets = objects(value.brainAssets);
  const gaps = objects(value.brainGaps);
  const improvements = objects(value.methodImprovements);
  const buildRuns = describeBrainBuildRuns(value.brainBuildRuns);

  return (
    <>
      <Card>
        <h3>Core cognitive owner</h3>
        <DataList
          items={[
            { label: 'Owner domain', value: text(source.domain, 'CORE') },
            { label: 'Authority', value: text(source.authority, 'Owner projection') },
            { label: 'Generated', value: timestamp(value.generatedAt) },
            { label: 'Brain Assets', value: count(summary.brainAssetCount) },
            { label: 'BrainGaps', value: count(summary.brainGapCount) },
            { label: 'Open BrainGaps', value: count(summary.openBrainGapCount) },
            {
              label: 'Method Improvement admissions',
              value: count(summary.methodImprovementAdmissionCount)
            }
          ]}
        />
      </Card>

      <Card>
        <h3>Brain Assets</h3>
        {assets.length === 0 ? (
          <p>Core returned no current Brain Asset records in this bounded owner projection.</p>
        ) : (
          <ol>
            {assets.map((asset) => {
              const confidence = object(asset.confidence);
              return (
                <li key={text(asset.brainAssetVersionId, text(asset.brainAssetId))}>
                  <strong>{text(asset.brainAssetId)}</strong> · {text(asset.assetType)} ·{' '}
                  {text(asset.status)} · v{count(asset.version)} · confidence{' '}
                  {count(confidence.score)} {text(confidence.band, '')}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Card>
        <h3>BrainGap</h3>
        {gaps.length === 0 ? (
          <p>Core returned no current BrainGap records in this bounded owner projection.</p>
        ) : (
          <ol>
            {gaps.map((gap) => (
              <li key={text(gap.brainGapRegistryKey)}>
                <strong>{text(gap.brainGapRegistryKey)}</strong> · {text(gap.status)} ·{' '}
                {text(gap.gapType)} · severity {text(gap.severity)} · {text(gap.targetModule)} ·{' '}
                {text(gap.reasonCode)} · occurrences {count(gap.occurrenceCount)}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <h3>Method Improvement admissions</h3>
        {improvements.length === 0 ? (
          <p>Core returned no admitted Method Improvement trigger / Research Mission pairs.</p>
        ) : (
          <ol>
            {improvements.map((improvement) => {
              const trigger = object(improvement.trigger);
              const mission = object(improvement.researchMission);
              return (
                <li key={text(trigger.triggerId, text(mission.researchMissionId))}>
                  <strong>{text(trigger.triggerType)}</strong> · {text(trigger.triggerId)} ·
                  admitted {timestamp(trigger.admittedAt)} · mission{' '}
                  {text(mission.researchMissionId)}
                </li>
              );
            })}
          </ol>
        )}
      </Card>

      <Alert tone="info" title={buildRuns.title}>
        {buildRuns.detail}
      </Alert>
    </>
  );
}

function CapabilityInventory({ value }: { value: JsonObject }) {
  const source = object(value.source);
  const policySource = object(value.sourceAdmissionPolicySource);
  const summary = object(value.summary);
  const capabilities = objects(value.runtimeCapabilities);
  const profiles = objects(value.implementationProfiles);
  const policies = objects(value.sourceAdmissionPolicies);

  return (
    <>
      <Card>
        <h3>Capability Engine cognitive owner</h3>
        <DataList
          items={[
            { label: 'Owner domain', value: text(source.domain, 'CAPABILITY_ENGINE') },
            { label: 'Authority', value: text(source.authority, 'Owner projection') },
            { label: 'Policy authority', value: text(policySource.authority, 'Unavailable') },
            { label: 'Generated', value: timestamp(value.generatedAt) },
            { label: 'Runtime Capabilities', value: count(summary.runtimeCapabilityCount) },
            {
              label: 'Implementation Profiles',
              value: count(summary.implementationProfileCount)
            },
            { label: 'Source admission policies', value: count(summary.sourceAdmissionPolicyCount) }
          ]}
        />
      </Card>

      <CapabilityCatalogIntegrity value={value.catalogIntegrity} />

      <Card>
        <h3>Runtime Capabilities</h3>
        {capabilities.length === 0 ? (
          <p>Capability Engine returned no current Runtime Capability records.</p>
        ) : (
          <ol>
            {capabilities.map((capability) => (
              <li
                key={text(capability.runtimeCapabilityDefinitionId, text(capability.capabilityId))}
              >
                <strong>{text(capability.title, text(capability.capabilityId))}</strong> ·{' '}
                {text(capability.capabilityId)}@{text(capability.capabilityVersion)} · definition v
                {count(capability.version)}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <Card>
        <h3>Implementation Profiles</h3>
        {profiles.length === 0 ? (
          <p>Capability Engine returned no current Implementation Profile records.</p>
        ) : (
          <ol>
            {profiles.map((profile) => (
              <li key={text(profile.implementationProfileId)}>
                <strong>{text(profile.implementationProfileId)}</strong> · {text(profile.status)} ·{' '}
                {text(profile.capabilityId)}@{text(profile.capabilityVersion)} ·{' '}
                {text(profile.kind)} · max risk {text(profile.maximumRiskClass)}
              </li>
            ))}
          </ol>
        )}
        <p>
          APPROVED is owner lifecycle status only. It is not method correctness, Recommendation
          suitability or production source admission.
        </p>
      </Card>

      <Card>
        <h3>Source admission policies</h3>
        {policies.length === 0 ? (
          <p>Capability Engine returned no current source-admission policy records.</p>
        ) : (
          <ol>
            {policies.map((policy) => {
              const currentness = object(policy.currentnessRequirements);
              return (
                <li key={`${text(policy.policyId)}:${count(policy.policyVersion)}`}>
                  <strong>{text(policy.policyId)}</strong> v{count(policy.policyVersion)} ·{' '}
                  {text(policy.maturityClass)} · {text(policy.capabilityId)}@
                  {text(policy.capabilityVersion)}
                  {' · '}fingerprint {text(policy.policyFingerprintSha256)}
                  {policy.maturityClass === 'PRODUCTION_ADMISSIBLE'
                    ? ` · currentness method ${text(currentness.method)} / reference ${text(currentness.reference)}`
                    : ` · ${text(policy.reason)}`}
                </li>
              );
            })}
          </ol>
        )}
        <p>
          Source-admission policy maturity/currentness is displayed exactly as owner truth. It does
          not create Recommendation, Filing, legal or Official Truth authority.
        </p>
      </Card>
    </>
  );
}

export function CognitivePlatformWorkspace() {
  const [snapshot, setSnapshot] = useState<CognitivePlatformSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setBusy(true);
    try {
      setSnapshot(await loadCognitivePlatformSnapshot());
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="cognitive-platform" aria-labelledby="cognitive-platform-heading">
      <PageHeader
        title="Cognitive attention and owner truth"
        description="Attention-first, read-only Control Center for Brain, Method Improvement and Capability owner truth: what needs attention, why, what it affects, and the exact bounded dependency before audit detail."
      />
      <Alert tone="info" title="Read plane only">
        This surface does not mutate Brain or Capability state and does not synthesize cross-owner
        health, correctness, readiness or approval. Each owner remains authoritative for its own
        bounded projection.
      </Alert>
      <Card>
        <h3 id="cognitive-platform-heading">Current owner snapshots</h3>
        <p>
          Reads use the authenticated HttpOnly operator session through the bounded Gateway. No
          Workspace scope or browser-authored owner principal is sent.
        </p>
        <Button disabled={busy} onClick={() => void load()}>
          {busy ? 'Loading owner truth…' : snapshot ? 'Reload owner truth' : 'Load owner truth'}
        </Button>
      </Card>

      {!snapshot ? (
        <p>No cognitive owner snapshot loaded. Load owner truth to determine current state.</p>
      ) : (
        <>
          <CognitiveAttentionWorkspace snapshot={snapshot} />
          <CognitiveDependencyWorkspace snapshot={snapshot} />
          <Card>
            <h2>Owner inventory and audit detail</h2>
            <p>
              The inventory below remains the owner-detail view. Attention and dependency
              explanations above do not replace or reinterpret these records.
            </p>
          </Card>
          <div className="mo-grid">
            <div>
              {snapshot.core.status === 'available' ? (
                <CoreInventory value={snapshot.core.value} />
              ) : (
                <OwnerUnavailable owner="Core" error={snapshot.core.error} />
              )}
            </div>
            <div>
              {snapshot.capability.status === 'available' ? (
                <CapabilityInventory value={snapshot.capability.value} />
              ) : (
                <OwnerUnavailable owner="Capability Engine" error={snapshot.capability.error} />
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
