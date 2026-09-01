import type { FormalMatterListQuery, FormalMatterListResponse } from '@markorbit/contracts';
import { createApiClient, type ApiClient } from './client.js';

export interface FormalMatterListClient {
  list(query?: Partial<FormalMatterListQuery>): Promise<FormalMatterListResponse>;
}

export function createFormalMatterListClient(
  api: ApiClient = createApiClient()
): FormalMatterListClient {
  return {
    list(query = {}) {
      const search = new URLSearchParams();
      if (query.status) search.set('status', query.status);
      if (query.type) search.set('type', query.type);
      if (query.search) search.set('search', query.search);
      if (query.createdFrom) search.set('createdFrom', query.createdFrom);
      if (query.createdTo) search.set('createdTo', query.createdTo);
      if (query.page !== undefined) search.set('page', String(query.page));
      if (query.pageSize !== undefined) search.set('pageSize', String(query.pageSize));
      const suffix = search.toString();
      return api.get<FormalMatterListResponse>(
        `/api/markreg/formal-matters${suffix ? `?${suffix}` : ''}`
      );
    }
  };
}
