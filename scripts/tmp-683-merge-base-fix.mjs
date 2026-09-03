import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const current = readFileSync(path, 'utf8');
  if (!current.includes(before)) {
    throw new Error(`Expected patch anchor missing in ${path}: ${before.slice(0, 80)}`);
  }
  if (current.indexOf(before) !== current.lastIndexOf(before)) {
    throw new Error(`Patch anchor is not unique in ${path}: ${before.slice(0, 80)}`);
  }
  writeFileSync(path, current.replace(before, after));
}

const detector = 'scripts/ci-detect-scope.mjs';

replaceOnce(
  detector,
  "const browserProfessionalReviewSpecific = (path) =>\n",
  `const markregWebProductionRuntimeSpecific = (path) =>\n  path === 'apps/markreg-web/src/ProductionIntakePlanning.tsx' ||\n  path === 'apps/markreg-web/src/WorkspaceHome.tsx' ||\n  /^apps\\/markreg-web\\/src\\/api\\/(?!.*(?:\\.test|\\.spec)\\.)[^/]+\\.(?:ts|tsx)$/.test(path);\n\nconst browserProfessionalReviewSpecific = (path) =>\n`
);

replaceOnce(
  detector,
  "  const securityAuthority = files.some(securityAuthoritySpecific);\n  const highRiskRoot =\n",
  "  const securityAuthority = files.some(securityAuthoritySpecific);\n  const markregProductionRuntime = files.some(markregWebProductionRuntimeSpecific);\n  const highRiskRoot =\n"
);

replaceOnce(
  detector,
  "  let markreg = files.some(\n    (path) =>\n      starts(path, 'services/markreg/') ||\n      ownedMigration(path, 'markreg') ||\n",
  "  let markreg = files.some(\n    (path) =>\n      starts(path, 'services/markreg/') ||\n      ownedMigration(path, 'markreg') ||\n      markregWebProductionRuntimeSpecific(path) ||\n"
);

replaceOnce(
  detector,
  "    securityAuthority ||\n    mgsnDurability ||\n",
  "    securityAuthority ||\n    markregProductionRuntime ||\n    mgsnDurability ||\n"
);

replaceOnce(
  detector,
  "function parseArgs(argv) {\n  const values = { full: false };\n",
  "function parseArgs(argv) {\n  const values = { full: false, mergeBase: false };\n"
);

replaceOnce(
  detector,
  "    if (arg === '--full') values.full = true;\n    else if (arg === '--base') values.base = argv[++index];\n",
  "    if (arg === '--full') values.full = true;\n    else if (arg === '--merge-base') values.mergeBase = true;\n    else if (arg === '--base') values.base = argv[++index];\n"
);

replaceOnce(
  detector,
  "function writeOutputs(scope) {\n  if (!process.env.GITHUB_OUTPUT) return;\n  const lines = Object.entries(scope).map(([key, value]) => `${key}=${value ? 'true' : 'false'}`);\n  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\\n')}\\n`);\n}\n",
  "function writeOutputs(scope, metadata = {}) {\n  if (!process.env.GITHUB_OUTPUT) return;\n  const lines = [\n    ...Object.entries(scope).map(([key, value]) => `${key}=${value ? 'true' : 'false'}`),\n    ...Object.entries(metadata).map(([key, value]) => `${key}=${value ?? ''}`)\n  ];\n  appendFileSync(process.env.GITHUB_OUTPUT, `${lines.join('\\n')}\\n`);\n}\n"
);

replaceOnce(
  detector,
  "function main() {\n",
  `export function changedFilesBetween(base, head, options = {}) {\n  const cwd = options.cwd ?? process.cwd();\n  const baseline = options.mergeBase\n    ? execFileSync('git', ['merge-base', base, head], { encoding: 'utf8', cwd }).trim()\n    : base;\n  if (!baseline) throw new Error('Unable to resolve CI diff baseline.');\n  const stdout = execFileSync('git', ['diff', '--name-only', baseline, head], {\n    encoding: 'utf8',\n    cwd\n  });\n  return { baseline, files: stdout.split(/\\r?\\n/).filter(Boolean) };\n}\n\nfunction main() {\n`
);

replaceOnce(
  detector,
  "  const stdout = execFileSync('git', ['diff', '--name-only', args.base, args.head], {\n    encoding: 'utf8'\n  });\n  const files = stdout.split(/\\r?\\n/).filter(Boolean);\n  const scope = classifyChangedFiles(files);\n  writeOutputs(scope);\n  console.log(JSON.stringify({ base: args.base, head: args.head, files, scope }, null, 2));\n",
  "  const { baseline, files } = changedFilesBetween(args.base, args.head, {\n    mergeBase: args.mergeBase\n  });\n  const scope = classifyChangedFiles(files);\n  writeOutputs(scope, { baseline_sha: baseline });\n  console.log(\n    JSON.stringify(\n      { base: args.base, baseline, head: args.head, mergeBase: args.mergeBase, files, scope },\n      null,\n      2\n    )\n  );\n"
);

const tests = 'scripts/ci-detect-scope.test.mjs';
replaceOnce(
  tests,
  "import assert from 'node:assert/strict';\nimport test from 'node:test';\nimport { classifyChangedFiles } from './ci-detect-scope.mjs';\n",
  "import assert from 'node:assert/strict';\nimport { execFileSync } from 'node:child_process';\nimport { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';\nimport { tmpdir } from 'node:os';\nimport { dirname, join } from 'node:path';\nimport test from 'node:test';\nimport { changedFilesBetween, classifyChangedFiles } from './ci-detect-scope.mjs';\n\nfunction git(cwd, args) {\n  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();\n}\n\nfunction commitFile(cwd, path, content, message) {\n  const absolute = join(cwd, path);\n  mkdirSync(dirname(absolute), { recursive: true });\n  writeFileSync(absolute, content);\n  git(cwd, ['add', path]);\n  git(cwd, ['commit', '-m', message]);\n  return git(cwd, ['rev-parse', 'HEAD']);\n}\n\nfunction createDivergedRepository() {\n  const cwd = mkdtempSync(join(tmpdir(), 'markorbit-ci-scope-'));\n  git(cwd, ['init']);\n  git(cwd, ['config', 'user.email', 'ci-scope@example.test']);\n  git(cwd, ['config', 'user.name', 'CI Scope Test']);\n  commitFile(cwd, 'README.md', 'root\\n', 'root');\n  const root = git(cwd, ['rev-parse', 'HEAD']);\n  git(cwd, ['branch', 'feature']);\n  commitFile(cwd, 'packages/contracts/src/main-drift.ts', 'export const drift = true;\\n', 'main drift');\n  const base = git(cwd, ['rev-parse', 'HEAD']);\n  git(cwd, ['checkout', 'feature']);\n  return { cwd, root, base };\n}\n"
);

const syntheticTests = `\n\ntest('PR merge-base scope ignores high-risk changes that landed only on main after branch cut', () => {\n  const { cwd, root, base } = createDivergedRepository();\n  try {\n    const featurePath = 'apps/lite-web/src/features/content-studio/Panel.tsx';\n    const head = commitFile(cwd, featurePath, 'export const Panel = () => null;\\n', 'lite feature');\n    const { baseline, files } = changedFilesBetween(base, head, { mergeBase: true, cwd });\n    assert.equal(baseline, root);\n    assert.deepEqual(files, [featurePath]);\n    const scope = classifyChangedFiles(files);\n    assert.equal(scope.web, true);\n    assert.equal(scope.browser, true);\n    assert.equal(scope.postgres, false);\n    assert.equal(scope.hard_gate, false);\n    assert.equal(scope.l3_full, false);\n  } finally {\n    rmSync(cwd, { recursive: true, force: true });\n  }\n});\n\ntest('PR merge-base scope still selects L3 for a real shared change on the feature branch', () => {\n  const { cwd, root, base } = createDivergedRepository();\n  try {\n    const featurePath = 'packages/contracts/src/feature-contract.ts';\n    const head = commitFile(cwd, featurePath, 'export const featureContract = true;\\n', 'shared feature');\n    const { baseline, files } = changedFilesBetween(base, head, { mergeBase: true, cwd });\n    assert.equal(baseline, root);\n    assert.deepEqual(files, [featurePath]);\n    const scope = classifyChangedFiles(files);\n    assert.equal(scope.shared, true);\n    assert.equal(scope.hard_gate, true);\n    assert.equal(scope.l3_full, true);\n  } finally {\n    rmSync(cwd, { recursive: true, force: true });\n  }\n});\n\ntest('MarkReg production API/runtime entry changes require MarkReg Hard Gate while visual-only edits stay light', () => {\n  for (const path of [\n    'apps/markreg-web/src/api/production-intake.ts',\n    'apps/markreg-web/src/ProductionIntakePlanning.tsx',\n    'apps/markreg-web/src/WorkspaceHome.tsx'\n  ]) {\n    const scope = classifyChangedFiles([path]);\n    assert.equal(scope.markreg, true, path);\n    assert.equal(scope.hard_gate, true, path);\n    assert.equal(scope.l3_full, true, path);\n  }\n\n  for (const path of [\n    'apps/markreg-web/src/ProductionIntakePlanning.stories.tsx',\n    'apps/markreg-web/src/ProductionIntakePlanning.test.tsx',\n    'apps/markreg-web/src/production-intake.css'\n  ]) {\n    const scope = classifyChangedFiles([path]);\n    assert.equal(scope.web, true, path);\n    assert.equal(scope.hard_gate, false, path);\n    assert.equal(scope.l3_full, false, path);\n  }\n});\n`;
writeFileSync(tests, `${readFileSync(tests, 'utf8').trimEnd()}${syntheticTests}\n`);

const workflow = '.github/workflows/ci.yml';
replaceOnce(
  workflow,
  "      full_typecheck: ${{ steps.scope.outputs.full_typecheck }}\n",
  "      full_typecheck: ${{ steps.scope.outputs.full_typecheck }}\n      baseline_sha: ${{ steps.scope.outputs.baseline_sha }}\n"
);
replaceOnce(
  workflow,
  "            node scripts/ci-detect-scope.mjs --base \"$PR_BASE_SHA\" --head \"$PR_HEAD_SHA\"\n",
  "            node scripts/ci-detect-scope.mjs --base \"$PR_BASE_SHA\" --head \"$PR_HEAD_SHA\" --merge-base\n"
);
replaceOnce(
  workflow,
  "          BASE_SHA: ${{ github.event.pull_request.base.sha }}\n          HEAD_SHA: ${{ github.event.pull_request.head.sha }}\n",
  "          BASE_SHA: ${{ needs.detect.outputs.baseline_sha }}\n          HEAD_SHA: ${{ github.event.pull_request.head.sha }}\n"
);
replaceOnce(
  workflow,
  "          BASE_SHA: ${{ github.event.pull_request.base.sha }}\n        run: pnpm exec turbo run lint typecheck test --filter=\"...[$BASE_SHA]\"\n",
  "          BASE_SHA: ${{ needs.detect.outputs.baseline_sha }}\n        run: pnpm exec turbo run lint typecheck test --filter=\"...[$BASE_SHA]\"\n"
);
replaceOnce(
  workflow,
  "          BASE_SHA: ${{ github.event.pull_request.base.sha }}\n        run: pnpm exec turbo run build --filter=\"...[$BASE_SHA]\"\n",
  "          BASE_SHA: ${{ needs.detect.outputs.baseline_sha }}\n        run: pnpm exec turbo run build --filter=\"...[$BASE_SHA]\"\n"
);

const policy = '.github/CI_VALIDATION_POLICY.md';
replaceOnce(
  policy,
  "- auth, tenant, CSRF, principal, authority, Official Truth, Filing, Payment, Provider, Method activation, and Capability authority surfaces;\n",
  "- auth, tenant, CSRF, principal, authority, Official Truth, Filing, Payment, Provider, Method activation, and Capability authority surfaces;\n- MarkReg Web production API wiring and production runtime entry points that bind durable/authority-bearing sources;\n"
);
replaceOnce(
  policy,
  "`scripts/ci-detect-scope.mjs` is the single scope authority for the central merge gate. Unknown or ambiguous root/shared/migration/security paths broaden coverage. A path must never silently disappear from validation merely because it is new.\n\nScope-map changes are themselves CI-governance changes and therefore require L3.\n",
  "`scripts/ci-detect-scope.mjs` is the single scope authority for the central merge gate. Unknown or ambiguous root/shared/migration/security paths broaden coverage. A path must never silently disappear from validation merely because it is new.\n\nFor pull requests, the authoritative change set is **PR merge-base → exact head**. The detector emits that resolved baseline and L1 changed-file formatting plus Turbo affected closure must reuse the same SHA. A moving current base tip must never be used as a two-dot PR diff because main-only drift is not part of the feature change. Main pushes keep exact `github.event.before → github.sha` semantics.\n\nScope-map changes are themselves CI-governance changes and therefore require L3.\n"
);
replaceOnce(
  policy,
  "- **UI-only code:** expect affected UI validation and relevant browser scope; unrelated PostgreSQL lanes are not started.\n",
  "- **UI-only code:** expect affected UI validation and relevant browser scope; unrelated PostgreSQL lanes are not started. MarkReg visual/story/test/CSS-only edits remain in this class.\n- **MarkReg Web production runtime/API wiring:** expect MarkReg semantic coverage plus Hard Gate/L3 because these paths can bind durable or authority-bearing production sources.\n"
);

console.log('Applied #683 merge-base scope regression fix.');
