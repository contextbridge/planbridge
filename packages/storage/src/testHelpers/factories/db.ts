import { Factory } from 'fishery';
import type { planRevisions, plans, projects } from '#src/db/schema/index.ts';

export const project = Factory.define<typeof projects.$inferInsert>(({ sequence }) => ({
  path: `/tmp/contextbridge/project-${sequence}`,
  displayName: `project-${sequence}`,
  vcsKind: 'git',
  vcsRootPath: `/tmp/contextbridge/project-${sequence}`,
  gitRemoteUrl: null,
  gitRepositoryId: null,
}));

export const plan = Factory.define<typeof plans.$inferInsert>(({ sequence }) => ({
  title: `Plan ${sequence}`,
}));

export const planRevision = Factory.define<typeof planRevisions.$inferInsert>(({ params, sequence }) => {
  if (!params.planId) throw new Error('planRevision factory requires planId');
  return {
    planId: params.planId,
    revisionNumber: sequence,
    content: `# Revision ${sequence}`,
  };
});
