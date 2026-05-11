import type { FrontendContext } from '@contextbridge/context/frontend';
import type { PerformUpdateResult } from '@contextbridge/shared/performUpdateResultSchema';
import type { PlanReviewSubmission, SubmissionPayload } from '@contextbridge/shared/planReviewSchema';
import type { UpdateNotice } from '@contextbridge/shared/updateNoticeSchema';
import { createContext, useContext } from 'react';

export interface PlanAppContext extends FrontendContext {
  fetchPayload: () => Promise<SubmissionPayload>;
  fetchUpdateNotice: () => Promise<UpdateNotice | null>;
  performUpdate: () => Promise<PerformUpdateResult>;
  submitPlanReview: (submission: PlanReviewSubmission) => Promise<void>;
  autoCloseDelaySeconds: number;
}

export const PlanAppContext = createContext<PlanAppContext | null>(null);

export function usePlanAppContext(): PlanAppContext {
  const context = useContext(PlanAppContext);
  if (!context) {
    throw new Error('usePlanAppContext must be used within a PlanAppContext.Provider');
  }
  return context;
}
