export type LiteSurface =
  | 'today'
  | 'matters'
  | 'content'
  | 'guide'
  | 'trademarks'
  | 'capability'
  | 'work'
  | 'customers'
  | 'opportunities'
  | 'professional-review'
  | 'execution-release';

export type LitePrimaryDestination = 'today' | 'matters' | 'create' | 'portfolio' | 'work';

export interface LiteSurfaceDefinition {
  readonly surface: LiteSurface;
  readonly hash: `#${string}`;
  readonly primary: LitePrimaryDestination;
  readonly requiresWorkspace: boolean;
  readonly fixtureOnly?: boolean;
}

export const LITE_SURFACES: Readonly<Record<LiteSurface, LiteSurfaceDefinition>> = {
  today: {
    surface: 'today',
    hash: '#today',
    primary: 'today',
    requiresWorkspace: true
  },
  matters: {
    surface: 'matters',
    hash: '#matters',
    primary: 'matters',
    requiresWorkspace: true
  },
  content: {
    surface: 'content',
    hash: '#content',
    primary: 'create',
    requiresWorkspace: true
  },
  trademarks: {
    surface: 'trademarks',
    hash: '#trademarks',
    primary: 'portfolio',
    requiresWorkspace: true
  },
  work: {
    surface: 'work',
    hash: '#work',
    primary: 'work',
    requiresWorkspace: false
  },
  opportunities: {
    surface: 'opportunities',
    hash: '#opportunities',
    primary: 'work',
    requiresWorkspace: true
  },
  capability: {
    surface: 'capability',
    hash: '#capability',
    primary: 'work',
    requiresWorkspace: true
  },
  guide: {
    surface: 'guide',
    hash: '#guide',
    primary: 'work',
    requiresWorkspace: true
  },
  'professional-review': {
    surface: 'professional-review',
    hash: '#work-professional-review',
    primary: 'work',
    requiresWorkspace: false
  },
  'execution-release': {
    surface: 'execution-release',
    hash: '#work-execution-release',
    primary: 'work',
    requiresWorkspace: false
  },
  customers: {
    surface: 'customers',
    hash: '#work-customers',
    primary: 'work',
    requiresWorkspace: false,
    fixtureOnly: true
  }
};

export const LITE_PRIMARY_NAV = [
  { id: 'today', label: 'Today', surface: 'today' },
  { id: 'matters', label: 'Matters', surface: 'matters' },
  { id: 'create', label: 'Create', surface: 'content' },
  { id: 'portfolio', label: 'Portfolio', surface: 'trademarks' },
  { id: 'work', label: 'Work', surface: 'work' }
] as const satisfies ReadonlyArray<{
  id: LitePrimaryDestination;
  label: string;
  surface: LiteSurface;
}>;

const surfaceByHash = new Map(
  Object.values(LITE_SURFACES).map((definition) => [definition.hash, definition.surface] as const)
);

export function liteSurfaceFromHash(hash: string): LiteSurface | undefined {
  return surfaceByHash.get(hash);
}

export function litePrimaryForSurface(surface: LiteSurface): LitePrimaryDestination {
  return LITE_SURFACES[surface].primary;
}

export function liteHashForSurface(surface: LiteSurface): `#${string}` {
  return LITE_SURFACES[surface].hash;
}

export function isLiteFixtureSurface(surface: LiteSurface): boolean {
  return LITE_SURFACES[surface].fixtureOnly === true;
}
