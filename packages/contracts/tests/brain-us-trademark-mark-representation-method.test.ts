import { describe, expect, it } from 'vitest';

import { selectExecutableMethodPackageV1 } from '../src/brain-method.js';
import {
  brainMethodFingerprintV1,
  executableMethodPackageFingerprintV1
} from '../src/brain-method-activation.js';
import {
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
  USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
  US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID,
  US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID,
  US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID,
  US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID,
  activateUsTrademarkMarkRepresentationMethodPackageV1,
  compileUsTrademarkMarkRepresentationMethodPackageV1,
  executeUsTrademarkMarkRepresentationStrategyV1
} from '../src/brain-us-trademark-mark-representation-method.js';
import type { ProductionIntakeInputV1 } from '../src/markreg-early-funnel.js';

function intake(
  type: ProductionIntakeInputV1['trademark']['type'],
  targetJurisdictions: readonly string[] = ['US'],
  representationText = 'MARK ORBIT'
): ProductionIntakeInputV1 {
  return {
    businessContext: 'Protect the customer supplied brand presentation.',
    applicant: { type: 'ORGANIZATION', name: 'Example Inc.', country: 'US' },
    trademark: { type, representationText },
    targetJurisdictions,
    goodsServices: { sourceText: 'Software and related services.' },
    filingGoal: 'Understand protection dimensions before professional review.'
  };
}
function compileCurrent() {
  return compileUsTrademarkMarkRepresentationMethodPackageV1({
    knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
    reference: {
      ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
      currentness: 'CURRENT'
    }
  });
}

const selectionContext = {
  methodFamily: 'CLASSIFICATION' as const,
  jurisdiction: 'US',
  authority: 'USPTO',
  objectType: 'TRADEMARK_APPLICATION',
  operation: 'MARK_REPRESENTATION_STRATEGY',
  procedure: 'PRE_FILING_STRATEGY',
  stage: 'CUSTOMER_INTAKE',
  filingBasis: 'ANY',
  segment: 'MARK_REPRESENTATION',
  availableData: [
    'TRADEMARK_TYPE',
    'TRADEMARK_REPRESENTATION_TEXT',
    'TARGET_JURISDICTIONS',
    'SOURCE_LINEAGE'
  ],
  asOf: '2026-09-06T19:10:00.000Z'
};

describe('US trademark mark-representation strategy Method', () => {
  it('compiles the exact current Knowledge lineage into an immutable VALIDATED Method/package', () => {
    const compiled = compileCurrent();
    expect(compiled.status).toBe('READY');
    if (compiled.status !== 'READY') throw new Error(compiled.reason);

    expect(compiled.method.methodId).toBe(US_TRADEMARK_MARK_REPRESENTATION_METHOD_ID);
    expect(compiled.method.methodVersionId).toBe(
      US_TRADEMARK_MARK_REPRESENTATION_METHOD_VERSION_ID
    );
    expect(compiled.method.lifecycle).toBe('VALIDATED');
    expect(compiled.package.packageId).toBe(US_TRADEMARK_MARK_REPRESENTATION_PACKAGE_ID);
    expect(compiled.package.packageVersion).toBe(1);
    expect(compiled.package.lifecycle).toBe('VALIDATED');
    expect(compiled.package.inputSchemaId).toBe(US_TRADEMARK_MARK_REPRESENTATION_INPUT_SCHEMA_ID);
    expect(compiled.package.outputSchemaId).toBe(US_TRADEMARK_MARK_REPRESENTATION_OUTPUT_SCHEMA_ID);
  });
  it('emits only bounded human-review dimensions for supported customer mark forms', () => {
    expect(executeUsTrademarkMarkRepresentationStrategyV1(intake('WORD')).candidates).toEqual([
      expect.objectContaining({ dimension: 'WORDING_STANDARD_CHARACTER' })
    ]);
    expect(executeUsTrademarkMarkRepresentationStrategyV1(intake('DEVICE')).candidates).toEqual([
      expect.objectContaining({ dimension: 'DESIGN_STYLIZATION_SPECIAL_FORM' })
    ]);
    expect(
      executeUsTrademarkMarkRepresentationStrategyV1(intake('COMPOSITE')).candidates.map(
        (entry) => entry.dimension
      )
    ).toEqual(['WORDING_STANDARD_CHARACTER', 'DESIGN_STYLIZATION_SPECIAL_FORM']);
  });

  it('keeps unsupported legal and action authority consequences explicitly unestablished/false', () => {
    const result = executeUsTrademarkMarkRepresentationStrategyV1(intake('STYLIZED_WORD'));
    expect(result.status).toBe('APPLICABLE');
    expect(new Set(Object.values(result.unsupportedConclusions))).toEqual(
      new Set(['NOT_ESTABLISHED'])
    );
    expect(Object.values(result.authorityConsequences).every((value) => value === false)).toBe(
      true
    );
    expect('filingBasis' in result.unsupportedConclusions).toBe(true);
    expect('classes' in result.unsupportedConclusions).toBe(true);
    expect('deadlines' in result.unsupportedConclusions).toBe(true);
  });
  it('fails closed with explicit NOT_APPLICABLE semantics for non-US, unsupported, and insufficient intake', () => {
    expect(executeUsTrademarkMarkRepresentationStrategyV1(intake('WORD', ['CN']))).toMatchObject({
      status: 'NOT_APPLICABLE',
      reasonCode: 'NON_US_TARGET',
      candidates: []
    });
    expect(executeUsTrademarkMarkRepresentationStrategyV1(intake('OTHER'))).toMatchObject({
      status: 'NOT_APPLICABLE',
      reasonCode: 'UNSUPPORTED_MARK_TYPE',
      candidates: []
    });
    expect(
      executeUsTrademarkMarkRepresentationStrategyV1(intake('WORD', ['US'], '   '))
    ).toMatchObject({
      status: 'NOT_APPLICABLE',
      reasonCode: 'INSUFFICIENT_REPRESENTATION',
      candidates: []
    });
  });

  it('rejects stale or tampered Knowledge source identity instead of guessing', () => {
    expect(
      compileUsTrademarkMarkRepresentationMethodPackageV1({
        knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
        reference: { ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE, currentness: 'STALE' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'REFERENCE_NOT_CURRENT' });

    const tampered = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map((source, index) =>
      index === 0
        ? { ...structuredClone(source), contentSha256: 'f'.repeat(64) }
        : structuredClone(source)
    );
    expect(
      compileUsTrademarkMarkRepresentationMethodPackageV1({
        knowledgeSources: tampered,
        reference: { ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE, currentness: 'CURRENT' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'LINEAGE_MISMATCH' });

    const wrongChunk = USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE.map((source, index) =>
      index === 0 ? { ...structuredClone(source), chunkId: 'rch_wrong' } : structuredClone(source)
    );
    expect(
      compileUsTrademarkMarkRepresentationMethodPackageV1({
        knowledgeSources: wrongChunk,
        reference: { ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE, currentness: 'CURRENT' }
      })
    ).toEqual({ status: 'REJECTED', reason: 'LINEAGE_MISMATCH' });

    for (const reference of [
      {
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
        documentId: 'art_wrong',
        currentness: 'CURRENT' as const
      },
      {
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
        artifactVersion: 1,
        currentness: 'CURRENT' as const
      },
      {
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
        documentContentSha256: 'f'.repeat(64),
        currentness: 'CURRENT' as const
      },
      {
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
        sourceVersion: '2023-11-30',
        currentness: 'CURRENT' as const
      },
      {
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
        httpBodySha256: 'f'.repeat(64),
        currentness: 'CURRENT' as const
      },
      {
        ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE,
        retrievalDocumentCurrent: false,
        currentness: 'CURRENT' as const
      }
    ]) {
      expect(
        compileUsTrademarkMarkRepresentationMethodPackageV1({
          knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
          reference
        })
      ).toEqual({ status: 'REJECTED', reason: 'REFERENCE_MISMATCH' });
    }

    expect(
      compileUsTrademarkMarkRepresentationMethodPackageV1({
        knowledgeSources: USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_LINEAGE,
        reference: { ...USPTO_MARK_DRAWING_STRATEGY_ACCEPTED_REFERENCE } as never
      })
    ).toEqual({ status: 'REJECTED', reason: 'REFERENCE_NOT_CURRENT' });
  });
  it('replays deterministically for identical source and intake', () => {
    const firstCompilation = compileCurrent();
    const secondCompilation = compileCurrent();
    expect(firstCompilation.status).toBe('READY');
    expect(secondCompilation.status).toBe('READY');
    if (firstCompilation.status !== 'READY' || secondCompilation.status !== 'READY') {
      throw new Error('Expected the exact current source to compile.');
    }
    expect(secondCompilation.method).toEqual(firstCompilation.method);
    expect(brainMethodFingerprintV1(secondCompilation.method)).toBe(
      brainMethodFingerprintV1(firstCompilation.method)
    );
    expect(executableMethodPackageFingerprintV1(secondCompilation.package)).toBe(
      executableMethodPackageFingerprintV1(firstCompilation.package)
    );

    const first = executeUsTrademarkMarkRepresentationStrategyV1(intake('COMPOSITE'));
    const second = executeUsTrademarkMarkRepresentationStrategyV1(intake('COMPOSITE'));
    expect(second).toEqual(first);
  });

  it('requires explicit BRAIN_GOVERNANCE activation before selection and rejects predecessor drift', () => {
    const compiled = compileCurrent();
    expect(compiled.status).toBe('READY');
    if (compiled.status !== 'READY') throw new Error(compiled.reason);

    expect(selectExecutableMethodPackageV1([compiled.package], selectionContext).status).toBe(
      'NOT_APPLICABLE'
    );

    const activated = activateUsTrademarkMarkRepresentationMethodPackageV1(compiled.package);
    expect(activated.decision.approval.authority).toBe('BRAIN_GOVERNANCE');
    expect(activated.decision.approval.approvalTicketRef).toBe('github:yoomarks/markorbit#903');
    expect(activated.activePackage.lifecycle).toBe('ACTIVE');
    expect(activated.activePackage.packageVersion).toBe(2);
    expect(activated.activationEvidenceRef).toContain(activated.decision.decisionId);

    const selected = selectExecutableMethodPackageV1(
      [compiled.package, activated.activePackage],
      selectionContext
    );
    expect(selected.status).toBe('SELECTED');
    if (selected.status !== 'SELECTED') throw new Error(selected.status);
    expect(selected.package.packageVersion).toBe(2);

    const drifted = {
      ...compiled.package,
      executable: {
        ...compiled.package.executable,
        supportedTrademarkTypes: ['WORD']
      }
    };
    expect(() => activateUsTrademarkMarkRepresentationMethodPackageV1(drifted)).toThrow(
      'requires the exact accepted US trademark mark-representation predecessor package'
    );
  });
});
