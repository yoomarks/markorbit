import { readFileSync, writeFileSync } from 'node:fs';

function replace(path, from, to) {
  const current = readFileSync(path, 'utf8');
  if (!current.includes(from)) throw new Error(`Missing patch anchor in ${path}`);
  writeFileSync(path, current.replace(from, to));
}

const filing = 'apps/markreg-web/src/FilingAuthorization.tsx';
replace(
  filing,
  `  FilingAuthorizationAcknowledgementCode,\n  PreparationLock\n} from '@markorbit/contracts';`,
  `  FilingAuthorizationAcknowledgementCode,\n  MarkOrbitId,\n  PreparationLock\n} from '@markorbit/contracts';`
);
replace(
  filing,
  `const version = (lock: PreparationLock) =>\n  \`${'${lock.documentPackageVersion}:${lock.instructionLedgerVersion}:${lock.lockedAt}'}\`;\nexport function FilingAuthorizationView({\n  client = createMarkregClient(),\n  preparationLock,\n  fixtureAuthorization,`,
  `const legacyVersion = (lock: PreparationLock) =>\n  \`${'${lock.documentPackageVersion}:${lock.instructionLedgerVersion}:${lock.lockedAt}'}\`;\n\nexport interface DurableFilingAuthorizationSource {\n  preparationLockId: string;\n  preparationLockVersion: string;\n  authorizedParty: { partyId: MarkOrbitId; displayName: string };\n}\n\nexport function FilingAuthorizationView({\n  client = createMarkregClient(),\n  preparationLock,\n  durablePreparationSource,\n  fixtureAuthorization,`
);
replace(
  filing,
  `  client?: MarkregClient;\n  preparationLock?: PreparationLock;\n  fixtureAuthorization?: FilingAuthorization;`,
  `  client?: MarkregClient;\n  preparationLock?: PreparationLock;\n  durablePreparationSource?: DurableFilingAuthorizationSource;\n  fixtureAuthorization?: FilingAuthorization;`
);
replace(
  filing,
  `  const [checked, setChecked] = useState<FilingAuthorizationAcknowledgementCode[]>([]);\n  const [message, setMessage] = useState('');\n  useEffect(() => {\n    if (!preparationLock || fixtureAuthorization || !client.createFilingAuthorization) return;\n    let active = true;\n    void client\n      .createFilingAuthorization({\n        preparationLockId: preparationLock.preparationLockId,\n        preparationLockVersion: version(preparationLock),\n        authorizedParty: {\n          partyId: preparationLock.snapshot.documentPackage.customerId,\n          displayName: 'Authorized customer'\n        },\n        authorizationCapacity: 'OWNER',\n        executionChannel: 'OFFICE_PORTAL',\n        idempotencyKey: \`authorization:${'${preparationLock.preparationLockId}'}:${'${version(preparationLock)}'}\`\n      })`,
  `  const [checked, setChecked] = useState<FilingAuthorizationAcknowledgementCode[]>([]);\n  const [message, setMessage] = useState('');\n  const sourceLockId = durablePreparationSource?.preparationLockId ?? preparationLock?.preparationLockId;\n  const sourceLockVersion =\n    durablePreparationSource?.preparationLockVersion ??\n    (preparationLock ? legacyVersion(preparationLock) : undefined);\n  const sourcePartyId =\n    durablePreparationSource?.authorizedParty.partyId ??\n    preparationLock?.snapshot.documentPackage.customerId;\n  const sourcePartyName =\n    durablePreparationSource?.authorizedParty.displayName ?? 'Authorized customer';\n  useEffect(() => {\n    if (\n      !sourceLockId ||\n      !sourceLockVersion ||\n      !sourcePartyId ||\n      fixtureAuthorization ||\n      !client.createFilingAuthorization\n    )\n      return;\n    let active = true;\n    void client\n      .createFilingAuthorization({\n        preparationLockId: sourceLockId,\n        preparationLockVersion: sourceLockVersion,\n        authorizedParty: { partyId: sourcePartyId, displayName: sourcePartyName },\n        authorizationCapacity: 'OWNER',\n        executionChannel: 'OFFICE_PORTAL',\n        idempotencyKey: \`authorization:${'${sourceLockId}'}:${'${sourceLockVersion}'}\`\n      })`
);
replace(
  filing,
  `  }, [client, fixtureAuthorization, preparationLock]);`,
  `  }, [\n    client,\n    fixtureAuthorization,\n    sourceLockId,\n    sourceLockVersion,\n    sourcePartyId,\n    sourcePartyName\n  ]);`
);

const workspace = 'apps/markreg-web/src/DurableDocumentsPreparationWorkspace.tsx';
replace(
  workspace,
  `import { MarkregApiError } from './api/errors.js';`,
  `import { MarkregApiError } from './api/errors.js';\nimport type { MarkregClient } from './api/markreg.js';\nimport { FilingAuthorizationView } from './FilingAuthorization.js';`
);
replace(
  workspace,
  `  review,\n  packageClient = defaultPackageClient,\n  preparationClient = defaultPreparationClient\n}: {\n  review: ProfessionalReviewCase;\n  packageClient?: DurableDocumentPackageClient;\n  preparationClient?: DurablePreparationClient;\n}) {`,
  `  review,\n  packageClient = defaultPackageClient,\n  preparationClient = defaultPreparationClient,\n  filingClient\n}: {\n  review: ProfessionalReviewCase;\n  packageClient?: DurableDocumentPackageClient;\n  preparationClient?: DurablePreparationClient;\n  filingClient?: MarkregClient;\n}) {`
);
replace(
  workspace,
  `  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState('');`,
  `  const [loading, setLoading] = useState(false);\n  const [error, setError] = useState('');\n  const [showFilingAuthorization, setShowFilingAuthorization] = useState(false);`
);
replace(
  workspace,
  `      setLock(await preparationClient.validateCurrent(created.preparationLockId));`,
  `      setLock(await preparationClient.validateCurrent(created.preparationLockId));\n      setShowFilingAuthorization(false);`
);
replace(
  workspace,
  `  if (loading && !pkg) return <LoadingState label="Loading durable Document Package" />;\n\n  if (!pkg)`,
  `  if (\n    lock &&\n    showFilingAuthorization &&\n    review.source?.customerId\n  )\n    return (\n      <FilingAuthorizationView\n        client={filingClient}\n        durablePreparationSource={{\n          preparationLockId: lock.preparationLockId,\n          preparationLockVersion: String(lock.version),\n          authorizedParty: {\n            partyId: review.source.customerId,\n            displayName: 'Applicant / owner'\n          }\n        }}\n      />\n    );\n\n  if (loading && !pkg) return <LoadingState label="Loading durable Document Package" />;\n\n  if (!pkg)`
);
replace(
  workspace,
  `          <Alert tone="warning" title="Filing Authorization remains gated">\n            The current durable Preparation Lock is saved and revalidated. Filing Authorization is\n            intentionally unavailable here until Execution consumes this durable source contract\n            under #731. No legacy snapshot is manufactured in the browser.\n          </Alert>`,
  `          <Alert tone="warning" title="Filing Authorization remains a separate authority step">\n            The current durable Preparation Lock has been revalidated. Opening Filing Authorization\n            passes only this exact lock identity/version into the governed Execution flow; it does\n            not authorize or submit a filing.\n          </Alert>\n          {review.source?.customerId ? (\n            <Button disabled={loading} onClick={() => setShowFilingAuthorization(true)}>\n              Review Filing Authorization\n            </Button>\n          ) : (\n            <Alert tone="danger" title="Authorization source unavailable">\n              The completed Professional Review does not expose the exact customer identity required\n              to open Filing Authorization safely.\n            </Alert>\n          )}`
);

const test = 'apps/markreg-web/src/DurableDocumentsPreparationWorkspace.test.tsx';
replace(
  test,
  `import type { DurablePreparationClient } from './api/durable-preparation.js';`,
  `import type { DurablePreparationClient } from './api/durable-preparation.js';\nimport type { MarkregClient } from './api/markreg.js';`
);
replace(
  test,
  `  completedAt: '2026-09-04T08:00:00.000Z',\n  decision: { decision: 'READY_FOR_NEXT_STEP', decidedAt: '2026-09-04T08:00:00.000Z' }`,
  `  completedAt: '2026-09-04T08:00:00.000Z',\n  source: { customerId: 'customer_exact' },\n  decision: { decision: 'READY_FOR_NEXT_STEP', decidedAt: '2026-09-04T08:00:00.000Z' }`
);
replace(
  test,
  `    const preparationClient: DurablePreparationClient = {\n      create: createPreparationLock,\n      get: vi.fn(),\n      validateCurrent\n    };\n\n    render(`,
  `    const preparationClient: DurablePreparationClient = {\n      create: createPreparationLock,\n      get: vi.fn(),\n      validateCurrent\n    };\n    const createFilingAuthorization = vi.fn(() => new Promise<never>(() => undefined));\n    const filingClient = { createFilingAuthorization } as unknown as MarkregClient;\n\n    render(`
);
replace(
  test,
  `        packageClient={packageClient}\n        preparationClient={preparationClient}\n      />`,
  `        packageClient={packageClient}\n        preparationClient={preparationClient}\n        filingClient={filingClient}\n      />`
);
replace(
  test,
  `    expect(await screen.findByText('Locked for preparation — not submitted')).toBeTruthy();\n    expect(screen.getByText('Filing Authorization remains gated')).toBeTruthy();\n    expect(screen.getByText(/#731/)).toBeTruthy();`,
  `    expect(await screen.findByText('Locked for preparation — not submitted')).toBeTruthy();\n    expect(\n      screen.getByText('Filing Authorization remains a separate authority step')\n    ).toBeTruthy();\n    expect(createFilingAuthorization).not.toHaveBeenCalled();\n\n    await userEvent.click(screen.getByRole('button', { name: 'Review Filing Authorization' }));\n    await waitFor(() =>\n      expect(createFilingAuthorization).toHaveBeenCalledWith({\n        preparationLockId: 'preparation-lock_exact',\n        preparationLockVersion: '1',\n        authorizedParty: { partyId: 'customer_exact', displayName: 'Applicant / owner' },\n        authorizationCapacity: 'OWNER',\n        executionChannel: 'OFFICE_PORTAL',\n        idempotencyKey: 'authorization:preparation-lock_exact:1'\n      })\n    );`
);

console.log('TASK 729 filing authorization handoff patch applied');
