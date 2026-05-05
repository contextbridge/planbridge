export function pluginListResult(plugins: Array<{ id: string; scope: string }>) {
  return { exitCode: 0, stdout: JSON.stringify(plugins), stderr: '' };
}

export function marketplaceListResult(marketplaces: Array<{ name: string }>) {
  return { exitCode: 0, stdout: JSON.stringify(marketplaces), stderr: '' };
}
