#!/usr/bin/env node
// Read configuration only. Never print transport environment values or credentials.
import { spawnSync } from 'node:child_process';

const result = spawnSync('codex', ['mcp', 'get', 'cua_repl', '--json'], {
  encoding: 'utf8', timeout: 15000, maxBuffer: 1024 * 1024,
});
let config;
try {
  if (result.error || result.status !== 0) throw new Error();
  config = JSON.parse(result.stdout);
} catch {
  console.error('browser: CUA configuration unavailable. Connect the official computer/browser-use integration in Codex first; no settings were changed.');
  process.exit(1);
}
if (!config.enabled || config.disabled_tools?.includes('js') ||
    (Array.isArray(config.enabled_tools) && !config.enabled_tools.includes('js'))) {
  console.error('browser: CUA js tool is disabled. Review the existing Codex integration settings; no permissions were changed.');
  process.exit(1);
}
console.error('browser: CUA configured. The delegated Codex must still verify tool startup, UI access and login state.');
