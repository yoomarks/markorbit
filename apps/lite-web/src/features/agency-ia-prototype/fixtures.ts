export type AgencyPrototypeSurface =
  | 'today'
  | 'cases'
  | 'case-detail'
  | 'trademarks'
  | 'trademark-change'
  | 'clients'
  | 'inbox'
  | 'more'
  | 'sources'
  | 'diagnostics';

export type AgencyPrototypeState =
  | 'loading'
  | 'empty'
  | 'populated'
  | 'partial'
  | 'stale'
  | 'unavailable'
  | 'permission'
  | 'error'
  | 'success';

export const agencyCases = [
  {
    id: 'case-northstar-section-8',
    client: 'Northstar Robotics Ltd.',
    trademark: 'NORTHSTAR',
    jurisdiction: 'United States',
    type: 'Section 8 maintenance',
    status: 'Ready for review',
    nextAction: 'Review evidence of use',
    due: 'Today · 4:00 PM',
    updated: '24 minutes ago'
  },
  {
    id: 'case-aurora-eu-opposition',
    client: 'Aurora Fieldworks GmbH',
    trademark: 'AURORA FIELD',
    jurisdiction: 'European Union',
    type: 'Opposition response',
    status: 'Client reply needed',
    nextAction: 'Confirm goods restriction',
    due: 'Tomorrow',
    updated: '2 hours ago'
  },
  {
    id: 'case-kestrel-renewal',
    client: 'Kestrel House Co.',
    trademark: 'KESTREL HOUSE',
    jurisdiction: 'United Kingdom',
    type: 'Renewal',
    status: 'Waiting on associate',
    nextAction: 'Follow up on filing receipt',
    due: '18 Sep',
    updated: 'Yesterday'
  }
] as const;

const trademarkNames = [
  'NORTHSTAR',
  'AURORA FIELD',
  'KESTREL HOUSE',
  'LUMEN PATH',
  'ORBITAL WORKS',
  'VERDANT ARC',
  'MORROW',
  'BRIGHTLINE'
] as const;
const jurisdictions = ['US', 'EU', 'UK', 'CN', 'JP', 'CA', 'AU', 'SG'] as const;
const clients = [
  'Northstar Robotics Ltd.',
  'Aurora Fieldworks GmbH',
  'Kestrel House Co.',
  'Lumen Path Pte. Ltd.'
] as const;

export const trademarkRows = Array.from({ length: 48 }, (_, index) => ({
  id: `tm-${String(index + 1).padStart(5, '0')}`,
  name: trademarkNames[index % trademarkNames.length],
  client: clients[index % clients.length],
  jurisdiction: jurisdictions[index % jurisdictions.length],
  registration: `${jurisdictions[index % jurisdictions.length]}-${String(8400000 + index)}`,
  status:
    index === 0
      ? 'Change detected'
      : index % 11 === 0
        ? 'Needs refresh'
        : index % 17 === 0
          ? 'Some data unavailable'
          : 'Up to date',
  checked: index === 0 ? '18 minutes ago' : `${(index % 8) + 1}h ago`
}));

export const messages = [
  {
    id: 'msg-outside-counsel',
    sender: 'Elena Rossi · Rossi & Partners',
    subject: 'NORTHSTAR — USPTO status and specimen question',
    preview: 'The examiner has accepted the response. We need updated specimen instructions…',
    time: '9:18 AM',
    unread: true,
    linked: false,
    unavailable: false
  },
  {
    id: 'msg-client-aurora',
    sender: 'Martin Vogel · Aurora Fieldworks',
    subject: 'Re: EU opposition settlement language',
    preview: 'We approve the narrower goods wording discussed yesterday…',
    time: '8:42 AM',
    unread: true,
    linked: true,
    unavailable: false
  },
  {
    id: 'msg-provider-partial',
    sender: 'Source unavailable',
    subject: 'Filing receipt follow-up',
    preview: 'Some message context is unavailable.',
    time: 'Yesterday',
    unread: false,
    linked: true,
    unavailable: true
  }
] as const;

export const vocabulary = {
  'Formal Matter': 'Case',
  'Trademark Asset': 'Trademark',
  Directory: 'Clients & contacts',
  'Communication Link': 'Linked to',
  Currentness: 'Up to date / Needs refresh',
  'Prepared Action': 'Draft action / Ready for review',
  'Professional Review': 'Review',
  'Execution Release': 'Ready to file / Ready to send / Approval',
  'Reflection Candidate': 'Suggested learning',
  Brain: 'Ask MO',
  'Evidence Ledger': 'Sources & history',
  'Official Truth': 'Official record',
  'Provider Return': 'Provider update'
} as const;
