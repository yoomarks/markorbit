import type { Meta, StoryObj } from '@storybook/react';
import {
  KnowledgeOperatorRunHttpError,
  type KnowledgeOperatorRunClient
} from '../../api/knowledge-operator-runs.js';
import { KnowledgeRunDispatch } from './KnowledgeRunDispatch.js';

const readyClient: KnowledgeOperatorRunClient = {
  dispatch: () =>
    Promise.resolve({
      replayed: false,
      record: { run: { id: 'run_story' }, job: { id: 'job_story' } }
    })
};

const meta = {
  title: 'Lite/Knowledge Run Dispatch',
  component: KnowledgeRunDispatch,
  args: { workspaceId: 'workspace-story', client: readyClient },
  parameters: { a11y: { disable: false } }
} satisfies Meta<typeof KnowledgeRunDispatch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {};
export const Dispatching: Story = {
  args: { client: { dispatch: () => new Promise(() => undefined) } }
};
export const PermissionDenied: Story = {
  args: {
    client: {
      dispatch: () =>
        Promise.reject(
          new KnowledgeOperatorRunHttpError(403, 'PERMISSION_DENIED', 'Permission denied.')
        )
    }
  }
};
export const Mobile390: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
      viewports: { mobile1: { name: '390px mobile', styles: { width: '390px', height: '844px' } } }
    }
  }
};
