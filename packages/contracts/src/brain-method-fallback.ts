import {
  BrainMethodContractError,
  parseExecutableMethodPackageV1,
  selectExecutableMethodPackageV1,
  type ExecutableMethodPackageV1,
  type MethodSelectionContextV1,
  type MethodSelectionResultV1
} from './brain-method.js';

export type MethodFallbackResolutionV1 =
  | {
      status: 'FALLBACK_SELECTED';
      primaryPackageId: ExecutableMethodPackageV1['packageId'];
      fallback: Readonly<ExecutableMethodPackageV1>;
      reason: string;
    }
  | {
      status: 'NOT_APPLICABLE';
      primaryPackageId: ExecutableMethodPackageV1['packageId'];
      reason: string;
    }
  | {
      status: 'AMBIGUOUS';
      primaryPackageId: ExecutableMethodPackageV1['packageId'];
      reason: string;
      packageIds: readonly ExecutableMethodPackageV1['packageId'][];
    };

/**
 * Resolve fallback only from an explicitly identified primary package.
 *
 * The ordinary selector never guesses a fallback from an inapplicable package.
 * This keeps fallback authority explicit: the caller must know which governed
 * primary package failed or became inapplicable, and the fallback package must
 * independently satisfy ACTIVE lifecycle, applicability, effective-window and
 * data-availability checks.
 */
export function resolveExplicitMethodFallbackV1(
  primaryValue: unknown,
  packages: readonly unknown[],
  context: Readonly<MethodSelectionContextV1>
): MethodFallbackResolutionV1 {
  const primary = parseExecutableMethodPackageV1(primaryValue);
  if (primary.fallback.behavior === 'NOT_APPLICABLE') {
    return {
      status: 'NOT_APPLICABLE',
      primaryPackageId: primary.packageId,
      reason: 'The primary package explicitly declares NOT_APPLICABLE fallback behavior.'
    };
  }

  const fallbackMethodId = primary.fallback.fallbackMethodId;
  if (!fallbackMethodId) {
    throw new BrainMethodContractError(
      'METHOD fallback requires an explicit fallbackMethodId.'
    );
  }

  const fallbackCandidates = packages
    .map(parseExecutableMethodPackageV1)
    .filter((candidate) => candidate.methodId === fallbackMethodId);

  if (!fallbackCandidates.length) {
    return {
      status: 'NOT_APPLICABLE',
      primaryPackageId: primary.packageId,
      reason: 'The explicitly referenced fallback method has no available executable package.'
    };
  }

  const families = [...new Set(fallbackCandidates.map((candidate) => candidate.methodFamily))];
  if (families.length !== 1) {
    throw new BrainMethodContractError(
      'All executable packages for one fallback method identity must share one method family.'
    );
  }

  const selected: MethodSelectionResultV1 = selectExecutableMethodPackageV1(
    fallbackCandidates,
    { ...context, methodFamily: families[0]! }
  );

  if (selected.status === 'SELECTED') {
    return {
      status: 'FALLBACK_SELECTED',
      primaryPackageId: primary.packageId,
      fallback: selected.package,
      reason: 'Selected the explicitly referenced fallback method after independent applicability validation.'
    };
  }
  if (selected.status === 'AMBIGUOUS') {
    return {
      status: 'AMBIGUOUS',
      primaryPackageId: primary.packageId,
      reason: 'The explicitly referenced fallback method has multiple highest-priority applicable packages.',
      packageIds: selected.packageIds
    };
  }
  return {
    status: 'NOT_APPLICABLE',
    primaryPackageId: primary.packageId,
    reason: 'The explicitly referenced fallback method is not applicable to the current request.'
  };
}
