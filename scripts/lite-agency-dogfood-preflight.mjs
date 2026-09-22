import { execFileSync } from 'node:child_process';

const args = new Set(process.argv.slice(2));
const strict = args.has('--strict');
const json = args.has('--json');
const rows = [];

function git(...parts) {
  return execFileSync('git', parts, { encoding: 'utf8' }).trim();
}

function hasEnv(name) {
  return Boolean(process.env[name]?.trim());
}

function add(name, status, detail) {
  rows.push({ name, status, detail });
}

async function probe(url, headers = {}) {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5000)
    });
    let body = null;
    try {
      body = await response.json();
    } catch {}
    return { ok: response.ok, status: response.status, body };
  } catch (error) {
    return {
      ok: false,
      status: null,
      body: null,
      error: error instanceof Error ? error.message : 'request failed'
    };
  }
}
const head = git('rev-parse', 'HEAD');
const originMain = git('rev-parse', 'origin/main');
const dirty = git('status', '--porcelain=v1').length > 0;
add(
  'Fresh main worktree',
  !dirty && head === originMain ? 'READY' : 'MISSING_RUNTIME',
  dirty
    ? 'worktree is dirty'
    : head === originMain
      ? 'HEAD matches origin/main'
      : 'HEAD does not match origin/main'
);

const databaseInputs = [
  'DATABASE_URL',
  'MARKREG_DATABASE_URL',
  'LITE_DATABASE_URL',
  'CAPABILITY_ENGINE_DATABASE_URL'
];
const missingDatabases = databaseInputs.filter((name) => !hasEnv(name));
add(
  'Owner database configuration',
  missingDatabases.length === 0 ? 'READY' : 'MISSING_OPERATOR_ACTION',
  missingDatabases.length === 0
    ? 'all owner database boundaries are configured'
    : `${missingDatabases.length} required owner database inputs are absent`
);

const sharedRuntimeReady =
  hasEnv('MO_INTERNAL_SERVICE_SECRET') &&
  (process.env.MO_INTERNAL_SERVICE_SECRET?.length ?? 0) >= 32 &&
  hasEnv('MO_CSRF_SECRET') &&
  hasEnv('WEB_ORIGINS');
add(
  'Shared runtime security configuration',
  sharedRuntimeReady ? 'READY' : 'MISSING_OPERATOR_ACTION',
  sharedRuntimeReady
    ? 'internal secret, CSRF secret and WEB_ORIGINS are configured'
    : 'strong internal secret, CSRF secret and WEB_ORIGINS must be configured'
);

const services = [
  ['Core', process.env.CORE_URL || 'http://127.0.0.1:4101'],
  ['Capability Engine', process.env.CAPABILITY_ENGINE_URL || 'http://127.0.0.1:4103'],
  ['MarkReg', process.env.MARKREG_URL || 'http://127.0.0.1:4105'],
  ['Lite', process.env.LITE_URL || 'http://127.0.0.1:4107'],
  ['Gateway', process.env.GATEWAY_URL || 'http://127.0.0.1:4000']
];

const serviceResults = new Map();
for (const [name, base] of services) {
  const result = await probe(new URL('/health', base).toString());
  serviceResults.set(name, result);
  add(
    name,
    result.ok ? 'READY' : 'MISSING_RUNTIME',
    result.ok
      ? 'health endpoint returned success'
      : `health unavailable${result.status ? ` (HTTP ${result.status})` : ''}`
  );
}
const dataEngineUrl = process.env.DATA_ENGINE_URL?.trim();
const dataEngineKey = process.env.DATA_ENGINE_API_KEY?.trim();
if (!dataEngineUrl || !dataEngineKey) {
  add(
    'Data Engine authenticated bridge',
    'MISSING_OPERATOR_ACTION',
    'DATA_ENGINE_URL and DATA_ENGINE_API_KEY must be injected'
  );
} else {
  const contractUrl = new URL('/api/v1/contract', dataEngineUrl).toString();
  const unauth = await probe(contractUrl);
  const auth = await probe(contractUrl, { Authorization: `Bearer ${dataEngineKey}` });
  const identityOk =
    auth.body?.contract_version === 'MARKORBIT_DATA_ENGINE_INTEGRATION_V1' &&
    auth.body?.source_owner === 'MARKORBIT_DATA_ENGINE';
  if (auth.ok && identityOk && [401, 403].includes(unauth.status)) {
    add(
      'Data Engine authenticated bridge',
      'READY',
      'authenticated contract is correct and unauthenticated access is rejected'
    );
  } else if (auth.ok && identityOk && unauth.ok) {
    add(
      'Data Engine authenticated bridge',
      'MISSING_OPERATOR_ACTION',
      'contract is reachable but integration authentication is not enforced'
    );
  } else {
    add(
      'Data Engine authenticated bridge',
      'MISSING_RUNTIME',
      `authenticated contract probe failed${auth.status ? ` (HTTP ${auth.status})` : ''}`
    );
  }
}

const graphRequired = [
  'MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED',
  'MO_MANAGED_COMMUNICATION_WORKSPACE_ID',
  'MO_MANAGED_COMMUNICATION_ACCOUNT_REF',
  'MO_MANAGED_COMMUNICATION_PROVIDER',
  'MO_MANAGED_COMMUNICATION_PROVIDER_ACCOUNT_REF',
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_TENANT_ID',
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_CLIENT_ID',
  'MO_MANAGED_COMMUNICATION_MICROSOFT_GRAPH_REFRESH_TOKEN'
];
const missingGraph = graphRequired.filter((name) => !hasEnv(name));
const graphModeReady =
  process.env.MO_MANAGED_COMMUNICATION_RUNTIME_ENABLED === '1' &&
  process.env.MO_MANAGED_COMMUNICATION_PROVIDER === 'MICROSOFT_GRAPH';
const capabilityHealthy = serviceResults.get('Capability Engine')?.ok === true;
add(
  'Outlook Account Binding',
  missingGraph.length === 0 && graphModeReady && capabilityHealthy
    ? 'READY'
    : 'MISSING_OPERATOR_ACTION',
  missingGraph.length > 0
    ? `${missingGraph.length} required binding/config inputs are absent`
    : !graphModeReady
      ? 'Managed Communication must be enabled with provider MICROSOFT_GRAPH'
      : capabilityHealthy
        ? 'binding inputs present and Capability Engine health is successful'
        : 'binding inputs present but Capability Engine is not running'
);

add(
  'Authorized real Workspace',
  'UNKNOWN',
  'verify through the supported authenticated Workspace onboarding/context endpoints'
);
add(
  'Controlled real inbound email + recipient',
  'MISSING_OPERATOR_ACTION',
  'Workspace/mailbox owner must supply the bounded real cohort'
);
add(
  'Step-8 provider dispatch authorization',
  process.env.MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED === '1'
    ? 'READY'
    : 'MISSING_OPERATOR_ACTION',
  process.env.MO_MANAGED_COMMUNICATION_PROVIDER_DISPATCH_AUTHORIZED === '1'
    ? 'dispatch authorization flag is enabled; human confirmation is still required'
    : 'provider dispatch authorization remains disabled or absent'
);

if (json) {
  console.log(JSON.stringify({ schemaVersion: 1, rows }, null, 2));
} else {
  console.log('| Prerequisite | Status | Detail |');
  console.log('| --- | --- | --- |');
  for (const row of rows) console.log(`| ${row.name} | ${row.status} | ${row.detail} |`);
}

if (strict && rows.some((row) => row.status !== 'READY')) process.exitCode = 2;