import type { Meta, StoryObj } from '@storybook/react';
import { OperationsApp } from './App.js';
export default {
  title: 'Products/Operations Console',
  component: OperationsApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof OperationsApp>;
export const Overview: StoryObj<typeof OperationsApp> = {};
export const SmallScreen: StoryObj<typeof OperationsApp> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
