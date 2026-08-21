import { appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const normalize = (value) => value.replaceAll('\\', '/').replace(/^\.\//, '');
const starts = (path, prefix) => path.startsWith(prefix);
const migrationName = (path) =>
  starts(path, 'infrastructure/persistence/migrations/') ? basename(path).toLowerCase() : '';

const paymentSpecific = (path) =>
  starts(path, 'services/payment/') ||
  /^apps\/gateway\/(src|tests)\/payment(?:-|\.|\/)/.test(path) ||
  /^packages\/contracts\/(src|tests)\/payment(?:\.|-|\/)/.test(path) ||
  migrationName(path).includes('payment');

const ownedMigration = (path, owner) => {
  const name = migrationName(path);
  if (!name) return false;
  if (owner === 'core') return /_(core|identity)_/.test(name);
  if (owner === 'lite') return name.includes('_lite_');
  if (owner === 'markreg') return name.includes('_markreg_');
  if (owner === 'execution') return name.includes('_execution_');
  if (owner === 'mgsn') return name.includes('_mgsn_');
  if (owner === 'capability') return name.includes('_capability_engine_');
  if (owner === 'payment') return name.includes('_payment_') || name.includes('payment');
  return false;
};

const knownOwnedMigration = (path) =>
  ['core', 'lite', 'markreg', 'execution', 'mgsn', 'capability', 'payment'].some((owner) =>
    ownedMigration(path, owner)
  );

export function classifyChangedFiles(rawFiles, options = {}) {
  const files = [...new Set(rawFiles.map(normalize).filter(Boolean))];
  const paymentSignal = files.some(paymentSpecific);
  const paymentAvailable = options.paymentAvailable ?? existsSync('services/payment/package.json');
  const workspaceTopology = files.some(
    (path) => path === 'turbo.json' || path === 'pnpm-workspace.yaml' || path === 'package.json'
  );

  const ciGovernance = files.some(
    (path) =>
      path === '.github/workflows/ci.yml' ||
      path === 'scripts/ci-detect-scope.mjs' ||
      path === 'scripts/ci-detect-scope.test.mjs'
  );
  const genericContracts = files.some(
    (path) =>
      starts(path, 'packages/contracts/') &&
      !paymentSpecific(path) &&
      !(path === 'packages/contracts/package.json' && paymentSignal)
  );
  const migrationOwnerMap = files.includes('infrastructure/persistence/migration-owners.json');
  const hasKnownOwnedMigration = files.some(knownOwnedMigration);
  const ownerMapWithoutOwnedMigration = migrationOwnerMap && !hasKnownOwnedMigration;
  const unknownMigration = files.some(
    (path) => starts(path, 'infrastructure/persistence/migrations/') && !knownOwnedMigration(path)
  );
  const persistenceSource = files.some((path) => starts(path, 'packages/persistence/'));
  const sharedRuntime = files.some(
    (path) =>
      starts(path, 'packages/service-kit/') ||
      starts(path, 'packages/events/') ||
      starts(path, 'packages/config/')
  );
  const shared =
    workspaceTopology ||
    ciGovernance ||
    genericContracts ||
    ownerMapWithoutOwnedMigration ||
    unknownMigration ||
    persistenceSource ||
    sharedRuntime;

  let core = files.some(
    (path) =>
      starts(path, 'services/core/') ||
      starts(path, 'services/knowledge/') ||
      ownedMigration(path, 'core') ||
      /^apps\/gateway\/(src|tests)\/(auth|account|workspace|session|identity|knowledge)(?:-|\.|\/)/.test(
        path
      )
  );
  let lite = files.some(
    (path) =>
      starts(path, 'services/lite/') ||
      ownedMigration(path, 'lite') ||
      /^apps\/gateway\/(src|tests)\/product-loop(?:-|\.|\/)/.test(path)
  );
  let capability = files.some(
    (path) =>
      starts(path, 'services/capability-engine/') ||
      ownedMigration(path, 'capability') ||
      /^apps\/gateway\/(src|tests)\/capability(?:-|\.|\/)/.test(path)
  );
  let markreg = files.some(
    (path) =>
      starts(path, 'services/markreg/') ||
      ownedMigration(path, 'markreg') ||
      /^apps\/gateway\/(src|tests)\/(order|markreg|matter|commercial|checkout)(?:-|\.|\/)/.test(
        path
      )
  );
  let execution = files.some(
    (path) =>
      starts(path, 'services/execution/') ||
      ownedMigration(path, 'execution') ||
      /^apps\/gateway\/(src|tests)\/(execution|professional|filing|evidence|document-package)(?:-|\.|\/)/.test(
        path
      )
  );
  let mgsn = files.some(
    (path) =>
      starts(path, 'services/mgsn/') ||
      ownedMigration(path, 'mgsn') ||
      /^apps\/gateway\/(src|tests)\/(mgsn|provider)(?:-|\.|\/)/.test(path)
  );
  let payment = paymentSignal || files.some((path) => ownedMigration(path, 'payment'));
  let gateway = files.some((path) => starts(path, 'apps/gateway/'));

  const web = files.some(
    (path) =>
      starts(path, 'apps/lite-web/') ||
      starts(path, 'apps/markreg-web/') ||
      starts(path, 'apps/operations-console/') ||
      starts(path, 'packages/ui/')
  );
  const browser =
    web ||
    files.some(
      (path) =>
        path.startsWith('tests/e2e/') ||
        /^playwright(?:\.|-)/.test(path) ||
        path.includes('playwright') ||
        path.includes('storybook')
    );

  const persistence =
    persistenceSource ||
    migrationOwnerMap ||
    files.some((path) => starts(path, 'infrastructure/persistence/migrations/'));

  if (shared) {
    core = true;
    lite = true;
    capability = true;
    markreg = true;
    execution = true;
    mgsn = true;
    gateway = true;
    if (paymentAvailable) payment = true;
  }

  // Execution's authenticated Professional Review lane validates MarkReg-owned matter state.
  // Keep that owner-domain dependency explicit so selective CI provisions the required database.
  if (execution) markreg = true;
  if (payment) gateway = true;

  const fullTypecheck = workspaceTopology || files.some((path) => path === 'tsconfig.base.json');
  const integration =
    core || lite || capability || markreg || execution || mgsn || payment || persistence || gateway;

  return {
    core,
    lite,
    capability,
    markreg,
    execution,
    mgsn,
    payment,
    web,
    gateway,
    persistence,
    shared,
    integration,
    browser,
    full_workspace: workspaceTopology,
    full_typecheck: fullTypecheck
  };
}

function parseArgs(argv) {
  const values = { full: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--full') values.full = true;
    else if (arg === '--base') values.base = argv[++index];
    else if (arg === '--head') values.head = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return values;
}

function writeOutputs(scope) {
  if (!process.env.GITHUB_OUTPUT) return;
  const lines = Object.entries(scope).map(([key, value]) => `${key}=${value ? 'true' : 'false'}`);
  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\n')}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.full) {
    const scope = {
      core: true,
      lite: true,
      capability: true,
      markreg: true,
      execution: true,
      mgsn: true,
      payment: existsSync('services/payment/package.json'),
      web: true,
      gateway: true,
      persistence: true,
      shared: true,
      integration: true,
      browser: true,
      full_workspace: true,
      full_typecheck: true
    };
    writeOutputs(scope);
    console.log(JSON.stringify({ mode: 'full', scope }, null, 2));
    return;
  }

  if (!args.base || !args.head)
    throw new Error('--base and --head are required unless --full is used.');
  const stdout = execFileSync('git', ['diff', '--name-only', args.base, args.head], {
    encoding: 'utf8'
  });
  const files = stdout.split(/\r?\n/).filter(Boolean);
  const scope = classifyChangedFiles(files);
  writeOutputs(scope);
  console.log(JSON.stringify({ base: args.base, head: args.head, files, scope }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
