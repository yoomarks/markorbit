import type { EventEnvelope } from '@markorbit/contracts';

export type PublishedEvent = EventEnvelope<string, unknown>;
export interface EventPublisher {
  publish(event: PublishedEvent): Promise<void>;
}
export class InMemoryEventPublisher implements EventPublisher {
  readonly events: PublishedEvent[] = [];
  constructor(private readonly onPublish?: (event: PublishedEvent) => void | Promise<void>) {}
  async publish(event: PublishedEvent): Promise<void> {
    await this.onPublish?.(event);
    this.events.push(event);
  }
}
