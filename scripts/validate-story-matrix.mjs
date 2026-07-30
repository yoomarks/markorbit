import fs from 'node:fs';
import assert from 'node:assert/strict';
const manifest = JSON.parse(
  fs.readFileSync('docs/quality/MO-MVP-MILESTONE-001-STORY-MATRIX.json', 'utf8')
);
assert.equal(manifest.cells.length, 99);
const stages = new Set(manifest.cells.map((x) => `${x.application}:${x.workflowStage}`));
for (const stage of stages) {
  const cells = manifest.cells.filter((x) => `${x.application}:${x.workflowStage}` === stage);
  assert(
    cells.some((x) => x.governedState === 'mobile-390' && x.applicable && x.storyId),
    `${stage} lacks 390px story`
  );
}
for (const cell of manifest.cells) {
  for (const key of [
    'application',
    'workflowStage',
    'governedState',
    'applicable',
    'viewportCategory',
    'authorityWarningCoverage',
    'sourceFixtureType'
  ])
    assert.ok(Object.hasOwn(cell, key), `${key} missing`);
  if (cell.applicable) {
    assert.ok(cell.storyId);
    const app = cell.application.replace('-web', '');
    const source = fs.readFileSync(
      `apps/${cell.application}/src/MilestoneStateMatrix.stories.tsx`,
      'utf8'
    );
    const exportName = cell.storyId
      .split('--')[1]
      .split('-')
      .map((x) => x[0].toUpperCase() + x.slice(1))
      .join('');
    assert.match(source, new RegExp(`export const ${exportName}:`), cell.storyId);
    if (cell.governedState === 'long-content')
      assert.match(
        source,
        /International Cooperative Association[\s\S]*supporting-document-version-00000042\.pdf/
      );
  } else assert.ok(cell.rationale);
}
console.log(
  `story matrix PASS: ${manifest.cells.length} cells; ${manifest.cells.filter((x) => x.applicable).length} applicable; ${manifest.cells.filter((x) => !x.applicable).length} N/A`
);
const negative = JSON.parse(
  fs.readFileSync('tests/integration/milestone-001-negative-path-matrix.json', 'utf8')
);
assert.equal(negative.length, 17);
for (const row of negative)
  for (const key of [
    'caseId',
    'stage',
    'precondition',
    'attemptedAction',
    'expectedDomainErrorCode',
    'expectedGatewayHttpStatus',
    'expectedGatewayErrorCode',
    'mutationSideEffectExpectation',
    'authorityConsequenceExpectation',
    'immutableRecords'
  ])
    assert.ok(row[key] !== undefined, `${row.caseId}: ${key} missing`);
const inventory = JSON.parse(
  fs.readFileSync('docs/architecture/GATEWAY_ROUTE_INVENTORY.json', 'utf8')
);
for (const row of inventory.routes)
  for (const key of [
    'method',
    'path',
    'owner',
    'namespaceClass',
    'authenticationMode',
    'environmentScope',
    'idempotencyRequirement',
    'authorityConsequenceResponse',
    'httpIntegrationTestFile'
  ])
    assert.ok(row[key], `${row.method} ${row.path}: ${key} missing`);
console.log(
  `negative-path descriptors PASS: ${negative.length}; route inventory PASS: ${inventory.routes.length}`
);
