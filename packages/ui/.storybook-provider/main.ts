import type { StorybookConfig } from '@storybook/html-vite';

const config: StorybookConfig = {
  stories: ['../../../apps/provider-web/src/**/*.stories.@(js|mjs|ts)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/html-vite', options: {} },
  docs: { autodocs: 'tag' }
};

export default config;
