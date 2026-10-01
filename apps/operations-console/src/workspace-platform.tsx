import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  Alert,
  Button,
  Card,
  DataList,
  EmptyState,
  PageHeader,
  Select,
  TextInput
} from '@markorbit/ui';
import {
  loadWorkspaceAdminPortfolio,
  renameWorkspaceDisplayName,
  type WorkspaceAdminDirection,
  type WorkspaceAdminItem,
  type WorkspaceAdminPortfolio,
  type WorkspaceAdminSort,
  type WorkspaceAdminStatus
} from './workspace-admin.js';
import './super-admin/styles.css';

const unavailableTruth =
  'No accepted owner projection is connected for this fact yet. It is not treated as empty, zero or healthy.';

function displayTime(value: string): string {
  return new Date(value).toLocaleString();
}

function StatusPill({ status }: { status: WorkspaceAdminStatus }) {
  return (
    <span className={`mo-workspace-status mo-workspace-status--${status.toLowerCase()}`}>
      {status}
    </span>
  );
}
export function WorkspacePlatformWorkspace({
  loadPortfolio = loadWorkspaceAdminPortfolio,
  renameWorkspace = renameWorkspaceDisplayName,
  initialWorkspaceId
}: {
  loadPortfolio?: typeof loadWorkspaceAdminPortfolio;
  renameWorkspace?: typeof renameWorkspaceDisplayName;
  initialWorkspaceId?: string;
} = {}) {
  const [snapshot, setSnapshot] = useState<WorkspaceAdminPortfolio | null>(null);
  const [selected, setSelected] = useState<WorkspaceAdminItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [status, setStatus] = useState<'ALL' | WorkspaceAdminStatus>('ALL');
  const [sort, setSort] = useState<WorkspaceAdminSort>('UPDATED_AT');
  const [direction, setDirection] = useState<WorkspaceAdminDirection>('DESC');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [renameName, setRenameName] = useState('');
  const [renameReason, setRenameReason] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameStatus, setRenameStatus] = useState<string | null>(null);

  const query = useMemo(
    () => ({
      page,
      pageSize,
      sort,
      direction,
      ...(status === 'ALL' ? {} : { status }),
      ...(search ? { search } : {})
    }),
    [page, pageSize, sort, direction, status, search]
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSnapshot(null);
    void loadPortfolio(query)
      .then((result) => {
        if (!active) return;
        setSnapshot(result);
        setSelected((current) => {
          const requestedId =
            initialWorkspaceId ??
            new URLSearchParams(window.location.search).get('adminWorkspaceId');
          const workspaceId = current?.workspaceId ?? requestedId;
          return workspaceId
            ? (result.items.find((item) => item.workspaceId === workspaceId) ?? null)
            : null;
        });
      })
      .catch((cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Workspace portfolio is unavailable.');
        setSelected(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialWorkspaceId, loadPortfolio, query]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const next = searchDraft.trim();
    setPage(1);
    setSearch(next);
  };

  const clearSearch = () => {
    setSearchDraft('');
    setSearch('');
    setPage(1);
  };

  const openWorkspace = (item: WorkspaceAdminItem) => {
    setSelected(item);
    setRenameName(item.name);
    setRenameReason('');
    setRenameError(null);
    setRenameStatus(null);
    const url = new URL(window.location.href);
    url.searchParams.set('adminWorkspaceId', item.workspaceId);
    window.history.pushState(null, '', url);
  };

  const closeWorkspace = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('adminWorkspaceId');
    window.history.pushState(null, '', url);
  };

  useEffect(() => {
    const followHistory = () => {
      const workspaceId = new URLSearchParams(window.location.search).get('adminWorkspaceId');
      if (!workspaceId) {
        setSelected(null);
        return;
      }
      setSelected((current) =>
        current?.workspaceId === workspaceId
          ? current
          : (snapshot?.items.find((item) => item.workspaceId === workspaceId) ?? null)
      );
    };
    window.addEventListener('popstate', followHistory);
    return () => window.removeEventListener('popstate', followHistory);
  }, [snapshot]);

  const renameSelected = async () => {
    if (!selected) return;
    setRenameBusy(true);
    setRenameError(null);
    setRenameStatus(null);
    try {
      const updated = await renameWorkspace(
        selected.workspaceId,
        selected.version,
        renameName.trim(),
        renameReason.trim()
      );
      const merged = { ...selected, ...updated };
      setSelected(merged);
      setSnapshot((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.workspaceId === merged.workspaceId ? { ...item, ...updated } : item
              )
            }
          : current
      );
      setRenameName(updated.name);
      setRenameReason('');
      setRenameStatus(`Workspace renamed. Core version is now v${updated.version}.`);
    } catch (cause) {
      setRenameError(cause instanceof Error ? cause.message : 'Workspace rename is unavailable.');
    } finally {
      setRenameBusy(false);
    }
  };

  const pageCount = snapshot ? Math.max(1, Math.ceil(snapshot.total / snapshot.pageSize)) : 1;

  return (
    <section id="super-admin-workspace" className="mo-workspace-admin">
      <PageHeader
        title="Workspace"
        description="Platform-wide Workspace administration backed by Core owner truth. This is not the currently selected Workspace view."
      />
      <nav
        className="mo-domain-tabs"
        aria-label="Workspace administration"
        hidden={Boolean(selected)}
      >
        <a href="#workspace-overview">Overview</a>
        <a href="#workspace-directory">All Workspaces</a>
        <button disabled title="Owner contract not connected">
          Plans & Billing
        </button>
        <button disabled title="Owner contract not connected">
          Membership
        </button>
        <button disabled title="Owner contract not connected">
          Quotas
        </button>
        <button disabled title="Owner contract not connected">
          Invitations
        </button>
        <button disabled title="Owner audit read contract not connected">
          Audit
        </button>
      </nav>
      <Alert tone="info" title="Core-owned portfolio">
        Workspace identity, lifecycle, version and membership counts below come from the Core owner
        read model with exact <code>workspace-admin:read</code> authority. Missing commercial or
        usage facts stay unavailable.
      </Alert>

      <div id="workspace-overview" className="mo-workspace-metrics" hidden={Boolean(selected)}>
        <Card>
          <span className="mo-metric-label">All Workspaces</span>
          <strong className="mo-metric-value">{snapshot ? snapshot.summary.total : '—'}</strong>
          <small>{snapshot ? 'Core owner total' : 'Awaiting owner read'}</small>
        </Card>
        <Card>
          <span className="mo-metric-label">Active</span>
          <strong className="mo-metric-value">
            {snapshot ? snapshot.summary.byStatus.ACTIVE : '—'}
          </strong>
          <small>Actual Core lifecycle state</small>
        </Card>
        <Card>
          <span className="mo-metric-label">Archived</span>
          <strong className="mo-metric-value">
            {snapshot ? snapshot.summary.byStatus.ARCHIVED : '—'}
          </strong>
          <small>Actual Core lifecycle state</small>
        </Card>
        <Card>
          <span className="mo-metric-label">Plan / billing</span>
          <strong className="mo-metric-value mo-metric-value--small">Unavailable</strong>
          <small>No authoritative Workspace-wide owner projection connected</small>
        </Card>
      </div>

      {!selected && loading && (
        <Alert tone="info" title="Loading Workspace portfolio">
          Reading the global Core-owned Workspace portfolio through the governed Gateway.
        </Alert>
      )}
      {!selected && !loading && error && (
        <Alert tone="warning" title="Workspace portfolio unavailable">
          {error} {unavailableTruth}
        </Alert>
      )}
      <Card className={`mo-workspace-directory-card${selected ? ' is-hidden' : ''}`}>
        <div id="workspace-directory" className="mo-workspace-directory-header">
          <div>
            <h2>All Workspaces</h2>
            <p>Search by exact Workspace name or Workspace ID, then filter and sort owner-side.</p>
          </div>
          {snapshot && <small>Observed {displayTime(snapshot.observedAt)} · owner CORE</small>}
        </div>
        <form className="mo-workspace-filters" onSubmit={submitSearch}>
          <TextInput
            label="Workspace name or ID"
            placeholder="Exact name or Workspace ID"
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
          />
          <Select
            label="Status"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value as 'ALL' | WorkspaceAdminStatus);
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
          <Select
            label="Sort"
            value={sort}
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value as WorkspaceAdminSort);
            }}
          >
            <option value="UPDATED_AT">Last updated</option>
            <option value="NAME">Name</option>
            <option value="CREATED_AT">Created</option>
            <option value="MEMBERS">Active members</option>
          </Select>
          <Select
            label="Direction"
            value={direction}
            onChange={(event) => {
              setPage(1);
              setDirection(event.target.value as WorkspaceAdminDirection);
            }}
          >
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </Select>
          <div className="mo-workspace-filter-actions">
            <Button type="submit" disabled={loading}>
              Search
            </Button>
            <Button type="button" variant="secondary" disabled={loading} onClick={clearSearch}>
              Clear
            </Button>
          </div>
        </form>

        {!loading && snapshot && snapshot.items.length === 0 && (
          <EmptyState
            title={snapshot.summary.total === 0 ? 'No Workspaces exist' : 'No Workspaces match'}
            description={
              snapshot.summary.total === 0
                ? 'Core owner truth currently reports zero Workspaces.'
                : 'Change the current owner-backed search or status filter.'
            }
          />
        )}

        {!loading && snapshot && snapshot.items.length > 0 && (
          <div className="mo-workspace-table-wrap">
            <table className="mo-workspace-table">
              <thead>
                <tr>
                  <th>Workspace</th>
                  <th>Status</th>
                  <th>Members</th>
                  <th>Updated</th>
                  <th>Version</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {snapshot.items.map((item) => (
                  <tr key={item.workspaceId}>
                    <td data-label="Workspace">
                      <strong>{item.name}</strong>
                      <small>{item.workspaceId}</small>
                    </td>
                    <td data-label="Status">
                      <StatusPill status={item.status} />
                    </td>
                    <td data-label="Members">
                      {item.activeMembershipCount} active / {item.membershipCount} total
                    </td>
                    <td data-label="Updated">{displayTime(item.updatedAt)}</td>
                    <td data-label="Version">v{item.version}</td>
                    <td data-label="Actions">
                      <Button variant="secondary" onClick={() => openWorkspace(item)}>
                        View
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && snapshot && (
          <div className="mo-workspace-pagination">
            <span>
              {snapshot.total} matching · page {snapshot.page} of {pageCount}
            </span>
            <Select
              label="Rows"
              value={String(pageSize)}
              onChange={(event) => {
                setPage(1);
                setPageSize(Number(event.target.value));
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
            <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
              variant="secondary"
              disabled={page >= pageCount}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </Card>
      {selected && (
        <Card className="mo-workspace-detail">
          <div className="mo-workspace-detail__header">
            <div>
              <span className="mo-eyebrow">Workspace detail</span>
              <h2>{selected.name}</h2>
              <p>{selected.workspaceId}</p>
            </div>
            <Button variant="secondary" onClick={closeWorkspace}>
              Back to Workspaces
            </Button>
          </div>
          <div className="mo-workspace-detail-grid">
            <div>
              <h3>Identity & lifecycle</h3>
              <DataList
                items={[
                  { label: 'Status', value: <StatusPill status={selected.status} /> },
                  { label: 'Slug', value: selected.slug },
                  { label: 'Version', value: `v${selected.version}` },
                  { label: 'Created', value: displayTime(selected.createdAt) },
                  { label: 'Last Core update', value: displayTime(selected.updatedAt) }
                ]}
              />
            </div>
            <div>
              <h3>Membership summary</h3>
              <DataList
                items={[
                  { label: 'Active members', value: selected.activeMembershipCount },
                  { label: 'All membership records', value: selected.membershipCount },
                  { label: 'Member / role detail', value: 'Unavailable' }
                ]}
              />
            </div>
          </div>
          <div className="mo-workspace-management">
            <h3>Management</h3>
            <p>
              Rename display name is the first accepted low-risk owner command. It requires exact
              <code> workspace-admin:manage</code>, CSRF, current Workspace version and durable
              audit.
            </p>
            <TextInput
              label="Display name"
              value={renameName}
              disabled={renameBusy || selected.status !== 'ACTIVE'}
              onChange={(event) => setRenameName(event.target.value)}
            />
            <TextInput
              label="Reason / audit note"
              value={renameReason}
              disabled={renameBusy || selected.status !== 'ACTIVE'}
              onChange={(event) => setRenameReason(event.target.value)}
            />
            <Button
              disabled={
                renameBusy ||
                selected.status !== 'ACTIVE' ||
                !renameName.trim() ||
                !renameReason.trim() ||
                renameName.trim() === selected.name
              }
              onClick={() => void renameSelected()}
            >
              {renameBusy ? 'Renaming…' : 'Rename Workspace'}
            </Button>
            {renameStatus && (
              <Alert tone="info" title="Workspace updated">
                {renameStatus}
              </Alert>
            )}
            {renameError && (
              <Alert tone="warning" title="Workspace rename unavailable">
                {renameError}
              </Alert>
            )}
          </div>
          <Alert tone="warning" title="Not connected in V1">
            Plans / billing, quota usage, invitation management, member-role detail, related
            Matters/orders and Workspace-specific audit do not yet have accepted portfolio owner
            reads here. {unavailableTruth}
          </Alert>
        </Card>
      )}
    </section>
  );
}
