import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { QuotaLayoutReview } from './quota-layout-review.js';

describe('Quota layout review', () => {
  it('shows three quota selectors and one selected detail without a fabricated chart', () => {
    const html = renderToStaticMarkup(<QuotaLayoutReview />);
    expect(html).toContain('aria-label="Quota selection"');
    expect(html.match(/Workspace 成员席位/g)).toHaveLength(2);
    expect(html.match(/每月 AI 运行次数/g)).toHaveLength(1);
    expect(html.match(/证据存储空间/g)).toHaveLength(1);
    expect(html).toContain('当前评审数据没有真实历史记录');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('<canvas');
  });

  it('provides a scalable list mode and a complete English review', () => {
    const html = renderToStaticMarkup(<QuotaLayoutReview initialMode="large" initialLocale="en" />);
    expect(html).toContain('<table');
    expect(html).toContain('Search quotas');
    expect(html).toContain('No real history is available');
  });
});
