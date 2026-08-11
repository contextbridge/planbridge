# Testing patterns

- **Test factories use Fishery with .build() invocations.** Test data is constructed via Fishery `Factory.define<T>()` factories, never hand-rolled `createXxx()` helpers with inline object literals. Shared factories live in `@contextbridge/shared/testFactories`; package-specific factories live in `packages/<pkg>/src/testFactories.ts`. Tests call `.build({ overrides })` to get fixture data.

  **Good:**

  ```typescript
  import { Factory } from 'fishery';
  import type { Environment } from '#src/environment.ts';

  export const environment = Factory.define<Environment>(() => ({
    LOG_LEVEL: 'info',
    DO_NOT_TRACK: false,
    CONTEXTBRIDGE_TELEMETRY_DISABLED: false,
    CONTEXTBRIDGE_UPDATE_CHECK_DISABLED: false,
  }));

  // In test:
  const env = environment.build({ HOME: tmp });
  ```

- **Prefer `toMatchObject` for structured payload assertions.** When a test verifies several fields on the same object or nested payload, use one `expect(value).toMatchObject({ ... })` instead of a run of field-by-field assertions. Keep separate assertions for orthogonal behavior, clearer failure messages, or values that need a specialized matcher.

- **Use the shared deferred-promise helper; do not hand-roll it.** Tests that need manual promise resolution should import `createDeferred` from `@contextbridge/shared/testHelpers`. Do not recreate local `Deferred` types or `new Promise` wrappers in individual test files.

- **Export component test IDs as a colocated object from the component file.** Each React component that exposes test selectors declares its own `xxxTestIds` object next to the component definition and exports it. Tests import this object directly, never using string literals for test IDs. The naming pattern is `<componentName>TestIds`.

  **Good:**

  ```typescript
  // In AnnotationPopover.tsx
  export const annotationPopoverTestIds = {
    container: 'plan-review-annotation-popover',
    textarea: 'plan-review-annotation-popover-textarea',
    cancelButton: 'plan-review-annotation-popover-cancel',
    saveButton: 'plan-review-annotation-popover-save',
  };

  // In test file
  import { annotationPopoverTestIds } from './AnnotationPopover.tsx';
  screen.getByTestId(annotationPopoverTestIds.textarea);
  ```

- **Extract user-visible dialog / notice copy into an exported constant when a test asserts against it.** When a component renders fixed copy (dialog titles, descriptions, primary button labels) that a test needs to verify, define an exported `xxxCopy` object next to the component or in the hook that owns the variant logic, and import it in both places. Tests reference the constant rather than literal strings, so a copy edit is a one-line change in one file. Applies to multi-variant surfaces (e.g. a dialog whose title / description differ by state) and to any prose string that more than one site reads.

  This complements — does not replace — the `xxxTestIds` pattern above: test ids stay the primary handle for locating an element; the copy constant is for asserting against rendered text once the element is in hand.

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
