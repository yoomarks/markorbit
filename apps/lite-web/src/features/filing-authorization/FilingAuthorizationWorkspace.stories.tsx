import type { Meta, StoryObj } from '@storybook/react';
import {
  authorizationForScenario,
  clientForScenario,
  previewAuthorizationId,
  previewConsequences,
  previewWorkspaceId
} from '../../filing-authorization-preview/fixtures.js';
import { FilingAuthorizationWorkspace } from './FilingAuthorizationWorkspace.js';

const meta = {
  title: 'Lite/Filing Authorization Workspace',
  component: FilingAuthorizationWorkspace,
  parameters: { layout: 'fullscreen' },
  args: {
    workspaceId: previewWorkspaceId,
    filingAuthorizationId: previewAuthorizationId,
    client: clientForScenario('ready')
  }
} satisfies Meta<typeof FilingAuthorizationWorkspace>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PendingConfirmation: Story = {
  args: {
    initialAuthorization: authorizationForScenario('ready'),
    initialConsequences: previewConsequences
  }
};
export const Loading: Story = {
  args: { client: clientForScenario('loading') }
};
export const PartialSource: Story = {
  args: {
    initialAuthorization: authorizationForScenario('partial'),
    initialConsequences: previewConsequences
  }
};
export const Unauthorized: Story = {
  args: { client: clientForScenario('unauthorized') }
};
export const PermissionDenied: Story = {
  args: {
    initialAuthorization: authorizationForScenario('ready'),
    client: clientForScenario('permission')
  }
};
export const NotFound: Story = {
  args: { client: clientForScenario('missing') }
};
export const SourceConflict: Story = {
  args: {
    initialAuthorization: authorizationForScenario('ready'),
    client: clientForScenario('conflict')
  }
};
export const ValidationBlocked: Story = {
  args: {
    initialAuthorization: authorizationForScenario('ready'),
    client: clientForScenario('validation')
  }
};
export const ServiceUnavailable: Story = {
  args: { client: clientForScenario('unavailable') }
};
export const Confirming: Story = {
  args: {
    initialAuthorization: authorizationForScenario('ready'),
    client: clientForScenario('confirming')
  }
};
export const AuthorizedReceipt: Story = {
  args: {
    initialAuthorization: authorizationForScenario('authorized'),
    initialConsequences: previewConsequences
  }
};
export const Stale: Story = {
  args: {
    initialAuthorization: authorizationForScenario('stale'),
    initialConsequences: previewConsequences
  }
};
export const Expired: Story = {
  args: {
    initialAuthorization: authorizationForScenario('expired'),
    initialConsequences: previewConsequences
  }
};
export const Withdrawn: Story = {
  args: {
    initialAuthorization: authorizationForScenario('withdrawn'),
    initialConsequences: previewConsequences
  }
};
export const Mobile390: Story = {
  args: {
    initialAuthorization: authorizationForScenario('ready'),
    initialConsequences: previewConsequences
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px', styles: { width: '390px', height: '844px' } } }
    }
  }
};
