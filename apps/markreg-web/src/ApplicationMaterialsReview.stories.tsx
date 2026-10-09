import type { Meta, StoryObj } from '@storybook/react';
import { ApplicationMaterialsReview } from './ApplicationMaterialsReview.js';
import {
  partialConflictFixture,
  readyForHandoffFixture,
  unsupportedFixture
} from './application-materials-review-fixtures.js';

const meta = {
  title: 'MarkReg/M21 Application Materials Review',
  component: ApplicationMaterialsReview,
  parameters: { layout: 'fullscreen' },
  args: { fixture: partialConflictFixture }
} satisfies Meta<typeof ApplicationMaterialsReview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PartialReviewWithConflict: Story = {
  args: { surfaceState: 'WORKING' }
};

export const ReadyForHandlerReview: Story = {
  args: {
    fixture: readyForHandoffFixture,
    surfaceState: 'WORKING'
  }
};

export const StaleSourceReadOnly: Story = {
  args: { surfaceState: 'STALE' }
};

export const DependencyUnavailableManualPath: Story = {
  args: { surfaceState: 'DEPENDENCY_UNAVAILABLE' }
};

export const Loading: Story = {
  args: { surfaceState: 'LOADING' }
};

export const NoAuthorizedSource: Story = {
  args: { surfaceState: 'EMPTY' }
};

export const RecoverableSaveError: Story = {
  args: { surfaceState: 'SAVE_ERROR' }
};

export const PermissionDenied: Story = {
  args: { surfaceState: 'FORBIDDEN' }
};

export const UnsupportedScope: Story = {
  args: {
    fixture: unsupportedFixture,
    surfaceState: 'UNSUPPORTED'
  }
};

export const SavedSnapshot: Story = {
  args: {
    fixture: readyForHandoffFixture,
    surfaceState: 'SAVED'
  }
};

export const HandedOffNotFiled: Story = {
  args: {
    fixture: readyForHandoffFixture,
    surfaceState: 'HANDED_OFF'
  }
};

export const Mobile390PartialConflict: Story = {
  args: { surfaceState: 'WORKING' },
  parameters: {
    viewport: {
      viewports: {
        markreg390: {
          name: 'MarkReg 390px',
          styles: { width: '390px', height: '844px' }
        }
      },
      defaultViewport: 'markreg390'
    }
  }
};
