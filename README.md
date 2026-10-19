# mu

mu is a minimal, headless agent runtime and SDK trimmed from [pi](https://github.com/earendil-works/pi). It keeps
pi's model layer, agent loop and session runtime (sessions, compaction, tools, in-process extensions) and drops the
interactive CLI/TUI application around them.

## Relation to pi

- Based on pi **v0.84.2**. The `upstream` git remote points at `https://github.com/earendil-works/pi`.
- The three upstream packages are merged into one package with sources under `src/ai` (pi-ai), `src/agent-core`
  (pi-agent-core), `src/coding-agent` (pi-coding-agent) and `src/telemetry` (types used by `src/ai`).
  Cross-package imports are rewritten to relative paths.
- Files that remain keep their upstream paths, and edits inside them are kept small, so upstream fixes can be
  cherry-picked. When cherry-picking, port only changes to code that still exists here.
- `VERSION` (used in user-agent strings) reports the upstream version from `piUpstream.version` in `package.json`.
- Model catalog data in `src/ai/providers/data/` is a frozen snapshot of the published 0.84.2 package.

## Removed from pi

- The CLI and every run mode: `main`, `cli/`, interactive TUI, RPC and print modes, the package-manager CLI, the RPC
  entry, the Bun entry points (`bun/`), `server/`, the bundled example extensions, the CLI's config migrations and
  self-update.
- `src/tui` (terminal UI library), themes, keybindings, the footer data provider, clipboard, syntax highlighting and
  HTML export (`AgentSession.exportToHtml`).
- The TUI parts of the extension API: `ctx.ui` (`ExtensionUIContext`), shortcuts, message/entry renderers, Markdown
  transformers, command argument completions and the `project_trust` event. `ctx.hasUI` is always `false`.
- Tool renderers (`renderCall`, `renderResult`, `renderShell`). Tool names, descriptions, schemas and prompt snippets
  are unchanged.
- Loading extensions from disk (jiti, `.pi/extensions`, `<agentDir>/extensions`, settings `extensions`). Extensions are
  in-process factories only: pass them as `extensionFactories` to `DefaultResourceLoader`.
- The package manager: settings `packages` (npm/git sources) and its auto-discovery rules (`.agents/skills`, settings
  `skills`/`prompts` path lists and include/exclude patterns). Unless disabled with `noSkills`/`noPromptTemplates`,
  `DefaultResourceLoader` loads skills and prompt templates from `<agentDir>/{skills,prompts}` and, in a trusted
  project, from `<cwd>/.pi/{skills,prompts}`.
- Themes in `DefaultResourceLoader`. The `noThemes` option is still accepted and does nothing.
- From `agent-core`: the agent harness (`harness/`), session search, the stream proxy and telemetry helpers.

AGENTS.md/CLAUDE.md context files, `SYSTEM.md`/`APPEND_SYSTEM.md`, settings, auth and model registries,
sessions, compaction and the built-in tools work as they do in pi.

## Exports

| Specifier | Contents |
|---|---|
| `mu/ai` | Models, providers, streaming, credentials |
| `mu/ai/oauth` | OAuth types |
| `mu/ai/bun-oauth` | `registerBunOAuthFlows()`, which registers the bundled OAuth flow loaders |
| `mu/ai/providers/anthropic` | Anthropic provider |
| `mu/ai/providers/openai-codex` | OpenAI Codex provider |
| `mu/agent-core` | `Agent`, agent loop, message and tool types |
| `mu/coding-agent` | `createAgentSession`, `AgentSession`, `SessionManager`, `SettingsManager`, `DefaultResourceLoader`, `ModelRegistry`/`ModelRuntime`, compaction, skills, extension types and runner, built-in tools |

## Build

```bash
npm install
npm run build   # tsc + copies the model catalog JSON into dist/
```

The output goes to `dist/`. Requires Node.js >= 22.19.

## License

MIT, see [LICENSE](LICENSE). The original copyright belongs to the pi authors.
