import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { WorkspaceEntry } from '@markorbit/contracts';
import { Alert, Button, Card, PageHeader, TextInput } from '@markorbit/ui';
import { LiteAccountApiError, liteAccountApi, type LiteAccountApi } from './account-api.js';
import './account-entry.css';

type View = 'checking' | 'anonymous' | 'workspace-setup' | 'workspace-select' | 'ready' | 'error';
type Mode = 'login' | 'register';

export interface LiteAccountEntryProps {
  api?: LiteAccountApi;
  renderProduct: () => ReactNode;
}

function message(error: unknown) {
  if (error instanceof LiteAccountApiError) {
    if (error.code === 'INVALID_CREDENTIALS') return 'Email or password is incorrect.';
    if (error.code === 'EMAIL_ALREADY_REGISTERED')
      return 'An account already exists for this email. Sign in instead.';
    if (error.code === 'WEAK_PASSWORD') return 'Use a password with at least 10 characters.';
    if (error.status >= 500) return 'MarkOrbit Lite is temporarily unavailable. Please try again.';
    return error.message;
  }
  return 'The request could not be completed. Please try again.';
}

export function LiteAccountEntry({ api = liteAccountApi, renderProduct }: LiteAccountEntryProps) {
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
    setView('ready');
  };

  const enterWorkspaces = async (csrfToken: string) => {
    sessionStorage.setItem('markorbit-csrf-token', csrfToken);
    setCsrf(csrfToken);
    const entries = await api.workspaces();
    setWorkspaces(entries);
    if (entries.length === 0) setView('workspace-setup');
    else if (entries.length === 1) selectWorkspace(entries[0]!);
    else setView('workspace-select');
  };

  useEffect(() => {
    let active = true;
    void api
      .session()
      .then(async (session) => {
        if (!active) return;
        await enterWorkspaces(session.csrfToken);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof LiteAccountApiError && cause.status === 401) setView('anonymous');
        else {
          setError(message(cause));
          setView('error');
        }
      });
    return () => {
      active = false;
    };
  }, [api]);

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

  if (view === 'ready') return <>{renderProduct()}</>;

  return (
    <main className="lite-account-entry">
      <section className="lite-account-entry__intro" aria-labelledby="lite-entry-heading">
        <span className="lite-account-entry__eyebrow">MarkOrbit Lite · Professional workspace</span>
        <h1 id="lite-entry-heading">Your trademark work, organized around what matters next.</h1>
        <p>
          Build a private workspace for client matters, reviews, evidence and opportunities without
          mixing your professional context with a public customer account.
        </p>
      </section>
      <Card className="lite-account-entry__card">
        {view === 'checking' && (
          <div aria-live="polite">
            <PageHeader
              title="Opening Lite"
              description="Checking your secure professional session…"
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
                mode === 'login'
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
              description="Use your firm, team or practice name. You will be its Workspace Admin."
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
              title="Choose your workspace"
              description="Your workspace controls private context, roles and matter access."
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
      </Card>
    </main>
  );
}
