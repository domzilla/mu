import { anthropicOAuth } from "./auth/oauth/anthropic.ts";
import { registerBundledOAuthFlowLoaders } from "./auth/oauth/load.ts";
import { openaiCodexOAuth } from "./auth/oauth/openai-codex.ts";

/**
 * Registers the shipped OAuth flows (`anthropic`, `openai-codex`) through static imports.
 *
 * By default each OAuth flow module is loaded lazily through a variable dynamic `import()`, which bundlers
 * (esbuild, Rollup, webpack, Bun) cannot follow. Call this once at startup in any bundled build, before the
 * first OAuth login, refresh or token use, so the flows resolve from the bundle instead. Calling it in an
 * unbundled build is harmless; calling it again has no further effect.
 */
export function registerOAuthFlows(): void {
	registerBundledOAuthFlowLoaders({
		anthropic: () => anthropicOAuth,
		openaiCodex: () => openaiCodexOAuth,
	});
}
