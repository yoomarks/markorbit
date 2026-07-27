import type { Meta, StoryObj } from '@storybook/react';
import { LiteApp } from './App.js';
export default {
  title: 'Products/Lite Today',
  component: LiteApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof LiteApp>;
export const Desktop: StoryObj<typeof LiteApp> = {};
export const SmallScreen: StoryObj<typeof LiteApp> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
