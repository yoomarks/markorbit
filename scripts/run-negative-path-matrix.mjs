import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { milestoneNegativePathAdapters as adapters } from '../tests/integration/milestone-negative-path-adapters.mjs';

const descriptors = JSON.parse(
  fs.readFileSync('tests/integration/milestone-001-negative-path-matrix.json', 'utf8')
);
const requestedIndex = process.argv.indexOf('--case');
const requested = requestedIndex === -1 ? undefined : process.argv[requestedIndex + 1];
if (requestedIndex !== -1 && !requested) throw new Error('--case requires a case ID');

const selected = requested ? adapters.filter(({ caseId }) => caseId === requested) : adapters;
if (requested && selected.length === 0) throw new Error(`Unknown negative-path case: ${requested}`);

const packages = {
  'services/markreg/': '@markorbit/markreg-service',
  'services/execution/': '@markorbit/execution-service',
  'apps/gateway/': '@markorbit/gateway'
};

function packageFor(file) {
  const entry = Object.entries(packages).find(([prefix]) => file.startsWith(prefix));
  if (!entry) throw new Error(`No workspace package registered for ${file}`);
  return entry[1];
}

function runEvidence(caseId, boundary, evidence) {
  const workspace = packageFor(evidence.file);
  const relativeFile = evidence.file.replace(
    /^(services\/markreg|services\/execution|apps\/gateway)\//,
    ''
  );
  console.log(`\n[${caseId}] ${boundary} boundary: ${evidence.file} :: ${evidence.pattern}`);
  const result = spawnSync(
    'pnpm',
    ['--filter', workspace, 'exec', 'vitest', 'run', relativeFile, '-t', evidence.pattern],
    { stdio: 'inherit', env: process.env }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`[${caseId}] ${boundary} referenced test PASS`);
}

const descriptorIds = new Set(descriptors.map(({ caseId }) => caseId));
for (const adapter of selected) {
  if (!descriptorIds.has(adapter.caseId)) throw new Error(`Missing descriptor: ${adapter.caseId}`);
  runEvidence(adapter.caseId, 'Service', adapter.service);
  runEvidence(adapter.caseId, 'Gateway HTTP', adapter.gateway);
  console.log(
    `[${adapter.caseId}] evidence execution PASS; descriptor-specific semantic completeness remains subject to the final evidence audit`
  );
}

const coverage = spawnSync('node', ['scripts/validate-negative-path-matrix.mjs'], {
  stdio: 'inherit',
  env: process.env
});
if (coverage.error) throw coverage.error;
if (coverage.status !== 0) process.exit(coverage.status ?? 1);
console.log(`${selected.length} selected descriptor evidence pair(s) executed`);
