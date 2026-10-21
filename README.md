# mu

mu is a minimal, headless agent runtime and SDK trimmed from [pi](https://github.com/earendil-works/pi). It keeps
pi's model layer, agent loop and session runtime (sessions, compaction, tools, in-process extensions) and drops the
interactive CLI/TUI application around them.

## Relation to pi

- Based on pi **v0.84.2**. The `upstream` git remote points at `https://github.com/earendil-works/pi`.
- The three upstream packages are merged into one package with sources under `src/ai` (pi-ai), `src/agent-core`
  (pi-agent-core) and `src/coding-agent` (pi-coding-agent).
  Cross-package imports are rewritten to relative paths.
- Files that remain keep their upstream paths, and edits inside them are kept small, so upstream fixes can be
  cherry-picked. When cherry-picking, port only changes to code that still exists here.
- `VERSION` (used in user-agent strings) reports the upstream version from `piUpstream.version` in `package.json`.
- Model catalog data in `src/ai/providers/data/` is a snapshot of the published 0.84.2 package. The `anthropic`,
  `openai` and `openai-codex` catalogs are synced from newer pi-ai releases (see [Model catalog](#model-catalog)).

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
- From `coding-agent`: `AgentSessionRuntime`/`createAgentSessionRuntime`, `createAgentSessionServices`,
  `createAgentSessionFromServices` and the project trust store (`ProjectTrustStore`,
  `hasTrustRequiringProjectResources`). Use `createAgentSession`.
- The telemetry package (`src/telemetry`). The `TelemetryContext` type that `StreamOptions.telemetryContext` uses is
  defined in `src/ai/types.ts`.
- The `pi-ai` CLI (`cli.ts`), the faux test provider (`registerFauxProvider`), the legacy `stream*` API aliases and
  image generation (image model catalog, `generateImages`, OpenRouter images).

## Providers and APIs

The model catalog is complete: every provider and built-in model from pi 0.84.2 is listed (with newer data for the
synced providers, see [Model catalog](#model-catalog)), and model lookup and listing work as in pi. Only these API implementations ship:

| API | Used by |
|---|---|
| `anthropic-messages` | `anthropic` (API key and OAuth) and other providers that use this API |
| `openai-responses` | `openai` and other providers that use this API |
| `openai-codex-responses` | `openai-codex` (OAuth, SSE and WebSocket transports) |

Removed: `openai-completions`, `azure-openai-responses`, `bedrock-converse-stream`, `google-generative-ai`,
`google-vertex`, `mistral-conversations` and `pi-messages`. Their provider descriptors and models stay in the
catalog, but a request to such a model ends with an error event: `API "<api>" is not available in mu`. This makes the
OpenAI-compatible providers (OpenRouter, Groq, Cerebras, xAI, DeepSeek, Together, …) and Google, Vertex, Mistral,
Bedrock, Azure and Radius unusable for requests. The stubs live in `src/ai/api/*.lazy.ts` (via `unavailableApi()`
in `src/ai/api/lazy.ts`).

Only the `anthropic` and `openai-codex` OAuth flows ship, and `registerOAuthFlows()` registers just those two.
GitHub Copilot, OpenRouter, Kimi, xAI and Radius still advertise OAuth, but login, refresh and token use fail with
`OAuth flow "<name>" is not available in mu`.

The SDKs for the removed APIs (`@google/genai`, `@aws-sdk/*`, `@smithy/*`, `http(s)-proxy-agent`) are not
dependencies.

AGENTS.md/CLAUDE.md context files, `SYSTEM.md`/`APPEND_SYSTEM.md`, settings, auth and model registries,
sessions, compaction and the built-in tools work as they do in pi.

## Model catalog

The catalog lives in `src/ai/providers/data/<provider>.json` (one object per API, keyed by model id) plus
`.manifest.json` (schema version 3, `generatedAt`, a structure hash over provider/model/API, and a sha256 per file).
Most providers stay frozen at pi 0.84.2, because mu cannot send requests for their APIs anyway. The providers mu can
serve are synced from a published `@earendil-works/pi-ai` release:

```bash
npm run sync-models -- --dry-run            # print the diff against latest, write nothing
npm run sync-models                         # sync anthropic, openai, openai-codex from latest
npm run sync-models -- --version 1.3.0      # a specific version or dist-tag
npm run sync-models -- --provider anthropic # only these providers (repeatable)
```

`scripts/sync-models.mjs` (Node built-ins only) downloads the package tarball from the npm registry, checks its
integrity and the upstream manifest hashes, converts each selected provider's catalog and rewrites the provider files
and `.manifest.json` (`generatedAt` becomes the upstream one). Conversion:

- Upstream keys carry a kind prefix (`chat:claude-opus-5-5`). Only `chat` entries are kept, without the prefix.
  Other kinds (for example `classifier:` models on the `openai-decisions` API) and APIs mu does not know are skipped.
- Fields are filtered to what mu's types declare, read from `src/ai/types.ts`: the `Model` fields, the `ModelCost`
  and `ModelCostTier` fields, the thinking levels, and the compat interface for the model's API. Everything else
  (`type`, `promptCache`, `inputLimits`, newer compat flags such as `supportsMidConvoEffort`,
  `supportsMidConvoSystemMessages`, `supportsMidConvoToolChanges`, `allowedFallbackModels`) is dropped and listed.
- `thinkingLevelMap` is copied as is. Upstream writes more levels explicitly, but the meaning is the same in both:
  a missing level uses the provider default (`xhigh`/`max`: unsupported), `null` marks a level as unsupported, and a
  string is sent as the provider's effort value.
- A model that upstream no longer lists for a synced provider is removed and reported as `REMOVED`.

The script prints added, removed and changed models with every changed field. Before committing a sync:

1. Review the diff. For changed compat flags, thinking levels, context windows, token limits or prices, check that
   mu's API code handles the new values. A dropped compat flag means upstream code mu lacks; look up what it gates
   with `git log -S<flag> upstream/main -- packages/ai/src` and decide whether new models need it.
2. `npm run build`, then load the catalog from `dist/` and request each new model you can reach.

## Additions

APIs mu adds on top of pi:

- `registerOAuthFlows()` (`mu/ai/oauth-flows`): registers the shipped OAuth flows through static imports so they
  resolve in bundled builds. `registerBunOAuthFlows()` (`mu/ai/bun-oauth`) is a deprecated alias.
- `SessionManager.setBeforeAppendMessage(hook)`: a hook that `appendMessage()` runs before storing each message. It
  can replace or skip the message, and may itself append messages ahead of it. `appendMessage()` returns `undefined`
  for a skipped message.
- The session tree semantics (append-only entries, `getBranch()`, `branch()`, `resetLeaf()`) are documented as
  guaranteed in the `SessionManager` TSDoc.

## Exports

| Specifier | Contents |
|---|---|
| `mu/ai` | Models, providers, streaming, credentials |
| `mu/ai/oauth` | OAuth types |
| `mu/ai/oauth-flows` | `registerOAuthFlows()`, which registers the shipped OAuth flows statically for bundled builds |
| `mu/ai/bun-oauth` | `registerBunOAuthFlows()`, a deprecated alias of `registerOAuthFlows()` |
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
