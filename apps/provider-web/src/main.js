const root = document.querySelector('#app');

if (!(root instanceof HTMLElement)) {
  throw new Error('Provider Workspace root element is unavailable');
}

root.dataset.runtime = 'provider-workspace-shell';
