import fs from 'node:fs';
const path = 'services/execution/tests/durable-preparation-source.test.ts';
let text = fs.readFileSync(path, 'utf8');
text = text.replace(
  "  FilingGovernanceService,\n  InMemoryFilingGovernanceRepository\n} from '../src/filing-authorization.js';",
  "  FilingGovernanceService,\n  InMemoryFilingGovernanceRepository,\n  type FilingAuthorizationRepository,\n  type ExecutionReleaseRepository,\n  type FilingExecutionTaskDraftRepository\n} from '../src/filing-authorization.js';"
);
text = text.replaceAll(
  'new FilingGovernanceService(repository, repository, repository, durable, () => at)',
  `new FilingGovernanceService(\n      repository as unknown as FilingAuthorizationRepository,\n      repository as unknown as ExecutionReleaseRepository,\n      repository as unknown as FilingExecutionTaskDraftRepository,\n      durable,\n      () => at\n    )`
);
fs.writeFileSync(path, text);
console.log('TASK 731 test repository typing fixed');
