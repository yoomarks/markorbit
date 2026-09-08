import { useState } from 'react';
import { Alert, Button, Card, DataList, PageHeader } from '@markorbit/ui';
import {
  CognitiveOwnerReadError,
  describeBrainBuildRuns,
  loadCoreCognitiveOwner
} from '../cognitive-platform.js';

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
function number(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Unavailable';
}
function timestamp(value: unknown): string {
  if (typeof value !== 'string') return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export interface BrainAdminViewModel {
  owner: string;
  authority: string;
  generatedAt: string;
  assetCount: string;
  gapCount: string;
  openGapCount: string;
  improvementCount: string;
  assets: readonly JsonObject[];
  gaps: readonly JsonObject[];
  improvements: readonly JsonObject[];
  buildRuns: Readonly<{ title: string; detail: string }>;
}

export function buildBrainAdminViewModel(value: unknown): BrainAdminViewModel {
  const root = object(value);
  const source = object(root.source);
  const summary = object(root.summary);
  return {
    owner: text(source.domain, 'CORE'),
    authority: text(source.authority, 'Owner projection'),
    generatedAt: timestamp(root.generatedAt),
    assetCount: number(summary.brainAssetCount),
    gapCount: number(summary.brainGapCount),
    openGapCount: number(summary.openBrainGapCount),
    improvementCount: number(summary.methodImprovementAdmissionCount),
    assets: objects(root.brainAssets),
    gaps: objects(root.brainGaps),
    improvements: objects(root.methodImprovements),
    buildRuns: describeBrainBuildRuns(root.brainBuildRuns)
  };
}

function BrainOwnerTruth({ value }: { value: JsonObject }) {
  const model = buildBrainAdminViewModel(value);
  return (
    <>
      <Card>
        <h3 id="brain-admin-overview">Overview</h3>
        <DataList
          items={[
            { label: 'Owner', value: model.owner },
            { label: 'Authority', value: model.authority },
            { label: 'Generated', value: model.generatedAt },
            { label: 'Brain Assets', value: model.assetCount },
            { label: 'BrainGaps', value: model.gapCount },
            { label: 'Open BrainGaps', value: model.openGapCount },
            { label: 'Method Improvement admissions', value: model.improvementCount }
          ]}
        />
      </Card>
      <Card>
        <h3 id="brain-admin-assets">Assets</h3>
        {model.assets.length === 0 ? (
          <p>Core returned a known-empty current Brain Asset inventory.</p>
        ) : (
          <ol>
            {model.assets.map((asset) => (
              <li key={text(asset.brainAssetVersionId, text(asset.brainAssetId))}>
                <strong>{text(asset.brainAssetId)}</strong> · {text(asset.assetType)} ·{' '}
                {text(asset.status)} · v{number(asset.version)}
              </li>
            ))}
          </ol>
        )}
        <p>
          Lifecycle status is owner truth only; it is not method correctness or production
          readiness.
        </p>
      </Card>
      <Card>
        <h3 id="brain-admin-gaps">Gaps</h3>
        {model.gaps.length === 0 ? (
          <p>Core returned a known-empty current BrainGap inventory.</p>
        ) : (
          <ol>
            {model.gaps.map((gap) => (
              <li key={text(gap.brainGapRegistryKey)}>
                <strong>{text(gap.brainGapRegistryKey)}</strong> · {text(gap.status)} ·{' '}
                {text(gap.gapType)} · severity {text(gap.severity)} · {text(gap.reasonCode)}
              </li>
            ))}
          </ol>
        )}
        <p>A BrainGap does not imply Method Improvement approval or a product consequence.</p>
      </Card>
      <Card>
        <h3 id="brain-admin-research">Research / Method Improvements</h3>
        {model.improvements.length === 0 ? (
          <p>Core returned no admitted Method Improvement trigger / Research Mission pairs.</p>
        ) : (
          <ol>
            {model.improvements.map((item) => {
              const trigger = object(item.trigger);
              const mission = object(item.researchMission);
              return (
                <li key={text(trigger.triggerId, text(mission.researchMissionId))}>
                  <strong>{text(trigger.triggerType)}</strong> · trigger {text(trigger.triggerId)} ·
                  mission {text(mission.researchMissionId)} · admitted{' '}
                  {timestamp(trigger.admittedAt)}
                </li>
              );
            })}
          </ol>
        )}
        <p>
          Research Mission lineage does not establish a candidate, validated method or ACTIVE Brain
          asset.
        </p>
      </Card>
      <Alert tone="info" title={model.buildRuns.title}>
        {model.buildRuns.detail}
      </Alert>
      <Card>
        <h3 id="brain-admin-governance">Governance & Audit</h3>
        <p>
          This V1 slice is read-only. IDs, versions, timestamps and owner lineage remain the audit
          evidence available from the bounded projection. No activate, degrade, retire, research or
          build command is exposed here.
        </p>
      </Card>
    </>
  );
}

export function BrainAdminWorkspace() {
  const [value, setValue] = useState<JsonObject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setValue(await loadCoreCognitiveOwner());
    } catch (cause) {
      const message =
        cause instanceof CognitiveOwnerReadError
          ? `${cause.status === null ? cause.code : `HTTP ${cause.status} · ${cause.code}`} · ${cause.message}`
          : cause instanceof Error
            ? cause.message
            : 'Core cognitive owner truth is unavailable.';
      setError(message);
      setValue(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section id="super-admin-brain" aria-labelledby="super-admin-brain-heading">
      <PageHeader
        title="Brain"
        description="Platform-wide Brain assets, gaps, Method Improvement lineage and build-recording availability from bounded Core owner truth."
      />
      <Alert tone="info" title="Read-only owner truth">
        Uses the existing Cognitive Platform read boundary and exact control-plane:cognitive:read
        authority. No Brain admin wildcard, synthetic intelligence score or mutation authority is
        introduced.
      </Alert>
      <nav aria-label="Brain administration">
        <a href="#brain-admin-overview">Overview</a>
        {' · '}
        <a href="#brain-admin-assets">Assets</a>
        {' · '}
        <a href="#brain-admin-gaps">Gaps</a>
        {' · '}
        <a href="#brain-admin-research">Research / Method Improvements</a>
        {' · '}
        <a href="#brain-admin-builds">Builds / Availability</a>
        {' · '}
        <a href="#brain-admin-governance">Governance & Audit</a>
      </nav>
      <Card>
        <h3 id="super-admin-brain-heading">Current Core snapshot</h3>
        <p>Owner unavailable, known-empty and NOT_DURABLY_RECORDED remain distinct states.</p>
        <Button disabled={busy} onClick={() => void load()}>
          {busy
            ? 'Loading Core owner truth…'
            : value
              ? 'Reload Core owner truth'
              : 'Load Core owner truth'}
        </Button>
      </Card>
      {error ? (
        <Alert tone="warning" title="Core Brain owner read unavailable">
          {error}
        </Alert>
      ) : null}
      {!value && !error ? (
        <p>No Brain owner snapshot loaded. Load owner truth to determine current state.</p>
      ) : null}
      {value ? (
        <>
          <BrainOwnerTruth value={value} />
          <span id="brain-admin-builds" aria-hidden="true" />
        </>
      ) : null}
    </section>
  );
}
