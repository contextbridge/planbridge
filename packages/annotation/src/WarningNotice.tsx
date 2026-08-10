import type { ReactNode } from 'react';

interface WarningNoticeProps {
  testId: string;
  children: ReactNode;
}

export function WarningNotice({ testId, children }: WarningNoticeProps) {
  return (
    <div
      className="border-l-2 border-chart-1 px-3 py-2 text-sm leading-6 text-muted-foreground xl:col-start-2"
      data-testid={testId}
    >
      {children}
    </div>
  );
}
