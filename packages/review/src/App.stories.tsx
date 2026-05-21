import type { Meta, StoryObj } from '@storybook/react-vite';
import { App } from './App.tsx';

const meta: Meta<typeof App> = {
  title: 'Review/App',
  component: App,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
