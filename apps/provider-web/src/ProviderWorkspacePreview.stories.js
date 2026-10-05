import providerPreviewHtml from '../provider-workspace-preview.html?raw';
import './styles.css';
import './provider-workspace-preview.css';

export default {
  title: 'Provider Web/Workspace Preview',
  parameters: { layout: 'fullscreen' }
};

export const GovernedWorkQueue = {
  render: () => {
    const source = new DOMParser().parseFromString(providerPreviewHtml, 'text/html');
    const previewRoot = source.querySelector('#preview-root');
    if (!(previewRoot instanceof HTMLElement)) {
      throw new Error('Provider Workspace preview story root is unavailable');
    }
    previewRoot.dataset.storybookProviderPreview = 'true';
    return previewRoot;
  },
  play: async () => {
    await import('./provider-workspace-preview.js?storybook-provider-preview');
  }
};
