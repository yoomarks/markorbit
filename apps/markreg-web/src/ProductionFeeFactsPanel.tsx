import type { MarkOrbitId } from '@markorbit/contracts';
import type {
  ProductionFeeFactsV1,
  ProductionFilingBasisV1,
  ProductionIntakeV1
} from '@markorbit/contracts/markreg-early-funnel';
import {
  Alert,
  Button,
  Card,
  ErrorState,
  KeyValueList,
  LoadingState,
  Select,
  TextInput
} from '@markorbit/ui';
import { useRef, useState } from 'react';
import { MarkregApiError } from './api/errors.js';
import {
  createProductionFeeFactsClient,
  type CustomerProductionFeeFactsCommandV1,
  type ProductionFeeFactsClient
} from './api/production-fee-facts.js';

const defaultClient = createProductionFeeFactsClient();

type Status = 'idle' | 'loading' | 'editing' | 'submitting' | 'ready' | 'error';

type Pending = {
  material: string;
  idempotencyKey: string;
  correlationId: MarkOrbitId;
};

function markOrbitId(prefix: string): MarkOrbitId {
  return `${prefix}_${crypto.randomUUID()}` as MarkOrbitId;
}

export function parseNiceClassSelection(value: string): readonly number[] {
  const pieces = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (pieces.length === 0) throw new Error('Enter at least one Nice class.');
  const classes = pieces.map((item) => Number(item));
  if (classes.some((item) => !Number.isSafeInteger(item) || item < 1 || item > 45))
    throw new Error('Nice classes must be whole numbers from 1 to 45.');
  if (new Set(classes).size !== classes.length) throw new Error('Do not repeat a Nice class.');
  return [...classes].sort((left, right) => left - right);
}

export function ProductionFeeFactsPanel({
  intake,
  client = defaultClient
}: {
  intake: ProductionIntakeV1;
  client?: ProductionFeeFactsClient;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [record, setRecord] = useState<ProductionFeeFactsV1>();
  const [filingBasis, setFilingBasis] = useState<ProductionFilingBasisV1 | ''>('');
  const [classes, setClasses] = useState('');
  const [error, setError] = useState<string>();
  const pending = useRef<Pending>();

  const load = async () => {
    setStatus('loading');
    setError(undefined);
    try {
      const envelope = await client.getCurrent(intake.intakeId, intake.version);
      setRecord(envelope.feeFacts);
      setStatus('ready');
    } catch (cause) {
      if (
        cause instanceof MarkregApiError &&
        cause.status === 404 &&
        cause.code === 'PRODUCTION_FEE_FACTS_NOT_FOUND'
      ) {
        setRecord(undefined);
        setStatus('editing');
        return;
      }
      setError(
        cause instanceof Error
          ? cause.message
          : 'Current fee-driving application facts could not be loaded safely.'
      );
      setStatus('error');
    }
  };

  const edit = () => {
    if (record) {
      setFilingBasis(record.filingBasis);
      setClasses(record.niceClasses.join(', '));
    }
    setError(undefined);
    setStatus('editing');
  };

  const submit = async () => {
    if (!filingBasis) {
      setError('Choose the filing basis explicitly.');
      return;
    }
    let niceClasses: readonly number[];
    try {
      niceClasses = parseNiceClassSelection(classes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Nice class selection is invalid.');
      return;
    }
    const material = JSON.stringify({
      intakeId: intake.intakeId,
      intakeVersion: intake.version,
      intakeFingerprint: intake.fingerprintSha256,
      filingBasis,
      niceClasses
    });
    if (!pending.current || pending.current.material !== material) {
      pending.current = {
        material,
        idempotencyKey: crypto.randomUUID(),
        correlationId: markOrbitId('correlation')
      };
    }
    const command: CustomerProductionFeeFactsCommandV1 = {
      expectedIntakeVersion: intake.version,
      filingBasis,
      niceClasses,
      idempotencyKey: pending.current.idempotencyKey,
      correlationId: pending.current.correlationId
    };
    setStatus('submitting');
    setError(undefined);
    try {
      await client.create(intake.intakeId, command);
      const readback = await client.getCurrent(intake.intakeId, intake.version);
      setRecord(readback.feeFacts);
      pending.current = undefined;
      setStatus('ready');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Fee-driving application facts could not be saved safely.'
      );
      setStatus('error');
    }
  };

  if (status === 'idle')
    return (
      <Card>
        <h2>Application fee facts</h2>
        <p>
          Filing basis and Nice classes must be supplied explicitly before MarkReg can resolve
          official-fee inputs. They are never inferred from your goods/services text.
        </p>
        <Button variant="secondary" onClick={() => void load()}>
          Review fee-driving facts
        </Button>
      </Card>
    );

  if (status === 'loading' || status === 'submitting')
    return (
      <Card>
        <LoadingState
          label={status === 'loading' ? 'Loading current fee facts' : 'Saving explicit fee facts'}
        />
      </Card>
    );

  if (status === 'error')
    return (
      <Card>
        <ErrorState
          title="Fee-driving facts are not available"
          description={
            error ?? 'MarkReg failed closed instead of inferring missing application facts.'
          }
          onRetry={() => void load()}
        />
        <Button variant="secondary" onClick={edit}>
          Review explicit facts
        </Button>
      </Card>
    );

  if (status === 'ready' && record)
    return (
      <Card>
        <h2>Current application fee facts</h2>
        <Alert tone="success" title="Durable explicit facts">
          These facts were read back from MarkReg owner truth. They do not create a Quote, legal
          conclusion, Filing Authorization, Payment, Order, provider action, or Official Truth.
        </Alert>
        <KeyValueList
          items={[
            { key: 'Filing basis', value: record.filingBasis },
            { key: 'Nice classes', value: record.niceClasses.join(', ') },
            { key: 'Class count', value: record.classCount },
            { key: 'Currentness', value: record.currentness },
            { key: 'Source', value: record.filingBasisProvenance.sourceClass },
            { key: 'Fingerprint', value: record.fingerprintSha256 }
          ]}
        />
        <Button variant="secondary" onClick={edit}>
          Replace fee-driving facts
        </Button>
      </Card>
    );

  return (
    <Card>
      <h2>Record application fee facts</h2>
      <Alert tone="warning" title="Explicit facts only">
        Choose the legal filing basis and Nice classes yourself. MarkReg will not infer either from
        free text or AI output. Saving creates a separate immutable fee-facts snapshot bound to this
        exact Intake version.
      </Alert>
      <Select
        id="productionFilingBasis"
        label="US filing basis"
        value={filingBasis}
        onChange={(event) =>
          setFilingBasis(event.currentTarget.value as ProductionFilingBasisV1 | '')
        }
      >
        <option value="">Select one</option>
        <option value="SECTION_1">Section 1 — use / intent-to-use basis</option>
        <option value="SECTION_44">Section 44 — foreign application / registration basis</option>
      </Select>
      <TextInput
        id="productionNiceClasses"
        label="Nice classes"
        value={classes}
        hint="Enter exact Nice class numbers separated by commas, for example 9, 35, 42."
        onChange={(event) => setClasses(event.currentTarget.value)}
      />
      {error && (
        <Alert tone="danger" title="Review these facts">
          {error}
        </Alert>
      )}
      <Button onClick={() => void submit()}>Save explicit fee facts</Button>
    </Card>
  );
}
