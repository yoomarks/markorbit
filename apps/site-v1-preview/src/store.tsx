import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import {
  defaultSiteId,
  nextLeadId,
  seedSite,
  siteIds,
  workspaceIds,
  workspacePortfolios,
  type DemoLead,
  type DemoSiteId,
  type SiteCollectionSelection,
  type SiteConfig,
  type SiteState,
  type WorkspaceId
} from './domain.js';

const storagePrefix = 'markorbit:site-v1-preview:';
const siteStorageKey = (siteId: DemoSiteId) => `${storagePrefix}site:${siteId}`;

export type SiteSelector = WorkspaceId | DemoSiteId;

function selectorSiteId(selector: SiteSelector): DemoSiteId {
  return selector.startsWith('site_')
    ? (selector as DemoSiteId)
    : defaultSiteId(selector as WorkspaceId);
}

function validState(value: unknown, expectedSiteId: DemoSiteId): value is SiteState {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<SiteState>;
  return (
    state.siteId === expectedSiteId &&
    Boolean(state.draft?.localized) &&
    Boolean(state.published?.localized)
  );
}

function normalizeState(state: SiteState): SiteState {
  const seed = seedSite(state.siteId);
  const collection = state.collection
    ? {
        ...seed.collection,
        ...state.collection,
        draft: { ...seed.collection.draft, ...state.collection.draft },
        active: state.collection.active
          ? { ...seed.collection.active, ...state.collection.active }
          : seed.collection.active,
        activatedAt: state.collection.activatedAt || seed.collection.activatedAt
      }
    : seed.collection;
  return {
    ...state,
    sharedSources: state.sharedSources ?? seed.sharedSources,
    collection,
    promotionGrants: state.promotionGrants ?? seed.promotionGrants,
    attributedOrders: state.attributedOrders ?? seed.attributedOrders,
    leads: state.leads.map((lead) => ({
      ...lead,
      channel: lead.channel ?? state.terminal
    }))
  };
}

function load(siteId: DemoSiteId): SiteState {
  try {
    const direct = localStorage.getItem(siteStorageKey(siteId));
    if (direct) {
      const parsed = JSON.parse(direct) as unknown;
      if (validState(parsed, siteId)) return normalizeState(parsed);
    }

    // Compatibility: migrate the former one-record-per-Workspace fixture into its default Web Site.
    const workspaceId: WorkspaceId = siteId === 'site_foundry_demo' ? 'foundry' : 'atlas';
    if (defaultSiteId(workspaceId) === siteId) {
      const legacy = localStorage.getItem(`${storagePrefix}${workspaceId}`);
      if (legacy) {
        const parsed = JSON.parse(legacy) as Partial<SiteState>;
        if (parsed.draft?.localized && parsed.published?.localized) {
          const seed = seedSite(siteId);
          return normalizeState({
            ...seed,
            ...parsed,
            siteId,
            siteName: seed.siteName,
            terminal: 'WEB'
          });
        }
      }
    }
  } catch {
    // A malformed local fixture is replaced by the deterministic seed below.
  }
  return seedSite(siteId);
}

function initial(): Record<DemoSiteId, SiteState> {
  return {
    site_atlas_demo: load('site_atlas_demo'),
    site_atlas_mini_demo: load('site_atlas_mini_demo'),
    site_foundry_demo: load('site_foundry_demo')
  };
}

export interface PreviewStore {
  sites: Record<DemoSiteId, SiteState>;
  /** Default Web Site aliases retained for legacy Preview consumers. */
  workspaces: Record<WorkspaceId, SiteState>;
  site(selector: SiteSelector): SiteState;
  workspaceSites(id: WorkspaceId): SiteState[];
  updateDraft(selector: SiteSelector, update: (draft: SiteConfig) => SiteConfig): void;
  saveDraft(selector: SiteSelector): void;
  publish(
    selector: SiteSelector,
    label?: string,
    prepare?: (draft: SiteConfig) => SiteConfig
  ): number;
  restore(selector: SiteSelector, version: number): void;
  submitLead(
    selector: SiteSelector,
    lead: Omit<DemoLead, 'id' | 'workspaceId' | 'siteId' | 'channel' | 'createdAt' | 'status'>
  ): DemoLead;
  updateLead(selector: SiteSelector, leadId: string, status: DemoLead['status']): void;
  updateCollectionDraft(selector: SiteSelector, merchantRelationshipId: string): void;
  activateCollection(selector: SiteSelector): number;
  applyOperationsProposal(selector: SiteSelector, body: string): void;
  reset(selector?: SiteSelector): void;
  setRole(selector: SiteSelector, role: SiteState['role']): void;
  resetDemoAccess(selector: SiteSelector): void;
}

const StoreContext = createContext<PreviewStore | undefined>(undefined);

export function PreviewStoreProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState(initial);

  const requireOwner = useCallback(
    (selector: SiteSelector) => {
      if (sites[selectorSiteId(selector)].role !== 'OWNER')
        throw new Error('SITE_PREVIEW_FORBIDDEN');
    },
    [sites]
  );

  const commit = useCallback((next: Record<DemoSiteId, SiteState>) => {
    setSites(next);
    for (const siteId of siteIds)
      localStorage.setItem(siteStorageKey(siteId), JSON.stringify(next[siteId]));
    for (const workspaceId of workspaceIds) {
      const defaultId = defaultSiteId(workspaceId);
      localStorage.setItem(`${storagePrefix}${workspaceId}`, JSON.stringify(next[defaultId]));
    }
  }, []);

  const value = useMemo<PreviewStore>(() => {
    const workspaces = {
      atlas: sites.site_atlas_demo,
      foundry: sites.site_foundry_demo
    };
    return {
      sites,
      workspaces,
      site: (selector) => sites[selectorSiteId(selector)],
      workspaceSites: (id) =>
        workspacePortfolios[id].siteIds
          .map((siteId) => sites[siteId])
          .filter((site) => site.role !== 'NONE'),
      updateDraft(selector, update) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        commit({
          ...sites,
          [siteId]: { ...sites[siteId], draft: update(structuredClone(sites[siteId].draft)) }
        });
      },
      saveDraft(selector) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        commit({ ...sites, [siteId]: { ...sites[siteId], savedAt: new Date().toISOString() } });
      },
      publish(selector, label = 'Demo publication', prepare) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        const version = site.versions.length + 1;
        const publishedAt = new Date().toISOString();
        const config = prepare ? prepare(structuredClone(site.draft)) : structuredClone(site.draft);
        commit({
          ...sites,
          [siteId]: {
            ...site,
            lifecycle: 'ACTIVE',
            published: config,
            publishedAt,
            savedAt: publishedAt,
            versions: [
              ...site.versions,
              { version, publishedAt, label, config: structuredClone(config) }
            ]
          }
        });
        return version;
      },
      restore(selector, version) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        const historical = site.versions.find((item) => item.version === version);
        if (!historical) return;
        commit({
          ...sites,
          [siteId]: {
            ...site,
            draft: structuredClone(historical.config),
            savedAt: new Date().toISOString()
          }
        });
      },
      submitLead(selector, input) {
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        const duplicate = site.leads.find(
          (lead) =>
            lead.email === input.email &&
            lead.message === input.message &&
            lead.sourcePath === input.sourcePath
        );
        if (duplicate) return duplicate;
        const lead: DemoLead = {
          ...input,
          id: nextLeadId(site.leads.length),
          workspaceId: site.workspaceId,
          siteId: site.siteId,
          channel: site.terminal,
          createdAt: new Date().toISOString(),
          status: 'NEW'
        };
        commit({ ...sites, [siteId]: { ...site, leads: [lead, ...site.leads] } });
        return lead;
      },
      updateLead(selector, leadId, status) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        commit({
          ...sites,
          [siteId]: {
            ...site,
            leads: site.leads.map((lead) => (lead.id === leadId ? { ...lead, status } : lead))
          }
        });
      },
      updateCollectionDraft(selector, merchantRelationshipId) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        const relationship = site.collection.authorizedRelationships.find(
          (item) =>
            item.id === merchantRelationshipId && item.supportedTerminals.includes(site.terminal)
        );
        if (!relationship) throw new Error('SITE_COLLECTION_MERCHANT_NOT_AUTHORIZED');
        const draft: SiteCollectionSelection = {
          merchantRelationshipId: relationship.id,
          provider: relationship.provider,
          relationship: relationship.relationship
        };
        commit({
          ...sites,
          [siteId]: { ...site, collection: { ...site.collection, draft } }
        });
      },
      activateCollection(selector) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        const relationship = site.collection.authorizedRelationships.find(
          (item) =>
            item.id === site.collection.draft.merchantRelationshipId &&
            item.provider === site.collection.draft.provider &&
            item.relationship === site.collection.draft.relationship &&
            item.supportedTerminals.includes(site.terminal)
        );
        if (!relationship) throw new Error('SITE_COLLECTION_MERCHANT_NOT_AUTHORIZED');
        const version = site.collection.version + 1;
        commit({
          ...sites,
          [siteId]: {
            ...site,
            collection: {
              ...site.collection,
              active: structuredClone(site.collection.draft),
              version,
              activatedAt: new Date().toISOString()
            }
          }
        });
        return version;
      },
      applyOperationsProposal(selector, body) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        const site = sites[siteId];
        commit({
          ...sites,
          [siteId]: {
            ...site,
            draft: {
              ...site.draft,
              localized: {
                ...site.draft.localized,
                'zh-CN': {
                  ...site.draft.localized['zh-CN'],
                  blocks: {
                    ...site.draft.localized['zh-CN'].blocks,
                    hero: {
                      ...(site.draft.localized['zh-CN'].blocks.hero ?? {
                        label: '首页欢迎区',
                        title: '欢迎',
                        body: ''
                      }),
                      body: `对话提案已加入草稿：${body}`
                    }
                  }
                }
              },
              localePublication: { ...site.draft.localePublication, 'zh-CN': 'DRAFT' }
            },
            savedAt: new Date().toISOString()
          }
        });
      },
      reset(selector) {
        if (selector) requireOwner(selector);
        const targets = selector ? [selectorSiteId(selector)] : siteIds;
        const next = { ...sites };
        for (const siteId of targets) next[siteId] = seedSite(siteId);
        commit(next);
      },
      setRole(selector, role) {
        requireOwner(selector);
        const siteId = selectorSiteId(selector);
        commit({ ...sites, [siteId]: { ...sites[siteId], role } });
      },
      resetDemoAccess(selector) {
        const siteId = selectorSiteId(selector);
        commit({ ...sites, [siteId]: seedSite(siteId) });
      }
    };
  }, [commit, requireOwner, sites]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePreviewStore(): PreviewStore {
  const value = useContext(StoreContext);
  if (!value) throw new Error('PreviewStoreProvider is required.');
  return value;
}

export function hasUnpublishedChanges(site: SiteState): boolean {
  return JSON.stringify(site.draft) !== JSON.stringify(site.published);
}

export const demoStoragePrefix = storagePrefix;
export { siteStorageKey };
