import { InMemoryCustomerConfirmationRepository } from '../src/customer-confirmation.js';
import { runCustomerConfirmationRepositoryContract } from './customer-confirmation-repository-contract.js';
runCustomerConfirmationRepositoryContract('in-memory', () =>
  Promise.resolve(new InMemoryCustomerConfirmationRepository())
);
