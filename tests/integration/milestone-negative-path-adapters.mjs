export const milestoneNegativePathAdapters = [
  [
    'NP-001',
    'services/markreg/tests/matter-flow.test.ts',
    'rejects a quote-version mismatch and an invalid Quote status',
    'apps/gateway/tests/vertical-slice.test.ts',
    'rejects expired, superseded, and unknown Quotes without side effects'
  ],
  [
    'NP-002',
    'services/markreg/tests/matter-flow.test.ts',
    'rejects a quote-version mismatch and an invalid Quote status',
    'apps/gateway/tests/customer-confirmation-matter-draft.test.ts',
    'rejects non-confirmable or expired Quotes'
  ],
  [
    'NP-003',
    'services/markreg/tests/matter-flow.test.ts',
    'rejects a quote-version mismatch',
    'apps/gateway/tests/customer-confirmation-matter-draft.test.ts',
    'verifies the exact Quote version'
  ],
  [
    'NP-004',
    'services/markreg/tests/matter-flow.test.ts',
    'prevents a withdrawn confirmation',
    'apps/gateway/tests/customer-confirmation-matter-draft.test.ts',
    'rejects creation from a withdrawn confirmation'
  ],
  [
    'NP-005',
    'services/markreg/tests/matter-flow.test.ts',
    'treats missing and UNKNOWN blocking evidence',
    'apps/gateway/tests/customer-confirmation-matter-draft.test.ts',
    'exposes blocking FAIL and UNKNOWN checks'
  ],
  [
    'NP-006',
    'services/execution/tests/professional-review.test.ts',
    'rejects a duplicate active case',
    'apps/gateway/tests/professional-review-negative-paths.test.ts',
    'preserves ACTIVE_REVIEW_CASE_EXISTS'
  ],
  [
    'NP-007',
    'services/execution/tests/professional-review.test.ts',
    'rejects stale completion',
    'apps/gateway/tests/professional-review-negative-paths.test.ts',
    'preserves CASE_STALE'
  ],
  [
    'NP-008',
    'services/markreg/tests/preparation.test.ts',
    'does not treat missing or blocking checks as ready',
    'apps/gateway/tests/document-package-instruction-ledger.test.ts',
    'reports blocking FAIL, then UNKNOWN'
  ],
  [
    'NP-009',
    'services/markreg/tests/preparation.test.ts',
    'requires explicit supersession',
    'apps/gateway/tests/document-package-instruction-ledger.test.ts',
    'explicitly supersedes document metadata'
  ],
  [
    'NP-010',
    'services/markreg/tests/preparation.test.ts',
    'creates an immutable lock with every authority consequence false',
    'apps/gateway/tests/document-package-instruction-ledger.test.ts',
    'rejects locks for incomplete documents and incomplete instructions'
  ],
  [
    'NP-011',
    'services/execution/tests/filing-authorization.test.ts',
    'rejects an invalid Preparation Lock state',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'rejects invalid lock status'
  ],
  [
    'NP-012',
    'services/execution/tests/filing-authorization.test.ts',
    'requires every active acknowledgement',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'requires all acknowledgements'
  ],
  [
    'NP-013',
    'services/execution/tests/filing-authorization.test.ts',
    'withdraws without implying submission',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'elapsed authorization expired'
  ],
  [
    'NP-014',
    'services/execution/tests/professional-review.test.ts',
    'rejects blocking FAIL',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'blocks release on UNKNOWN and on stale FAIL'
  ],
  [
    'NP-015',
    'services/execution/tests/filing-authorization.test.ts',
    'prevents release while UNKNOWN',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'blocks release on UNKNOWN and on stale FAIL'
  ],
  [
    'NP-016',
    'services/execution/tests/filing-authorization.test.ts',
    'creates exactly one internal task draft',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'rejects duplicate active release'
  ],
  [
    'NP-017',
    'services/execution/tests/filing-authorization.test.ts',
    'creates exactly one internal task draft',
    'apps/gateway/tests/filing-authorization-execution-release.test.ts',
    'marks released record and its task draft stale'
  ]
].map(([caseId, serviceFile, servicePattern, gatewayFile, gatewayPattern]) => {
  const markregComplete = [
    'NP-001',
    'NP-002',
    'NP-003',
    'NP-004',
    'NP-005',
    'NP-008',
    'NP-009',
    'NP-010',
    'NP-011'
  ].includes(caseId);
  return {
    caseId,
    semanticClosure: markregComplete ? 'SEMANTICALLY_COMPLETE' : 'SEMANTIC_CLOSURE_PENDING',
    service: markregComplete
      ? {
          file: 'services/markreg/tests/milestone-negative-path-matrix.test.ts',
          pattern: `${caseId} Service boundary preserves typed immutable failure`,
          sourcePattern: "'%s Service boundary preserves typed immutable failure'"
        }
      : { file: serviceFile, pattern: servicePattern },
    gateway: markregComplete
      ? {
          file: 'apps/gateway/tests/markreg-negative-path-matrix.test.ts',
          pattern: `${caseId} Gateway HTTP preserves semantic immutable failure`,
          sourcePattern: "'%s Gateway HTTP preserves semantic immutable failure'"
        }
      : { file: gatewayFile, pattern: gatewayPattern },
    assertions: markregComplete
      ? {
          typedError: true,
          immutableState: true,
          noPartialMutation: true,
          authorityConsequences: '13/13_FALSE'
        }
      : undefined
  };
});
