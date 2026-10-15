---
name: setup-gpt-seat
description: Set up the pstack GPT seat. Writes the recommended pstack model sheet if none exists, adds its include line to CLAUDE.md, checks that the Codex CLI and Node.js are available, and assists with Codex login when needed. Use for /setup-gpt-seat or "set up the GPT seat".
---

# Setup GPT seat

Run the setup script and show its output to the user:

```bash
sh "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
```

Then act on what it printed:

- `codex: MISSING`: help install the Codex CLI (`npm install -g @openai/codex`), then follow the `gpt-seat:login-codex` skill.
- `codex login: Not logged in`: follow the `gpt-seat:login-codex` skill to start login from Claude Code, assist with browser authentication where tools permit, and verify completion. Reuse an existing login. If status is ambiguous or reports another error, run `codex login status` directly and inspect its exit status before deciding to start login.
- `node: MISSING`: pstack's bundled scripts need Node.js; point the user at the install notes in the plugin README.
- `sheet: exists, left untouched`: the user already has a pstack sheet. Show them the panel lines the GPT seat expects (`arena runners: opus, fable`, `arena cross-judge pool: fable, opus`, `architect runners: opus, fable`, `interrogate reviewers: opus, fable`) and offer to change their sheet with `/pstack:setup-pstack`. Do not edit the sheet silently.

Finish by saying that the seat instructions are injected at the start of every session by the plugin's SessionStart hook, so a new session is needed before they apply, and that `codex-seat` lives at `${CLAUDE_PLUGIN_ROOT}/scripts/codex-seat`.
