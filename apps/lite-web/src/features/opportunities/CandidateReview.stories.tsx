import type { Meta, StoryObj } from '@storybook/react';
import type { OpportunityCandidateClient } from '../../api/opportunity-candidates.js';
import { OpportunityCandidateHttpError } from '../../api/opportunity-candidates.js';
import { CandidateReview } from './CandidateReview.js';
import {
  candidateFixture,
  fixtureCandidateClient,
  qualificationFixture
} from './candidate-review-fixtures.js';

const pendingClient: OpportunityCandidateClient = {
  list: () => new Promise(() => undefined),
  load: () => new Promise(() => undefined),
  loadQualification: () => new Promise(() => undefined)
};

const errorClient: OpportunityCandidateClient = {
  ...fixtureCandidateClient(),
  list: () =>
    Promise.reject(
      new OpportunityCandidateHttpError(503, 'PERSISTENCE_UNAVAILABLE', 'Fixture error')
    )
};

const statusClient = (status: 401 | 403 | 404): OpportunityCandidateClient => ({
  ...fixtureCandidateClient(),
  list: () => Promise.reject(new OpportunityCandidateHttpError(status, `HTTP_${status}`, 'Error'))
});

export default {
  title: 'Products/Lite/Opportunity Center/Candidate Review',
  component: CandidateReview,
  args: { workspaceId: 'workspace-story', client: fixtureCandidateClient() },
  parameters: { layout: 'fullscreen', a11y: { disable: false } }
} satisfies Meta<typeof CandidateReview>;

type Story = StoryObj<typeof CandidateReview>;

export const LoadingList: Story = { args: { client: pendingClient } };
export const EmptyWorkspace: Story = { args: { client: fixtureCandidateClient(null, []) } };
export const ListSuccess: Story = {};
export const ServiceUnavailable: Story = { args: { client: errorClient } };
export const AuthenticationRequired: Story = { args: { client: statusClient(401) } };
export const PermissionDenied: Story = { args: { client: statusClient(403) } };
export const CandidateNotFound: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: {
      ...fixtureCandidateClient(),
      load: () => Promise.reject(new OpportunityCandidateHttpError(404, 'NOT_FOUND', 'Not found'))
    }
  }
};
export const DetailLoading: Story = {
  args: { initialSelected: candidateFixture.opportunityCandidateId, client: pendingClient }
};
export const NoDecision: Story = {
  args: { initialSelected: candidateFixture.opportunityCandidateId }
};
export const QualifiedForMarkReg: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: fixtureCandidateClient(qualificationFixture('QUALIFIED_FOR_MARKREG'))
  }
};
export const Rejected: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: fixtureCandidateClient(qualificationFixture('REJECTED'))
  }
};
export const Deferred: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: fixtureCandidateClient(qualificationFixture('DEFERRED'))
  }
};
export const HistoricalReviewedVersion: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: fixtureCandidateClient(qualificationFixture('DEFERRED', 2))
  }
};
export const Mobile390: Story = {
  args: { client: fixtureCandidateClient(qualificationFixture('QUALIFIED_FOR_MARKREG')) },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
