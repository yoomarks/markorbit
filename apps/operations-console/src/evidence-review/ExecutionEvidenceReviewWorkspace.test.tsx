import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExecutionEvidenceReviewWorkspace } from './ExecutionEvidenceReviewWorkspace.js';
import {
  clientForScenario,
  itemsForScenario,
  previewItems
} from '../evidence-review-preview/fixtures.js';

describe('Execution Evidence Review workspace', () => {
  it('renders the exact owner queue and authority boundary without downstream actions', () => {
    const html = renderToStaticMarkup(
      <ExecutionEvidenceReviewWorkspace items={previewItems} client={clientForScenario('queue')} />
    );
    expect(html).toContain('Evidence review');
    expect(html).toContain('PENDING REVIEW');
    expect(html).toContain('Capture exact review source');
    expect(html).toContain('Provider claim evidence');
    expect(html).not.toContain('Admit reviewed source');
    expect(html).not.toContain('Project lifecycle');
    expect(html).not.toContain('Submit filing');
  });

  it('keeps partial owner data distinct and disables review capture', () => {
    const html = renderToStaticMarkup(
      <ExecutionEvidenceReviewWorkspace
        items={itemsForScenario('partial')}
        client={clientForScenario('partial')}
      />
    );
    expect(html).toContain('Evidence projection incomplete');
    expect(html).toContain('Review controls are unavailable');
    expect(html).toContain('disabled');
  });

  it('renders unavailable owner truth without inventing an empty queue', () => {
    const html = renderToStaticMarkup(
      <ExecutionEvidenceReviewWorkspace
        items={previewItems}
        client={clientForScenario('unavailable')}
        state="unavailable"
      />
    );
    expect(html).toContain('Execution evidence source unavailable');
    expect(html).toContain('No queue, receipt or review outcome is inferred');
    expect(html).not.toContain('successful empty review queue');
  });
});
