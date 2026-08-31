import fs from 'node:fs';

function read(file) {
  return fs.readFileSync(file, 'utf8');
}
function write(file, value) {
  fs.writeFileSync(file, value);
}
function replaceOnce(file, from, to) {
  const value = read(file);
  const first = value.indexOf(from);
  if (first < 0) throw new Error(`Missing patch anchor in ${file}: ${from.slice(0, 120)}`);
  if (value.indexOf(from, first + from.length) >= 0)
    throw new Error(`Patch anchor is not unique in ${file}: ${from.slice(0, 120)}`);
  write(file, value.slice(0, first) + to + value.slice(first + from.length));
}

const review = 'services/markreg/src/matter-intelligence-review.ts';
replaceOnce(
  review,
  "  | 'IDEMPOTENCY_CONFLICT'\n  | 'PERSISTENCE_UNAVAILABLE';",
  "  | 'IDEMPOTENCY_CONFLICT'\n  | 'OUTCOME_EVIDENCE_UNAVAILABLE'\n  | 'OUTCOME_EVIDENCE_REJECTED'\n  | 'OUTCOME_EVIDENCE_CONTRACT_MISMATCH'\n  | 'PERSISTENCE_UNAVAILABLE';"
);
replaceOnce(
  review,
  'function newReviewId(): MatterIntelligenceReviewId {',
  `export function matterIntelligenceObservationFingerprintFromRow(\n  row: Readonly<Record<string, unknown>>\n): string {\n  return fingerprint(observationIdentity(row as Row));\n}\n\nfunction newReviewId(): MatterIntelligenceReviewId {`
);
replaceOnce(
  review,
  'const observationFingerprintSha256 = fingerprint(observationIdentity(observationRow));',
  'const observationFingerprintSha256 = matterIntelligenceObservationFingerprintFromRow(observationRow);'
);

const http = 'services/markreg/src/matter-intelligence-review-http.ts';
replaceOnce(
  http,
  "  type MatterIntelligenceReviewReason,\n  type MatterIntelligenceReviewService",
  "  type MatterIntelligenceReviewReason,\n  type MatterIntelligenceReviewService,\n  type MarkRegMatterIntelligenceReviewV1"
);
replaceOnce(
  http,
  "export interface MatterIntelligenceReviewHttpOptions {\n  internalServiceSecret: string;\n  service: Pick<MatterIntelligenceReviewService, 'recordReview'>;\n}",
  "export interface MatterIntelligenceReviewHttpOptions {\n  internalServiceSecret: string;\n  service: Pick<MatterIntelligenceReviewService, 'recordReview'>;\n  evidenceEmitter?: Readonly<{\n    emit(review: Readonly<MarkRegMatterIntelligenceReviewV1>): Promise<unknown>;\n  }>;\n}"
);
replaceOnce(
  http,
  "          return json(\n            disposition.replayed || disposition.semanticDuplicate ? 200 : 201,",
  "          if (options.evidenceEmitter) await options.evidenceEmitter.emit(disposition.review);\n          return json(\n            disposition.replayed || disposition.semanticDuplicate ? 200 : 201,"
);

const main = 'services/markreg/src/main.ts';
replaceOnce(
  main,
  "import { createMatterIntelligenceReviewRoutes } from './matter-intelligence-review-http.js';",
  "import { createMatterIntelligenceReviewRoutes } from './matter-intelligence-review-http.js';\nimport {\n  HttpCoreMethodOutcomeEvidenceAdmissionClientV1,\n  MarkRegMethodOutcomeEvidenceEmitterV1,\n  PostgresMarkRegMethodOutcomeEvidenceSourceV1\n} from './method-outcome-evidence-emission.js';"
);
replaceOnce(
  main,
  "  const capabilityUrl = process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';",
  "  const capabilityUrl = process.env.CAPABILITY_ENGINE_URL ?? 'http://127.0.0.1:4103';\n  const coreUrl = process.env.CORE_URL ?? 'http://127.0.0.1:4101';"
);
replaceOnce(
  main,
  "  const matterIntelligenceReviewRoutes = createMatterIntelligenceReviewRoutes({\n    internalServiceSecret,\n    service: matterIntelligenceReviewService\n  });",
  "  const methodOutcomeEvidenceEmitter = new MarkRegMethodOutcomeEvidenceEmitterV1(\n    new PostgresMarkRegMethodOutcomeEvidenceSourceV1(pool),\n    new HttpCoreMethodOutcomeEvidenceAdmissionClientV1(coreUrl, internalServiceSecret)\n  );\n  const matterIntelligenceReviewRoutes = createMatterIntelligenceReviewRoutes({\n    internalServiceSecret,\n    service: matterIntelligenceReviewService,\n    evidenceEmitter: methodOutcomeEvidenceEmitter\n  });"
);

const ci = '.github/workflows/ci.yml';
replaceOnce(
  ci,
  '          pnpm --filter @markorbit/markreg-service exec vitest run tests/lifecycle-projection-postgres.test.ts tests/recommended-action-postgres.test.ts tests/order-memory-contract.test.ts tests/order-postgres.test.ts tests/order-service.test.ts tests/order-service-postgres.test.ts tests/order-matter-conversion-postgres.test.ts\n',
  '          pnpm --filter @markorbit/markreg-service exec vitest run tests/lifecycle-projection-postgres.test.ts tests/recommended-action-postgres.test.ts tests/order-memory-contract.test.ts tests/order-postgres.test.ts tests/order-service.test.ts tests/order-service-postgres.test.ts tests/order-matter-conversion-postgres.test.ts\n          pnpm --filter @markorbit/markreg-service exec vitest run tests/matter-intelligence-review-postgres.test.ts tests/method-outcome-evidence-emission-postgres.test.ts\n'
);
