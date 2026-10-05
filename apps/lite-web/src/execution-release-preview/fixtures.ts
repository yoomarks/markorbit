import type {
  AuthorizationAuthorityConsequences,
  ExecutionRelease,
  ExecutionReleaseCheck,
  FilingExecutionTaskDraft
} from '@markorbit/contracts';
import { ExecutionHttpError, type LiteExecutionClient } from '../api/execution.js';

export type ExecutionReleasePreviewScenario =
  | 'queue'
  | 'loading'
  | 'empty'
  | 'unauthorized'
  | 'permission'
  | 'missing'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'error'
  | 'partial'
  | 'blocked'
  | 'ready'
  | 'released'
  | 'stale'
  | 'withdrawn';

export const previewWorkspaceId = 'workspace_northstar-legal-ops';
export const previewReleaseId = 'execution-release_fixture-1480' as const;
const recordedAt = '2026-10-05T09:05:00.000Z';

export const previewConsequences: AuthorizationAuthorityConsequences = {
  orderCreated: false,
  paymentCreated: false,
  invoiceCreated: false,
  formalMatterCreated: false,
  professionalAppointed: false,
  providerAssignedExternally: false,
  filingCreated: false,
  filingSubmitted: false,
  officialApplicationCreated: false,
  officialApplicationNumberReceived: false,
  customerMessageSent: false,
  externalDocumentSent: false,
  trademarkOfficeContacted: false
};

const blockedChecks: ReadonlyArray<ExecutionReleaseCheck> = [
  {
    code: 'CURRENT_PREPARATION_LOCK',
    status: 'PASS',
    blocking: true,
    explanation: 'The exact Preparation Lock version remains current.',
    source: 'MARKREG_PREPARATION_LOCK',
    evidenceReference: 'preparation-lock_fixture-1478:1',
    checkedAt: recordedAt
  },
  {
    code: 'LOCKED_DOCUMENT_PACKAGE',
    status: 'PASS',
    blocking: true,
    explanation: 'The locked Document Package and instruction ledger have not changed.',
    source: 'MARKREG_DOCUMENT_PACKAGE',
    evidenceReference: 'document-package_fixture-documents-1476:4',
    checkedAt: recordedAt
  },
  {
    code: 'CURRENT_PROFESSIONAL_REVIEW',
    status: 'PASS',
    blocking: true,
    explanation: 'The completed legal review decision remains current.',
    source: 'LITE_PROFESSIONAL_REVIEW',
    evidenceReference: 'professional-review_fixture-1475:2',
    checkedAt: recordedAt
  },
  {
    code: 'CURRENT_AUTHORIZATION',
    status: 'PASS',
    blocking: true,
    explanation: 'The exact Filing Authorization is authorized and unexpired.',
    source: 'EXECUTION_FILING_AUTHORIZATION',
    evidenceReference: 'filing-authorization_fixture-1479:2',
    checkedAt: recordedAt
  },
  {
    code: 'AUTHORIZED_PARTY_CAPACITY',
    status: 'PASS',
    blocking: true,
    explanation: 'Avery Chen authorized this scope as an authenticated authorized officer.',
    source: 'EXECUTION_FILING_AUTHORIZATION',
    evidenceReference: 'user_fixture-avery-chen',
    checkedAt: recordedAt
  },
  {
    code: 'COMMERCIAL_SCOPE_UNCHANGED',
    status: 'UNKNOWN',
    blocking: true,
    explanation: 'Current commercial-scope evidence requires a fresh evaluation.',
    source: 'CORE_COMMERCIAL_SCOPE',
    checkedAt: recordedAt
  },
  {
    code: 'EXECUTION_CHANNEL_WINDOW',
    status: 'PASS',
    blocking: true,
    explanation: 'Office portal preparation is permitted inside the authorized window.',
    source: 'EXECUTION_FILING_AUTHORIZATION',
    evidenceReference: 'filing-authorization_fixture-1479:window',
    checkedAt: recordedAt
  },
  {
    code: 'AUTHORITY_BOUNDARY_ACKNOWLEDGEMENTS',
    status: 'PASS',
    blocking: true,
    explanation: 'All nine active authority acknowledgements are recorded.',
    source: 'EXECUTION_FILING_AUTHORIZATION',
    evidenceReference: 'filing-authorization_fixture-1479:acknowledgements',
    checkedAt: recordedAt
  },
  {
    code: 'REPRESENTATIVE_REQUIREMENT',
    status: 'NOT_APPLICABLE',
    blocking: false,
    explanation: 'No professional appointment is created by this internal release.',
    source: 'EXECUTION_POLICY',
    checkedAt: recordedAt
  }
];

const evidence = [
  { reference: 'preparation-lock_fixture-1478:1', source: 'PREPARATION_LOCK', recordedAt },
  {
    reference: 'filing-authorization_fixture-1479:2',
    source: 'FILING_AUTHORIZATION',
    recordedAt
  },
  { reference: 'professional-review_fixture-1475:2', source: 'PROFESSIONAL_REVIEW', recordedAt },
  { reference: 'commercial-scope_fixture-northstar:6', source: 'COMMERCIAL_SCOPE', recordedAt }
] as const;

export const blockedRelease: ExecutionRelease = {
  schemaVersion: 1,
  version: 1,
  executionReleaseId: previewReleaseId,
  filingAuthorizationId: 'filing-authorization_fixture-1479',
  filingAuthorizationVersion: 2,
  preparationLockId: 'preparation-lock_fixture-1478',
  preparationLockVersion: '1:6666666666666666666666666666666666666666666666666666666666666666',
  professionalReviewCaseId: 'professional-review_fixture-1475',
  professionalReviewVersion: '2:decision_fixture-completed-1475',
  customerId: 'customer_fixture-northstar',
  jurisdiction: 'GB',
  requestedExecutionChannel: 'OFFICE_PORTAL',
  checks: blockedChecks,
  assignment: {},
  evidence,
  status: 'BLOCKED',
  createdAt: recordedAt,
  updatedAt: recordedAt
};

export const readyRelease: ExecutionRelease = {
  ...blockedRelease,
  version: 2,
  checks: blockedChecks.map((check) =>
    check.code === 'COMMERCIAL_SCOPE_UNCHANGED'
      ? {
          ...check,
          status: 'PASS',
          explanation: 'The current commercial scope exactly matches the authorized scope.',
          evidenceReference: 'commercial-scope_fixture-northstar:6',
          checkedAt: '2026-10-05T09:12:00.000Z'
        }
      : check
  ),
  status: 'READY_FOR_RELEASE',
  updatedAt: '2026-10-05T09:12:00.000Z'
};

export const assignedRelease: ExecutionRelease = {
  ...readyRelease,
  version: 3,
  assignment: {
    internalExecutorId: 'user_fixture-riley-operator',
    assignedAt: '2026-10-05T09:14:00.000Z'
  },
  updatedAt: '2026-10-05T09:14:00.000Z'
};

export const releasedRelease: ExecutionRelease = {
  ...assignedRelease,
  version: 4,
  decision: {
    decision: 'RELEASE',
    decidedBy: 'user_fixture-riley-operator',
    rationale: 'All blocking recorded evidence passes and the bounded internal scope is unchanged.',
    decidedAt: '2026-10-05T09:18:00.000Z'
  },
  status: 'RELEASED_FOR_EXECUTION',
  releasedAt: '2026-10-05T09:18:00.000Z',
  updatedAt: '2026-10-05T09:18:00.000Z'
};

export const previewTask: FilingExecutionTaskDraft = {
  schemaVersion: 1,
  filingExecutionTaskDraftId: 'filing-task-draft_fixture-1480',
  executionReleaseId: previewReleaseId,
  filingAuthorizationId: blockedRelease.filingAuthorizationId,
  preparationLockId: blockedRelease.preparationLockId,
  executionSnapshot: {
    jurisdiction: 'United Kingdom',
    applicantOwnerReference: 'Northstar Goods Ltd',
    trademarkReference: 'NORTHSTAR / word mark',
    classes: ['9', '35', '42'],
    goodsServices: [
      'Downloadable software for brand portfolio management',
      'Business consultancy relating to brand protection',
      'Software as a service for evidence-led trademark operations'
    ],
    filingBasis: 'INTENT_TO_USE',
    useLockedDocuments: true,
    representativeUse: 'PERMITTED_WHERE_REQUIRED',
    permittedFilingChannel: 'OFFICE_PORTAL',
    permittedExecutionWindow: {
      startsAt: '2026-10-05T09:00:00.000Z',
      endsAt: '2026-11-04T17:00:00.000Z'
    }
  },
  jurisdiction: 'United Kingdom',
  applicant: 'Northstar Goods Ltd',
  trademark: 'NORTHSTAR / word mark',
  classes: ['9', '35', '42'],
  goodsServices: [
    'Downloadable software for brand portfolio management',
    'Business consultancy relating to brand protection',
    'Software as a service for evidence-led trademark operations'
  ],
  filingBasis: 'INTENT_TO_USE',
  documentReferences: ['document_fixture-mark-representation', 'document_fixture-owner-evidence'],
  instructionReferences: ['instruction_fixture-filing-scope'],
  representativeRequirement: 'PERMITTED_WHERE_REQUIRED',
  executionChannel: 'OFFICE_PORTAL',
  internalAssigneeReference: 'user_fixture-riley-operator',
  status: 'PREPARED',
  createdAt: '2026-10-05T09:18:00.000Z'
};

const secondaryReady: ExecutionRelease = {
  ...readyRelease,
  executionReleaseId: 'execution-release_fixture-atlas',
  filingAuthorizationId: 'filing-authorization_fixture-atlas',
  preparationLockId: 'preparation-lock_fixture-atlas',
  professionalReviewCaseId: 'professional-review_fixture-atlas',
  customerId: 'customer_fixture-atlas',
  jurisdiction: 'US',
  requestedExecutionChannel: 'INTERNAL_MANUAL_PREPARATION',
  assignment: { internalExecutorId: 'user_fixture-jo-morgan', assignedAt: recordedAt }
};

const secondaryReleased: ExecutionRelease = {
  ...releasedRelease,
  executionReleaseId: 'execution-release_fixture-ember',
  filingAuthorizationId: 'filing-authorization_fixture-ember',
  preparationLockId: 'preparation-lock_fixture-ember',
  professionalReviewCaseId: 'professional-review_fixture-ember',
  customerId: 'customer_fixture-ember',
  jurisdiction: 'GB'
};

export function releasesForScenario(
  scenario: ExecutionReleasePreviewScenario
): ReadonlyArray<ExecutionRelease> | undefined {
  if (['loading', 'unauthorized', 'missing', 'unavailable', 'error'].includes(scenario))
    return undefined;
  if (scenario === 'empty') return [];
  if (scenario === 'ready') return [readyRelease];
  if (scenario === 'released') return [releasedRelease];
  if (scenario === 'stale') return [{ ...readyRelease, version: 5, status: 'STALE' }];
  if (scenario === 'withdrawn') return [{ ...blockedRelease, version: 2, status: 'WITHDRAWN' }];
  if (scenario === 'partial') return [{ ...blockedRelease, evidence: [] }];
  if (['permission', 'conflict', 'validation', 'blocked'].includes(scenario))
    return [blockedRelease];
  return [blockedRelease, secondaryReady, secondaryReleased];
}

const failure = (status: number, code: string, message: string) =>
  Promise.reject(new ExecutionHttpError(status, code, message));

export function clientForScenario(scenario: ExecutionReleasePreviewScenario): LiteExecutionClient {
  let current: ExecutionRelease =
    scenario === 'released'
      ? releasedRelease
      : scenario === 'ready'
        ? readyRelease
        : scenario === 'stale'
          ? { ...readyRelease, version: 5, status: 'STALE' }
          : scenario === 'withdrawn'
            ? { ...blockedRelease, version: 2, status: 'WITHDRAWN' }
            : blockedRelease;
  const response = (release: ExecutionRelease) => ({
    executionRelease: structuredClone(release),
    consequences: previewConsequences
  });
  return {
    createRelease: () => Promise.resolve(response(blockedRelease)),
    listReleases:
      scenario === 'loading'
        ? () => new Promise(() => undefined)
        : scenario === 'unauthorized'
          ? () => failure(401, 'AUTHENTICATION_REQUIRED', 'Sign in to review internal releases.')
          : scenario === 'missing'
            ? () => failure(404, 'EXECUTION_RELEASE_NOT_FOUND', 'The exact release was not found.')
            : scenario === 'unavailable'
              ? () =>
                  failure(
                    503,
                    'EXECUTION_UNAVAILABLE',
                    'Current execution evidence is unavailable.'
                  )
              : scenario === 'error'
                ? () =>
                    failure(500, 'EXECUTION_REQUEST_FAILED', 'The release queue could not load.')
                : () =>
                    Promise.resolve({
                      executionReleases: [...(releasesForScenario(scenario) ?? [])],
                      consequences: previewConsequences
                    }),
    getRelease: () => Promise.resolve(response(current)),
    evaluateRelease:
      scenario === 'permission'
        ? () => failure(403, 'PERMISSION_DENIED', 'execution:release permission is required.')
        : scenario === 'conflict'
          ? () => {
              current = { ...readyRelease, version: 8 };
              return failure(409, 'STALE_EXECUTION_RELEASE', 'The release changed during review.');
            }
          : () => {
              current = readyRelease;
              return Promise.resolve(response(current));
            },
    updateAssignment: () => {
      current = assignedRelease;
      return Promise.resolve(response(current));
    },
    release:
      scenario === 'validation'
        ? () => failure(422, 'RELEASE_RATIONALE_REQUIRED', 'A valid release rationale is required.')
        : () => {
            current = releasedRelease;
            return Promise.resolve({
              releaseResult: { release: releasedRelease, taskDraft: previewTask },
              consequences: previewConsequences
            });
          },
    withdrawRelease: () => {
      current = { ...current, version: current.version + 1, status: 'WITHDRAWN' };
      return Promise.resolve(response(current));
    },
    getTaskDraft: () =>
      Promise.resolve({ filingExecutionTaskDraft: previewTask, consequences: previewConsequences }),
    getTaskDraftForRelease:
      scenario === 'partial'
        ? () => failure(503, 'TASK_RECEIPT_UNAVAILABLE', 'The task receipt cannot be reloaded yet.')
        : () =>
            Promise.resolve({
              filingExecutionTaskDraft: previewTask,
              consequences: previewConsequences
            })
  };
}
