import type { MarkOrbitId, WorkspacePrincipal } from '@markorbit/contracts';
import type { CommercialSourceSnapshot, CreateOrderCommand } from '@markorbit/contracts/order';
import type { CustomerConfirmationRepository } from './customer-confirmation.js';
import { hashCommercialSourceSnapshot } from './order-persistence.js';
import type { OrderCommercialSourceProvider } from './order-service.js';
import type { PostgresProductionFeeFactsService } from './production-fee-facts.js';
import type { PostgresProductionIntakeService } from './production-intake.js';
import type { PostgresProductionQuoteServiceV1 } from './production-quote.js';
import type { PostgresProductionUserSelectionService } from './production-user-selection.js';

export class ProductionOrderCommercialSourceProvider implements OrderCommercialSourceProvider {
  constructor(
    private readonly confirmations: CustomerConfirmationRepository,
    private readonly quotes: Pick<PostgresProductionQuoteServiceV1, 'get'>,
    private readonly intakes: Pick<PostgresProductionIntakeService, 'get'>,
    private readonly selections: Pick<PostgresProductionUserSelectionService, 'get'>,
    private readonly feeFacts: Pick<PostgresProductionFeeFactsService, 'getCurrent'>
  ) {}

  async resolve(
    principal: WorkspacePrincipal,
    command: CreateOrderCommand
  ): Promise<CommercialSourceSnapshot | null> {
    const confirmation = await this.confirmations.findById(
      command.workspaceId,
      command.customerConfirmationId
    );
    if (
      !confirmation ||
      confirmation.status !== 'CONFIRMED' ||
      confirmation.version !== command.expectedCustomerConfirmationVersion ||
      confirmation.sourceQuoteId !== command.quoteId ||
      confirmation.sourceQuoteVersion !== command.expectedQuoteVersion
    ) {
      return null;
    }
    const quote = await this.quotes.get(principal, command.quoteId);
    if (quote.version !== Number(command.expectedQuoteVersion)) return null;
    const [intake, selection] = await Promise.all([
      this.intakes.get(principal, quote.intake.id),
      this.selections.get(principal, quote.selection.id)
    ]);
    const facts = await this.feeFacts.getCurrent(principal, intake.intakeId, intake.version);
    if (
      quote.intake.version !== intake.version ||
      quote.intake.fingerprintSha256 !== intake.fingerprintSha256 ||
      quote.selection.version !== selection.version ||
      quote.selection.fingerprintSha256 !== selection.fingerprintSha256 ||
      intake.channel !== command.channel ||
      intake.relationshipModel !== command.relationshipModel
    ) {
      return null;
    }
    return {
      schemaVersion: 1,
      quote: {
        quoteId: quote.quoteId,
        quoteVersion: String(quote.version),
        currency: quote.currency,
        totalMinor: quote.total.amountMinor
      },
      customerConfirmation: {
        confirmationId:
          confirmation.confirmationId as CommercialSourceSnapshot['customerConfirmation']['confirmationId'],
        confirmationVersion: confirmation.version,
        status: 'CONFIRMED'
      },
      customerId: `user_${principal.userId}` as MarkOrbitId,
      channel: intake.channel,
      relationshipModel: intake.relationshipModel,
      commercialScope: {
        applicantReference: `${intake.intakeId}#applicant`,
        trademarkReference: `${intake.intakeId}#trademark`,
        jurisdictionReference: intake.input.targetJurisdictions.join(','),
        classNumbers: facts.niceClasses,
        goodsServices: [intake.input.goodsServices.sourceText],
        selectedPlanId: selection.selectionId,
        selectedPlanVersion: String(selection.version)
      },
      relationshipReferences: {
        contractingParty: { referenceId: `workspace:${principal.workspaceId}` },
        customerFacingBrand: intake.siteSource
          ? {
              referenceId: `site:${intake.siteSource.siteId}@${intake.siteSource.configurationVersion}`
            }
          : { referenceId: 'markreg:direct' },
        deliveryOwner: { referenceId: 'markreg:service-owner' },
        communicationOwner: { referenceId: `workspace:${principal.workspaceId}` }
      },
      sourceCorrelationId:
        `correlation_${confirmation.sourceSnapshotHash.slice(0, 24)}` as MarkOrbitId,
      sourceSha256: confirmation.sourceSnapshotHash,
      capturedAt: confirmation.acceptedAt
    };
  }

  async isCurrent(
    principal: WorkspacePrincipal,
    workspaceId: string,
    source: Readonly<CommercialSourceSnapshot>
  ): Promise<boolean> {
    const current = await this.resolve(principal, {
      workspaceId,
      orderType: 'TrademarkFiling',
      quoteId: source.quote.quoteId,
      expectedQuoteVersion: source.quote.quoteVersion,
      customerConfirmationId: source.customerConfirmation.confirmationId,
      expectedCustomerConfirmationVersion: source.customerConfirmation.confirmationVersion,
      channel: source.channel,
      relationshipModel: source.relationshipModel,
      idempotencyKey: 'currentness-read'
    });
    return (
      !!current && hashCommercialSourceSnapshot(current) === hashCommercialSourceSnapshot(source)
    );
  }
}
