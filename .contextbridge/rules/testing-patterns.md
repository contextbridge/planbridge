---
paths: ["packages/**/*.test.ts", "packages/**/*.test.tsx", "packages/**/*TestIds*", "packages/**/testFactories.ts", "packages/**/*.tsx"]
globs: ["packages/**/*.test.ts", "packages/**/*.test.tsx", "packages/**/*TestIds*", "packages/**/testFactories.ts", "packages/**/*.tsx"]
---

# Testing Patterns

- **Test factories use Fishery with .build() invocations.** Test data is constructed via Fishery \`Factory.define\<T>()\` factories, never hand-rolled \`createXxx()\` helpers with inline object literals. Shared factories live in \`@contextbridge/shared/testFactories\`; package-specific factories live in \`packages/\<pkg>/src/testFactories.ts\`. Tests call \`.build({ overrides })\` to get fixture data.

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

- **Export component test IDs as a colocated object from the component file.** Each React component that exposes test selectors declares its own \`xxxTestIds\` object next to the component definition and exports it. Tests import this object directly, never using string literals for test IDs. The naming pattern is \`\<componentName>TestIds\`.

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
