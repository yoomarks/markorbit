import { randomUUID } from 'node:crypto';
import {
  noEmailDeliveryAuthorityConsequencesV1,
  type EmailDeliveryAttemptV1,
  type EmailDeliveryObservationV1
} from '@markorbit/contracts/email-delivery';
import type {
  AmazonSesMaterializedEmail,
  AmazonSesSubmissionResult
} from './email-delivery-ses.js';
import type { SetOutboundContactSuppressionCommand } from './outbound-contact-policy.js';
import type { PostgresEmailDeliveryStore } from './email-delivery.js';

export interface MaterializedEmailDelivery {
  workspaceId: string;
  attempt: Readonly<EmailDeliveryAttemptV1>;
  routingPartitionRef: string;
  fromAddress: string;
  replyToAddress?: string;
  recipients: readonly string[];
  subject: string;
  textContent?: string;
  htmlContent?: string;
}

export type EmailDeliverySubmissionResult =
  | Readonly<{ status: 'ACCEPTED'; providerSubmissionRef: string }>
  | Readonly<{ status: 'FAILED'; reasonCode: string }>
  | Readonly<{ status: 'UNKNOWN'; reasonCode: string }>;

export interface EmailDeliveryProviderAdapter {
  submit(materialized: Readonly<MaterializedEmailDelivery>): Promise<EmailDeliverySubmissionResult>;
}

export interface EmailDeliveryPreSubmitCurrentnessGate {
  assertCurrent(attempt: Readonly<EmailDeliveryAttemptV1>): Promise<void>;
}

export interface SubmitEmailDeliveryShardCommand {
  attempt: Readonly<EmailDeliveryAttemptV1>;
  materialized: Omit<Readonly<MaterializedEmailDelivery>, 'attempt'>;
}

export class EmailDeliveryRuntimeError extends Error {
  constructor(
    readonly code:
      | 'ATTEMPT_NOT_PLANNED'
      | 'ATTEMPT_ALREADY_AMBIGUOUS'
      | 'ATTEMPT_ALREADY_TERMINAL'
      | 'MATERIALIZED_ATTEMPT_MISMATCH',
    message: string
  ) {
    super(message);
    this.name = 'EmailDeliveryRuntimeError';
  }
}

export class EmailDeliveryRuntimeService {
  constructor(
    private readonly store: Pick<
      PostgresEmailDeliveryStore,
      'createAttempt' | 'getAttempt' | 'updateAttempt' | 'recordObservation'
    >,
    private readonly currentness: EmailDeliveryPreSubmitCurrentnessGate,
    private readonly adapter: EmailDeliveryProviderAdapter,
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  async submitShard(
    command: Readonly<SubmitEmailDeliveryShardCommand>
  ): Promise<EmailDeliveryAttemptV1> {
    const initial = await this.store.createAttempt({
      value: command.attempt,
      idempotencyKey: `email-delivery:create:${command.attempt.deliveryAttemptId}`
    });
    const current = await this.store.getAttempt(initial.workspaceId, initial.deliveryAttemptId);

    if (current.status === 'SUBMITTING' || current.status === 'UNKNOWN')
      throw new EmailDeliveryRuntimeError(
        'ATTEMPT_ALREADY_AMBIGUOUS',
        'Ambiguous delivery attempt cannot be blindly submitted again.'
      );
    if (['ACCEPTED', 'FAILED', 'RECONCILING', 'RECONCILED'].includes(current.status))
      throw new EmailDeliveryRuntimeError(
        'ATTEMPT_ALREADY_TERMINAL',
        'Delivery attempt is already beyond PLANNED state.'
      );
    if (current.status !== 'PLANNED')
      throw new EmailDeliveryRuntimeError(
        'ATTEMPT_NOT_PLANNED',
        'Delivery attempt is not PLANNED.'
      );

    await this.currentness.assertCurrent(current);

    const submitting: EmailDeliveryAttemptV1 = {
      ...current,
      status: 'SUBMITTING',
      updatedAt: this.timestamp()
    };
    await this.store.updateAttempt({
      value: submitting,
      expectedStatus: 'PLANNED',
      idempotencyKey: `email-delivery:submitting:${current.deliveryAttemptId}`
    });

    const result = await this.adapter.submit({
      ...command.materialized,
      attempt: submitting
    });

    const final = this.finalAttempt(submitting, result);
    await this.store.updateAttempt({
      value: final,
      expectedStatus: 'SUBMITTING',
      idempotencyKey: `email-delivery:transport-result:${current.deliveryAttemptId}`
    });
    await this.store.recordObservation({
      value: this.transportObservation(final, result),
      idempotencyKey: `email-delivery:transport-observation:${current.deliveryAttemptId}`
    });
    return final;
  }

  async markInterruptedSubmittingUnknown(
    workspaceId: string,
    deliveryAttemptId: EmailDeliveryAttemptV1['deliveryAttemptId']
  ): Promise<EmailDeliveryAttemptV1> {
    const current = await this.store.getAttempt(workspaceId, deliveryAttemptId);
    if (current.status !== 'SUBMITTING')
      throw new EmailDeliveryRuntimeError(
        'ATTEMPT_NOT_PLANNED',
        'Only an interrupted SUBMITTING attempt may be marked UNKNOWN.'
      );
    const unknown: EmailDeliveryAttemptV1 = {
      ...current,
      status: 'UNKNOWN',
      updatedAt: this.timestamp()
    };
    await this.store.updateAttempt({
      value: unknown,
      expectedStatus: 'SUBMITTING',
      idempotencyKey: `email-delivery:interrupted-unknown:${current.deliveryAttemptId}`
    });
    await this.store.recordObservation({
      value: {
        schemaVersion: 1,
        observationId: `email-delivery-observation_${randomUUID()}`,
        version: 1,
        workspaceId: current.workspaceId,
        deliveryAttempt: {
          deliveryAttemptId: current.deliveryAttemptId,
          version: 1
        },
        eventIdentity: `runtime-interrupted:${current.deliveryAttemptId}`,
        event: 'UNKNOWN',
        evidenceKind: 'ADAPTER_TRANSPORT',
        authenticatedEvidence: true,
        reasonCode: 'TRANSPORT_OUTCOME_UNKNOWN_AFTER_INTERRUPTION',
        evidenceRefs: [`delivery-attempt:${current.deliveryAttemptId}`],
        eventAt: this.timestamp(),
        observedAt: this.timestamp(),
        authority: noEmailDeliveryAuthorityConsequencesV1
      },
      idempotencyKey: `email-delivery:interrupted-observation:${current.deliveryAttemptId}`
    });
    return unknown;
  }

  private finalAttempt(
    current: Readonly<EmailDeliveryAttemptV1>,
    result: Readonly<EmailDeliverySubmissionResult>
  ): EmailDeliveryAttemptV1 {
    if (result.status === 'ACCEPTED')
      return {
        ...current,
        status: 'ACCEPTED',
        providerSubmissionRef: result.providerSubmissionRef,
        updatedAt: this.timestamp()
      };
    return {
      ...current,
      status: result.status === 'UNKNOWN' ? 'UNKNOWN' : 'FAILED',
      updatedAt: this.timestamp()
    };
  }

  private transportObservation(
    attempt: Readonly<EmailDeliveryAttemptV1>,
    result: Readonly<EmailDeliverySubmissionResult>
  ): EmailDeliveryObservationV1 {
    const event =
      result.status === 'ACCEPTED'
        ? 'ACCEPTED'
        : result.status === 'UNKNOWN'
          ? 'UNKNOWN'
          : 'FAILED';
    const providerMessageRef =
      result.status === 'ACCEPTED' ? result.providerSubmissionRef : undefined;
    const reasonCode = result.status === 'ACCEPTED' ? 'SES_ACCEPTED' : result.reasonCode;
    const now = this.timestamp();
    return {
      schemaVersion: 1,
      observationId: `email-delivery-observation_${randomUUID()}`,
      version: 1,
      workspaceId: attempt.workspaceId,
      deliveryAttempt: {
        deliveryAttemptId: attempt.deliveryAttemptId,
        version: 1
      },
      eventIdentity: `transport:${attempt.deliveryAttemptId}:${event}`,
      event,
      evidenceKind: 'ADAPTER_TRANSPORT',
      ...(providerMessageRef ? { providerMessageRef } : {}),
      authenticatedEvidence: true,
      reasonCode,
      evidenceRefs: providerMessageRef
        ? [`ses-message:${providerMessageRef}`]
        : [`delivery-attempt:${attempt.deliveryAttemptId}`],
      eventAt: now,
      observedAt: now,
      authority: noEmailDeliveryAuthorityConsequencesV1
    };
  }

  private timestamp(): string {
    return new Date(this.now()).toISOString();
  }
}

export interface EmailDeliverySuppressionOwner {
  setSuppression(command: Readonly<SetOutboundContactSuppressionCommand>): Promise<unknown>;
}

export class EmailDeliveryProviderEventService {
  constructor(
    private readonly store: Pick<PostgresEmailDeliveryStore, 'recordObservation'>,
    private readonly suppression: EmailDeliverySuppressionOwner,
    private readonly actorPrincipalId = 'system:email-delivery-provider-evidence'
  ) {}

  async admit(
    observation: Readonly<EmailDeliveryObservationV1>
  ): Promise<EmailDeliveryObservationV1> {
    const recorded = await this.store.recordObservation({
      value: observation,
      idempotencyKey: `email-delivery:event:${observation.eventIdentity}`
    });
    if (
      !recorded.endpointFingerprintSha256 ||
      !['HARD_BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED'].includes(recorded.event)
    )
      return recorded;

    const reasonCode =
      recorded.event === 'HARD_BOUNCED'
        ? 'HARD_BOUNCE'
        : recorded.event === 'COMPLAINED'
          ? 'COMPLAINT'
          : 'RECIPIENT_OPT_OUT';
    await this.suppression.setSuppression({
      workspaceId: recorded.workspaceId,
      actorPrincipalId: this.actorPrincipalId,
      idempotencyKey: `email-delivery:suppression:${recorded.eventIdentity}`,
      endpointFingerprintSha256: recorded.endpointFingerprintSha256,
      scope: 'ALL_OUTBOUND',
      reasonCode,
      sourceClass: 'PROVIDER_OBSERVATION',
      evidenceRefs: [
        `email-delivery-observation:${recorded.observationId}`,
        ...recorded.evidenceRefs
      ],
      effectiveAt: recorded.eventAt
    });
    return recorded;
  }
}
