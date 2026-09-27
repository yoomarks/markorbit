import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  nextLeadId,
  seedWorkspace,
  workspaceIds,
  type DemoLead,
  type SiteConfig,
  type WorkspaceId,
  type WorkspaceState
} from './domain.js';

const storagePrefix = 'markorbit:site-v1-preview:';

function load(id: WorkspaceId): WorkspaceState {
  try {
    const value = localStorage.getItem(`${storagePrefix}${id}`);
    return value ? (JSON.parse(value) as WorkspaceState) : seedWorkspace(id);
  } catch {
    return seedWorkspace(id);
  }
}

function initial(): Record<WorkspaceId, WorkspaceState> {
  return { atlas: load('atlas'), foundry: load('foundry') };
}

export interface PreviewStore {
  workspaces: Record<WorkspaceId, WorkspaceState>;
  updateDraft(id: WorkspaceId, update: (draft: SiteConfig) => SiteConfig): void;
  saveDraft(id: WorkspaceId): void;
  publish(id: WorkspaceId, label?: string, prepare?: (draft: SiteConfig) => SiteConfig): number;
  restore(id: WorkspaceId, version: number): void;
  submitLead(
    id: WorkspaceId,
    lead: Omit<DemoLead, 'id' | 'workspaceId' | 'siteId' | 'createdAt' | 'status'>
  ): DemoLead;
  updateLead(id: WorkspaceId, leadId: string, status: DemoLead['status']): void;
  reset(id?: WorkspaceId): void;
  setRole(id: WorkspaceId, role: WorkspaceState['role']): void;
  resetDemoAccess(id: WorkspaceId): void;
}

const StoreContext = createContext<PreviewStore | undefined>(undefined);

export function PreviewStoreProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState(initial);

  const requireOwner = useCallback(
    (id: WorkspaceId) => {
      if (workspaces[id].role !== 'OWNER') throw new Error('SITE_PREVIEW_FORBIDDEN');
    },
    [workspaces]
  );

  const commit = useCallback((next: Record<WorkspaceId, WorkspaceState>) => {
    setWorkspaces(next);
    for (const id of workspaceIds)
      localStorage.setItem(`${storagePrefix}${id}`, JSON.stringify(next[id]));
  }, []);

  const value = useMemo<PreviewStore>(
    () => ({
      workspaces,
      updateDraft(id, update) {
        requireOwner(id);
        commit({
          ...workspaces,
          [id]: { ...workspaces[id], draft: update(structuredClone(workspaces[id].draft)) }
        });
      },
      saveDraft(id) {
        requireOwner(id);
        commit({ ...workspaces, [id]: { ...workspaces[id], savedAt: new Date().toISOString() } });
      },
      publish(id, label = 'Demo publication', prepare) {
        requireOwner(id);
        const workspace = workspaces[id];
        const version = workspace.versions.length + 1;
        const publishedAt = new Date().toISOString();
        const config = prepare
          ? prepare(structuredClone(workspace.draft))
          : structuredClone(workspace.draft);
        commit({
          ...workspaces,
          [id]: {
            ...workspace,
            lifecycle: 'ACTIVE',
            published: config,
            publishedAt,
            savedAt: publishedAt,
            versions: [
              ...workspace.versions,
              { version, publishedAt, label, config: structuredClone(config) }
            ]
          }
        });
        return version;
      },
      restore(id, version) {
        requireOwner(id);
        const workspace = workspaces[id];
        const historical = workspace.versions.find((item) => item.version === version);
        if (!historical) return;
        commit({
          ...workspaces,
          [id]: {
            ...workspace,
            draft: structuredClone(historical.config),
            savedAt: new Date().toISOString()
          }
        });
      },
      submitLead(id, input) {
        const workspace = workspaces[id];
        const lead: DemoLead = {
          ...input,
          id: nextLeadId(workspace.leads.length),
          workspaceId: id,
          siteId: workspace.siteId,
          createdAt: new Date().toISOString(),
          status: 'NEW'
        };
        commit({ ...workspaces, [id]: { ...workspace, leads: [lead, ...workspace.leads] } });
        return lead;
      },
      updateLead(id, leadId, status) {
        requireOwner(id);
        const workspace = workspaces[id];
        commit({
          ...workspaces,
          [id]: {
            ...workspace,
            leads: workspace.leads.map((lead) => (lead.id === leadId ? { ...lead, status } : lead))
          }
        });
      },
      reset(id) {
        if (id) requireOwner(id);
        const next = { ...workspaces };
        for (const target of id ? [id] : workspaceIds) next[target] = seedWorkspace(target);
        commit(next);
      },
      setRole(id, role) {
        requireOwner(id);
        commit({ ...workspaces, [id]: { ...workspaces[id], role } });
      },
      resetDemoAccess(id) {
        const next = { ...workspaces, [id]: seedWorkspace(id) };
        commit(next);
      }
    }),
    [commit, requireOwner, workspaces]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePreviewStore(): PreviewStore {
  const value = useContext(StoreContext);
  if (!value) throw new Error('PreviewStoreProvider is required.');
  return value;
}

export function hasUnpublishedChanges(workspace: WorkspaceState): boolean {
  return JSON.stringify(workspace.draft) !== JSON.stringify(workspace.published);
}

export const demoStoragePrefix = storagePrefix;
