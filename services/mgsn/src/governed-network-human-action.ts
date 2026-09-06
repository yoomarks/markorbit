import type { WorkspacePrincipal } from '@markorbit/contracts';
import { HttpError, type JsonRequest } from '@markorbit/service-kit';

export const MGSN_GOVERNED_HUMAN_ACTION_HEADER =
  'x-markorbit-governed-network-human-action' as const;

export type MgsnGovernedHumanActionKind = 'PROVIDER_SELECTION' | 'CONTROLLED_HANDOFF';

/**
 * Internal transport evidence only. This envelope is not a bearer capability and is unusable
 * without the existing internal-service secret plus an exact trusted Workspace Principal.
 * Browser/Gateway code must construct it from a separately reviewed explicit human action and must
 * never forward a browser-supplied value verbatim.
 */
export interface MgsnGovernedHumanActionEnvelopeV1 {
  schemaVersion: 1;
  kind: MgsnGovernedHumanActionKind;
  actorKind: 'HUMAN_USER';
  workspaceId: string;
  userId: string;
  membershipId: string;
  principalReference: string;
  authorityReference: string;
  authorityVersion: number | string;
  authenticatedAt: string;
  affirmativeHumanActionEvidenceReference: string;
  payloadIdentityAuthoritative: false;
}

function validVersion(value: unknown): value is number | string {
  return (
    (typeof value === 'number' && Number.isInteger(value) && value > 0) ||
    (typeof value === 'string' && value.trim().length > 0)
  );
}

export function parseHumanActionEnvelope(
  request: JsonRequest,
  principal: WorkspacePrincipal,
  expectedKind: MgsnGovernedHumanActionKind
): MgsnGovernedHumanActionEnvelopeV1 {
  const encoded = request.headers[MGSN_GOVERNED_HUMAN_ACTION_HEADER];
  if (!encoded)
    throw new HttpError(
      403,
      'GOVERNED_HUMAN_ACTION_REQUIRED',
      `A reviewed ${expectedKind} human-action authority is required.`
    );
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority is invalid.'
    );
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority is invalid.'
    );
  const envelope = parsed as Record<string, unknown>;
  const allowedHumanActionFields = new Set([
    'schemaVersion',
    'kind',
    'actorKind',
    'workspaceId',
    'userId',
    'membershipId',
    'principalReference',
    'authorityReference',
    'authorityVersion',
    'authenticatedAt',
    'affirmativeHumanActionEvidenceReference',
    'payloadIdentityAuthoritative'
  ]);
  if (Object.keys(envelope).some((field) => !allowedHumanActionFields.has(field)))
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority contains unsupported fields.'
    );
  const textField = (value: unknown): string => {
    if (typeof value !== 'string' || !value.trim())
      throw new HttpError(
        403,
        'INVALID_GOVERNED_HUMAN_ACTION',
        'Governed-network human-action authority is invalid.'
      );
    return value.trim();
  };
  const workspaceId = textField(envelope.workspaceId);
  const userId = textField(envelope.userId);
  const membershipId = textField(envelope.membershipId);
  const principalReference = textField(envelope.principalReference);
  const authorityReference = textField(envelope.authorityReference);
  const authenticatedAt = textField(envelope.authenticatedAt);
  const affirmativeHumanActionEvidenceReference = textField(
    envelope.affirmativeHumanActionEvidenceReference
  );
  const authorityVersion = envelope.authorityVersion;
  if (
    envelope.schemaVersion !== 1 ||
    envelope.kind !== expectedKind ||
    envelope.actorKind !== 'HUMAN_USER' ||
    envelope.payloadIdentityAuthoritative !== false ||
    !validVersion(authorityVersion) ||
    !Number.isFinite(Date.parse(authenticatedAt)) ||
    workspaceId.toLowerCase() !== principal.workspaceId.toLowerCase() ||
    userId.toLowerCase() !== principal.userId.toLowerCase() ||
    membershipId.toLowerCase() !== principal.membershipId.toLowerCase()
  )
    throw new HttpError(
      403,
      'INVALID_GOVERNED_HUMAN_ACTION',
      'Governed-network human-action authority does not match the trusted Workspace Principal.'
    );
  return {
    schemaVersion: 1,
    kind: expectedKind,
    actorKind: 'HUMAN_USER',
    workspaceId,
    userId,
    membershipId,
    principalReference,
    authorityReference,
    authorityVersion,
    authenticatedAt,
    affirmativeHumanActionEvidenceReference,
    payloadIdentityAuthoritative: false
  };
}
