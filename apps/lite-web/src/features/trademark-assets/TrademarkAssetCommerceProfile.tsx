import { useState } from 'react';
import type {
  TrademarkAssetCommerceProfile,
  TrademarkAssetSaleIntent,
  TrademarkAssetSellerRole
} from '@markorbit/contracts/trademark-asset-commerce';
import { Button, Checkbox, Select, TextArea, TextInput } from '@markorbit/ui';
import {
  TrademarkAssetHttpError,
  type SaveTrademarkAssetCommerceProfileInput
} from '../../api/trademark-assets.js';

export interface TrademarkAssetCommerceProfileProps {
  assetVersion: number;
  profile?: Readonly<TrademarkAssetCommerceProfile>;
  readOnly: boolean;
  onSave?: (
    input: Readonly<SaveTrademarkAssetCommerceProfileInput>
  ) => Promise<TrademarkAssetCommerceProfile>;
  onReload?: () => void | Promise<void>;
}

type FormState = {
  saleIntent: TrademarkAssetSaleIntent;
  sellerRole: TrademarkAssetSellerRole;
  negotiable: boolean;
  askingPriceAmount: string;
  askingPriceCurrency: string;
  saleTerritories: string;
  headline: string;
  sellingPoints: string;
  aiTags: string;
  showcaseTemplateReference: string;
  mediaAssetReferences: string;
};

type SaveState = 'idle' | 'saving' | 'saved' | 'conflict' | 'permission' | 'unavailable' | 'error';

const lines = (value: readonly string[] | undefined) => value?.join('\n') ?? '';
const values = (value: string) =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);

function formState(profile?: Readonly<TrademarkAssetCommerceProfile>): FormState {
  return {
    saleIntent: profile?.saleIntent ?? 'NOT_FOR_SALE',
    sellerRole: profile?.sellerRole ?? 'OWNER',
    negotiable: profile?.negotiable ?? false,
    askingPriceAmount: profile?.askingPrice ? String(profile.askingPrice.amountMinor) : '',
    askingPriceCurrency: profile?.askingPrice?.currency ?? '',
    saleTerritories: lines(profile?.saleTerritories),
    headline: profile?.headline ?? '',
    sellingPoints: lines(profile?.sellingPoints),
    aiTags: lines(profile?.aiTags),
    showcaseTemplateReference: profile?.showcaseTemplateReference ?? '',
    mediaAssetReferences: lines(profile?.mediaAssetReferences)
  };
}

function optional(value: string): string | undefined {
  return value.trim() || undefined;
}

function FieldList({ label, values: items }: { label: string; values: readonly string[] }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{items.length ? items.join(' · ') : 'Not provided'}</dd>
    </div>
  );
}

export function TrademarkAssetCommerceProfileSection({
  assetVersion,
  profile,
  readOnly,
  onSave,
  onReload
}: TrademarkAssetCommerceProfileProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FormState>(() => formState(profile));
  const [savedProfile, setSavedProfile] = useState(profile);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [askingPriceError, setAskingPriceError] = useState('');
  const current = savedProfile ?? profile;

  const beginEdit = () => {
    setDraft(formState(current));
    setSaveState('idle');
    setErrorMessage('');
    setAskingPriceError('');
    setEditing(true);
  };

  const save = async () => {
    const hasAmount = Boolean(draft.askingPriceAmount.trim());
    const hasCurrency = Boolean(draft.askingPriceCurrency.trim());
    const amountMinor = Number(draft.askingPriceAmount);
    if (
      hasAmount !== hasCurrency ||
      (hasAmount && (!Number.isInteger(amountMinor) || amountMinor < 0))
    ) {
      setAskingPriceError(
        'Enter a non-negative minor-unit amount and currency together, or leave both blank.'
      );
      return;
    }
    if (!onSave) return;
    setAskingPriceError('');
    setSaveState('saving');
    setErrorMessage('');
    try {
      const saved = await onSave({
        expectedTrademarkAssetVersion: assetVersion,
        ...(current ? { expectedCommerceProfileVersion: current.version } : {}),
        saleIntent: draft.saleIntent,
        ...(hasAmount
          ? {
              askingPrice: {
                amountMinor,
                currency: draft.askingPriceCurrency.trim().toUpperCase()
              }
            }
          : {}),
        negotiable: draft.negotiable,
        saleTerritories: values(draft.saleTerritories),
        sellerRole: draft.sellerRole,
        ...(optional(draft.headline) ? { headline: optional(draft.headline)! } : {}),
        sellingPoints: values(draft.sellingPoints),
        aiTags: values(draft.aiTags),
        ...(optional(draft.showcaseTemplateReference)
          ? { showcaseTemplateReference: optional(draft.showcaseTemplateReference)! }
          : {}),
        mediaAssetReferences: values(draft.mediaAssetReferences)
      });
      setSavedProfile(saved);
      setDraft(formState(saved));
      setEditing(false);
      setSaveState('saved');
    } catch (error) {
      const status = error instanceof TrademarkAssetHttpError ? error.status : 0;
      setSaveState(
        status === 409
          ? 'conflict'
          : status === 403
            ? 'permission'
            : status === 404 || status === 503 || status === 0
              ? 'unavailable'
              : 'error'
      );
      setErrorMessage(
        error instanceof Error ? error.message : 'Commerce Profile could not be saved.'
      );
    }
  };

  return (
    <section className="trademark-commerce" aria-labelledby="commerce-context-heading">
      <div className="trademark-asset-workspace__section-heading">
        <div>
          <p>Workspace-owned sell-side context</p>
          <h2 id="commerce-context-heading">Commerce Profile</h2>
        </div>
        <span>{readOnly ? 'Marketplace source · read-only' : 'Private workspace context'}</span>
      </div>
      <p className="trademark-commerce__boundary">
        A Commerce Profile records seller-provided, non-binding context. It does not create a
        Marketplace listing, buyer offer, transaction, payment or transfer.
      </p>

      {readOnly ? (
        <div className="trademark-commerce__notice" role="note">
          <strong>Source Commerce Profile cannot be changed here.</strong>
          <span>
            This Asset was added from Marketplace. Its source listing and source commercial facts
            remain owned by Marketplace.
          </span>
        </div>
      ) : null}

      {!current && !editing ? (
        <div className="trademark-commerce__empty">
          <strong>No sell-side profile has been set up.</strong>
          <span>
            No Commerce Profile is saved in this Workspace. This does not determine whether the
            trademark is or is not for sale.
          </span>
          {!readOnly ? <Button onClick={beginEdit}>Set up sale context</Button> : null}
        </div>
      ) : null}

      {current && !editing ? (
        <>
          <dl className="trademark-commerce__grid">
            <div>
              <dt>Sale intent</dt>
              <dd>
                {current.saleIntent === 'FOR_SALE' ? 'Prepared for sale' : 'Not marked for sale'}
              </dd>
            </div>
            <div>
              <dt>Seller role</dt>
              <dd>{current.sellerRole === 'OWNER' ? 'Owner' : 'Authorized representative'}</dd>
            </div>
            <div>
              <dt>Seller-provided asking price</dt>
              <dd>
                {current.askingPrice
                  ? `${current.askingPrice.currency} ${current.askingPrice.amountMinor} minor units`
                  : 'Not provided'}
              </dd>
              <small>Non-binding sell-side context; not an offer or valuation.</small>
            </div>
            <div>
              <dt>Negotiable</dt>
              <dd>{current.negotiable ? 'Yes' : 'No'}</dd>
            </div>
            <FieldList label="Territories" values={current.saleTerritories} />
            <div>
              <dt>Headline</dt>
              <dd>{current.headline || 'Not provided'}</dd>
            </div>
            <FieldList label="Selling points" values={current.sellingPoints} />
            <FieldList label="AI tags" values={current.aiTags} />
            <div>
              <dt>Showcase template reference</dt>
              <dd>{current.showcaseTemplateReference || 'Not provided'}</dd>
            </div>
            <FieldList label="Media references" values={current.mediaAssetReferences} />
          </dl>
          <small>
            Saved version {current.version} · updated {current.updatedAt}
          </small>
          {!readOnly ? (
            <div className="trademark-commerce__actions">
              <Button onClick={beginEdit}>Edit sale context</Button>
            </div>
          ) : null}
        </>
      ) : null}

      {editing ? (
        <form
          className="trademark-commerce__form"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <div className="trademark-commerce__form-grid">
            <Select
              label="Sale intent"
              value={draft.saleIntent}
              onChange={(event) =>
                setDraft({ ...draft, saleIntent: event.target.value as TrademarkAssetSaleIntent })
              }
            >
              <option value="NOT_FOR_SALE">Not marked for sale</option>
              <option value="FOR_SALE">Prepare for sale</option>
            </Select>
            <Select
              label="Seller role"
              value={draft.sellerRole}
              onChange={(event) =>
                setDraft({ ...draft, sellerRole: event.target.value as TrademarkAssetSellerRole })
              }
            >
              <option value="OWNER">Owner</option>
              <option value="AUTHORIZED_REPRESENTATIVE">Authorized representative</option>
            </Select>
            <TextInput
              label="Asking price amount (minor units)"
              inputMode="numeric"
              value={draft.askingPriceAmount}
              error={askingPriceError || undefined}
              onChange={(event) => setDraft({ ...draft, askingPriceAmount: event.target.value })}
            />
            <TextInput
              label="Asking price currency"
              placeholder="USD"
              value={draft.askingPriceCurrency}
              onChange={(event) => setDraft({ ...draft, askingPriceCurrency: event.target.value })}
            />
          </div>
          <Checkbox
            label="Seller-provided asking price is negotiable"
            checked={draft.negotiable}
            onChange={(event) => setDraft({ ...draft, negotiable: event.target.checked })}
          />
          <TextInput
            label="Headline"
            value={draft.headline}
            onChange={(event) => setDraft({ ...draft, headline: event.target.value })}
          />
          <TextArea
            label="Territories (one per line)"
            value={draft.saleTerritories}
            onChange={(event) => setDraft({ ...draft, saleTerritories: event.target.value })}
          />
          <TextArea
            label="Selling points (one per line)"
            value={draft.sellingPoints}
            onChange={(event) => setDraft({ ...draft, sellingPoints: event.target.value })}
          />
          <TextArea
            label="AI tags (one per line)"
            value={draft.aiTags}
            onChange={(event) => setDraft({ ...draft, aiTags: event.target.value })}
          />
          <TextInput
            label="Showcase template reference"
            value={draft.showcaseTemplateReference}
            onChange={(event) =>
              setDraft({ ...draft, showcaseTemplateReference: event.target.value })
            }
          />
          <TextArea
            label="Media references (one per line)"
            value={draft.mediaAssetReferences}
            onChange={(event) => setDraft({ ...draft, mediaAssetReferences: event.target.value })}
          />
          <p className="trademark-commerce__boundary">
            Source trademark facts above remain read-only. Saving changes only this Workspace's
            Commerce Profile.
          </p>
          <div className="trademark-commerce__actions">
            <Button type="submit" disabled={saveState === 'saving'}>
              {saveState === 'saving' ? 'Saving sale context…' : 'Save sale context'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saveState === 'saving'}
              onClick={() => {
                setEditing(false);
                setDraft(formState(current));
                setSaveState('idle');
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}

      {saveState === 'saved' ? (
        <p className="trademark-commerce__feedback" role="status">
          Commerce Profile saved from server-returned state. No Marketplace publication or
          transaction was created.
        </p>
      ) : null}
      {saveState === 'conflict' ? (
        <div
          className="trademark-commerce__feedback trademark-commerce__feedback--warning"
          role="alert"
        >
          <strong>This Commerce Profile changed before your save.</strong>
          <span>
            Your draft has not overwritten the newer version. Reload and confirm it before retrying.
          </span>
          <Button type="button" variant="secondary" onClick={() => void onReload?.()}>
            Reload current profile
          </Button>
        </div>
      ) : null}
      {saveState === 'permission' ? (
        <p
          className="trademark-commerce__feedback trademark-commerce__feedback--warning"
          role="alert"
        >
          You do not have permission to manage this Commerce Profile. Your unsaved draft remains in
          the form.
        </p>
      ) : null}
      {saveState === 'unavailable' ? (
        <p
          className="trademark-commerce__feedback trademark-commerce__feedback--warning"
          role="alert"
        >
          Commerce Profile persistence is unavailable. Nothing was saved and your draft remains in
          the form. {errorMessage}
        </p>
      ) : null}
      {saveState === 'error' ? (
        <p
          className="trademark-commerce__feedback trademark-commerce__feedback--warning"
          role="alert"
        >
          Commerce Profile was not saved. Your draft remains available to correct and retry.{' '}
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}
