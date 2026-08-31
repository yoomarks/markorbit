import fs from 'node:fs';

function replaceOnce(file, from, to) {
  const value = fs.readFileSync(file, 'utf8');
  const first = value.indexOf(from);
  if (first < 0) throw new Error(`Missing patch anchor in ${file}`);
  if (value.indexOf(from, first + from.length) >= 0) throw new Error(`Patch anchor not unique in ${file}`);
  fs.writeFileSync(file, value.slice(0, first) + to + value.slice(first + from.length));
}

replaceOnce(
  'services/markreg/src/matter-intelligence-review.ts',
  "export function matterIntelligenceObservationFingerprintFromRow(\n  row: Readonly<Record<string, unknown>>\n): string {\n  return fingerprint(observationIdentity(row as Row));\n}",
  "export function matterIntelligenceObservationFingerprintFromRow(row: Readonly<Row>): string {\n  return fingerprint(observationIdentity(row));\n}"
);

replaceOnce(
  'services/markreg/src/method-outcome-evidence-emission.ts',
  "function text(row: ObservationRow, field: string): string {\n  const value = String(row[field] ?? '').trim();\n  if (!value) {\n    throw new MatterIntelligenceReviewError(\n      'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',\n      `Persisted MarkReg observation field ${field} is missing.`,\n      502\n    );\n  }\n  return value;\n}",
  "function text(row: ObservationRow, field: string): string {\n  const value = row[field];\n  if (typeof value !== 'string' || !value.trim()) {\n    throw new MatterIntelligenceReviewError(\n      'OUTCOME_EVIDENCE_CONTRACT_MISMATCH',\n      `Persisted MarkReg observation field ${field} is missing.`,\n      502\n    );\n  }\n  return value.trim();\n}"
);
