import { Factory } from 'fishery';
import type { projects } from '#src/db/schema/index.ts';

export const project = Factory.define<typeof projects.$inferInsert>(({ sequence }) => ({
  path: `/tmp/contextbridge/project-${sequence}`,
  displayName: `project-${sequence}`,
  vcsKind: 'git',
  vcsRootPath: `/tmp/contextbridge/project-${sequence}`,
  gitRemoteUrl: null,
  gitRepositoryId: null,
}));
