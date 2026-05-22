import { Factory } from 'fishery';
import type { projects } from '#src/db/schema/index.ts';
import type { CreateInitialPlanInput, CreatePlanRevisionInput } from '#src/PlanRepositoryImpl.ts';

export const project = Factory.define<typeof projects.$inferInsert>(({ sequence }) => ({
  path: `/tmp/contextbridge/project-${sequence}`,
  displayName: `project-${sequence}`,
  vcsKind: 'git',
  vcsRootPath: `/tmp/contextbridge/project-${sequence}`,
  gitRemoteUrl: null,
  gitRepositoryId: null,
}));

export const initialPlanInput = Factory.define<CreateInitialPlanInput>(() => ({
  projectRoot: '/work/project',
  content: '# Plan\n\nStep 1.',
  sourcePath: '/work/project/plan.md',
  status: 'changes_requested',
}));

export const planRevisionInput = Factory.define<CreatePlanRevisionInput>(() => ({
  planId: 'plan_placeholder',
  content: '# Revised plan',
  sourcePath: '/work/project/revised.md',
  status: 'approved',
}));
