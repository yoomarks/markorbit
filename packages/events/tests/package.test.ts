import { describe, expect, it } from 'vitest';
import { InMemoryEventPublisher } from '../src/index.js';

describe('in-memory event publisher', () => {
  it('records a published envelope and propagates publication failure', async () => {
    const publisher = new InMemoryEventPublisher();
    await publisher.publish({
      eventId: 'event_test',
      eventType: 'test.v1',
      occurredAt: new Date(0).toISOString(),
      correlationId: 'correlation_test',
      actor: {
        actorId: 'actor_test',
        workplaceId: 'workplace_test',
        product: 'OPERATIONS',
        purpose: 'test'
      },
      schemaVersion: 1,
      payload: {}
    });
    expect(publisher.events).toHaveLength(1);
    const failing = new InMemoryEventPublisher(() => {
      throw new Error('publisher failed');
    });
    await expect(failing.publish(publisher.events[0]!)).rejects.toThrow('publisher failed');
  });
});
