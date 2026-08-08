import fs from 'node:fs';

function replaceOnce(file, needle, replacement) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(needle)) throw new Error(`${file}: patch anchor not found`);
  fs.writeFileSync(file, text.replace(needle, replacement));
}

replaceOnce(
  'services/markreg/src/index.ts',
  "} from './audit.js';\nexport * from './matter-flow.js';",
  "} from './audit.js';\nimport { createOrderHttpRoutes, type OrderHttpOptions } from './order-http.js';\nexport * from './matter-flow.js';"
);
replaceOnce(
  'services/markreg/src/index.ts',
  "export * from './order-matter-conversion.js';\nexport const serviceManifest",
  "export * from './order-matter-conversion.js';\nexport * from './order-http.js';\nexport const serviceManifest"
);
replaceOnce(
  'services/markreg/src/index.ts',
  "  auditRepository?: PostgresMarkRegAuditRepository;\n}",
  "  auditRepository?: PostgresMarkRegAuditRepository;\n  orderService?: OrderHttpOptions['orderService'];\n  orderMatterConversionService?: OrderHttpOptions['conversionService'];\n}"
);
replaceOnce(
  'services/markreg/src/index.ts',
  "      routes: [\n        ...(fixtureRuntime",
  "      routes: [\n        ...createOrderHttpRoutes({\n          orderService: options.orderService,\n          conversionService: options.orderMatterConversionService,\n          internalServiceSecret\n        }),\n        ...(fixtureRuntime"
);

replaceOnce(
  'apps/gateway/src/index.ts',
  "export * from './auth.js';\nimport {",
  "export * from './auth.js';\nexport * from './order-http.js';\nimport {"
);
replaceOnce(
  'apps/gateway/src/index.ts',
  "} from './auth.js';\nexport const serviceManifest",
  "} from './auth.js';\nimport { createGatewayOrderRoutes } from './order-http.js';\nexport const serviceManifest"
);
replaceOnce(
  'apps/gateway/src/index.ts',
  "      routes: [\n        {\n          method: 'GET',\n          path: '/api/auth/session',",
  "      routes: [\n        ...createGatewayOrderRoutes({\n          markRegUrl,\n          authenticationClient,\n          internalServiceSecret:\n            options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET,\n          csrfSecret,\n          allowedOrigins\n        }),\n        {\n          method: 'GET',\n          path: '/api/auth/session',"
);

replaceOnce(
  'scripts/gateway-route-source.mjs',
  "const source = fs.readFileSync(new URL('../apps/gateway/src/index.ts', import.meta.url), 'utf8');",
  "const source = [\n  '../apps/gateway/src/index.ts',\n  '../apps/gateway/src/order-http.ts'\n]\n  .map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8'))\n  .join('\\n');"
);
replaceOnce(
  'scripts/gateway-route-source.mjs',
  "  for (const match of sourceText.matchAll(/method:\\s*'(GET|POST|PATCH)'\\s*,\\s*path:\\s*'([^']+)'/g))\n    add(match[1], match[2]);",
  "  for (const match of sourceText.matchAll(/method:\\s*'(GET|POST|PATCH)'\\s*,\\s*path:\\s*'([^']+)'/g))\n    add(match[1], match[2]);\n  for (const match of sourceText.matchAll(/route\\(\\s*'(GET|POST|PATCH)'\\s*,\\s*'([^']+)'/g))\n    add(match[1], match[2]);"
);

replaceOnce(
  'scripts/validate-gateway-inventory.mjs',
  "    row.path.startsWith('/api/markreg/document-packages');",
  "    row.path.startsWith('/api/markreg/document-packages') ||\n    row.path.startsWith('/api/markreg/orders');"
);
replaceOnce(
  'scripts/validate-gateway-inventory.mjs',
  "assert.equal(source.length, 68);",
  "assert.equal(source.length, 77);"
);
replaceOnce(
  'scripts/validate-gateway-inventory.mjs',
  ").length,\n  62\n);\nconsole.log(\n  'Gateway inventory PASS: 68 runtime routes; authenticated Document Package boundary included; test bootstrap excluded'\n);",
  ").length,\n  71\n);\nconsole.log(\n  'Gateway inventory PASS: 77 runtime routes; authenticated Order and Document Package boundaries included; test bootstrap excluded'\n);"
);

const inventoryPath = 'docs/architecture/GATEWAY_ROUTE_INVENTORY.json';
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const orderRoutes = [
  ['POST', '/api/markreg/orders', 'REQUIRED_FOR_MUTATION', 'ORDER_ONLY_NO_PAYMENT_OR_FILING'],
  ['GET', '/api/markreg/orders', 'NOT_APPLICABLE_READ', 'NONE_EXTERNAL'],
  ['GET', '/api/markreg/orders/:orderId', 'NOT_APPLICABLE_READ', 'NONE_EXTERNAL'],
  ['POST', '/api/markreg/orders/:orderId/request-confirmation', 'REQUIRED_FOR_MUTATION', 'ORDER_ONLY_NO_PAYMENT_OR_FILING'],
  ['POST', '/api/markreg/orders/:orderId/confirm', 'REQUIRED_FOR_MUTATION', 'ORDER_ONLY_NO_PAYMENT_OR_FILING'],
  ['POST', '/api/markreg/orders/:orderId/evaluate-readiness', 'REQUIRED_FOR_MUTATION', 'ORDER_ONLY_NO_PAYMENT_OR_FILING'],
  ['POST', '/api/markreg/orders/:orderId/create-matter', 'REQUIRED_FOR_MUTATION', 'ORDER_AND_FORMAL_MATTER_ONLY_NO_PAYMENT_OR_FILING'],
  ['POST', '/api/markreg/orders/:orderId/link-matter', 'REQUIRED_FOR_MUTATION', 'ORDER_AND_FORMAL_MATTER_ONLY_NO_PAYMENT_OR_FILING'],
  ['POST', '/api/markreg/orders/:orderId/cancel', 'REQUIRED_FOR_MUTATION', 'ORDER_ONLY_NO_PAYMENT_OR_FILING']
];
const existing = new Set(inventory.routes.map((route) => `${route.method} ${route.path}`));
for (const [method, path, idempotencyRequirement, authorityConsequenceResponse] of orderRoutes) {
  if (existing.has(`${method} ${path}`)) continue;
  inventory.routes.push({
    method,
    path,
    owner: 'markreg',
    namespaceClass: 'CANONICAL_PRODUCT_API',
    authenticationMode: 'COOKIE_AUTHENTICATED',
    environmentScope: 'ALL_ENVIRONMENTS',
    idempotencyRequirement,
    authorityConsequenceResponse,
    httpIntegrationTestFile: 'scripts/order-http.integration.test.ts'
  });
}
inventory.routes.sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
fs.writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

const packagePath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
pkg.scripts['build:order-http-deps'] =
  'turbo run build --filter=@markorbit/core-service... --filter=@markorbit/markreg-service... --filter=@markorbit/gateway...';
pkg.scripts['test:order:http'] =
  'pnpm build:order-http-deps && MARKREG_ORDER_HTTP_REQUIRED=1 pnpm exec vitest run --no-file-parallelism scripts/order-http.integration.test.ts';
pkg.scripts['test:order:client'] =
  'pnpm --filter @markorbit/markreg-web exec vitest run tests/order-api.test.ts';
fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);

replaceOnce(
  '.github/workflows/ci.yml',
  "      MARKREG_ORDER_MATTER_POSTGRES_REQUIRED: '1'\n",
  "      MARKREG_ORDER_MATTER_POSTGRES_REQUIRED: '1'\n      MARKREG_ORDER_HTTP_REQUIRED: '1'\n"
);
replaceOnce(
  '.github/workflows/ci.yml',
  "      - run: pnpm --filter @markorbit/markreg-service exec vitest run tests/order-matter-conversion-postgres.test.ts\n      - run: pnpm test:audit-idempotency:postgres",
  "      - run: pnpm --filter @markorbit/markreg-service exec vitest run tests/order-matter-conversion-postgres.test.ts\n      - name: Run authenticated Order HTTP integration\n        run: pnpm test:order:http\n      - name: Run typed Order browser client tests\n        run: pnpm test:order:client\n      - run: pnpm test:audit-idempotency:postgres"
);

fs.rmSync('scripts/wp05-bootstrap.mjs');
fs.rmSync('.github/workflows/wp05-bootstrap.yml');
