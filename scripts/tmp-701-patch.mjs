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

const focused = 'apps/gateway/tests/filing-governance-http.test.ts';
replaceExact(
  focused,
  `function response(status: number, value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}
`,
  `function response(status: number, value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), {
      status,
      headers: { 'content-type': 'application/json' }
    })
  );
}

function mockDownstream(status: number, value: unknown) {
  return vi.fn<(input: string | URL | Request, init?: RequestInit) => Promise<Response>>(() =>
    response(status, value)
  );
}
`
);
let source = fs.readFileSync(focused, 'utf8');
source = source.replaceAll(
  `vi.fn(() => response(200, { ok: true }))`,
  `mockDownstream(200, { ok: true })`
);
source = source.replace(
  `vi.fn(() => response(200, { fixture: true }))`,
  `mockDownstream(200, { fixture: true })`
);
source = source.replace(
  `vi.stubGlobal('fetch', vi.fn(() => response(status, owner)));`,
  `vi.stubGlobal('fetch', mockDownstream(status, owner));`
);
source = source.replace(
  `    if (!init || typeof init.body !== 'string') throw new Error('Expected request body.');
    expect(JSON.parse(init.body)).toMatchObject({`,
  `    if (!init || typeof init.body !== 'string') throw new Error('Expected request body.');
    const requestBody = init.body;
    expect(JSON.parse(requestBody)).toMatchObject({`
);
source = source.replace(
  `      if (!init || typeof init.body !== 'string') throw new Error('Expected request body.');
      const body = JSON.parse(init.body) as Record<string, unknown>;`,
  `      if (!init || typeof init.body !== 'string') throw new Error('Expected request body.');
      const requestBody = init.body;
      const body = JSON.parse(requestBody) as Record<string, unknown>;`
);
fs.writeFileSync(focused, source);
