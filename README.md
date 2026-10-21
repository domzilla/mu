# mu

mu is a minimal, headless agent runtime and SDK trimmed from [pi](https://github.com/earendil-works/pi) v0.84.2. It
keeps pi's model layer, agent loop and session runtime and drops the interactive application around them.

## Relation to pi

- The `upstream` git remote points at pi. Kept files retain their upstream paths and edits inside them stay small,
  so upstream fixes can be cherry-picked. Port only changes to code that still exists here.
- `src/ai`, `src/agent-core` and `src/coding-agent` correspond to the pi packages pi-ai, pi-agent-core and
  pi-coding-agent.

## Differences from pi

- **Removed:** the CLI, all run modes, the TUI and themes, the package manager, HTML export, the agent harness,
  telemetry, image generation, and loading extensions from disk (extensions are in-process factories only).
- **Providers:** only the `anthropic-messages`, `openai-responses` and `openai-codex-responses` APIs ship. All other
  providers stay in the model catalog, but requests to them fail with `API "<api>" is not available in mu`. Only the
  `anthropic` and `openai-codex` OAuth flows ship.
- **Added:** `registerOAuthFlows()` (static OAuth registration for bundled builds) and
  `SessionManager.setBeforeAppendMessage()`.

## Model catalog

The catalogs of the usable providers (`anthropic`, `openai`, `openai-codex`) are synced from published pi-ai
releases. All other providers stay frozen at 0.84.2.

```bash
npm run sync-models -- --dry-run    # show the diff, write nothing
npm run sync-models                 # sync from the latest release
```

Before committing a sync, review the diff: for changed compat flags, thinking levels, limits or prices, check that
mu's API code handles the new values. A dropped compat flag means upstream code mu lacks; find what it gates with
`git log -S<flag> upstream/main -- packages/ai/src`. Then build and try the new models.

## Build

```bash
npm install
npm run build
```

## License

MIT, see [LICENSE](LICENSE). The original copyright belongs to the pi authors.
