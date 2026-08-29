import {
  CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND,
  normalizeCnPreliminaryPublicationDiscoveryRequestV2,
  parseCnPreliminaryPublicationDiscoveryEnvelopeV2,
  type CnPreliminaryPublicationDiscoveryEnvelopeV2,
  type CnPreliminaryPublicationDiscoveryRequestV2
} from '@markorbit/contracts/data-engine-discovery';

import {
  DataEngineClientError,
  type DataEngineClient,
  type DataEngineRequestContext
} from './data-engine-http.js';

export interface CnPreliminaryPublicationDiscoveryClientV2 {
  discover(
    request: Readonly<CnPreliminaryPublicationDiscoveryRequestV2>,
    context?: DataEngineRequestContext
  ): Promise<CnPreliminaryPublicationDiscoveryEnvelopeV2>;
}

function discoveryPath(request: Readonly<CnPreliminaryPublicationDiscoveryRequestV2>): string {
  const normalized = normalizeCnPreliminaryPublicationDiscoveryRequestV2(request);
  const query = new URLSearchParams({
    application_number_start: normalized.applicationNumberStart,
    application_number_end: normalized.applicationNumberEnd,
    page_size: String(normalized.pageSize)
  });
  if (normalized.cursor !== undefined) query.set('cursor', normalized.cursor);
  return `/api/v1/cn/discovery/preliminary-publications?${query.toString()}`;
}

export function createCnPreliminaryPublicationDiscoveryClientV2(
  client: Pick<DataEngineClient, 'rawGet'>
): CnPreliminaryPublicationDiscoveryClientV2 {
  return {
    async discover(request, context) {
      const normalized = normalizeCnPreliminaryPublicationDiscoveryRequestV2(request);
      const envelope = parseCnPreliminaryPublicationDiscoveryEnvelopeV2(
        await client.rawGet(discoveryPath(normalized), context)
      );
      if (!envelope) {
        throw new DataEngineClientError(
          'DATA_ENGINE_CONTRACT_MISMATCH',
          `Data Engine response does not match ${CN_PRELIMINARY_PUBLICATION_DISCOVERY_RESOURCE_KIND} V2.`
        );
      }
      const scope = envelope.payload.query.scope.application_number;
      if (
        scope.start_inclusive !== normalized.applicationNumberStart ||
        scope.end_exclusive !== normalized.applicationNumberEnd ||
        envelope.payload.query.limits.page_size !== normalized.pageSize
      ) {
        throw new DataEngineClientError(
          'DATA_ENGINE_CONTRACT_MISMATCH',
          'Data Engine Discovery response scope does not match the exact requested bounds.'
        );
      }
      return envelope;
    }
  };
}
