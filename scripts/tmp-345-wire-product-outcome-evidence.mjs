import fs from 'node:fs';

const file = 'package.json';
const value = fs.readFileSync(file, 'utf8');
const from = 'tests/audit-postgres.test.ts tests/formal-matter-postgres.test.ts tests/document-package-postgres.test.ts';
const to = 'tests/audit-postgres.test.ts tests/formal-matter-postgres.test.ts tests/document-package-postgres.test.ts tests/matter-intelligence-review-postgres.test.ts tests/method-outcome-evidence-emission-postgres.test.ts';
const first = value.indexOf(from);
if (first < 0) throw new Error('Missing MarkReg durable PostgreSQL lane anchor.');
if (value.indexOf(from, first + from.length) >= 0)
  throw new Error('MarkReg durable PostgreSQL lane anchor is not unique.');
fs.writeFileSync(file, value.slice(0, first) + to + value.slice(first + from.length));
