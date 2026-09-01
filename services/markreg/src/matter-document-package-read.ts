import type { FormalMatterId, WorkspacePrincipal } from '@markorbit/contracts';
import type { QueryClient } from '@markorbit/persistence';
import {
  DocumentPackageError,
  type PostgresDocumentPackageService
} from './document-package.js';

export interface MatterDocumentPackageReadService {
  listForMatter(
    principal: WorkspacePrincipal,
    formalMatterId: FormalMatterId
  ): ReturnType<PostgresDocumentPackageService['list']>;
}

export class PostgresMatterDocumentPackageReadService implements MatterDocumentPackageReadService {
  constructor(
    private readonly query: QueryClient,
    private readonly packages: Pick<PostgresDocumentPackageService, 'get'>
  ) {}

  async listForMatter(principal: WorkspacePrincipal, formalMatterId: FormalMatterId) {
    if (!principal.permissions.includes('document-package:read'))
      throw new DocumentPackageError(
        'PERMISSION_DENIED',
        'document-package:read permission is required.',
        403
      );
    try {
      const rows = await this.query.query<{ document_package_id: string }>(
        'SELECT document_package_id FROM document_packages WHERE workspace_id=$1 AND formal_matter_id=$2 ORDER BY updated_at DESC,document_package_id',
        [principal.workspaceId, formalMatterId]
      );
      return Promise.all(
        rows.rows.map((row) => this.packages.get(principal, row.document_package_id))
      );
    } catch (cause) {
      if (cause instanceof DocumentPackageError) throw cause;
      throw new DocumentPackageError(
        'PERSISTENCE_UNAVAILABLE',
        'Document Package persistence is unavailable.',
        503,
        true,
        { cause: cause instanceof Error ? cause : undefined }
      );
    }
  }
}
