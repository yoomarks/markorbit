import { describe, it } from 'vitest';
import { repositoryContract, type Probe, type ProbeRepository } from './repository-contract.js';
class MemoryRepository implements ProbeRepository {
  constructor(private readonly values = new Map<string, Probe>()) {}
  create(value: Probe): Promise<void> {
    const key = `${value.scopeId}:${value.id}`;
    if (this.values.has(key)) return Promise.reject(new Error('duplicate'));
    this.values.set(key, { ...value });
    return Promise.resolve();
  }
  find(scopeId: string, id: string): Promise<Probe | undefined> {
    const value = this.values.get(`${scopeId}:${id}`);
    return Promise.resolve(value && { ...value });
  }
  update(scopeId: string, id: string, expectedVersion: number, value: string): Promise<void> {
    const key = `${scopeId}:${id}`,
      current = this.values.get(key);
    if (!current || current.version !== expectedVersion)
      return Promise.reject(new Error('version conflict'));
    this.values.set(key, { ...current, value, version: current.version + 1 });
    return Promise.resolve();
  }
}
describe('in-memory probe repository contract', () => {
  it(
    'runs the shared behavioral contract',
    repositoryContract(() => {
      const values = new Map<string, Probe>();
      const repository = new MemoryRepository(values);
      return Promise.resolve({
        repository,
        rollback: async (work) => {
          const isolated = new MemoryRepository();
          await work(isolated);
        },
        commit: (work) => work(new MemoryRepository(values)),
        reopen: () => Promise.resolve(new MemoryRepository(values)),
        cleanup: () => {
          values.clear();
          return Promise.resolve();
        },
        close: () => Promise.resolve()
      });
    })
  );
});
