import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ReviewedSourceAdmissionWorkspace } from './ReviewedSourceAdmissionWorkspace.js';
import {
  clientForScenario,
  decisionForScenario,
  previewTargets
} from '../reviewed-source-admission-preview/fixtures.js';

describe('Reviewed Source Admission workspace', () => {
  it('renders exact decision, target and authority boundaries', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceAdmissionWorkspace
        decision={decisionForScenario('ready')}
        targets={previewTargets}
        client={clientForScenario('ready')}
      />
    );
    expect(html).toContain('ADMITTED FOR INTERNAL USE');
    expect(html).toContain('formal-matter_preview-51920');
    expect(html).toContain('Record Reviewed Source Admission');
    expect(html).toContain('Lifecycle handoffs');
    expect(html).not.toContain('Project lifecycle now');
    expect(html).not.toContain('Submit filing');
  });

  it('blocks correction-required decisions without mutating history', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceAdmissionWorkspace
        decision={decisionForScenario('nonadmissible')}
        targets={previewTargets}
        client={clientForScenario('nonadmissible')}
      />
    );
    expect(html).toContain('CORRECTION REQUIRED');
    expect(html).toContain('Decision is not admissible');
    expect(html).toContain('Admission controls are unavailable');
    expect(html).not.toContain('Record Reviewed Source Admission');
  });

  it('does not collapse owner unavailability into an empty admission state', () => {
    const html = renderToStaticMarkup(
      <ReviewedSourceAdmissionWorkspace
        decision={decisionForScenario('ready')}
        targets={previewTargets}
        client={clientForScenario('unavailable')}
        state="unavailable"
      />
    );
    expect(html).toContain('Admission context unavailable');
    expect(html).toContain('No target or admission result is inferred');
    expect(html).not.toContain('No reviewed source is ready');
  });
});
