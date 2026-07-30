import { expect } from 'vitest';
export interface Probe {
  id: string;
  scopeId: string;
  value: string;
  version: number;
}
export interface ProbeRepository {
  create(value: Probe): Promise<void>;
  find(scopeId: string, id: string): Promise<Probe | undefined>;
  update(scopeId: string, id: string, expectedVersion: number, value: string): Promise<void>;
}
export function repositoryContract(
  factory: () => Promise<{
    repository: ProbeRepository;
    rollback(work: (repository: ProbeRepository) => Promise<void>): Promise<void>;
    close(): Promise<void>;
  }>
) {
  return async () => {
    const harness = await factory();
    const repository = harness.repository;
    try {
      expect(await repository.find('scope-a', 'missing')).toBeUndefined();
      await repository.create({ id: 'one', scopeId: 'scope-a', value: 'initial', version: 1 });
      expect(await repository.find('scope-a', 'one')).toEqual({
        id: 'one',
        scopeId: 'scope-a',
        value: 'initial',
        version: 1
      });
      expect(await repository.find('scope-b', 'one')).toBeUndefined();
      await expect(
        repository.create({ id: 'one', scopeId: 'scope-a', value: 'duplicate', version: 1 })
      ).rejects.toThrow();
      await repository.update('scope-a', 'one', 1, 'updated');
      expect((await repository.find('scope-a', 'one'))?.version).toBe(2);
      await expect(repository.update('scope-a', 'one', 1, 'stale')).rejects.toThrow();
      expect((await repository.find('scope-a', 'one'))?.value).toBe('updated');
      await harness.rollback(async (transactional) =>
        transactional.create({ id: 'rolled-back', scopeId: 'scope-a', value: 'x', version: 1 })
      );
      expect(await repository.find('scope-a', 'rolled-back')).toBeUndefined();
    } finally {
      await harness.close();
    }
  };
}
