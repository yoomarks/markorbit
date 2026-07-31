import { InMemoryMatterDraftRepository } from '../src/matter-draft.js';
import { runMatterDraftRepositoryContract } from './matter-draft-repository-contract.js';

runMatterDraftRepositoryContract('in-memory', () =>
  Promise.resolve(new InMemoryMatterDraftRepository())
);
