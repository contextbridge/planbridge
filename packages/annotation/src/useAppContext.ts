import type { FrontendContext } from '@contextbridge/context/frontend';
import type { AnnotationPayload, AnnotationSubmission } from '@contextbridge/shared/annotationSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import type { UpdateOutcome } from '@contextbridge/shared/updateOutcomeSchema';
import { createContext, useContext } from 'react';

export interface AnnotationAppContext extends FrontendContext {
  fetchPayload: () => Promise<AnnotationPayload>;
  fetchUpdateNotice: () => Promise<UpdateNotice | null>;
  triggerUpdate: () => Promise<UpdateOutcome>;
  submitAnnotation: (submission: AnnotationSubmission) => Promise<void>;
  autoCloseDelaySeconds: number;
}

export const AnnotationAppContext = createContext<AnnotationAppContext | null>(null);

export function useAnnotationAppContext(): AnnotationAppContext {
  const context = useContext(AnnotationAppContext);
  if (!context) {
    throw new Error('useAnnotationAppContext must be used within an AnnotationAppContext.Provider');
  }
  return context;
}
