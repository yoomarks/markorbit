import type { Meta, StoryObj } from '@storybook/react';
import { OperationsConsoleShell } from './index.js';
export default {
  title: 'Products/Operations Console',
  component: OperationsConsoleShell,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof OperationsConsoleShell>;
export const Default: StoryObj<typeof OperationsConsoleShell> = {};
export const Mobile: StoryObj<typeof OperationsConsoleShell> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
