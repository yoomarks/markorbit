import { describe } from 'vitest';
/* eslint-disable @typescript-eslint/require-await -- shared repository contracts are asynchronous. */
import { InMemorySessionRepository } from '../src/auth.js';
import { sessionRepositoryContract } from './session-repository-contract.js';
describe('Session repository contract', () => {
  const sessions = new InMemorySessionRepository();
  sessionRepositoryContract('memory', async () => ({
    sessions,
    user: async () => {},
    cleanup: async () => sessions.clear()
  }));
});
