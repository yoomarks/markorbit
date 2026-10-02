import { createRoot } from 'react-dom/client';
import { Alert } from '@markorbit/ui';
import '@markorbit/ui/styles.css';
import type { ContentStudioClient } from '../api/content-studio.js';
import { ContentStudioHttpError } from '../api/content-studio.js';
import { ContentStudio } from '../features/content-studio/ContentStudio.js';
import {
  detailFixture,
  draft,
  feedback as fixtureFeedback,
  fixtureClient,
  fixtureWorkspaceId,
  listFixture,
  opportunity,
  publishPackage as fixturePackage,
  review as fixtureReview,
  summaryFixture
} from '../features/content-studio/fixtures.js';
import '../lite.css';
import './content-studio-preview.css';

type PreviewScenario =
  'ready' | 'loading' | 'empty' | 'partial' | 'unauthorized' | 'permission' | 'error';

const scenarios = new Set<PreviewScenario>([
  'ready',
  'loading',
  'empty',
  'partial',
  'unauthorized',
  'permission',
  'error'
]);
const parameters = new URL(window.location.href).searchParams;
const requestedScenario = parameters.get('scenario')?.toLowerCase();
const scenario = scenarios.has(requestedScenario as PreviewScenario)
  ? (requestedScenario as PreviewScenario)
  : 'ready';
const openDetail = parameters.get('view') === 'detail';

function interactivePreviewClient(partial: boolean): ContentStudioClient {
  const currentDraft = { ...draft, status: 'READY_FOR_HUMAN_REVIEW' as const };
  const list = listFixture(
    [
      summaryFixture({
        latestDraft: {
          contentDraftId: currentDraft.contentDraftId,
          version: currentDraft.version,
          status: currentDraft.status,
          title: currentDraft.title,
          updatedAt: currentDraft.updatedAt
        },
        latestDraftReview: null,
        latestPublishPackage: null,
        latestPackageFeedback: null
      })
    ],
    null,
    {
      partial,
      warnings: partial ? ['VISUAL_HISTORY_NOT_DISCOVERABLE'] : []
    }
  );
  let detail = detailFixture({
    drafts: [currentDraft],
    reviewedDrafts: [],
    reviews: [],
    packages: [],
    feedback: [],
    partial,
    warnings: partial ? ['VISUAL_HISTORY_NOT_DISCOVERABLE'] : []
  });
  const client = fixtureClient(list, detail);

  return {
    ...client,
    list: () => Promise.resolve(list),
    find: () => Promise.resolve(detail),
    recordReview(target, input) {
      const decision = {
        ...fixtureReview,
        contentDraft: { id: target.contentDraftId, version: target.version },
        expectedContentDraftFingerprintSha256: target.contentDraftFingerprintSha256,
        ...input
      };
      detail = { ...detail, reviewedDrafts: [target], reviews: [decision] };
      return Promise.resolve(decision);
    },
    preparePublishPackage(target, decision) {
      const publishPackage = {
        ...fixturePackage,
        contentDraft: { id: target.contentDraftId, version: target.version },
        reviewDecision: {
          id: decision.contentReviewDecisionId,
          version: decision.version
        }
      };
      detail = { ...detail, publishPackages: [publishPackage] };
      return Promise.resolve(publishPackage);
    },
    recordUseFeedback(target, outcome) {
      const feedback = {
        ...fixtureFeedback,
        publishPackage: { id: target.publishPackageId, version: target.version },
        outcome
      };
      detail = { ...detail, feedback: [feedback] };
      return Promise.resolve(feedback);
    }
  };
}

function failedClient(status: number): ContentStudioClient {
  return {
    ...interactivePreviewClient(false),
    list: () =>
      Promise.reject(new ContentStudioHttpError(status, 'PREVIEW_OWNER_ERROR', 'Fixture failure'))
  };
}

function recoverableClient(): ContentStudioClient {
  const client = interactivePreviewClient(false);
  let failed = true;
  return {
    ...client,
    list: () => {
      if (!failed) return client.list();
      failed = false;
      return Promise.reject(
        new ContentStudioHttpError(503, 'PREVIEW_OWNER_UNAVAILABLE', 'Fixture owner unavailable')
      );
    }
  };
}

function clientForScenario(): ContentStudioClient {
  if (scenario === 'loading') {
    return {
      ...interactivePreviewClient(false),
      list: () => new Promise(() => undefined)
    };
  }
  if (scenario === 'empty') {
    return fixtureClient(listFixture([], null, { partial: false, warnings: [] }));
  }
  if (scenario === 'unauthorized') return failedClient(401);
  if (scenario === 'permission') return failedClient(403);
  if (scenario === 'error') return recoverableClient();
  return interactivePreviewClient(scenario === 'partial');
}

const client = clientForScenario();
const root = document.getElementById('root');

if (!root) throw new Error('Content Studio preview root was not found.');

createRoot(root).render(
  <main className="content-studio-preview lite-workspace">
    <Alert tone="info" title="Preview fixture · Governed content work only">
      Records and state changes stay in this deterministic browser session. They do not publish
      externally, spend money, establish Official Truth, or change production owner data.
    </Alert>
    <ContentStudio
      workspaceId={fixtureWorkspaceId}
      client={client}
      {...(openDetail ? { initialContentOpportunityId: opportunity.contentOpportunityId } : {})}
    />
  </main>
);
