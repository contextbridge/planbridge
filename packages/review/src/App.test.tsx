import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App, reviewScaffoldCopy } from './App.tsx';

describe('App', () => {
  it('renders the scaffold placeholder', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: reviewScaffoldCopy.heading })).toBeInTheDocument();
    expect(screen.getByText(reviewScaffoldCopy.tagline)).toBeInTheDocument();
    expect(screen.getByText(reviewScaffoldCopy.hint)).toBeInTheDocument();
  });
});
