import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(scriptDir, '..');
export const REGISTRY_PATH = 'docs/architecture/cross-lane-journey-registry.v1.json';

export const MATURITY_STATES = Object.freeze([
  'LIVE',
  'DURABLE_NO_PRODUCT_CONSUMER',
  'OWNER_READY_NO_GATEWAY',
  'FIXTURE_ONLY',
  'CONTRACT_DRIFT',
  'SOURCE_UNAVAILABLE',
  'DEFERRED_BY_DESIGN'
]);

const REQUIRED_JOURNEY_IDS = Object.freeze([
  'J1_MARKREG_GOVERNED_PREPARATION',
  'J2_MGSN_GOVERNED_PROVIDER',
  'J3_COGNITIVE_CONTROL_PLANE_READ'
]);

const REQUIRED_REPORT_COLUMNS = Object.freeze([
  'Journey',
  'Consumer',
  'Gateway',
  'Owner',
  'Authority',
  'Persistence',
  'Proof',
  'Maturity',
  'Blocker'
]);

const PROOF_KINDS = new Set([
  'REAL_RUNTIME_E2E',
  'INTEGRATION_TEST',
  'OWNER_DURABILITY',
  'PRODUCT_TEST',
  'FIXTURE_TEST'
]);

const FORBIDDEN_DATA_KEYS = new Set([
  'rawPayload',
  'requestPayload',
  'requestBody',
  'rawEvidence',
  'evidenceBody',
  'secret',
  'credential',
  'token',
  'password',
  'customerData',
  'privateData'
]);

function record(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : null;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function pushError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function inspectForbiddenKeys(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => inspectForbiddenKeys(item, `${path}[${index}]`, errors));
    return;
  }
  const object = record(value);
  if (!object) return;
  for (const [key, child] of Object.entries(object)) {
    if (FORBIDDEN_DATA_KEYS.has(key))
      errors.push(`${path}.${key} is forbidden in journey metadata; store references only.`);
    inspectForbiddenKeys(child, `${path}.${key}`, errors);
  }
}

function validateFilePath(path, repoRoot, label, errors) {
  if (!nonEmptyString(path)) {
    errors.push(`${label} must be a non-empty repository-relative file path.`);
    return;
  }
  if (isAbsolute(path) || path.split('/').includes('..')) {
    errors.push(`${label} must stay inside the repository: ${path}`);
    return;
  }
  if (!existsSync(resolve(repoRoot, path))) errors.push(`${label} does not exist: ${path}`);
}

function validateRoute(route, label, errors) {
  pushError(errors, nonEmptyString(route) && route.startsWith('/'), `${label} must start with '/'.`);
}

function validateFilesAndRoutes(section, repoRoot, label, errors, { allowEmptyFiles = false } = {}) {
  const object = record(section);
  if (!object) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const files = array(object.files);
  if (!allowEmptyFiles) pushError(errors, files.length > 0, `${label}.files must not be empty.`);
  files.forEach((path, index) => validateFilePath(path, repoRoot, `${label}.files[${index}]`, errors));
  array(object.routes).forEach((route, index) => validateRoute(route, `${label}.routes[${index}]`, errors));
}

function validateProof(proof, repoRoot, label, errors) {
  const object = record(proof);
  if (!object) {
    errors.push(`${label} must be an object.`);
    return;
  }
  validateFilePath(object.file, repoRoot, `${label}.file`, errors);
  pushError(errors, PROOF_KINDS.has(object.kind), `${label}.kind is unsupported: ${String(object.kind)}`);
  pushError(errors, typeof object.fixtureOnly === 'boolean', `${label}.fixtureOnly must be boolean.`);
}

function validateBlocker(blocker, rootSha, label, errors) {
  const object = record(blocker);
  if (!object) {
    errors.push(`${label} must be an object.`);
    return;
  }
  pushError(
    errors,
    Number.isSafeInteger(object.issue) && object.issue > 0,
    `${label}.issue must be a positive integer.`
  );
  pushError(
    errors,
    object.observedState === 'OPEN' || object.observedState === 'CLOSED',
    `${label}.observedState must be OPEN or CLOSED.`
  );
  pushError(
    errors,
    object.verifiedAtMainSha === rootSha,
    `${label}.verifiedAtMainSha must equal lastVerifiedMainSha.`
  );
  pushError(errors, nonEmptyString(object.reason), `${label}.reason must be non-empty.`);
}

function validateJourney(journey, repoRoot, rootSha, errors) {
  const object = record(journey);
  if (!object) {
    errors.push('Each journey must be an object.');
    return;
  }
  const label = `journey ${String(object.id ?? '<missing>')}`;
  pushError(errors, nonEmptyString(object.id), `${label}.id must be non-empty.`);
  pushError(errors, nonEmptyString(object.title), `${label}.title must be non-empty.`);
  pushError(
    errors,
    MATURITY_STATES.includes(object.maturity),
    `${label}.maturity is unsupported: ${String(object.maturity)}`
  );

  const consumer = record(object.consumer);
  if (!consumer) errors.push(`${label}.consumer must be an object.`);
  else {
    pushError(
      errors,
      consumer.status === 'PRODUCT_CONSUMER_PRESENT' || consumer.status === 'NONE_ACCEPTED',
      `${label}.consumer.status must be PRODUCT_CONSUMER_PRESENT or NONE_ACCEPTED.`
    );
    validateFilesAndRoutes(consumer, repoRoot, `${label}.consumer`, errors, {
      allowEmptyFiles: consumer.status === 'NONE_ACCEPTED'
    });
    if (consumer.status === 'NONE_ACCEPTED') {
      pushError(errors, array(consumer.files).length === 0, `${label} has no accepted consumer but lists consumer files.`);
      pushError(errors, array(consumer.routes).length === 0, `${label} has no accepted consumer but lists consumer routes.`);
    }
  }

  validateFilesAndRoutes(object.gateway, repoRoot, `${label}.gateway`, errors, {
    allowEmptyFiles: object.maturity === 'OWNER_READY_NO_GATEWAY'
  });

  const owners = array(object.owners);
  pushError(errors, owners.length > 0, `${label}.owners must not be empty.`);
  owners.forEach((owner, index) => {
    const ownerObject = record(owner);
    if (!ownerObject) {
      errors.push(`${label}.owners[${index}] must be an object.`);
      return;
    }
    pushError(errors, nonEmptyString(ownerObject.owner), `${label}.owners[${index}].owner must be non-empty.`);
    validateFilesAndRoutes(ownerObject, repoRoot, `${label}.owners[${index}]`, errors);
  });

  const authority = record(object.authority);
  if (!authority) errors.push(`${label}.authority must be an object.`);
  else {
    pushError(errors, nonEmptyString(authority.class), `${label}.authority.class must be non-empty.`);
    pushError(errors, nonEmptyString(authority.notes), `${label}.authority.notes must be non-empty.`);
  }

  const persistence = record(object.persistence);
  if (!persistence) errors.push(`${label}.persistence must be an object.`);
  else {
    const persistenceFiles = array(persistence.files);
    persistenceFiles.forEach((path, index) =>
      validateFilePath(path, repoRoot, `${label}.persistence.files[${index}]`, errors)
    );
    pushError(errors, nonEmptyString(persistence.notes), `${label}.persistence.notes must be non-empty.`);
  }

  const proof = array(object.proof);
  proof.forEach((item, index) => validateProof(item, repoRoot, `${label}.proof[${index}]`, errors));
  const nonFixtureProof = proof.filter((item) => record(item)?.fixtureOnly === false);
  const productOrRuntimeProof = nonFixtureProof.filter((item) =>
    ['REAL_RUNTIME_E2E', 'PRODUCT_TEST'].includes(record(item)?.kind)
  );

  const blockers = array(object.blockers);
  blockers.forEach((item, index) => validateBlocker(item, rootSha, `${label}.blockers[${index}]`, errors));

  if (object.maturity === 'LIVE') {
    pushError(
      errors,
      consumer?.status === 'PRODUCT_CONSUMER_PRESENT' && array(consumer?.files).length > 0,
      `${label} is LIVE but has no accepted product consumer.`
    );
    pushError(errors, nonFixtureProof.length > 0, `${label} is LIVE but has only fixture proof.`);
    pushError(
      errors,
      productOrRuntimeProof.length > 0,
      `${label} is LIVE but has no product or real-runtime proof.`
    );
    pushError(errors, blockers.length === 0, `${label} is LIVE but still declares blockers.`);
  }

  if (object.maturity === 'DURABLE_NO_PRODUCT_CONSUMER') {
    pushError(
      errors,
      consumer?.status === 'NONE_ACCEPTED',
      `${label} is DURABLE_NO_PRODUCT_CONSUMER but claims an accepted consumer.`
    );
    pushError(errors, nonFixtureProof.length > 0, `${label} durable maturity has only fixture proof.`);
    pushError(errors, blockers.length > 0, `${label} durable maturity must name the current product blocker.`);
  }

  if (object.maturity === 'OWNER_READY_NO_GATEWAY') {
    pushError(
      errors,
      array(record(object.gateway)?.files).length === 0,
      `${label} is OWNER_READY_NO_GATEWAY but lists Gateway files.`
    );
  }

  if (object.maturity !== 'LIVE' && blockers.some((item) => record(item)?.observedState === 'CLOSED'))
    errors.push(`${label} remains ${object.maturity} while a declared blocker is CLOSED; review maturity before merge.`);

  pushError(
    errors,
    Array.isArray(object.forbiddenConsequences) && object.forbiddenConsequences.every(nonEmptyString),
    `${label}.forbiddenConsequences must be an array of non-empty strings.`
  );
}

export function validateRegistry(registry, { repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const errors = [];
  const root = record(registry);
  if (!root) return ['Registry must be a JSON object.'];

  pushError(errors, root.schemaVersion === 1, 'schemaVersion must equal 1.');
  pushError(
    errors,
    typeof root.lastVerifiedMainSha === 'string' && /^[a-f0-9]{40}$/.test(root.lastVerifiedMainSha),
    'lastVerifiedMainSha must be a 40-character lowercase Git SHA.'
  );
  pushError(
    errors,
    JSON.stringify(root.reportColumns) === JSON.stringify(REQUIRED_REPORT_COLUMNS),
    'reportColumns must match the V1 generated report contract.'
  );

  const journeys = array(root.journeys);
  pushError(errors, journeys.length === 3, 'V1 registry must contain exactly three golden journeys.');
  const ids = journeys.map((journey) => record(journey)?.id).filter(Boolean);
  pushError(errors, new Set(ids).size === ids.length, 'Journey ids must be unique.');
  pushError(
    errors,
    JSON.stringify([...ids].sort()) === JSON.stringify([...REQUIRED_JOURNEY_IDS].sort()),
    `V1 journey ids must be exactly: ${REQUIRED_JOURNEY_IDS.join(', ')}.`
  );

  journeys.forEach((journey) => validateJourney(journey, repoRoot, root.lastVerifiedMainSha, errors));
  inspectForbiddenKeys(root, 'registry', errors);
  return errors;
}

export function loadRegistry({ repoRoot = DEFAULT_REPO_ROOT } = {}) {
  const path = resolve(repoRoot, REGISTRY_PATH);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function markdown(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
}

function sectionSummary(section) {
  const object = record(section) ?? {};
  const files = array(object.files);
  const routes = array(object.routes);
  const pieces = [];
  if (nonEmptyString(object.status)) pieces.push(object.status);
  if (files.length) pieces.push(`${files.length} file ref${files.length === 1 ? '' : 's'}`);
  if (routes.length) pieces.push(routes.join(', '));
  return pieces.length ? pieces.join(' · ') : 'None';
}

export function renderReport(registry) {
  const journeys = array(record(registry)?.journeys);
  const lines = [
    `| ${REQUIRED_REPORT_COLUMNS.join(' | ')} |`,
    `| ${REQUIRED_REPORT_COLUMNS.map(() => '---').join(' | ')} |`
  ];
  for (const journey of journeys) {
    const object = record(journey) ?? {};
    const owners = array(object.owners)
      .map((owner) => record(owner)?.owner)
      .filter(nonEmptyString)
      .join(', ');
    const authority = record(object.authority)?.class ?? 'Unavailable';
    const persistence = record(object.persistence);
    const persistenceFiles = array(persistence?.files);
    const proof = array(object.proof)
      .map((item) => record(item)?.kind)
      .filter(nonEmptyString)
      .join(', ');
    const blockers = array(object.blockers)
      .map((item) => {
        const blocker = record(item) ?? {};
        return Number.isSafeInteger(blocker.issue)
          ? `#${blocker.issue}:${String(blocker.observedState ?? 'UNKNOWN')}`
          : 'invalid blocker';
      })
      .join(', ');
    const cells = [
      `${object.id ?? 'UNKNOWN'} — ${object.title ?? ''}`,
      sectionSummary(object.consumer),
      sectionSummary(object.gateway),
      owners || 'Unavailable',
      authority,
      `${persistenceFiles.length} file ref${persistenceFiles.length === 1 ? '' : 's'}`,
      proof || 'None',
      object.maturity ?? 'UNKNOWN',
      blockers || 'None'
    ].map(markdown);
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return `${lines.join('\n')}\n`;
}

function main(argv) {
  const allowed = new Set(['--report']);
  const unknown = argv.find((arg) => !allowed.has(arg));
  if (unknown) throw new Error(`Unknown argument: ${unknown}`);
  const registry = loadRegistry();
  const errors = validateRegistry(registry);
  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  if (argv.includes('--report')) process.stdout.write(renderReport(registry));
  else console.log(`Cross-Lane Journey Registry V${registry.schemaVersion} is valid (${registry.journeys.length} journeys).`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main(process.argv.slice(2));
