import fs from 'node:fs';

function replaceExact(path, before, after) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) throw new Error(`Missing expected marker in ${path}`);
  fs.writeFileSync(path, source.replace(before, after));
}

const index = 'apps/gateway/src/index.ts';
replaceExact(
  index,
  "export * from './preparation-lock-http.js';\n",
  "export * from './preparation-lock-http.js';\nexport * from './filing-governance-http.js';\n"
);
replaceExact(
  index,
  "import { createGatewayPreparationLockHandler } from './preparation-lock-http.js';\n",
  "import { createGatewayPreparationLockHandler } from './preparation-lock-http.js';\nimport { createGatewayFilingGovernanceHandler } from './filing-governance-http.js';\n"
);

const preparation = `  const preparationLock = createGatewayPreparationLockHandler({
    markRegUrl,
    ...(authenticationClient ? { authenticationClient } : {}),
    ...((options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET)
      ? {
          internalServiceSecret: (options.internalServiceSecret ??
            process.env.MO_INTERNAL_SERVICE_SECRET)!
        }
      : {}),
    csrfSecret,
    allowedOrigins,
    fixtureTestRuntime: milestoneTestRuntime
  });
`;
const filing = `${preparation}
  const filingGovernance = createGatewayFilingGovernanceHandler({
    executionUrl,
    ...(authenticationClient ? { authenticationClient } : {}),
    ...((options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET)
      ? {
          internalServiceSecret: (options.internalServiceSecret ??
            process.env.MO_INTERNAL_SERVICE_SECRET)!
        }
      : {}),
    csrfSecret,
    allowedOrigins,
    fixtureTestRuntime: milestoneTestRuntime
  });
`;
replaceExact(index, preparation, filing);

const anonymous = `          handle: async (request) => {
            try {
              const response = await fetch(
                \`${'${executionUrl}'}${'${request.path.replace(\'/api/execution\', \'/v1\')}'}\`,
                {
                  method: request.method,
                  headers: {
                    'content-type': 'application/json',
                    ...(request.headers['idempotency-key']
                      ? { 'idempotency-key': request.headers['idempotency-key'] }
                      : {})
                  },
                  ...(request.method === 'GET' ? {} : { body: JSON.stringify(request.body ?? {}) })
                }
              );
              return json(response.status, await response.json());
            } catch {
              throw new HttpError(
                502,
                'DOWNSTREAM_UNAVAILABLE',
                'Execution filing governance service is unavailable.',
                true
              );
            }
          }
`;
replaceExact(index, anonymous, `          handle: (request) => filingGovernance(request)\n`);

const vertical = 'apps/gateway/tests/filing-authorization-execution-release.test.ts';
replaceExact(
  vertical,
  `  const gateway = createGateway({
    port: 0,
    executionUrl: \`http://127.0.0.1:${'${execution.listeningPort}'}\`
  });`,
  `  const gateway = createGateway({
    port: 0,
    executionUrl: \`http://127.0.0.1:${'${execution.listeningPort}'}\`,
    milestoneTestRuntime: true
  });`
);
