import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode
} from 'react';
import {
  defaultSiteId,
  siteIds,
  type AdminSection,
  type DemoSiteId,
  type Locale,
  type WorkspaceId
} from './domain.js';

export type Route =
  | { kind: 'landing' }
  | { kind: 'site-portfolio'; workspaceId: WorkspaceId }
  | { kind: 'admin'; siteId: DemoSiteId; section: AdminSection; itemId?: string }
  | {
      kind: 'site';
      siteId: DemoSiteId;
      path: string;
      mode: 'published' | 'draft';
      locale?: Locale;
    }
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
  if (
    parts[0] === 'admin' &&
    (parts[1] === 'atlas' || parts[1] === 'foundry') &&
    parts[2] === 'sites'
  )
    return { kind: 'site-portfolio', workspaceId: parts[1] };
  if (
    parts[0] === 'admin' &&
    (parts[1] === 'atlas' || parts[1] === 'foundry' || siteIds.includes(parts[1] as DemoSiteId))
  ) {
    const siteId = siteIds.includes(parts[1] as DemoSiteId)
      ? (parts[1] as DemoSiteId)
      : defaultSiteId(parts[1] as WorkspaceId);
    const section = (parts[2] ?? 'overview') as AdminSection;
    return sections.has(section)
      ? { kind: 'admin', siteId, section, ...(parts[3] ? { itemId: parts[3] } : {}) }
      : { kind: 'not-found', path: pathname };
  }
  if (
    parts[0] === 'site' &&
    (parts[1] === 'atlas' || parts[1] === 'foundry' || siteIds.includes(parts[1] as DemoSiteId))
  ) {
    const siteId = siteIds.includes(parts[1] as DemoSiteId)
      ? (parts[1] as DemoSiteId)
      : defaultSiteId(parts[1] as WorkspaceId);
    const isDraft = parts[2] === 'preview' && parts[3] === 'draft';
    const localePart = isDraft ? parts[4] : parts[2];
    const locale = localePart === 'zh-CN' || localePart === 'en-US' ? localePart : undefined;
    const pathParts = isDraft ? parts.slice(locale ? 5 : 4) : parts.slice(locale ? 3 : 2);
    return {
      kind: 'site',
      siteId,
      path: `/${pathParts.join('/')}`.replace(/\/$/u, '') || '/',
      mode: isDraft ? 'draft' : 'published',
      ...(locale ? { locale } : {})
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
  let resolvedHref = href;
  if (router.route.kind === 'site' && router.route.locale) {
    const sitePrefix = `/site/${router.route.siteId}`;
    if (href === sitePrefix || href.startsWith(`${sitePrefix}/`)) {
      const rawRemainder = href.slice(sitePrefix.length);
      const hasExplicitLocale =
        /^\/(?:zh-CN|en-US)(?=\/|$)/u.test(rawRemainder) ||
        /^\/preview\/draft\/(?:zh-CN|en-US)(?=\/|$)/u.test(rawRemainder);
      if (hasExplicitLocale) resolvedHref = href;
      else {
        const remainder = rawRemainder;
        const localizedPrefix =
          router.route.mode === 'draft'
            ? `${sitePrefix}/preview/draft/${router.route.locale}`
            : `${sitePrefix}/${router.route.locale}`;
        resolvedHref = `${localizedPrefix}${remainder || '/'}`;
      }
    }
  }
  return (
    <a
      href={resolvedHref}
      className={className}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && event.button === 0) {
          event.preventDefault();
          router.navigate(resolvedHref);
        }
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
