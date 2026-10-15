---
name: setup-gpt-seat
description: Set up the pstack GPT seat. Writes the recommended pstack model sheet if none exists, adds its include line to CLAUDE.md, and checks that the Codex CLI, Node.js and a Codex login are available. Use for /setup-gpt-seat or "set up the GPT seat".
---

# Setup GPT seat

Run the setup script and show its output to the user:

```bash
sh "${CLAUDE_PLUGIN_ROOT}/scripts/setup.sh"
```

Then act on what it printed:

- `codex: MISSING`: tell the user to install the Codex CLI (`npm install -g @openai/codex`) and sign in with `codex login` in their own terminal. Never run the sign-in yourself.
- `codex login: Not logged in`: tell the user to run `codex login` in their own terminal. The seat is skipped automatically until they do.
- `node: MISSING`: pstack's bundled scripts need Node.js; point the user at the install notes in the plugin README.
- `sheet: exists, left untouched`: the user already has a pstack sheet. Show them the panel lines the GPT seat expects (`arena runners: opus, fable`, `arena cross-judge pool: fable, opus`, `architect runners: opus, fable`, `interrogate reviewers: opus, fable`) and offer to change their sheet with `/pstack:setup-pstack`. Do not edit the sheet silently.

Finish by saying that the seat instructions are injected at the start of every session by the plugin's SessionStart hook, so a new session is needed before they apply, and that `codex-seat` lives at `${CLAUDE_PLUGIN_ROOT}/scripts/codex-seat`.
