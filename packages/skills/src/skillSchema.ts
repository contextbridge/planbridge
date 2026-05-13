import { z } from 'zod';

// Mirrors the agentskills.io frontmatter spec: https://agentskills.io/specification
export const SkillFrontmatterSchema = z
  .object({
    name: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase kebab-case; no leading, trailing, or consecutive hyphens'),
    description: z.string().trim().nonempty().max(1024),
    license: z.string().optional(),
    compatibility: z.string().max(500).optional(),
    metadata: z.record(z.string(), z.string()).optional(),
    'allowed-tools': z.string().optional(),
  })
  .strict();

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

export interface CanonicalSkill {
  readonly frontmatter: SkillFrontmatter;
  readonly body: string;
}
