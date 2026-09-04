import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarkregApp } from '../src/App.js';
import type {
  IntakeCreateCommand,
  IntakeRecommendationResponse,
  ProfessionalReviewCase,
  DocumentPackage,
  CustomerInstructionLedger,
  PreparationLock
} from '@markorbit/contracts';
import type { MarkregClient } from '../src/api/markreg.js';
import { MarkregApiError } from '../src/api/errors.js';

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
});

async function completeIntake() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Start consultation' }));
  await user.selectOptions(screen.getByLabelText('Applicant type'), 'Company');
  fireEvent.change(screen.getByLabelText('Applicant name'), {
    target: { value: 'Northstar Ltd' }
  });
  await user.selectOptions(screen.getByLabelText('Applicant country'), 'GB');
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.selectOptions(screen.getByLabelText('Trademark type'), 'Word mark');
  fireEvent.change(screen.getByLabelText('Trademark text'), {
    target: { value: 'Northstar' }
  });
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await user.selectOptions(screen.getByLabelText(/Target countries/), ['US', 'EU']);
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(screen.getByLabelText('Goods / services summary'), {
    target: { value: 'Software services' }
  });
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.change(screen.getByLabelText('Business context'), {
    target: { value: 'Launching internationally' }
  });
  fireEvent.change(screen.getByLabelText('Filing goal'), {
    target: { value: 'Plan market coverage' }
  });
  await user.click(screen.getByRole('button', { name: 'Continue' }));
  return user;
}
const response = (command: IntakeCreateCommand): IntakeRecommendationResponse => ({
  intake: {
    intakeId: 'intake_test',
    channel: command.channel,
    relationshipModel: command.relationshipModel,
    status: 'RECOMMENDATION_READY',
    customerIntent: command.customerIntent,
    createdAt: '2026-07-27T00:00:00Z',
    correlationId: command.correlationId
  },
  recommendation: {
    recommendationId: 'recommendation_test',
    intakeId: 'intake_test',
    status: 'FIXTURE_ONLY',
    options: [
      { tier: 'A', name: 'Essential Protection', description: 'Focused.' },
      { tier: 'B', name: 'Recommended Protection', description: 'Balanced.' },
      { tier: 'C', name: 'Extended Protection', description: 'Broad.' }
    ],
    rationale: 'Fixture rationale',
    assumptions: ['Applicant details are accurate.'],
    limitations: ['No clearance search.'],
    provenance: ['execution_test'],
    generatedAt: '2026-07-27T00:00:00Z'
  },
  trace: {
    correlationId: command.correlationId,
    capabilityRequestId: 'capability_private',
    executionId: 'execution_private',
    provenanceRefs: ['execution_private']
  }
});

describe('guided intake', () => {
  it('enters the Gateway-backed Documents and Instructions journey and reaches its lock receipt', async () => {
    const at = '2026-07-29T12:00:00.000Z';
    const review = {
      schemaVersion: 1,
      reviewCaseId: 'professional-review_app',
      source: {
        schemaVersion: 1,
        matterDraftId: 'matter-draft_app',
        matterDraftVersion: 'matter-v7',
        confirmationId: 'confirmation_app',
        customerId: 'customer_app',
        status: 'READY_FOR_PROFESSIONAL_REVIEW',
        preparation: {
          classes: [9],
          documentReferences: [],
          goodsServices: 'Long governed software scope',
          targetJurisdiction: 'US',
          trademark: 'ORBIT'
        },
        readiness: { evaluatedAt: at, checks: [], readyForProfessionalReview: true },
        readinessTimestamp: at
      },
      status: 'REVIEWED_READY_FOR_NEXT_STEP',
      priority: 'NORMAL',
      requestedBy: 'customer_app',
      createdAt: at,
      updatedAt: at,
      assignment: { status: 'CLAIMED', professionalAppointed: false },
      checklist: [],
      evidence: [],
      decision: {
        code: 'MARK_READY_FOR_NEXT_STEP',
        reviewerId: 'reviewer_app',
        decidedAt: 'decision-v3',
        rationale: 'Ready',
        checklistSnapshot: [],
        evidenceReferences: [],
        sourceMatterDraftVersion: 'matter-v7',
        consequences: {
          orderCreated: false,
          paymentCreated: false,
          formalMatterCreated: false,
          providerAppointed: false,
          filingCreated: false,
          customerMessageSent: false
        }
      }
    } satisfies ProfessionalReviewCase;
    const requirement = {
      code: 'APPLICANT_IDENTITY_EVIDENCE',
      name: 'Applicant identity evidence',
      reason: 'Illustrative only',
      source: 'FIXTURE',
      blocking: true,
      fixtureOnly: true
    } as const;
    const basePackage = {
      schemaVersion: 1,
      documentPackageId: 'document-package_app',
      version: 1,
      professionalReviewCaseId: review.reviewCaseId,
      professionalReviewDecisionVersion: 'decision-v3',
      matterDraftId: review.source.matterDraftId,
      matterDraftVersion: 'matter-v7',
      customerConfirmationId: review.source.confirmationId,
      customerId: review.source.customerId,
      jurisdiction: 'US',
      trademarkReference: 'ORBIT',
      requirements: [requirement],
      documentItems: [],
      validationChecks: [],
      missingRequirements: [requirement.code],
      status: 'NEEDS_DOCUMENTS',
      createdAt: at,
      updatedAt: at
    } satisfies DocumentPackage;
    const item = {
      documentItemId: 'document-item_app',
      documentPackageId: basePackage.documentPackageId,
      documentType: requirement.code,
      requirementCode: requirement.code,
      version: 1,
      status: 'PROVIDED',
      documentReference: {
        fileName: 'identity.pdf',
        contentType: 'application/pdf',
        byteSize: 1,
        checksum: 'sha256:x',
        uploadedAt: at,
        uploadedBy: review.source.customerId,
        source: 'FIXTURE',
        originalOrCopy: 'COPY'
      },
      suppliedBy: review.source.customerId,
      suppliedAt: at,
      validationChecks: [],
      createdAt: at,
      updatedAt: at
    } as const;
    const supplied = {
      ...basePackage,
      version: 2,
      documentItems: [item],
      missingRequirements: []
    } satisfies DocumentPackage;
    const unknown = {
      ...supplied,
      version: 3,
      validationChecks: [
        {
          code: 'LANGUAGE_IDENTIFIED',
          status: 'UNKNOWN',
          blocking: true,
          explanation: 'Unknown',
          checkedAt: at,
          source: 'FIXTURE'
        }
      ]
    } satisfies DocumentPackage;
    const ready = {
      ...supplied,
      version: 4,
      status: 'READY_FOR_CUSTOMER_CONFIRMATION',
      validationChecks: [
        {
          code: 'LANGUAGE_IDENTIFIED',
          status: 'PASS',
          blocking: true,
          explanation: 'Pass',
          checkedAt: at,
          source: 'FIXTURE'
        }
      ]
    } satisfies DocumentPackage;
    const ledger = {
      schemaVersion: 1,
      instructionLedgerId: 'instruction-ledger_app',
      version: 1,
      documentPackageId: ready.documentPackageId,
      documentPackageVersion: ready.version,
      customerId: ready.customerId,
      matterDraftId: ready.matterDraftId,
      matterDraftVersion: ready.matterDraftVersion,
      professionalReviewCaseId: ready.professionalReviewCaseId,
      professionalReviewDecisionVersion: ready.professionalReviewDecisionVersion,
      entries: [],
      acknowledgements: [],
      status: 'DRAFT',
      currentEffectiveInstructionSet: {},
      createdAt: at,
      updatedAt: at
    } satisfies CustomerInstructionLedger;
    const entry = {
      instructionEntryId: 'instruction-entry_app',
      type: 'DOCUMENT_USE_AUTHORIZATION',
      structuredValue: { authorized: true },
      status: 'CONFIRMED',
      createdAt: at,
      confirmedAt: at,
      evidence: []
    } as const;
    const confirmed = {
      ...ledger,
      version: 3,
      entries: [entry],
      status: 'CONFIRMED',
      confirmedAt: at
    } satisfies CustomerInstructionLedger;
    const lock = {
      schemaVersion: 1,
      preparationLockId: 'preparation-lock_app',
      documentPackageId: ready.documentPackageId,
      documentPackageVersion: 5,
      instructionLedgerId: ledger.instructionLedgerId,
      instructionLedgerVersion: 4,
      lockedAt: at,
      snapshot: {
        documentPackage: { ...ready, status: 'LOCKED_FOR_PREPARATION', lockedAt: at },
        instructionLedger: { ...confirmed, status: 'LOCKED_FOR_PREPARATION', lockedAt: at },
        sourceReviewDecisionVersion: 'decision-v3',
        sourceMatterDraftVersion: 'matter-v7',
        commercialScopeUnchanged: true
      },
      nextPermittedAction: 'GOVERNED_FILING_AUTHORITY_REVIEW',
      consequences: {
        orderCreated: false,
        paymentCreated: false,
        formalMatterCreated: false,
        professionalAppointed: false,
        filingCreated: false,
        filingSubmitted: false,
        customerMessageSent: false,
        externalDocumentSent: false,
        trademarkOfficeContacted: false
      }
    } satisfies PreparationLock;
    const client = {
      createIntake: vi.fn(),
      getProfessionalReview: vi.fn().mockResolvedValue({ reviewCase: review }),
      createDocumentPackage: vi.fn().mockResolvedValue(basePackage),
      addDocument: vi.fn().mockResolvedValue(item),
      getDocumentPackage: vi.fn().mockResolvedValue(supplied),
      evaluateDocumentPackage: vi.fn().mockResolvedValueOnce(unknown).mockResolvedValueOnce(ready),
      updateDocument: vi.fn().mockResolvedValue(item),
      createInstructionLedger: vi.fn().mockResolvedValue(ledger),
      appendInstruction: vi.fn().mockResolvedValue(entry),
      confirmInstruction: vi.fn().mockResolvedValue({ ...ledger, entries: [entry] }),
      confirmInstructionLedger: vi.fn().mockResolvedValue({ instructionLedger: confirmed }),
      createPreparationLock: vi.fn().mockResolvedValue(lock)
    } satisfies MarkregClient;
    window.history.replaceState({}, '', '/?professionalReviewCaseId=professional-review_app');
    const user = userEvent.setup();
    render(<MarkregApp client={client} />);
    expect(await screen.findByText('decision-v3')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Open Documents and Instructions' }));
    expect(
      await screen.findByRole('heading', { name: 'Documents and Instructions' })
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Create Document Package' }));
    expect(client.createDocumentPackage).toHaveBeenCalled();
    await user.click(
      await screen.findByRole('button', { name: 'Record fixture document metadata' })
    );
    await user.click(await screen.findByRole('button', { name: 'Evaluate documents' }));
    expect(await screen.findByText(/UNKNOWN — blocking/)).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Complete required metadata and reevaluate' })
    );
    await user.click(await screen.findByRole('button', { name: 'Review customer instructions' }));
    for (const checkbox of screen.getAllByRole('checkbox')) await user.click(checkbox);
    await user.click(screen.getByRole('button', { name: 'Confirm customer instructions' }));
    await user.click(await screen.findByRole('button', { name: 'Lock package for preparation' }));
    expect(
      await screen.findByRole('heading', { name: 'Locked for preparation — not submitted' })
    ).toBeVisible();
    expect(client.createPreparationLock).toHaveBeenCalled();
  });
  it('validates required fields and preserves answers when moving back', async () => {
    const user = userEvent.setup();
    render(<MarkregApp />);
    await user.click(screen.getByRole('button', { name: 'Start consultation' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getAllByText(/This information is required/)).toHaveLength(3);
    await user.selectOptions(screen.getByLabelText('Applicant type'), 'Company');
    await user.type(screen.getByLabelText('Applicant name'), 'Northstar Ltd');
    await user.selectOptions(screen.getByLabelText('Applicant country'), 'GB');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByLabelText('Applicant name')).toHaveValue('Northstar Ltd');
  });

  it('has no serious accessibility violations on the start page', async () => {
    const { container } = render(<MarkregApp />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it('restores a session draft without using localStorage', () => {
    sessionStorage.setItem(
      'markreg-guided-intake-v1',
      JSON.stringify({
        applicantType: 'Company',
        applicantName: 'Saved applicant',
        applicantCountry: 'GB',
        trademarkType: '',
        trademarkText: '',
        targetCountries: [],
        goodsServicesSummary: '',
        businessContext: '',
        filingGoal: ''
      })
    );
    const local = vi.spyOn(window.localStorage, 'setItem');
    render(<MarkregApp />);
    expect(screen.getByLabelText('Applicant name')).toHaveValue('Saved applicant');
    expect(local).not.toHaveBeenCalled();
  });

  it('coalesces duplicate submit clicks and renders fixture output without trace', async () => {
    let resolve!: (value: IntakeRecommendationResponse) => void;
    const commands: IntakeCreateCommand[] = [];
    const client: MarkregClient = {
      createIntake(command) {
        commands.push(command);
        return new Promise((done) => {
          resolve = done;
        });
      }
    };
    render(<MarkregApp client={client} />);
    await completeIntake();
    const submit = screen.getByRole('button', { name: 'Submit intake' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(commands).toHaveLength(1);
    resolve(response(commands[0]!));
    await screen.findByRole('heading', { name: 'Compare your protection options' });
    expect(screen.getAllByText(/FIXTURE_ONLY|Fixture only/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/not legal advice/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Applicant details are accurate.')).toHaveLength(3);
    expect(screen.getAllByText('No clearance search.')).toHaveLength(3);
    expect(screen.queryByText(/capability_private|execution_private/)).not.toBeInTheDocument();
  });

  it('reuses a key for retry and creates a new key after an edit', async () => {
    const commands: IntakeCreateCommand[] = [];
    let attempt = 0;
    const client: MarkregClient = {
      createIntake(command) {
        commands.push(command);
        attempt++;
        return attempt < 3
          ? Promise.reject(new MarkregApiError('recoverable', 'Temporary safe error.'))
          : Promise.resolve(response(command));
      }
    };
    render(<MarkregApp client={client} />);
    const user = await completeIntake();
    await user.click(screen.getByRole('button', { name: 'Submit intake' }));
    await screen.findByText('Your answers are safe');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Your answers are safe');
    expect(commands[1]!.idempotencyKey).toBe(commands[0]!.idempotencyKey);
    expect(commands[1]!.correlationId).toBe(commands[0]!.correlationId);
    await user.click(screen.getByRole('button', { name: 'Review information' }));
    await user.click(screen.getByRole('button', { name: 'Edit Trademark' }));
    fireEvent.change(screen.getByLabelText('Trademark text'), {
      target: { value: 'Northstar Updated' }
    });
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Submit intake' }));
    await waitFor(() => expect(commands).toHaveLength(3));
    expect(commands[2]!.idempotencyKey).not.toBe(commands[0]!.idempotencyKey);
    expect(commands[2]!.correlationId).not.toBe(commands[0]!.correlationId);
  });
});
