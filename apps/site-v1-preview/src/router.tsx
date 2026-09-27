import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode
} from 'react';
import type { AdminSection, WorkspaceId } from './domain.js';

export type Route =
  | { kind: 'landing' }
  | { kind: 'admin'; workspaceId: WorkspaceId; section: AdminSection; itemId?: string }
  | { kind: 'site'; workspaceId: WorkspaceId; path: string; mode: 'published' | 'draft' }
  | { kind: 'not-found'; path: string };

const sections = new Set<AdminSection>([
  'overview',
  'pages',
  'editor',
  'content',
  'services',
  'leads',
  'client-service',
  'analytics',
  'seo',
  'settings'
]);

export function parseRoute(pathname: string): Route {
  const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (!parts.length) return { kind: 'landing' };
  if (parts[0] === 'admin' && (parts[1] === 'atlas' || parts[1] === 'foundry')) {
    const section = (parts[2] ?? 'overview') as AdminSection;
    return sections.has(section)
      ? { kind: 'admin', workspaceId: parts[1], section, ...(parts[3] ? { itemId: parts[3] } : {}) }
      : { kind: 'not-found', path: pathname };
  }
  if (parts[0] === 'site' && (parts[1] === 'atlas' || parts[1] === 'foundry')) {
    const isDraft = parts[2] === 'preview' && parts[3] === 'draft';
    const pathParts = isDraft ? parts.slice(4) : parts.slice(2);
    return {
      kind: 'site',
      workspaceId: parts[1],
      path: `/${pathParts.join('/')}`.replace(/\/$/u, '') || '/',
      mode: isDraft ? 'draft' : 'published'
    };
  }
  return { kind: 'not-found', path: pathname };
}

interface RouterValue {
  route: Route;
  navigate(path: string): void;
}

const RouterContext = createContext<RouterValue | undefined>(undefined);

export function RouterProvider({
  children,
  initialPath
}: {
  children: ReactNode;
  initialPath?: string;
}) {
  const [route, setRoute] = useState(() => parseRoute(initialPath ?? window.location.pathname));
  useEffect(() => {
    const pop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', pop);
    return () => window.removeEventListener('popstate', pop);
  }, []);
  const value = useMemo<RouterValue>(
    () => ({
      route,
      navigate(path) {
        window.history.pushState({}, '', path);
        setRoute(parseRoute(path));
        if (!navigator.userAgent.includes('jsdom'))
          window.scrollTo({ top: 0, behavior: 'instant' });
      }
    }),
    [route]
  );
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export function useRouter(): RouterValue {
  const value = useContext(RouterContext);
  if (!value) throw new Error('RouterProvider is required.');
  return value;
}

export function Link({
  href,
  children,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  className?: string;
  [key: string]: unknown;
}) {
  const router = useRouter();
  return (
    <a
      href={href}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
          event.preventDefault();
          router.navigate(href);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
