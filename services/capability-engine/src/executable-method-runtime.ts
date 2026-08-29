import { createHash } from 'node:crypto';
import {
  selectExecutableMethodPackageV1,
  type ExecutableMethodPackageV1,
  type MethodSelectionContextV1
} from '@markorbit/contracts/brain-method';
import type {
  CapabilityRequestV2,
  ImplementationBinding
} from '@markorbit/contracts/capability-runtime';
import type {
  CapabilityImplementationExecutionResult,
  CapabilityImplementationExecutor
} from './capability-runtime.js';

export type ExecutableMethodRuntimeErrorCode =
  | 'METHOD_NOT_APPLICABLE'
  | 'METHOD_SELECTION_AMBIGUOUS'
  | 'METHOD_PACKAGE_SCHEMA_MISMATCH'
  | 'METHOD_EXECUTABLE_KIND_INVALID'
  | 'METHOD_EXECUTABLE_KIND_UNSUPPORTED';

export class ExecutableMethodRuntimeError extends Error {
  constructor(
    readonly code: ExecutableMethodRuntimeErrorCode,
    message: string,
    readonly details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'ExecutableMethodRuntimeError';
  }
}

/**
 * Read-only source of immutable Brain executable packages.
 * This is intentionally not another Brain registry or lifecycle authority.
 */
export interface ExecutableMethodPackageSourceV1 {
  list(): Promise<readonly unknown[]>;
}

/**
 * Capability-specific mapping into the existing Brain Method Selector contract.
 * The generic runtime must not infer business applicability from arbitrary input.
 */
export interface MethodSelectionContextResolverV1 {
  resolve(
    request: Readonly<CapabilityRequestV2>,
    binding: Readonly<ImplementationBinding>
  ): Promise<Readonly<MethodSelectionContextV1>> | Readonly<MethodSelectionContextV1>;
}

export interface ExecutableMethodPackageRunnerInputV1 {
  request: Readonly<CapabilityRequestV2>;
  binding: Readonly<ImplementationBinding>;
  package: Readonly<ExecutableMethodPackageV1>;
}

export interface ExecutableMethodPackageRunnerV1 {
  run(
    input: Readonly<ExecutableMethodPackageRunnerInputV1>
  ): Promise<CapabilityImplementationExecutionResult>;
}

export interface ExecutableMethodPackageRunnerRegistryV1 {
  resolve(executableKind: string): ExecutableMethodPackageRunnerV1 | undefined;
}

export interface ExecutableMethodCapabilityExecutorOptionsV1 {
  packages: ExecutableMethodPackageSourceV1;
  selectionContext: MethodSelectionContextResolverV1;
  runners: ExecutableMethodPackageRunnerRegistryV1;
}

function executableKind(pkg: Readonly<ExecutableMethodPackageV1>): string {
  const kind = pkg.executable.kind;
  if (typeof kind !== 'string' || !kind.trim()) {
    throw new ExecutableMethodRuntimeError(
      'METHOD_EXECUTABLE_KIND_INVALID',
      'The selected executable method package does not declare a valid executable kind.',
      { packageId: pkg.packageId }
    );
  }
  return kind.trim();
}

function limitationsDigest(pkg: Readonly<ExecutableMethodPackageV1>): string {
  return createHash('sha256').update(JSON.stringify(pkg.limitations)).digest('hex');
}

/**
 * Stable references that let execution audit recover the exact package, method,
 * evaluation, research lineage and limitations without copying source populations.
 */
export function executableMethodPackageEvidenceRefsV1(
  pkg: Readonly<ExecutableMethodPackageV1>
): readonly string[] {
  const refs = [
    `brain-method-package:${pkg.packageId}@${pkg.packageVersion}`,
    `brain-method:${pkg.methodId}`,
    `brain-method-version:${pkg.methodVersionId}`,
    `brain-method-evaluation:${pkg.evaluation.evaluationId}`,
    `brain-method-limitations-sha256:${limitationsDigest(pkg)}`,
    ...pkg.referenceDependencies.map((dependency) => `brain-reference:${dependency}`),
    ...pkg.lineage.knowledgeSources.map(
      (source) =>
        `knowledge-source:${source.content.objectId}:${source.chunkId}:${source.contentSha256}`
    ),
    ...pkg.lineage.researchDatasets.map(
      (dataset) =>
        `research-dataset:${dataset.dataset_ref_id}:${dataset.query_fingerprint_sha256}:${dataset.integrity_sha256}`
    )
  ];
  return [...new Set(refs)].sort();
}

/**
 * Adapter used as an existing GovernedCapabilityRuntime implementation executor.
 * It delegates applicability/lifecycle selection to selectExecutableMethodPackageV1,
 * which admits ACTIVE packages only. Brain Research is deliberately absent here.
 */
export class ExecutableMethodCapabilityExecutorV1 implements CapabilityImplementationExecutor {
  constructor(private readonly options: ExecutableMethodCapabilityExecutorOptionsV1) {}

  async execute(
    request: Readonly<CapabilityRequestV2>,
    binding: Readonly<ImplementationBinding>
  ): Promise<CapabilityImplementationExecutionResult> {
    const context = await this.options.selectionContext.resolve(request, binding);
    const packages = await this.options.packages.list();
    const selection = selectExecutableMethodPackageV1(packages, context);

    if (selection.status === 'NOT_APPLICABLE') {
      throw new ExecutableMethodRuntimeError('METHOD_NOT_APPLICABLE', selection.reason, {
        capabilityId: request.capabilityId
      });
    }
    if (selection.status === 'AMBIGUOUS') {
      throw new ExecutableMethodRuntimeError('METHOD_SELECTION_AMBIGUOUS', selection.reason, {
        packageIds: [...selection.packageIds]
      });
    }

    const pkg = selection.package;
    if (
      pkg.inputSchemaId !== request.inputSchemaId ||
      pkg.outputSchemaId !== request.outputSchemaId
    ) {
      throw new ExecutableMethodRuntimeError(
        'METHOD_PACKAGE_SCHEMA_MISMATCH',
        'The selected executable method package schemas do not match the governed Capability request.',
        {
          packageId: pkg.packageId,
          packageInputSchemaId: pkg.inputSchemaId,
          packageOutputSchemaId: pkg.outputSchemaId,
          requestInputSchemaId: request.inputSchemaId,
          requestOutputSchemaId: request.outputSchemaId
        }
      );
    }

    const kind = executableKind(pkg);
    const runner = this.options.runners.resolve(kind);
    if (!runner) {
      throw new ExecutableMethodRuntimeError(
        'METHOD_EXECUTABLE_KIND_UNSUPPORTED',
        `No admitted executable method runner is registered for ${kind}.`,
        { packageId: pkg.packageId, executableKind: kind }
      );
    }

    const result = await runner.run({ request, binding, package: pkg });
    return {
      ...result,
      evidenceRefs: [
        ...new Set([...executableMethodPackageEvidenceRefsV1(pkg), ...(result.evidenceRefs ?? [])])
      ].sort()
    };
  }
}
