import fs from 'node:fs';

function replaceExact(path, from, to) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(from)) throw new Error(`${path}: expected patch anchor not found`);
  fs.writeFileSync(path, source.replace(from, to));
}

const today = 'apps/lite-web/src/features/today/TodayWorkspace.tsx';
replaceExact(
  today,
  `  PreparedActionJourney,\n  ProductLoopUseFeedback,\n  TodayRecommendation`,
  `  PreparedActionJourney,\n  ProductLoopFeedbackOutcome,\n  ProductLoopUseFeedback,\n  PublishPackage,\n  TodayRecommendation`
);
replaceExact(
  today,
  `function FeedbackEvidence({`,
  `function PendingFeedback({\n  packages,\n  busyPackageId,\n  onRecord\n}: {\n  packages: ReadonlyArray<Readonly<PublishPackage>>;\n  busyPackageId: string;\n  onRecord: (publishPackage: Readonly<PublishPackage>, outcome: ProductLoopFeedbackOutcome) => void;\n}) {\n  if (!packages.length) return null;\n  return (\n    <Card>\n      <div className="lite-row">\n        <div>\n          <h2>Outcome feedback needed</h2>\n          <p className="today-muted">\n            Reviewed PublishPackages waiting for your after-the-fact usage report.\n          </p>\n        </div>\n        <Badge>{packages.length}</Badge>\n      </div>\n      <Alert tone="warning" title="Reporting does not publish anything">\n        Choose only what already happened outside MarkOrbit. This records your report; it does not\n        execute an external action or independently verify the result.\n      </Alert>\n      <ul className="today-feedback-pending-list">\n        {packages.map((publishPackage) => {\n          const busy = busyPackageId === publishPackage.publishPackageId;\n          return (\n            <li key={publishPackage.publishPackageId}>\n              <div>\n                <strong>{publishPackage.title}</strong>\n                <span className="today-muted">\n                  {publishPackage.publishPackageId} · v{publishPackage.version}\n                </span>\n              </div>\n              <div\n                className="today-feedback-actions"\n                aria-label={\`Report outcome for \${publishPackage.title}\`}\n              >\n                <Button\n                  variant="secondary"\n                  disabled={Boolean(busyPackageId)}\n                  onClick={() => onRecord(publishPackage, 'USER_REPORTED_PUBLISHED')}\n                >\n                  {busy ? 'Saving…' : 'Published'}\n                </Button>\n                <Button\n                  variant="secondary"\n                  disabled={Boolean(busyPackageId)}\n                  onClick={() => onRecord(publishPackage, 'USER_REPORTED_DELIVERED')}\n                >\n                  Delivered\n                </Button>\n                <Button\n                  variant="secondary"\n                  disabled={Boolean(busyPackageId)}\n                  onClick={() => onRecord(publishPackage, 'USER_REPORTED_USED')}\n                >\n                  Used\n                </Button>\n                <Button\n                  variant="secondary"\n                  disabled={Boolean(busyPackageId)}\n                  onClick={() => onRecord(publishPackage, 'NOT_USED')}\n                >\n                  Not used\n                </Button>\n              </div>\n            </li>\n          );\n        })}\n      </ul>\n    </Card>\n  );\n}\n\nfunction FeedbackEvidence({`
);
replaceExact(
  today,
  `  const [busy, setBusy] = useState<'prepare' | 'confirm' | ''>('');\n  const [selection, setCurrentSelection] = useState(querySelection);`,
  `  const [busy, setBusy] = useState<'prepare' | 'confirm' | ''>('');\n  const [feedbackBusyPackageId, setFeedbackBusyPackageId] = useState('');\n  const [selection, setCurrentSelection] = useState(querySelection);`
);
replaceExact(
  today,
  `  if (!snapshot && !error) return <LoadingState label="Loading real Workspace recommendations" />;`,
  `  const recordFeedback = async (\n    publishPackage: Readonly<PublishPackage>,\n    outcome: ProductLoopFeedbackOutcome\n  ) => {\n    setFeedbackBusyPackageId(publishPackage.publishPackageId);\n    setError(undefined);\n    try {\n      await client.recordUseFeedback(publishPackage, outcome);\n      await reload();\n    } catch (cause) {\n      setError(\n        cause instanceof TodayHttpError\n          ? cause\n          : new TodayHttpError(\n              503,\n              'FEEDBACK_RECORD_FAILED',\n              'Outcome feedback could not be saved.'\n            )\n      );\n    } finally {\n      setFeedbackBusyPackageId('');\n    }\n  };\n\n  if (!snapshot && !error) return <LoadingState label="Loading real Workspace recommendations" />;`
);
replaceExact(
  today,
  `      <FeedbackEvidence feedback={snapshot.recentFeedback} />`,
  `      <div className="today-feedback-stack">\n        <PendingFeedback\n          packages={snapshot.feedbackPendingPackages}\n          busyPackageId={feedbackBusyPackageId}\n          onRecord={(publishPackage, outcome) => void recordFeedback(publishPackage, outcome)}\n        />\n        <FeedbackEvidence feedback={snapshot.recentFeedback} />\n      </div>`
);

const stories = 'apps/lite-web/src/features/today/TodayWorkspace.stories.tsx';
replaceExact(
  stories,
  `  ProductLoopUseFeedback,\n  TodayRecommendation`,
  `  ProductLoopUseFeedback,\n  PublishPackage,\n  TodayRecommendation`
);
replaceExact(
  stories,
  `const feedback: ProductLoopUseFeedback = {`,
  `const publishPackage: PublishPackage = {\n  schemaVersion: 1,\n  publishPackageId: 'publish-package_story',\n  workspaceId,\n  version: 1,\n  contentDraft: { id: 'content-draft_story', version: 2 },\n  contentDraftFingerprintSha256: 'e'.repeat(64),\n  reviewDecision: { id: 'content-review-decision_story', version: 1 },\n  title: 'US renewal window explainer',\n  body: 'Reviewed content ready for manual external use.',\n  publishPackageFingerprintSha256: 'd'.repeat(64),\n  status: 'PREPARED',\n  externalPublishExecuted: false,\n  createdAt: '2026-08-11T08:13:00.000Z'\n};\nconst feedback: ProductLoopUseFeedback = {`
);
replaceExact(
  stories,
  `  recentFeedback: ProductLoopUseFeedback[] = []\n): TodayProductLoopSnapshot {`,
  `  recentFeedback: ProductLoopUseFeedback[] = [],\n  feedbackPendingPackages: PublishPackage[] = []\n): TodayProductLoopSnapshot {`
);
replaceExact(
  stories,
  `    recentFeedback\n  };`,
  `    recentFeedback,\n    feedbackPendingPackages\n  };`
);
replaceExact(
  stories,
  `    confirm: () => Promise.resolve(completed)\n  };`,
  `    confirm: () => Promise.resolve(completed),\n    recordUseFeedback: (_publishPackage, outcome) =>\n      Promise.resolve({ ...feedback, outcome })\n  };`
);
replaceExact(
  stories,
  `export const FeedbackReturnedToToday: Story = {\n  args: { workspaceId, client: clientFor(snapshot([completed], false, [feedback])) }\n};`,
  `export const FeedbackNeeded: Story = {\n  args: { workspaceId, client: clientFor(snapshot([completed], false, [], [publishPackage])) }\n};\nexport const FeedbackReturnedToToday: Story = {\n  args: { workspaceId, client: clientFor(snapshot([completed], false, [feedback])) }\n};`
);
replaceExact(
  stories,
  `  args: { workspaceId, client: clientFor(snapshot([prepared], false, [feedback])) },`,
  `  args: {\n    workspaceId,\n    client: clientFor(snapshot([prepared], false, [feedback], [publishPackage]))\n  },`
);

const css = 'apps/lite-web/src/features/today/today.css';
replaceExact(
  css,
  `.today-feedback-list {\n  margin-top: var(--mo-space-lg);\n}`,
  `.today-feedback-stack {\n  display: grid;\n  gap: var(--mo-space-lg);\n  margin-top: var(--mo-space-xl);\n}\n.today-feedback-list,\n.today-feedback-pending-list {\n  margin-top: var(--mo-space-lg);\n}\n.today-feedback-pending-list {\n  display: grid;\n  gap: var(--mo-space-md);\n  padding: 0;\n  list-style: none;\n}\n.today-feedback-pending-list li {\n  display: grid;\n  gap: var(--mo-space-md);\n  padding-block: var(--mo-space-md);\n  border-bottom: 1px solid var(--mo-border);\n}\n.today-feedback-pending-list li > div:first-child {\n  display: grid;\n  gap: var(--mo-space-xs);\n}\n.today-feedback-actions {\n  display: flex;\n  flex-wrap: wrap;\n  gap: var(--mo-space-sm);\n}`
);
