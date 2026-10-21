# mu

mu is a minimal, headless agent runtime and SDK forked from [pi](https://github.com/earendil-works/pi): model layer,
agent loop and session runtime, without an interactive application.

## Upstream

The `upstream` git remote points at pi. Kept files retain their upstream paths and edits inside them stay small, so
upstream fixes can be cherry-picked. Port only changes to code that exists here.

## Model catalog

The catalogs of providers mu can serve are synced from published pi-ai releases:

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
