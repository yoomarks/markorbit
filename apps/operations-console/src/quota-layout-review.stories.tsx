import type { Meta, StoryObj } from '@storybook/react';
import { QuotaLayoutReview } from './quota-layout-review.js';

export default {
  title: 'Reviews/Quota list and detail',
  component: QuotaLayoutReview,
  parameters: { layout: 'fullscreen' }
} satisfies Meta<typeof QuotaLayoutReview>;

export const ThreeQuotaMasterDetail: StoryObj<typeof QuotaLayoutReview> = {};
export const LargeQuotaList: StoryObj<typeof QuotaLayoutReview> = {
  args: { initialMode: 'large' }
};
export const EnglishQuotaMasterDetail: StoryObj<typeof QuotaLayoutReview> = {
  args: { initialLocale: 'en' }
};
