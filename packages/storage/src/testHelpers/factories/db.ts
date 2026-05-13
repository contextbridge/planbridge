import { Factory } from 'fishery';
import type { projects } from '#src/db/schema/index.ts';

const defaultInstant = '2026-05-12T00:00:00Z';

export const project = Factory.define<typeof projects.$inferInsert>(({ sequence }) => ({
  id: `00000000-0000-4000-8000-${sequence.toString().padStart(12, '0')}`,
  path: `/tmp/contextbridge/project-${sequence}`,
  displayName: `project-${sequence}`,
  vcsKind: 'git',
  vcsRootPath: `/tmp/contextbridge/project-${sequence}`,
  gitRemoteUrl: null,
  gitRepositoryId: null,
  createdAt: defaultInstant,
  updatedAt: defaultInstant,
}));
