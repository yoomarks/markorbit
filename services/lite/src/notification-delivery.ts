import type {
  ChannelNotificationDeliveryAttemptId,
  ChannelNotificationDeliveryAttemptStatusV1,
  ChannelNotificationDeliveryAttemptV1,
  ChannelNotificationDeliveryObservationV1
} from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import type { LiteTransactionHost } from './content-preparation.js';

type Row = Record<string, unknown>;

export class NotificationDeliveryPersistenceError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'CONFLICT' | 'INTEGRITY_FAILURE' | 'PERSISTENCE_UNAVAILABLE',
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'NotificationDeliveryPersistenceError';
  }
}

const clone = <T>(value: T): T => structuredClone(value);
const forbidden = /(?:recipient|email|subject|body|credential|secret|password|token)/iu;

function privacyCheck(value: unknown, path = 'attempt'): void {
  if (Array.isArray(value))
    return value.forEach((item, index) => privacyCheck(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (forbidden.test(key))
      throw new NotificationDeliveryPersistenceError(
        'INTEGRITY_FAILURE',
        `${path}.${key} is forbidden durable Notification material.`
      );
    privacyCheck(nested, `${path}.${key}`);
  }
}

export class PostgresNotificationDeliveryStore {
  constructor(
    private readonly database: LiteTransactionHost,
    private readonly query: QueryClient
  ) {}

  async createAttempt(
    value: Readonly<ChannelNotificationDeliveryAttemptV1>
  ): Promise<ChannelNotificationDeliveryAttemptV1> {
    privacyCheck(value);
    try {
      return await this.database.transact(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `${value.workspaceId}:notification-delivery:${value.effectFingerprintSha256}`
        ]);
        const prior = await client.query<Row>(
          `SELECT attempt_json FROM lite_notification_delivery_attempts
            WHERE workspace_id=$1 AND (execution_release_id=$2 OR effect_fingerprint_sha256=$3)
            LIMIT 1`,
          [value.workspaceId, value.executionRelease.id, value.effectFingerprintSha256]
        );
        if (prior.rows[0]) {
          const existing = prior.rows[0].attempt_json as ChannelNotificationDeliveryAttemptV1;
          if (
            existing.executionRelease.id !== value.executionRelease.id ||
            existing.effectFingerprintSha256 !== value.effectFingerprintSha256
          )
            throw new NotificationDeliveryPersistenceError(
              'CONFLICT',
              'Execution release/effect is already bound to another Notification attempt.'
            );
          return clone(existing);
        }
        await client.query(
          `INSERT INTO lite_notification_delivery_attempts(
             workspace_id,notification_delivery_attempt_id,execution_release_id,
             effect_fingerprint_sha256,status,provider_submission_ref,attempt_json,created_at,updated_at
           ) VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)`,
          [
            value.workspaceId,
            value.notificationDeliveryAttemptId,
            value.executionRelease.id,
            value.effectFingerprintSha256,
            value.status,
            value.providerSubmissionRef ?? null,
            JSON.stringify(value),
            value.createdAt,
            value.updatedAt
          ]
        );
        return clone(value);
      });
    } catch (error) {
      if (error instanceof NotificationDeliveryPersistenceError) throw error;
      throw new NotificationDeliveryPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Notification delivery persistence is unavailable.',
        { cause: error instanceof Error ? error : undefined }
      );
    }
  }

  async getAttempt(
    workspaceId: string,
    attemptId: ChannelNotificationDeliveryAttemptId
  ): Promise<ChannelNotificationDeliveryAttemptV1> {
    try {
      const result = await this.query.query<Row>(
        `SELECT attempt_json FROM lite_notification_delivery_attempts
          WHERE workspace_id=$1 AND notification_delivery_attempt_id=$2`,
        [workspaceId, attemptId]
      );
      if (!result.rows[0])
        throw new NotificationDeliveryPersistenceError(
          'NOT_FOUND',
          'Notification attempt was not found.'
        );
      return clone(result.rows[0].attempt_json as ChannelNotificationDeliveryAttemptV1);
    } catch (error) {
      if (error instanceof NotificationDeliveryPersistenceError) throw error;
      throw new NotificationDeliveryPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Notification delivery persistence is unavailable.'
      );
    }
  }

  async transitionAttempt(
    value: Readonly<ChannelNotificationDeliveryAttemptV1>,
    expectedStatus: ChannelNotificationDeliveryAttemptStatusV1
  ): Promise<ChannelNotificationDeliveryAttemptV1> {
    privacyCheck(value);
    try {
      const result = await this.query.query(
        `UPDATE lite_notification_delivery_attempts
            SET status=$3,provider_submission_ref=$4,attempt_json=$5::jsonb,updated_at=$6
          WHERE workspace_id=$1 AND notification_delivery_attempt_id=$2 AND status=$7`,
        [
          value.workspaceId,
          value.notificationDeliveryAttemptId,
          value.status,
          value.providerSubmissionRef ?? null,
          JSON.stringify(value),
          value.updatedAt,
          expectedStatus
        ]
      );
      if (result.rowCount !== 1)
        throw new NotificationDeliveryPersistenceError(
          'CONFLICT',
          'Notification attempt state changed.'
        );
      return clone(value);
    } catch (error) {
      if (error instanceof NotificationDeliveryPersistenceError) throw error;
      throw new NotificationDeliveryPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Notification delivery persistence is unavailable.'
      );
    }
  }

  async recordObservation(
    value: Readonly<ChannelNotificationDeliveryObservationV1>
  ): Promise<ChannelNotificationDeliveryObservationV1> {
    privacyCheck(value, 'observation');
    try {
      const prior = await this.query.query<Row>(
        `SELECT observation_json FROM lite_notification_delivery_observations
          WHERE workspace_id=$1 AND event_identity=$2`,
        [value.workspaceId, value.eventIdentity]
      );
      if (prior.rows[0])
        return clone(prior.rows[0].observation_json as ChannelNotificationDeliveryObservationV1);
      await this.query.query(
        `INSERT INTO lite_notification_delivery_observations(
           workspace_id,notification_delivery_observation_id,notification_delivery_attempt_id,
           event_identity,event,observation_json,observed_at
         ) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)`,
        [
          value.workspaceId,
          value.notificationDeliveryObservationId,
          value.attempt.id,
          value.eventIdentity,
          value.event,
          JSON.stringify(value),
          value.observedAt
        ]
      );
      return clone(value);
    } catch (error) {
      if (error instanceof NotificationDeliveryPersistenceError) throw error;
      throw new NotificationDeliveryPersistenceError(
        'PERSISTENCE_UNAVAILABLE',
        'Notification delivery persistence is unavailable.'
      );
    }
  }

  async findByProviderSubmissionRef(workspaceId: string, providerSubmissionRef: string) {
    const result = await this.query.query<Row>(
      `SELECT attempt_json FROM lite_notification_delivery_attempts
        WHERE workspace_id=$1 AND provider_submission_ref=$2`,
      [workspaceId, providerSubmissionRef]
    );
    return result.rows[0]
      ? clone(result.rows[0].attempt_json as ChannelNotificationDeliveryAttemptV1)
      : undefined;
  }
}
