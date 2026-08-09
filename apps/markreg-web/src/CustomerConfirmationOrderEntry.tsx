import { Alert, Button, LoadingState, PageHeader } from '@markorbit/ui';
import { useEffect, useState } from 'react';
import type { CustomerConfirmation } from '@markorbit/contracts';
import type { MarkregClient } from './api/markreg.js';
import { OrderJourney } from './OrderJourney.js';

export function CustomerConfirmationOrderEntry({
  confirmationId,
  expectedVersion,
  client
}: {
  confirmationId: string;
  expectedVersion: string;
  client: MarkregClient;
}) {
  const [attempt, setAttempt] = useState(0);
  const [confirmation, setConfirmation] = useState<CustomerConfirmation>();
  const [error, setError] = useState<'VERSION' | 'UNAVAILABLE'>();

  useEffect(() => {
    let active = true;
    setConfirmation(undefined);
    setError(undefined);
    if (!client.getCustomerConfirmation) {
      setError('UNAVAILABLE');
      return () => {
        active = false;
      };
    }
    void client
      .getCustomerConfirmation(confirmationId)
      .then(({ confirmation: value }) => {
        if (!active) return;
        const version = (value as CustomerConfirmation & { version?: number }).version ?? 1;
        if (String(version) !== expectedVersion) {
          setError('VERSION');
          return;
        }
        setConfirmation(value);
      })
      .catch(() => {
        if (active) setError('UNAVAILABLE');
      });
    return () => {
      active = false;
    };
  }, [attempt, client, confirmationId, expectedVersion]);

  if (!confirmation && !error)
    return (
      <main className="markreg-page">
        <LoadingState label="Loading exact Customer Confirmation" />
      </main>
    );

  if (error === 'VERSION')
    return (
      <main className="markreg-page">
        <PageHeader
          title="Customer Confirmation changed"
          description="The direct URL points to an older confirmation version. Order creation is disabled until the exact governed source is reloaded."
        />
        <Alert tone="warning" title="Version mismatch">
          No Order, Payment, Invoice, Formal Matter or Filing was created.
        </Alert>
        <a href="/">Return to MarkReg</a>
      </main>
    );

  if (error === 'UNAVAILABLE')
    return (
      <main className="markreg-page">
        <PageHeader
          title="Customer Confirmation unavailable"
          description="The saved confirmation could not be loaded safely."
        />
        <Button onClick={() => setAttempt((value) => value + 1)}>Retry exact confirmation</Button>{' '}
        <a href="/">Return to MarkReg</a>
      </main>
    );

  return <OrderJourney source={{ confirmation: confirmation! }} />;
}
