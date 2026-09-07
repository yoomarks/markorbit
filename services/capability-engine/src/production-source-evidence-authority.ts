import type { CapabilityRuntimeExecution } from './capability-runtime.js';
import type {
  CapabilityProductionSourceEvidenceAuthorityResolutionV1,
  CapabilityProductionSourceEvidenceAuthorityV1
} from './production-source-evidence-read.js';
import {
  createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1,
  type UsptoOfficialFeeProductionSourceEvidenceAuthorityOptionsV1
} from './uspto-official-fee-production-source-evidence.js';
import { USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID } from './uspto-official-fee-resolver-pilot.js';
import type { UsTrademarkMarkRepresentationMethodReaderV1 } from './us-trademark-mark-representation-method-http-reader.js';
import {
  US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID,
  UsTrademarkMarkRepresentationProductionSourceEvidenceAuthorityV1
} from './us-trademark-mark-representation-strategy-source.js';

export type CurrentProductionSourceEvidenceAuthorityOptionsV1 =
  UsptoOfficialFeeProductionSourceEvidenceAuthorityOptionsV1 &
    Readonly<{ methods: Readonly<UsTrademarkMarkRepresentationMethodReaderV1> }>;

/** Explicit producer-family allowlist. No unknown Capability or generic AI output is delegated. */
export class CurrentProductionSourceEvidenceAuthorityV1 implements CapabilityProductionSourceEvidenceAuthorityV1 {
  private readonly fee;
  private readonly strategy;

  constructor(options: Readonly<CurrentProductionSourceEvidenceAuthorityOptionsV1>) {
    this.fee = createUsptoOfficialFeeProductionSourceEvidenceAuthorityV1(options);
    this.strategy = new UsTrademarkMarkRepresentationProductionSourceEvidenceAuthorityV1({
      capabilities: options.capabilities,
      implementations: options.implementations,
      methods: options.methods,
      ...(options.now ? { now: options.now } : {})
    });
  }

  evaluate(
    execution: Readonly<CapabilityRuntimeExecution>
  ): Promise<CapabilityProductionSourceEvidenceAuthorityResolutionV1> {
    if (execution.request.capabilityId === US_TRADEMARK_MARK_REPRESENTATION_CAPABILITY_ID) {
      return this.strategy.evaluate(execution);
    }
    if (execution.request.capabilityId === USPTO_OFFICIAL_FEE_RESOLVER_CAPABILITY_ID) {
      return this.fee.evaluate(execution);
    }
    return Promise.resolve({
      status: 'DENIED',
      historical: {
        capabilityRequestId: execution.request.capabilityRequestId,
        implementationBindingId: execution.binding.implementationBindingId,
        capabilityInvocationId: execution.invocation.capabilityInvocationId,
        capabilityOutcomeId: execution.outcome.capabilityOutcomeId,
        capabilityReturnId: execution.returnValue.capabilityReturnId,
        sessionReceiptId: execution.receipt.sessionReceiptId
      },
      denial: {
        code: 'UNSUPPORTED_PRODUCER_FAMILY',
        reason: 'No production-source evidence authority is allowlisted for this Capability family.'
      }
    });
  }
}
