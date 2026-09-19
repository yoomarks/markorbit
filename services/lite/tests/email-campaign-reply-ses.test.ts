import { describe, expect, it } from 'vitest';
import { AmazonSesV2ReplyReferenceCorrelatorV1 } from '../src/email-campaign-reply-ses.js';

describe('Amazon SES V2 reply reference correlation', () => {
  const correlator = new AmazonSesV2ReplyReferenceCorrelatorV1();

  it('maps SES RFC Message-ID back to the provider submission ref', () => {
    expect(correlator.candidates(['01000199abcdef-000000@email.amazonses.com'], [])).toEqual([
      {
        providerSubmissionRef: '01000199abcdef-000000',
        evidenceMethod: 'RFC_IN_REPLY_TO'
      }
    ]);
  });

  it('prefers In-Reply-To over duplicate References evidence', () => {
    expect(
      correlator.candidates(
        ['01000199abcdef-000000@email.amazonses.com'],
        ['older@example.net', '01000199abcdef-000000@email.amazonses.com']
      )
    ).toEqual([
      {
        providerSubmissionRef: '01000199abcdef-000000',
        evidenceMethod: 'RFC_IN_REPLY_TO'
      }
    ]);
  });

  it('ignores non-SES message ids rather than guessing', () => {
    expect(correlator.candidates(['customer-thread@example.com'], [])).toEqual([]);
  });

  it('returns distinct SES candidates in bounded identifier order', () => {
    expect(
      correlator.candidates(
        [],
        ['010001first-000000@email.amazonses.com', '010001second-000000@email.amazonses.com']
      )
    ).toEqual([
      {
        providerSubmissionRef: '010001first-000000',
        evidenceMethod: 'RFC_REFERENCES'
      },
      {
        providerSubmissionRef: '010001second-000000',
        evidenceMethod: 'RFC_REFERENCES'
      }
    ]);
  });
});
