import { InMemoryOrderRepository } from '../src/order-persistence.js';
import './durable-preparation-lock-postgres.test.js';
import './production-intake-postgres.test.js';
import './production-intake-prettier-probe.test.js';
import { runOrderRepositoryContract } from './order-repository-contract.js';

runOrderRepositoryContract(
  'In-memory Order repository contract',
  () => new InMemoryOrderRepository()
);
