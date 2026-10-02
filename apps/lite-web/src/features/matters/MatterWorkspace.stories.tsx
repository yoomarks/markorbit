import type { Meta, StoryObj } from '@storybook/react';
import { MatterWorkspaceHttpError } from '../../api/matters.js';
import { PrivateCaseEvidencePanel } from './MatterWorkspace.js';
import {
  privateEvidenceClient,
  privateEvidenceMatter,
  privateEvidenceReferences
} from './private-case-evidence-fixtures.js';

const meta = {
  title: 'Lite/Matters/Exact private Case evidence',
  component: PrivateCaseEvidencePanel,
  parameters: { layout: 'padded' },
  args: {
    matter: privateEvidenceMatter,
    client: privateEvidenceClient()
  }
} satisfies Meta<typeof PrivateCaseEvidencePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};

export const Loading: Story = {
  args: {
    client: privateEvidenceClient({ listPrivateEvidence: () => new Promise(() => undefined) })
  }
};

export const Empty: Story = {
  args: {
    client: privateEvidenceClient({
      listPrivateEvidence: () => Promise.resolve({ ...privateEvidenceReferences, items: [] })
    })
  }
};

const listFailure = (status: number, code: string, message: string) =>
  privateEvidenceClient({
    listPrivateEvidence: () => Promise.reject(new MatterWorkspaceHttpError(status, code, message))
  });

export const SignInRequired: Story = {
  args: { client: listFailure(401, 'AUTHENTICATION_REQUIRED', 'Sign in is required.') }
};

export const PermissionDenied: Story = {
  args: {
    client: listFailure(403, 'PERMISSION_DENIED', 'Current Matter read permission is required.')
  }
};

export const NotFound: Story = {
  args: {
    client: listFailure(
      404,
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_NOT_FOUND',
      'The exact Matter was not found.'
    )
  }
};

export const Stale: Story = {
  args: {
    client: listFailure(
      409,
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_STALE',
      'An accepted binding no longer matches the current Matter.'
    )
  }
};

export const OwnerUnavailable: Story = {
  args: {
    client: listFailure(
      503,
      'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
      'The private evidence owner is temporarily unavailable.'
    )
  }
};

export const PartialReferenceOwnerUnavailable: Story = {
  args: {
    client: privateEvidenceClient({
      readPrivateEvidence: () =>
        Promise.reject(
          new MatterWorkspaceHttpError(
            503,
            'WORKSPACE_PRIVATE_CASE_EVIDENCE_SOURCE_UNAVAILABLE',
            'The reference is current, but exact Knowledge retrieval is temporarily unavailable.'
          )
        )
    })
  }
};
