import type {
  NetworkParticipationSnapshotV1,
  OptInNetworkParticipationCommandV1
} from '@markorbit/contracts/network-participation';
import {
  InMemoryNetworkParticipationRepository,
  NetworkParticipationError,
  NetworkParticipationService as CoreNetworkParticipationService,
  evaluateNetworkVisibility
} from './network-participation-core.js';
import type { NetworkParticipationPrincipal } from './network-participation-core.js';

export {
  InMemoryNetworkParticipationRepository,
  NetworkParticipationError,
  evaluateNetworkVisibility
};
export type {
  AuthorizedNetworkVisibilityProjection,
  CurrentTrustedRelationshipAuthority,
  EvaluateNetworkVisibilityInput,
  NetworkParticipationCommandType,
  NetworkParticipationCommit,
  NetworkParticipationErrorCode,
  NetworkParticipationPrincipal,
  NetworkParticipationReplayRecord,
  NetworkParticipationRepository,
  NetworkParticipationVersionRecord,
  NetworkVisibilityEvaluationResult,
  NetworkVisibilityPolicyVersionRecord,
  RequestedNetworkVisibilityProjection
} from './network-participation-core.js';

/**
 * Public service facade. A concurrent OPT_IN can observe the newly committed current Participation
 * after its first replay read. Retry that one pre-commit conflict once so the second pass can
 * converge on an exact replay or deterministically surface IDEMPOTENCY_CONFLICT. Different-key
 * opt-ins still fail PARTICIPATION_ALREADY_EXISTS and no authority state is relaxed.
 */
export class NetworkParticipationService extends CoreNetworkParticipationService {
  override async optIn(
    principal: NetworkParticipationPrincipal,
    command: OptInNetworkParticipationCommandV1
  ): Promise<NetworkParticipationSnapshotV1> {
    try {
      return await super.optIn(principal, command);
    } catch (cause) {
      if (
        !(cause instanceof NetworkParticipationError) ||
        cause.code !== 'PARTICIPATION_ALREADY_EXISTS'
      )
        throw cause;
      return super.optIn(principal, command);
    }
  }
}
