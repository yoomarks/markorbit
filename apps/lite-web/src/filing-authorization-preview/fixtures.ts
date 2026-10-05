import type { AuthorizationAuthorityConsequences, FilingAuthorization } from '@markorbit/contracts';
import {
  FilingAuthorizationHttpError,
  type FilingAuthorizationClient,
  type FilingAuthorizationResponse
} from '../api/filing-authorization.js';
import { filingAuthorizationAcknowledgements } from '../features/filing-authorization/FilingAuthorizationWorkspace.js';

export type FilingAuthorizationPreviewScenario =
  | 'ready'
  | 'loading'
  | 'partial'
  | 'unauthorized'
  | 'permission'
  | 'missing'
  | 'conflict'
  | 'validation'
  | 'unavailable'
  | 'error'
  | 'confirming'
  | 'authorized'
  | 'stale'
  | 'expired'
  | 'withdrawn';

export const previewWorkspaceId = 'workspace_fixture-markreg-1479';
export const previewAuthorizationId = 'filing-authorization_fixture-1479';
const recordedAt = '2026-10-05T08:20:00.000Z';

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

export const previewAuthorization: FilingAuthorization = {
  schemaVersion: 1,
  version: 1,
  filingAuthorizationId: previewAuthorizationId,
  preparationLockId: 'preparation-lock_fixture-1478',
  preparationLockVersion: '1:6666666666666666666666666666666666666666666666666666666666666666',
  durablePreparationSource: {
    kind: 'DURABLE',
    preparationLockVersion: 1,
    preparationLockFingerprint: '6'.repeat(64),
    documentPackage: {
      documentPackageId: 'document-package_fixture-documents-1476',
      documentPackageVersion: 4,
      canonicalEvidenceHash: '3'.repeat(64),
      documentReferences: [
        'brand-mark-wordmark-v3.pdf',
        'owner-certificate-signed.pdf',
        'goods-services-reviewed-v2.pdf'
      ],
      instructionReferences: [
        'instruction-entry_goods-services-01',
        'instruction-entry_owner-authority-02'
      ]
    },
    formalMatter: {
      formalMatterId: 'formal-matter_fixture-1475',
      formalMatterVersion: 3,
      formalMatterHash: '4'.repeat(64)
    },
    professionalReview: {
      professionalReviewCaseId: 'professional-review_fixture-1475',
      professionalReviewVersion: 2,
      completedDecisionId: 'decision_fixture-completed-1475',
      completedDecisionHash: '5'.repeat(64)
    }
  },
  professionalReviewCaseId: 'professional-review_fixture-1475',
  professionalReviewVersion: '2:decision_fixture-completed-1475',
  customerId: 'customer_fixture-northstar',
  authorizedParty: {
    partyId: 'user_fixture-avery-chen',
    displayName: 'Avery Chen'
  },
  authorizationCapacity: 'AUTHORIZED_OFFICER',
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
  representativeRequirement: 'PERMITTED_WHERE_REQUIRED',
  scope: {
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
  termsVersion: 'filing-authorization-terms-v1',
  acknowledgements: [],
  evidence: [
    {
      reference: 'preparation-lock_fixture-1478',
      source: 'MARKREG_PREPARATION_LOCK',
      recordedAt
    }
  ],
  status: 'PENDING_CONFIRMATION',
  expiresAt: '2026-11-04T17:00:00.000Z',
  createdAt: recordedAt,
  updatedAt: recordedAt
};

export const authorizedAuthorization: FilingAuthorization = {
  ...previewAuthorization,
  version: 2,
  status: 'AUTHORIZED',
  authorizedAt: '2026-10-05T08:32:00.000Z',
  updatedAt: '2026-10-05T08:32:00.000Z',
  acknowledgements: filingAuthorizationAcknowledgements.map(({ code }) => ({
    code,
    version: 1,
    acknowledgedBy: previewAuthorization.authorizedParty.partyId,
    acknowledgedAt: '2026-10-05T08:32:00.000Z',
    evidenceReference: `filing-authorization:${previewAuthorizationId}:${code}`
  }))
};

const response = (authorization: FilingAuthorization): FilingAuthorizationResponse => ({
  filingAuthorization: structuredClone(authorization),
  consequences: previewConsequences
});

const failure = (status: number, code: string, message: string) =>
  Promise.reject(new FilingAuthorizationHttpError(status, code, message));

export function authorizationForScenario(
  scenario: FilingAuthorizationPreviewScenario
): FilingAuthorization {
  if (scenario === 'authorized') return authorizedAuthorization;
  if (scenario === 'stale') return { ...previewAuthorization, version: 3, status: 'STALE' };
  if (scenario === 'expired') return { ...previewAuthorization, version: 3, status: 'EXPIRED' };
  if (scenario === 'withdrawn')
    return {
      ...previewAuthorization,
      version: 3,
      status: 'WITHDRAWN',
      withdrawnAt: '2026-10-05T08:40:00.000Z'
    };
  if (scenario === 'partial')
    return {
      ...previewAuthorization,
      durablePreparationSource: {
        ...previewAuthorization.durablePreparationSource!,
        documentPackage: {
          ...previewAuthorization.durablePreparationSource!.documentPackage,
          documentReferences: []
        }
      },
      scope: {
        jurisdiction: previewAuthorization.scope.jurisdiction,
        applicantOwnerReference: previewAuthorization.scope.applicantOwnerReference,
        trademarkReference: previewAuthorization.scope.trademarkReference,
        classes: previewAuthorization.scope.classes,
        goodsServices: previewAuthorization.scope.goodsServices,
        filingBasis: previewAuthorization.scope.filingBasis,
        useLockedDocuments: true,
        representativeUse: previewAuthorization.scope.representativeUse,
        permittedFilingChannel: previewAuthorization.scope.permittedFilingChannel,
        permittedExecutionWindow: previewAuthorization.scope.permittedExecutionWindow
      }
    };
  return previewAuthorization;
}

export function clientForScenario(
  scenario: FilingAuthorizationPreviewScenario
): FilingAuthorizationClient {
  const current = authorizationForScenario(scenario);
  const get = () => Promise.resolve(response(current));
  return {
    create: () => Promise.resolve(response(previewAuthorization)),
    get:
      scenario === 'loading'
        ? () => new Promise<FilingAuthorizationResponse>(() => undefined)
        : scenario === 'unauthorized'
          ? () => failure(401, 'SESSION_REQUIRED', 'Sign in before reviewing this authorization.')
          : scenario === 'missing'
            ? () =>
                failure(404, 'AUTHORIZATION_NOT_FOUND', 'The exact authorization was not found.')
            : scenario === 'unavailable'
              ? () => failure(503, 'EXECUTION_UNAVAILABLE', 'Execution owner truth is unavailable.')
              : scenario === 'error'
                ? () =>
                    failure(500, 'AUTHORIZATION_REQUEST_FAILED', 'The record could not be loaded.')
                : get,
    confirm:
      scenario === 'permission'
        ? () => failure(403, 'PERMISSION_DENIED', 'Filing Authorization permission is required.')
        : scenario === 'conflict'
          ? () =>
              failure(
                409,
                'STALE_FILING_AUTHORIZATION',
                'The exact Preparation Lock or authorization version changed.'
              )
          : scenario === 'validation'
            ? () =>
                failure(
                  422,
                  'ACKNOWLEDGEMENTS_REQUIRED',
                  'All active acknowledgements must be accepted by the owner service.'
                )
            : scenario === 'confirming'
              ? () => new Promise<FilingAuthorizationResponse>(() => undefined)
              : () => Promise.resolve(response(authorizedAuthorization))
  };
}
