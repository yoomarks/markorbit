import providerWorkspaceHtml from '../index.html?raw';
import './styles.css';

export default {
  title: 'Provider Web/Infrastructure',
  parameters: { layout: 'fullscreen' }
};

export const ShellRegistration = {
  render: () => {
    const source = new DOMParser().parseFromString(providerWorkspaceHtml, 'text/html');
    const app = source.querySelector('#app');
    if (!(app instanceof HTMLElement))
      throw new Error('Provider Workspace story shell is unavailable');
    app.dataset.storybookProviderRegistration = 'true';
    return app;
  },
  play: async () => {
    await import('./main.js?storybook-shell-registration');
  }
};
