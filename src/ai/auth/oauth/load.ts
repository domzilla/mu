import type { OAuthAuth } from "../types.ts";

/**
 * Loads an OAuth flow module through a variable specifier so bundlers cannot
 * follow the import into Node-only flow code (`node:http` callback servers,
 * `node:crypto` PKCE). The `.ts`/`.js` rewrite keeps the trick working from
 * both source and built output.
 */
const importOAuthModule = (specifier: string): Promise<unknown> => {
	const runtimeSpecifier = import.meta.url.endsWith(".js") ? specifier.replace(/\.ts$/, ".js") : specifier;
	return import(runtimeSpecifier);
};

type OAuthFlowLoaders = {
	anthropic: () => OAuthAuth | Promise<OAuthAuth>;
	openaiCodex: () => OAuthAuth | Promise<OAuthAuth>;
};

let bundledLoaders: OAuthFlowLoaders | undefined;

/** Registers statically bundled OAuth flows for standalone Bun binaries. */
export function registerBundledOAuthFlowLoaders(loaders: OAuthFlowLoaders): void {
	bundledLoaders = loaders;
}

export const loadAnthropicOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.anthropic();
	return ((await importOAuthModule("./anthropic.ts")) as { anthropicOAuth: OAuthAuth }).anthropicOAuth;
};

export const loadOpenAICodexOAuth = async (): Promise<OAuthAuth> => {
	if (bundledLoaders) return bundledLoaders.openaiCodex();
	return ((await importOAuthModule("./openai-codex.ts")) as { openaiCodexOAuth: OAuthAuth }).openaiCodexOAuth;
};

/** Loader for an OAuth flow mu does not ship: the provider keeps advertising OAuth, but using it fails. */
const unavailableOAuth =
	(name: string) =>
	async (..._args: unknown[]): Promise<OAuthAuth> => {
		throw new Error(`OAuth flow "${name}" is not available in mu`);
	};

export const loadGitHubCopilotOAuth = unavailableOAuth("github-copilot");
export const loadOpenRouterOAuth = unavailableOAuth("openrouter");
export const loadKimiCodingOAuth = unavailableOAuth("kimi-coding");
export const loadXaiOAuth = unavailableOAuth("xai");
export const loadRadiusOAuth: (options: { name: string; gateway: string }) => Promise<OAuthAuth> =
	unavailableOAuth("radius");
