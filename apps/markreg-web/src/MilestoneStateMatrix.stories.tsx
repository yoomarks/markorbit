import type { Meta, StoryObj } from '@storybook/react';
import './markreg.css';
type Props = { stage: string; state: string; long?: boolean };
const MatrixState = ({ stage, state, long }: Props) => (
  <main aria-labelledby="matrix-heading">
    <section aria-label={`${stage} governed state`}>
      <p>Milestone 1 governed workflow</p>
      <h1 id="matrix-heading">{stage}</h1>
      <p role="status">State: {state}</p>
      {long && (
        <p>
          Applicant: The International Cooperative Association for Responsible Technology, Research,
          Evidence and Sustainable Commerce; evidence: comprehensive goods and services rationale
          with supporting-document-version-00000042.pdf
        </p>
      )}
      <strong>
        Review only: this evidence does not create filing, submission, appointment, payment, Order,
        or official application authority.
      </strong>
      <p>
        <button type="button">Retry same record</button> <a href="/">Back to workspace</a>
      </p>
    </section>
  </main>
);
export default {
  title: 'Milestone 001/State Matrix/Markreg',
  component: MatrixState
} satisfies Meta<typeof MatrixState>;
type Story = StoryObj<typeof MatrixState>;
export const ConsultationLoading: Story = { args: { stage: 'Consultation', state: 'loading' } };
export const ConsultationReady: Story = { args: { stage: 'Consultation', state: 'ready' } };
export const ConsultationIncompleteOrBlocked: Story = {
  args: { stage: 'Consultation', state: 'incomplete-or-blocked' }
};
export const ConsultationRecoverableError: Story = {
  args: { stage: 'Consultation', state: 'recoverable-error' }
};
export const ConsultationLongContent: Story = {
  args: { stage: 'Consultation', state: 'long-content', long: true }
};
export const ConsultationMobile390: Story = {
  args: { stage: 'Consultation', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const RecommendationPlanLoading: Story = {
  args: { stage: 'Recommendation / Plan', state: 'loading' }
};
export const RecommendationPlanReady: Story = {
  args: { stage: 'Recommendation / Plan', state: 'ready' }
};
export const RecommendationPlanIncompleteOrBlocked: Story = {
  args: { stage: 'Recommendation / Plan', state: 'incomplete-or-blocked' }
};
export const RecommendationPlanStale: Story = {
  args: { stage: 'Recommendation / Plan', state: 'stale' }
};
export const RecommendationPlanRecoverableError: Story = {
  args: { stage: 'Recommendation / Plan', state: 'recoverable-error' }
};
export const RecommendationPlanLongContent: Story = {
  args: { stage: 'Recommendation / Plan', state: 'long-content', long: true }
};
export const RecommendationPlanMobile390: Story = {
  args: { stage: 'Recommendation / Plan', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const QuoteLoading: Story = { args: { stage: 'Quote', state: 'loading' } };
export const QuoteReady: Story = { args: { stage: 'Quote', state: 'ready' } };
export const QuoteIncompleteOrBlocked: Story = {
  args: { stage: 'Quote', state: 'incomplete-or-blocked' }
};
export const QuoteStale: Story = { args: { stage: 'Quote', state: 'stale' } };
export const QuoteWithdrawn: Story = { args: { stage: 'Quote', state: 'withdrawn' } };
export const QuoteExpired: Story = { args: { stage: 'Quote', state: 'expired' } };
export const QuoteRecoverableError: Story = {
  args: { stage: 'Quote', state: 'recoverable-error' }
};
export const QuoteLongContent: Story = {
  args: { stage: 'Quote', state: 'long-content', long: true }
};
export const QuoteMobile390: Story = {
  args: { stage: 'Quote', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const CustomerConfirmationLoading: Story = {
  args: { stage: 'Customer Confirmation', state: 'loading' }
};
export const CustomerConfirmationReady: Story = {
  args: { stage: 'Customer Confirmation', state: 'ready' }
};
export const CustomerConfirmationIncompleteOrBlocked: Story = {
  args: { stage: 'Customer Confirmation', state: 'incomplete-or-blocked' }
};
export const CustomerConfirmationStale: Story = {
  args: { stage: 'Customer Confirmation', state: 'stale' }
};
export const CustomerConfirmationWithdrawn: Story = {
  args: { stage: 'Customer Confirmation', state: 'withdrawn' }
};
export const CustomerConfirmationExpired: Story = {
  args: { stage: 'Customer Confirmation', state: 'expired' }
};
export const CustomerConfirmationRecoverableError: Story = {
  args: { stage: 'Customer Confirmation', state: 'recoverable-error' }
};
export const CustomerConfirmationLongContent: Story = {
  args: { stage: 'Customer Confirmation', state: 'long-content', long: true }
};
export const CustomerConfirmationMobile390: Story = {
  args: { stage: 'Customer Confirmation', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const MatterDraftLoading: Story = { args: { stage: 'Matter Draft', state: 'loading' } };
export const MatterDraftReady: Story = { args: { stage: 'Matter Draft', state: 'ready' } };
export const MatterDraftIncompleteOrBlocked: Story = {
  args: { stage: 'Matter Draft', state: 'incomplete-or-blocked' }
};
export const MatterDraftStale: Story = { args: { stage: 'Matter Draft', state: 'stale' } };
export const MatterDraftWithdrawn: Story = { args: { stage: 'Matter Draft', state: 'withdrawn' } };
export const MatterDraftRecoverableError: Story = {
  args: { stage: 'Matter Draft', state: 'recoverable-error' }
};
export const MatterDraftLongContent: Story = {
  args: { stage: 'Matter Draft', state: 'long-content', long: true }
};
export const MatterDraftMobile390: Story = {
  args: { stage: 'Matter Draft', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const DocumentsAndInstructionsLoading: Story = {
  args: { stage: 'Documents and Instructions', state: 'loading' }
};
export const DocumentsAndInstructionsReady: Story = {
  args: { stage: 'Documents and Instructions', state: 'ready' }
};
export const DocumentsAndInstructionsIncompleteOrBlocked: Story = {
  args: { stage: 'Documents and Instructions', state: 'incomplete-or-blocked' }
};
export const DocumentsAndInstructionsStale: Story = {
  args: { stage: 'Documents and Instructions', state: 'stale' }
};
export const DocumentsAndInstructionsWithdrawn: Story = {
  args: { stage: 'Documents and Instructions', state: 'withdrawn' }
};
export const DocumentsAndInstructionsRecoverableError: Story = {
  args: { stage: 'Documents and Instructions', state: 'recoverable-error' }
};
export const DocumentsAndInstructionsLongContent: Story = {
  args: { stage: 'Documents and Instructions', state: 'long-content', long: true }
};
export const DocumentsAndInstructionsMobile390: Story = {
  args: { stage: 'Documents and Instructions', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const PreparationLockLoading: Story = {
  args: { stage: 'Preparation Lock', state: 'loading' }
};
export const PreparationLockReady: Story = { args: { stage: 'Preparation Lock', state: 'ready' } };
export const PreparationLockIncompleteOrBlocked: Story = {
  args: { stage: 'Preparation Lock', state: 'incomplete-or-blocked' }
};
export const PreparationLockStale: Story = { args: { stage: 'Preparation Lock', state: 'stale' } };
export const PreparationLockRecoverableError: Story = {
  args: { stage: 'Preparation Lock', state: 'recoverable-error' }
};
export const PreparationLockLongContent: Story = {
  args: { stage: 'Preparation Lock', state: 'long-content', long: true }
};
export const PreparationLockMobile390: Story = {
  args: { stage: 'Preparation Lock', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const FilingAuthorizationLoading: Story = {
  args: { stage: 'Filing Authorization', state: 'loading' }
};
export const FilingAuthorizationReady: Story = {
  args: { stage: 'Filing Authorization', state: 'ready' }
};
export const FilingAuthorizationIncompleteOrBlocked: Story = {
  args: { stage: 'Filing Authorization', state: 'incomplete-or-blocked' }
};
export const FilingAuthorizationStale: Story = {
  args: { stage: 'Filing Authorization', state: 'stale' }
};
export const FilingAuthorizationWithdrawn: Story = {
  args: { stage: 'Filing Authorization', state: 'withdrawn' }
};
export const FilingAuthorizationExpired: Story = {
  args: { stage: 'Filing Authorization', state: 'expired' }
};
export const FilingAuthorizationRecoverableError: Story = {
  args: { stage: 'Filing Authorization', state: 'recoverable-error' }
};
export const FilingAuthorizationLongContent: Story = {
  args: { stage: 'Filing Authorization', state: 'long-content', long: true }
};
export const FilingAuthorizationMobile390: Story = {
  args: { stage: 'Filing Authorization', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
