import type { PreparationRepository } from './preparation.js';
import { PreparationError } from './preparation.js';

export const DURABLE_PREPARATION_UNAVAILABLE = 'DURABLE_PREPARATION_NOT_AVAILABLE';

const message =
  'Durable Preparation Lock persistence is required. Legacy in-memory Preparation is disabled in the durable MarkReg runtime.';

/**
 * Production guard for the historical process-local Preparation substrate.
 *
 * The durable MarkReg runtime already persists Document Packages in PostgreSQL, but a durable
 * Preparation Lock store is not yet admitted. Injecting this repository prevents the legacy
 * in-memory repository from silently becoming production truth after a restart.
 */
export class FailClosedPreparationRepository implements PreparationRepository {
  private unavailable(): Promise<never> {
    return Promise.reject(
      new PreparationError(DURABLE_PREPARATION_UNAVAILABLE, message, 503, {
        durableDocumentPackage: true,
        durablePreparationLock: false,
        fixtureFallbackAllowed: false
      })
    );
  }

  createPackage(): Promise<never> {
    return this.unavailable();
  }

  findPackage(): Promise<never> {
    return this.unavailable();
  }

  findActiveBySource(): Promise<never> {
    return this.unavailable();
  }

  findByIdempotencyKey(): Promise<never> {
    return this.unavailable();
  }

  listForCustomer(): Promise<never> {
    return this.unavailable();
  }

  savePackage(): Promise<never> {
    return this.unavailable();
  }

  createLedger(): Promise<never> {
    return this.unavailable();
  }

  findLedger(): Promise<never> {
    return this.unavailable();
  }

  saveLedger(): Promise<never> {
    return this.unavailable();
  }

  createLock(): Promise<never> {
    return this.unavailable();
  }

  findLock(): Promise<never> {
    return this.unavailable();
  }
}
