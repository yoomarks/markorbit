import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_REPO_ROOT,
  loadRegistry,
  renderReport,
  validateRegistry
} from './validate-cross-lane-journey-registry.mjs';

const current = () => structuredClone(loadRegistry({ repoRoot: DEFAULT_REPO_ROOT }));
const journey = (registry, id) => registry.journeys.find((item) => item.id === id);

function errorsFor(registry) {
  return validateRegistry(registry, { repoRoot: DEFAULT_REPO_ROOT });
}

function assertError(errors, fragment) {
  assert.ok(
    errors.some((error) => error.includes(fragment)),
    `Expected an error containing ${JSON.stringify(fragment)}. Received:\n${errors.join('\n')}`
  );
}

test('current V1 registry validates against repository files and named routes', () => {
  assert.deepEqual(errorsFor(current()), []);
});

test('V1 keeps exactly the three frozen golden journey ids', () => {
  const registry = current();
  assert.deepEqual(
    registry.journeys.map((item) => item.id),
    [
      'J1_MARKREG_GOVERNED_PREPARATION',
      'J2_MGSN_GOVERNED_PROVIDER',
      'J3_COGNITIVE_CONTROL_PLANE_READ'
    ]
  );
});

test('duplicate journey ids fail closed', () => {
  const registry = current();
  registry.journeys[1].id = registry.journeys[0].id;
  assertError(errorsFor(registry), 'Journey ids must be unique');
});

test('unsupported maturity fails closed', () => {
  const registry = current();
  journey(registry, 'J1_MARKREG_GOVERNED_PREPARATION').maturity = 'HEALTHY';
  assertError(errorsFor(registry), 'maturity is unsupported');
});

test('missing repository references are detected', () => {
  const registry = current();
  journey(registry, 'J3_COGNITIVE_CONTROL_PLANE_READ').consumer.files[0] =
    'apps/operations-console/src/does-not-exist.tsx';
  assertError(errorsFor(registry), 'does not exist');
});

test('named route drift is detected even when referenced files still exist', () => {
  const registry = current();
  journey(registry, 'J3_COGNITIVE_CONTROL_PLANE_READ').gateway.routes[0] =
    '/api/internal/control-plane/cognitive/route-that-does-not-exist';
  assertError(errorsFor(registry), 'no longer exists in app/service/test source');
});

test('LIVE maturity cannot be backed only by fixture evidence', () => {
  const registry = current();
  const target = journey(registry, 'J1_MARKREG_GOVERNED_PREPARATION');
  target.proof = target.proof.map((item) => ({
    ...item,
    kind: 'FIXTURE_TEST',
    fixtureOnly: true
  }));
  const errors = errorsFor(registry);
  assertError(errors, 'LIVE but has only fixture proof');
  assertError(errors, 'LIVE but has no product or real-runtime proof');
});

test('LIVE maturity requires an accepted product consumer', () => {
  const registry = current();
  const target = journey(registry, 'J3_COGNITIVE_CONTROL_PLANE_READ');
  target.consumer = { status: 'NONE_ACCEPTED', files: [], routes: [] };
  assertError(errorsFor(registry), 'LIVE but has no accepted product consumer');
});

test('governed journey authority classification is mandatory', () => {
  const registry = current();
  journey(registry, 'J2_MGSN_GOVERNED_PROVIDER').authority.class = '';
  assertError(errorsFor(registry), 'authority.class must be non-empty');
});

test('closed blocker requires maturity review instead of automatic promotion', () => {
  const registry = current();
  const target = journey(registry, 'J2_MGSN_GOVERNED_PROVIDER');
  target.maturity = 'DURABLE_NO_PRODUCT_CONSUMER';
  target.consumer = { status: 'NONE_ACCEPTED', files: [], routes: [] };
  target.blockers = [
    {
      issue: 999999,
      observedState: 'CLOSED',
      verifiedAtMainSha: registry.lastVerifiedMainSha,
      reason: 'Synthetic closed blocker for validator regression coverage.'
    }
  ];
  assertError(errorsFor(registry), 'review maturity before merge');
});

test('SOURCE_UNAVAILABLE and FIXTURE_ONLY remain legal states rather than CI failures by name', () => {
  for (const maturity of ['SOURCE_UNAVAILABLE', 'FIXTURE_ONLY']) {
    const registry = current();
    journey(registry, 'J1_MARKREG_GOVERNED_PREPARATION').maturity = maturity;
    const errors = errorsFor(registry);
    assert.ok(
      !errors.some((error) => error.includes('maturity is unsupported')),
      `${maturity} must remain an admitted V1 maturity state`
    );
  }
});

test('forbidden raw payload/secret keys are rejected even when nested', () => {
  const registry = current();
  journey(registry, 'J1_MARKREG_GOVERNED_PREPARATION').authority.rawPayload = {
    secret: 'x'
  };
  const errors = errorsFor(registry);
  assertError(errors, 'rawPayload is forbidden');
  assertError(errors, 'secret is forbidden');
});

test('human-readable report is deterministic and generated from registry truth', () => {
  const registry = current();
  const first = renderReport(registry);
  const second = renderReport(registry);
  assert.equal(first, second);
  assert.match(first, /J1_MARKREG_GOVERNED_PREPARATION/);
  assert.match(first, /J2_MGSN_GOVERNED_PROVIDER/);
  assert.match(first, /J3_COGNITIVE_CONTROL_PLANE_READ/);
  assert.match(first, /J2_MGSN_GOVERNED_PROVIDER.*\| LIVE \| None \|/);
  assert.match(
    first,
    /OWNER_DURABILITY, INTEGRATION_TEST, INTEGRATION_TEST, PRODUCT_TEST, FIXTURE_TEST/
  );
  assert.match(
    first,
    /\| Journey \| Consumer \| Gateway \| Owner \| Authority \| Persistence \| Proof \| Maturity \| Blocker \|/
  );
});
