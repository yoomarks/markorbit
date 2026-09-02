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

function responseView(value) {
  const source = record(value, 'responseState');
  if (!responseKinds.has(source.kind)) {
    throw new ProviderWorkModelError('responseState.kind is malformed.');
  }
  if (source.kind === 'KNOWN_RESPONSE') {
    const response = record(source.response, 'responseState.response');
    nonEmptyString(response.id, 'responseState.response.id');
    positiveVersion(response.version, 'responseState.response.version');
    if (!['ACCEPTED', 'DECLINED'].includes(source.decision)) {
      throw new ProviderWorkModelError('responseState.decision is malformed.');
    }
    return {
      state: source.kind,
      label: source.decision === 'ACCEPTED' ? 'Response recorded: accepted' : 'Response recorded: declined',
      detail: `${response.id} · v${response.version}`
    };
  }
  if (source.kind === 'KNOWN_ABSENT') {
    if (source.allocationActiveDoesNotImplyPendingResponse !== true) {
      throw new ProviderWorkModelError('Known response absence lost its no-inference guard.');
    }
    return {
      state: source.kind,
      label: 'No response recorded',
      detail: 'Known absence only; Allocation state does not imply pending or acceptance.'
    };
  }
  return {
    state: source.kind,
    label: 'Response source unavailable',
    detail: 'Response state cannot be inferred while its source is unavailable.'
  };
}

function returnView(value) {
  const source = record(value, 'returnState');
  if (!returnKinds.has(source.kind)) {
    throw new ProviderWorkModelError('returnState.kind is malformed.');
  }
  if (source.kind === 'KNOWN_RETURN') {
    const providerReturn = record(source.providerReturn, 'returnState.providerReturn');
    nonEmptyString(providerReturn.id, 'returnState.providerReturn.id');
    positiveVersion(providerReturn.version, 'returnState.providerReturn.version');
    if (source.providerReturnRemainsClaimEvidenceNotOfficialTruth !== true) {
      throw new ProviderWorkModelError('Provider Return truth boundary is malformed.');
    }
    return {
      state: source.kind,
      label: `Provider Return: ${nonEmptyString(source.status, 'returnState.status')}`,
      detail: `${providerReturn.id} · v${providerReturn.version} · claim/evidence only, not Official Truth`
    };
  }
  if (source.kind === 'KNOWN_ABSENT') {
    return {
      state: source.kind,
      label: 'No Provider Return recorded',
      detail: 'Known absence from the authoritative read source.'
    };
  }
  return {
    state: source.kind,
    label: 'Provider Return source unavailable',
    detail: 'Return state cannot be inferred while its source is unavailable.'
  };
}

function incomingView(value) {
  const source = record(value, 'incomingDataAuthority');
  if (!incomingStates.has(source.state)) {
    throw new ProviderWorkModelError('incomingDataAuthority.state is malformed.');
  }
  if (source.embeddedPrivateFieldValues !== false) {
    throw new ProviderWorkModelError('Incoming-data projection must not embed private field values.');
  }
  switch (source.state) {
    case 'CURRENTLY_USABLE':
      return {
        state: source.state,
        label: 'Incoming-data authority currently usable',
        detail: 'Only the exact authorized projection may be resolved separately; no private values are embedded here.'
      };
    case 'DENIED':
      if (source.incomingFieldsVisible !== false) {
        throw new ProviderWorkModelError('Denied incoming-data authority must keep fields hidden.');
      }
      return {
        state: source.state,
        label: 'Incoming-data authority denied',
        detail: `Incoming fields remain hidden${source.denialReason ? ` · ${source.denialReason}` : ''}.`
      };
    case 'KNOWN_ABSENT':
      if (source.incomingFieldsVisible !== false) {
        throw new ProviderWorkModelError('Known-absent incoming-data authority must keep fields hidden.');
      }
      return {
        state: source.state,
        label: 'No controlled handoff authority recorded',
        detail: 'Known absence; incoming fields remain hidden.'
      };
    case 'UNKNOWN':
      if (source.incomingFieldsVisible !== false || source.reason !== 'AUTHORITY_STATE_NOT_ESTABLISHED') {
        throw new ProviderWorkModelError('Unknown incoming-data authority must fail closed.');
      }
      return {
        state: source.state,
        label: 'Incoming-data authority unknown',
        detail: 'Authority state is not established. This is not known absence; incoming fields remain hidden.'
      };
    default:
      if (source.incomingFieldsVisible !== false) {
        throw new ProviderWorkModelError('Unavailable incoming-data authority must keep fields hidden.');
      }
      return {
        state: source.state,
        label: 'Incoming-data authority source unavailable',
        detail: 'Current incoming-data permission cannot be established; incoming fields remain hidden.'
      };
  }
}

export function toProviderWorkItemViewModel(value) {
  const item = record(value, 'Provider work item');
  if (item.schemaVersion !== 1) throw new ProviderWorkModelError('Unsupported Provider work schema version.');
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
  nonEmptyString(origin.professionalReference, 'origin.professionalReference');
  if (origin.exposureClass !== 'ORIGINATING_PROFESSIONAL_REFERENCE_ONLY') {
    throw new ProviderWorkModelError('Origin projection is broader than allowed.');
  }
  if (item.allocationIsExistingM4TruthNotCreatedByProjection !== true || item.queuePresenceIsNotActionAuthority !== true) {
    throw new ProviderWorkModelError('Provider work authority boundary is malformed.');
  }
  allFalse(item.privacyExclusions, privacyKeys, 'privacyExclusions');
  allFalse(item.authorityConsequences, authorityKeys, 'authorityConsequences');

  return Object.freeze({
    allocationId,
    allocationVersion: allocation.version,
    allocationStatus: allocation.status,
    updatedAt: allocation.updatedAt,
    servicePackageId: packageReference.id,
    servicePackageVersion: packageReference.version,
    professionalReference: origin.professionalReference,
    response: responseView(item.responseState),
    providerReturn: returnView(item.returnState),
    incoming: incomingView(item.incomingDataAuthority),
    readOnly: true,
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
  if (page.nextCursor !== undefined) nonEmptyString(page.nextCursor, 'providerWorkItemList.page.nextCursor');
  return Object.freeze({
    items: list.items.map(toProviderWorkItemViewModel),
    nextCursor: page.nextCursor,
    checkedAt: nonEmptyString(list.checkedAt, 'providerWorkItemList.checkedAt')
  });
}

export function parseProviderWorkDetailBody(body) {
  const root = record(body, 'Gateway response');
  const read = record(root.providerWorkItemRead, 'providerWorkItemRead');
  if (read.schemaVersion !== 1 || read.decision !== 'AUTHORIZED' || read.existenceDisclosed !== true) {
    throw new ProviderWorkModelError('Provider work detail authorization projection is malformed.');
  }
  if (read.readAuthorityDoesNotAuthorizeMutation !== true) {
    throw new ProviderWorkModelError('Provider work read authority was widened into mutation authority.');
  }
  return toProviderWorkItemViewModel(read.item);
}
