import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import {
  CN_DURATION_RESEARCH_CORE_INTAKE_VERSION,
  runCnDurationResearchEvidenceFileIntakeV1
} from '../src/brain-cn-duration-evidence-intake.js';

const evidencePath = join(
  dirname(fileURLToPath(import.meta.url)),
  'evidence',
  'cn_filing_to_prelim_research_evidence_4ee0030dd77fac50f973573818225324888dc064.json'
);

const expectedEvidenceSha256 =
  'de407eb5e5c0704c7e2817cf8ce67f14c381d1a587fb986a664425d8a3eb411c';
const expectedDatasetRef =
  'research-dataset_7bdd73d7e4eab9cec0bc04337747f2ea6c1b692f9a79570c4b7ba4fde1faa82d';

describe('Phase 3 real CN duration target-host evidence acceptance', () => {
  it('accepts the exact uploaded PASS evidence and compiles only VALIDATED artifacts', () => {
    const result = runCnDurationResearchEvidenceFileIntakeV1(evidencePath);

    expect(result.intake_version).toBe(CN_DURATION_RESEARCH_CORE_INTAKE_VERSION);
    expect(result.evidence_sha256).toBe(expectedEvidenceSha256);
    expect(result.status).toBe('READY');
    if (result.status !== 'READY') {
      throw new Error(`expected READY, got ${result.status}`);
    }

    expect(result.evaluation.status).toBe('PASSED');
    expect(result.evaluation.metrics.rawPopulationCopyToCore).toBe(0);

    expect(result.method.lifecycle).toBe('VALIDATED');
    expect(result.method.lineage.researchDatasets[0]?.dataset_ref_id).toBe(
      expectedDatasetRef
    );

    expect(result.package.lifecycle).toBe('VALIDATED');
    expect(result.package.lineage.researchDatasets[0]?.dataset_ref_id).toBe(
      expectedDatasetRef
    );
    expect(result.package.activatedAt).toBeUndefined();
    expect(result.package.executable.legalConclusion).toBe(false);
    expect(result.package.executable.predictiveClaim).toBe(false);

    process.stdout.write(
      `PHASE3_CORE_REAL_INTAKE_PASS ${JSON.stringify({
        intake_version: result.intake_version,
        evidence_sha256: result.evidence_sha256,
        evaluation_status: result.evaluation.status,
        method_lifecycle: result.method.lifecycle,
        package_lifecycle: result.package.lifecycle,
        dataset_ref_id: expectedDatasetRef
      })}\n`
    );
  });
});
