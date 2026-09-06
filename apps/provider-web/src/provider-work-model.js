const allocationStatuses = new Set(['ACTIVE', 'CANCELLED', 'SUPERSEDED']);
const responseKinds = new Set(['KNOWN_RESPONSE', 'KNOWN_ABSENT', 'SOURCE_UNAVAILABLE']);
const returnKinds = new Set(['KNOWN_RETURN', 'KNOWN_ABSENT', 'SOURCE_UNAVAILABLE']);
const incomingStates = new Set([
  'CURRENTLY_USABLE',
  'DENIED',
  'KNOWN_ABSENT',
  'UNKNOWN',
  'SOURCE_UNAVAILABLE'
]);

const privacyKeys = [
  'allocationRationaleIncluded',
  'allocatorIdentityIncluded',
  'supplyCapabilityContentsIncluded',
  'servicePackageSourceSnapshotIncluded',
  'providerAcceptanceAcknowledgementIncluded',
  'providerReturnArtifactsIncluded',
  'providerReturnAssertionsIncluded',
  'endClientRelationshipInformationIncluded',
  'endClientContactIncluded',
  'originatingPricingMarginProfitIncluded',
  'privateCrmContextIncluded',
  'unrelatedCommunicationsIncluded',
  'unrelatedAssetsOrMattersIncluded',
  'rawPrivateEvidenceIncluded'
];

const authorityKeys = [
  'createsProviderSelection',
  'createsProviderAllocation',
  'createsProviderAcceptance',
  'createsProviderEngagement',
  'createsProfessionalAppointment',
  'authorizesExternalContact',
  'authorizesProtectedActionRelease',
  'authorizesFiling',
  'submitsFiling',
  'authorizesPayment',
  'createsPayment',
  'createsOfficialTruth',
  'completesMatter'
];

export class ProviderWorkModelError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderWorkModelError';
    this.code = 'MALFORMED_PROVIDER_WORK';
  }
}

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProviderWorkModelError(`${label} is malformed.`);
  }
  return value;
}

function nonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ProviderWorkModelError(`${label} is malformed.`);
  }
  return value;
}

function positiveVersion(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new ProviderWorkModelError(`${label} is malformed.`);
  }
  return value;
}

function allFalse(value, keys, label) {
  const source = record(value, label);
  for (const key of keys) {
    if (source[key] !== false) {
      throw new ProviderWorkModelError(`${label}.${key} must remain false.`);
    }
  }
}

function actionLineageView(value) {
  if (value === undefined) return undefined;
  const source = record(value, 'actionLineage');
  if (source.actionAuthorityNotGrantedByProjection !== true) {
    throw new ProviderWorkModelError('actionLineage widened projection into action authority.');
  }
  return Object.freeze({
    correlationId: nonEmptyString(source.correlationId, 'actionLineage.correlationId'),
    actionAuthorityNotGrantedByProjection: true
  });
}

function responseView(value) {
  const source = record(value, 'responseState');
  if (!responseKinds.has(source.kind)) {
    throw new ProviderWorkModelError('responseState.kind is malformed.');
  }
  if (source.kind === 'KNOWN_RESPONSE') {
    const response = record(source.response, 'responseState.response');
    const id = nonEmptyString(response.id, 'responseState.response.id');
    const version = positiveVersion(response.version, 'responseState.response.version');
    if (!['ACCEPTED', 'DECLINED'].includes(source.decision)) {
      throw new ProviderWorkModelError('responseState.decision is malformed.');
    }
    return Object.freeze({
      state: source.kind,
      id,
      version,
      decision: source.decision,
      respondedAt:
        source.respondedAt === undefined
          ? undefined
          : nonEmptyString(source.respondedAt, 'responseState.respondedAt'),
      label:
        source.decision === 'ACCEPTED'
          ? 'Response recorded: accepted'
          : 'Response recorded: declined',
      detail: `${id} · v${version}`
    });
  }
  if (source.kind === 'KNOWN_ABSENT') {
    if (source.allocationActiveDoesNotImplyPendingResponse !== true) {
      throw new ProviderWorkModelError('Known response absence lost its no-inference guard.');
    }
    return Object.freeze({
      state: source.kind,
      label: 'No response recorded',
      detail: 'Known absence only; Allocation state does not imply pending or acceptance.'
    });
  }
  return Object.freeze({
    state: source.kind,
    label: 'Response source unavailable',
    detail: 'Response state cannot be inferred while its source is unavailable.'
  });
}

function returnView(value) {
  const source = record(value, 'returnState');
  if (!returnKinds.has(source.kind)) {
    throw new ProviderWorkModelError('returnState.kind is malformed.');
  }
  if (source.kind === 'KNOWN_RETURN') {
    const providerReturn = record(source.providerReturn, 'returnState.providerReturn');
    const id = nonEmptyString(providerReturn.id, 'returnState.providerReturn.id');
    const version = positiveVersion(providerReturn.version, 'returnState.providerReturn.version');
    if (source.providerReturnRemainsClaimEvidenceNotOfficialTruth !== true) {
      throw new ProviderWorkModelError('Provider Return truth boundary is malformed.');
    }
    return Object.freeze({
      state: source.kind,
      id,
      version,
      status: nonEmptyString(source.status, 'returnState.status'),
      submittedAt:
        source.submittedAt === undefined
          ? undefined
          : nonEmptyString(source.submittedAt, 'returnState.submittedAt'),
      fingerprint:
        source.returnFingerprintSha256 === undefined
          ? undefined
          : nonEmptyString(source.returnFingerprintSha256, 'returnState.returnFingerprintSha256'),
      label: `Provider Return: ${source.status}`,
      detail: `${id} · v${version} · claim/evidence only, not Official Truth`
    });
  }
  if (source.kind === 'KNOWN_ABSENT') {
    return Object.freeze({
      state: source.kind,
      label: 'No Provider Return recorded',
      detail: 'Known absence from the authoritative read source.'
    });
  }
  return Object.freeze({
    state: source.kind,
    label: 'Provider Return source unavailable',
    detail: 'Return state cannot be inferred while its source is unavailable.'
  });
}

function incomingView(value) {
  const source = record(value, 'incomingDataAuthority');
  if (!incomingStates.has(source.state)) {
    throw new ProviderWorkModelError('incomingDataAuthority.state is malformed.');
  }
  if (source.embeddedPrivateFieldValues !== false) {
    throw new ProviderWorkModelError(
      'Incoming-data projection must not embed private field values.'
    );
  }
  if (source.state === 'CURRENTLY_USABLE') {
    return Object.freeze({
      state: source.state,
      label: 'Incoming-data authority currently usable',
      detail:
        'Only the exact authorized reference projection may be resolved separately; artifact retrieval authority is not implied.'
    });
  }
  if (source.incomingFieldsVisible !== false) {
    throw new ProviderWorkModelError('Non-usable incoming-data authority must keep fields hidden.');
  }
  if (source.state === 'DENIED') {
    return Object.freeze({
      state: source.state,
      label: 'Incoming-data authority denied',
      detail: `Incoming fields remain hidden${source.denialReason ? ` · ${source.denialReason}` : ''}.`
    });
  }
  if (source.state === 'KNOWN_ABSENT') {
    return Object.freeze({
      state: source.state,
      label: 'No controlled handoff authority recorded',
      detail: 'Known absence; incoming fields remain hidden.'
    });
  }
  if (source.state === 'UNKNOWN') {
    if (source.reason !== 'AUTHORITY_STATE_NOT_ESTABLISHED') {
      throw new ProviderWorkModelError('Unknown incoming-data authority must fail closed.');
    }
    return Object.freeze({
      state: source.state,
      label: 'Incoming-data authority unknown',
      detail:
        'Authority state is not established. This is not known absence; incoming fields remain hidden.'
    });
  }
  return Object.freeze({
    state: source.state,
    label: 'Incoming-data authority source unavailable',
    detail: 'Current incoming-data permission cannot be established; incoming fields remain hidden.'
  });
}

function taskView({ allocationStatus, response, providerReturn, actionLineage }) {
  if (allocationStatus !== 'ACTIVE') {
    return Object.freeze({
      kind: 'NO_ACTION',
      heading: 'No Provider action available',
      detail: `Allocation is ${allocationStatus.toLowerCase()}; history remains readable.`,
      canRespond: false,
      canSubmitReturn: false,
      canCorrectReturn: false
    });
  }
  if (response.state === 'SOURCE_UNAVAILABLE') {
    return Object.freeze({
      kind: 'DEPENDENCY_UNAVAILABLE',
      heading: 'Response state unavailable',
      detail:
        'Retry owner truth before deciding. No response action is safe while this source is unavailable.',
      canRespond: false,
      canSubmitReturn: false,
      canCorrectReturn: false
    });
  }
  if (!actionLineage) {
    return Object.freeze({
      kind: 'ACTION_LINEAGE_UNAVAILABLE',
      heading: 'Action lineage unavailable',
      detail: 'Refresh the work item. The read projection alone does not authorize a mutation.',
      canRespond: false,
      canSubmitReturn: false,
      canCorrectReturn: false
    });
  }
  if (response.state === 'KNOWN_ABSENT') {
    return Object.freeze({
      kind: 'RESPONSE_REQUIRED',
      heading: 'Response required',
      detail: 'Review the bounded work context, then explicitly Accept or Decline.',
      canRespond: true,
      canSubmitReturn: false,
      canCorrectReturn: false
    });
  }
  if (response.decision === 'DECLINED') {
    return Object.freeze({
      kind: 'DECLINED',
      heading: 'Response recorded: declined',
      detail: 'No Return can be submitted for a declined Allocation.',
      canRespond: false,
      canSubmitReturn: false,
      canCorrectReturn: false
    });
  }
  if (providerReturn.state === 'SOURCE_UNAVAILABLE') {
    return Object.freeze({
      kind: 'DEPENDENCY_UNAVAILABLE',
      heading: 'Return state unavailable',
      detail: 'Retry owner truth before submitting or correcting a Return.',
      canRespond: false,
      canSubmitReturn: false,
      canCorrectReturn: false
    });
  }
  if (providerReturn.state === 'KNOWN_ABSENT') {
    return Object.freeze({
      kind: 'RETURN_REQUIRED',
      heading: 'Prepare Provider Return',
      detail:
        'Record a work-status claim with at least one evidence reference or structured assertion.',
      canRespond: false,
      canSubmitReturn: true,
      canCorrectReturn: false
    });
  }
  return Object.freeze({
    kind: 'RETURN_RECORDED',
    heading: 'Provider Return recorded',
    detail: 'Review the current claim. Submit a correction only against its exact current version.',
    canRespond: false,
    canSubmitReturn: false,
    canCorrectReturn: providerReturn.status === 'CURRENT'
  });
}

export function toProviderWorkItemViewModel(value) {
  const item = record(value, 'Provider work item');
  if (item.schemaVersion !== 1) {
    throw new ProviderWorkModelError('Unsupported Provider work schema version.');
  }
  const provider = record(item.provider, 'provider');
  const allocation = record(item.allocation, 'allocation');
  const servicePackage = record(item.servicePackage, 'servicePackage');
  const packageReference = record(servicePackage.servicePackage, 'servicePackage.servicePackage');
  const origin = record(item.origin, 'origin');

  nonEmptyString(provider.providerId, 'provider.providerId');
  nonEmptyString(provider.providerWorkspaceId, 'provider.providerWorkspaceId');
  const allocationId = nonEmptyString(allocation.allocationId, 'allocation.allocationId');
  positiveVersion(allocation.version, 'allocation.version');
  if (!allocationStatuses.has(allocation.status)) {
    throw new ProviderWorkModelError('allocation.status is malformed.');
  }
  nonEmptyString(allocation.updatedAt, 'allocation.updatedAt');
  nonEmptyString(packageReference.id, 'servicePackage.id');
  positiveVersion(packageReference.version, 'servicePackage.version');
  const originatingWorkspaceId = nonEmptyString(
    origin.originatingWorkspaceId,
    'origin.originatingWorkspaceId'
  );
  nonEmptyString(origin.professionalReference, 'origin.professionalReference');
  if (origin.exposureClass !== 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY') {
    throw new ProviderWorkModelError('Origin projection is broader than allowed.');
  }
  if (
    item.allocationIsExistingM4TruthNotCreatedByProjection !== true ||
    item.queuePresenceIsNotActionAuthority !== true
  ) {
    throw new ProviderWorkModelError('Provider work authority boundary is malformed.');
  }
  allFalse(item.privacyExclusions, privacyKeys, 'privacyExclusions');
  allFalse(item.authorityConsequences, authorityKeys, 'authorityConsequences');

  const response = responseView(item.responseState);
  const providerReturn = returnView(item.returnState);
  const actionLineage = actionLineageView(item.actionLineage);
  return Object.freeze({
    allocationId,
    allocationVersion: allocation.version,
    allocationStatus: allocation.status,
    updatedAt: allocation.updatedAt,
    originatingWorkspaceId,
    servicePackageId: packageReference.id,
    servicePackageVersion: packageReference.version,
    professionalReference: origin.professionalReference,
    actionLineage,
    response,
    providerReturn,
    incoming: incomingView(item.incomingDataAuthority),
    task: taskView({
      allocationStatus: allocation.status,
      response,
      providerReturn,
      actionLineage
    }),
    queuePresenceIsNotActionAuthority: true
  });
}

export function parseProviderWorkListBody(body) {
  const root = record(body, 'Gateway response');
  const list = record(root.providerWorkItemList, 'providerWorkItemList');
  if (list.schemaVersion !== 1 || !Array.isArray(list.items)) {
    throw new ProviderWorkModelError('Provider work list is malformed.');
  }
  const page = record(list.page, 'providerWorkItemList.page');
  positiveVersion(page.limit, 'providerWorkItemList.page.limit');
  if (page.nextCursor !== undefined) {
    nonEmptyString(page.nextCursor, 'providerWorkItemList.page.nextCursor');
  }
  return Object.freeze({
    items: list.items.map(toProviderWorkItemViewModel),
    nextCursor: page.nextCursor,
    checkedAt: nonEmptyString(list.checkedAt, 'providerWorkItemList.checkedAt')
  });
}

export function parseProviderWorkDetailBody(body) {
  const root = record(body, 'Gateway response');
  const read = record(root.providerWorkItemRead, 'providerWorkItemRead');
  if (
    read.schemaVersion !== 1 ||
    read.decision !== 'AUTHORIZED' ||
    read.existenceDisclosed !== true
  ) {
    throw new ProviderWorkModelError('Provider work detail authorization projection is malformed.');
  }
  if (read.readAuthorityDoesNotAuthorizeMutation !== true) {
    throw new ProviderWorkModelError(
      'Provider work read authority was widened into mutation authority.'
    );
  }
  return toProviderWorkItemViewModel(read.item);
}

export function parseProviderReturnBody(body) {
  const root = record(body, 'Gateway response');
  const value = record(root.providerReturn, 'providerReturn');
  if (value.schemaVersion !== 1) {
    throw new ProviderWorkModelError('Unsupported Provider Return schema version.');
  }
  const allocation = record(value.allocation, 'providerReturn.allocation');
  const acceptance = record(value.providerAcceptance, 'providerReturn.providerAcceptance');
  const servicePackage = record(value.servicePackage, 'providerReturn.servicePackage');
  const artifacts = Array.isArray(value.artifacts) ? value.artifacts : undefined;
  const assertions = Array.isArray(value.assertions) ? value.assertions : undefined;
  if (!artifacts || !assertions) {
    throw new ProviderWorkModelError('Provider Return evidence is malformed.');
  }
  return Object.freeze({
    id: nonEmptyString(value.providerReturnId, 'providerReturn.providerReturnId'),
    version: positiveVersion(value.version, 'providerReturn.version'),
    status: nonEmptyString(value.status, 'providerReturn.status'),
    workStatusClaim: nonEmptyString(value.workStatusClaim, 'providerReturn.workStatusClaim'),
    allocationId: nonEmptyString(allocation.id, 'providerReturn.allocation.id'),
    allocationVersion: positiveVersion(allocation.version, 'providerReturn.allocation.version'),
    acceptanceId: nonEmptyString(acceptance.id, 'providerReturn.providerAcceptance.id'),
    acceptanceVersion: positiveVersion(
      acceptance.version,
      'providerReturn.providerAcceptance.version'
    ),
    servicePackageId: nonEmptyString(servicePackage.id, 'providerReturn.servicePackage.id'),
    servicePackageVersion: positiveVersion(
      servicePackage.version,
      'providerReturn.servicePackage.version'
    ),
    artifacts: artifacts.map((artifact, index) => ({
      reference: nonEmptyString(
        record(artifact, `providerReturn.artifacts[${index}]`).reference,
        `providerReturn.artifacts[${index}].reference`
      )
    })),
    assertions: assertions.map((assertion, index) => {
      const source = record(assertion, `providerReturn.assertions[${index}]`);
      return {
        code: nonEmptyString(source.code, `providerReturn.assertions[${index}].code`),
        value: source.value,
        evidenceReferences: Array.isArray(source.evidenceReferences)
          ? source.evidenceReferences.map((reference) =>
              nonEmptyString(reference, `providerReturn.assertions[${index}].evidenceReferences`)
            )
          : []
      };
    }),
    supersedes:
      value.supersedes === undefined
        ? undefined
        : {
            id: nonEmptyString(
              record(value.supersedes, 'providerReturn.supersedes').id,
              'providerReturn.supersedes.id'
            ),
            version: positiveVersion(value.supersedes.version, 'providerReturn.supersedes.version')
          },
    submittedAt: nonEmptyString(value.submittedAt, 'providerReturn.submittedAt'),
    correlationId: nonEmptyString(value.correlationId, 'providerReturn.correlationId'),
    truthBoundary: 'Provider-owned claim/evidence only; not Official Truth.'
  });
}
