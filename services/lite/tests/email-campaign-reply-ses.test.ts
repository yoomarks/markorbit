import { describe, expect, it } from 'vitest';
import { AmazonSesV2ReplyReferenceCorrelatorV1 } from '../src/email-campaign-reply-ses.js';

describe('Amazon SES V2 reply reference correlation', () => {
  const correlator = new AmazonSesV2ReplyReferenceCorrelatorV1();

  it('maps SES RFC Message-ID back to the provider submission ref', () => {
    expect(
      correlator.candidates([
        {
          name: 'In-Reply-To',
          value: '<01000199abcdef-000000@email.amazonses.com>'
        }
      ])
    ).toEqual([
      {
        providerSubmissionRef: '01000199abcdef-000000',
        evidenceMethod: 'RFC_IN_REPLY_TO'
      }
    ]);
  });

  it('prefers In-Reply-To over duplicate References evidence', () => {
    expect(
      correlator.candidates([
        {
          name: 'References',
          value:
            '<older@example.net> <01000199abcdef-000000@email.amazonses.com>'
        },
        {
          name: 'In-Reply-To',
          value: '<01000199abcdef-000000@email.amazonses.com>'
        }
      ])
    ).toEqual([
      {
        providerSubmissionRef: '01000199abcdef-000000',
        evidenceMethod: 'RFC_IN_REPLY_TO'
      }
    ]);
  });

  it('ignores non-SES message ids rather than guessing', () => {
    expect(
      correlator.candidates([
        { name: 'In-Reply-To', value: '<customer-thread@example.com>' },
        { name: 'Subject', value: 'Re: Campaign offer' }
      ])
    ).toEqual([]);
  });

  it('returns distinct SES candidates in bounded header order', () => {
    expect(
      correlator.candidates([
        {
          name: 'References',
          value:
            '<010001first-000000@email.amazonses.com> <010001second-000000@email.amazonses.com>'
        }
      ])
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
