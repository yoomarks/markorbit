import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  BrainMethodContractError,
  type BrainMethodEvaluationV1
} from './brain-method.js';
import {
  compileCnDurationStatisticalMethodPackageV1,
  evaluateCnDurationResearchV1,
  type CompileCnDurationStatisticalMethodResultV1
} from './brain-cn-duration-research.js';

export const CN_DURATION_RESEARCH_EVIDENCE_VERSION =
  'CN_FILING_TO_PRELIM_RESEARCH_EVIDENCE_V1' as const;
export const CN_DURATION_RESEARCH_CORE_INTAKE_VERSION =
  'CN_FILING_TO_PRELIM_CORE_EVIDENCE_INTAKE_V1' as const;

export interface CnDurationResearchEvidenceBundleV1 {
  evidence_version: typeof CN_DURATION_RESEARCH_EVIDENCE_VERSION;
  status: 'PASS';
  redacted: true;
  objective_only: true;
  dataset: unknown;
  acceptance_receipt: unknown;
  first_summary: unknown;
  replay_summary: unknown;
  raw_population_rows_emitted: false;
}

type CompileRejection = Extract<CompileCnDurationStatisticalMethodResultV1, { status: 'REJECTED' }>;

export type CnDurationResearchEvidenceIntakeResultV1 =
  | CompileRejection
  | { status: 'REJECTED'; reason: 'EVIDENCE_BUNDLE_MISMATCH' }
  | {
      status: 'READY';
      evaluation: Readonly<BrainMethodEvaluationV1>;
      method: Extract<CompileCnDurationStatisticalMethodResultV1, { status: 'READY' }>['method'];
      package: Extract<CompileCnDurationStatisticalMethodResultV1, { status: 'READY' }>['package'];
    };

export type CnDurationResearchEvidenceFileIntakeResultV1 =
  | {
      intake_version: typeof CN_DURATION_RESEARCH_CORE_INTAKE_VERSION;
      evidence_sha256: string;
      status: 'REJECTED';
      reason: 'EVIDENCE_JSON_INVALID';
    }
  | ({
      intake_version: typeof CN_DURATION_RESEARCH_CORE_INTAKE_VERSION;
      evidence_sha256: string;
    } & CnDurationResearchEvidenceIntakeResultV1);

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function exactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  field: string
): void {
  const expectedKeys = new Set(expected);
  const unsupported = Object.keys(value).filter((key) => !expectedKeys.has(key));
  const missing = expected.filter((key) => !(key in value));
  if (unsupported.length || missing.length) {
    throw new BrainMethodContractError(`${field} does not match the frozen evidence contract.`);
  }
}

export function parseCnDurationResearchEvidenceBundleV1(
  value: unknown
): CnDurationResearchEvidenceBundleV1 {
  const evidence = record(value);
  exactKeys(
    evidence,
    [
      'evidence_version',
      'status',
      'redacted',
      'objective_only',
      'dataset',
      'acceptance_receipt',
      'first_summary',
      'replay_summary',
      'raw_population_rows_emitted'
    ],
    'CN duration Data Engine evidence bundle'
  );
  if (
    evidence.evidence_version !== CN_DURATION_RESEARCH_EVIDENCE_VERSION ||
    evidence.status !== 'PASS' ||
    evidence.redacted !== true ||
    evidence.objective_only !== true ||
    evidence.raw_population_rows_emitted !== false
  ) {
    throw new BrainMethodContractError(
      'CN duration Data Engine evidence bundle is outside the frozen PASS boundary.'
    );
  }

  return {
    evidence_version: CN_DURATION_RESEARCH_EVIDENCE_VERSION,
    status: 'PASS',
    redacted: true,
    objective_only: true,
    dataset: evidence.dataset,
    acceptance_receipt: evidence.acceptance_receipt,
    first_summary: evidence.first_summary,
    replay_summary: evidence.replay_summary,
    raw_population_rows_emitted: false
  };
}

export function compileCnDurationResearchEvidenceBundleV1(
  value: unknown
): CnDurationResearchEvidenceIntakeResultV1 {
  let evidence: CnDurationResearchEvidenceBundleV1;
  try {
    evidence = parseCnDurationResearchEvidenceBundleV1(value);
  } catch {
    return { status: 'REJECTED', reason: 'EVIDENCE_BUNDLE_MISMATCH' };
  }

  const input = {
    dataset: evidence.dataset,
    acceptanceReceipt: evidence.acceptance_receipt,
    firstSummary: evidence.first_summary,
    replaySummary: evidence.replay_summary
  };
  const evaluated = evaluateCnDurationResearchV1(input);
  if (evaluated.status === 'REJECTED') return evaluated;

  const compiled = compileCnDurationStatisticalMethodPackageV1(input);
  if (compiled.status === 'REJECTED') return compiled;

  return {
    status: 'READY',
    evaluation: evaluated.evaluation,
    method: compiled.method,
    package: compiled.package
  };
}

export function runCnDurationResearchEvidenceFileIntakeV1(
  evidencePath: string
): CnDurationResearchEvidenceFileIntakeResultV1 {
  const raw = readFileSync(resolve(evidencePath));
  const evidenceSha256 = createHash('sha256').update(raw).digest('hex');

  let value: unknown;
  try {
    value = JSON.parse(raw.toString('utf8')) as unknown;
  } catch {
    return {
      intake_version: CN_DURATION_RESEARCH_CORE_INTAKE_VERSION,
      evidence_sha256: evidenceSha256,
      status: 'REJECTED',
      reason: 'EVIDENCE_JSON_INVALID'
    };
  }

  return {
    intake_version: CN_DURATION_RESEARCH_CORE_INTAKE_VERSION,
    evidence_sha256: evidenceSha256,
    ...compileCnDurationResearchEvidenceBundleV1(value)
  };
}

function cliValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} requires a value.`);
  }
  return value;
}

function assertSupportedCliArgs(args: readonly string[]): void {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg !== '--evidence' && arg !== '--output') {
      throw new Error(`Unsupported argument: ${arg ?? ''}`);
    }
    index += 1;
    if (index >= args.length) throw new Error(`${arg} requires a value.`);
  }
}

export function main(args: readonly string[] = process.argv.slice(2)): number {
  assertSupportedCliArgs(args);
  const evidencePath = cliValue(args, '--evidence');
  if (!evidencePath) throw new Error('--evidence is required.');
  const outputPath = cliValue(args, '--output');

  const result = runCnDurationResearchEvidenceFileIntakeV1(evidencePath);
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  if (outputPath) {
    const resolvedOutput = resolve(outputPath);
    mkdirSync(dirname(resolvedOutput), { recursive: true });
    writeFileSync(resolvedOutput, payload, 'utf8');
  }
  process.stdout.write(payload);
  return result.status === 'READY' ? 0 : 2;
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(resolve(invokedPath)).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown CN duration evidence intake error.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 2;
  }
}
