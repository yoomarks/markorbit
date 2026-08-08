import { InMemoryOrderRepository } from '../src/order-persistence.js';
import { runOrderRepositoryContract } from './order-repository-contract.js';

runOrderRepositoryContract(
  'In-memory Order repository contract',
  () => new InMemoryOrderRepository()
);
