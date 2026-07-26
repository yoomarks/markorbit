import type { Meta, StoryObj } from '@storybook/react';
import { MarkregRecommendationExample } from './index.js';
export default {
  title: 'Products/markreg Recommendation',
  component: MarkregRecommendationExample,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof MarkregRecommendationExample>;
export const Default: StoryObj<typeof MarkregRecommendationExample> = {};
export const Mobile: StoryObj<typeof MarkregRecommendationExample> = {
  parameters: { viewport: { defaultViewport: 'mobile1' } }
};
