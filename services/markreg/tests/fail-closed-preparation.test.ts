import { describe, expect, it } from 'vitest';
import {
  DURABLE_PREPARATION_UNAVAILABLE,
  FailClosedPreparationRepository
} from '../src/fail-closed-preparation.js';
import { InMemoryPreparationRepository } from '../src/preparation.js';

const expected = {
  code: DURABLE_PREPARATION_UNAVAILABLE,
  status: 503,
  details: {
    durableDocumentPackage: true,
    durablePreparationLock: false,
    fixtureFallbackAllowed: false
  }
};

describe('durable Preparation boundary', () => {
  it('fails closed instead of reading process-local package, ledger or lock truth', async () => {
    const repository = new FailClosedPreparationRepository();

    await expect(repository.findPackage()).rejects.toMatchObject(expected);
    await expect(repository.findLedger()).rejects.toMatchObject(expected);
    await expect(repository.findLock()).rejects.toMatchObject(expected);
  });

  it('fails closed instead of creating process-local preparation truth', async () => {
    const repository = new FailClosedPreparationRepository();

    await expect(repository.createPackage()).rejects.toMatchObject(expected);
    await expect(repository.createLedger()).rejects.toMatchObject(expected);
    await expect(repository.createLock()).rejects.toMatchObject(expected);
  });

  it('does not remove the explicit fixture repository used by fixture runtimes', async () => {
    const repository = new InMemoryPreparationRepository();
    const fixtureLock = {
      preparationLockId: 'preparation-lock_fixture-boundary'
    } as never;

    await repository.createLock(fixtureLock);

    await expect(repository.findLock('preparation-lock_fixture-boundary')).resolves.toMatchObject({
      preparationLockId: 'preparation-lock_fixture-boundary'
    });
  });
});
