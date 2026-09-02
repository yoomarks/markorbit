import type { Meta, StoryObj } from '@storybook/react';
import type { OpportunityCandidateClient } from '../../api/opportunity-candidates.js';
import { OpportunityCandidateHttpError } from '../../api/opportunity-candidates.js';
import { CandidateReview } from './CandidateReview.js';
import {
  candidateFixture,
  dispositionedCandidateFixture,
  fixtureCandidateClient,
  qualificationFixture
} from './candidate-review-fixtures.js';

const pendingClient: OpportunityCandidateClient = {
  list: () => new Promise(() => undefined),
  load: () => new Promise(() => undefined),
  loadQualification: () => new Promise(() => undefined),
  qualify: () => new Promise(() => undefined)
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
export const DispositionedWithoutDecision: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: {
      ...fixtureCandidateClient(),
      load: () => Promise.resolve(dispositionedCandidateFixture)
    }
  }
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
const submitDeferredQualification = async (canvasElement: HTMLElement) => {
  const radio = canvasElement.querySelector<HTMLInputElement>('input[value="DEFERRED"]');
  const textarea = canvasElement.querySelector<HTMLTextAreaElement>('textarea');
  radio?.click();
  if (textarea) {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set?.call(
      textarea,
      'Fixture rationale preserved for visual review.'
    );
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
  canvasElement.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
};
export const QualificationConflict: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: {
      ...fixtureCandidateClient(),
      qualify: () =>
        Promise.reject(
          new OpportunityCandidateHttpError(409, 'CANDIDATE_VERSION_CONFLICT', 'Stale Candidate')
        )
    }
  },
  play: async ({ canvasElement }) => submitDeferredQualification(canvasElement)
};
export const InvalidQualification: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: {
      ...fixtureCandidateClient(),
      qualify: () =>
        Promise.reject(
          new OpportunityCandidateHttpError(422, 'INVALID_RATIONALE', 'Invalid rationale')
        )
    }
  },
  play: async ({ canvasElement }) => submitDeferredQualification(canvasElement)
};
export const QualificationUnavailable: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: {
      ...fixtureCandidateClient(),
      qualify: () =>
        Promise.reject(
          new OpportunityCandidateHttpError(503, 'DOWNSTREAM_UNAVAILABLE', 'Unavailable', true)
        )
    }
  },
  play: async ({ canvasElement }) => submitDeferredQualification(canvasElement)
};
export const Mobile390: Story = {
  args: {
    initialSelected: candidateFixture.opportunityCandidateId,
    client: fixtureCandidateClient()
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
