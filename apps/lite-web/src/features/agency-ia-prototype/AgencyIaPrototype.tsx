import { useMemo, useState, type ReactNode } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  KeyValueList,
  LoadingState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import {
  agencyCases,
  messages,
  trademarkRows,
  vocabulary,
  type AgencyPrototypeState,
  type AgencyPrototypeSurface
} from './fixtures.js';
import './agency-ia-prototype.css';

export interface AgencyIaPrototypeProps {
  initialSurface?: AgencyPrototypeSurface;
  state?: AgencyPrototypeState;
  initialMessageId?: string;
  mobile?: boolean;
}

const primaryNavigation: ReadonlyArray<{
  id: 'today' | 'cases' | 'trademarks' | 'clients' | 'inbox';
  label: string;
  count?: number;
}> = [
  { id: 'today', label: 'Today' },
  { id: 'cases', label: 'Cases' },
  { id: 'trademarks', label: 'Trademarks' },
  { id: 'clients', label: 'Clients' },
  { id: 'inbox', label: 'Inbox', count: 3 }
] as const;

function StateBoundary({ state, children }: { state: AgencyPrototypeState; children: ReactNode }) {
  if (state === 'loading') return <LoadingState label="Loading workspace information" />;
  if (state === 'empty')
    return (
      <EmptyState
        title="Nothing needs attention here"
        description="There are no records for this view or the current filters."
      />
    );
  if (state === 'unavailable')
    return (
      <ErrorState
        title="Some information is unavailable"
        description="The source could not provide this information. It has not been treated as empty."
      />
    );
  if (state === 'permission')
    return (
      <ErrorState
        title="You do not have access to this view"
        description="Ask a workspace administrator for the required permission. No data has been changed."
      />
    );
  if (state === 'error')
    return (
      <ErrorState
        title="This view could not be loaded"
        description="Your existing work is safe. Try again when the workspace service is available."
      />
    );
  return (
    <>
      {state === 'partial' && (
        <Alert tone="warning" title="Some information is unavailable">
          Available records are shown below. Missing source information is not inferred.
        </Alert>
      )}
      {state === 'stale' && (
        <Alert tone="warning" title="Needs refresh">
          This view was last checked yesterday. Refresh before relying on it for a deadline or
          filing.
        </Alert>
      )}
      {state === 'success' && <p role="status">Saved. This draft has not been sent or filed.</p>}
      {children}
    </>
  );
}

function TrustLabel({ kind }: { kind: 'official' | 'workspace' | 'ai' }) {
  const labels = {
    official: 'Official record',
    workspace: 'Workspace information',
    ai: 'AI suggestion'
  } as const;
  return <span className={`agency-trust agency-trust--${kind}`}>{labels[kind]}</span>;
}

function TodayView({ onOpenInbox }: { onOpenInbox: () => void }) {
  return (
    <section>
      <PageHeader
        title="Today"
        description="The work that most needs your attention"
        actions={<Badge>Wednesday · 16 September</Badge>}
      />
      <section className="agency-section" aria-labelledby="attention-title">
        <div className="agency-section__heading">
          <div>
            <p className="agency-eyebrow">Priority</p>
            <h2 id="attention-title">Needs your attention</h2>
          </div>
          <Badge>3 urgent</Badge>
        </div>
        <div className="agency-priority-grid">
          <Card className="agency-priority agency-priority--urgent">
            <Badge>Due today</Badge>
            <h3>Review NORTHSTAR evidence of use</h3>
            <p>Northstar Robotics Ltd. · US Section 8 maintenance</p>
            <p>
              <strong>Next:</strong> Confirm the specimen before 4:00 PM.
            </p>
            <Button>Open case</Button>
          </Card>
          <Card className="agency-priority">
            <Badge>Unread</Badge>
            <h3>3 emails need attention</h3>
            <p>One outside-counsel message still needs to be linked to its work.</p>
            <Button onClick={onOpenInbox}>Review in Inbox</Button>
          </Card>
          <Card className="agency-priority">
            <Badge>Change detected</Badge>
            <h3>NORTHSTAR status changed</h3>
            <p>
              <TrustLabel kind="official" /> Checked 18 minutes ago
            </p>
            <Button variant="secondary">Review change</Button>
          </Card>
        </div>
      </section>
      <div className="agency-two-column">
        <section className="agency-section" aria-labelledby="continue-title">
          <h2 id="continue-title">Continue</h2>
          <Card>
            <p className="agency-eyebrow">Last opened 24 minutes ago</p>
            <h3>NORTHSTAR · Section 8 maintenance</h3>
            <p>Review is in progress. No filing has been submitted.</p>
            <Button variant="secondary">Resume review</Button>
          </Card>
        </section>
        <section className="agency-section" aria-labelledby="suggestions-title">
          <h2 id="suggestions-title">Suggestions</h2>
          <Card>
            <TrustLabel kind="ai" />
            <h3>Client update may be needed</h3>
            <p>Prepare a short summary of the NORTHSTAR status change for client review.</p>
            <Button variant="secondary">Prepare update</Button>
          </Card>
        </section>
      </div>
    </section>
  );
}

function CasesView({ onOpenCase }: { onOpenCase: () => void }) {
  return (
    <section>
      <PageHeader
        title="Cases"
        description="Professional work in progress"
        actions={<Button>New case</Button>}
      />
      <div className="agency-filter-row" role="search">
        <TextInput label="Search cases" placeholder="Client, trademark or reference" />
        <Select label="Status" defaultValue="active">
          <option value="active">Active cases</option>
          <option value="all">All cases</option>
        </Select>
        <Select label="Due" defaultValue="30">
          <option value="30">Next 30 days</option>
          <option value="all">Any date</option>
        </Select>
      </div>
      <div className="agency-table-wrap">
        <table className="agency-table">
          <thead>
            <tr>
              <th>Case</th>
              <th>Client</th>
              <th>Status</th>
              <th>Next action</th>
              <th>Due</th>
              <th>Last update</th>
            </tr>
          </thead>
          <tbody>
            {agencyCases.map((item, index) => (
              <tr key={item.id}>
                <td>
                  <button
                    className="agency-text-button"
                    onClick={index === 0 ? onOpenCase : undefined}
                  >
                    {item.trademark}
                  </button>
                  <small>
                    {item.jurisdiction} · {item.type}
                  </small>
                </td>
                <td>{item.client}</td>
                <td>
                  <Badge>{item.status}</Badge>
                </td>
                <td>{item.nextAction}</td>
                <td>{item.due}</td>
                <td>{item.updated}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CaseDetailView({ onBack }: { onBack: () => void }) {
  const [approved, setApproved] = useState(false);
  return (
    <section>
      <button className="agency-back" onClick={onBack}>
        ← Back to cases
      </button>
      <PageHeader
        title="NORTHSTAR"
        description="US · Section 8 maintenance · Northstar Robotics Ltd."
        actions={<Badge>Ready for review</Badge>}
      />
      <nav className="agency-tabs" aria-label="Case sections">
        {['Overview', 'Timeline', 'Documents', 'Messages', 'Tasks', 'Evidence', 'Actions'].map(
          (item, index) => (
            <button key={item} aria-current={index === 0 ? 'page' : undefined}>
              {item}
            </button>
          )
        )}
      </nav>
      <div className="agency-case-layout">
        <div className="agency-stack">
          <Card>
            <div className="agency-section__heading">
              <div>
                <p className="agency-eyebrow">Next action</p>
                <h2>Review evidence of use</h2>
              </div>
              <Badge>Due today</Badge>
            </div>
            <p>Confirm the specimen and instructions before preparing the filing for approval.</p>
            <ol className="agency-flow" aria-label="Case progress">
              <li className="is-complete">Case</li>
              <li className="is-current">Review</li>
              <li>Documents</li>
              <li>Approval</li>
              <li>File</li>
              <li>Result</li>
            </ol>
            <Button>Continue review</Button>
          </Card>
          <Card>
            <TrustLabel kind="workspace" />
            <h2>Client instructions</h2>
            <p>
              Use the packaging photograph approved on 15 September. Ask before changing the goods
              wording.
            </p>
          </Card>
          <Card>
            <div className="agency-section__heading">
              <h2>Ready to file</h2>
              <Badge>Draft only</Badge>
            </div>
            <p>
              You are about to submit a US trademark maintenance filing for NORTHSTAR on behalf of
              Northstar Robotics Ltd.
            </p>
            <Alert tone="warning" title="Final confirmation required">
              Reviewing or approving this draft does not submit the filing.
            </Alert>
            <div className="agency-actions">
              <Button variant="secondary">Review details</Button>
              <Button onClick={() => setApproved(true)}>Approve draft</Button>
            </div>
            {approved && (
              <p role="status">
                <strong>Draft approved.</strong> It has not been filed.
              </p>
            )}
          </Card>
        </div>
        <aside className="agency-stack" aria-label="Case context">
          <Card>
            <h2>Case details</h2>
            <KeyValueList
              items={[
                { key: 'Client', value: 'Northstar Robotics Ltd.' },
                { key: 'Trademark', value: 'NORTHSTAR' },
                { key: 'Jurisdiction', value: 'United States' },
                { key: 'Due date', value: 'Today · 4:00 PM' }
              ]}
            />
          </Card>
          <Card>
            <h2>Ask MO</h2>
            <p>Ask about this case, its documents, or the next step.</p>
            <Button variant="secondary">Ask MO about this case</Button>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function TrademarksView() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const visibleRows = trademarkRows.slice(0, 12);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <section>
      <PageHeader
        title="Trademarks"
        description="10,000 trademarks across this workspace"
        actions={<Button>New trademark intake</Button>}
      />
      <div className="agency-toolbar">
        <TextInput label="Search trademarks" placeholder="Name, client or registration" />
        <Button variant="secondary">Filters</Button>
        <Button variant="secondary">Saved filters</Button>
        <Button variant="secondary">Columns</Button>
        <Button variant="secondary">Density</Button>
      </div>
      {selected.size > 0 && (
        <div className="agency-selection" role="status">
          <strong>{selected.size} selected</strong>
          <Button variant="secondary">Assign client</Button>
          <Button variant="secondary">Add tag</Button>
          <Button variant="secondary">Correct relationship</Button>
        </div>
      )}
      <div className="agency-table-wrap">
        <table className="agency-table agency-table--dense">
          <thead>
            <tr>
              <th>
                <span className="agency-sr-only">Select</span>
              </th>
              <th>Trademark</th>
              <th>Client</th>
              <th>Jurisdiction</th>
              <th>Registration</th>
              <th>Information status</th>
              <th>Last checked</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input
                    aria-label={`Select ${row.name} ${row.registration}`}
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggle(row.id)}
                  />
                </td>
                <td>
                  <strong>{row.name}</strong>
                </td>
                <td>{row.client}</td>
                <td>{row.jurisdiction}</td>
                <td>{row.registration}</td>
                <td>
                  <Badge>{row.status}</Badge>
                </td>
                <td>{row.checked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav className="agency-pagination" aria-label="Trademark pages">
        <span>1–12 of 10,000</span>
        <div>
          <Button variant="secondary" disabled>
            Previous
          </Button>{' '}
          <Button variant="secondary">Next</Button>
        </div>
      </nav>
    </section>
  );
}

function ClientsView() {
  return (
    <section>
      <button className="agency-back">← Back to clients</button>
      <PageHeader
        title="Northstar Robotics Ltd."
        description="Client · Active relationship"
        actions={<Button>New task</Button>}
      />
      <nav className="agency-tabs" aria-label="Client sections">
        {['Overview', 'Trademarks', 'Cases', 'Messages', 'Tasks', 'Timeline'].map((item, index) => (
          <button key={item} aria-current={index === 0 ? 'page' : undefined}>
            {item}
          </button>
        ))}
      </nav>
      <div className="agency-case-layout">
        <div className="agency-stack">
          <Card>
            <div className="agency-section__heading">
              <h2>Open work</h2>
              <Badge>2 items</Badge>
            </div>
            <h3>NORTHSTAR · Section 8 maintenance</h3>
            <p>Evidence review due today at 4:00 PM.</p>
            <Button variant="secondary">Open case</Button>
          </Card>
          <Card>
            <h2>Recent messages</h2>
            <p>
              <strong>Elena Rossi · Rossi & Partners</strong>
            </p>
            <p>NORTHSTAR — USPTO status and specimen question</p>
            <Button variant="secondary">Open in Inbox</Button>
          </Card>
        </div>
        <aside className="agency-stack">
          <Card>
            <h2>Relationship</h2>
            <KeyValueList
              items={[
                { key: 'Type', value: 'Client' },
                { key: 'Primary contact', value: 'Maya Chen' },
                { key: 'Managed trademarks', value: '14' },
                { key: 'Open cases', value: '2' }
              ]}
            />
          </Card>
          <Card>
            <h2>Ask MO</h2>
            <p>Ask about this client’s cases, trademarks, or recent messages.</p>
            <Button variant="secondary">Ask MO about this client</Button>
          </Card>
        </aside>
      </div>
    </section>
  );
}

function InboxView({ initialMessageId }: { initialMessageId?: string }) {
  const startingMessageId = initialMessageId ?? messages[0].id;
  const [selectedId, setSelectedId] = useState(startingMessageId);
  const [linked, setLinked] = useState(
    messages.find((message) => message.id === startingMessageId)?.linked ?? false
  );
  const [followUp, setFollowUp] = useState(false);
  const [draft, setDraft] = useState(false);
  const selectedMessage = messages.find((message) => message.id === selectedId) ?? messages[0];
  return (
    <section>
      <PageHeader
        title="Inbox"
        description="Messages and the work they belong to"
        actions={<Button>New message</Button>}
      />
      <div className="agency-inbox">
        <nav className="agency-folders" aria-label="Inbox folders">
          <h2>Folders</h2>
          <button aria-current="page">
            Needs action <Badge>3</Badge>
          </button>
          <button>
            Unread <Badge>2</Badge>
          </button>
          <button>
            Unlinked <Badge>1</Badge>
          </button>
          <button>All messages</button>
          <button>Sent</button>
        </nav>
        <div className="agency-message-list" aria-label="Messages">
          {messages.map((message) => (
            <button
              key={message.id}
              className={message.id === selectedId ? 'is-selected' : ''}
              onClick={() => {
                setSelectedId(message.id);
                setLinked(message.linked);
                setFollowUp(false);
                setDraft(false);
              }}
            >
              <span>
                <strong>{message.sender}</strong>
                <time>{message.time}</time>
              </span>
              <b>{message.subject}</b>
              <small>{message.preview}</small>
              {!message.linked && <Badge>Needs linking</Badge>}
            </button>
          ))}
        </div>
        <article className="agency-message-detail">
          {selectedMessage.unavailable ? (
            <Alert tone="warning" title="Some message context is unavailable">
              The provider source did not return the full message body. Missing context is not
              treated as an empty message.
            </Alert>
          ) : (
            <>
              <header>
                <p className="agency-eyebrow">{selectedMessage.sender}</p>
                <h2>{selectedMessage.subject}</h2>
                <p>To: agency@northstar.example · {selectedMessage.time}</p>
              </header>
              <div className="agency-message-body">
                <p>Hello,</p>
                <p>
                  The examiner has accepted the response. Before we proceed, please confirm whether
                  the new packaging photograph should replace the specimen currently in the draft.
                </p>
                <p>
                  Regards,
                  <br />
                  Elena
                </p>
              </div>
            </>
          )}
          <aside className="agency-related" aria-label="Related work">
            <div className="agency-section__heading">
              <h2>Related work</h2>
              {linked ? <Badge>Linked</Badge> : <Badge>Needs linking</Badge>}
            </div>
            {linked ? (
              <KeyValueList
                items={[
                  { key: 'Client', value: 'Northstar Robotics Ltd.' },
                  { key: 'Case', value: 'US Section 8 maintenance' },
                  { key: 'Trademark', value: 'NORTHSTAR' },
                  { key: 'Deadline', value: 'Today · 4:00 PM' }
                ]}
              />
            ) : (
              <Card className="agency-suggestion">
                <TrustLabel kind="ai" />
                <h3>Suggested match</h3>
                <p>
                  <strong>Northstar Robotics Ltd.</strong>
                  <br />
                  NORTHSTAR · US Section 8 maintenance
                </p>
                <p>High confidence · based on sender, trademark and reference</p>
                <div className="agency-actions">
                  <Button onClick={() => setLinked(true)}>Link</Button>
                  <Button variant="secondary">Choose another</Button>
                  <Button variant="secondary">Ignore</Button>
                </div>
              </Card>
            )}
            {linked && (
              <>
                <div className="agency-actions">
                  <Button variant="secondary" onClick={() => setFollowUp(true)}>
                    Create follow-up
                  </Button>
                  <Button variant="secondary" onClick={() => setDraft(true)}>
                    Draft reply
                  </Button>
                  <Button variant="secondary" onClick={() => setDraft(true)}>
                    Prepare client update
                  </Button>
                  <Button variant="secondary">Open case</Button>
                </div>
                {followUp && (
                  <p role="status">
                    <strong>Follow-up created</strong> for tomorrow at 9:00 AM.
                  </p>
                )}
                {draft && (
                  <Alert tone="success" title="Draft prepared">
                    This is a draft. Nothing has been sent to the client or outside counsel.
                  </Alert>
                )}
              </>
            )}
          </aside>
        </article>
      </div>
    </section>
  );
}

function SourcesView({ diagnostics = false }: { diagnostics?: boolean }) {
  return (
    <section>
      <PageHeader
        title={diagnostics ? 'Diagnostics' : 'Sources & history'}
        description={
          diagnostics
            ? 'Technical information for support and administrators'
            : 'Where this information came from and how it changed'
        }
        actions={<Badge>{diagnostics ? 'Advanced' : 'Evidence'}</Badge>}
      />
      {diagnostics ? (
        <div className="agency-stack">
          <Alert title="Technical details">
            These identifiers support diagnosis. They do not change the client, case, trademark, or
            filing status.
          </Alert>
          <Card>
            <KeyValueList
              items={[
                { key: 'Owner reference', value: 'formal-matter_01J8NORTHSTAR' },
                { key: 'Exact version', value: '7' },
                { key: 'Source ID', value: 'uspto-tess-84210911' },
                { key: 'Fingerprint', value: 'sha256:09fa…72bc' },
                { key: 'Receipt', value: 'review-receipt_0182' },
                { key: 'Technical currentness', value: 'CURRENT' }
              ]}
            />
          </Card>
        </div>
      ) : (
        <div className="agency-stack">
          <Card>
            <TrustLabel kind="official" />
            <h2>USPTO official record</h2>
            <p>Status accepted · checked 18 minutes ago</p>
            <p>Evidence: TSDR status document dated 16 September 2026.</p>
          </Card>
          <Card>
            <TrustLabel kind="workspace" />
            <h2>Workspace information</h2>
            <p>Client instructions recorded by Alex Morgan yesterday at 4:12 PM.</p>
          </Card>
          <Card>
            <TrustLabel kind="ai" />
            <h2>AI interpretation</h2>
            <p>
              The status change may require a client update. This is a suggestion, not an official
              record.
            </p>
            <p>
              <strong>Assumption:</strong> the client expects updates after substantive examination
              events.
            </p>
          </Card>
          <Alert tone="warning" title="One conflict needs review">
            The workspace due date differs from the official record by one day. No date has been
            selected automatically.
          </Alert>
        </div>
      )}
    </section>
  );
}

function MoreView({ onOpenDiagnostics }: { onOpenDiagnostics: () => void }) {
  return (
    <section>
      <PageHeader title="More / Apps" description="Specialist and lower-frequency tools" />
      <div className="agency-app-grid">
        {['Website', 'Trading', 'Content', 'Growth', 'Team Playbook', 'Settings'].map((item) => (
          <Card key={item}>
            <h2>{item}</h2>
            <p>
              {item === 'Website'
                ? 'Manage what visitors see, domains, services and languages.'
                : `Open ${item} tools for this workspace.`}
            </p>
            <Button variant="secondary">Open {item}</Button>
          </Card>
        ))}
        <Card>
          <h2>Diagnostics</h2>
          <p>Inspect technical sources, versions, identifiers and receipts.</p>
          <Button variant="secondary" onClick={onOpenDiagnostics}>
            Open Diagnostics
          </Button>
        </Card>
      </div>
    </section>
  );
}

export function AgencyIaPrototype({
  initialSurface = 'today',
  state = 'populated',
  initialMessageId,
  mobile = false
}: AgencyIaPrototypeProps) {
  const [surface, setSurface] = useState<AgencyPrototypeSurface>(initialSurface);
  const [newOpen, setNewOpen] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [status, setStatus] = useState('');
  const activePrimary = surface === 'case-detail' ? 'cases' : surface;
  const content = useMemo(() => {
    if (surface === 'today') return <TodayView onOpenInbox={() => setSurface('inbox')} />;
    if (surface === 'cases') return <CasesView onOpenCase={() => setSurface('case-detail')} />;
    if (surface === 'case-detail') return <CaseDetailView onBack={() => setSurface('cases')} />;
    if (surface === 'trademarks') return <TrademarksView />;
    if (surface === 'clients') return <ClientsView />;
    if (surface === 'inbox')
      return <InboxView {...(initialMessageId ? { initialMessageId } : {})} />;
    if (surface === 'sources') return <SourcesView />;
    if (surface === 'diagnostics') return <SourcesView diagnostics />;
    return <MoreView onOpenDiagnostics={() => setSurface('diagnostics')} />;
  }, [surface, initialMessageId]);
  return (
    <div className={`agency-prototype${mobile ? ' agency-prototype--mobile' : ''}`}>
      <aside className="agency-sidebar">
        <a className="agency-brand" href="#agency-main">
          MarkOrbit <span>Agency prototype</span>
        </a>
        <nav aria-label="Candidate primary navigation">
          {primaryNavigation.map((item) => (
            <button
              key={item.id}
              aria-current={activePrimary === item.id ? 'page' : undefined}
              onClick={() => setSurface(item.id)}
            >
              {item.label}
              {item.count ? <Badge>{item.count}</Badge> : null}
            </button>
          ))}
          <hr />
          <button
            aria-current={surface === 'more' ? 'page' : undefined}
            onClick={() => setSurface('more')}
          >
            More / Apps
          </button>
        </nav>
        <div className="agency-sidebar__footer">
          <p>
            <strong>Northstar IP</strong>
            <br />
            <span>Professional workspace</span>
          </p>
          <button>Switch workspace</button>
        </div>
      </aside>
      <div className="agency-body">
        <header className="agency-topbar">
          <div className="agency-mobile-brand">MarkOrbit</div>
          <div className="agency-global-actions">
            <div className="agency-popover-anchor">
              <Button
                onClick={() => {
                  setNewOpen((value) => !value);
                  setAskOpen(false);
                }}
              >
                + New
              </Button>
              {newOpen && (
                <div className="agency-popover" role="menu" aria-label="Create new">
                  <strong>Create new</strong>
                  {[
                    'New case',
                    'New trademark intake',
                    'New client',
                    'New task',
                    'New website content',
                    'New listing'
                  ].map((item) => (
                    <button
                      key={item}
                      role="menuitem"
                      onClick={() => {
                        setStatus(`${item} selected. No record was created in this prototype.`);
                        setNewOpen(false);
                      }}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="agency-popover-anchor">
              <Button
                variant="secondary"
                onClick={() => {
                  setAskOpen((value) => !value);
                  setNewOpen(false);
                }}
              >
                Ask MO
              </Button>
              {askOpen && (
                <div
                  className="agency-popover agency-popover--wide"
                  role="dialog"
                  aria-label="Ask MO"
                >
                  <strong>
                    Ask MO about{' '}
                    {surface === 'case-detail'
                      ? 'this case'
                      : surface === 'inbox'
                        ? 'this message'
                        : 'this workspace'}
                  </strong>
                  <TextInput label="Question" placeholder="What should I do next?" />
                  <p>
                    <TrustLabel kind="ai" /> Answers are suggestions and do not send, file, or
                    approve anything.
                  </p>
                  <Button onClick={() => setStatus('MO response prepared as a suggestion.')}>
                    Ask
                  </Button>
                </div>
              )}
            </div>
            <button className="agency-avatar" aria-label="Open account menu">
              AM
            </button>
          </div>
        </header>
        <main id="agency-main" tabIndex={-1}>
          <StateBoundary state={state}>{content}</StateBoundary>
          {status && (
            <p className="agency-toast" role="status">
              {status}
            </p>
          )}
        </main>
        <nav className="agency-mobile-nav" aria-label="Mobile primary navigation">
          {primaryNavigation.slice(0, 4).map((item) => (
            <button
              key={item.id}
              aria-current={activePrimary === item.id ? 'page' : undefined}
              onClick={() => setSurface(item.id)}
            >
              {item.label}
            </button>
          ))}
          <button
            aria-current={activePrimary === 'inbox' ? 'page' : undefined}
            onClick={() => setSurface('inbox')}
          >
            Inbox
          </button>
        </nav>
      </div>
    </div>
  );
}

export { vocabulary };
