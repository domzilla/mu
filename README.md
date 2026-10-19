# mu

Trimmed single-package fork of the [Pi](https://github.com/earendil-works/pi) agent framework
(based on upstream v0.84.2).

Entry points:

- `mu/ai` (+ `mu/ai/oauth`, `mu/ai/bun-oauth`, `mu/ai/providers/anthropic`, `mu/ai/providers/openai-codex`)
- `mu/agent-core`
- `mu/coding-agent`

Build: `npm install && npm run build` (output in `dist/`).

Model catalog data in `src/ai/providers/data/` is a frozen snapshot of the published 0.84.2 package.
