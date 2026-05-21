export const reviewScaffoldCopy = {
  heading: 'PlanBridge Review',
  tagline: 'Scaffold — functionality coming soon.',
  hint: 'Close this tab or press Ctrl+C in your terminal to end the session.',
} as const;

export function App() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold">{reviewScaffoldCopy.heading}</h1>
      <p className="mt-2 text-muted-foreground">{reviewScaffoldCopy.tagline}</p>
      <p className="mt-6 text-sm text-muted-foreground">{reviewScaffoldCopy.hint}</p>
    </main>
  );
}
