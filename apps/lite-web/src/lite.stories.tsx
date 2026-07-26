import type { Meta, StoryObj } from '@storybook/react';
import { LiteTodayShell } from './index.js';
export default {
  title: 'Products/Lite Today',
  component: LiteTodayShell,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof LiteTodayShell>;
export const Default: StoryObj<typeof LiteTodayShell> = {};
export const Mobile: StoryObj<typeof LiteTodayShell> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
