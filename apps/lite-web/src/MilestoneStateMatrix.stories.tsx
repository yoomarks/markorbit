import type { Meta, StoryObj } from '@storybook/react';
import './lite.css';
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
export default { title: 'Milestone 001/State Matrix/Lite', component: MatrixState } satisfies Meta<
  typeof MatrixState
>;
type Story = StoryObj<typeof MatrixState>;
export const ProfessionalReviewLoading: Story = {
  args: { stage: 'Professional Review', state: 'loading' }
};
export const ProfessionalReviewReady: Story = {
  args: { stage: 'Professional Review', state: 'ready' }
};
export const ProfessionalReviewIncompleteOrBlocked: Story = {
  args: { stage: 'Professional Review', state: 'incomplete-or-blocked' }
};
export const ProfessionalReviewStale: Story = {
  args: { stage: 'Professional Review', state: 'stale' }
};
export const ProfessionalReviewWithdrawn: Story = {
  args: { stage: 'Professional Review', state: 'withdrawn' }
};
export const ProfessionalReviewRecoverableError: Story = {
  args: { stage: 'Professional Review', state: 'recoverable-error' }
};
export const ProfessionalReviewLongContent: Story = {
  args: { stage: 'Professional Review', state: 'long-content', long: true }
};
export const ProfessionalReviewMobile390: Story = {
  args: { stage: 'Professional Review', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const ExecutionReleaseLoading: Story = {
  args: { stage: 'Execution Release', state: 'loading' }
};
export const ExecutionReleaseReady: Story = {
  args: { stage: 'Execution Release', state: 'ready' }
};
export const ExecutionReleaseIncompleteOrBlocked: Story = {
  args: { stage: 'Execution Release', state: 'incomplete-or-blocked' }
};
export const ExecutionReleaseStale: Story = {
  args: { stage: 'Execution Release', state: 'stale' }
};
export const ExecutionReleaseWithdrawn: Story = {
  args: { stage: 'Execution Release', state: 'withdrawn' }
};
export const ExecutionReleaseRecoverableError: Story = {
  args: { stage: 'Execution Release', state: 'recoverable-error' }
};
export const ExecutionReleaseLongContent: Story = {
  args: { stage: 'Execution Release', state: 'long-content', long: true }
};
export const ExecutionReleaseMobile390: Story = {
  args: { stage: 'Execution Release', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
export const FilingExecutionTaskDraftLoading: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'loading' }
};
export const FilingExecutionTaskDraftReady: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'ready' }
};
export const FilingExecutionTaskDraftIncompleteOrBlocked: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'incomplete-or-blocked' }
};
export const FilingExecutionTaskDraftStale: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'stale' }
};
export const FilingExecutionTaskDraftRecoverableError: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'recoverable-error' }
};
export const FilingExecutionTaskDraftLongContent: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'long-content', long: true }
};
export const FilingExecutionTaskDraftMobile390: Story = {
  args: { stage: 'Filing Execution Task Draft', state: 'mobile-390' },
  parameters: { viewport: { defaultViewport: 'mobile390' } }
};
