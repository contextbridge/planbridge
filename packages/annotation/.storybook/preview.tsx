import '@contextbridge/ui/styles.css';
import type { Preview } from '@storybook/react-vite';
import { withAppContext } from './appContextDecorator.tsx';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: { disable: true },
    options: {
      storySort: {
        method: 'alphabetical',
      },
    },
  },
  decorators: [withAppContext()],
};

export default preview;
