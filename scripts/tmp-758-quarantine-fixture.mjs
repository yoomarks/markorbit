import fs from 'node:fs';

const indexPath = 'services/markreg/src/index.ts';
let source = fs.readFileSync(indexPath, 'utf8');

const helperNeedle = `  const fixtureRuntime =\n    options.milestoneTestRuntime ?? process.env.MO_MILESTONE_TEST_RUNTIME === '1';\n`;
const helperReplacement = `${helperNeedle}  const requireFixtureEarlyFunnel = () => {\n    if (!fixtureRuntime)\n      throw new HttpError(\n        404,\n        'ROUTE_NOT_FOUND',\n        'Legacy fixture early-funnel route is unavailable outside milestone runtime.'\n      );\n  };\n`;
if (!source.includes(helperNeedle)) throw new Error('fixture runtime helper anchor missing');
source = source.replace(helperNeedle, helperReplacement);

const routeAnchors = [
  [`path: '/v1/intakes/:intakeId',\n          handle: (request) => {`, `path: '/v1/intakes/:intakeId',\n          handle: (request) => {\n            requireFixtureEarlyFunnel();`],
  [`path: '/v1/recommendations/:recommendationId',\n          handle: (request) => {`, `path: '/v1/recommendations/:recommendationId',\n          handle: (request) => {\n            requireFixtureEarlyFunnel();`],
  [`path: '/v1/quotes/:quoteId',\n          handle: (request) => {`, `path: '/v1/quotes/:quoteId',\n          handle: (request) => {\n            requireFixtureEarlyFunnel();`],
  [`path: '/v1/quotes',\n          async handle(request) {`, `path: '/v1/quotes',\n          async handle(request) {\n            requireFixtureEarlyFunnel();`],
  [`path: '/v1/quotes/:quoteId/confirm',\n          handle(request) {`, `path: '/v1/quotes/:quoteId/confirm',\n          handle(request) {\n            requireFixtureEarlyFunnel();`],
  [`path: '/v1/intakes',\n          async handle(request) {`, `path: '/v1/intakes',\n          async handle(request) {\n            requireFixtureEarlyFunnel();`]
];
for (const [needle, replacement] of routeAnchors) {
  if (!source.includes(needle)) throw new Error(`route anchor missing: ${needle}`);
  source = source.replace(needle, replacement);
}
fs.writeFileSync(indexPath, source);

const testPath = 'services/markreg/tests/production-intake-runtime.test.ts';
let test = fs.readFileSync(testPath, 'utf8');
const oldExpectation = `    expect(legacy.status).toBe(400);\n    expect(await legacy.json()).toMatchObject({ code: 'INVALID_REQUEST' });\n  });\n});\n`;
const newExpectation = `    expect(legacy.status).toBe(404);\n    expect(await legacy.json()).toMatchObject({ code: 'ROUTE_NOT_FOUND' });\n  });\n\n  it('retains legacy fixture Intake only in explicit milestone runtime', async () => {\n    const runtime = createRuntime({ port: 0, milestoneTestRuntime: true });\n    active.push(runtime);\n    await runtime.start();\n    const base = \`http://127.0.0.1:\${runtime.listeningPort}\`;\n\n    const legacy = await fetch(\`\${base}/v1/intakes\`, {\n      method: 'POST',\n      headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({})\n    });\n    expect(legacy.status).toBe(400);\n    expect(await legacy.json()).toMatchObject({ code: 'INVALID_REQUEST' });\n  });\n});\n`;
if (!test.includes(oldExpectation)) throw new Error('runtime test anchor missing');
test = test.replace(oldExpectation, newExpectation);
fs.writeFileSync(testPath, test);

console.log('TASK 758 fixture quarantine patch applied');
