import fs from 'node:fs';

function replaceExact(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`${path}: expected patch anchor not found`);
  fs.writeFileSync(path, source.replace(from, to));
}

const feedbackTest = 'services/lite/tests/product-loop-feedback-postgres.test.ts';
replaceExact(
  feedbackTest,
  `    const store = feedbackStore();\n    const command = {\n      workspaceId,`,
  `    const store = feedbackStore();\n    expect(await store.listPendingPackages(workspaceId)).toEqual([publishPackage]);\n    const command = {\n      workspaceId,`
);
replaceExact(
  feedbackTest,
  `    expect(await afterRestart.listRecent(workspaceId)).toEqual([feedback]);\n    expect(`,
  `    expect(await afterRestart.listRecent(workspaceId)).toEqual([feedback]);\n    expect(await afterRestart.listPendingPackages(workspaceId)).toEqual([]);\n    expect(`
);
replaceExact(
  feedbackTest,
  `    expect(await store.listRecent(otherWorkspaceId)).toEqual([]);\n    expect(`,
  `    expect(await store.listRecent(otherWorkspaceId)).toEqual([]);\n    expect(await store.listPendingPackages(otherWorkspaceId)).toEqual([]);\n    expect(`
);

const httpTest = 'scripts/product-loop-today-runtime.integration.test.ts';
replaceExact(
  httpTest,
  `    expect(todayPayload.recentFeedback).toEqual([]);`,
  `    expect(todayPayload.recentFeedback).toEqual([]);\n    expect(todayPayload.feedbackPendingPackages).toEqual([]);`
);

const taskDoc = 'docs/tasks/MO-MVP-PLC-WP-06-FEEDBACK-OBSERVABILITY.md';
replaceExact(
  taskDoc,
  `## Today observability\n\n\`GET /v1/today\` returns recent manual-use feedback alongside the existing Today snapshot. The Lite UI may render it as supporting Product-loop evidence; it must not become a new parallel top-level module.`,
  `## Today observability\n\n\`GET /v1/today\` returns both recent manual-use feedback and reviewed PublishPackages that do not yet have a feedback record. Today renders the pending packages as supporting Product-loop work, where an authenticated user can report Published, Delivered, Used or Not used. Saving the report removes that exact package version from the pending queue and returns the durable evidence to Today. This remains inside the Today mainline and does not become a new parallel top-level module.`
);
