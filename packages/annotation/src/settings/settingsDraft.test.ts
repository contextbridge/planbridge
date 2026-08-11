import { settings } from '@contextbridge/shared/testFactories';
import { describe, expect, it } from 'vitest';
import { settingsDraft } from '#src/testFactories.ts';
import { diffSettingsDraft, draftFromSettings } from './settingsDraft.ts';

describe('draftFromSettings', () => {
  it('maps every resolved setting onto its draft field', () => {
    const resolved = settings.build({ ui: { theme: 'nord' }, harnesses: { claude: { planApprovalMode: 'default' } } });

    expect(draftFromSettings(resolved)).toEqual(
      settingsDraft.build({ theme: 'nord', claudePlanApprovalMode: 'default' }),
    );
  });
});

describe('diffSettingsDraft', () => {
  it('returns an empty patch when nothing changed', () => {
    const saved = settingsDraft.build();

    expect(diffSettingsDraft(saved, settingsDraft.build())).toEqual({});
  });

  it('patches only the ui section when the theme changed', () => {
    const saved = settingsDraft.build();

    const patch = diffSettingsDraft(saved, settingsDraft.build({ theme: 'dracula' }));

    expect(patch).toEqual({ ui: { theme: 'dracula' } });
    expect(patch).not.toHaveProperty('harnesses');
  });

  it('patches only the harness section when the plan approval mode changed', () => {
    const saved = settingsDraft.build();

    const patch = diffSettingsDraft(saved, settingsDraft.build({ claudePlanApprovalMode: 'acceptEdits' }));

    expect(patch).toEqual({ harnesses: { claude: { planApprovalMode: 'acceptEdits' } } });
    expect(patch).not.toHaveProperty('ui');
  });

  it('patches both sections when both fields changed', () => {
    const saved = settingsDraft.build();

    const patch = diffSettingsDraft(
      saved,
      settingsDraft.build({ theme: 'tokyo-night', claudePlanApprovalMode: 'default' }),
    );

    expect(patch).toEqual({
      ui: { theme: 'tokyo-night' },
      harnesses: { claude: { planApprovalMode: 'default' } },
    });
  });
});
