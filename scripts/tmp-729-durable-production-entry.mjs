import fs from 'node:fs';

const appPath = 'apps/markreg-web/src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');

const legacyImport = "import { ConnectedDocumentsInstructionsWorkspace } from './DocumentsInstructionsWorkspace.js';";
const durableImport = "import { DurableDocumentsPreparationWorkspace } from './DurableDocumentsPreparationWorkspace.js';";
if (!app.includes(legacyImport)) throw new Error('legacy workspace import anchor missing');
app = app.replace(legacyImport, durableImport);

const legacyEntry = 'return <ConnectedDocumentsInstructionsWorkspace client={client} review={completedReview} />;';
const durableEntry = `return (\n        <DurableDocumentsPreparationWorkspace\n          review={completedReview}\n          filingClient={client}\n        />\n      );`;
if (!app.includes(legacyEntry)) throw new Error('legacy completed-review entry anchor missing');
app = app.replace(legacyEntry, durableEntry);

const completedBlockAnchor = `if (completedReview?.status === 'REVIEWED_READY_FOR_NEXT_STEP') {`;
const anchorIndex = app.indexOf(completedBlockAnchor);
if (anchorIndex < 0) throw new Error('completed-review block anchor missing');
const blockEnd = app.indexOf("  if (!started)", anchorIndex);
if (blockEnd < 0) throw new Error('completed-review block end missing');
const completedBlock = app.slice(anchorIndex, blockEnd);
if (completedBlock.includes('<ConnectedDocumentsInstructionsWorkspace'))
  throw new Error('legacy workspace still reachable from completed-review block');
if (!completedBlock.includes('<DurableDocumentsPreparationWorkspace'))
  throw new Error('durable workspace not wired into completed-review block');
fs.writeFileSync(appPath, app);

const testPath = 'apps/markreg-web/tests/App.test.tsx';
let test = fs.readFileSync(testPath, 'utf8');
const legacyTypes = `  ProfessionalReviewCase,\n  DocumentPackage,\n  CustomerInstructionLedger,\n  PreparationLock`;
if (!test.includes(legacyTypes)) throw new Error('legacy App test type import anchor missing');
test = test.replace(legacyTypes, '  ProfessionalReviewCase');

const testStart = `  it('enters the Gateway-backed Documents and Instructions journey and reaches its lock receipt', async () => {`;
const testEnd = `  it('validates required fields and preserves answers when moving back', async () => {`;
const startIndex = test.indexOf(testStart);
const endIndex = test.indexOf(testEnd, startIndex);
if (startIndex < 0 || endIndex < 0) throw new Error('legacy App journey test anchors missing');
const replacement = `  it('routes completed Professional Review into the durable Documents and Preparation consumer', async () => {\n    const at = '2026-07-29T12:00:00.000Z';\n    const review = {\n      schemaVersion: 1,\n      reviewCaseId: 'professional-review_app',\n      source: {\n        schemaVersion: 1,\n        matterDraftId: 'matter-draft_app',\n        matterDraftVersion: 'matter-v7',\n        confirmationId: 'confirmation_app',\n        customerId: 'customer_app',\n        status: 'READY_FOR_PROFESSIONAL_REVIEW',\n        preparation: {\n          classes: [9],\n          documentReferences: [],\n          goodsServices: 'Long governed software scope',\n          targetJurisdiction: 'US',\n          trademark: 'ORBIT'\n        },\n        readiness: { evaluatedAt: at, checks: [], readyForProfessionalReview: true },\n        readinessTimestamp: at\n      },\n      status: 'REVIEWED_READY_FOR_NEXT_STEP',\n      priority: 'NORMAL',\n      requestedBy: 'customer_app',\n      createdAt: at,\n      updatedAt: at,\n      assignment: { status: 'CLAIMED', professionalAppointed: false },\n      checklist: [],\n      evidence: [],\n      decision: {\n        code: 'MARK_READY_FOR_NEXT_STEP',\n        reviewerId: 'reviewer_app',\n        decidedAt: 'decision-v3',\n        rationale: 'Ready',\n        checklistSnapshot: [],\n        evidenceReferences: [],\n        sourceMatterDraftVersion: 'matter-v7',\n        consequences: {\n          orderCreated: false,\n          paymentCreated: false,\n          formalMatterCreated: false,\n          providerAppointed: false,\n          filingCreated: false,\n          customerMessageSent: false\n        }\n      }\n    } satisfies ProfessionalReviewCase;\n    const createDocumentPackage = vi.fn();\n    const createPreparationLock = vi.fn();\n    const client = {\n      createIntake: vi.fn(),\n      getProfessionalReview: vi.fn().mockResolvedValue({ reviewCase: review }),\n      createDocumentPackage,\n      createPreparationLock\n    } as unknown as MarkregClient;\n\n    window.history.replaceState({}, '', '/?professionalReviewCaseId=professional-review_app');\n    const user = userEvent.setup();\n    render(<MarkregApp client={client} />);\n\n    expect(await screen.findByText('decision-v3')).toBeVisible();\n    await user.click(screen.getByRole('button', { name: 'Open Documents and Instructions' }));\n\n    expect(\n      await screen.findByRole('button', { name: 'Create durable Document Package' })\n    ).toBeVisible();\n    expect(screen.queryByRole('button', { name: 'Create Document Package' })).not.toBeInTheDocument();\n    expect(screen.getByText(/pinned to that exact review version and decision fingerprint/i)).toBeVisible();\n    expect(createDocumentPackage).not.toHaveBeenCalled();\n    expect(createPreparationLock).not.toHaveBeenCalled();\n  });\n`;
test = test.slice(0, startIndex) + replacement + test.slice(endIndex);
fs.writeFileSync(testPath, test);

console.log('TASK 729 production durable entry patch applied');