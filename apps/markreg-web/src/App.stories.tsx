import type { Meta, StoryObj } from '@storybook/react';
import { MarkregApp } from './App.js';
export default {
  title: 'Products/markreg Recommendation',
  component: MarkregApp,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof MarkregApp>;
export const Comparison: StoryObj<typeof MarkregApp> = {};
export const SmallScreen: StoryObj<typeof MarkregApp> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
