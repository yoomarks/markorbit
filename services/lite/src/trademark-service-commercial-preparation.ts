import { createHash } from 'node:crypto';
import type { Money } from '@markorbit/contracts';
import type {
  TrademarkServiceCommunicationDraft,
  TrademarkServiceMissingInput,
  TrademarkServicePreparationId,
  TrademarkServiceProviderCandidate,
  TrademarkServiceQuoteCandidate,
  TrademarkServiceWorkPackageId
} from '@markorbit/contracts/trademark-service-workbench';

export interface TrademarkServiceCommercialPricingSnapshot {
  sourceAuthority: 'COMMERCIAL_OWNER';
  sourceReference: string;
  sourceVersion: string;
  currency: string;
  lines: ReadonlyArray<{
    code: string;
    description: string;
    category: 'OFFICIAL_FEE' | 'SERVICE_FEE' | 'DISBURSEMENT' | 'TAX' | 'OTHER';
    amount: Readonly<Money>;
  }>;
  assumptions: readonly string[];
  limitations: readonly string[];
  current: boolean;
  reviewedForPreparation: boolean;
}

export interface TrademarkServiceDocumentPackagePreparationCandidate {
  preparationId: TrademarkServicePreparationId;
  sourceReferences: readonly string[];
  missingInputTitles: readonly string[];
  completeForPreparation: boolean;
  selected: false;
  externalSubmissionAuthorized: false;
}

export interface PrepareTrademarkServiceCommercialCommand {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  pricingSnapshot?: Readonly<TrademarkServiceCommercialPricingSnapshot>;
  missingInputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>;
  providerCandidates: ReadonlyArray<Readonly<TrademarkServiceProviderCandidate>>;
  documentSourceReferences: readonly string[];
  clientRecipientReference?: string;
  providerInstructionRequestedByUser: boolean;
  generatedAt: string;
}

export interface TrademarkServiceCommercialPreparationResult {
  workspaceId: string;
  workPackageId: TrademarkServiceWorkPackageId;
  quoteCandidate?: Readonly<TrademarkServiceQuoteCandidate>;
  communicationDrafts: ReadonlyArray<Readonly<TrademarkServiceCommunicationDraft>>;
  documentPackageCandidate: Readonly<TrademarkServiceDocumentPackagePreparationCandidate>;
  generatedAt: string;
  bindingQuoteCreated: false;
  paymentAuthorized: false;
  externalCommunicationSent: false;
  providerEngaged: false;
  filingOrPublicationAuthorized: false;
}

function clean(value: string): string {
  return value.trim();
}

function stablePreparationId(parts: readonly string[]): TrademarkServicePreparationId {
  const digest = createHash('sha256').update(parts.join('|')).digest('hex');
  return `trademark-service-preparation_${digest}`;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))].sort();
}

function prepareQuote(
  snapshot: Readonly<TrademarkServiceCommercialPricingSnapshot> | undefined
): TrademarkServiceQuoteCandidate | undefined {
  if (!snapshot || !snapshot.current || !snapshot.reviewedForPreparation) return undefined;
  const currency = clean(snapshot.currency).toUpperCase();
  const sourceReference = clean(snapshot.sourceReference);
  const sourceVersion = clean(snapshot.sourceVersion);
  if (!currency || !sourceReference || !sourceVersion || snapshot.lines.length === 0) return undefined;

  const lines = snapshot.lines.map((line) => {
    const lineCurrency = clean(line.amount.currency).toUpperCase();
    if (lineCurrency !== currency) throw new Error('Pricing line currency must match quote currency.');
    if (!Number.isSafeInteger(line.amount.amountMinor) || line.amount.amountMinor < 0) {
      throw new Error('Pricing line amountMinor must be a non-negative safe integer.');
    }
    return {
      code: clean(line.code),
      description: clean(line.description),
      category: line.category,
      amount: { amountMinor: line.amount.amountMinor, currency }
    };
  });
  if (lines.some((line) => !line.code || !line.description)) {
    throw new Error('Pricing line code and description are required.');
  }
  const totalMinor = lines.reduce((sum, line) => sum + line.amount.amountMinor, 0);
  if (!Number.isSafeInteger(totalMinor)) throw new Error('Quote total exceeds safe integer range.');

  return {
    currency,
    lines,
    total: { amountMinor: totalMinor, currency },
    assumptions: unique([
      ...snapshot.assumptions,
      `Pricing source: ${sourceReference}@${sourceVersion}`
    ]),
    limitations: unique(snapshot.limitations),
    bindingQuote: false,
    paymentAuthorized: false
  };
}

function clientDraft(input: {
  workPackageId: TrademarkServiceWorkPackageId;
  missingInputs: ReadonlyArray<Readonly<TrademarkServiceMissingInput>>;
  recipientReference?: string;
  generatedAt: string;
}): TrademarkServiceCommunicationDraft | undefined {
  const clientMissing = input.missingInputs.filter((item) =>
    [
      'CLIENT_INFORMATION_MISSING',
      'DOCUMENT_MISSING',
      'EVIDENCE_MISSING',
      'JURISDICTION_CONTEXT_MISSING'
    ].includes(item.reason)
  );
  if (clientMissing.length === 0) return undefined;
  const titles = unique(clientMissing.map((item) => item.title));
  return {
    preparationId: stablePreparationId([
      input.workPackageId,
      'CLIENT_INFORMATION_REQUEST',
      ...titles
    ]),
    kind: 'CLIENT_INFORMATION_REQUEST',
    subject: 'Information needed to continue trademark service preparation',
    body: `Please provide or confirm the following preparation items: ${titles.join('; ')}. This request concerns preparation completeness only and does not state a legal conclusion or certified deadline.`,
    ...(input.recipientReference
      ? { recipientReference: clean(input.recipientReference) }
      : {}),
    sent: false,
    externalContactAuthorized: false
  };
}

function providerDrafts(input: {
  workPackageId: TrademarkServiceWorkPackageId;
  providerCandidates: ReadonlyArray<Readonly<TrademarkServiceProviderCandidate>>;
  instructionRequested: boolean;
}): TrademarkServiceCommunicationDraft[] {
  const candidates = [...input.providerCandidates]
    .filter((candidate) => clean(candidate.providerReference))
    .sort((left, right) => left.providerReference.localeCompare(right.providerReference));
  const drafts: TrademarkServiceCommunicationDraft[] = [];
  for (const candidate of candidates) {
    const providerReference = clean(candidate.providerReference);
    drafts.push({
      preparationId: stablePreparationId([
        input.workPackageId,
        'PROVIDER_ENQUIRY',
        providerReference
      ]),
      kind: 'PROVIDER_ENQUIRY',
      subject: 'Trademark service preparation enquiry',
      body: `Please review whether your current service capability can support this preparation request. No engagement, filing instruction, payment authorization, or external authority is created by this draft.`,
      recipientReference: providerReference,
      sent: false,
      externalContactAuthorized: false
    });
    if (input.instructionRequested) {
      drafts.push({
        preparationId: stablePreparationId([
          input.workPackageId,
          'PROVIDER_INSTRUCTION',
          providerReference
        ]),
        kind: 'PROVIDER_INSTRUCTION',
        subject: 'Draft trademark service instruction for review',
        body: `Draft instruction for professional review only. Do not act, file, contact an authority, incur fees, or treat this as engagement until a protected owner-domain workflow separately authorizes execution.`,
        recipientReference: providerReference,
        sent: false,
        externalContactAuthorized: false
      });
    }
  }
  return drafts;
}

export function prepareTrademarkServiceCommercialArtifacts(
  command: Readonly<PrepareTrademarkServiceCommercialCommand>
): TrademarkServiceCommercialPreparationResult {
  const workspaceId = clean(command.workspaceId);
  const generatedAt = new Date(command.generatedAt).toISOString();
  if (!workspaceId) throw new Error('workspaceId is required.');
  if (!command.workPackageId.startsWith('trademark-service-work-package_')) {
    throw new Error('workPackageId is invalid.');
  }

  const quoteCandidate = prepareQuote(command.pricingSnapshot);
  const drafts = [
    clientDraft({
      workPackageId: command.workPackageId,
      missingInputs: command.missingInputs,
      ...(command.clientRecipientReference
        ? { recipientReference: command.clientRecipientReference }
        : {}),
      generatedAt
    }),
    ...providerDrafts({
      workPackageId: command.workPackageId,
      providerCandidates: command.providerCandidates,
      instructionRequested: command.providerInstructionRequestedByUser
    })
  ].filter((draft): draft is TrademarkServiceCommunicationDraft => Boolean(draft));

  const documentSourceReferences = unique(command.documentSourceReferences);
  const missingDocumentTitles = unique(
    command.missingInputs
      .filter((item) => item.reason === 'DOCUMENT_MISSING' || item.reason === 'EVIDENCE_MISSING')
      .map((item) => item.title)
  );
  const documentPackageCandidate: TrademarkServiceDocumentPackagePreparationCandidate = {
    preparationId: stablePreparationId([
      command.workPackageId,
      'DOCUMENT_PACKAGE',
      ...documentSourceReferences,
      ...missingDocumentTitles
    ]),
    sourceReferences: documentSourceReferences,
    missingInputTitles: missingDocumentTitles,
    completeForPreparation:
      documentSourceReferences.length > 0 && missingDocumentTitles.length === 0,
    selected: false,
    externalSubmissionAuthorized: false
  };

  return {
    workspaceId,
    workPackageId: command.workPackageId,
    ...(quoteCandidate ? { quoteCandidate } : {}),
    communicationDrafts: drafts,
    documentPackageCandidate,
    generatedAt,
    bindingQuoteCreated: false,
    paymentAuthorized: false,
    externalCommunicationSent: false,
    providerEngaged: false,
    filingOrPublicationAuthorized: false
  };
}
