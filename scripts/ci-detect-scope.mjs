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

const productLoopSpecific = (path) => {
  const name = migrationName(path);
  return (
    /^apps\/gateway\/(src|tests)\/product-loop(?:-|\.|\/)/.test(path) ||
    /^services\/lite\/(src|tests)\/(?:.*(?:product-loop|content-preparation|candidate-qualification|prepared-action|daily-|preference|conversion-analytics|trademark-asset|visual-bridge|content-kit)).*/.test(
      path
    ) ||
    /^services\/markreg\/(src|tests)\/formal-opportunity(?:-|\.|\/)/.test(path) ||
    /^packages\/contracts\/(src|tests)\/(?:product-loop|daily-source|daily-workspace|trademark-asset-workspace)(?:\.|-|\/)/.test(
      path
    ) ||
    /(?:lite_(?:content|candidate|product_loop|prepared|daily|trademark_asset|visual)|markreg_formal_opportunity)/.test(
      name
    ) ||
    path.includes('product-loop') ||
    path.includes('daily-workspace')
  );
};

const securityAuthoritySpecific = (path) =>
  /(?:^|\/)(?:auth|csrf|tenant|principal|authority|official-truth|filing|method-activation|provider-authority)(?:-|\.|\/)/.test(
    path
  ) ||
  /^apps\/gateway\/(src|tests)\/(?:auth|session|identity|filing|payment|provider)(?:-|\.|\/)/.test(
    path
  ) ||
  /^services\/capability-engine\//.test(path) ||
  /^packages\/contracts\/(src|tests)\/(?:.*(?:authority|official-truth|filing|payment|provider|capability|activation)).*/.test(
    path
  );

const browserProfessionalReviewSpecific = (path) =>
  path.includes('professional-review') || path.includes('professional_review');
const browserDocumentPackageSpecific = (path) =>
  path.includes('document-package') || path.includes('document_package');
const browserOrderJourneySpecific = (path) =>
  path.includes('order-journey') || path.includes('OrderJourney') || path.includes('order_journey');
const browserProductLoopSpecific = (path) =>
  productLoopSpecific(path) || path.includes('trademark-asset') || path.includes('prepared-action');

const docsOnlyPath = (path) =>
  starts(path, 'docs/') ||
  path === 'README.md' ||
  path === 'CONTRIBUTING.md' ||
  path.endsWith('.md');

const knownRootFile = (path) =>
  [
    'package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
    'turbo.json',
    'tsconfig.base.json',
    'eslint.config.mjs',
    'prettier.config.mjs',
    '.prettierrc',
    '.prettierignore',
    '.gitignore'
  ].includes(path) || /^playwright(?:\.|-)/.test(path);

const recognizedPath = (path) =>
  docsOnlyPath(path) ||
  knownRootFile(path) ||
  ['.github/', 'apps/', 'services/', 'packages/', 'infrastructure/', 'scripts/', 'tests/'].some(
    (prefix) => starts(path, prefix)
  );

export function classifyChangedFiles(rawFiles, options = {}) {
  const files = [...new Set(rawFiles.map(normalize).filter(Boolean))];
  const paymentSignal = files.some(paymentSpecific);
  const paymentAvailable = options.paymentAvailable ?? existsSync('services/payment/package.json');
  const docsOnly = files.length > 0 && files.every(docsOnlyPath);

  const workspaceTopology = files.some(
    (path) => path === 'turbo.json' || path === 'pnpm-workspace.yaml' || path === 'package.json'
  );
  const dependencyTopology = files.some((path) => path === 'pnpm-lock.yaml');
  const compilerConfiguration = files.some((path) => path === 'tsconfig.base.json');
  const ciGovernance = files.some(
    (path) =>
      starts(path, '.github/workflows/') ||
      starts(path, '.github/actions/') ||
      path === 'scripts/ci-detect-scope.mjs' ||
      path === 'scripts/ci-detect-scope.test.mjs'
  );
  const unknownPath = files.some((path) => !recognizedPath(path));
  const ambiguousScript = files.some(
    (path) => starts(path, 'scripts/') && !productLoopSpecific(path) && !ciGovernance
  );

  const genericContracts = files.some(
    (path) =>
      starts(path, 'packages/contracts/') &&
      !paymentSpecific(path) &&
      !(path === 'packages/contracts/package.json' && paymentSignal)
  );
  const sharedPackage = files.some(
    (path) =>
      starts(path, 'packages/') && !paymentSpecific(path) && !starts(path, 'packages/contracts/')
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
  const securityAuthority = files.some(securityAuthoritySpecific);
  const highRiskRoot =
    workspaceTopology || dependencyTopology || compilerConfiguration || ciGovernance || unknownPath;

  const shared =
    highRiskRoot ||
    genericContracts ||
    sharedPackage ||
    ownerMapWithoutOwnedMigration ||
    unknownMigration ||
    persistenceSource ||
    sharedRuntime ||
    ambiguousScript;

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

  let browserProfessionalReview = files.some(browserProfessionalReviewSpecific);
  let browserDocumentPackage = files.some(browserDocumentPackageSpecific);
  let browserOrderJourney = files.some(browserOrderJourneySpecific);
  let browserProductLoop = files.some(browserProductLoopSpecific) && web;
  let browserExplicit = files.some(
    (path) =>
      starts(path, 'tests/e2e/') ||
      /^playwright(?:\.|-)/.test(path) ||
      path.includes('playwright') ||
      path.includes('storybook')
  );
  let browserGeneric =
    web &&
    !browserProfessionalReview &&
    !browserDocumentPackage &&
    !browserOrderJourney &&
    !browserProductLoop;

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
  if (execution) markreg = true;
  if (payment) gateway = true;

  const productLoop =
    files.some(productLoopSpecific) ||
    (shared && files.some((path) => starts(path, 'packages/contracts/')));
  const mgsnDurability = files.some(
    (path) =>
      ownedMigration(path, 'mgsn') ||
      /^services\/mgsn\/(?:src|tests)\/.*(?:postgres|persistence|repository|durab)/.test(path)
  );

  const hardGate =
    shared ||
    persistence ||
    securityAuthority ||
    mgsnDurability ||
    files.some((path) => starts(path, 'packages/contracts/'));

  if (hardGate && web) {
    browserExplicit = true;
    browserGeneric = browserGeneric || web;
  }

  const browser =
    browserExplicit ||
    browserGeneric ||
    browserProfessionalReview ||
    browserDocumentPackage ||
    browserOrderJourney ||
    browserProductLoop;
  const postgres =
    core || lite || capability || markreg || execution || mgsn || payment || persistence;
  const integration = postgres || gateway;
  const fullTypecheck = workspaceTopology || compilerConfiguration || dependencyTopology;
  const l1Fast = !docsOnly;
  const l2Merge = integration || browser || hardGate;
  const l3Full = hardGate || highRiskRoot;

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
    postgres,
    browser,
    browser_generic: browserGeneric,
    browser_professional_review: browserProfessionalReview,
    browser_document_package: browserDocumentPackage,
    browser_order_journey: browserOrderJourney,
    browser_product_loop: browserProductLoop,
    product_loop: productLoop,
    mgsn_durability: mgsnDurability,
    hard_gate: hardGate,
    l1_fast: l1Fast,
    l2_merge: l2Merge,
    l3_full: l3Full,
    full_workspace: workspaceTopology || dependencyTopology || ciGovernance || unknownPath,
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

function fullScope() {
  return {
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
    postgres: true,
    browser: true,
    browser_generic: true,
    browser_professional_review: true,
    browser_document_package: true,
    browser_order_journey: true,
    browser_product_loop: true,
    product_loop: true,
    mgsn_durability: true,
    hard_gate: true,
    l1_fast: true,
    l2_merge: true,
    l3_full: true,
    full_workspace: true,
    full_typecheck: true
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.full) {
    const scope = fullScope();
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
