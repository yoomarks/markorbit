import { createHash } from 'node:crypto';
import {
  encodeInternalWorkspacePrincipal,
  type DurableDocumentPackageView,
  type FormalMatter,
  type PreparationLockId,
  type ProfessionalReviewCase,
  type WorkspacePrincipal
} from '@markorbit/contracts';
import {
  FilingGovernanceError,
  type DurablePreparationSourceView,
  type PreparationLockSource
} from './filing-authorization.js';

type Row = Record<string, unknown>;

type DurablePreparationLockWire = {
  schemaVersion: 1;
  preparationLockId: PreparationLockId;
  workspaceId: string;
  version: number;
  source: {
    documentPackageId: `document-package_${string}`;
    documentPackageVersion: number;
    canonicalEvidenceHash: string;
    formalMatterId: `formal-matter_${string}`;
    formalMatterVersion: number;
    formalMatterHash: string;
    professionalReviewCaseId: `professional-review_${string}`;
    reviewVersion: number;
    completedDecisionId: string;
    completedDecisionHash: string;
    instructionEntryCount: number;
    instructionEntries: readonly {
      instructionEntryId: string;
      sequence: number;
      canonicalFingerprint: string;
    }[];
    instructionSetHash: string;
  };
  lockPayloadHash: string;
};

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Row)
      .filter(([, member]) => member !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
};

const sha256 = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex');
const validHash = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const row = (value: unknown, name: string): Row => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      `${name} returned malformed durable owner data.`,
      502
    );
  return value as Row;
};
const text = (value: unknown, name: string) => {
  if (typeof value !== 'string' || !value.trim())
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      `${name} is missing from durable owner data.`,
      502
    );
  return value;
};
const integer = (value: unknown, name: string) => {
  if (!Number.isSafeInteger(value) || Number(value) < 1)
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      `${name} must be a positive integer.`,
      502
    );
  return Number(value);
};
const exactHash = (value: unknown, name: string) => {
  if (!validHash(value))
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      `${name} must be a SHA-256 fingerprint.`,
      502
    );
  return value;
};

function parseLock(value: unknown): DurablePreparationLockWire {
  const candidate = row(value, 'Preparation Lock');
  const source = row(candidate.source, 'Preparation Lock source');
  const instructionEntries = Array.isArray(source.instructionEntries)
    ? source.instructionEntries.map((entry, index) => {
        const item = row(entry, `Preparation Lock instruction ${index + 1}`);
        return {
          instructionEntryId: text(item.instructionEntryId, 'instructionEntryId'),
          sequence: integer(item.sequence, 'instruction sequence'),
          canonicalFingerprint: exactHash(
            item.canonicalFingerprint,
            'instruction canonical fingerprint'
          )
        };
      })
    : (() => {
        throw new FilingGovernanceError(
          'SOURCE_CONTRACT_MISMATCH',
          'Preparation Lock instruction provenance is missing.',
          502
        );
      })();
  if (candidate.schemaVersion !== 1)
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      'Preparation Lock schemaVersion is unsupported.',
      502
    );
  const lock: DurablePreparationLockWire = {
    schemaVersion: 1,
    preparationLockId: text(candidate.preparationLockId, 'preparationLockId') as PreparationLockId,
    workspaceId: text(candidate.workspaceId, 'workspaceId'),
    version: integer(candidate.version, 'Preparation Lock version'),
    source: {
      documentPackageId: text(
        source.documentPackageId,
        'documentPackageId'
      ) as `document-package_${string}`,
      documentPackageVersion: integer(source.documentPackageVersion, 'documentPackageVersion'),
      canonicalEvidenceHash: exactHash(source.canonicalEvidenceHash, 'canonicalEvidenceHash'),
      formalMatterId: text(source.formalMatterId, 'formalMatterId') as `formal-matter_${string}`,
      formalMatterVersion: integer(source.formalMatterVersion, 'formalMatterVersion'),
      formalMatterHash: exactHash(source.formalMatterHash, 'formalMatterHash'),
      professionalReviewCaseId: text(
        source.professionalReviewCaseId,
        'professionalReviewCaseId'
      ) as `professional-review_${string}`,
      reviewVersion: integer(source.reviewVersion, 'reviewVersion'),
      completedDecisionId: text(source.completedDecisionId, 'completedDecisionId'),
      completedDecisionHash: exactHash(source.completedDecisionHash, 'completedDecisionHash'),
      instructionEntryCount: integer(source.instructionEntryCount, 'instructionEntryCount'),
      instructionEntries,
      instructionSetHash: exactHash(source.instructionSetHash, 'instructionSetHash')
    },
    lockPayloadHash: exactHash(candidate.lockPayloadHash, 'lockPayloadHash')
  };
  if (
    !lock.preparationLockId.startsWith('preparation-lock_') ||
    !lock.source.documentPackageId.startsWith('document-package_') ||
    !lock.source.formalMatterId.startsWith('formal-matter_') ||
    !lock.source.professionalReviewCaseId.startsWith('professional-review_') ||
    lock.source.instructionEntries.length !== lock.source.instructionEntryCount ||
    sha256(lock.source.instructionEntries) !== lock.source.instructionSetHash ||
    sha256({ schemaVersion: 1, source: lock.source }) !== lock.lockPayloadHash
  )
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      'Preparation Lock durable identity or fingerprint provenance is malformed.',
      502
    );
  return lock;
}

function validatePackage(value: unknown): DurableDocumentPackageView {
  const candidate = row(value, 'Document Package');
  text(candidate.documentPackageId, 'documentPackageId');
  text(candidate.workspaceId, 'workspaceId');
  text(candidate.formalMatterId, 'formalMatterId');
  integer(candidate.sourceFormalMatterVersion, 'sourceFormalMatterVersion');
  exactHash(candidate.sourceFormalMatterHash, 'sourceFormalMatterHash');
  text(candidate.professionalReviewCaseId, 'professionalReviewCaseId');
  integer(candidate.sourceReviewVersion, 'sourceReviewVersion');
  text(candidate.sourceCompletedDecisionId, 'sourceCompletedDecisionId');
  exactHash(candidate.sourceCompletedDecisionHash, 'sourceCompletedDecisionHash');
  integer(candidate.version, 'Document Package version');
  if (candidate.status !== 'READY_FOR_PREPARATION_LOCK')
    throw new FilingGovernanceError(
      'PREPARATION_LOCK_NOT_CURRENT',
      'Pinned Document Package is not READY_FOR_PREPARATION_LOCK.',
      409
    );
  exactHash(candidate.canonicalEvidenceHash, 'canonicalEvidenceHash');
  if (!Array.isArray(candidate.documentItems) || !Array.isArray(candidate.instructionEntries))
    throw new FilingGovernanceError(
      'SOURCE_CONTRACT_MISMATCH',
      'Document Package evidence or instruction entries are malformed.',
      502
    );
  return structuredClone(candidate) as unknown as DurableDocumentPackageView;
}

function validateFormalMatter(value: unknown): FormalMatter {
  const envelope = row(value, 'Formal Matter response');
  const candidate =
    'formalMatter' in envelope ? row(envelope.formalMatter, 'Formal Matter') : envelope;
  text(candidate.formalMatterId, 'formalMatterId');
  text(candidate.workspaceId, 'workspaceId');
  integer(candidate.version, 'Formal Matter version');
  exactHash(candidate.snapshotSha256, 'Formal Matter snapshotSha256');
  const snapshot = row(candidate.sourceSnapshot, 'Formal Matter sourceSnapshot');
  const preparation = row(snapshot.preparation, 'Formal Matter preparation');
  text(preparation.applicantName, 'preparation.applicantName');
  text(preparation.trademark, 'preparation.trademark');
  text(preparation.targetJurisdiction, 'preparation.targetJurisdiction');
  if (!Array.isArray(preparation.classes) || preparation.classes.length === 0)
    throw new FilingGovernanceError(
      'PREPARATION_SCOPE_INCOMPLETE',
      'Formal Matter preparation has no classes.',
      422
    );
  text(preparation.goodsServices, 'preparation.goodsServices');
  text(preparation.filingBasis, 'preparation.filingBasis');
  if (typeof preparation.representativeRequired !== 'boolean')
    throw new FilingGovernanceError(
      'PREPARATION_SCOPE_INCOMPLETE',
      'Formal Matter representative requirement was not evaluated.',
      422
    );
  return structuredClone(candidate) as unknown as FormalMatter;
}

function mismatch(message: string): never {
  throw new FilingGovernanceError('PREPARATION_LOCK_NOT_CURRENT', message, 409);
}

export function createHttpDurablePreparationSource(options: {
  baseUrl: string;
  principal: WorkspacePrincipal;
  secret: string;
  reviewSource: (
    id: `professional-review_${string}`
  ) => Promise<ProfessionalReviewCase | undefined>;
}): PreparationLockSource {
  const headers = {
    'x-markorbit-internal-authorization': options.secret,
    'x-markorbit-principal': encodeInternalWorkspacePrincipal(options.principal),
    'x-markorbit-workspace-id': options.principal.workspaceId
  };
  const getJson = async (path: string, allowNotFound = false): Promise<unknown> => {
    let response: Response;
    try {
      response = await fetch(`${options.baseUrl}${path}`, { headers });
    } catch {
      throw new FilingGovernanceError(
        'SOURCE_UNAVAILABLE',
        'Durable Preparation source is unavailable.',
        503
      );
    }
    if (allowNotFound && response.status === 404) return undefined;
    if (!response.ok)
      throw new FilingGovernanceError(
        response.status === 404 ? 'PREPARATION_LOCK_NOT_CURRENT' : 'SOURCE_UNAVAILABLE',
        response.status === 404
          ? 'Pinned durable Preparation source was not found.'
          : 'Durable Preparation source is unavailable.',
        response.status === 404 ? 409 : 503
      );
    return response.json();
  };
  return {
    async getPreparationLock(id) {
      const rawLock = await getJson(`/v1/preparation-locks/${encodeURIComponent(id)}`, true);
      if (rawLock === undefined) return undefined;
      const lock = parseLock(rawLock);
      if (lock.preparationLockId !== id || lock.workspaceId !== options.principal.workspaceId)
        mismatch('Preparation Lock identity or Workspace no longer matches.');

      const pkg = validatePackage(
        await getJson(`/v1/document-packages/${encodeURIComponent(lock.source.documentPackageId)}`)
      );
      if (
        pkg.workspaceId !== options.principal.workspaceId ||
        pkg.documentPackageId !== lock.source.documentPackageId ||
        pkg.version !== lock.source.documentPackageVersion ||
        pkg.canonicalEvidenceHash !== lock.source.canonicalEvidenceHash ||
        pkg.formalMatterId !== lock.source.formalMatterId ||
        pkg.sourceFormalMatterVersion !== lock.source.formalMatterVersion ||
        pkg.sourceFormalMatterHash !== lock.source.formalMatterHash ||
        pkg.professionalReviewCaseId !== lock.source.professionalReviewCaseId ||
        pkg.sourceReviewVersion !== lock.source.reviewVersion ||
        pkg.sourceCompletedDecisionId !== lock.source.completedDecisionId ||
        pkg.sourceCompletedDecisionHash !== lock.source.completedDecisionHash
      )
        mismatch('Preparation Lock and exact Document Package lineage no longer match.');

      const packageInstructions = pkg.instructionEntries.map((entry) =>
        row(entry, 'instruction entry')
      );
      const currentInstructions = new Map(
        packageInstructions.map((entry) => [
          text(entry.instructionEntryId, 'instructionEntryId'),
          {
            sequence: integer(entry.sequence, 'instruction sequence'),
            canonicalFingerprint: exactHash(
              entry.canonicalFingerprint,
              'instruction canonical fingerprint'
            )
          }
        ])
      );
      for (const pinned of lock.source.instructionEntries) {
        const current = currentInstructions.get(pinned.instructionEntryId);
        if (
          !current ||
          current.sequence !== pinned.sequence ||
          current.canonicalFingerprint !== pinned.canonicalFingerprint
        )
          mismatch('Preparation Lock instruction lineage no longer matches the Document Package.');
      }

      const formalMatter = validateFormalMatter(
        await getJson(`/v1/formal-matters/${encodeURIComponent(lock.source.formalMatterId)}`)
      );
      if (
        formalMatter.workspaceId !== options.principal.workspaceId ||
        formalMatter.formalMatterId !== lock.source.formalMatterId ||
        formalMatter.version !== lock.source.formalMatterVersion ||
        formalMatter.snapshotSha256 !== lock.source.formalMatterHash
      )
        mismatch('Preparation Lock and exact Formal Matter lineage no longer match.');

      const review = await options.reviewSource(lock.source.professionalReviewCaseId);
      if (
        !review ||
        review.workspaceId !== options.principal.workspaceId ||
        review.reviewCaseId !== lock.source.professionalReviewCaseId ||
        review.version !== lock.source.reviewVersion ||
        review.formalMatterId !== lock.source.formalMatterId ||
        review.sourceFormalMatterVersion !== lock.source.formalMatterVersion ||
        review.sourceSnapshotSha256 !== lock.source.formalMatterHash ||
        review.status !== 'REVIEWED_READY_FOR_NEXT_STEP' ||
        !review.completedAt ||
        !review.decision ||
        review.decision.decidedAt !== lock.source.completedDecisionId ||
        sha256(review.decision) !== lock.source.completedDecisionHash
      )
        mismatch('Preparation Lock and exact Professional Review lineage no longer match.');

      return {
        sourceKind: 'DURABLE',
        preparationLockId: lock.preparationLockId,
        version: lock.version,
        lockPayloadHash: lock.lockPayloadHash,
        source: structuredClone(lock.source),
        documentPackage: pkg,
        formalMatter,
        professionalReview: structuredClone(review),
        customerId: review.source.customerId
      } satisfies DurablePreparationSourceView;
    }
  };
}
