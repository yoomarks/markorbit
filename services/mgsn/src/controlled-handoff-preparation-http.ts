import { parseInternalWorkspacePrincipal, type MarkOrbitId } from '@markorbit/contracts';
import {
  controlledHandoffPreparationStatuses,
  type ControlledHandoffPreparationRequestV1
} from '@markorbit/contracts/controlled-handoff-preparation';
import {
  controlledHandoffAuthorizedDataClasses,
  controlledHandoffPurposeCodes,
  type ControlledHandoffSourceOwner
} from '@markorbit/contracts/controlled-privacy-handoff';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import {
  ControlledHandoffPreparationError,
  type ControlledHandoffPreparationService
} from './controlled-handoff-preparation.js';
import { MGSN_GOVERNED_HUMAN_ACTION_HEADER } from './governed-network-http.js';

export interface MgsnControlledHandoffPreparationHttpOptions {
  internalServiceSecret?: string;
  service?: Pick<ControlledHandoffPreparationService, 'prepare'>;
}

type Body = Record<string, unknown>;
const sourceOwners = new Set<ControlledHandoffSourceOwner>([
  'CORE',
  'LITE',
  'MARKREG',
  'MGSN',
  'EXECUTION',
  'KNOWLEDGE',
  'OTHER_CANONICAL_OWNER'
]);
const forbiddenAuthorityFields = new Set([
  'workspaceId',
  'userId',
  'membershipId',
  'actorId',
  'principal',
  'principalReference',
  'trustedHumanAuthority',
  'directExecutorAuthority',
  'currentSelectionValidation',
  'currentSourceVersions',
  'authorizedProjection',
  'recipient',
  'purposeFingerprintSha256',
  'projectionFingerprintSha256',
  'sourceSetFingerprintSha256',
  'previewFingerprintSha256',
  'authorityReference',
  'authorityVersion'
]);

function object(value: unknown, field: string): Body {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'INVALID_HANDOFF_PREPARATION_REQUEST', `${field} must be an object.`);
  return value as Body;
}

function exactKeys(value: Body, allowed: readonly string[], field: string): void {
  const accepted = new Set(allowed);
  const unexpected = Object.keys(value).find((key) => !accepted.has(key));
  if (unexpected)
    throw new HttpError(
      400,
      'UNEXPECTED_HANDOFF_PREPARATION_FIELD',
      `${field}.${unexpected} is not permitted by the Handoff Preparation contract.`
    );
}

function requiredText(value: unknown, field: string, maximum = 500): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maximum)
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      `${field} must be a bounded non-empty string.`
    );
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || Number(value) < 1)
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      `${field} must be a positive integer.`
    );
  return Number(value);
}

function parseRequest(bodyValue: unknown): ControlledHandoffPreparationRequestV1 {
  const body = object(bodyValue, 'body');
  if (Object.keys(body).some((field) => forbiddenAuthorityFields.has(field)))
    throw new HttpError(
      400,
      'SPOOFED_HANDOFF_PREPARATION_AUTHORITY',
      'Handoff Preparation current authority is owner-produced and cannot be supplied by the caller.'
    );
  exactKeys(
    body,
    [
      'schemaVersion',
      'selection',
      'selectionScope',
      'purpose',
      'requestedFields',
      'checkedAt',
      'correlationId'
    ],
    'body'
  );
  if (body.schemaVersion !== 1)
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      'Unsupported Handoff Preparation schema version.'
    );
  const selection = object(body.selection, 'body.selection');
  exactKeys(selection, ['providerSelectionId', 'version', 'scopeVersion'], 'body.selection');
  const selectionScope = object(body.selectionScope, 'body.selectionScope');
  exactKeys(
    selectionScope,
    ['owner', 'reference', 'version', 'fingerprintSha256'],
    'body.selectionScope'
  );
  const purpose = object(body.purpose, 'body.purpose');
  exactKeys(purpose, ['code', 'contextReference', 'instructionReference'], 'body.purpose');
  const purposeCode = requiredText(purpose.code, 'body.purpose.code', 100);
  if (!controlledHandoffPurposeCodes.some((candidate) => candidate === purposeCode))
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      'body.purpose.code is not a bounded Controlled Handoff purpose.'
    );
  if (!Array.isArray(body.requestedFields) || body.requestedFields.length === 0)
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      'body.requestedFields must contain at least one bounded descriptor.'
    );
  if (body.requestedFields.length > 100)
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      'body.requestedFields contains too many descriptors.'
    );
  const requestedFields = body.requestedFields.map((value, index) => {
    const field = object(value, `body.requestedFields[${index}]`);
    exactKeys(
      field,
      ['dataClass', 'fieldPath', 'sourceOwner', 'sourceReference', 'necessityReference'],
      `body.requestedFields[${index}]`
    );
    const dataClass = requiredText(
      field.dataClass,
      `body.requestedFields[${index}].dataClass`,
      100
    );
    if (!controlledHandoffAuthorizedDataClasses.some((candidate) => candidate === dataClass))
      throw new HttpError(
        400,
        'INVALID_HANDOFF_PREPARATION_REQUEST',
        `body.requestedFields[${index}].dataClass is not authorized by the Controlled Handoff contract.`
      );
    const sourceOwner = requiredText(
      field.sourceOwner,
      `body.requestedFields[${index}].sourceOwner`,
      100
    ) as ControlledHandoffSourceOwner;
    if (!sourceOwners.has(sourceOwner))
      throw new HttpError(
        400,
        'INVALID_HANDOFF_PREPARATION_REQUEST',
        `body.requestedFields[${index}].sourceOwner is invalid.`
      );
    return {
      dataClass: dataClass as (typeof controlledHandoffAuthorizedDataClasses)[number],
      fieldPath: requiredText(field.fieldPath, `body.requestedFields[${index}].fieldPath`),
      sourceOwner,
      sourceReference: requiredText(
        field.sourceReference,
        `body.requestedFields[${index}].sourceReference`
      ),
      necessityReference: requiredText(
        field.necessityReference,
        `body.requestedFields[${index}].necessityReference`
      )
    };
  });
  const scopeVersion = selectionScope.version;
  if (!(
    (typeof scopeVersion === 'number' && Number.isInteger(scopeVersion) && scopeVersion > 0) ||
    (typeof scopeVersion === 'string' && scopeVersion.trim())
  ))
    throw new HttpError(
      400,
      'INVALID_HANDOFF_PREPARATION_REQUEST',
      'body.selectionScope.version must be a positive version reference.'
    );
  return {
    schemaVersion: 1,
    selection: {
      providerSelectionId: requiredText(
        selection.providerSelectionId,
        'body.selection.providerSelectionId',
        200
      ) as ControlledHandoffPreparationRequestV1['selection']['providerSelectionId'],
      version: positiveInteger(selection.version, 'body.selection.version'),
      scopeVersion: positiveInteger(selection.scopeVersion, 'body.selection.scopeVersion')
    },
    selectionScope: {
      owner: requiredText(
        selectionScope.owner,
        'body.selectionScope.owner',
        100
      ) as ControlledHandoffPreparationRequestV1['selectionScope']['owner'],
      reference: requiredText(selectionScope.reference, 'body.selectionScope.reference'),
      version: scopeVersion,
      fingerprintSha256: requiredText(
        selectionScope.fingerprintSha256,
        'body.selectionScope.fingerprintSha256',
        64
      )
    },
    purpose: {
      code: purposeCode as ControlledHandoffPreparationRequestV1['purpose']['code'],
      contextReference: requiredText(purpose.contextReference, 'body.purpose.contextReference'),
      instructionReference: requiredText(
        purpose.instructionReference,
        'body.purpose.instructionReference'
      )
    },
    requestedFields,
    checkedAt: requiredText(body.checkedAt, 'body.checkedAt', 100),
    correlationId: requiredText(body.correlationId, 'body.correlationId', 200) as MarkOrbitId
  };
}

function mapError(error: unknown): never {
  if (error instanceof ControlledHandoffPreparationError)
    throw new HttpError(error.status, error.code, error.message);
  throw error;
}

export function createMgsnControlledHandoffPreparationHttpRoutes(
  options: MgsnControlledHandoffPreparationHttpOptions = {}
): JsonRoute[] {
  const secret = options.internalServiceSecret ?? process.env.MO_INTERNAL_SERVICE_SECRET;
  return [
    {
      method: 'POST',
      path: '/v1/governed-network/handoffs/prepare',
      handle: async (request: JsonRequest) => {
        if (!secret || request.headers['x-markorbit-internal-authorization'] !== secret)
          throw new HttpError(
            401,
            'UNTRUSTED_INTERNAL_CALLER',
            'Trusted internal authorization is required.'
          );
        let principal;
        try {
          principal = parseInternalWorkspacePrincipal(request.headers['x-markorbit-principal']);
        } catch {
          throw new HttpError(
            401,
            'INVALID_INTERNAL_PRINCIPAL',
            'A trusted Workspace Principal is required.'
          );
        }
        if (request.headers[MGSN_GOVERNED_HUMAN_ACTION_HEADER])
          throw new HttpError(
            400,
            'GOVERNED_HUMAN_ACTION_NOT_APPLICABLE',
            'Handoff Preparation is review material only and does not consume Human Action authority.'
          );
        if (!options.service)
          throw new HttpError(
            503,
            'HANDOFF_PREPARATION_RUNTIME_UNCONFIGURED',
            'Controlled Handoff Preparation runtime is not configured.',
            true
          );
        const preparationRequest = parseRequest(request.body);
        let result;
        try {
          result = await options.service.prepare(
            { workspaceId: principal.workspaceId },
            preparationRequest
          );
        } catch (error) {
          return mapError(error);
        }
        if (!controlledHandoffPreparationStatuses.includes(result.status))
          throw new HttpError(
            503,
            'HANDOFF_PREPARATION_INVALID_OWNER_RESULT',
            'Controlled Handoff Preparation returned an invalid owner result.',
            true
          );
        return json(result.status === 'SOURCE_UNAVAILABLE' ? 503 : 200, {
          controlledHandoffPreparation: result
        });
      }
    }
  ];
}
