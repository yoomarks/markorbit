import { describe, expect, it, vi } from 'vitest';
import type { ExecutableMethodPackageV1 } from '@markorbit/contracts/brain-method';
import type {
  CapabilityRequestV2,
  ImplementationBinding
} from '@markorbit/contracts/capability-runtime';
import {
  ExecutableMethodCapabilityExecutorV1,
  executableMethodPackageEvidenceRefsV1,
  type ExecutableMethodPackageRunnerV1
} from '../src/executable-method-runtime.js';

const NOW = '2026-08-29T00:00:00.000Z';

function activePackage(
  suffix = 'primary',
  overrides: Partial<ExecutableMethodPackageV1> = {}
): ExecutableMethodPackageV1 {
  return {
    schemaVersion: 1,
    packageId: `executable-method-package_test-${suffix}`,
    packageVersion: 1,
    methodId: `brain-method_test-${suffix}`,
    methodVersionId: `brain-method-version_test-${suffix}`,
    methodFamily: 'STATISTICAL_ANALYSIS',
    lifecycle: 'ACTIVE',
    selectionPriority: 10,
    applicability: {
      jurisdictions: ['CN'],
      authorities: ['CNIPA'],
      objectTypes: ['TRADEMARK_APPLICATION'],
      operations: ['DESCRIPTIVE_DURATION_RESEARCH'],
      procedures: ['FILING_TO_PRELIMINARY_PUBLICATION'],
      stages: ['HISTORICAL_FACT_RESEARCH'],
      filingBases: ['ANY'],
      segments: ['FILING_TO_PRELIM_PUBLICATION'],
      requiredData: ['FILING_DATE'],
      effectiveFrom: '2026-01-01T00:00:00.000Z'
    },
    inputSchemaId: 'input.test.v1',
    outputSchemaId: 'output.test.v1',
    executable: { kind: 'TEST_RUNNER', value: 42 },
    requiredData: ['FILING_DATE'],
    referenceDependencies: [],
    reasonCodes: { OK: 'Test execution succeeded.' },
    fallback: { behavior: 'NOT_APPLICABLE' },
    evaluation: {
      evaluationId: `evaluation-${suffix}`,
      evaluatedAt: '2026-08-28T00:00:00.000Z',
      status: 'PASSED',
      baseline: 'test-baseline',
      metrics: { replay: 1 },
      evidenceSummary: 'Deterministic test evaluation.'
    },
    lineage: { knowledgeSources: [], researchDatasets: [] },
    limitations: ['Test-only fixture limitation.'],
    createdAt: '2026-08-28T00:00:00.000Z',
    activatedAt: NOW,
    ...overrides
  };
}

function validatedPackage(suffix = 'validated'): ExecutableMethodPackageV1 {
  return {
    ...activePackage(suffix),
    lifecycle: 'VALIDATED',
    activatedAt: undefined
  };
}

const request: CapabilityRequestV2 = {
  schemaVersion: 2,
  capabilityRequestId: 'capreq_method-runtime-test',
  capabilityId: 'analytics.cn-duration',
  capabilityVersion: '1.0.0',
  caller: {
    workspaceId: 'workspace_test',
    principalId: 'principal_test',
    callerProduct: 'MARKREG',
    permissionContextRef: 'permission_context_test'
  },
  purpose: 'Execute one governed compiled analytical method.',
  input: { scope: 'CN' },
  inputSchemaId: 'input.test.v1',
  outputSchemaId: 'output.test.v1',
  riskClass: 'LOW',
  idempotencyKey: 'method-runtime-test-1',
  correlationId: 'correlation_method-runtime-test',
  receivedAt: NOW
};

const binding: ImplementationBinding = {
  schemaVersion: 1,
  implementationBindingId: 'implementation-binding_method-runtime-test',
  capabilityRequestId: request.capabilityRequestId,
  runtimeCapability: {
    id: 'runtime-capability_method-runtime-test',
    version: 1,
    capabilityId: request.capabilityId,
    capabilityVersion: request.capabilityVersion
  },
  implementation: {
    id: 'implementation-profile_method-runtime-test',
    version: 1,
    implementationKey: 'brain-method-package-runtime',
    kind: 'DETERMINISTIC_SERVICE'
  },
  selectionPolicyVersion: 'method-package-selector.v1',
  boundAt: NOW
};

const context = {
  methodFamily: 'STATISTICAL_ANALYSIS' as const,
  jurisdiction: 'CN',
  authority: 'CNIPA',
  objectType: 'TRADEMARK_APPLICATION',
  operation: 'DESCRIPTIVE_DURATION_RESEARCH',
  procedure: 'FILING_TO_PRELIMINARY_PUBLICATION',
  stage: 'HISTORICAL_FACT_RESEARCH',
  filingBasis: 'ANY',
  segment: 'FILING_TO_PRELIM_PUBLICATION',
  availableData: ['FILING_DATE'],
  asOf: NOW
};

function executor(packages: readonly unknown[]) {
  const run = vi.fn<ExecutableMethodPackageRunnerV1['run']>(async () => ({
    output: { statistic: 336 },
    evidenceRefs: ['runner-evidence:test']
  }));
  const instance = new ExecutableMethodCapabilityExecutorV1({
    packages: { list: vi.fn(() => Promise.resolve(packages)) },
    selectionContext: { resolve: vi.fn(() => context) },
    runners: {
      resolve: vi.fn((kind: string) => (kind === 'TEST_RUNNER' ? { run } : undefined))
    }
  });
  return { instance, run };
}

describe('Phase 4 executable method package runtime bridge', () => {
  it('selects and executes the exact ACTIVE package and emits immutable provenance refs', async () => {
    const pkg = activePackage();
    const { instance, run } = executor([pkg]);

    const result = await instance.execute(request, binding);

    expect(result.output).toEqual({ statistic: 336 });
    expect(run).toHaveBeenCalledTimes(1);
    const invocation = run.mock.calls[0]![0];
    expect(invocation.request).toBe(request);
    expect(invocation.binding).toBe(binding);
    expect(invocation.package.packageId).toBe(pkg.packageId);
    expect(result.evidenceRefs).toEqual(
      [...new Set([...executableMethodPackageEvidenceRefsV1(pkg), 'runner-evidence:test'])].sort()
    );
    expect(result.evidenceRefs).toContain(`brain-method-package:${pkg.packageId}@1`);
    expect(result.evidenceRefs).toContain(`brain-method-evaluation:${pkg.evaluation.evaluationId}`);
  });

  it('does not execute a VALIDATED package before an explicit ACTIVE lifecycle version exists', async () => {
    const { instance, run } = executor([validatedPackage()]);

    await expect(instance.execute(request, binding)).rejects.toMatchObject({
      code: 'METHOD_NOT_APPLICABLE'
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('fails closed for applicability drift without invoking a runner', async () => {
    const pkg = activePackage('wrong-jurisdiction', {
      applicability: { ...activePackage().applicability, jurisdictions: ['US'] }
    });
    const { instance, run } = executor([pkg]);

    await expect(instance.execute(request, binding)).rejects.toMatchObject({
      code: 'METHOD_NOT_APPLICABLE'
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('fails closed when multiple matching ACTIVE packages share highest priority', async () => {
    const { instance, run } = executor([activePackage('one'), activePackage('two')]);

    await expect(instance.execute(request, binding)).rejects.toMatchObject({
      code: 'METHOD_SELECTION_AMBIGUOUS'
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects selected package schema drift before executable dispatch', async () => {
    const pkg = activePackage('schema-drift', { inputSchemaId: 'input.other.v1' });
    const { instance, run } = executor([pkg]);

    await expect(instance.execute(request, binding)).rejects.toMatchObject({
      code: 'METHOD_PACKAGE_SCHEMA_MISMATCH'
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects a selected package with no executable kind before runner execution', async () => {
    const pkg = activePackage('missing-kind', { executable: { value: 42 } });
    const { instance, run } = executor([pkg]);

    await expect(instance.execute(request, binding)).rejects.toMatchObject({
      name: 'ExecutableMethodRuntimeError',
      code: 'METHOD_EXECUTABLE_KIND_INVALID'
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('rejects unsupported executable kinds before any implementation side effect', async () => {
    const pkg = activePackage('unsupported-kind', { executable: { kind: 'UNKNOWN_RUNNER' } });
    const { instance, run } = executor([pkg]);

    await expect(instance.execute(request, binding)).rejects.toMatchObject({
      code: 'METHOD_EXECUTABLE_KIND_UNSUPPORTED'
    });
    expect(run).not.toHaveBeenCalled();
  });
});
