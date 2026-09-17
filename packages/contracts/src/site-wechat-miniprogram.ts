import type { ResolvedPublicSiteV1, SiteServiceAvailabilityV1 } from './site.js';

export const wechatMiniProgramAuthorityConsequencesV1 = Object.freeze({
  customerIdentityEstablished: false,
  customerRelationshipCreated: false,
  quoteCreated: false,
  orderCreated: false,
  matterCreated: false,
  paymentCreated: false,
  workspaceAuthorityGranted: false
});

export interface WechatMiniProgramEntryV1 {
  schemaVersion: 1;
  campaign?: string;
  content?: string;
  referral?: string;
}

export interface WechatMiniProgramServiceHandoffV1 {
  productRef: SiteServiceAvailabilityV1['productRef'];
  url: string;
}

/** Public renderer projection only. It carries no Workspace or commerce authority. */
export interface WechatMiniProgramSiteProjectionV1 {
  schemaVersion: 1;
  platform: 'WECHAT_MINIPROGRAM';
  site: Readonly<ResolvedPublicSiteV1>;
  serviceHandoffs: readonly Readonly<WechatMiniProgramServiceHandoffV1>[];
  authorityConsequences: typeof wechatMiniProgramAuthorityConsequencesV1;
}

export class WechatMiniProgramContractError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = 'WechatMiniProgramContractError';
  }
}

const TOKEN = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/u;

function optionalToken(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !TOKEN.test(value)) {
    throw new WechatMiniProgramContractError(`${field} must be a bounded opaque token.`);
  }
  return value;
}

export function parseWechatMiniProgramEntryV1(value: unknown): WechatMiniProgramEntryV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WechatMiniProgramContractError('entry must be an object.');
  }
  const input = value as Record<string, unknown>;
  const allowed = ['schemaVersion', 'campaign', 'content', 'referral'];
  if (Object.keys(input).some((key) => !allowed.includes(key))) {
    throw new WechatMiniProgramContractError('entry contains unsupported authority fields.');
  }
  if (input.schemaVersion !== undefined && input.schemaVersion !== 1) {
    throw new WechatMiniProgramContractError('entry.schemaVersion must be 1.');
  }
  const campaign = optionalToken(input.campaign, 'entry.campaign');
  const content = optionalToken(input.content, 'entry.content');
  const referral = optionalToken(input.referral, 'entry.referral');
  return {
    schemaVersion: 1,
    ...(campaign ? { campaign } : {}),
    ...(content ? { content } : {}),
    ...(referral ? { referral } : {})
  };
}
