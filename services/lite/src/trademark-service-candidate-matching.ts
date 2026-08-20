import type {
  TrademarkServiceCapabilityCandidate,
  TrademarkServiceIntent,
  TrademarkServicePackageCandidate,
  TrademarkServiceProviderCandidate,
  TrademarkServiceWorkPackageId
} from '@markorbit/contracts/trademark-service-workbench';

export interface TrademarkServiceCapabilityOwnerSnapshot {
  sourceAuthority: 'CAPABILITY_ENGINE';
  capabilityReference: string;
  capabilityVersion?: string;
  supportedIntentKinds: readonly TrademarkServiceIntent['kind'][];
  supportedJurisdictions: readonly string[];
  current: boolean;
}

export interface TrademarkServiceProviderOwnerSnapshot {
  sourceAuthority: 'MGSN';
  providerReference: string;
  capabilityReferences: readonly string[];
  supportedJurisdictions: readonly string[];
  operational: boolean;
  current: boolean;
}

export interface TrademarkServicePackageOwnerSnapshot {
  sourceAuthority: 'MGSN';
  servicePackageReference: string;
  capabilityReference?: string;
  providerReference?: string;
  description: string;
  supportedIntentKinds: readonly TrademarkServiceIntent['kind'][];
  jurisdiction: string;
  status: 'ADMITTED' | 'INACTIVE' | 'UNKNOWN';
  eligibilityOutcome?: 'ELIGIBLE' | 'INELIGIBLE' | 'UNKNOWN';
  eligibilityReference?: string;
  sourceVersion?: string;
  current: boolean;
}

export interface MatchTrademarkServiceCandidatesCommand {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  intent: Readonly<TrademarkServiceIntent>;
  capabilitySnapshots: ReadonlyArray<Readonly<TrademarkServiceCapabilityOwnerSnapshot>>;
  providerSnapshots: ReadonlyArray<Readonly<TrademarkServiceProviderOwnerSnapshot>>;
  servicePackageSnapshots: ReadonlyArray<Readonly<TrademarkServicePackageOwnerSnapshot>>;
  generatedAt: string;
}

export interface TrademarkServiceCandidateMatchingResult {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  capabilityCandidates: ReadonlyArray<Readonly<TrademarkServiceCapabilityCandidate>>;
  providerCandidates: ReadonlyArray<Readonly<TrademarkServiceProviderCandidate>>;
  servicePackageCandidates: ReadonlyArray<Readonly<TrademarkServicePackageCandidate>>;
  discardedCapabilityCount: number;
  discardedProviderCount: number;
  discardedServicePackageCount: number;
  generatedAt: string;
  capabilityVerifiedByLite: false;
  providerEngagedByLite: false;
  providerSelectedByLite: false;
  servicePackageSelectedByLite: false;
  protectedActionAuthorized: false;
}

function clean(value: string): string {
  return value.trim();
}

function normalizedJurisdictions(values: readonly string[]): ReadonlySet<string> {
  return new Set(values.map((value) => clean(value).toUpperCase()).filter(Boolean));
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))].sort();
}

function matchesIntent(
  supported: readonly TrademarkServiceIntent['kind'][],
  intent: Readonly<TrademarkServiceIntent>
): boolean {
  return supported.includes(intent.kind);
}

function matchesJurisdiction(supported: readonly string[], jurisdiction: string): boolean {
  return normalizedJurisdictions(supported).has(clean(jurisdiction).toUpperCase());
}

export function matchTrademarkServiceCandidates(
  command: Readonly<MatchTrademarkServiceCandidatesCommand>
): TrademarkServiceCandidateMatchingResult {
  const workspaceId = clean(command.workspaceId);
  const jurisdiction = clean(command.intent.jurisdiction).toUpperCase();
  const generatedAt = new Date(command.generatedAt).toISOString();

  if (!workspaceId) throw new Error('workspaceId is required.');
  if (!command.workPackageId.startsWith('trademark-service-work-package_')) {
    throw new Error('workPackageId is invalid.');
  }
  if (!jurisdiction) throw new Error('intent.jurisdiction is required.');

  if (!command.intent.reviewedByUser) {
    return {
      workspaceId,
      workPackageId: command.workPackageId,
      capabilityCandidates: [],
      providerCandidates: [],
      servicePackageCandidates: [],
      discardedCapabilityCount: command.capabilitySnapshots.length,
      discardedProviderCount: command.providerSnapshots.length,
      discardedServicePackageCount: command.servicePackageSnapshots.length,
      generatedAt,
      capabilityVerifiedByLite: false,
      providerEngagedByLite: false,
      providerSelectedByLite: false,
      servicePackageSelectedByLite: false,
      protectedActionAuthorized: false
    };
  }

  const capabilityCandidates = command.capabilitySnapshots
    .filter(
      (snapshot) =>
        snapshot.sourceAuthority === 'CAPABILITY_ENGINE' &&
        snapshot.current &&
        Boolean(clean(snapshot.capabilityReference)) &&
        matchesIntent(snapshot.supportedIntentKinds, command.intent) &&
        matchesJurisdiction(snapshot.supportedJurisdictions, jurisdiction)
    )
    .map(
      (snapshot): TrademarkServiceCapabilityCandidate => ({
        capabilityReference: clean(snapshot.capabilityReference),
        ...(snapshot.capabilityVersion
          ? { capabilityVersion: clean(snapshot.capabilityVersion) }
          : {}),
        reason: `Capability Engine owner snapshot matches ${command.intent.kind} preparation in ${jurisdiction}.`,
        verifiedCapability: false
      })
    )
    .sort((left, right) => left.capabilityReference.localeCompare(right.capabilityReference));

  const matchedCapabilityReferences = new Set(
    capabilityCandidates.map((candidate) => candidate.capabilityReference)
  );

  const providerCandidates = command.providerSnapshots
    .filter((snapshot) => {
      if (
        snapshot.sourceAuthority !== 'MGSN' ||
        !snapshot.current ||
        !snapshot.operational ||
        !matchesJurisdiction(snapshot.supportedJurisdictions, jurisdiction)
      ) {
        return false;
      }
      return unique(snapshot.capabilityReferences).some((reference) =>
        matchedCapabilityReferences.has(reference)
      );
    })
    .map((snapshot): TrademarkServiceProviderCandidate => {
      const capabilityReference = unique(snapshot.capabilityReferences).find((reference) =>
        matchedCapabilityReferences.has(reference)
      );
      return {
        providerReference: clean(snapshot.providerReference),
        ...(capabilityReference ? { capabilityReference } : {}),
        reason: `MGSN owner snapshot is operational in ${jurisdiction} and references a matching Capability candidate.`,
        engaged: false,
        selectedForExecution: false
      };
    })
    .filter((candidate) => Boolean(candidate.providerReference))
    .sort((left, right) => left.providerReference.localeCompare(right.providerReference));

  const matchedProviderReferences = new Set(
    providerCandidates.map((candidate) => candidate.providerReference)
  );

  const servicePackageCandidates = command.servicePackageSnapshots
    .filter((snapshot) => {
      if (
        snapshot.sourceAuthority !== 'MGSN' ||
        !snapshot.current ||
        snapshot.status !== 'ADMITTED' ||
        snapshot.eligibilityOutcome === 'INELIGIBLE' ||
        clean(snapshot.jurisdiction).toUpperCase() !== jurisdiction ||
        !matchesIntent(snapshot.supportedIntentKinds, command.intent)
      ) {
        return false;
      }
      if (
        snapshot.capabilityReference &&
        !matchedCapabilityReferences.has(clean(snapshot.capabilityReference))
      ) {
        return false;
      }
      if (
        snapshot.providerReference &&
        !matchedProviderReferences.has(clean(snapshot.providerReference))
      ) {
        return false;
      }
      return Boolean(clean(snapshot.servicePackageReference) && clean(snapshot.description));
    })
    .map(
      (snapshot): TrademarkServicePackageCandidate => ({
        servicePackageReference: clean(snapshot.servicePackageReference),
        ...(snapshot.capabilityReference
          ? { capabilityReference: clean(snapshot.capabilityReference) }
          : {}),
        ...(snapshot.providerReference
          ? { providerReference: clean(snapshot.providerReference) }
          : {}),
        description: clean(snapshot.description),
        ...(snapshot.sourceVersion ? { sourceVersion: clean(snapshot.sourceVersion) } : {}),
        selected: false
      })
    )
    .sort((left, right) =>
      left.servicePackageReference.localeCompare(right.servicePackageReference)
    );

  return {
    workspaceId,
    workPackageId: command.workPackageId,
    capabilityCandidates,
    providerCandidates,
    servicePackageCandidates,
    discardedCapabilityCount: command.capabilitySnapshots.length - capabilityCandidates.length,
    discardedProviderCount: command.providerSnapshots.length - providerCandidates.length,
    discardedServicePackageCount:
      command.servicePackageSnapshots.length - servicePackageCandidates.length,
    generatedAt,
    capabilityVerifiedByLite: false,
    providerEngagedByLite: false,
    providerSelectedByLite: false,
    servicePackageSelectedByLite: false,
    protectedActionAuthorized: false
  };
}
