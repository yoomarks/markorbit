import type { Preview } from '@storybook/react';
import '../src/styles.css';
const preview: Preview = {
  parameters: {
    a11y: { config: { rules: [] } },
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } }
  }
};
export default preview;
