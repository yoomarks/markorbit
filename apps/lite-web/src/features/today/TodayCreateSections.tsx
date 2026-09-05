import { useEffect, useState } from 'react';
import type {
  ContentKit,
  ContentPick,
  PlatformVariant,
  VisualOutputKind
} from '@markorbit/contracts/daily-workspace';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Select,
  TextInput
} from '@markorbit/ui';
import type {
  DailyWorkspaceHttpError,
  VisualBriefRecordResponse
} from '../../api/daily-workspace.js';
import type { TodayBusyState } from './today-types.js';

function ContentPickCard({
  pick,
  selected,
  onSelect
}: {
  pick: Readonly<ContentPick>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Card>
      <div className="daily-card-heading">
        <div>
          <p className="daily-kicker">CONTENT PICK</p>
          <h3>{pick.title}</h3>
        </div>
        {selected ? <Badge>In Quick Create</Badge> : null}
      </div>
      <p>{pick.whyPublish}</p>
      {pick.suggestedAngles.length ? (
        <ul className="daily-angle-list">
          {pick.suggestedAngles.slice(0, 3).map((angle) => (
            <li key={angle}>{angle}</li>
          ))}
        </ul>
      ) : null}
      <div className="daily-chip-row">
        {pick.recommendedPlatforms.map((platform) => (
          <span key={platform}>{platform.replaceAll('_', ' ')}</span>
        ))}
      </div>
      <Button variant={selected ? 'secondary' : 'primary'} onClick={onSelect}>
        {selected ? 'Selected for Quick Create' : 'Open in Quick Create'}
      </Button>
    </Card>
  );
}

function ContentKitPanel({
  pick,
  kit,
  loading,
  error,
  visualRecord,
  visualError,
  busy,
  onCreateVisualBrief,
  onStartVisualRequest,
  onSelectAngle,
  onCopyVariant,
  onExportVariant
}: {
  pick: Readonly<ContentPick>;
  kit?: Readonly<ContentKit>;
  loading: boolean;
  error?: Readonly<DailyWorkspaceHttpError>;
  visualRecord?: Readonly<VisualBriefRecordResponse>;
  visualError?: Readonly<DailyWorkspaceHttpError>;
  busy: TodayBusyState;
  onCreateVisualBrief: (input: {
    requestedIpPackage: string;
    outputKind: VisualOutputKind;
    sceneIntent: string;
  }) => void;
  onStartVisualRequest: () => void;
  onSelectAngle: (angleId: string) => void;
  onCopyVariant: (variant: Readonly<PlatformVariant>) => Promise<void>;
  onExportVariant: (variant: Readonly<PlatformVariant>) => void;
}) {
  const [ipPackage, setIpPackage] = useState('');
  const [outputKind, setOutputKind] = useState<VisualOutputKind>('XIAOHONGSHU_COVER');
  const [sceneIntent, setSceneIntent] = useState('');
  const [selectedAngleId, setSelectedAngleId] = useState('');
  const [copiedVariantId, setCopiedVariantId] = useState('');
  const [exportedVariantId, setExportedVariantId] = useState('');
  const [copyError, setCopyError] = useState('');
  const [exportError, setExportError] = useState('');

  useEffect(() => {
    setSceneIntent(pick.suggestedAngles[0] ?? pick.whyPublish);
  }, [pick.contentPickId, pick.suggestedAngles, pick.whyPublish]);

  useEffect(() => {
    setSelectedAngleId('');
    setCopiedVariantId('');
    setExportedVariantId('');
    setCopyError('');
    setExportError('');
  }, [kit?.contentKitId, kit?.version]);

  const copyVariant = async (variant: Readonly<PlatformVariant>) => {
    setCopyError('');
    try {
      await onCopyVariant(variant);
      setCopiedVariantId(variant.variantId);
    } catch {
      setCopyError('This browser could not copy the platform variant.');
    }
  };

  const exportVariant = (variant: Readonly<PlatformVariant>) => {
    setExportError('');
    try {
      onExportVariant(variant);
      setExportedVariantId(variant.variantId);
    } catch {
      setExportError('This browser could not export the platform variant.');
    }
  };

  if (loading) return <LoadingState label="Opening Content Kit" />;
  if (error?.code === 'CONTENT_OPPORTUNITY_REQUIRED') {
    return (
      <Alert tone="info" title="Prepare the content line first">
        This Content Pick is editorial guidance only. Use Today Actions to prepare and explicitly
        confirm the existing Content Recommendation before a Content Kit can exist.
      </Alert>
    );
  }
  if (error)
    return (
      <Alert tone="warning" title="Content Kit unavailable">
        {error.message}
      </Alert>
    );
  if (!kit) return null;

  return (
    <div className="daily-create-stack">
      <Card>
        <div className="daily-card-heading">
          <div>
            <p className="daily-kicker">CONTENT KIT</p>
            <h3>{pick.title}</h3>
          </div>
          <Badge>v{kit.version}</Badge>
        </div>
        <p>{kit.whyItMatters}</p>
        <p>
          <strong>Why publish:</strong> {kit.whyPublish}
        </p>
        <p>
          <strong>Audience:</strong> {kit.audience}
        </p>
        <div className="daily-create-columns">
          <div>
            <h4>Angles</h4>
            <ul className="daily-angle-list">
              {kit.angles.map((angle) => {
                const selected = selectedAngleId === angle.angleId;
                return (
                  <li key={angle.angleId}>
                    <strong>{angle.title}</strong>
                    <span>{angle.thesis}</span>
                    <Button
                      variant={selected ? 'secondary' : 'primary'}
                      disabled={selected}
                      onClick={() => {
                        setSelectedAngleId(angle.angleId);
                        onSelectAngle(angle.angleId);
                      }}
                    >
                      {selected ? 'Selected angle' : 'Use this angle'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div>
            <h4>Native variants</h4>
            <ul className="daily-variant-list">
              {kit.platformVariants.map((variant) => (
                <li key={variant.variantId}>
                  <Badge>{variant.kind.replaceAll('_', ' ')}</Badge>
                  <strong>{variant.title}</strong>
                  <p>{variant.body}</p>
                  <small>Human review required · external publish executed: No</small>
                  <Button
                    variant="secondary"
                    disabled={copiedVariantId === variant.variantId}
                    onClick={() => void copyVariant(variant)}
                  >
                    {copiedVariantId === variant.variantId ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={exportedVariantId === variant.variantId}
                    onClick={() => exportVariant(variant)}
                  >
                    {exportedVariantId === variant.variantId ? 'Exported' : 'Export'}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {copyError ? (
          <Alert tone="warning" title="Copy unavailable">
            {copyError}
          </Alert>
        ) : null}
        {exportError ? (
          <Alert tone="warning" title="Export unavailable">
            {exportError}
          </Alert>
        ) : null}
      </Card>

      <Card>
        <div className="daily-card-heading">
          <div>
            <p className="daily-kicker">VISUAL</p>
            <h3>Reuse-first visual brief</h3>
          </div>
          <Badge>{kit.visualBriefReferences.length} brief(s)</Badge>
        </div>
        <Alert tone="info" title="Visual production remains governed">
          Lite can prepare a Visual Brief, but it cannot choose provider/model, authorize paid
          execution or override Visual QC.
        </Alert>
        {kit.visualBriefReferences.length ? (
          <ul className="daily-reference-list">
            {kit.visualBriefReferences.map((reference) => (
              <li key={`${reference.id}:${reference.version}`}>
                {reference.id} · v{reference.version}
              </li>
            ))}
          </ul>
        ) : null}
        <div className="daily-visual-form">
          <TextInput
            label="Governed IP package"
            value={ipPackage}
            onChange={(event) => setIpPackage(event.target.value)}
            placeholder="e.g. MOKI"
          />
          <Select
            label="Output format"
            value={outputKind}
            onChange={(event) => setOutputKind(event.target.value as VisualOutputKind)}
          >
            <option value="XIAOHONGSHU_COVER">Xiaohongshu cover</option>
            <option value="WECHAT_OFFICIAL_ACCOUNT_COVER">WeChat article cover</option>
            <option value="MOMENTS_SOCIAL_CARD">Moments / social card</option>
            <option value="VIDEO_COVER">Video cover</option>
          </Select>
          <TextInput
            label="Scene intent"
            value={sceneIntent}
            onChange={(event) => setSceneIntent(event.target.value)}
          />
        </div>
        <Button
          onClick={() =>
            onCreateVisualBrief({ requestedIpPackage: ipPackage, outputKind, sceneIntent })
          }
          disabled={busy !== '' || !ipPackage.trim() || !sceneIntent.trim()}
        >
          {busy === 'visual-brief' ? 'Saving Visual Brief…' : 'Create Visual Brief'}
        </Button>
        {visualRecord ? (
          <div className="daily-visual-result">
            <strong>{visualRecord.brief.visualBriefId}</strong>
            <span>
              Reuse first: Yes · Paid execution authorized by Lite: No ·{' '}
              {visualRecord.brief.outputKind}
            </span>
            <Button variant="secondary" onClick={onStartVisualRequest} disabled={busy !== ''}>
              {busy === 'visual-request' ? 'Requesting…' : 'Request reuse-first visual'}
            </Button>
          </div>
        ) : null}
        {visualError ? (
          <Alert
            tone={visualError.code === 'VISUAL_CONSUMER_UNAVAILABLE' ? 'info' : 'warning'}
            title={
              visualError.code === 'VISUAL_CONSUMER_UNAVAILABLE'
                ? 'Visual Engine connection not configured'
                : 'Visual request unavailable'
            }
          >
            {visualError.message} No provider or paid execution is assumed from this state.
          </Alert>
        ) : null}
      </Card>
    </div>
  );
}

export function TodayCreateSections({
  contentPicks,
  selectedPick,
  kit,
  kitLoading,
  kitError,
  visualRecord,
  visualError,
  busy,
  onSelectPick,
  onCreateVisualBrief,
  onStartVisualRequest,
  onSelectAngle,
  onCopyVariant,
  onExportVariant
}: {
  contentPicks: ReadonlyArray<Readonly<ContentPick>>;
  selectedPick?: Readonly<ContentPick>;
  kit?: Readonly<ContentKit>;
  kitLoading: boolean;
  kitError?: Readonly<DailyWorkspaceHttpError>;
  visualRecord?: Readonly<VisualBriefRecordResponse>;
  visualError?: Readonly<DailyWorkspaceHttpError>;
  busy: TodayBusyState;
  onSelectPick: (pick: Readonly<ContentPick>) => void;
  onCreateVisualBrief: (input: {
    requestedIpPackage: string;
    outputKind: VisualOutputKind;
    sceneIntent: string;
  }) => void;
  onStartVisualRequest: () => void;
  onSelectAngle: (angleId: string) => void;
  onCopyVariant: (variant: Readonly<PlatformVariant>) => Promise<void>;
  onExportVariant: (variant: Readonly<PlatformVariant>) => void;
}) {
  return (
    <>
      <section id="content-picks" className="daily-section" aria-labelledby="content-picks-heading">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">CREATE</p>
            <h2 id="content-picks-heading">Content Picks</h2>
            <p>Worth expressing today. A pick is not a Draft or a publication.</p>
          </div>
          <Badge>{contentPicks.length}</Badge>
        </div>
        {contentPicks.length ? (
          <div className="daily-card-grid">
            {contentPicks.map((pick) => (
              <ContentPickCard
                key={pick.contentPickId}
                pick={pick}
                selected={selectedPick?.contentPickId === pick.contentPickId}
                onSelect={() => onSelectPick(pick)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Content Picks yet"
            description="Content Picks appear only when a ranked signal has an exact content Recommendation."
          />
        )}
      </section>

      <section id="quick-create" className="daily-section" aria-labelledby="quick-create-heading">
        <div className="daily-section-heading">
          <div>
            <p className="daily-kicker">CREATE</p>
            <h2 id="quick-create-heading">Quick Create</h2>
            <p>Work from the existing Content lifecycle; no second draft or publication truth.</p>
          </div>
        </div>
        {selectedPick ? (
          <ContentKitPanel
            pick={selectedPick}
            {...(kit ? { kit } : {})}
            loading={kitLoading}
            {...(kitError ? { error: kitError } : {})}
            {...(visualRecord ? { visualRecord } : {})}
            {...(visualError ? { visualError } : {})}
            busy={busy}
            onCreateVisualBrief={onCreateVisualBrief}
            onStartVisualRequest={onStartVisualRequest}
            onSelectAngle={onSelectAngle}
            onCopyVariant={onCopyVariant}
            onExportVariant={onExportVariant}
          />
        ) : (
          <EmptyState
            title="Choose a Content Pick"
            description="Select a Content Pick above to open its governed Content Kit."
          />
        )}
      </section>
    </>
  );
}
