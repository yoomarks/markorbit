import { liteHashForSurface, type LiteSurface } from './workspace-shell.js';

export type LiteNavigationParams = Readonly<Record<string, string | number | undefined | null>>;

export interface LiteNavigationTarget {
  readonly surface: LiteSurface;
  readonly workspaceId?: string;
  readonly params?: LiteNavigationParams;
}

function assignParams(search: URLSearchParams, params: LiteNavigationParams | undefined) {
  if (!params) return;
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') search.delete(key);
    else search.set(key, String(value));
  }
}

export function liteWorkspaceIdFromLocation(
  location: Pick<Location, 'search'>,
  fallback = ''
): string {
  return new URLSearchParams(location.search).get('workspaceId') ?? fallback;
}

export function buildLiteHref(target: LiteNavigationTarget): string {
  const search = new URLSearchParams();
  if (target.workspaceId) search.set('workspaceId', target.workspaceId);
  assignParams(search, target.params);
  const query = search.toString();
  return `${query ? `?${query}` : ''}${liteHashForSurface(target.surface)}`;
}

export function updateLiteLocation(
  target: LiteNavigationTarget,
  options: Readonly<{
    replace?: boolean;
    preserveSearch?: boolean;
    event?: 'popstate' | 'hashchange';
  }> = {}
): void {
  const url = new URL(window.location.href);
  if (!options.preserveSearch) url.search = '';
  if (target.workspaceId) url.searchParams.set('workspaceId', target.workspaceId);
  else if (!options.preserveSearch) url.searchParams.delete('workspaceId');
  assignParams(url.searchParams, target.params);
  url.hash = liteHashForSurface(target.surface);
  window.history[options.replace ? 'replaceState' : 'pushState']({}, '', url);
  window.dispatchEvent(
    options.event === 'hashchange'
      ? new HashChangeEvent('hashchange')
      : new PopStateEvent('popstate')
  );
}
