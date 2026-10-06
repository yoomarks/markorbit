import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewedSourceHandoffWorkspace } from './ReviewedSourceHandoffWorkspace.js';
import {
  clientForScenario,
  deliveredOutcome,
  pendingOutcome,
  previewSource
} from '../reviewed-source-handoff-preview/fixtures.js';

describe('Reviewed Source Handoff workspace', () => {
  it('renders the exact admission and internal-only authority boundary', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceHandoffWorkspace source={previewSource} client={clientForScenario('ready')} />
    );
    expect(html).toContain('reviewed-source-admission_preview-51930');
    expect(html).toContain('Deliver to MarkReg lifecycle');
    expect(html).toContain('Official status');
    expect(html).toContain('FALSE');
    expect(html).not.toContain('Submit filing');
    expect(html).not.toContain('Authorize payment');
  });

  it('keeps a dependency failure pending and retryable', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceHandoffWorkspace
        source={previewSource}
        client={clientForScenario('dependency-unavailable')}
        initialOutcome={pendingOutcome}
      />
    );
    expect(html).toContain('PENDING · RETRY SAFE');
    expect(html).toContain('DEPENDENCY_UNAVAILABLE');
    expect(html).toContain('Retry same handoff');
    expect(html).toContain('No lifecycle event or Current Lifecycle View was created');
  });

  it('shows event and current view as non-official delivered truth', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceHandoffWorkspace
        source={previewSource}
        client={clientForScenario('ready')}
        initialOutcome={deliveredOutcome(2)}
      />
    );
    expect(html).toContain('LIFECYCLE PROJECTION RECORDED');
    expect(html).toContain('lifecycle-event_preview-51930');
    expect(html).toContain('lifecycle-view_preview-51930');
    expect(html).toContain('Not created or executed');
    expect(html).toContain('false');
  });

  it('does not collapse owner unavailability into empty state', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceHandoffWorkspace
        source={previewSource}
        client={clientForScenario('unavailable')}
        state="unavailable"
      />
    );
    expect(html).toContain('Handoff context unavailable');
    expect(html).not.toContain('No reviewed source is ready for handoff');
  });
});
