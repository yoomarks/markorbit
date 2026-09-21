import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { WorkspaceEntry } from '@markorbit/contracts';
import { Alert, Button, Card, PageHeader, TextInput } from '@markorbit/ui';
import {
  LiteAccountApiError,
  liteAccountApi,
  type LiteAccountApi,
  type SeedWorkspaceInvitationPreview
} from './account-api.js';
import './account-entry.css';

type View =
  | 'checking'
  | 'anonymous'
  | 'workspace-setup'
  | 'workspace-select'
  | 'seed-claim'
  | 'seed-ready'
  | 'ready'
  | 'error';
type Mode = 'login' | 'register';

type SeedInvitation = Readonly<{
  packageId: string;
  invitationClaimToken: string;
}>;

export interface LiteAccountEntryProps {
  api?: LiteAccountApi;
  renderProduct: () => ReactNode;
}

function invitationFromLocation(): SeedInvitation | null {
  const params = new URLSearchParams(window.location.search);
  const packageId = params.get('seedPackageId')?.trim();
  const invitationClaimToken =
    params.get('claimToken')?.trim() ?? params.get('seedClaimToken')?.trim();
  return packageId && invitationClaimToken ? { packageId, invitationClaimToken } : null;
}

function message(error: unknown) {
  if (error instanceof LiteAccountApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'Email or password is incorrect.';
    if (error.code === 'EMAIL_ALREADY_REGISTERED')
      return 'An account already exists for this email. Sign in instead.';
    if (error.code === 'WEAK_PASSWORD') return 'Use a password with at least 10 characters.';
    if (error.code === 'SEED_INVITATION_NOT_FOUND')
      return 'This prepared workspace invitation is no longer available.';
    if (error.code === 'SEED_PACKAGE_EXPIRED')
      return 'This prepared workspace invitation has expired.';
    if (error.status >= 500) return 'MarkOrbit Lite is temporarily unavailable. Please try again.';
    return error.message;
  }
  return 'The request could not be completed. Please try again.';
}

function previewSummary(preview: SeedWorkspaceInvitationPreview): string {
  const parts = [
    preview.counts.representedApplicants === undefined
      ? null
      : `${preview.counts.representedApplicants} represented applicant candidates`,
    preview.counts.relatedTrademarks === undefined
      ? null
      : `${preview.counts.relatedTrademarks} related trademark candidates`,
    preview.counts.opportunityCandidates === undefined
      ? null
      : `${preview.counts.opportunityCandidates} opportunity candidates`
  ].filter((value): value is string => Boolean(value));
  return parts.length
    ? parts.join(' · ')
    : 'A bounded prepared context is ready for review after you claim it.';
}

function scrubInvitationToken() {
  const url = new URL(window.location.href);
  url.searchParams.delete('claimToken');
  url.searchParams.delete('seedClaimToken');
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

export function LiteAccountEntry({ api = liteAccountApi, renderProduct }: LiteAccountEntryProps) {
  const [invitation] = useState<SeedInvitation | null>(() => invitationFromLocation());
  const [seedPreview, setSeedPreview] = useState<SeedWorkspaceInvitationPreview | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<WorkspaceEntry | null>(null);
  const [view, setView] = useState<View>('checking');
  const [mode, setMode] = useState<Mode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceEntry[]>([]);
  const [csrf, setCsrf] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectWorkspace = (entry: WorkspaceEntry) => {
    sessionStorage.setItem('markorbit-workspace-id', entry.workspace.workspaceId);
    const url = new URL(window.location.href);
    url.searchParams.set('workspaceId', entry.workspace.workspaceId);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    if (invitation) {
      setSelectedWorkspace(entry);
      setView('seed-claim');
    } else {
      setView('ready');
    }
  };

  const enterWorkspaces = async (csrfToken: string) => {
    sessionStorage.setItem('markorbit-csrf-token', csrfToken);
    setCsrf(csrfToken);
    const entries = await api.workspaces();
    setWorkspaces(entries);
    const requestedWorkspaceId = new URLSearchParams(window.location.search).get('workspaceId');
    const requestedWorkspace = requestedWorkspaceId
      ? entries.find((entry) => entry.workspace.workspaceId === requestedWorkspaceId)
      : undefined;
    if (requestedWorkspace) selectWorkspace(requestedWorkspace);
    else if (entries.length === 0) setView('workspace-setup');
    else if (entries.length === 1) selectWorkspace(entries[0]!);
    else setView('workspace-select');
  };

  useEffect(() => {
    let active = true;
    const open = async () => {
      try {
        if (invitation) {
          const preview = await api.previewSeedInvitation(invitation);
          if (!active) return;
          setSeedPreview(preview);
          setWorkspaceName(preview.target.displayName);
        }
        const session = await api.session();
        if (!active) return;
        await enterWorkspaces(session.csrfToken);
      } catch (cause) {
        if (!active) return;
        if (cause instanceof LiteAccountApiError && cause.status === 401) setView('anonymous');
        else {
          setError(message(cause));
          setView('error');
        }
      }
    };
    void open();
    return () => {
      active = false;
    };
  }, [api, invitation]);

  const submitAccess = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const access =
        mode === 'register'
          ? await api.register({ displayName: displayName.trim(), email: email.trim(), password })
          : await api.login({ email: email.trim(), password });
      await enterWorkspaces(access.csrfToken);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const entry = await api.createWorkspace({ name: workspaceName.trim() }, csrf);
      selectWorkspace(entry);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  const continueSeedReview = () => {
    const url = new URL(window.location.href);
    url.hash = '#seed-review';
    window.history.replaceState({}, '', url);
    setView('ready');
  };

  const claimSeedWorkspace = async () => {
    if (!invitation || !seedPreview || !selectedWorkspace) return;
    setBusy(true);
    setError(null);
    try {
      const workspaceId = selectedWorkspace.workspace.workspaceId;
      const suffix = invitation.packageId.slice(-80);
      await api.claimSeedWorkspace(
        invitation,
        workspaceId,
        csrf,
        `seed-claim-${workspaceId}-${suffix}`
      );
      sessionStorage.setItem('markorbit-seed-package-id', seedPreview.seedWorkspacePackageId);
      scrubInvitationToken();
      setView('seed-ready');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };

  if (view === 'ready') return <>{renderProduct()}</>;

  return (
    <main className="lite-account-entry">
      <section className="lite-account-entry__intro" aria-labelledby="lite-entry-heading">
        <span className="lite-account-entry__eyebrow">
          {seedPreview
            ? 'MarkOrbit Lite · Prepared professional workspace'
            : 'MarkOrbit Lite · Professional workspace'}
        </span>
        <h1 id="lite-entry-heading">
          {seedPreview
            ? `We prepared a starting point for ${seedPreview.target.displayName}.`
            : 'Your trademark work, organized around what matters next.'}
        </h1>
        <p>
          {seedPreview
            ? 'Review the prepared context first, then choose exactly where to claim it. Nothing becomes a customer, managed trademark or qualified opportunity automatically.'
            : 'Build a private workspace for client matters, reviews, evidence and opportunities without mixing your professional context with a public customer account.'}
        </p>
      </section>
      <Card className="lite-account-entry__card">
        {seedPreview && (
          <section aria-label="Prepared workspace preview">
            <strong>{seedPreview.target.displayName}</strong>
            <p>{previewSummary(seedPreview)}</p>
          </section>
        )}
        {view === 'checking' && (
          <div aria-live="polite">
            <PageHeader
              title={invitation ? 'Opening your prepared workspace' : 'Opening Lite'}
              description={
                invitation
                  ? 'Verifying the prepared invitation and your secure professional session…'
                  : 'Checking your secure professional session…'
              }
            />
          </div>
        )}
        {view === 'error' && (
          <>
            <Alert tone="danger" title="Unable to open MarkOrbit Lite">
              {error}
            </Alert>
            <Button onClick={() => window.location.reload()}>Try again</Button>
          </>
        )}
        {view === 'anonymous' && (
          <>
            <PageHeader
              title={mode === 'login' ? 'Sign in to Lite' : 'Create a professional account'}
              description={
                seedPreview
                  ? 'Sign in or create an account before choosing the Workspace that will receive this prepared context.'
                  : mode === 'login'
                    ? 'Continue to your private trademark workspace.'
                    : 'For trademark agents, attorneys and IP professionals managing ongoing work.'
              }
            />
            <div
              className="lite-account-entry__switch"
              role="group"
              aria-label="Professional account access"
            >
              <Button
                type="button"
                variant={mode === 'login' ? 'primary' : 'secondary'}
                onClick={() => setMode('login')}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant={mode === 'register' ? 'primary' : 'secondary'}
                onClick={() => setMode('register')}
              >
                Create professional account
              </Button>
            </div>
            <form onSubmit={(event) => void submitAccess(event)}>
              {mode === 'register' && (
                <TextInput
                  label="Your name"
                  autoComplete="name"
                  value={displayName}
                  required
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              )}
              <TextInput
                label="Work email"
                type="email"
                autoComplete="email"
                value={email}
                required
                onChange={(event) => setEmail(event.target.value)}
              />
              <TextInput
                label="Password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                minLength={10}
                required
                hint={mode === 'register' ? 'At least 10 characters.' : undefined}
                onChange={(event) => setPassword(event.target.value)}
              />
              {error && (
                <Alert tone="danger" title="Account access failed">
                  {error}
                </Alert>
              )}
              <Button type="submit" disabled={busy}>
                {busy
                  ? 'Please wait…'
                  : mode === 'login'
                    ? 'Sign in'
                    : 'Create professional account'}
              </Button>
            </form>
          </>
        )}
        {view === 'workspace-setup' && (
          <>
            <PageHeader
              title="Create your professional workspace"
              description={
                seedPreview
                  ? 'Create the Workspace that will receive the prepared context. The claim remains a separate confirmation.'
                  : 'Use your firm, team or practice name. You will be its Workspace Admin.'
              }
            />
            <form onSubmit={(event) => void createWorkspace(event)}>
              <TextInput
                label="Workspace name"
                value={workspaceName}
                required
                placeholder="Firm or practice name"
                onChange={(event) => setWorkspaceName(event.target.value)}
              />
              {error && (
                <Alert tone="danger" title="Workspace could not be created">
                  {error}
                </Alert>
              )}
              <Button type="submit" disabled={busy}>
                {busy ? 'Creating…' : 'Create professional workspace'}
              </Button>
            </form>
          </>
        )}
        {view === 'workspace-select' && (
          <>
            <PageHeader
              title={seedPreview ? 'Choose where to claim this context' : 'Choose your workspace'}
              description={
                seedPreview
                  ? 'Selecting a Workspace does not claim anything yet. You will review one final confirmation.'
                  : 'Your workspace controls private context, roles and matter access.'
              }
            />
            <div className="lite-account-entry__workspaces">
              {workspaces.map((entry) => (
                <Button
                  type="button"
                  variant="secondary"
                  key={entry.workspace.workspaceId}
                  onClick={() => selectWorkspace(entry)}
                >
                  {entry.workspace.name}
                </Button>
              ))}
            </div>
          </>
        )}
        {view === 'seed-claim' && seedPreview && selectedWorkspace && (
          <>
            <PageHeader
              title="Claim this prepared context"
              description={`Attach the prepared starting point for ${seedPreview.target.displayName} to ${selectedWorkspace.workspace.name}.`}
            />
            <p>
              By continuing, you confirm this is the Workspace where you want to review this
              organization or subject. Claiming does not create customers, mark trademarks as
              managed, qualify opportunities or authorize external actions.
            </p>
            {error && (
              <Alert tone="danger" title="Prepared context could not be claimed">
                {error}
              </Alert>
            )}
            <Button type="button" disabled={busy} onClick={() => void claimSeedWorkspace()}>
              {busy ? 'Claiming…' : 'Confirm and claim prepared context'}
            </Button>
          </>
        )}
        {view === 'seed-ready' && seedPreview && selectedWorkspace && (
          <>
            <PageHeader
              title="Your prepared starting point is ready"
              description={`${seedPreview.target.displayName} is now attached to ${selectedWorkspace.workspace.name} for review.`}
            />
            <p>{previewSummary(seedPreview)}</p>
            <p>
              MO has preserved the prepared evidence and context, but has not automatically created
              a customer, marked any trademark as managed, qualified an opportunity or authorized an
              external action.
            </p>
            <Button type="button" onClick={continueSeedReview}>
              Review what MO found
            </Button>
          </>
        )}
      </Card>
    </main>
  );
}
