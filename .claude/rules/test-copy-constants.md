---
paths:
  - "packages/**/*.test.ts"
  - "packages/**/*.test.tsx"
  - "packages/**/*.tsx"
  - "packages/**/src/**/*.ts"
---

# Test copy constants

- **Extract user-visible dialog / notice copy into an exported constant when a test asserts against it.** When a component renders fixed copy (dialog titles, descriptions, primary button labels) that a test needs to verify, define an exported `xxxCopy` object next to the component or in the hook that owns the variant logic, and import it in both places. Tests reference the constant rather than literal strings, so a copy edit is a one-line change in one file. Applies to multi-variant surfaces (e.g. a dialog whose title / description differ by state) and to any prose string that more than one site reads.

  This complements — does not replace — the `xxxTestIds` pattern in `.contextbridge/rules/testing-patterns.md`: test ids stay the primary handle for locating an element; the copy constant is for asserting against rendered text once the element is in hand.

  **Good:**

  ```ts
  // useAnnotationState.ts
  export const closeReviewDialogCopy = {
    empty: {
      title: 'Approve plan before closing?',
      description:
        'No comments have been added. Select Approve Plan to tell the agent to proceed with the plan as written.',
      primaryActionLabel: 'Approve Plan',
    },
    feedback: {
      title: 'Submit feedback before closing?',
      description: 'You have unsent feedback. Select Submit Feedback before closing, otherwise your comments will be lost.',
      primaryActionLabel: 'Submit Feedback',
    },
  } as const;

  // App.test.tsx
  import { closeReviewDialogCopy } from './useAnnotationState.ts';
  expect(dialog).toHaveTextContent(closeReviewDialogCopy.empty.description);
  ```
