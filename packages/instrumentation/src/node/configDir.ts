import { homedir as defaultHomedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const APP_DIR_NAME = 'contextbridge';

export interface ConfigDirEnv {
  readonly XDG_CONFIG_HOME?: string;
  readonly HOME?: string;
}

/**
 * The per-user ContextBridge config directory: `$XDG_CONFIG_HOME/contextbridge`
 * when XDG_CONFIG_HOME is an absolute path, otherwise `~/.config/contextbridge`.
 */
export function configDir(env: ConfigDirEnv, options: { homedir?: () => string } = {}): string {
  const { XDG_CONFIG_HOME: xdgConfigHome, HOME: home } = env;
  const { homedir = defaultHomedir } = options;
  if (xdgConfigHome && isAbsolute(xdgConfigHome)) return join(xdgConfigHome, APP_DIR_NAME);
  const homeDirectory = home && home.length > 0 ? home : homedir();
  return join(homeDirectory, '.config', APP_DIR_NAME);
}
