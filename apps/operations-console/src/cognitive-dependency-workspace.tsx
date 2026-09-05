import { Alert, Card, DataList } from '@markorbit/ui';
import { cognitiveDependencyTargetId } from './cognitive-attention.js';
import {
  CAPABILITY_INTEGRITY_BOUNDARY,
  buildCapabilityDependencyPaths,
  buildCoreDependencyPaths,
  type CognitiveDependencyPath
} from './cognitive-dependency-paths.js';

type JsonObject = Record<string, unknown>;

type OwnerReadResult =
  | Readonly<{ status: 'available'; value: JsonObject }>
  | Readonly<{
      status: 'unavailable';
      error: Readonly<{ status: number | null; code: string; message: string }>;
    }>;

export interface CognitiveDependencySnapshot {
  core: OwnerReadResult;
  capability: OwnerReadResult;
}

function Evidence({ path }: { path: CognitiveDependencyPath }) {
  return (
    <details>
      <summary>Evidence and lineage</summary>
      {path.evidence.length === 0 ? (
        <p>No additional owner evidence fields are established for this path.</p>
      ) : (
        <DataList items={path.evidence.map((item) => ({ label: item.label, value: item.value }))} />
      )}
    </details>
  );
}

function DependencyPath({ path }: { path: CognitiveDependencyPath }) {
  return (
    <div id={cognitiveDependencyTargetId(path.id)}>
      <Card>
        <h4>{path.title}</h4>
        <p>
          <strong>{path.kind}</strong> · {path.owner}
        </p>
        <DataList
          items={[
            { label: 'What is true now', value: path.currentState },
            { label: 'Why / blocker', value: path.why },
            { label: 'What it affects', value: path.affects },
            { label: 'Owner / dependency', value: path.dependency }
          ]}
        />
        <Evidence path={path} />
      </Card>
    </div>
  );
}

function OwnerUnavailable({ owner, result }: { owner: string; result: OwnerReadResult }) {
  if (result.status !== 'unavailable') return null;
  const { error } = result;
  return (
    <Alert tone="warning" title={`${owner} dependency explanation unavailable`}>
      {error.status === null ? error.code : `HTTP ${error.status} · ${error.code}`} ·{' '}
      {error.message} This owner failure is independent; it is not converted into aggregate health
      or an empty dependency set.
    </Alert>
  );
}

function CorePaths({ result }: { result: OwnerReadResult }) {
  if (result.status === 'unavailable') return <OwnerUnavailable owner="Core" result={result} />;
  const paths = buildCoreDependencyPaths(result.value);
  return (
    <section aria-labelledby="core-cognitive-dependencies-heading">
      <h3 id="core-cognitive-dependencies-heading">Core · Brain / Method Improvement</h3>
      {paths.length === 0 ? (
        <p>
          No Core blocker or limitation path is established by the current bounded projection. This
          is not a healthy, ready or complete conclusion.
        </p>
      ) : (
        paths.map((path) => <DependencyPath key={path.id} path={path} />)
      )}
    </section>
  );
}

function CapabilityPaths({ result }: { result: OwnerReadResult }) {
  if (result.status === 'unavailable')
    return <OwnerUnavailable owner="Capability Engine" result={result} />;
  const paths = buildCapabilityDependencyPaths(result.value);
  return (
    <section aria-labelledby="capability-cognitive-dependencies-heading">
      <h3 id="capability-cognitive-dependencies-heading">
        Capability Engine · runtime / source policy
      </h3>
      <Alert tone="info" title="Integrity boundary">
        {CAPABILITY_INTEGRITY_BOUNDARY}
      </Alert>
      {paths.length === 0 ? (
        <p>
          No Capability blocker or limitation path is established by the current bounded projection.
          This is not a healthy, current, correct or production-ready conclusion.
        </p>
      ) : (
        paths.map((path) => <DependencyPath key={path.id} path={path} />)
      )}
    </section>
  );
}

export function CognitiveDependencyWorkspace({
  snapshot
}: {
  snapshot: CognitiveDependencySnapshot;
}) {
  return (
    <section aria-labelledby="cognitive-dependency-heading">
      <Card>
        <h2 id="cognitive-dependency-heading">Why cognitive work is blocked or limited</h2>
        <p>
          Explanation paths organize only the two loaded owner projections. They do not create a new
          owner, health score, readiness decision or mutation authority. Read top-to-bottom as
          current state → reason → bounded impact → owner dependency; open evidence only when
          provenance is needed.
        </p>
      </Card>
      <div className="mo-grid">
        <CorePaths result={snapshot.core} />
        <CapabilityPaths result={snapshot.capability} />
      </div>
    </section>
  );
}
