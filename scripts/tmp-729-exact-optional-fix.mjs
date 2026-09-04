import { readFileSync, writeFileSync } from 'node:fs';
const path = 'apps/markreg-web/src/DurableDocumentsPreparationWorkspace.tsx';
const current = readFileSync(path, 'utf8');
const from = `      <FilingAuthorizationView\n        client={filingClient}\n        durablePreparationSource={{`;
const to = `      <FilingAuthorizationView\n        {...(filingClient ? { client: filingClient } : {})}\n        durablePreparationSource={{`;
if (!current.includes(from)) throw new Error('Missing exact optional client anchor');
writeFileSync(path, current.replace(from, to));
console.log('TASK 729 exact optional client prop fixed');
