import { safeJsonParse } from '@contextbridge/shared/json';
import { SettingsPatchSchema } from '@contextbridge/shared/settingsSchema';
import type { SettingsStore } from '@contextbridge/shared/settingsStore';

export type UpdateSettings = SettingsStore['patch'];

export async function handleSettings(request: Request, updateSettings: UpdateSettings): Promise<Response> {
  const body = safeJsonParse(await request.text());
  if (body.isErr()) return Response.json({ error: 'invalid settings patch' }, { status: 400 });
  const parsed = SettingsPatchSchema.safeParse(body.value);
  if (!parsed.success) return Response.json({ error: 'invalid settings patch' }, { status: 400 });

  const result = await updateSettings(parsed.data);
  return result.match(
    (settings) => Response.json(settings),
    (error) =>
      error.kind === 'conflict'
        ? Response.json({ error: 'settings file cannot be safely updated' }, { status: 409 })
        : Response.json({ error: 'settings could not be saved' }, { status: 500 }),
  );
}
