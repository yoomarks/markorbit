import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import type {
  OpportunityCandidate,
  OpportunityQualificationDecision
} from '@markorbit/contracts/product-loop';
import type { OpportunityCandidateClient } from '../api/opportunity-candidates.js';
import { OpportunityCandidateHttpError } from '../api/opportunity-candidates.js';
import { CandidateReview } from '../features/opportunities/CandidateReview.js';
import {
  candidateFixture,
  dispositionedCandidateFixture,
  fixtureCandidateClient,
  qualificationFixture
} from '../features/opportunities/candidate-review-fixtures.js';
import '../lite.css';
import './opportunity-center-preview.css';

type PreviewScenario =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'partial'
  | 'unauthorized'
  | 'permission'
  | 'error'
  | 'detail-error'
  | 'conflict';

const scenarios = new Set<PreviewScenario>([
  'ready',
  'loading',
  'empty',
  'partial',
  'unauthorized',
  'permission',
  'error',
  'detail-error',
  'conflict'
]);
const parameters = new URL(window.location.href).searchParams;
const requestedScenario = parameters.get('scenario')?.toLowerCase();
const scenario = scenarios.has(requestedScenario as PreviewScenario)
  ? (requestedScenario as PreviewScenario)
  : 'ready';
const openDetail =
  parameters.get('view') === 'detail' || scenario === 'detail-error' || scenario === 'conflict';

function interactiveClient(): OpportunityCandidateClient {
  let candidate: OpportunityCandidate = candidateFixture;
  let decision: OpportunityQualificationDecision | null = null;
  return {
    list: () => Promise.resolve({ items: [candidate], nextCursor: null }),
    load: () => Promise.resolve(candidate),
    loadQualification: () => Promise.resolve(decision),
    qualify: (_candidateId, input) => {
      decision = {
        ...qualificationFixture(input.outcome, input.candidateVersion),
        expectedCandidateFingerprintSha256: input.expectedCandidateFingerprintSha256,
        rationale: input.rationale
      };
      candidate = dispositionedCandidateFixture;
      return Promise.resolve({ decision, currentCandidate: candidate });
    }
  };
}

function failedListClient(status: number): OpportunityCandidateClient {
  return {
    ...interactiveClient(),
    list: () =>
      Promise.reject(
        new OpportunityCandidateHttpError(
          status,
          status === 401 ? 'AUTHENTICATION_REQUIRED' : 'PERMISSION_DENIED',
          'Fixture access boundary'
        )
      )
  };
}

function recoverableClient(): OpportunityCandidateClient {
  const client = interactiveClient();
  let failed = true;
  return {
    ...client,
    list: () => {
      if (!failed) return client.list();
      failed = false;
      return Promise.reject(
        new OpportunityCandidateHttpError(
          503,
          'PREVIEW_OWNER_UNAVAILABLE',
          'Fixture owner unavailable',
          true
        )
      );
    }
  };
}

function clientForScenario(): OpportunityCandidateClient {
  if (scenario === 'loading') {
    return {
      ...interactiveClient(),
      list: () => new Promise(() => undefined)
    };
  }
  if (scenario === 'empty') return fixtureCandidateClient(null, []);
  if (scenario === 'unauthorized') return failedListClient(401);
  if (scenario === 'permission') return failedListClient(403);
  if (scenario === 'error') return recoverableClient();
  if (scenario === 'partial') {
    const client = interactiveClient();
    return {
      ...client,
      list: (input) =>
        input?.cursor
          ? Promise.reject(
              new OpportunityCandidateHttpError(
                503,
                'NEXT_PAGE_UNAVAILABLE',
                'Fixture next page unavailable',
                true
              )
            )
          : Promise.resolve({
              items: [candidateFixture],
              nextCursor: candidateFixture.opportunityCandidateId
            })
    };
  }
  if (scenario === 'detail-error') {
    return {
      ...interactiveClient(),
      load: () =>
        Promise.reject(
          new OpportunityCandidateHttpError(
            503,
            'DETAIL_UNAVAILABLE',
            'Fixture detail unavailable',
            true
          )
        )
    };
  }
  if (scenario === 'conflict') {
    return {
      ...interactiveClient(),
      qualify: () =>
        Promise.reject(
          new OpportunityCandidateHttpError(
            409,
            'CANDIDATE_VERSION_CONFLICT',
            'Fixture Candidate changed after review.'
          )
        )
    };
  }
  return interactiveClient();
}

const root = document.getElementById('root');

if (!root) throw new Error('Opportunity Center preview root was not found.');

createRoot(root).render(
  <main className="opportunity-center-preview lite-workspace">
    <Alert tone="info" title="Preview fixture · Human qualification only">
      Candidate evidence and decisions stay in this deterministic browser session. Qualification
      does not contact a customer, create a Formal Opportunity, Intake, Order, Matter, Payment or
      Filing, or establish Official Truth.
    </Alert>
    <CandidateReview
      workspaceId={candidateFixture.workspaceId}
      client={clientForScenario()}
      {...(openDetail ? { initialSelected: candidateFixture.opportunityCandidateId } : {})}
    />
  </main>
);
