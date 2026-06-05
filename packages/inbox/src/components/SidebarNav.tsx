import { BrandMark } from '@contextbridge/ui/components/BrandMark';
import { Bot, CircleDot, GitPullRequest, type LucideIcon, MessageSquareText } from 'lucide-react';
import { PARENT_LABELS, SECTIONS, type SectionConfig } from '../sectionConfig.ts';
import { sidebarNavTestIds } from '../testIds.ts';

const SECTION_ICONS: Record<string, LucideIcon> = {
  needs_my_review: MessageSquareText,
  my_prs: GitPullRequest,
  dependabot: Bot,
  assigned_issues: CircleDot,
};

export interface SidebarNavProps {
  readonly activeSection: string;
  readonly sectionCounts: Record<string, number>;
  readonly onSectionChange: (sectionKey: string) => void;
}

export function SidebarNav({ activeSection, sectionCounts, onSectionChange }: SidebarNavProps) {
  const prSections = SECTIONS.filter((s) => s.parent === 'pull_request');
  const issueSections = SECTIONS.filter((s) => s.parent === 'issue');

  return (
    <aside
      data-testid={sidebarNavTestIds.container}
      className="flex min-h-screen w-56 flex-col gap-1 border-r border-sidebar-border bg-neutral-100 p-3 pt-4 dark:bg-neutral-975"
    >
      <div className="mb-3 flex items-center px-1">
        <BrandMark className="size-5 text-foreground" />
      </div>

      <SectionGroup
        icon={GitPullRequest}
        label={PARENT_LABELS.pull_request}
        sections={prSections}
        activeSection={activeSection}
        sectionCounts={sectionCounts}
        onSectionChange={onSectionChange}
      />

      <SectionGroup
        icon={CircleDot}
        label={PARENT_LABELS.issue}
        sections={issueSections}
        activeSection={activeSection}
        sectionCounts={sectionCounts}
        onSectionChange={onSectionChange}
      />
    </aside>
  );
}

interface SectionGroupProps {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly sections: readonly SectionConfig[];
  readonly activeSection: string;
  readonly sectionCounts: Record<string, number>;
  readonly onSectionChange: (sectionKey: string) => void;
}

function SectionGroup({
  label,
  icon: GroupIcon,
  sections,
  activeSection,
  sectionCounts,
  onSectionChange,
}: SectionGroupProps) {
  return (
    <div className="flex flex-col">
      <span className="mb-0.5 flex items-center gap-1.5 px-1 py-1 text-sm text-muted-foreground">
        <GroupIcon className="size-4" />
        {label}
      </span>
      {sections.map((section) => {
        const active = activeSection === section.key;
        const count = sectionCounts[section.key] ?? 0;
        const Icon = SECTION_ICONS[section.key] ?? CircleDot;
        return (
          <button
            key={section.key}
            type="button"
            data-testid={sidebarNavTestIds.sectionButton(section.key)}
            aria-pressed={active}
            className={`flex w-full items-center gap-2 rounded-md pl-5 pr-2 py-1.5 text-sm transition-colors ${
              active
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            }`}
            onClick={() => onSectionChange(section.key)}
          >
            <Icon className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">{section.heading}</span>
            {count > 0 && <span className="tabular-nums text-xs text-muted-foreground">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
