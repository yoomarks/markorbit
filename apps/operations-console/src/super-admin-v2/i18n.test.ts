import { describe, expect, it } from 'vitest';
import {
  formatSuperAdminCurrency,
  formatSuperAdminDateTime,
  formatSuperAdminNumber,
  translateSuperAdminText
} from './i18n.js';

describe('Super Admin V2 bilingual presentation', () => {
  it('keeps safety operations semantically distinct in English', () => {
    expect(translateSuperAdminText('重试', 'en-US')).toBe('Retry');
    expect(translateSuperAdminText('重放', 'en-US')).toBe('Replay');
    expect(translateSuperAdminText('恢复', 'en-US')).toBe('Recover');
    expect(translateSuperAdminText('回滚', 'en-US')).toBe('Rollback');
    expect(translateSuperAdminText('撤销授权', 'en-US')).toBe('Revoke authorization');
    expect(translateSuperAdminText('暂停', 'en-US')).toBe('Suspend');
  });

  it('preserves technical identifiers and exact source payloads when no UI translation exists', () => {
    expect(translateSuperAdminText('RUN-US-9914', 'en-US')).toBe('RUN-US-9914');
    expect(translateSuperAdminText('sha256: a83…91f', 'zh-CN')).toBe('sha256: a83…91f');
  });

  it('formats dates, numbers and money with the selected locale', () => {
    expect(formatSuperAdminDateTime('2026-09-06T22:19:00.000Z', 'zh-CN')).not.toBe(
      formatSuperAdminDateTime('2026-09-06T22:19:00.000Z', 'en-US')
    );
    expect(formatSuperAdminNumber(1234567.89, 'zh-CN', { notation: 'compact' })).not.toBe(
      formatSuperAdminNumber(1234567.89, 'en-US', { notation: 'compact' })
    );
    expect(formatSuperAdminCurrency(1284.5, 'USD', 'en-US')).toContain('$');
  });

  it('uses professional module terminology instead of generic substitutions', () => {
    expect(translateSuperAdminText('外部 API 与集成', 'en-US')).toBe(
      'External APIs & Integrations'
    );
    expect(translateSuperAdminText('证据审核', 'en-US')).toBe('Evidence Review');
    expect(translateSuperAdminText('原始文件', 'en-US')).toBe('Raw Artifacts');
    expect(translateSuperAdminText('检查点', 'en-US')).toBe('Checkpoint');
  });
});
