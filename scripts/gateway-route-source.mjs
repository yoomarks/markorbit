import fs from 'node:fs';
const source = fs.readFileSync(new URL('../apps/gateway/src/index.ts', import.meta.url), 'utf8');
export function extractGatewayRoutes(sourceText = source) {
  const routes = [];
  const add = (method, path) => {
    if (path.startsWith('/')) routes.push({ method, path });
  };
  for (const match of sourceText.matchAll(/\[\s*'(GET|POST|PATCH)'\s*,\s*'([^']+)'\s*(?:,|\])/g))
    add(match[1], match[2]);
  for (const match of sourceText.matchAll(/method:\s*'(GET|POST|PATCH)'\s*,\s*path:\s*'([^']+)'/g))
    add(match[1], match[2]);
  add('GET', '/health/markreg');
  add('GET', '/health/execution');
  const lite = [
    '/api/lite/professional-review-cases',
    '/api/lite/professional-review-cases/:reviewCaseId',
    '/api/lite/professional-review-cases/:reviewCaseId/claim',
    '/api/lite/professional-review-cases/:reviewCaseId/checklist',
    '/api/lite/professional-review-cases/:reviewCaseId/request-information',
    '/api/lite/professional-review-cases/:reviewCaseId/complete',
    '/api/lite/professional-review-cases/:reviewCaseId/withdraw'
  ];
  for (const path of lite) {
    const methods = path.endsWith('/checklist')
      ? ['PATCH']
      : path.includes(':reviewCaseId/')
        ? ['POST']
        : path.includes(':reviewCaseId')
          ? ['GET']
          : ['GET', 'POST'];
    for (const method of methods) add(method, path);
  }
  const unique = new Map(routes.map((x) => [`${x.method} ${x.path}`, x]));
  return [...unique.values()].sort((a, b) =>
    `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`)
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname)
  console.log(JSON.stringify(extractGatewayRoutes(), null, 2));
