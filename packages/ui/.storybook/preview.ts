import type { Preview } from '@storybook/react';
import '../src/styles.css';
const preview: Preview = {
  parameters: {
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
    layout: 'padded'
  }
};
export default preview;
