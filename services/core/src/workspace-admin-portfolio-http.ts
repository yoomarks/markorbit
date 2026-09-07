import { parseInternalOperatorPrincipal, WORKSPACE_STATUSES } from '@markorbit/contracts';
import { HttpError, json, type JsonRequest, type JsonRoute } from '@markorbit/service-kit';
import { validateInternalServiceSecret } from './auth.js';
import {
  WORKSPACE_ADMIN_PORTFOLIO_AUTHORITY,
  type WorkspaceAdminPortfolioQueryV1,
  type WorkspaceAdminPortfolioReaderV1
} from './workspace-admin-portfolio.js';

export interface WorkspaceAdminPortfolioHttpOptionsV1 {
  reader: Readonly<WorkspaceAdminPortfolioReaderV1>;
  internalServiceSecret: string;
  now?: () => Date;
}

const allowedQueryKeys = new Set(['page', 'pageSize', 'status', 'search']);

function positiveInteger(
  value: string | undefined,
  fallback: number,
  field: string,
  max: number
): number {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/u.test(value))
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > max)
    throw new HttpError(400, 'INVALID_REQUEST', `${field} is invalid.`);
  return parsed;
}
function portfolioQuery(request: JsonRequest): WorkspaceAdminPortfolioQueryV1 {
  const unsupported = Object.keys(request.query).filter((key) => !allowedQueryKeys.has(key));
  if (unsupported.length)
    throw new HttpError(
      400,
      'INVALID_REQUEST',
      `Unsupported query fields: ${unsupported.join(', ')}.`
    );
  const status = request.query.status;
  if (status !== undefined && !(WORKSPACE_STATUSES as readonly string[]).includes(status))
    throw new HttpError(400, 'INVALID_REQUEST', 'status is invalid.');
  const search = request.query.search;
  if (search !== undefined && (!search || search.trim() !== search || search.length > 200))
    throw new HttpError(400, 'INVALID_REQUEST', 'search is invalid.');
  return {
    page: positiveInteger(request.query.page, 1, 'page', 1_000_000),
    pageSize: positiveInteger(request.query.pageSize, 50, 'pageSize', 100),
    ...(status === undefined ? {} : { status: status as 'ACTIVE' | 'ARCHIVED' }),
    ...(search === undefined ? {} : { search })
  };
}

function authorize(request: JsonRequest, options: WorkspaceAdminPortfolioHttpOptionsV1): void {
  if (
    !validateInternalServiceSecret(
      options.internalServiceSecret,
      request.headers['x-markorbit-internal-authorization']
    )
  )
    throw new HttpError(
      401,
      'INTERNAL_SERVICE_UNAUTHORIZED',
      'Internal service identity is invalid.'
    );
  let principal;
  try {
    principal = parseInternalOperatorPrincipal(request.headers['x-markorbit-principal']);
  } catch {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'Internal Operator principal is invalid.');
  }
  if (
    principal.capabilities.length !== 1 ||
    principal.capabilities[0] !== WORKSPACE_ADMIN_PORTFOLIO_AUTHORITY
  )
    throw new HttpError(
      403,
      'PERMISSION_DENIED',
      'Exact workspace-admin:read authority is required.'
    );
  const expiresAt = Date.parse(principal.sessionExpiresAt);
  const now = (options.now ?? (() => new Date()))().valueOf();
  if (!Number.isFinite(expiresAt) || expiresAt <= now)
    throw new HttpError(401, 'SESSION_EXPIRED', 'Internal Operator session is expired.');
}

export function createWorkspaceAdminPortfolioRoutesV1(
  options: WorkspaceAdminPortfolioHttpOptionsV1
): readonly JsonRoute[] {
  return [
    {
      method: 'GET',
      path: '/internal/super-admin/workspaces',
      async handle(request) {
        authorize(request, options);
        return json(200, await options.reader.read(portfolioQuery(request)));
      }
    }
  ];
}
