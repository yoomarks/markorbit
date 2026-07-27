import type { StorybookConfig } from '@storybook/react-vite';
const config: StorybookConfig = {
  stories: [
    '../src/**/*.stories.@(ts|tsx)',
    '../../../apps/lite-web/src/**/*.stories.@(ts|tsx)',
    '../../../apps/markreg-web/src/**/*.stories.@(ts|tsx)',
    '../../../apps/operations-console/src/**/*.stories.@(ts|tsx)'
  ],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: { name: '@storybook/react-vite', options: {} },
  docs: { autodocs: 'tag' }
};
export default config;
